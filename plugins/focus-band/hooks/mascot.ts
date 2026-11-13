// Clawd, the Claude Code mascot, for the focus band.
// Desktop: an SVG stage where Clawd hops between spots now and then (SMIL, so
// the drawing never has to change while it moves). Terminal: the block-glyph
// logo, moved by the hooks module one frame at a time.

export type MascotMood = 'hop' | 'idle' | 'sleep'

export const CLAWD_ORANGE = '#D97757'
const EYE = '#1f1410'

// The terminal logo, read as a pixel grid: 18 columns by 5 rows.
// Row 1 has the two eye gaps, row 2 the arms, row 4 the legs.
const BODY_RUNS: ReadonlyArray<readonly [row: number, from: number, to: number]> = [
  [0, 3, 14],
  [1, 3, 4],
  [1, 6, 11],
  [1, 13, 14],
  [2, 1, 16],
  [3, 3, 14],
  [4, 4, 4],
  [4, 6, 6],
  [4, 11, 11],
  [4, 13, 13],
]
const EYES = [5, 12] as const

const PX = 2.4
const PY = 4.2
const SPRITE_W = 18 * PX
const SPRITE_H = 5 * PY

export const STAGE_W = 260
export const STAGE_H = 50
const GROUND = 46
const HOP_H = 15

const n = (v: number) => String(Math.round(v * 100) / 100)

type Frame = { t: number; x: number; y: number }

/** Builds a hop routine: rests and runs of small hops, as timed keyframes. */
function routine(start: number): { frames: Frame[]; rest: (until: number) => void; hops: (count: number, toX: number, each?: number) => void } {
  const frames: Frame[] = [{ t: 0, x: start, y: 0 }]
  let t = 0
  let x = start

  return {
    frames,
    rest(until) {
      t = until
      frames.push({ t, x, y: 0 })
    },
    hops(count, toX, each = 0.42) {
      const step = (toX - x) / count
      for (let i = 0; i < count; i++) {
        const x0 = x
        for (const u of [0.25, 0.5, 0.75, 1]) {
          frames.push({ t: t + u * each, x: x0 + step * u, y: -HOP_H * (1 - (2 * u - 1) ** 2) })
        }
        t += each
        x = x0 + step
      }
    },
  }
}

function focusFrames(): { frames: Frame[]; dur: number } {
  const r = routine(14)
  r.rest(4)
  r.hops(3, 96)
  r.rest(8.5)
  r.hops(2, 150)
  r.rest(11.2)
  r.hops(1, 150, 0.5) // a hop on the spot
  r.rest(12.4)
  r.hops(4, 14)
  r.rest(18)

  return { frames: r.frames, dur: 18 }
}

function idleFrames(): { frames: Frame[]; dur: number } {
  const r = routine(14)
  r.rest(6)
  r.hops(1, 14, 0.36)
  r.rest(9)

  return { frames: r.frames.map(f => ({ ...f, y: f.y * 0.45 })), dur: 9 }
}

function keyTimes(frames: Frame[], dur: number): string {
  return frames.map(f => n(Math.min(1, f.t / dur))).join(';')
}

function spriteRects(isAsleep: boolean): string {
  const body = BODY_RUNS.map(
    ([row, from, to]) =>
      `<rect x="${n(from * PX)}" y="${n(row * PY)}" width="${n((to - from + 1) * PX)}" height="${n(PY + 0.3)}"/>`,
  ).join('')
  const eyes = EYES.map(col =>
    isAsleep
      ? `<rect x="${n(col * PX)}" y="${n(PY + PY * 0.62)}" width="${n(PX)}" height="1.1" fill="${EYE}"/>`
      : `<rect x="${n(col * PX)}" y="${n(PY)}" width="${n(PX)}" height="${n(PY)}" fill="${EYE}">` +
        `<animate attributeName="height" dur="4.6s" repeatCount="indefinite" keyTimes="0;0.92;0.95;0.98;1" values="${n(PY)};${n(PY)};0.6;${n(PY)};${n(PY)}"/>` +
        `<animate attributeName="y" dur="4.6s" repeatCount="indefinite" keyTimes="0;0.92;0.95;0.98;1" values="${n(PY)};${n(PY)};${n(PY * 1.7)};${n(PY)};${n(PY)}"/>` +
        `</rect>`,
  ).join('')

  return `<g fill="${CLAWD_ORANGE}" shape-rendering="crispEdges">${body}</g>${eyes}`
}

function tomatoes(rounds: number): string {
  const shown = Math.min(rounds, 6)
  let out = ''
  for (let i = 0; i < shown; i++) {
    const cx = STAGE_W - 10 - i * 15
    out +=
      `<g transform="translate(${cx} ${GROUND - 6})">` +
      `<circle r="5.4" fill="#e5533d"/><circle cx="-1.8" cy="-1.6" r="1.4" fill="#ff8a75" opacity="0.8"/>` +
      `<path d="M-3 -4.6 L0 -3 L3 -4.6 L1 -5.2 L0 -7 L-1 -5.2 Z" fill="#4caf50"/></g>`
  }
  if (rounds > shown) {
    out += `<text x="${STAGE_W - 10 - shown * 15 + 2}" y="${GROUND - 3}" font-family="ui-monospace,monospace" font-size="10" fill="#e5533d" text-anchor="end">×${rounds}</text>`
  }

  return out
}

