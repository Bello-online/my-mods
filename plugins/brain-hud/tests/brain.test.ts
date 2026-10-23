import { describe, expect, mock, test } from 'claude-code/testing'

import type { On } from 'claude-code'

import type { BrainState } from '../types'
import { brainSphereSvg, brainSvg } from '../hooks/brain-svg'
import { orb, overlayLine } from '../hooks/brain-ascii'
import { PHASES, classify } from '../hooks/phases'

const PANE = {
  plugin: 'brain-hud',
  component: 'Pane',
  requestId: 'brain-hud',
  props: {
    title: 'Claude Brain',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const base: BrainState = {
  phase: 'idle',
  prevPhase: 'idle',
  detail: '',
  since: 0,
  turnStartedAt: null,
  turnCount: 0,
  toolCount: 0,
  active: 0,
  recent: [],
}

describe('classify', () => {
  test('maps each kind of tool to its phase and a short label', () => {
    expect(classify('Read', { file_path: 'C:\\repo\\src\\app.ts' })).toEqual({
      phase: 'reading',
      label: 'src/app.ts',
    })
    expect(classify('Edit', { file_path: '/repo/src/app.ts' }).phase).toBe('editing')
    expect(classify('Write', { file_path: '/repo/README.md' }).phase).toBe('editing')
    expect(classify('Bash', { command: 'npm test', description: 'Run the tests' })).toEqual({
      phase: 'running',
      label: 'Run the tests',
    })
    expect(classify('PowerShell', { command: 'git status' }).phase).toBe('running')
    expect(classify('Grep', { pattern: 'TODO' })).toEqual({ phase: 'searching', label: '/TODO/' })
    expect(classify('Glob', { pattern: '**/*.ts' }).phase).toBe('searching')
    expect(classify('WebSearch', { query: 'svg smil' }).phase).toBe('searching')
    expect(classify('WebFetch', { url: 'https://example.com/docs' })).toEqual({
      phase: 'web',
      label: 'example.com/docs',
    })
    expect(classify('Agent', { description: 'Explore the repo' })).toEqual({
      phase: 'delegating',
      label: 'Explore the repo',
    })
    expect(classify('mcp__figma__get_design_context', {})).toEqual({
      phase: 'connecting',
      label: 'get design context',
    })
    expect(classify('SomethingNew', {}).phase).toBe('working')
  })

  test('clips long labels', () => {
    const long = 'x'.repeat(200)
    expect(classify('Bash', { command: long }).label.length).toBeLessThanOrEqual(60)
  })
})

describe('brainSvg', () => {
  test('draws every phase as one bounded SVG document with its label', () => {
    for (const phase of Object.keys(PHASES) as Array<keyof typeof PHASES>) {
      const svg = brainSvg({ ...base, phase, prevPhase: 'idle', detail: 'hello', turnStartedAt: 1000 }, 6000)
      expect(svg.startsWith('<svg ')).toBe(true)
      expect(svg.endsWith('</svg>')).toBe(true)
      expect(svg.length).toBeLessThan(131072)
      expect(svg).toContain(PHASES[phase].label.toUpperCase())
      expect(svg).not.toContain('<script')
    }
  })

  test('each phase carries its own overlay and the transition morphs from the previous colour', () => {
    const reading = brainSvg({ ...base, phase: 'reading', prevPhase: 'thinking' }, 0)
    expect(reading).toContain('clip-path="url(#disc)"')
    expect(reading).toContain(`from="${PHASES.thinking.color}" to="${PHASES.reading.color}"`)
    expect(brainSvg({ ...base, phase: 'searching' }, 0)).toContain('url(#sweep)')
    expect(brainSvg({ ...base, phase: 'done' }, 0)).toContain('stroke-dashoffset')
    expect(brainSvg({ ...base, phase: 'running' }, 0)).toContain('from="28" to="96"')
    expect(brainSvg({ ...base, phase: 'delegating' }, 0)).toContain('rotate(120')
  })

  test('escapes the detail text', () => {
    const svg = brainSvg({ ...base, phase: 'editing', detail: '<b>&"x"' }, 0)
    expect(svg).toContain('&lt;b&gt;&amp;&quot;x&quot;')
  })
})

describe('terminal drawing', () => {
  test('the orb animates with the tick and shrinks to a spinner in a narrow pane', () => {
    const a = orb(0, 'thinking', 40)
      .map(r => r.text)
      .join('\n')
    const b = orb(1, 'thinking', 40)
      .map(r => r.text)
      .join('\n')
    expect(a).not.toBe(b)
    expect(a).toContain('●')
    expect(orb(3, 'reading', 20)).toHaveLength(1)
    expect(overlayLine(2, 'reading', 27).text).toContain('▓')
    expect(overlayLine(0, 'done', 27).text).toContain('done')
  })
})

describe('brainSphereSvg', () => {
  test('is a bounded SVG whose points ride elliptical orbits, with the recent calls as tooltip nodes', () => {
    const svg = brainSphereSvg(
      {
        ...base,
        phase: 'reading',
        prevPhase: 'thinking',
        detail: 'src/app.ts',
        recent: [{ id: 'a', tool: 'Read', label: 'src/app.ts', phase: 'reading', startedAt: 0, ms: 120 }],
      },
      5000,
    )
    expect(svg.startsWith('<svg ')).toBe(true)
    expect(svg.length).toBeLessThan(131072)
    expect((svg.match(/<animateMotion/g) ?? []).length).toBeGreaterThan(90)
    expect(svg).toContain('<title>Read · src/app.ts · 120ms</title>')
    expect(svg).toContain('READING')
    expect(svg).toContain('clip-path="url(#disc)"')
    expect(svg).not.toContain('<script')
    // paused: no motion left, hover reactions kept
    const still = brainSphereSvg({ ...base, phase: 'thinking' }, 0, { paused: true })
    expect(still).not.toContain('<animate')
    expect(still).toContain('<set ')
  })
})

function stubs(on: On) {
  const clock = mock.clock(on, { now: 10_000 })
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.start', async (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_, e) => ({ text: e.answer }))
  on('ui.status', async () => ({ value: undefined }) as never)
  return clock
}

describe('the pane follows the turn', () => {
  test('on the desktop the 3D view is a vector sphere and the HUD rings are one press away', async ($, on) => {
    const clock = stubs(on)
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop', viewport: { columns: 80, rows: 40 } })
    const svg = async () => {
      const el = await ui.find({ type: 'Svg' })
      return { alt: String(el?.props.alt ?? ''), source: String(el?.props.source ?? '') }
    }

    expect((await svg()).alt).toContain('standing by')
    expect((await svg()).source).toContain('<animateMotion')
    expect(await ui.find({ type: 'Button', text: /3D/ })).toBeDefined()

    await $.turn.start({ text: 'fix the login bug', turnId: 't1' })
    expect((await svg()).alt).toContain('thinking: fix the login bug')
    expect((await svg()).source).toContain('THINKING')

    // pause strips the motion, play brings it back
    await ui.press({ key: 'pause' })
    expect(await ui.find({ type: 'Button', text: /play/ })).toBeDefined()
    expect((await svg()).source).not.toContain('<animateMotion')
    await ui.press({ key: 'pause' })
    expect((await svg()).source).toContain('<animateMotion')

    await $.tool.call({ tool: 'Read', file_path: 'C:\\repo\\src\\login.ts', tool_use_id: 'call-1' } as never)
    // the call finished: it sits in the recent list and rides the sphere as a tooltip node
    expect(await ui.find({ type: 'Text', text: /login\.ts/ })).toBeDefined()
    expect((await svg()).source).toContain('<title>Read · src/login.ts')

    // the HUD rings are the other view, with the same tooltip nodes; the sphere has ~100 orbiters, the HUD a dozen
    const orbiters = async () => ((await svg()).source.match(/<animateMotion/g) ?? []).length
    expect(await orbiters()).toBeGreaterThan(90)
    await ui.press({ key: 'view-hud' })
    expect(await orbiters()).toBeLessThan(30)
    expect((await svg()).source).toContain('<title>Read · src/login.ts')
    await ui.press({ key: 'speed' })
    expect(await ui.find({ type: 'Button', text: /fast/ })).toBeDefined()
    await ui.press({ key: 'speed' })
    await ui.press({ key: 'speed' })
    await ui.press({ key: 'view-3d' })
    expect(await orbiters()).toBeGreaterThan(90)

    await $.turn.complete({ reason: 'answer', answer: 'done', durationMs: 1200, isAborted: false, turnId: 't1' })
    expect((await svg()).alt).toContain('done')
    await clock.advance(3500)
    expect((await svg()).alt).toContain('standing by')

    await ui.press({ key: 'clear' })
    expect(await ui.find({ type: 'Text', text: /login\.ts/ })).toBeUndefined()
    await ui.unmount()
  })

  test('on the terminal the 3D view is a live Client: it turns, takes a drag and keys', async ($, on) => {
    const clock = stubs(on)
    const IN = { in: 'brain3d' } as const
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal', viewport: { columns: 80, rows: 40 } })
    const frame = async () => JSON.stringify(await ui.drawn(IN))

    // the sphere lays out once its region has a size, and draws the idle brain
    await ui.resize({ columns: 60, rows: 18, ...IN })
    await ui.advance(150)
    expect(await frame()).toContain('STANDING BY')

    await $.turn.start({ text: 'fix the login bug', turnId: 't1' })
    await ui.advance(150)
    const thinking = await frame()
    expect(thinking).toContain('THINKING')
    expect(thinking).toContain('fix the login bug')

    // it turns on its own
    await ui.advance(700)
    expect(await frame()).not.toBe(thinking)

    // a drag spins it, the arrows turn it
    const before = await frame()
    await ui.pointer({ type: 'down', x: 10, y: 5, button: 'left', ...IN })
    await ui.pointer({ type: 'move', x: 22, y: 7, button: 'left', ...IN })
    await ui.pointer({ type: 'up', x: 22, y: 7, button: 'left', ...IN })
    await ui.advance(150)
    expect(await frame()).not.toBe(before)
    await ui.key({ key: 'left', ...IN })
    await ui.key({ key: 'up', ...IN })
    await ui.advance(150)

    // space pauses, which reaches the hooks module as a post and flips the pane's button
    await ui.key({ key: ' ', ...IN })
    await ui.advance(150)
    expect(await ui.find({ type: 'Button', text: /play/ })).toBeDefined()
    expect(await frame()).toContain('paused')
    await ui.press({ key: 'pause' })
    await ui.advance(150)
    expect(await ui.find({ type: 'Button', text: /pause/ })).toBeDefined()
    expect(await frame()).not.toContain('paused')

    await $.tool.call({ tool: 'Read', file_path: 'C:\\repo\\src\\login.ts', tool_use_id: 'call-1' } as never)
    expect(await ui.find({ type: 'Text', text: /login\.ts/ })).toBeDefined()
    await ui.advance(150)
    expect(await frame()).toContain('◉')

    await $.turn.complete({ reason: 'answer', answer: 'done', durationMs: 1200, isAborted: false, turnId: 't1' })
    await ui.advance(150)
    expect(await frame()).toContain('DONE')
    await clock.advance(3500)
    await ui.advance(150)
    expect(await frame()).toContain('STANDING BY')
    await ui.unmount()
  })
})
