import { describe, expect, mock, test } from 'claude-code/testing'

import type { On } from 'claude-code'

import { classify, spanText } from '../hooks/register'
import { MOODS, sceneRows, sceneSvg } from '../hooks/scenes'

const PANE = {
  plugin: 'clawd-buddy',
  component: 'Pane',
  requestId: 'clawd-buddy',
  props: {
    title: 'Clawd',
    isFocused: false,
    bodyColumns: 44,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

function stubs(on: On, runTool?: (e: object) => Promise<object>) {
  const clock = mock.clock(on, { now: 1_000_000 })
  const opened: string[] = []
  on('command.register', async (_, e) => ({ value: { command: e.name } }) as never)
  on('ui.open', async (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } } as never
  })
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('turn.start', async (_, e) => ({ turnId: e.turnId }) as never)
  on('tool.call', async (_, e) => {
    if (runTool) return (await runTool(e)) as never
    return { result: 'ok', ...((e as { command?: string }).command === 'boom' ? { isError: true } : {}) } as never
  })
  on('turn.complete', async (_, e) => ({ text: e.answer }))
  return { clock, opened }
}

type Found = { text?: string; props: Record<string, unknown> } | undefined
type Ui = { find: (q: { type: string; text?: RegExp }) => Promise<Found> }

const textOf = async (ui: Ui, re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text
const altOf = async (ui: Ui) => String((await ui.find({ type: 'Svg' }))?.props.alt ?? '')

describe('words', () => {
  test('a tool call gets a scene, a verb and an object', () => {
    expect(classify('Read', { file_path: 'C:/work/app/src/main.ts' })).toEqual({
      mood: 'reading',
      doing: 'Reading',
      did: 'Read',
      what: 'src/main.ts',
    })
    expect(classify('Bash', { command: 'npm test', description: 'Run the tests' }).what).toBe('Run the tests')
    expect(classify('Grep', { pattern: 'TODO' })).toMatchObject({ mood: 'searching', what: '/TODO/' })
    expect(classify('WebFetch', { url: 'https://example.com/docs' })).toMatchObject({ mood: 'browsing', what: 'example.com/docs' })
    expect(classify('mcp__github__list_issues', {})).toMatchObject({ mood: 'connecting', what: 'list issues' })
    expect(classify('Agent', { description: 'Audit the styles' }).mood).toBe('delegating')
  })

  test('durations read short', () => {
    expect(spanText(80)).toBe('80ms')
    expect(spanText(1240)).toBe('1.2s')
    expect(spanText(42_000)).toBe('42s')
    expect(spanText(72_000)).toBe('1m 12s')
  })
})

describe('scenes', () => {
  test('every mood has a stage that moves, and the same mood draws the same markup', () => {
    for (const mood of Object.keys(MOODS) as Array<keyof typeof MOODS>) {
      const svg = sceneSvg(mood)
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg).toContain('<animate')
      expect(svg.length).toBeLessThan(131072)
      expect(sceneSvg(mood)).toBe(svg)
      expect(sceneRows(mood, 0)).toHaveLength(3)
    }
    expect(sceneSvg('reading')).not.toBe(sceneSvg('running'))
  })

  test('the terminal prop changes frame by frame', () => {
    const a = sceneRows('thinking', 0).map(r => r.prop).join('|')
    const b = sceneRows('thinking', 1).map(r => r.prop).join('|')
    expect(a).not.toBe(b)
  })
})

describe('the pane', () => {
  test('opens beside the chat on the desktop, and waits for /clawd on a terminal', async ($, on) => {
    const { opened } = stubs(on)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    expect(opened).toHaveLength(0)
    const ran = await $.command.run({ command: 'clawd', args: '' } as never)
    expect(JSON.stringify(ran)).toContain('Clawd is out')
    expect(opened).toEqual(['clawd-buddy'])
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    test(`Clawd follows a turn and lists its actions, on ${surface}`, async ($, on) => {
      const { clock, opened } = stubs(on)
      await $.session.start({ cwd: '/', surface, isInteractive: true })
      if (surface === 'desktop') expect(opened).toEqual(['clawd-buddy'])
      const ui = await $.ui.mount({ ...PANE, surface })

      expect(await textOf(ui, /Standing by/)).toBeDefined()
      expect(await textOf(ui, /Nothing yet/)).toBeDefined()
      if (surface === 'desktop') expect(await altOf(ui)).toContain('mug')

      await $.turn.start({ text: 'Fix the login bug', turnId: 't1' } as never)
      expect(await textOf(ui, /Thinking…/)).toBeDefined()
      expect(await textOf(ui, /Fix the login bug/)).toBeDefined()
      if (surface === 'desktop') expect(await altOf(ui)).toContain('thought bubble')

      const callTool = $.tool.call as unknown as (input: object) => Promise<unknown>
      await callTool({ tool: 'Read', file_path: '/repo/src/login.ts', tool_use_id: 'a' })
      expect(await textOf(ui, /Reading…/)).toBeDefined()
      expect(await textOf(ui, /✓ Read src\/login\.ts/)).toBeDefined()
      if (surface === 'desktop') expect(await altOf(ui)).toContain('open book')

      await callTool({ tool: 'Bash', command: 'boom', tool_use_id: 'b' })
      expect(await textOf(ui, /✗ Ran boom/)).toBeDefined()
      expect(await ui.find({ type: 'Button', text: /2 this turn/ })).toBeDefined()

      await clock.advance(72_000)
      await $.turn.complete({ reason: 'answer', answer: 'done', durationMs: 72_000, isAborted: false, turnId: 't1' })
      expect(await textOf(ui, /^Done$/)).toBeDefined()
      expect(await textOf(ui, /Finished in 1m 12s · 2 actions/)).toBeDefined()
      if (surface === 'desktop') expect(await altOf(ui)).toContain('confetti')

      // the list stays after the turn, and Clawd settles back down
      await clock.advance(9000)
      expect(await textOf(ui, /Standing by/)).toBeDefined()
      expect(await textOf(ui, /✓ Read src\/login\.ts/)).toBeDefined()

      // the next turn starts the list over
      await $.turn.start({ text: 'And now the tests', turnId: 't2' } as never)
      expect(await textOf(ui, /Nothing yet/)).toBeDefined()
      await ui.unmount()
    })
  }

  test('a call still running shows as in progress, and a helper\'s call is marked', async ($, on) => {
    let release: (() => void) | null = null
    stubs(on, async () => {
      await new Promise<void>(done => {
        release = done
      })
      return { result: 'ok' }
    })
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    await $.turn.start({ text: 'go', turnId: 't1' } as never)

    const callTool = $.tool.call as unknown as (input: object) => Promise<unknown>
    const pending = callTool({ tool: 'Grep', pattern: 'TODO', tool_use_id: 'g', agentId: 'helper-1' })
    for (let i = 0; i < 20 && release === null; i++) await Promise.resolve()
    expect(await textOf(ui, /Delegating…/)).toBeDefined()
    expect(await textOf(ui, /◌ ↳ Searching \/TODO\//)).toBeDefined()
    ;(release as (() => void) | null)?.()
    await pending
    expect(await textOf(ui, /✓ ↳ Searched \/TODO\//)).toBeDefined()
    await ui.unmount()
  })
})