/**
 * The desktop stage. Its markup depends only on the mood, the accent and the
 * rounds, never on the time, so a redraw each second keeps the animation running.
 */
export function mascotSvg(opts: { mood: MascotMood; accent: string; rounds: number }): string {
  const { mood, accent, rounds } = opts
  const top = GROUND - SPRITE_H
  const ground =
    `<line x1="4" y1="${GROUND + 0.5}" x2="${STAGE_W - 4}" y2="${GROUND + 0.5}" stroke="${accent}" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="2 4" stroke-linecap="round"/>`

  let actor: string
  if (mood === 'sleep') {
    const x = 14
    const zs = [0, 1, 2]
      .map(
        i =>
          `<text x="${x + SPRITE_W - 2 + i * 6}" y="${top}" font-family="ui-monospace,monospace" font-size="${8 + i * 2}" fill="${accent}" opacity="0">z` +
          `<animate attributeName="opacity" dur="3.6s" begin="${n(i * 1.2)}s" repeatCount="indefinite" values="0;0.9;0" keyTimes="0;0.3;1"/>` +
          `<animate attributeName="y" dur="3.6s" begin="${n(i * 1.2)}s" repeatCount="indefinite" values="${top};${top - 14}"/>` +
          `</text>`,
      )
      .join('')
    actor =
      `<ellipse cx="${n(x + SPRITE_W / 2)}" cy="${GROUND}" rx="17" ry="2.4" fill="#000" opacity="0.18"/>` +
      `<g transform="translate(${x} ${n(top)})"><g>` +
      `<animateTransform attributeName="transform" type="translate" dur="3s" repeatCount="indefinite" values="0 0;0 -1.2;0 0"/>` +
      `${spriteRects(true)}</g></g>${zs}`
  } else {
    const { frames, dur } = mood === 'hop' ? focusFrames() : idleFrames()
    const kt = keyTimes(frames, dur)
    const xs = frames.map(f => `${n(f.x)} 0`).join(';')
    const ys = frames.map(f => `0 ${n(f.y)}`).join(';')
    const rx = frames.map(f => n(17 + f.y * 0.55)).join(';')
    const op = frames.map(f => n(0.2 + f.y * 0.008)).join(';')
    actor =
      `<g><animateTransform attributeName="transform" type="translate" dur="${dur}s" repeatCount="indefinite" keyTimes="${kt}" values="${xs}"/>` +
      `<ellipse cx="${n(SPRITE_W / 2)}" cy="${GROUND}" rx="17" ry="2.4" fill="#000" opacity="0.2">` +
      `<animate attributeName="rx" dur="${dur}s" repeatCount="indefinite" keyTimes="${kt}" values="${rx}"/>` +
      `<animate attributeName="opacity" dur="${dur}s" repeatCount="indefinite" keyTimes="${kt}" values="${op}"/></ellipse>` +
      `<g transform="translate(0 ${n(top)})"><g>` +
      `<animateTransform attributeName="transform" type="translate" dur="${dur}s" repeatCount="indefinite" keyTimes="${kt}" values="${ys}"/>` +
      `${spriteRects(false)}</g></g></g>`
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${STAGE_W}" height="${STAGE_H}" viewBox="0 0 ${STAGE_W} ${STAGE_H}">` +
    `${ground}${tomatoes(rounds)}${actor}</svg>`
  )
}

export function mascotAlt(mood: MascotMood, rounds: number): string {
  const what =
    mood === 'hop' ? 'Clawd hops along while you focus' : mood === 'sleep' ? 'Clawd naps through the break' : 'Clawd waits for the next round'

  return rounds > 0 ? `${what}; ${rounds} ${rounds === 1 ? 'round' : 'rounds'} done` : what
}

// Terminal: the logo itself, three rows of block glyphs.
const LOGO_AWAKE = [' ▐▛███▜▌ ', '▝▜█████▛▘', '  ▘▘ ▝▝  '] as const
const LOGO_ASLEEP = [' ▐▀███▀▌ ', '▝▜█████▛▘', '  ▘▘ ▝▝  '] as const
export const LOGO_W = 9

/** The terminal lane: four rows, Clawd at column `x`, lifted one row mid-hop. */
export function laneRows(opts: { x: number; lift: number; isAsleep: boolean; width: number }): string[] {
  const { lift, isAsleep, width } = opts
  const x = Math.max(0, Math.min(Math.round(opts.x), Math.max(0, width - LOGO_W - 4)))
  const logo = isAsleep ? LOGO_ASLEEP : LOGO_AWAKE
  const pad = ' '.repeat(x)
  const sprite = logo.map(row => pad + row)
  const z = isAsleep ? ' z' : ''
  const [a = '', b = '', c = ''] = sprite
  const rows = lift > 0 ? [a, b, c, ''] : ['', a + z, b, c]

  return rows
}
