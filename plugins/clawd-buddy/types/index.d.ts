/** What Clawd is acting out. */
export type BuddyMood =
  | 'idle'
  | 'thinking'
  | 'writing'
  | 'reading'
  | 'editing'
  | 'running'
  | 'searching'
  | 'browsing'
  | 'delegating'
  | 'connecting'
  | 'working'
  | 'done'
  | 'error'

/** One tool call of the turn, as the list under Clawd shows it. */
export type BuddyAction = {
  id: string
  tool: string
  mood: BuddyMood
  /** The verb while it runs ("Reading") and once it has ("Read"). */
  doing: string
  did: string
  /** What it acts on: a file, a command, a query. */
  what: string
  startedAt: number
  ms?: number
  isError?: boolean
  /** True when a subagent made the call. */
  isSub?: boolean
}

export type BuddyState = {
  mood: BuddyMood
  detail: string
  /** Epoch ms the turn began; null between turns. */
  turnStartedAt: number | null
  /** Tool calls this turn, including ones the list no longer holds. */
  count: number
  /** Tool calls still running. */
  active: number
  actions: BuddyAction[]
}

declare module 'claude-code' {
  interface PluginState {
    'clawd-buddy': {
      buddy: Shaped<BuddyState>
      /** The terminal's animation frame. */
      tick: number
    }
  }
}
