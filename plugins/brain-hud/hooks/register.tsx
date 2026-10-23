import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Brain3dMessage, Brain3dProps, BrainPhase, BrainState, BrainTool, BrainUi } from '../types'
import { PHASES, ago, classify, clip } from './phases'
import { brainSphereSvg, brainSvg } from './brain-svg'
import { elapsedText, orb, overlayLine } from './brain-ascii'

const PANE = 'brain-hud'
const CLIENT = 'brain3d'
const TICK_MS = 200
const SETTLE_MS = 3000

const INITIAL: BrainState = {
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

const INITIAL_UI: BrainUi = { view: '3d', paused: false, speed: 2 }

const brain = atom({ plugin: 'brain-hud', key: 'brain' } as const, INITIAL)
const tick = atom({ plugin: 'brain-hud', key: 'tick' } as const, 0)
const ui = atom({ plugin: 'brain-hud', key: 'ui' } as const, INITIAL_UI)

// Module-local handles: a hot reload drops them, and the next turn makes new ones.
let ticker: Timer | null = null
let settle: Timer | null = null

function startTicker($: EngineInterface): void {
  if (ticker) return
  ticker = $.clock.every(TICK_MS, () => {
    void update($, tick, n => ((n ?? 0) + 1) % 1_000_000)
  })
}

function stopTicker(): void {
  ticker?.cancel()
  ticker = null
}

function showStatus($: EngineInterface, state: BrainState): void {
  if (state.phase === 'idle') {
    $.ui.status(undefined)
    return
  }
  const label = PHASES[state.phase].label
  $.ui.status(state.detail ? `◉ ${label} · ${clip(state.detail, 40)}` : `◉ ${label}`)
}

/** Move the brain to a phase, keeping the previous one so the drawing can morph from it. */
async function setPhase($: EngineInterface, phase: BrainPhase, detail: string, now?: number): Promise<void> {
  const current = await read($, brain)
  if (current.phase === phase && current.detail === detail) return
  const at = now ?? (await $.clock.now())
  const next = await update(
    $,
    brain,
    (s): BrainState => ({ ...s, prevPhase: s.phase, phase, detail, since: at }),
  )
  showStatus($, next)
}

const SPEED_LABEL: Record<BrainUi['speed'], string> = { 1: 'slow', 2: 'normal', 3: 'fast' }

async function openPane($: EngineInterface): Promise<void> {
  const opened = await $.ui.open({ id: PANE, title: 'Claude Brain' })
  if (!opened.isPlaced) $.ui.log(`brain-hud: pane waits: ${opened.reason}`, { to: 'debug' })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'brain',
      description: 'Open the Claude Brain pane: a live 3D view of what Claude is doing',
    })
    const result = await next(e)
    // A docked sidebar on the desktop and editor surfaces; on the terminal it would take a third
    // of the screen inline, so there it waits for /brain. A session a program started has no
    // surface yet: the pane is opened anyway and seated when the surface attaches.
    if (e.surface !== 'terminal') void openPane($)
    return result
  })

  // A surface attaching later (the desktop app to a session it started) seats the pane.
  on('session.attach', async ($, e, next) => {
    const result = await next(e)
    if (e.surface !== 'terminal') void openPane($)
    return result
  })

  on('command.run', { command: 'brain' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'Claude Brain', focus: true, rows: 22 })
    return {
      text: opened.isPlaced
        ? 'Claude Brain is open. Drag the sphere to spin it; 3/h switch views, p pauses, s changes speed.'
        : 'Claude Brain could not be placed on this surface.',
    }
  })

  on('turn.start', async ($, e, next) => {
    settle?.cancel()
    settle = null
    const now = await $.clock.now()
    const next_ = await update(
      $,
      brain,
      (s): BrainState => ({
        ...s,
        prevPhase: s.phase,
        phase: 'thinking',
        detail: clip(e.text, 60) || 'continuing',
        since: now,
        turnStartedAt: now,
        turnCount: s.turnCount + 1,
        toolCount: 0,
        active: 0,
        recent: [],
      }),
    )
    showStatus($, next_)
    startTicker($)
    return next(e)
  })

  // The model's response as it streams: thinking, prose, or a tool call being prepared.
  on('turn.step', async function* ($, e, next) {
    const stream = next(e)
    let seen = ''
    for await (const chunk of stream) {
      if (!e.agentId) {
        let want: [BrainPhase, string] | null = null
        if (chunk.kind === 'thinking') want = ['thinking', 'reasoning']
        else if (chunk.kind === 'text') want = ['responding', 'writing the answer']
        else if (chunk.kind === 'tool') want = [classify(chunk.name, {}).phase, `preparing ${chunk.name}`]
        if (want && want.join('|') !== seen) {
          seen = want.join('|')
          await setPhase($, want[0], want[1])
        }
      }
      yield chunk
    }
    return await stream.result
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const { phase, label } = classify(e.tool, input)
    const now = await $.clock.now()
    const id = e.tool_use_id ?? `${e.tool}-${now}`
    const inSubagent = Boolean(e.agentId)
    const call: BrainTool = { id, tool: e.tool, label, phase, startedAt: now }

    try {
      const started = await update(
        $,
        brain,
        (s): BrainState => ({
          ...s,
          prevPhase: s.phase,
          phase: inSubagent ? 'delegating' : phase,
          detail: inSubagent ? `↳ ${label}` : label,
          since: now,
          toolCount: s.toolCount + 1,
          active: s.active + 1,
          recent: [...s.recent, call].slice(-8),
        }),
      )
      showStatus($, started)
    } catch {
      // bookkeeping only: never gate the call on it
    }

    const ran = await next(e)

    try {
      const end = await $.clock.now()
      const finished = await update($, brain, (s): BrainState => {
        const active = Math.max(0, s.active - 1)
        const recent = s.recent.map(r =>
          r.id === id ? { ...r, ms: end - r.startedAt, isError: Boolean(ran.isError) } : r,
        )
        const backToThinking = active === 0 && !inSubagent
        return {
          ...s,
          active,
          recent,
          ...(backToThinking
            ? { prevPhase: s.phase, phase: 'thinking' as const, detail: 'weighing the results', since: end }
            : {}),
        }
      })
      showStatus($, finished)
    } catch {
      // bookkeeping only
    }
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    const now = await $.clock.now()
    const phase: BrainPhase = e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'idle' : 'error'
    const detail =
      e.reason === 'answer'
        ? 'answer delivered'
        : e.reason === 'aborted'
          ? ''
          : e.reason === 'refusal'
            ? 'refused'
            : 'the turn errored'
    await update(
      $,
      brain,
      (s): BrainState => ({ ...s, prevPhase: s.phase, phase, detail, since: now, active: 0 }),
    )
    $.ui.status(undefined)
    settle?.cancel()
    settle = $.clock.after(SETTLE_MS, () => {
      settle = null
      stopTicker()
      void update(
        $,
        brain,
        (s): BrainState => ({ ...s, prevPhase: s.phase, phase: 'idle', detail: '', turnStartedAt: null }),
      )
    })
    return result
  })

  // What the 3D view posts back: a click on a tool node, or the space bar.
  on('ui.message', async ($, e, next) => {
    if (e.requestId !== PANE || e.element !== CLIENT) return next(e)
    const data = e.data as Brain3dMessage | null
    if (data && typeof data === 'object' && data.kind === 'node') {
      const state = await read($, brain)
      const node = state.recent.find(r => r.id === data.id)
      if (node) {
        const took = node.ms === undefined ? 'still running' : `took ${ago(node.ms)}`
        $.ui.toast(`${node.tool} · ${node.label} · ${took}${node.isError ? ' · errored' : ''}`, {
          timeoutMs: 5000,
        })
      }
    } else if (data && typeof data === 'object' && data.kind === 'toggle-pause') {
      await update($, ui, (p): BrainUi => ({ ...p, paused: !p.paused }))
    }
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const state = await read($, brain)
    const prefs = await read($, ui)
    const now = await $.clock.now()
    const cols = Math.max(20, e.props.bodyColumns)
    const style = PHASES[state.phase]
    const recent = state.recent.slice(-4).reverse()
    const { Box, Text, Button } = $.ui.resolve(e)
    const hasHud = e.surface !== 'terminal'
    const view: BrainUi['view'] = prefs.view

    const setView = (next: BrainUi['view']) => () =>
      void update($, ui, (p): BrainUi => ({ ...p, view: next }))
    const togglePause = () => void update($, ui, (p): BrainUi => ({ ...p, paused: !p.paused }))
    const cycleSpeed = () =>
      void update(
        $,
        ui,
        (p): BrainUi => ({ ...p, speed: p.speed === 3 ? 1 : ((p.speed + 1) as BrainUi['speed']) }),
      )
    const clearHistory = () => void update($, brain, (s): BrainState => ({ ...s, recent: [], toolCount: 0 }))

    const controls = (
      <Box gap={1} flexWrap="wrap">
        <Button key="view-3d" hotkey="3" plain dimColor={view !== '3d'} onPress={setView('3d')}>
          3D
        </Button>
        <Button key="view-hud" hotkey="h" plain dimColor={view !== 'hud'} onPress={setView('hud')}>
          HUD
        </Button>
        <Button key="pause" hotkey="p" plain onPress={togglePause}>
          {prefs.paused ? '▶ play' : '⏸ pause'}
        </Button>
        <Button key="speed" hotkey="s" plain onPress={cycleSpeed}>
          speed <Text dimColor>{SPEED_LABEL[prefs.speed]}</Text>
        </Button>
        <Button key="clear" hotkey="c" plain dimColor onPress={clearHistory}>
          clear
        </Button>
      </Box>
    )

    const recentList =
      recent.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>recent · hover a ◉ node for details, click to pin a note</Text>
          {recent.map(r => (
            <Text wrap="truncate-end">
              <Text color={r.isError ? 'error' : PHASES[r.phase].color}>
                {r.ms === undefined ? '⋯' : '✓'}
              </Text>{' '}
              <Text color={PHASES[r.phase].color} bold>
                {r.tool}
              </Text>{' '}
              <Text dimColor>{clip(r.label, Math.max(8, cols - r.tool.length - 10))}</Text>{' '}
              <Text dimColor>{r.ms === undefined ? '' : ago(r.ms)}</Text>
            </Text>
          ))}
        </Box>
      ) : null

    // ---- the terminal's interactive 3D sphere: a Client drawn in cells ----
    // (The desktop app draws Svg but no Client today, so there the sphere is vector, below.)
    if (view === '3d' && e.surface === 'terminal') {
      const { Client } = $.ui.resolve(e)
      const props: Brain3dProps = {
        phase: state.phase,
        color: style.color,
        dim: style.dim,
        label: style.label,
        detail: state.detail,
        tempo: style.tempo,
        paused: prefs.paused,
        speed: prefs.speed,
        nodes: state.recent.map(r => ({
          id: r.id,
          tool: r.tool,
          label: r.label,
          phase: r.phase,
          ...(r.ms === undefined ? {} : { ms: r.ms }),
          ...(r.isError ? { isError: true } : {}),
        })),
        elapsedMs: state.turnStartedAt && state.phase !== 'idle' ? Math.max(0, now - state.turnStartedAt) : 0,
        tools: state.toolCount,
      }
      const room = e.props.scroll?.bodyRows ?? 0
      const height =
        room > 0 ? Math.max(10, Math.min(24, room - 3 - (recent.length ? recent.length + 2 : 0))) : 16
      return (
        <Box flexDirection="column" paddingX={1}>
          <Client key={CLIENT} module="./brain3d.tsx" props={props} width="100%" height={height} />
          {controls}
          {recentList}
        </Box>
      )
    }

    // ---- the vector views (desktop, editor, mobile): the 3D sphere or the HUD rings ----
    if (hasHud) {
      const { Svg } = $.ui.resolve(e)
      const width = Math.min(440, Math.max(240, Math.round(cols * 7.2)))
      const height = Math.round((width * 230) / 320)
      const draw = view === '3d' ? brainSphereSvg : brainSvg
      return (
        <Box flexDirection="column" paddingX={1}>
          <Box justifyContent="center">
            <Svg
              source={draw(state, now, { paused: prefs.paused, speed: prefs.speed })}
              alt={`Claude is ${style.label}${state.detail ? `: ${state.detail}` : ''}`}
              width={width}
              height={height}
              isInteractive
            />
          </Box>
          {controls}
          {recentList}
          {state.phase === 'idle' && recent.length === 0 && (
            <Text dimColor>Standing by. The brain lights up when a turn starts.</Text>
          )}
        </Box>
      )
    }

    // ---- the terminal's text HUD ----
    const t = await read($, tick)
    const orbRows = orb(t, state.phase, cols)
    const line = overlayLine(t, state.phase, cols)
    const elapsed = elapsedText(state, now)
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box justifyContent="space-between">
          <Text color={style.color} bold>
            {style.label.toUpperCase()}
          </Text>
          <Text dimColor>{elapsed}</Text>
        </Box>
        <Text dimColor>{clip(state.detail, cols - 2) || ' '}</Text>
        <Box flexDirection="column" alignItems="center" marginY={1}>
          {orbRows.map(r => (
            <Text color={style.color}>{r.text}</Text>
          ))}
          <Text color={style.color} bold>
            {line.text}
          </Text>
        </Box>
        {controls}
        {recentList}
      </Box>
    )
  })
}
