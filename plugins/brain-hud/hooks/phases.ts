import type { BrainPhase } from '../types'

/** Colour, motion tempo and label per phase. */
export type PhaseStyle = {
  color: string
  dim: string
  label: string
  /** seconds per rotation of the outer ring; smaller is faster */
  tempo: number
}

export const PHASES: Record<BrainPhase, PhaseStyle> = {
  idle: { color: '#7c8aa5', dim: '#3b4453', label: 'standing by', tempo: 48 },
  thinking: { color: '#a78bfa', dim: '#4c3d82', label: 'thinking', tempo: 9 },
  responding: { color: '#22d3ee', dim: '#155e6b', label: 'responding', tempo: 14 },
  reading: { color: '#38bdf8', dim: '#1a5f80', label: 'reading', tempo: 12 },
  editing: { color: '#fbbf24', dim: '#7a5a12', label: 'editing', tempo: 7 },
  running: { color: '#fb923c', dim: '#7d4418', label: 'running', tempo: 4 },
  searching: { color: '#4ade80', dim: '#1f6b3b', label: 'searching', tempo: 5 },
  web: { color: '#2dd4bf', dim: '#166a60', label: 'fetching', tempo: 10 },
  delegating: { color: '#f472b6', dim: '#7a3a5c', label: 'delegating', tempo: 11 },
  connecting: { color: '#818cf8', dim: '#3e4480', label: 'connecting', tempo: 8 },
  working: { color: '#60a5fa', dim: '#2b4f80', label: 'working', tempo: 8 },
  done: { color: '#34d399', dim: '#1a6b4d', label: 'done', tempo: 30 },
  error: { color: '#f87171', dim: '#7a2e2e', label: 'error', tempo: 20 },
}

/** Map a tool call to the phase it belongs to and a short label for it. */
export function classify(tool: string, input: Record<string, unknown>): { phase: BrainPhase; label: string } {
  const str = (k: string, max = 60) => {
    const v = input[k]
    if (typeof v !== 'string' || v.length === 0) return ''
    const one = v.replace(/\s+/g, ' ').trim()
    return one.length > max ? one.slice(0, max - 1) + '…' : one
  }
  const BACKSLASH = String.fromCharCode(92)
  const base = (p: string) =>
    p
      .split('/')
      .flatMap(part => part.split(BACKSLASH))
      .filter(Boolean)
      .slice(-2)
      .join('/')

  switch (tool) {
    case 'Read':
    case 'NotebookRead':
      return { phase: 'reading', label: base(str('file_path', 200)) || 'a file' }
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return { phase: 'editing', label: base(str('file_path', 200) || str('notebook_path', 200)) || 'a file' }
    case 'Bash':
    case 'PowerShell':
      return { phase: 'running', label: str('description') || str('command') || 'a command' }
    case 'Grep':
      return { phase: 'searching', label: str('pattern') ? `/${str('pattern', 40)}/` : 'files' }
    case 'Glob':
      return { phase: 'searching', label: str('pattern') || 'files' }
    case 'WebSearch':
      return { phase: 'searching', label: str('query') || 'the web' }
    case 'WebFetch':
      return { phase: 'web', label: str('url', 70).replace(/^https?:\/\//, '') || 'a page' }
    case 'Agent':
    case 'Workflow':
      return { phase: 'delegating', label: str('description') || str('subagent_type') || 'a subagent' }
    case 'Skill':
      return { phase: 'working', label: `skill ${str('skill')}`.trim() }
    case 'ToolSearch':
      return { phase: 'searching', label: str('query') || 'tools' }
    default:
      if (tool.startsWith('mcp__')) {
        const parts = tool.split('__')
        const name = parts[parts.length - 1] ?? tool
        return { phase: 'connecting', label: name.replace(/_/g, ' ') }
      }
      return { phase: 'working', label: tool }
  }
}

export function clip(text: string, max: number): string {
  if (max <= 1) return ''
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > max ? one.slice(0, max - 1) + '…' : one
}

export function ago(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s - m * 60}s`
}
