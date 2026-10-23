import type { BrainPhase, BrainState } from '../types'
import { PHASES } from './phases'

/** One row of the terminal drawing: text and whether it is the bright colour. */
export type AsciiRow = { text: string; bright?: boolean; dim?: boolean }

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

/** A ring of dots around a boxed core, the bright dots walking with the tick. */
export function orb(tick: number, phase: BrainPhase, width: number): AsciiRow[] {
  if (width < 27) return [{ text: `${SPINNER[tick % SPINNER.length]} ${PHASES[phase].label}`, bright: true }]
  const cols = 27
  const rows = 9
  const grid: string[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' '))
  const cx = 13
  const cy = 4
  const n = 16
  const speed = phase === 'idle' ? 0.25 : phase === 'running' || phase === 'editing' ? 2 : 1
  const head = Math.floor(tick * speed) % n
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const x = Math.round(cx + 12 * Math.cos(a))
    const y = Math.round(cy + 4 * Math.sin(a))
    const dist = (i - head + n) % n
    const glyph = dist === 0 ? '●' : dist === 1 || dist === n - 1 ? '•' : '·'
    const row = grid[y]
    if (row) row[x] = glyph
  }
  // core box
  const box = ['╭─────╮', '│     │', '╰─────╯']
  box.forEach((line, r) => {
    const row = grid[cy - 1 + r]
    if (!row) return
    for (let c = 0; c < line.length; c++) row[cx - 3 + c] = line[c] ?? ' '
  })
  // nodes inside the core: one fires per tick
  const inner: Array<[number, number]> = [
    [cx - 2, cy],
    [cx, cy],
    [cx + 2, cy],
  ]
  inner.forEach(([x, y], i) => {
    const row = grid[y]
    if (!row) return
    const firing = phase === 'idle' ? false : (tick + i) % 3 === 0
    row[x] = firing ? '◉' : '○'
  })
  return grid.map(r => ({ text: r.join('') }))
}

/** The phase-specific line drawn under the orb. */
export function overlayLine(tick: number, phase: BrainPhase, width: number): AsciiRow {
  const w = Math.max(10, Math.min(27, width))
  const t = tick
  switch (phase) {
    case 'reading': {
      const pos = t % w
      const cells = Array.from({ length: w }, (_, i) => (i === pos ? '▓' : Math.abs(i - pos) < 3 ? '▒' : '░'))
      return { text: cells.join(''), bright: true }
    }
    case 'editing': {
      const len = t % (w - 3)
      return { text: '❯ ' + '─'.repeat(len) + ((t & 1) === 0 ? '▌' : ' '), bright: true }
    }
    case 'running': {
      const depth = t % 4
      const left = ['(', ' (', '  (', '   ('].slice(0, depth + 1).join('')
      const right = [')', ') ', ')  ', ')   ']
        .slice(0, depth + 1)
        .reverse()
        .join('')
      return { text: `${left} ◉ ${right}`.trim(), bright: true }
    }
    case 'searching': {
      const pos = t % (2 * (w - 2))
      const i = pos < w - 2 ? pos : 2 * (w - 2) - pos
      const cells = Array.from({ length: w - 2 }, (_, k) => (k === i ? '●' : '·'))
      return { text: `[${cells.join('')}]`, bright: true }
    }
    case 'web': {
      const frames = ['◐', '◓', '◑', '◒']
      return { text: `${frames[t % 4]} fetching ${'.'.repeat(t % 4)}`, bright: true }
    }
    case 'delegating': {
      const frames = ['◇ ◆ ◇', '◆ ◇ ◇', '◇ ◇ ◆', '◇ ◆ ◇']
      return { text: `${frames[t % 4]} subagents`, bright: true }
    }
    case 'responding': {
      const bars = '▁▂▃▅▆▇▆▅▃▂'
      const out = Array.from({ length: w }, (_, i) => bars[(i + t) % bars.length] ?? '▁')
      return { text: out.join(''), bright: true }
    }
    case 'thinking':
      return { text: `${SPINNER[t % SPINNER.length]} ${'∿'.repeat(1 + (t % 6))}`, bright: true }
    case 'done':
      return { text: '✔ done', bright: true }
    case 'error':
      return { text: '✖ error', bright: true }
    default:
      return { text: `${SPINNER[t % SPINNER.length]} ${PHASES[phase].label}`, bright: true }
  }
}

export function elapsedText(state: BrainState, now: number): string {
  if (!state.turnStartedAt || state.phase === 'idle') return ''
  const secs = Math.max(0, Math.round((now - state.turnStartedAt) / 1000))
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`
}
