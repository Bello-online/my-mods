import { describe, expect, mock, test } from 'claude-code/testing'

import type { On } from 'claude-code'

import { clockText, spanText } from '../hooks/register'

const MINUTE = 60_000

const BAND = {
  plugin: 'focus-band',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 6 },
    view: {},
  },
} as const

function stubs(on: On, store: Record<string, unknown> = {}) {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on, store)
  const toasts: string[] = []
  on('command.register', async (_, e) => ({ value: { command: e.name } }) as never)
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('tool.call', async () => ({ result: 'ok' }) as never)
  on('turn.complete', async (_, e) => ({ text: e.answer }))
  on('ui.toast', async (_, e) => {
    toasts.push(e.text)
    return { value: undefined } as never
  })
  on('ui.notify', async () => ({ value: { isSent: false, reason: 'no-surface' } }) as never)
  return { clock, toasts }
}

async function bandText(ui: { find: (q: { type: string; text?: RegExp }) => Promise<{ text?: string } | undefined> }, re: RegExp) {
  return (await ui.find({ type: 'Text', text: re }))?.text
}

describe('formatting', () => {
  test('clock and span text', () => {
    expect(clockText(25 * MINUTE)).toBe('25:00')
    expect(clockText(61_001)).toBe('01:02')
    expect(clockText(0)).toBe('00:00')
    expect(spanText(4 * MINUTE)).toBe('4m')
    expect(spanText(64 * MINUTE)).toBe('1h 04m')
  })
})

for (const surface of ['terminal', 'desktop'] as const) {
  describe(`the band on ${surface}`, () => {
    test('runs a focus round into a break, then waits', async ($, on) => {
      const { clock, toasts } = stubs(on)
      await $.session.start({ cwd: '/', surface, isInteractive: true })
      const ui = await $.ui.mount({ ...BAND, surface })

      expect(await bandText(ui, /25:00/)).toBeDefined()
      expect(await bandText(ui, /focus ready/)).toBeDefined()

      await ui.press({ key: 'toggle' })
      expect(await ui.find({ type: 'Button', text: /pause/ })).toBeDefined()
      await clock.advance(MINUTE)
      expect(await bandText(ui, /24:00/)).toBeDefined()

      // pausing freezes the clock
      await ui.press({ key: 'toggle' })
      await clock.advance(5 * MINUTE)
      expect(await bandText(ui, /24:00/)).toBeDefined()
      expect(await bandText(ui, /paused/)).toBeDefined()

      // resume and run out the block: it rolls into a running break
      await ui.press({ key: 'toggle' })
      await clock.advance(24 * MINUTE + 1000)
      expect(await bandText(ui, /break/)).toBeDefined()
      expect(await bandText(ui, /🍅/)).toBeDefined()
      expect(toasts.some(t => /Focus round 1 done/.test(t))).toBe(true)

      // the break ends and the timer waits on a fresh focus block
      await clock.advance(5 * MINUTE + 1000)
      expect(await bandText(ui, /focus ready/)).toBeDefined()
      expect(await bandText(ui, /25:00/)).toBeDefined()
      expect(toasts.some(t => /Break over/.test(t))).toBe(true)
      await ui.unmount()
    })

    test('counts turns and tool calls, and skip and reset move the block', async ($, on) => {
      stubs(on)
      await $.session.start({ cwd: '/', surface, isInteractive: true })
      const ui = await $.ui.mount({ ...BAND, surface })

      await $.tool.call({ tool: 'Bash', command: 'ls' })
      await $.tool.call({ tool: 'Bash', command: 'pwd' })
      await $.turn.complete({ reason: 'answer', answer: 'done', durationMs: 1200, isAborted: false, turnId: 't1' })
      expect(await bandText(ui, /1 turn · 2 tool calls/)).toBeDefined()

      await ui.press({ key: 'skip' })
      expect(await bandText(ui, /break ready/)).toBeDefined()
      expect(await bandText(ui, /05:00/)).toBeDefined()
      await ui.press({ key: 'reset' })
      expect(await bandText(ui, /focus ready/)).toBeDefined()
      await ui.unmount()
    })
  })
}

describe('/pomo', () => {
  test('sets lengths, saves them, and a later session reads them back', async ($, on) => {
    const store: Record<string, unknown> = {}
    stubs(on, store)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

    const set = await $.command.run({ command: 'pomo', args: '50 10' })
    expect(JSON.stringify(set)).toContain('Focus 50 min, break 10 min')
    const status = await $.command.run({ command: 'pomo', args: 'status' })
    expect(JSON.stringify(status)).toContain('50:00 left')

    const bad = await $.command.run({ command: 'pomo', args: 'banana' })
    expect(JSON.stringify(bad)).toContain('Usage: /pomo')
  })

  test('a saved length applies at session start', async ($, on) => {
    stubs(on, { lengths: { focusMin: 45, breakMin: 15 } })
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await bandText(ui, /45:00/)).toBeDefined()
    await ui.unmount()
  })
})
