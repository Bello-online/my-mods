import type { BrainPhase, BrainState } from '../types'
import { PHASES, clip } from './phases'

const W = 320
const H = 230
const CX = 160
const CY = 104

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}

function arc(r: number, from: number, to: number): string {
  const [x1, y1] = polar(r, from)
  const [x2, y2] = polar(r, to)
  const large = to - from > 180 ? 1 : 0
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

function spin(seconds: number, reverse = false): string {
  const from = reverse ? 360 : 0
  const to = reverse ? 0 : 360
  return `<animateTransform attributeName="transform" type="rotate" from="${from} ${CX} ${CY}" to="${to} ${CX} ${CY}" dur="${seconds}s" repeatCount="indefinite"/>`
}

/** Three tilted orbits that tumble at different rates: the gyroscope that gives the HUD its depth. */
function gyro(color: string, dim: string, tempo: number): string {
  return [0, 60, 120]
    .map((tilt, i) => {
      const dur = (tempo * (1.3 + i * 0.5)).toFixed(1)
      const tumble = (tempo * (0.9 + i * 0.35)).toFixed(1)
      return `<g transform="rotate(${tilt} ${CX} ${CY})">
  <animateTransform attributeName="transform" type="rotate" from="${tilt} ${CX} ${CY}" to="${tilt + (i % 2 ? -360 : 360)} ${CX} ${CY}" dur="${dur}s" repeatCount="indefinite"/>
  <ellipse cx="${CX}" cy="${CY}" rx="94" ry="30" fill="none" stroke="${i === 0 ? color : dim}" stroke-width="${i === 0 ? 1.1 : 0.8}" opacity="${i === 0 ? 0.7 : 0.55}" stroke-dasharray="${i === 2 ? '3 4' : 'none'}">
    <animate attributeName="ry" values="30;94;30" dur="${tumble}s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
    <set attributeName="stroke" to="#ffffff" begin="mouseover" end="mouseout"/>
  </ellipse>
  <circle r="3" fill="${color}">
    <animateMotion dur="${(tempo * 0.8 + i).toFixed(1)}s" repeatCount="indefinite" path="M${CX + 94} ${CY} A94 30 0 1 1 ${CX - 94} ${CY} A94 30 0 1 1 ${CX + 94} ${CY}"/>
    <animate attributeName="r" values="1.5;3.5;1.5" dur="${(tempo * 0.8 + i).toFixed(1)}s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.3;1;0.3" dur="${(tempo * 0.8 + i).toFixed(1)}s" repeatCount="indefinite"/>
  </circle>
</g>`
    })
    .join('')
}

/** The HUD rings every phase shares. */
function rings(color: string, dim: string, tempo: number, prev: string): string {
  const ticks: string[] = []
  for (let i = 0; i < 36; i++) {
    const long = i % 3 === 0
    const [x1, y1] = polar(long ? 56 : 59, i * 10)
    const [x2, y2] = polar(63, i * 10)
    ticks.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${dim}" stroke-width="${long ? 1.4 : 0.8}"/>`,
    )
  }
  const morph = `<animate attributeName="stroke" from="${prev}" to="${color}" dur="0.7s" fill="freeze"/>`
  return `
<g opacity="0.9">
  ${gyro(color, dim, tempo)}
  <g>${spin(tempo)}
    <path d="${arc(88, 0, 110)}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round">${morph}</path>
    <path d="${arc(88, 150, 200)}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" opacity="0.6">${morph}</path>
    <path d="${arc(88, 240, 330)}" fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round" opacity="0.5">${morph}</path>
  </g>
  <g>${spin(tempo * 1.7, true)}
    <path d="${arc(74, 20, 160)}" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.55">${morph}</path>
    <path d="${arc(74, 200, 300)}" fill="none" stroke="${color}" stroke-width="4" opacity="0.35" stroke-linecap="round">${morph}</path>
  </g>
  <g>${spin(tempo * 3)}${ticks.join('')}</g>
</g>`
}

