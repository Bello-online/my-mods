import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { BuddyAction, BuddyMood, BuddyState } from '../types'
import { CLAWD_ORANGE, MOODS, STAGE_H, STAGE_W, sceneAlt, sceneRows, sceneSvg } from './scenes'

const PANE = 'clawd-buddy'
const TITLE = 'Clawd'
const KEEP = 14
const TICK_MS = 450
const SETTLE_MS = 8000

const INITIAL: BuddyState = {
  mood: 'idle',
  detail: '',
  turnStartedAt: null,
  count: 0,
  active: 0,
  actions: [],
}

const buddy = atom({ plugin: 'clawd-buddy', key: 'buddy' } as const, INITIAL, { shape: 'buddy-1' })
const tick = atom({ plugin: 'clawd-buddy', key: 'tick' } as const, 0)

// Module-local handles: a reload drops them and the next turn makes new ones.
let ticker: Timer | null = null
let settle: Timer | null = null
let hasTerminal = false

export function clip(text: string, max: number): string {
  if (max <= 1) return ''
  const one = text.replace(/\s+/g, ' ').trim()

  return one.length > max ? one.slice(0, max - 1) + '…' : one
}

export function spanText(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${s}s`
  const m = Math.floor(s / 60)

  return `${m}m ${String(s - m * 60).padStart(2, '0')}s`
}

type Kind = Pick<BuddyAction, 'mood' | 'doing' | 'did' | 'what'>

/** What a tool call looks like to Clawd: the scene it belongs to and the words for the list. */
export function classify(tool: string, input: Record<string, unknown>): Kind {
  const str = (key: string, max = 70): string => {
    const v = input[key]

    return typeof v === 'string' && v.length > 0 ? clip(v, max) : ''
  }
  const BACKSLASH = String.fromCharCode(92)
  const tail = (path: string): string =>
    path
      .split('/')
      .flatMap(part => part.split(BACKSLASH))
      .filter(Boolean)
      .slice(-2)
      .join('/')
  const file = tail(str('file_path', 300) || str('notebook_path', 300)) || 'a file'

  switch (tool) {
    case 'Read':
    case 'NotebookRead':
      return { mood: 'reading', doing: 'Reading', did: 'Read', what: file }
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return { mood: 'editing', doing: 'Editing', did: 'Edited', what: file }
    case 'Write':
      return { mood: 'editing', doing: 'Writing', did: 'Wrote', what: file }
    case 'Bash':
    case 'PowerShell':
      return { mood: 'running', doing: 'Running', did: 'Ran', what: str('description') || str('command') || 'a command' }
    case 'Grep':
      return { mood: 'searching', doing: 'Searching', did: 'Searched', what: str('pattern', 40) ? `/${str('pattern', 40)}/` : 'the files' }
    case 'Glob':
      return { mood: 'searching', doing: 'Finding', did: 'Found', what: str('pattern') || 'files' }
    case 'ToolSearch':
      return { mood: 'searching', doing: 'Finding tools', did: 'Found tools', what: str('query') }
    case 'WebSearch':
      return { mood: 'browsing', doing: 'Searching the web', did: 'Searched the web', what: str('query') }
    case 'WebFetch':
      return { mood: 'browsing', doing: 'Fetching', did: 'Fetched', what: str('url').replace(/^https?:\/\//, '') || 'a page' }
    case 'Agent':
    case 'Workflow':
      return { mood: 'delegating', doing: 'Delegating', did: 'Delegated', what: str('description') || str('subagent_type') || 'a task' }
    case 'Skill':
      return { mood: 'working', doing: 'Using skill', did: 'Used skill', what: str('skill') }
    default: {
      if (tool.startsWith('mcp__')) {
        const parts = tool.split('__')
        const name = (parts[parts.length - 1] ?? tool).replace(/_/g, ' ')
        const isBrowser = /browser|chrome/i.test(tool)

        return { mood: isBrowser ? 'browsing' : 'connecting', doing: 'Calling', did: 'Called', what: name }
      }

      return { mood: 'working', doing: 'Using', did: 'Used', what: tool }
    }
  }
}

function startTicker($: EngineInterface): void {
  if (ticker || !hasTerminal) return
  ticker = $.clock.every(TICK_MS, () => {
    void update($, tick, n => ((n ?? 0) + 1) % 1_000_000)
  })
}

function stopTicker(): void {
  ticker?.cancel()
  ticker = null
}

async function setMood($: EngineInterface, mood: BuddyMood, detail: string): Promise<void> {
  const current = await read($, buddy)
  if (current.mood === mood && current.detail === detail) return
  await update($, buddy, (s): BuddyState => ({ ...s, mood, detail }))
}

async function openPane($: EngineInterface, focus = false): Promise<boolean> {
  const opened = await $.ui.open(focus ? { id: PANE, title: TITLE, focus: true, rows: 20 } : { id: PANE, title: TITLE })
  if (!opened.isPlaced) $.ui.log(`clawd-buddy: pane waits: ${opened.reason}`, { to: 'debug' })

  return opened.isPlaced
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'clawd',
      description: 'Open the Clawd pane: the mascot acts out what Claude is doing, with its actions listed',
    })
    const result = await next(e)
    // Docked beside the chat on the desktop and editor. On a terminal it waits for /clawd,
    // since a pane there takes rows from the transcript.
    if (e.surface === 'terminal') hasTerminal = true
    else void openPane($)

    return result
  })

  // A surface attaching later (the desktop app to a session it started) seats the pane.
  on('session.attach', async ($, e, next) => {
    const result = await next(e)
    if (e.surface === 'terminal') hasTerminal = true
    else void openPane($)

    return result
  })

  on('command.run', { command: 'clawd' }, async $ => {
    try {
      const isPlaced = await openPane($, true)

      return { text: isPlaced ? 'Clawd is out. He acts out what Claude is doing.' : 'The Clawd pane could not be placed on this surface.' }
    } catch {
      return { text: 'The Clawd pane could not be opened.' }
    }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId) return next(e)
    try {
      settle?.cancel()
      settle = null
      const now = await $.clock.now()
      await update(
        $,
        buddy,
        (): BuddyState => ({
          mood: 'thinking',
          detail: clip(e.text, 80) || 'Picking up where it left off',
          turnStartedAt: now,
          count: 0,
          active: 0,
          actions: [],
        }),
      )
      startTicker($)
    } catch {
      // bookkeeping only: never hold the turn on it
    }

    return next(e)
  })

  // The model's response as it streams: reasoning, prose, or a tool call being prepared.
  on('turn.step', async function* ($, e, next) {
    const stream = next(e)
    let seen = ''
    for await (const chunk of stream) {
      if (!e.agentId) {
        let want: [BuddyMood, string] | null = null
        if (chunk.kind === 'thinking') want = ['thinking', 'Reasoning it through']
        else if (chunk.kind === 'text') want = ['writing', 'Typing up the answer']
        else if (chunk.kind === 'tool') want = [classify(chunk.name, {}).mood, `Getting ${chunk.name} ready`]
        if (want && want.join('|') !== seen) {
          seen = want.join('|')
          try {
            await setMood($, want[0], want[1])
          } catch {
            // bookkeeping only
          }
        }
      }
      yield chunk
    }

    return await stream.result
  })

  on('tool.call', async ($, e, next) => {
    let id = ''
    try {
      const kind = classify(e.tool, e as unknown as Record<string, unknown>)
      const now = await $.clock.now()
      id = e.tool_use_id ?? `${e.tool}-${now}`
      const isSub = Boolean(e.agentId)
      const action: BuddyAction = { id, tool: e.tool, ...kind, startedAt: now, ...(isSub ? { isSub: true } : {}) }
      await update(
        $,
        buddy,
        (s): BuddyState => ({
          ...s,
          mood: isSub ? 'delegating' : kind.mood,
          detail: `${isSub ? 'A helper is ' + kind.doing.toLowerCase() : kind.doing} ${kind.what}`.trim(),
          count: s.count + 1,
          active: s.active + 1,
          actions: [...s.actions, action].slice(-KEEP),
        }),
      )
    } catch {
      // bookkeeping only: never gate the call on it
    }

    const ran = await next(e)

    try {
      const end = await $.clock.now()
      await update(
        $,
        buddy,
        (s): BuddyState => ({
          ...s,
          active: Math.max(0, s.active - 1),
          actions: s.actions.map(a =>
            a.id === id ? { ...a, ms: Math.max(0, end - a.startedAt), ...(ran.isError ? { isError: true } : {}) } : a,
          ),
        }),
      )
    } catch {
      // bookkeeping only
    }

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if ((e as { agentId?: string }).agentId) return result
    try {
      const now = await $.clock.now()
      const state = await read($, buddy)
      const took = state.turnStartedAt === null ? '' : spanText(now - state.turnStartedAt)
      const tally = state.count === 0 ? '' : `${state.count} ${state.count === 1 ? 'action' : 'actions'}`
      const mood: BuddyMood = e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'idle' : 'error'
      const detail =
        e.reason === 'answer'
          ? [took ? `Finished in ${took}` : 'Finished', tally].filter(Boolean).join(' · ')
          : e.reason === 'aborted'
            ? 'Stopped'
            : e.reason === 'refusal'
              ? 'The request was declined'
              : 'The turn hit an error'
      await update($, buddy, (s): BuddyState => ({ ...s, mood, detail, active: 0, turnStartedAt: null }))
      settle?.cancel()
      settle = $.clock.after(SETTLE_MS, () => {
        settle = null
        stopTicker()
        void update($, buddy, (s): BuddyState => (s.turnStartedAt === null ? { ...s, mood: 'idle', detail: '' } : s))
      })
    } catch {
      // bookkeeping only
    }

    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const state = await read($, buddy)
    const style = MOODS[state.mood]
    const cols = Math.max(20, e.props.bodyColumns)
    const { Box, Text, Button } = $.ui.resolve(e)
    const isBusy = state.mood !== 'idle' && state.mood !== 'done' && state.mood !== 'error'
    const headline = isBusy ? `${style.label}…` : style.label
    const detail = state.detail || (state.mood === 'idle' ? 'Clawd acts out the next turn.' : '')
    const room = e.surface === 'terminal' ? Math.max(3, (e.props.scroll?.bodyRows ?? 16) - 9) : KEEP
    const shown = state.actions.slice(-room).reverse()
    const clear = () => void update($, buddy, (s): BuddyState => ({ ...s, actions: [], count: 0 }))

    const list = (
      <Box key="actions" flexDirection="column">
        <Box justifyContent="space-between">
          <Text dimColor bold>
            ACTIONS
          </Text>
          {state.count > 0 ? (
            <Button key="clear" hotkey="c" plain dimColor onPress={clear}>
              {state.count} this turn · clear
            </Button>
          ) : null}
        </Box>
        {shown.length === 0 ? <Text dimColor>Nothing yet. Tool calls show up here as they happen.</Text> : null}
        {shown.map(a => {
          const isRunning = a.ms === undefined
          const mark = isRunning ? '◌' : a.isError ? '✗' : '✓'
          const markColor = a.isError ? 'error' : isRunning ? MOODS[a.mood].accent : '#34c27a'
          const verb = isRunning ? a.doing : a.did
          const time = isRunning ? '' : spanText(a.ms ?? 0)
          const width = Math.max(6, cols - verb.length - time.length - (a.isSub ? 8 : 6))

          return (
            <Text wrap="truncate-end">
              <Text color={markColor}>{mark}</Text> {a.isSub ? <Text dimColor>↳ </Text> : null}
              <Text color={MOODS[a.mood].accent} bold>
                {verb}
              </Text>{' '}
              <Text dimColor={!isRunning}>{clip(a.what, width)}</Text> <Text dimColor>{time}</Text>
            </Text>
          )
        })}
      </Box>
    )

    if (e.surface === 'terminal') {
      const frame = await read($, tick)
      const rows = sceneRows(state.mood, frame)

      return (
        <Box flexDirection="column" paddingX={1}>
          <Box flexDirection="column" alignItems="center">
            {rows.map(r => (
              <Text>
                <Text color={CLAWD_ORANGE}>{r.logo}</Text>
                <Text color={style.accent}>{r.prop.padEnd(10)}</Text>
              </Text>
            ))}
            <Text color={style.accent} bold>
              {headline}
            </Text>
            <Text dimColor wrap="truncate-end">
              {clip(detail, cols - 2) || ' '}
            </Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            {list}
          </Box>
        </Box>
      )
    }

    const { Svg } = $.ui.resolve(e)
    const width = Math.min(STAGE_W + 40, Math.max(200, Math.round(cols * 7)))
    const height = Math.round((width * STAGE_H) / STAGE_W)

    return (
      <Box flexDirection="column" paddingX={1} gap={1}>
        <Box justifyContent="center">
          <Svg source={sceneSvg(state.mood)} alt={sceneAlt(state.mood, state.detail)} width={width} height={height} isInteractive />
        </Box>
        <Box flexDirection="column" alignItems="center">
          <Text color={style.accent} bold>
            {headline}
          </Text>
          <Text dimColor wrap="truncate-end">
            {clip(detail, cols + 8) || ' '}
          </Text>
        </Box>
        {list}
      </Box>
    )
  })
}
