// Clawd's scenes: one illustration per thing Claude can be doing.
// Desktop and editor: an SVG stage animated with SMIL. Its markup depends only
// on the mood, so a redraw of the pane never restarts the animation.
// Terminal: the block-glyph logo with a small prop beside it.

import type { BuddyMood } from '../types'

export const CLAWD_ORANGE = '#D97757'
const EYE = '#1f1410'
const PAPER = '#fbf6ec'
const INK = '#20242d'
const GREY = '#8d96a8'
const MUG = '#4fb3a5'

export type MoodStyle = { label: string; accent: string; scene: string }

export const MOODS: Record<BuddyMood, MoodStyle> = {
  idle: { label: 'Standing by', accent: '#8a94a8', scene: 'Clawd waits beside a steaming mug' },
  thinking: { label: 'Thinking', accent: '#a78bfa', scene: 'Clawd looks up at a thought bubble' },
  writing: { label: 'Writing', accent: '#22b8cf', scene: 'Clawd types the answer on a keyboard' },
  reading: { label: 'Reading', accent: '#4dabf7', scene: 'Clawd reads an open book' },
  editing: { label: 'Editing', accent: '#f2b632', scene: 'Clawd watches a pencil write code on a page' },
  running: { label: 'Running', accent: '#fb923c', scene: 'Clawd hops beside a terminal running a command' },
  searching: { label: 'Searching', accent: '#51cf66', scene: 'Clawd sweeps a magnifying glass over a set of files' },
  browsing: { label: 'Browsing', accent: '#2dd4bf', scene: 'Clawd watches a spinning globe' },
  delegating: { label: 'Delegating', accent: '#f472b6', scene: 'Clawd hands tasks to two small helpers' },
  connecting: { label: 'Connecting', accent: '#818cf8', scene: 'Clawd is plugged into a server by a live cable' },
  working: { label: 'Working', accent: '#60a5fa', scene: 'Clawd works beside two turning gears' },
  done: { label: 'Done', accent: '#34c27a', scene: 'Clawd jumps for joy under falling confetti' },
  error: { label: 'Something went wrong', accent: '#f25f5c', scene: 'Clawd shakes under a warning sign' },
}

// The terminal logo read as a pixel grid: 18 columns by 5 rows.
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
const EYE_COLS = [5, 12] as const

export const STAGE_W = 300
export const STAGE_H = 200
const GROUND = 158
const PX = 6
const PY = 10.5
const SW = 18 * PX
const SH = 5 * PY

type Eyes = 'open' | 'up' | 'down' | 'happy' | 'cross'
type Motion = 'breathe' | 'type' | 'sway' | 'hop' | 'jump' | 'shake'

const n = (v: number) => String(Math.round(v * 100) / 100)

function move(type: 'translate' | 'rotate', values: string, dur: string, keyTimes?: string, begin?: string): string {
  return (
    `<animateTransform attributeName="transform" type="${type}" dur="${dur}" repeatCount="indefinite" values="${values}"` +
    (keyTimes ? ` keyTimes="${keyTimes}"` : '') +
    (begin ? ` begin="${begin}"` : '') +
    `/>`
  )
}

function anim(attr: string, values: string, dur: string, keyTimes?: string, begin?: string): string {
  return (
    `<animate attributeName="${attr}" dur="${dur}" repeatCount="indefinite" values="${values}"` +
    (keyTimes ? ` keyTimes="${keyTimes}"` : '') +
    (begin ? ` begin="${begin}"` : '') +
    `/>`
  )
}

const PIVOT = `${n(SW / 2)} ${n(SH)}`