/** The neural core: a pulsing centre with nodes that fire. */
function core(color: string, dim: string, phase: BrainPhase, prev: string, titles: string[]): string {
  const nodes: string[] = []
  const links: string[] = []
  const fast = phase === 'thinking' || phase === 'running' || phase === 'editing'
  const n = 8
  for (let i = 0; i < n; i++) {
    const [x, y] = polar(42, i * (360 / n) + 22)
    const [nx, ny] = polar(42, ((i + 1) % n) * (360 / n) + 22)
    const begin = ((i * 0.37) % 2).toFixed(2)
    const dur = fast ? 1.1 : 2.6
    const travel = (dur * 1.3).toFixed(2)
    links.push(
      `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${dim}" stroke-width="0.8"/>`,
    )
    links.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${color}" stroke-width="0.9" opacity="0.15">
      <animate attributeName="opacity" values="0.1;0.7;0.1" dur="${(dur * 1.4).toFixed(2)}s" begin="${begin}s" repeatCount="indefinite"/></line>`)
    const title = titles[i]
    nodes.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${title ? 3.4 : 2.6}" fill="${color}" stroke="${title ? '#ffffff' : 'none'}" stroke-width="0.8">${title ? `<title>${esc(title)}</title>` : ''}
      <set attributeName="r" to="7" begin="mouseover" end="mouseout"/>
      <set attributeName="fill" to="#ffffff" begin="mouseover" end="mouseout"/>
      <animate attributeName="r" values="2.2;4.2;2.2" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.5;1;0.5" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></circle>`)
    nodes.push(`<circle r="1.4" fill="#ffffff" opacity="0.9">
      <animateMotion dur="${travel}s" begin="${begin}s" repeatCount="indefinite" path="M${x.toFixed(1)} ${y.toFixed(1)} L${CX} ${CY}"/>
      <animate attributeName="opacity" values="0;1;0" dur="${travel}s" begin="${begin}s" repeatCount="indefinite"/></circle>`)
  }
  const breath = phase === 'idle' ? 4.5 : fast ? 1.2 : 2.2
  return `
<g>
  ${links.join('')}
  <circle cx="${CX}" cy="${CY}" r="34" fill="url(#glow)" opacity="0.8">
    <animate attributeName="r" values="30;38;30" dur="${breath}s" repeatCount="indefinite"/>
  </circle>
  <circle cx="${CX}" cy="${CY}" r="16" fill="url(#coreGrad)" stroke="${color}" stroke-width="1.5">
    <animate attributeName="stroke" from="${prev}" to="${color}" dur="0.7s" fill="freeze"/>
    <animate attributeName="r" values="15;18;15" dur="${breath}s" repeatCount="indefinite"/>
  </circle>
  <circle cx="${CX}" cy="${CY}" r="6" fill="#ffffff" opacity="0.9">
    <animate attributeName="opacity" values="0.6;1;0.6" dur="${breath}s" repeatCount="indefinite"/>
  </circle>
  ${nodes.join('')}
</g>`
}

function linesOfText(color: string, dim: string): string {
  const rows: string[] = []
  for (let i = 0; i < 6; i++) {
    const w = 22 + ((i * 13) % 22)
    rows.push(`<rect x="${CX + 76}" y="${CY - 40 + i * 12}" width="${w}" height="3" rx="1.5" fill="${i % 2 ? dim : color}" opacity="0.6">
  <animate attributeName="opacity" values="0.2;0.8;0.2" dur="1.8s" begin="${(i * 0.3).toFixed(1)}s" repeatCount="indefinite"/>
</rect>`)
  }
  return rows.join('')
}

