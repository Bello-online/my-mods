import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { FocusCounts, FocusMascot, FocusMode, FocusTimer } from '../types'
import { LOGO_W, STAGE_H, STAGE_W, laneRows, mascotAlt, mascotSvg } from './mascot'
import type { MascotMood } from './mascot'

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
const mascot = atom({ plugin: 'focus-band', key: 'mascot' } as const, { x: 2, lift: 0 } as FocusMascot, {
  shape: 'mascot-1',
})

const HOP_FRAME_MS = 130

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
  await update($, timer, (t): FocusTimer =>
    t.status === 'running'
      ? t
      : { ...t, status: 'running', endsAt: now + (t.leftMs > 0 ? t.leftMs : blockMs(t, t.mode)) },
  )
  await update($, clockNow, () => now)
}

async function pause($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  await update($, timer, (t): FocusTimer =>
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
  await update($, timer, (t): FocusTimer => ({
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
  await update($, timer, (t): FocusTimer => {
    const mode: FocusMode = t.mode === 'focus' ? 'break' : 'focus'
    const ms = blockMs(t, mode)

    return t.status === 'running'
      ? { ...t, mode, endsAt: now + ms, leftMs: ms }
      : { ...t, mode, status: 'idle', endsAt: 0, leftMs: ms }
  })
}

async function setLengths($: EngineInterface, focusMin: number, breakMin: number): Promise<void> {
  await $.store.set(STORE_KEY, { focusMin, breakMin })
  await update($, timer, (t): FocusTimer => {
    const next = { ...t, focusMin, breakMin }

    return t.status === 'idle' ? { ...next, leftMs: blockMs(next, t.mode) } : next
  })
}

/** Ends a running block whose time is up: focus rolls into a break, a break waits. */
async function finishIfDue($: EngineInterface, now: number): Promise<void> {
  let ended: FocusTimer | null = null
  await update($, timer, (t): FocusTimer => {
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

export function moodOf(t: FocusTimer): MascotMood {
  if (t.mode === 'break' && t.status === 'running') {
    return 'sleep'
  }

  return t.status === 'running' ? 'hop' : 'idle'
}

/** The terminal's hop: Clawd hops to a new column, one frame at a time. */
async function hopTerminal($: EngineInterface, laneWidth: number, isSmall: boolean): Promise<void> {
  const room = Math.max(0, laneWidth - LOGO_W - 4)
  if (room < 2) {
    return
  }
  const from = (await read($, mascot)).x
  const to = isSmall ? from : Math.round(Math.random() * room)
  const hops = isSmall ? 1 : Math.max(1, Math.min(6, Math.ceil(Math.abs(to - from) / 5)))
  const step = (to - from) / hops

  for (let i = 0; i < hops; i++) {
    const x0 = from + step * i
    $.clock.after(i * 2 * HOP_FRAME_MS, () => {
      void update($, mascot, (): FocusMascot => ({ x: Math.round(x0 + step / 2), lift: 1 })).catch(() => undefined)
    })
    $.clock.after((i * 2 + 1) * HOP_FRAME_MS, () => {
      void update($, mascot, (): FocusMascot => ({ x: Math.round(x0 + step), lift: 0 })).catch(() => undefined)
    })
  }
}

function bar(fraction: number, width: number): [string, string] {
  const filled = Math.max(0, Math.min(width, Math.round(fraction * width)))

  return ['━'.repeat(filled), '─'.repeat(width - filled)]
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
  // The terminal lane's width, and when Clawd hops next there; the desktop's
  // stage animates by itself and needs neither.
  let laneWidth = 0
  let nextHopAt = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pomo',
      description: 'Focus timer: start or pause, reset, skip, status, or set lengths (/pomo 50 10)',
    })

    const now = await $.clock.now()
    await update($, counts, (c): FocusCounts => (c.startedAt === 0 ? { ...c, startedAt: now } : c))
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

        if (laneWidth > 0 && at >= nextHopAt) {
          const mood = moodOf(await read($, timer))
          if (mood !== 'sleep') {
            await hopTerminal($, laneWidth, mood === 'idle')
          }
          nextHopAt = at + (mood === 'hop' ? 7_000 + Math.random() * 9_000 : 15_000 + Math.random() * 15_000)
        }
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
    await update($, counts, (c): FocusCounts => ({ ...c, turns: c.turns + 1 }))

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    try {
      await update($, counts, (c): FocusCounts => ({ ...c, tools: c.tools + 1 }))
    } catch {
      // Counting must never block a tool call.
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const t = await read($, timer)
    const c = await read($, counts)
    const now = (await read($, clockNow)) || (await $.clock.now())
    const left = leftOf(t, now)
    const total = blockMs(t, t.mode)
    const isRunning = t.status === 'running'
    const accent = COLOR[t.mode]
    const mood = moodOf(t)
    const label = `${t.mode}${isRunning ? '' : t.status === 'paused' ? ' · paused' : ' · ready'}`
    const dot = isRunning ? '●' : t.status === 'paused' ? '❚❚' : '○'
    const stats = `⏱ ${spanText(now - (c.startedAt || now))}  ·  ↻ ${plural(c.turns, 'turn')}  ·  ⚒ ${plural(c.tools, 'tool call')}`
    // The controls: start/pause is the main action; reset and skip stay quiet
    // until the pointer is on the band, then pick up the mode colour.
    const toggleLabel = isRunning ? 'pause' : t.status === 'paused' ? 'resume' : 'start'
    const toggleIcon = isRunning ? '❚❚' : '▶'
    const quietHover = { color: accent, dimColor: false }

    if (e.surface === 'terminal') {
      const { Box, Button, Text } = $.ui.resolve(e)
      const width = Math.max(30, e.props.bodyColumns)
      const hasLane = e.props.maxRows >= 7
      laneWidth = hasLane ? width : 0
      const spot = hasLane ? await read($, mascot) : { x: 0, lift: 0 }
      const [done, rest] = bar(total > 0 ? 1 - left / total : 0, Math.max(10, Math.min(36, width - 44)))
      const tomatoes =
        t.rounds > 0 ? `${'🍅'.repeat(Math.min(t.rounds, 4))}${t.rounds > 4 ? `×${t.rounds}` : ''}  ·  ` : ''

      return (
        <Box
          key="focus-band"
          flexDirection="column"
          borderStyle="round"
          borderColor={accent}
          borderDimColor={!isRunning}
          paddingX={1}
        >
          {hasLane &&
            laneRows({ x: spot.x, lift: spot.lift, isAsleep: mood === 'sleep', width }).map(row => (
              <Text color="#D97757">{row || ' '}</Text>
            ))}
          <Box key="controls" flexDirection="row" alignItems="center">
            <Text backgroundColor={isRunning ? accent : undefined} color={isRunning ? '#ffffff' : accent} weight="bold">
              {' '}
              {dot} {label.toUpperCase()}{' '}
            </Text>
            <Text weight="bold" color={isRunning ? accent : undefined}>
              {'  '}
              {clockText(left)}
              {'  '}
            </Text>
            <Button key="toggle" label={toggleLabel} variant="primary" hotkey="s" onPress={() => toggle($)}>
              <Text weight="bold">
                {toggleIcon} {toggleLabel}
              </Text>
            </Button>
            <Text> </Text>
            <Button key="reset" label="reset" variant="secondary" dimColor hover={quietHover} hotkey="r" onPress={() => reset($)}>
              ↺ reset
            </Button>
            <Text> </Text>
            <Button key="skip" label="skip" variant="secondary" dimColor hover={quietHover} hotkey="n" onPress={() => skip($)}>
              » skip
            </Button>
          </Box>
          <Text>
            <Text color={accent}>{done}</Text>
            <Text dimColor>{rest}</Text>
            <Text dimColor>
              {'  '}
              {tomatoes}
              {stats}
            </Text>
          </Text>
        </Box>
      )
    }

    if (e.surface !== 'desktop') {
      return next(e)
    }

    const { Box, Button, Svg, Text } = $.ui.resolve(e)
    const [done, rest] = bar(total > 0 ? 1 - left / total : 0, 40)

    return (
      <Box
        key="focus-band"
        flexDirection="column"
        borderStyle="round"
        borderColor={accent}
        borderDimColor={!isRunning}
        paddingX="md"
        paddingY="xs"
        gap="xs"
      >
        <Box flexDirection="row" alignItems="center" gap="md" flexWrap="wrap">
          <Svg
            source={mascotSvg({ mood, accent, rounds: t.rounds })}
            alt={mascotAlt(mood, t.rounds)}
            width={STAGE_W}
            height={STAGE_H}
            isInteractive
          />
          <Box flexDirection="column">
            <Text size="caption" weight="bold" color={accent}>
              {dot} {label.toUpperCase()}
            </Text>
            <Text size="title" weight="bold" mono tabular color={isRunning ? accent : undefined}>
              {clockText(left)}
            </Text>
          </Box>
          <Box flexGrow={1} />
          <Box key="controls" flexDirection="row" gap="xs">
            <Button key="toggle" label={toggleLabel} variant="primary" hotkey="s" onPress={() => toggle($)}>
              <Text weight="bold">
                {toggleIcon} {toggleLabel}
              </Text>
            </Button>
            <Button key="reset" label="reset" variant="secondary" dimColor hover={quietHover} hotkey="r" onPress={() => reset($)}>
              ↺ reset
            </Button>
            <Button key="skip" label="skip" variant="secondary" dimColor hover={quietHover} hotkey="n" onPress={() => skip($)}>
              ⏭ skip
            </Button>
          </Box>
        </Box>
        <Box flexDirection="row" alignItems="center" gap="md" flexWrap="wrap">
          <Text mono>
            <Text color={accent}>{done}</Text>
            <Text dimColor>{rest}</Text>
          </Text>
          <Text size="footnote" dimColor>
            {stats}
          </Text>
        </Box>
      </Box>
    )
  })
}
