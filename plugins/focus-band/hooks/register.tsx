import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { FocusCounts, FocusMode, FocusTimer } from '../types'

const MINUTE = 60_000
const STORE_KEY = 'lengths'

const DEFAULT_TIMER: FocusTimer = {
  mode: 'focus',
  status: 'idle',
  endsAt: 0,
  leftMs: 25 * MINUTE,
  rounds: 0,
  focusMin: 25,
  breakMin: 5,
}

const timer = atom({ plugin: 'focus-band', key: 'timer' } as const, DEFAULT_TIMER, {
  shape: 'timer-1',
})
const counts = atom(
  { plugin: 'focus-band', key: 'counts' } as const,
  { startedAt: 0, turns: 0, tools: 0 } as FocusCounts,
  { shape: 'counts-1' },
)
const clockNow = atom({ plugin: 'focus-band', key: 'now' } as const, 0)

const COLOR = { focus: '#ef6351', break: '#3fb27f' } as const

export function blockMs(t: FocusTimer, mode: FocusMode): number {
  return (mode === 'focus' ? t.focusMin : t.breakMin) * MINUTE
}

export function leftOf(t: FocusTimer, now: number): number {
  return t.status === 'running' ? Math.max(0, t.endsAt - now) : t.leftMs
}

export function clockText(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60

  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function spanText(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / MINUTE)
  const h = Math.floor(min / 60)

  return h > 0 ? `${h}h ${String(min % 60).padStart(2, '0')}m` : `${min}m`
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

async function start($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  await update($, timer, t =>
    t.status === 'running'
      ? t
      : { ...t, status: 'running', endsAt: now + (t.leftMs > 0 ? t.leftMs : blockMs(t, t.mode)) },
  )
  await update($, clockNow, () => now)
}

async function pause($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  await update($, timer, t =>
    t.status === 'running'
      ? { ...t, status: 'paused', leftMs: Math.max(0, t.endsAt - now), endsAt: 0 }
      : t,
  )
}

async function toggle($: EngineInterface): Promise<void> {
  const t = await read($, timer)
  await (t.status === 'running' ? pause($) : start($))
}

async function reset($: EngineInterface): Promise<void> {
  await update($, timer, t => ({
    ...t,
    mode: 'focus',
    status: 'idle',
    endsAt: 0,
    leftMs: blockMs(t, 'focus'),
  }))
}

/** Moves to the next block without counting a round; keeps running if it was. */
async function skip($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  await update($, timer, t => {
    const mode: FocusMode = t.mode === 'focus' ? 'break' : 'focus'
    const ms = blockMs(t, mode)

    return t.status === 'running'
      ? { ...t, mode, endsAt: now + ms, leftMs: ms }
      : { ...t, mode, status: 'idle', endsAt: 0, leftMs: ms }
  })
}

async function setLengths($: EngineInterface, focusMin: number, breakMin: number): Promise<void> {
  await $.store.set(STORE_KEY, { focusMin, breakMin })
  await update($, timer, t => {
    const next = { ...t, focusMin, breakMin }

    return t.status === 'idle' ? { ...next, leftMs: blockMs(next, t.mode) } : next
  })
}

/** Ends a running block whose time is up: focus rolls into a break, a break waits. */
async function finishIfDue($: EngineInterface, now: number): Promise<void> {
  let ended: FocusTimer | null = null
  await update($, timer, t => {
    if (t.status !== 'running' || t.endsAt > now) {
      return t
    }
    ended = t

    if (t.mode === 'focus') {
      const ms = blockMs(t, 'break')

      return { ...t, mode: 'break', status: 'running', endsAt: now + ms, leftMs: ms, rounds: t.rounds + 1 }
    }

    return { ...t, mode: 'focus', status: 'idle', endsAt: 0, leftMs: blockMs(t, 'focus') }
  })

  const was = ended as FocusTimer | null
  if (!was) {
    return
  }

  const text =
    was.mode === 'focus'
      ? `Focus round ${was.rounds + 1} done. Take ${plural(was.breakMin, 'minute')} off.`
      : 'Break over. Start the next focus round when you are ready.'
  $.ui.toast(text, { timeoutMs: 8000 })
  void $.ui.notify(text, { title: 'Focus' }).catch(() => undefined)
}

function parseLengths(args: string): [number, number] | null {
  const m = /^(\d{1,3})(?:\s+(\d{1,3}))?$/.exec(args)
  if (!m) {
    return null
  }
  const focusMin = Number(m[1])
  const breakMin = m[2] === undefined ? Math.max(1, Math.round(focusMin / 5)) : Number(m[2])

  return focusMin >= 1 && focusMin <= 180 && breakMin >= 1 && breakMin <= 60 ? [focusMin, breakMin] : null
}

const HELP =
  'Usage: /pomo (start or pause), /pomo start | pause | reset | skip | status, or /pomo <focus min> [break min], e.g. /pomo 50 10.'

async function runPomo($: EngineInterface, args: string): Promise<{ text: string }> {
  if (args === '' || args === 'toggle') {
    await toggle($)
    const t = await read($, timer)

    return { text: t.status === 'running' ? `Focus timer running: ${t.mode}.` : 'Focus timer paused.' }
  }
  if (args === 'start') {
    await start($)
    return { text: 'Focus timer running.' }
  }
  if (args === 'pause' || args === 'stop') {
    await pause($)
    return { text: 'Focus timer paused.' }
  }
  if (args === 'reset') {
    await reset($)
    return { text: 'Focus timer reset to a fresh focus round.' }
  }
  if (args === 'skip' || args === 'next') {
    await skip($)
    const t = await read($, timer)
    return { text: `Skipped to ${t.mode}.` }
  }
  if (args === 'status') {
    const t = await read($, timer)
    const c = await read($, counts)
    const now = await $.clock.now()

    return {
      text:
        `${t.mode} ${t.status}, ${clockText(leftOf(t, now))} left, ${plural(t.rounds, 'round')} done. ` +
        `Session ${spanText(now - c.startedAt)}, ${plural(c.turns, 'turn')}, ${plural(c.tools, 'tool call')}.`,
    }
  }

  const lengths = parseLengths(args)
  if (lengths) {
    await setLengths($, lengths[0], lengths[1])
    return { text: `Focus ${lengths[0]} min, break ${lengths[1]} min. Saved for next sessions.` }
  }

  return { text: HELP }
}

export const register: Register = on => {
  let ticker: Timer | null = null
  let lastMinute = -1

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pomo',
      description: 'Focus timer: start or pause, reset, skip, status, or set lengths (/pomo 50 10)',
    })

    const now = await $.clock.now()
    await update($, counts, c => (c.startedAt === 0 ? { ...c, startedAt: now } : c))
    await update($, clockNow, () => now)

    const saved = (await $.store.get(STORE_KEY)) as { focusMin?: unknown; breakMin?: unknown } | undefined
    const t = await read($, timer)
    if (
      saved &&
      typeof saved.focusMin === 'number' &&
      typeof saved.breakMin === 'number' &&
      t.status === 'idle' &&
      t.rounds === 0 &&
      (t.focusMin !== saved.focusMin || t.breakMin !== saved.breakMin)
    ) {
      await setLengths($, saved.focusMin, saved.breakMin)
    }

    ticker?.cancel()
    ticker = $.clock.every(1000, () => {
      void (async () => {
        const at = await $.clock.now()
        const cur = await read($, timer)
        const minute = Math.floor(at / MINUTE)
        if (cur.status === 'running' || minute !== lastMinute) {
          lastMinute = minute
          await update($, clockNow, () => at)
        }
        await finishIfDue($, at)
      })().catch(() => undefined)
    })

    return next(e)
  })

  on('command.run', { command: 'pomo' }, async ($, e) => {
    try {
      return await runPomo($, e.args.trim().toLowerCase())
    } catch {
      return { text: 'The focus timer hit an error; try again.' }
    }
  })


  on('turn.complete', async ($, e, next) => {
    await update($, counts, c => ({ ...c, turns: c.turns + 1 }))

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    try {
      await update($, counts, c => ({ ...c, tools: c.tools + 1 }))
    } catch {
      // Counting must never block a tool call.
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const t = await read($, timer)
    const c = await read($, counts)
    const now = (await read($, clockNow)) || (await $.clock.now())
    const left = leftOf(t, now)
    const isRunning = t.status === 'running'
    const color = COLOR[t.mode]
    const state = isRunning ? '' : t.status === 'paused' ? ' paused' : ' ready'
    const dot = isRunning ? '●' : t.status === 'paused' ? '❚❚' : '○'

    return (
      <Box flexDirection="row" flexWrap="wrap" alignItems="center">
        <Text color={isRunning ? color : undefined} dimColor={!isRunning} weight="semibold">
          {dot} {t.mode}
          {state}{' '}
        </Text>
        <Text color={isRunning ? color : undefined} weight="bold" mono tabular>
          {clockText(left)}{' '}
        </Text>
        <Button key="toggle" label={isRunning ? 'pause' : 'start'} hotkey="s" onPress={() => toggle($)} />
        <Text> </Text>
        <Button key="reset" label="reset" hotkey="r" onPress={() => reset($)} />
        <Text> </Text>
        <Button key="skip" label="skip" hotkey="n" onPress={() => skip($)} />
        <Text dimColor>
          {'  '}
          {'🍅'.repeat(Math.min(t.rounds, 4))}
          {t.rounds > 4 ? `×${t.rounds}` : ''}
          {t.rounds > 0 ? ' · ' : ''}
          session {spanText(now - (c.startedAt || now))} · {plural(c.turns, 'turn')} · {plural(c.tools, 'tool call')}
        </Text>
      </Box>
    )
  })
}
