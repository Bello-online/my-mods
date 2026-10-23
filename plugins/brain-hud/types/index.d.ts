export type BrainPhase =
  | 'idle'
  | 'thinking'
  | 'responding'
  | 'reading'
  | 'editing'
  | 'running'
  | 'searching'
  | 'web'
  | 'delegating'
  | 'connecting'
  | 'working'
  | 'done'
  | 'error'

export type BrainTool = {
  id: string
  tool: string
  label: string
  phase: BrainPhase
  startedAt: number
  ms?: number
  isError?: boolean
}

export type BrainState = {
  phase: BrainPhase
  prevPhase: BrainPhase
  detail: string
  since: number
  turnStartedAt: number | null
  turnCount: number
  toolCount: number
  active: number
  recent: BrainTool[]
}

/** What the person set on the pane's controls. */
export type BrainUi = {
  /** `3d` is the interactive point-sphere; `hud` the vector rings (desktop and editor only). */
  view: '3d' | 'hud'
  paused: boolean
  /** 1 slow, 2 normal, 3 fast */
  speed: 1 | 2 | 3
}

/** One node the 3D view places on the sphere: a recent tool call. */
export type BrainNode = {
  id: string
  tool: string
  label: string
  phase: BrainPhase
  ms?: number
  isError?: boolean
}

/** The props the hooks module hands the 3D surface module. */
export type Brain3dProps = {
  phase: BrainPhase
  color: string
  dim: string
  label: string
  detail: string
  tempo: number
  paused: boolean
  speed: 1 | 2 | 3
  nodes: BrainNode[]
  /** Milliseconds the turn had run when these props were made; 0 when idle. */
  elapsedMs: number
  tools: number
}

/** What the 3D surface module posts back to the hooks module. */
export type Brain3dMessage = { kind: 'node'; id: string } | { kind: 'toggle-pause' }

declare module 'claude-code' {
  interface PluginState {
    'brain-hud': { brain: BrainState; tick: number; ui: BrainUi }
  }
}
