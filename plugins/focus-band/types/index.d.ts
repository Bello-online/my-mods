export type FocusMode = 'focus' | 'break'

export type FocusStatus = 'idle' | 'running' | 'paused'

export type FocusTimer = {
  mode: FocusMode
  status: FocusStatus
  /** Epoch ms the running block ends at; 0 when not running. */
  endsAt: number
  /** Ms left in the block while idle or paused. */
  leftMs: number
  /** Focus blocks finished this session. */
  rounds: number
  focusMin: number
  breakMin: number
}

export type FocusCounts = {
  startedAt: number
  turns: number
  tools: number
}

declare module 'claude-code' {
  interface PluginState {
    'focus-band': {
      timer: FocusTimer
      counts: FocusCounts
      now: number
    }
  }
}