/** What each phase adds on top of the brain. */
function overlay(phase: BrainPhase, color: string, dim: string): string {
  switch (phase) {
    case 'reading':
      return `
<g clip-path="url(#disc)">
  <rect x="${CX - 70}" y="${CY - 70}" width="140" height="10" fill="${color}" opacity="0.35">
    <animate attributeName="y" from="${CY - 72}" to="${CY + 66}" dur="1.8s" repeatCount="indefinite"/>
  </rect>
  <line x1="${CX - 70}" x2="${CX + 70}" y1="${CY - 62}" y2="${CY - 62}" stroke="${color}" stroke-width="1.2" opacity="0.9">
    <animate attributeName="y1" from="${CY - 72}" to="${CY + 66}" dur="1.8s" repeatCount="indefinite"/>
    <animate attributeName="y2" from="${CY - 72}" to="${CY + 66}" dur="1.8s" repeatCount="indefinite"/>
  </line>
</g>
${linesOfText(color, dim)}`

    case 'editing':
      return `
<g transform="translate(${CX - 44} ${CY + 60})">
  <path d="M0 0 Q 12 -10 24 0 T 48 0 T 72 0 T 88 0" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-dasharray="120" stroke-dashoffset="120">
    <animate attributeName="stroke-dashoffset" from="120" to="0" dur="1.6s" repeatCount="indefinite"/>
  </path>
  <rect x="86" y="-8" width="2" height="12" fill="${color}">
    <animate attributeName="opacity" values="1;0;1" dur="0.9s" repeatCount="indefinite"/>
  </rect>
</g>`

    case 'running':
      return [0, 0.7, 1.4]
        .map(
          b => `<circle cx="${CX}" cy="${CY}" r="30" fill="none" stroke="${color}" stroke-width="1.5" opacity="0">
  <animate attributeName="r" from="28" to="96" dur="2.1s" begin="${b}s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.8;0" dur="2.1s" begin="${b}s" repeatCount="indefinite"/>
</circle>`,
        )
        .join('')

    case 'searching': {
      const [x, y] = polar(96, 0)
      const [ex, ey] = polar(96, 40)
      const blips = (
        [
          [62, 35],
          [40, 150],
          [75, 250],
          [55, 310],
        ] as const
      )
        .map(([r, a]) => {
          const [bx, by] = polar(r, a)
          const begin = ((a / 360) * 2.4).toFixed(2)
          return `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="2.5" fill="${color}" opacity="0">
  <animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="${begin}s" repeatCount="indefinite"/>
  <animate attributeName="r" values="1;4;1" dur="2.4s" begin="${begin}s" repeatCount="indefinite"/>
</circle>`
        })
        .join('')
      return `
<g>${spin(2.4)}
  <path d="M${CX} ${CY} L${x.toFixed(1)} ${y.toFixed(1)} A96 96 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)} Z" fill="url(#sweep)" opacity="0.55"/>
  <line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="1.5" opacity="0.9"/>
</g>${blips}`
    }

    case 'web': {
      const lat = [-50, -25, 0, 25, 50]
        .map(
          d =>
            `<ellipse cx="${CX}" cy="${CY + d}" rx="${Math.sqrt(96 * 96 - d * d).toFixed(1)}" ry="${(Math.abs(d) / 6).toFixed(1)}" fill="none" stroke="${dim}" stroke-width="0.8"/>`,
        )
        .join('')
      const lon = [0, 1, 2]
        .map(
          i => `<ellipse cx="${CX}" cy="${CY}" rx="96" ry="96" fill="none" stroke="${color}" stroke-width="0.9" opacity="0.5">
  <animate attributeName="rx" values="96;4;96" dur="4.5s" begin="${(i * 1.5).toFixed(1)}s" repeatCount="indefinite"/>
</ellipse>`,
        )
        .join('')
      return `<g opacity="0.8">${lat}${lon}</g>`
    }

    case 'delegating':
      return [0, 120, 240]
        .map(
          a => `<g>${spin(6)}
  <g transform="rotate(${a} ${CX} ${CY})">
    <line x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY - 100}" stroke="${dim}" stroke-width="0.8" stroke-dasharray="3 3"/>
    <circle cx="${CX}" cy="${CY - 100}" r="6" fill="none" stroke="${color}" stroke-width="1.5">
      <animate attributeName="r" values="5;8;5" dur="1.6s" repeatCount="indefinite"/>
    </circle>
    <circle cx="${CX}" cy="${CY - 100}" r="2" fill="${color}"/>
  </g>
</g>`,
        )
        .join('')

    case 'responding': {
      const bars: string[] = []
      for (let i = 0; i < 17; i++) {
        const x = CX - 64 + i * 8
        const h = 4 + ((i * 7) % 11)
        const dur = (0.6 + (i % 4) * 0.15).toFixed(2)
        bars.push(`<rect x="${x}" y="${CY + 58}" width="4" height="${h}" rx="1.5" fill="${color}" opacity="0.8">
  <animate attributeName="height" values="${h};${h + 12};${h}" dur="${dur}s" repeatCount="indefinite"/>
  <animate attributeName="y" values="${CY + 58};${CY + 52};${CY + 58}" dur="${dur}s" repeatCount="indefinite"/>
</rect>`)
      }
      return bars.join('')
    }

    case 'done':
      return `
<path d="M${CX - 14} ${CY + 1} L${CX - 4} ${CY + 11} L${CX + 16} ${CY - 11}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="60" stroke-dashoffset="60">
  <animate attributeName="stroke-dashoffset" from="60" to="0" dur="0.6s" begin="0.2s" fill="freeze"/>
</path>
<circle cx="${CX}" cy="${CY}" r="20" fill="none" stroke="${color}" stroke-width="2" opacity="0">
  <animate attributeName="r" from="20" to="100" dur="1.2s" begin="0.1s" fill="freeze"/>
  <animate attributeName="opacity" values="0.9;0" dur="1.2s" begin="0.1s" fill="freeze"/>
</circle>`

    case 'error':
      return `
<path d="M${CX - 11} ${CY - 11} L${CX + 11} ${CY + 11} M${CX + 11} ${CY - 11} L${CX - 11} ${CY + 11}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
<circle cx="${CX}" cy="${CY}" r="60" fill="none" stroke="${color}" stroke-width="2" opacity="0.6">
  <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1s" repeatCount="indefinite"/>
</circle>`

    case 'thinking':
      return [0, 1, 2, 3, 4, 5]
        .map(i => {
          const a = i * 60 + 10
          const [x1, y1] = polar(42, a)
          const [x2, y2] = polar(42, a + 120)
          const b1 = (i * 0.45).toFixed(2)
          const b2 = (i * 0.45 + 2.7).toFixed(2)
          return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="1" opacity="0">
  <animate attributeName="opacity" values="0;0.9;0" dur="0.5s" begin="${b1}s;${b2}s" repeatCount="indefinite"/>
</line>`
        })
        .join('')

    default:
      return ''
  }
}

/** Build the whole brain as one SVG document for the given state. */
export type BrainSvgOptions = { paused?: boolean; speed?: 1 | 2 | 3 }

export function brainSvg(state: BrainState, now: number, options: BrainSvgOptions = {}): string {
  const style = PHASES[state.phase]
  const prevStyle = PHASES[state.prevPhase] ?? style
  const { color, dim } = style
  const tempo = style.tempo * (options.speed === 1 ? 1.8 : options.speed === 3 ? 0.5 : 1)
  const titles = state.recent
    .slice(-8)
    .map(r => `${r.tool} · ${r.label}${r.ms === undefined ? '' : ` · ${Math.round(r.ms)}ms`}`)
  const label = style.label.toUpperCase()
  const detail = clip(state.detail, 44)
  const elapsed = state.turnStartedAt && state.phase !== 'idle' ? Math.max(0, now - state.turnStartedAt) : 0
  const secs = Math.round(elapsed / 1000)
  const elapsedText =
    state.phase === 'idle' ? '' : secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`
  const tools = state.toolCount ? `${state.toolCount} tool${state.toolCount === 1 ? '' : 's'}` : ''
  // the verdict marks sit on the core; every other overlay sits beneath it
  const onTop = state.phase === 'done' || state.phase === 'error'
  const layer = overlay(state.phase, color, dim)
  const dx = (W * 0.05).toFixed(1)
  const dy = (H * 0.05).toFixed(1)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
<defs>
  <radialGradient id="glow"><stop offset="0%" stop-color="${color}" stop-opacity="0.55"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient>
  <radialGradient id="coreGrad"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="55%" stop-color="${color}" stop-opacity="0.9"/><stop offset="100%" stop-color="${dim}" stop-opacity="1"/></radialGradient>
  <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${color}" stop-opacity="0"/><stop offset="100%" stop-color="${color}" stop-opacity="0.7"/></linearGradient>
  <clipPath id="disc"><circle cx="${CX}" cy="${CY}" r="70"/></clipPath>
</defs>
<g>
  <animateTransform attributeName="transform" type="scale" from="0.9" to="1" dur="0.5s" fill="freeze" additive="sum" calcMode="spline" keySplines="0.2 0.8 0.2 1"/>
  <animateTransform attributeName="transform" type="translate" from="${dx} ${dy}" to="0 0" dur="0.5s" fill="freeze" additive="sum" calcMode="spline" keySplines="0.2 0.8 0.2 1"/>
  <animate attributeName="opacity" from="0" to="1" dur="0.45s" fill="freeze"/>
  ${rings(color, dim, tempo, prevStyle.color)}
  ${onTop ? '' : layer}
  ${core(color, dim, state.phase, prevStyle.color, titles)}
  ${onTop ? layer : ''}
  <text x="${CX}" y="${H - 22}" text-anchor="middle" font-size="11" letter-spacing="3" fill="${color}" font-weight="700">${esc(label)}<animate attributeName="fill" from="${prevStyle.color}" to="${color}" dur="0.7s" fill="freeze"/></text>
  <text x="${CX}" y="${H - 8}" text-anchor="middle" font-size="9" fill="${dim}" opacity="0.95">${esc(detail)}</text>
  <text x="${W - 8}" y="14" text-anchor="end" font-size="9" fill="${dim}">${esc(elapsedText)}</text>
  <text x="8" y="14" font-size="9" fill="${dim}">${esc(tools)}</text>
</g>
</svg>`
  // Paused: every animation is dropped, so the frame stands still (hover reactions stay).
  return options.paused ? svg.replace(/<animate(?:Transform|Motion)?\s[^>]*\/>/g, '') : svg
}

// ---------------------------------------------------------------------------
// The 3D sphere as SVG: for surfaces that draw vector graphics but no Client.
//
// A sphere turning about its vertical axis moves every point along an ellipse
// on screen, so each point is one SMIL motion along its own ellipse, phased by
// its longitude, with its radius and opacity swelling as it comes to the front.
// ---------------------------------------------------------------------------

const SPHERE_R = 78
const TILT = 0.42 // how far the camera looks down on the sphere: ry = rx * TILT
const NODE_SEATS = 8

/** `n` points spread evenly over the unit sphere: [x, y, z] with y up. */
function fibonacci(n: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const a = golden * i
    out.push([Math.cos(a) * r, y, Math.sin(a) * r])
  }
  return out
}

/** One point of the sphere: a circle riding its latitude's ellipse, swelling at the front. */
function orbiter(
  p: [number, number, number],
  dur: number,
  fill: string,
  size: [number, number],
  opacity: [number, number],
  extra = '',
): string {
  const [x, y, z] = p
  const rx = Math.max(0.5, SPHERE_R * Math.sqrt(x * x + z * z))
  const ry = rx * TILT
  const cy = CY - SPHERE_R * y * 0.92
  // longitude phases the motion; the path starts at the back of the ring
  const phase = (Math.atan2(z, x) + Math.PI) / (Math.PI * 2)
  const begin = (-phase * dur).toFixed(2)
  const top = (cy - ry).toFixed(1)
  const bottom = (cy + ry).toFixed(1)
  const path = `M${CX} ${top} A${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 1 ${CX} ${bottom} A${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 1 ${CX} ${top}`
  return `<circle r="${size[0]}" fill="${fill}" opacity="${opacity[0]}">${extra}
  <animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${path}"/>
  <animate attributeName="r" values="${size[0]};${size[1]};${size[0]}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="${opacity[0]};${opacity[1]};${opacity[0]}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
</circle>`
}

/** The sphere's points, its recent-tool nodes, and the tracer rings. */
function sphere(color: string, dim: string, tempo: number, phase: BrainPhase, titles: string[]): string {
  const turn = Math.max(4, tempo * 0.9)
  const shell = fibonacci(96)
    .map(p => orbiter(p, turn, color, [0.9, 2.4], [0.18, 0.95]))
    .join('')
  // a few latitude rings, drawn as thin ellipses, give the volume its edges
  const bands = [-0.72, -0.36, 0, 0.36, 0.72]
    .map(y => {
      const rx = SPHERE_R * Math.sqrt(1 - y * y)
      return `<ellipse cx="${CX}" cy="${(CY - SPHERE_R * y * 0.92).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${(rx * TILT).toFixed(1)}" fill="none" stroke="${dim}" stroke-width="0.6" opacity="0.55"/>`
    })
    .join('')
  // the recent tool calls ride the shell as larger ringed nodes with tooltips and hover flare
  const nodes = fibonacci(NODE_SEATS)
    .map(([x, y, z], i) => {
      const title = titles[i]
      if (!title) return ''
      const extra = `<title>${esc(title)}</title><set attributeName="r" to="7" begin="mouseover" end="mouseout"/><set attributeName="fill" to="#ffffff" begin="mouseover" end="mouseout"/>`
      return orbiter([x * 1.06, y * 1.06, z * 1.06], turn, color, [2.6, 4.4], [0.45, 1], extra)
    })
    .join('')
  const spark =
    phase === 'thinking' || phase === 'running'
      ? fibonacci(14)
          .map(p => orbiter(p, Math.max(2.5, turn * 0.35), '#ffffff', [0.6, 1.8], [0, 0.9]))
          .join('')
      : ''
  return `${bands}${shell}${nodes}${spark}`
}

/** The 3D sphere view as one SVG document: the sphere, the core, the gyro and the phase overlay. */
export function brainSphereSvg(state: BrainState, now: number, options: BrainSvgOptions = {}): string {
  const style = PHASES[state.phase]
  const prevStyle = PHASES[state.prevPhase] ?? style
  const { color, dim } = style
  const tempo = style.tempo * (options.speed === 1 ? 1.8 : options.speed === 3 ? 0.5 : 1)
  const titles = state.recent
    .slice(-NODE_SEATS)
    .map(r => `${r.tool} · ${r.label}${r.ms === undefined ? '' : ` · ${Math.round(r.ms)}ms`}`)
  const label = style.label.toUpperCase()
  const detail = clip(state.detail, 44)
  const elapsed = state.turnStartedAt && state.phase !== 'idle' ? Math.max(0, now - state.turnStartedAt) : 0
  const secs = Math.round(elapsed / 1000)
  const elapsedText =
    state.phase === 'idle' ? '' : secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`
  const tools = state.toolCount ? `${state.toolCount} tool${state.toolCount === 1 ? '' : 's'}` : ''
  const onTop = state.phase === 'done' || state.phase === 'error'
  const layer = overlay(state.phase, color, dim)
  const breath = state.phase === 'idle' ? 4.5 : 1.8
  const dx = (W * 0.05).toFixed(1)
  const dy = (H * 0.05).toFixed(1)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
<defs>
  <radialGradient id="glow"><stop offset="0%" stop-color="${color}" stop-opacity="0.6"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient>
  <radialGradient id="coreGrad"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="55%" stop-color="${color}" stop-opacity="0.9"/><stop offset="100%" stop-color="${dim}" stop-opacity="1"/></radialGradient>
  <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${color}" stop-opacity="0"/><stop offset="100%" stop-color="${color}" stop-opacity="0.7"/></linearGradient>
  <clipPath id="disc"><circle cx="${CX}" cy="${CY}" r="70"/></clipPath>
</defs>
<g>
  <animateTransform attributeName="transform" type="scale" from="0.9" to="1" dur="0.5s" fill="freeze" additive="sum" calcMode="spline" keySplines="0.2 0.8 0.2 1"/>
  <animateTransform attributeName="transform" type="translate" from="${dx} ${dy}" to="0 0" dur="0.5s" fill="freeze" additive="sum" calcMode="spline" keySplines="0.2 0.8 0.2 1"/>
  <animate attributeName="opacity" from="0" to="1" dur="0.45s" fill="freeze"/>
  ${gyro(color, dim, tempo)}
  ${onTop ? '' : layer}
  <circle cx="${CX}" cy="${CY}" r="30" fill="url(#glow)" opacity="0.9">
    <animate attributeName="r" values="26;36;26" dur="${breath}s" repeatCount="indefinite"/>
  </circle>
  <circle cx="${CX}" cy="${CY}" r="11" fill="url(#coreGrad)" stroke="${color}" stroke-width="1.2">
    <animate attributeName="stroke" from="${prevStyle.color}" to="${color}" dur="0.7s" fill="freeze"/>
    <animate attributeName="r" values="10;13;10" dur="${breath}s" repeatCount="indefinite"/>
  </circle>
  ${sphere(color, dim, tempo, state.phase, titles)}
  ${onTop ? layer : ''}
  <text x="${CX}" y="${H - 22}" text-anchor="middle" font-size="11" letter-spacing="3" fill="${color}" font-weight="700">${esc(label)}<animate attributeName="fill" from="${prevStyle.color}" to="${color}" dur="0.7s" fill="freeze"/></text>
  <text x="${CX}" y="${H - 8}" text-anchor="middle" font-size="9" fill="${dim}" opacity="0.95">${esc(detail)}</text>
  <text x="${W - 8}" y="14" text-anchor="end" font-size="9" fill="${dim}">${esc(elapsedText)}</text>
  <text x="8" y="14" font-size="9" fill="${dim}">${esc(tools)}</text>
</g>
</svg>`
  return options.paused ? svg.replace(/<animate(?:Transform|Motion)?\s[^>]*\/>/g, '') : svg
}