const MOTIONS: Record<Motion, string> = {
  breathe: move('translate', '0 0;0 -2;0 0', '3.2s'),
  type: move('translate', '0 0;0 -1.8;0 0', '0.34s'),
  sway: move('rotate', `-3 ${PIVOT};3 ${PIVOT};-3 ${PIVOT}`, '2.8s'),
  hop: move('translate', '0 0;0 -10;0 0;0 0', '1.5s', '0;0.14;0.3;1'),
  jump: move('translate', '0 0;0 -24;0 -30;0 -24;0 0;0 0', '1.2s', '0;0.14;0.24;0.34;0.48;1'),
  shake: move('translate', '-3 0;3 0;-3 0;3 0;0 0;0 0', '1.2s', '0;0.08;0.16;0.24;0.32;1'),
}

function eyeMarkup(eyes: Eyes): string {
  return EYE_COLS.map(col => {
    const x = col * PX
    const socket = `<rect x="${n(x - 0.2)}" y="${n(PY)}" width="${n(PX + 0.4)}" height="${n(PY + 0.4)}" fill="${CLAWD_ORANGE}"/>`

    return socket + eyeOf(eyes, x)
  }).join('')
}

function eyeOf(eyes: Eyes, x: number): string {
  switch (eyes) {
      case 'up':
        return `<rect x="${n(x)}" y="${n(PY)}" width="${PX}" height="${n(PY * 0.55)}" fill="${EYE}"/>`
      case 'down':
        return `<rect x="${n(x)}" y="${n(PY * 1.45)}" width="${PX}" height="${n(PY * 0.55)}" fill="${EYE}"/>`
      case 'happy':
        return `<rect x="${n(x)}" y="${n(PY * 1.25)}" width="${PX}" height="${n(PY * 0.3)}" fill="${EYE}"/>`
      case 'cross':
        return (
          `<path d="M${n(x)} ${n(PY)}L${n(x + PX)} ${n(PY * 2)}M${n(x + PX)} ${n(PY)}L${n(x)} ${n(PY * 2)}" ` +
          `stroke="${EYE}" stroke-width="1.8" stroke-linecap="round"/>`
        )
      default:
        return (
          `<rect x="${n(x)}" y="${n(PY)}" width="${PX}" height="${n(PY)}" fill="${EYE}">` +
          anim('height', `${n(PY)};${n(PY)};1;${n(PY)};${n(PY)}`, '4.6s', '0;0.92;0.95;0.98;1') +
          anim('y', `${n(PY)};${n(PY)};${n(PY * 1.6)};${n(PY)};${n(PY)}`, '4.6s', '0;0.92;0.95;0.98;1') +
          `</rect>`
        )
  }
}

function sprite(eyes: Eyes): string {
  const body = BODY_RUNS.map(
    ([row, from, to]) =>
      `<rect x="${n(from * PX)}" y="${n(row * PY)}" width="${n((to - from + 1) * PX)}" height="${n(PY + 0.4)}"/>`,
  ).join('')

  return `<g fill="${CLAWD_ORANGE}" shape-rendering="crispEdges">${body}</g>${eyeMarkup(eyes)}`
}

/** Clawd standing on the ground at `x`, with a soft shadow under him. */
function clawd(o: { x: number; eyes: Eyes; motion: Motion; scale?: number; begin?: string }): string {
  const s = o.scale ?? 1
  const top = GROUND - SH * s
  const motion = o.begin ? MOTIONS[o.motion].replace('/>', ` begin="${o.begin}"/>`) : MOTIONS[o.motion]

  return (
    `<ellipse cx="${n(o.x + (SW * s) / 2)}" cy="${GROUND + 1}" rx="${n(SW * s * 0.42)}" ry="${n(4 * s)}" fill="#000" opacity="0.16"/>` +
    `<g transform="translate(${n(o.x)} ${n(top)}) scale(${n(s)})"><g>${motion}${sprite(o.eyes)}</g></g>`
  )
}

