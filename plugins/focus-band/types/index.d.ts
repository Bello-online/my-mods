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

/** Clawd's place in the terminal lane: a column, lifted one row mid-hop. */
export type FocusMascot = {
  x: number
  lift: number
}

declare module 'claude-code' {
  interface PluginState {
    'focus-band': {
      timer: Shaped<FocusTimer>
      counts: Shaped<FocusCounts>
      now: number
      mascot: Shaped<FocusMascot>
    }
  }
}