function gearPath(r: number, teeth: number): string {
  const inner = r * 0.76
  const half = Math.PI / teeth
  const pts: string[] = []
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2
    const corners: Array<[number, number]> = [
      [inner, -0.55],
      [r, -0.3],
      [r, 0.3],
      [inner, 0.55],
    ]
    for (const [rad, off] of corners) {
      const t = a + off * half
      pts.push(`${n(Math.cos(t) * rad)} ${n(Math.sin(t) * rad)}`)
    }
  }
  const hole = r * 0.3

  return `M${pts.join('L')}Z M${n(hole)} 0A${n(hole)} ${n(hole)} 0 1 0 ${n(-hole)} 0A${n(hole)} ${n(hole)} 0 1 0 ${n(hole)} 0Z`
}

function gear(cx: number, cy: number, r: number, teeth: number, dur: string, turn: 1 | -1, color: string): string {
  return (
    `<g transform="translate(${cx} ${cy})"><g>` +
    `<animateTransform attributeName="transform" type="rotate" from="0" to="${360 * turn}" dur="${dur}" repeatCount="indefinite"/>` +
    `<path d="${gearPath(r, teeth)}" fill="${color}" fill-rule="evenodd"/></g></g>`
  )
}

type Scene = { back: string; actor: string; front: string }

function scene(mood: BuddyMood, accent: string): Scene {
  switch (mood) {
    case 'thinking': {
      const dots = [0, 1, 2]
        .map(
          i =>
            `<circle cx="${220 + i * 16}" cy="58" r="5" fill="${accent}" opacity="0.35">` +
            anim('opacity', '0.25;1;0.25;0.25', '1.4s', '0;0.2;0.45;1', `${n(i * 0.22)}s`) +
            anim('cy', '58;53;58;58', '1.4s', '0;0.2;0.45;1', `${n(i * 0.22)}s`) +
            `</circle>`,
        )
        .join('')

      return {
        back:
          `<circle cx="190" cy="98" r="4.5" fill="${accent}" opacity="0.55"/>` +
          `<circle cx="203" cy="85" r="7" fill="${accent}" opacity="0.55"/>` +
          `<rect x="194" y="30" width="84" height="56" rx="28" fill="${accent}" fill-opacity="0.16" stroke="${accent}" stroke-width="2.5"/>` +
          dots,
        actor: clawd({ x: 62, eyes: 'up', motion: 'sway' }),
        front: '',
      }
    }

    case 'writing': {
      const lines = [
        [64, 0.05, 0.25],
        [52, 0.27, 0.45],
        [60, 0.47, 0.66],
        [36, 0.68, 0.8],
      ]
        .map(
          ([w, a, b], i) =>
            `<rect x="198" y="${52 + i * 12}" width="${w}" height="4.5" rx="2.25" fill="${accent}">` +
            anim('width', `0;0;${w};${w};0`, '4.2s', `0;${a};${b};0.95;1`) +
            `</rect>`,
        )
        .join('')
      let keys = ''
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 11; col++) {
          const lit = (row * 5 + col * 7) % 6
          keys +=
            `<rect x="${n(62 + col * 10.2 + row * 2)}" y="${n(151.5 + row * 6)}" width="8" height="4" rx="1" fill="#fff" opacity="0.28">` +
            (lit < 2 ? anim('opacity', '0.28;1;0.28;0.28', '0.9s', '0;0.12;0.3;1', `${n(((row * 3 + col) % 9) * 0.1)}s`) : '') +
            `</rect>`
        }
      }

      return {
        back:
          `<rect x="186" y="38" width="92" height="64" rx="14" fill="${accent}" fill-opacity="0.16" stroke="${accent}" stroke-width="2.5"/>` +
          `<path d="M200 101L190 116L214 101Z" fill="${accent}" fill-opacity="0.16" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/>` +
          lines,
        actor: clawd({ x: 66, eyes: 'down', motion: 'type' }),
        front: `<rect x="56" y="147" width="128" height="24" rx="6" fill="${INK}"/>` + keys,
      }
    }

    case 'reading': {
      const row = (i: number, side: -1 | 1) => {
        const y = 143 + i * 6
        const x1 = side < 0 ? 110 : 156
        const x2 = side < 0 ? 144 : 190
        const dy = side < 0 ? 4.4 : -4.4
        const begin = `${n((side < 0 ? i : i + 4) * 0.45)}s`

        return (
          `<line x1="${x1}" y1="${n(y - dy / 2 + (side < 0 ? 0 : 4.4))}" x2="${x2}" y2="${n(y + dy / 2 + (side < 0 ? 0 : 4.4))}" ` +
          `stroke="${GREY}" stroke-width="2" stroke-linecap="round" opacity="0.5">` +
          anim('opacity', '0.5;1;0.5;0.5', '3.6s', '0;0.06;0.14;1', begin) +
          anim('stroke', `${GREY};${accent};${GREY};${GREY}`, '3.6s', '0;0.06;0.14;1', begin) +
          `</line>`
        )
      }
      const text = [0, 1, 2, 3].map(i => row(i, -1) + row(i, 1)).join('')

      return {
        back: '',
        actor: clawd({ x: 96, eyes: 'down', motion: 'breathe' }),
        front:
          `<g transform="translate(0 7)">` +
          `<path d="M100 132L150 139L150 172L100 165Z" fill="${PAPER}" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/>` +
          `<path d="M200 132L150 139L150 172L200 165Z" fill="${PAPER}" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/>` +
          text +
          `<path d="M200 132L150 139L150 172L200 165Z" fill="${PAPER}" stroke="${accent}" stroke-width="2" stroke-linejoin="round" opacity="0">` +
          anim('opacity', '0;0;1;1;0;0', '5.4s', '0;0.8;0.81;0.97;0.98;1') +
          anim(
            'd',
            'M200 132L150 139L150 172L200 165Z;M200 132L150 139L150 172L200 165Z;M150 116L150 139L150 172L150 149Z;M100 132L150 139L150 172L100 165Z;M100 132L150 139L150 172L100 165Z',
            '5.4s',
            '0;0.81;0.89;0.97;1',
          ) +
          `</path></g>`,
      }
    }

    case 'editing': {
      const code: Array<[indent: number, width: number, color: string]> = [
        [0, 44, accent],
        [10, 58, GREY],
        [10, 36, GREY],
        [10, 50, '#3fb27f'],
        [0, 22, accent],
      ]
      const rows = code
        .map(([indent, width, color], i) => {
          const y = 72 + i * 15
          if (i !== 3) return `<rect x="${186 + indent}" y="${y}" width="${width}" height="5" rx="2.5" fill="${color}"/>`

          return (
            `<rect x="182" y="${y - 4}" width="82" height="13" rx="3" fill="#3fb27f" opacity="0.2"/>` +
            `<rect x="${186 + indent}" y="${y}" width="${width}" height="5" rx="2.5" fill="${color}">` +
            anim('width', `0;${width};${width};0`, '2.8s', '0;0.6;0.92;1') +
            `</rect>`
          )
        })
        .join('')
      const tipY = 72 + 3 * 15 + 2
      const pencil =
        `<g transform="translate(226 ${tipY})">` +
        move('translate', `196 ${tipY};246 ${tipY};246 ${tipY};196 ${tipY}`, '2.8s', '0;0.6;0.92;1') +
        `<path d="M0 0L3 -9L9 -3Z" fill="#f3d9b1"/><path d="M0 0L1.2 -3.6L3.6 -1.2Z" fill="${INK}"/>` +
        `<path d="M3 -9L25 -31L31 -25L9 -3Z" fill="${accent}"/>` +
        `<path d="M25 -31L29 -35L35 -29L31 -25Z" fill="#e8766a"/></g>`

      return {
        back:
          `<rect x="172" y="48" width="100" height="112" rx="10" fill="${PAPER}" stroke="${accent}" stroke-width="2.5"/>` +
          `<rect x="172" y="48" width="100" height="14" rx="7" fill="${accent}" opacity="0.3"/>` +
          rows,
        actor: clawd({ x: 40, eyes: 'open', motion: 'breathe' }),
        front: pencil,
      }
    }

    case 'running': {
      const chevron = (y: number) =>
        `<path d="M162 ${y - 4}L167 ${y}L162 ${y + 4}" fill="none" stroke="#7ee787" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`

      return {
        back:
          `<rect x="150" y="46" width="134" height="114" rx="11" fill="${INK}"/>` +
          `<rect x="150" y="46" width="134" height="114" rx="11" fill="none" stroke="${accent}" stroke-width="2" opacity="0.7"/>` +
          `<circle cx="164" cy="60" r="3.6" fill="#ff5f57"/><circle cx="176" cy="60" r="3.6" fill="#febc2e"/><circle cx="188" cy="60" r="3.6" fill="#28c840"/>` +
          chevron(82) +
          `<rect x="174" y="79.5" width="72" height="5" rx="2.5" fill="#e6edf3">` +
          anim('width', '0;72;72;0', '3.4s', '0;0.28;0.95;1') +
          `</rect>` +
          `<rect x="162" y="95" width="96" height="5" rx="2.5" fill="${GREY}" opacity="0">` +
          anim('opacity', '0;0;0.9;0.9;0', '3.4s', '0;0.36;0.4;0.95;1') +
          `</rect>` +
          `<rect x="162" y="109" width="64" height="5" rx="2.5" fill="${GREY}" opacity="0">` +
          anim('opacity', '0;0;0.9;0.9;0', '3.4s', '0;0.5;0.54;0.95;1') +
          `</rect>` +
          `<rect x="162" y="123" width="82" height="5" rx="2.5" fill="#7ee787" opacity="0">` +
          anim('opacity', '0;0;0.9;0.9;0', '3.4s', '0;0.64;0.68;0.95;1') +
          `</rect>` +
          chevron(141) +
          `<rect x="174" y="136" width="7" height="10" fill="#e6edf3">` +
          anim('opacity', '1;1;0;0', '0.9s', '0;0.5;0.5;1') +
          `</rect>`,
        actor: clawd({ x: 26, eyes: 'open', motion: 'hop' }),
        front: '',
      }
    }

    case 'searching': {
      let cards = ''
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const x = 170 + c * 36
          const y = 58 + r * 46
          const hit = r === 1 && c === 1
          cards +=
            `<rect x="${x}" y="${y}" width="28" height="36" rx="5" fill="${accent}" fill-opacity="${hit ? 0.2 : 0.12}" stroke="${accent}" stroke-width="2" stroke-opacity="0.7">` +
            (hit ? anim('fill-opacity', '0.15;0.15;0.75;0.15;0.15', '5s', '0;0.62;0.7;0.82;1') : '') +
            `</rect>` +
            `<rect x="${x + 6}" y="${y + 9}" width="16" height="3" rx="1.5" fill="${accent}" opacity="0.6"/>` +
            `<rect x="${x + 6}" y="${y + 16}" width="11" height="3" rx="1.5" fill="${accent}" opacity="0.6"/>`
        }
      }
      const glass =
        `<g transform="translate(220 76)">` +
        move('translate', '184 76;220 76;256 76;256 122;220 122;184 122;184 76', '5s', '0;0.14;0.28;0.42;0.7;0.86;1') +
        `<circle r="16" fill="#fff" fill-opacity="0.28" stroke="${INK}" stroke-width="4.5"/>` +
        `<path d="M11.5 11.5L24 24" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M-8 -6A10 10 0 0 1 2 -11" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/></g>`

      return {
        back: cards,
        actor: clawd({ x: 36, eyes: 'open', motion: 'sway' }),
        front: glass,
      }
    }

    case 'browsing': {
      const cx = 220
      const cy = 98

      return {
        back:
          `<circle cx="${cx}" cy="${cy}" r="46" fill="${accent}" fill-opacity="0.14" stroke="${accent}" stroke-width="3"/>` +
          `<path d="M${cx - 46} ${cy}H${cx + 46}M${cx - 40} ${cy - 23}H${cx + 40}M${cx - 40} ${cy + 23}H${cx + 40}" stroke="${accent}" stroke-width="2" opacity="0.7"/>` +
          `<ellipse cx="${cx}" cy="${cy}" rx="46" ry="46" fill="none" stroke="${accent}" stroke-width="2" opacity="0.8">` +
          anim('rx', '46;0;46', '4s') +
          `</ellipse>` +
          `<ellipse cx="${cx}" cy="${cy}" rx="23" ry="46" fill="none" stroke="${accent}" stroke-width="2" opacity="0.8">` +
          anim('rx', '0;46;0', '4s') +
          `</ellipse>` +
          `<g transform="translate(${cx} ${cy})"><g>` +
          `<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3.2s" repeatCount="indefinite"/>` +
          `<circle cx="58" cy="0" r="5.5" fill="${CLAWD_ORANGE}"/></g></g>`,
        actor: clawd({ x: 30, eyes: 'up', motion: 'breathe' }),
        front: '',
      }
    }

    case 'delegating': {
      const card = (x: number, begin: string) =>
        `<g><animateTransform attributeName="transform" type="translate" dur="2.4s" repeatCount="indefinite" values="0 0;0 -5;0 0" begin="${begin}"/>` +
        `<rect x="${x}" y="96" width="30" height="22" rx="5" fill="${PAPER}" stroke="${accent}" stroke-width="2"/>` +
        `<path d="M${x + 6} 107l4 4l8 -8" fill="none" stroke="${accent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>`
      const wire = (d: string) =>
        `<path d="${d}" fill="none" stroke="${accent}" stroke-width="2.5" stroke-dasharray="5 6" stroke-linecap="round">` +
        anim('stroke-dashoffset', '22;0', '0.9s') +
        `</path>`

      return {
        back: wire('M104 96C84 70 60 74 46 92') + wire('M196 96C216 70 240 74 254 92') + card(26, '0s') + card(244, '1.2s'),
        actor:
          clawd({ x: 96, eyes: 'open', motion: 'breathe' }) +
          clawd({ x: 18, eyes: 'open', motion: 'hop', scale: 0.42 }) +
          clawd({ x: 236, eyes: 'open', motion: 'hop', scale: 0.42, begin: '0.75s' }),
        front: '',
      }
    }

    case 'connecting': {
      const slab = (y: number, begin: string) =>
        `<rect x="212" y="${y}" width="64" height="20" rx="5" fill="${INK}"/>` +
        `<rect x="246" y="${y + 8}" width="22" height="4" rx="2" fill="${GREY}" opacity="0.7"/>` +
        `<circle cx="222" cy="${y + 10}" r="3" fill="${accent}">` +
        anim('opacity', '1;0.2;1', '1.1s', undefined, begin) +
        `</circle>` +
        `<circle cx="232" cy="${y + 10}" r="3" fill="#7ee787">` +
        anim('opacity', '0.2;1;0.2', '1.7s', undefined, begin) +
        `</circle>`

      return {
        back:
          slab(88, '0s') +
          slab(112, '0.3s') +
          slab(136, '0.6s') +
          `<path d="M134 134C160 96 186 160 212 122" fill="none" stroke="${accent}" stroke-width="3.5" stroke-dasharray="7 7" stroke-linecap="round">` +
          anim('stroke-dashoffset', '28;0', '0.8s') +
          `</path>` +
          `<circle cx="212" cy="122" r="5" fill="${accent}"/>`,
        actor: clawd({ x: 26, eyes: 'open', motion: 'breathe' }),
        front: `<circle cx="134" cy="134" r="5" fill="${accent}"/>`,
      }
    }

    case 'working':
      return {
        back: gear(212, 96, 34, 10, '6s', 1, accent) + gear(258, 136, 20, 7, '4.2s', -1, GREY),
        actor: clawd({ x: 34, eyes: 'open', motion: 'type' }),
        front: '',
      }

    case 'done': {
      const colors = [accent, '#f2b632', '#f472b6', '#4dabf7', CLAWD_ORANGE]
      let confetti = ''
      for (let i = 0; i < 14; i++) {
        const x = 26 + ((i * 53) % 250)
        const dur = n(1.8 + (i % 4) * 0.35)
        const begin = `${n(((i * 7) % 10) * 0.22)}s`
        const startY = 20 + (i % 3) * 8
        confetti +=
          `<rect x="${x}" y="${startY}" width="6" height="9" rx="1.5" fill="${colors[i % colors.length] ?? accent}" transform="rotate(${(i * 37) % 90} ${x} ${startY})">` +
          anim('y', `${startY - 30};${GROUND + 4}`, `${dur}s`, undefined, begin) +
          anim('opacity', '0;1;1;0', `${dur}s`, '0;0.1;0.8;1', begin) +
          `</rect>`
      }

      return {
        back:
          confetti +
          `<circle cx="238" cy="70" r="22" fill="${accent}">` +
          anim('r', '22;25;22', '1.2s') +
          `</circle>` +
          `<path d="M227 71l8 8l15 -16" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>`,
        actor: clawd({ x: 82, eyes: 'happy', motion: 'jump' }),
        front: '',
      }
    }

    case 'error':
      return {
        back:
          `<g>` +
          anim('opacity', '1;0.45;1', '1.2s') +
          `<path d="M236 36L266 88H206Z" fill="${accent}" stroke="${accent}" stroke-width="8" stroke-linejoin="round"/>` +
          `<rect x="233" y="50" width="6" height="22" rx="3" fill="#fff"/><circle cx="236" cy="80" r="3.6" fill="#fff"/></g>`,
        actor: clawd({ x: 80, eyes: 'cross', motion: 'shake' }),
        front: '',
      }

    default: {
      const steam = (x: number, begin: string) =>
        `<path d="M${x} 126c-4 -5 4 -8 0 -14" fill="none" stroke="${accent}" stroke-width="2.4" stroke-linecap="round" opacity="0">` +
        anim('opacity', '0;0.8;0', '2.6s', undefined, begin) +
        `<animateTransform attributeName="transform" type="translate" dur="2.6s" repeatCount="indefinite" values="0 4;0 -6" begin="${begin}"/>` +
        `</path>`

      return {
        back: '',
        actor: clawd({ x: 84, eyes: 'open', motion: 'breathe' }),
        front:
          steam(222, '0s') +
          steam(232, '1.3s') +
          `<path d="M240 140h6a6 6 0 0 1 0 12h-6" fill="none" stroke="${MUG}" stroke-width="3.5"/>` +
          `<path d="M212 132h30v20a6 6 0 0 1 -6 6h-18a6 6 0 0 1 -6 -6Z" fill="${MUG}"/>` +
          `<rect x="216" y="136" width="5" height="12" rx="2.5" fill="#fff" opacity="0.35"/>`,
      }
    }
  }
}

/** The stage for a mood. Same mood, same markup: a redraw keeps the motion running. */
export function sceneSvg(mood: BuddyMood): string {
  const { accent } = MOODS[mood]
  const { back, actor, front } = scene(mood, accent)

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${STAGE_W}" height="${STAGE_H}" viewBox="0 0 ${STAGE_W} ${STAGE_H}">` +
    `<rect x="1" y="1" width="${STAGE_W - 2}" height="${STAGE_H - 2}" rx="20" fill="${accent}" opacity="0.1"/>` +
    `<rect x="22" y="${GROUND}" width="${STAGE_W - 44}" height="2.5" rx="1.25" fill="${accent}" opacity="0.35"/>` +
    `<g><animate attributeName="opacity" from="0" to="1" dur="0.25s" fill="freeze"/>${back}${actor}${front}</g>` +
    `</svg>`
  )
}

export function sceneAlt(mood: BuddyMood, detail: string): string {
  return detail ? `${MOODS[mood].scene}: ${detail}` : MOODS[mood].scene
}

// ---- terminal ----

const LOGO = [' ▐▛███▜▌ ', '▝▜█████▛▘', '  ▘▘ ▝▝  '] as const
const LOGO_HAPPY = [' ▐▀███▀▌ ', '▝▜█████▛▘', '  ▘▘ ▝▝  '] as const

const PROPS: Record<BuddyMood, ReadonlyArray<readonly [string, string, string]>> = {
  idle: [
    ['', '', '  ▟▙ '],
    ['', '  ~  ', '  ▟▙ '],
  ],
  thinking: [
    ['  ○      ', ' °       ', ''],
    ['  ○ ·    ', ' °       ', ''],
    ['  ○ · ·  ', ' °       ', ''],
    ['  ○ · · ·', ' °       ', ''],
  ],
  writing: [
    [' ╭──────╮', ' │ ━━   │', ' ▂▃▂▃▂▃▂'],
    [' ╭──────╮', ' │ ━━━━ │', ' ▃▂▃▂▃▂▃'],
  ],
  reading: [
    ['', ' ▕≡≡│≡≡▏', ''],
    ['', ' ▕≡≡│≡ ▏', ''],
  ],
  editing: [
    [' ┌─────┐', ' │ ━━✎ │', ' └─────┘'],
    [' ┌─────┐', ' │ ━━━✎│', ' └─────┘'],
  ],
  running: [
    [' ┌─────┐', ' │ $ ▌ │', ' └─────┘'],
    [' ┌─────┐', ' │ $   │', ' └─────┘'],
  ],
  searching: [
    ['', ' ⌕ ▫ ▫ ▫', ''],
    ['', ' ▫ ⌕ ▫ ▫', ''],
    ['', ' ▫ ▫ ⌕ ▫', ''],
    ['', ' ▫ ▫ ▫ ⌕', ''],
  ],
  browsing: [
    ['', ' ◐ ~ ~', ''],
    ['', ' ◓ ~ ~', ''],
    ['', ' ◑ ~ ~', ''],
    ['', ' ◒ ~ ~', ''],
  ],
  delegating: [
    ['', ' ⇢ ▝▜▛▘', ' ⇢ ▝▜▛▘'],
    ['', ' ⇢ ▝▜▛▘', '  ⇢▝▜▛▘'],
  ],
  connecting: [
    ['', ' ╌╌╌ ▣', ''],
    ['', ' ─╌╌ ▣', ''],
    ['', ' ──╌ ▣', ''],
    ['', ' ─── ▣', ''],
  ],
  working: [
    ['', ' ✻ ✢', ''],
    ['', ' ✢ ✻', ''],
  ],
  done: [
    [' ·  ✦  ·', '   ✓    ', ''],
    [' ✦  ·  ✦', '   ✓    ', ''],
  ],
  error: [
    ['', '   !   ', ''],
    ['', '  ⚠    ', ''],
  ],
}

/** The terminal's three rows for a mood: the logo, then the prop's frame for this tick. */
export function sceneRows(mood: BuddyMood, tick: number): Array<{ logo: string; prop: string }> {
  const frames = PROPS[mood]
  const frame = frames[Math.abs(tick) % frames.length] ?? ['', '', '']
  const logo = mood === 'done' ? LOGO_HAPPY : LOGO

  return logo.map((row, i) => ({ logo: row, prop: frame[i] ?? '' }))
}
