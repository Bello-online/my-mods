// The 3D brain: a surface module the pane mounts as a `Client`.
//
// It runs on the drawing thread with its own frame clock, so the sphere turns at
// frame rate without a round trip to the hooks module, and it owns the pointer
// while a drag is on, so the person can spin the brain by hand.

import type { ClientModule, ClientPointerEvent } from 'claude-code'

import type { Brain3dProps, BrainPhase } from '../types'

type Vec = [number, number, number]

type Drag = { x: number; y: number; yaw: number; pitch: number; moved: boolean }

type State = {
  t: number
  yaw: number
  pitch: number
  /** yaw velocity carried after a drag */
  spin: number
  zoom: number
  drag: Drag | null
  hover: string | null
  pointer: { x: number; y: number } | null
  /** 1 right after a phase change, decaying to 0: the burst transition */
  pulse: number
  lastPhase: BrainPhase
  flashes: number[]
  ticksSinceProps: number
  /** the latest props, for the frame clock, which closes over the first call's */
  live: Pick<Brain3dProps, 'phase' | 'tempo' | 'speed' | 'paused'>
}

type Cell = { ch: string; color: string; dim: boolean; bold: boolean; z: number }

const FRAME_MS = 70

const DEPTH_GLYPHS = ['·', '∘', '•', '●'] as const

/** Points spread evenly over the unit sphere. */
function fibonacciSphere(n: number): Vec[] {
  const out: Vec[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const a = golden * i
    out.push([Math.cos(a) * r, y, Math.sin(a) * r])
  }
  return out
}

/** A great circle in a tilted plane, as `n` points. */
function ring(n: number, tiltX: number, tiltZ: number): Vec[] {
  const out: Vec[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    out.push(rotate([Math.cos(a), 0, Math.sin(a)], tiltX, 0, tiltZ))
  }
  return out
}

function rotate([x, y, z]: Vec, ax: number, ay: number, az: number): Vec {
  // around Y, then X, then Z
  let x1 = x * Math.cos(ay) + z * Math.sin(ay)
  let z1 = -x * Math.sin(ay) + z * Math.cos(ay)
  let y1 = y
  const y2 = y1 * Math.cos(ax) - z1 * Math.sin(ax)
  const z2 = y1 * Math.sin(ax) + z1 * Math.cos(ax)
  y1 = y2
  z1 = z2
  const x3 = x1 * Math.cos(az) - y1 * Math.sin(az)
  const y3 = x1 * Math.sin(az) + y1 * Math.cos(az)
  x1 = x3
  y1 = y3
  return [x1, y1, z1]
}

const SHELL = fibonacciSphere(84)
const CORE = fibonacciSphere(26).map(([x, y, z]): Vec => [x * 0.3, y * 0.3, z * 0.3])
const RINGS: Vec[][] = [ring(40, 0.35, 0.2), ring(40, 1.2, 0.9), ring(40, 2.1, -0.7)]
/** Where the recent-tool nodes sit: eight spread points, a little outside the shell. */
const NODE_SEATS = fibonacciSphere(8).map(([x, y, z]): Vec => [x * 1.08, y * 1.08, z * 1.08])

function longitude([x, , z]: Vec): number {
  return Math.atan2(z, x)
}

function initial(props: Brain3dProps): State {
  return {
    t: 0,
    yaw: 0.6,
    pitch: 0.35,
    spin: 0,
    zoom: 1,
    drag: null,
    hover: null,
    pointer: null,
    pulse: 1,
    lastPhase: props.phase,
    flashes: [],
    ticksSinceProps: 0,
    live: { phase: props.phase, tempo: props.tempo, speed: props.speed, paused: props.paused },
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

/** Paint one frame into a cell grid: a depth-buffered projection of every point. */
function paint(props: Brain3dProps, s: State, columns: number, rows: number) {
  const grid: (Cell | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => null),
  )
  const cx = columns / 2
  const cy = rows / 2
  const radius = Math.max(3, Math.min(columns / 4.6, rows / 2.3)) * s.zoom
  const cameraD = 3.2
  const burst = 1 + 0.28 * s.pulse
  const phase = props.phase
  const t = s.t
  const nodeHits: Array<{ id: string; x: number; y: number; z: number }> = []

  const put = (
    p: Vec,
    kind: 'shell' | 'core' | 'ring' | 'node' | 'satellite',
    extra?: { id?: string; hot?: boolean },
  ) => {
    const [x, y, z] = rotate(p, s.pitch, s.yaw, 0)
    const scale = cameraD / (cameraD - z)
    const sx = Math.round(cx + x * radius * 2.15 * scale)
    const sy = Math.round(cy - y * radius * scale)
    if (sx < 0 || sy < 0 || sx >= columns || sy >= rows) return
    const row = grid[sy]
    if (!row) return
    const here = row[sx]
    if (here && here.z > z) return
    const depth = (z + 1) / 2 // 0 far, 1 near
    let ch: string
    let color = props.color
    let dim = depth < 0.4
    let bold = depth > 0.75
    switch (kind) {
      case 'core':
        ch = depth > 0.5 ? '●' : '•'
        color = props.color
        dim = false
        bold = true
        break
      case 'ring':
        ch = depth > 0.6 ? '◦' : '·'
        color = props.dim
        dim = depth < 0.6
        bold = false
        break
      case 'node':
        ch = '◉'
        color = extra?.hot ? '#ffffff' : props.color
        dim = false
        bold = true
        if (extra?.id) nodeHits.push({ id: extra.id, x: sx, y: sy, z })
        break
      case 'satellite':
        ch = '◆'
        dim = false
        bold = true
        break
      default:
        ch = DEPTH_GLYPHS[Math.min(3, Math.floor(depth * 4))] ?? '·'
        if (extra?.hot) {
          ch = '✦'
          color = '#ffffff'
          dim = false
          bold = true
        }
    }
    row[sx] = { ch, color, dim, bold, z }
  }

  // --- the shell, with the phase's own signature on it -------------------
  const scanLevel = Math.sin(t * 0.12)
  const sweep = (t * 0.22) % (Math.PI * 2)
  const fill = (t * 2) % (SHELL.length + 30)
  SHELL.forEach((p, i) => {
    let hot = false
    switch (phase) {
      case 'reading':
        hot = Math.abs(p[1] - scanLevel) < 0.1
        break
      case 'searching': {
        let d = Math.abs(longitude(p) + Math.PI - sweep)
        d = Math.min(d, Math.PI * 2 - d)
        hot = d < 0.28
        break
      }
      case 'editing':
        hot = i < fill
        break
      case 'responding':
        hot = Math.sin(longitude(p) * 3 - t * 0.35) > 0.82
        break
      case 'web':
        hot = Math.abs(p[1]) < 0.06 || Math.abs(Math.sin(longitude(p) - t * 0.1)) < 0.06
        break
      case 'thinking':
        hot = s.flashes.includes(i)
        break
      case 'done':
        hot = s.pulse > 0.3
        break
      default:
        hot = false
    }
    const r = phase === 'running' ? burst * (1 + 0.12 * Math.sin(t * 0.45 + p[1] * 3)) : burst
    put([p[0] * r, p[1] * r, p[2] * r], 'shell', { hot })
  })

  // --- the gyro rings, each turning at its own pace -----------------------
  RINGS.forEach((pts, k) => {
    const speed = (0.05 + k * 0.03) * (phase === 'idle' ? 0.3 : phase === 'running' ? 2.2 : 1)
    const a = t * speed * (k % 2 ? -1 : 1)
    pts.forEach(p => put(rotate(p, 0, a, 0), 'ring'))
  })

  // --- the core ------------------------------------------------------------
  const beat = 1 + 0.18 * Math.sin(t * (phase === 'idle' ? 0.12 : 0.4)) + 0.2 * s.pulse
  CORE.forEach(p => put(rotate([p[0] * beat, p[1] * beat, p[2] * beat], 0, -t * 0.15, 0), 'core'))

  // --- the recent tool calls as nodes on the shell ------------------------
  props.nodes.slice(-NODE_SEATS.length).forEach((node, i) => {
    const seat = NODE_SEATS[i]
    if (!seat) return
    put([seat[0] * burst, seat[1] * burst, seat[2] * burst], 'node', {
      id: node.id,
      hot: s.hover === node.id,
    })
  })

  // --- satellites while delegating ----------------------------------------
  if (phase === 'delegating') {
    for (let k = 0; k < 3; k++) {
      const a = t * 0.2 + (k * Math.PI * 2) / 3
      put(rotate([Math.cos(a) * 1.5, 0.25 * Math.sin(a * 2), Math.sin(a) * 1.5], 0.4, 0, 0), 'satellite')
    }
  }

  // --- the verdict marks ---------------------------------------------------
  if (phase === 'error') {
    const row = grid[Math.round(cy)]
    if (row) row[Math.round(cx)] = { ch: '✖', color: '#ffffff', dim: false, bold: true, z: 9 }
  }
  if (phase === 'done' && s.pulse < 0.6) {
    const row = grid[Math.round(cy)]
    if (row) row[Math.round(cx)] = { ch: '✔', color: '#ffffff', dim: false, bold: true, z: 9 }
  }

  return { grid, nodeHits }
}

const Brain3d: ClientModule<Brain3dProps, State> = (props, surface) => {
  const { Box, Text } = surface.elements

  if (surface.state === undefined) {
    // First call: seed the state and start the clock, the pointer and the keys, once.
    surface.setState(initial(props))
    surface.every(FRAME_MS, () => {
      const s = surface.state
      if (!s) return
      const live = s.live
      const moving = !live.paused && !s.drag
      const rate =
        (0.012 + 0.03 / Math.max(2, live.tempo)) * (live.speed === 1 ? 0.5 : live.speed === 3 ? 2 : 1)
      const flashes = s.flashes.filter(() => Math.random() > 0.25)
      if (live.phase === 'thinking' && Math.random() < 0.35)
        flashes.push(Math.floor(Math.random() * SHELL.length))
      surface.setState({
        ...s,
        t: s.t + 1,
        yaw: s.yaw + (moving ? rate : 0) + s.spin,
        spin: s.spin * 0.9,
        pulse: Math.max(0, s.pulse - 0.1),
        flashes,
        ticksSinceProps: s.ticksSinceProps + 1,
      })
    })
    surface.onPointer((e: ClientPointerEvent) => {
      const s = surface.state
      if (!s) return
      if (e.type === 'down' && e.button === 'left') {
        surface.setState({
          ...s,
          drag: { x: e.x, y: e.y, yaw: s.yaw, pitch: s.pitch, moved: false },
          spin: 0,
        })
        return
      }
      if (e.type === 'move') {
        if (s.drag) {
          const dx = e.x - s.drag.x
          const dy = e.y - s.drag.y
          surface.setState({
            ...s,
            yaw: s.drag.yaw + dx * 0.07,
            pitch: clamp(s.drag.pitch + dy * 0.14, -1.4, 1.4),
            spin: dx === 0 ? s.spin : clamp(dx * 0.004, -0.06, 0.06),
            drag: { ...s.drag, moved: s.drag.moved || Math.abs(dx) + Math.abs(dy) > 0 },
          })
        } else {
          surface.setState({ ...s, pointer: { x: e.x, y: e.y } })
        }
        return
      }
      if (e.type === 'up') {
        if (s.drag && !s.drag.moved && s.hover) surface.post({ kind: 'node', id: s.hover })
        surface.setState({ ...s, drag: null })
        return
      }
      if (e.type === 'leave') surface.setState({ ...s, pointer: null, hover: null })
    })
    surface.onKey(e => {
      const s = surface.state
      if (!s) return
      switch (e.key) {
        case 'left':
          surface.setState({ ...s, yaw: s.yaw - 0.25 })
          break
        case 'right':
          surface.setState({ ...s, yaw: s.yaw + 0.25 })
          break
        case 'up':
          surface.setState({ ...s, pitch: clamp(s.pitch - 0.2, -1.4, 1.4) })
          break
        case 'down':
          surface.setState({ ...s, pitch: clamp(s.pitch + 0.2, -1.4, 1.4) })
          break
        case '+':
        case '=':
          surface.setState({ ...s, zoom: clamp(s.zoom * 1.15, 0.5, 2.2) })
          break
        case '-':
          surface.setState({ ...s, zoom: clamp(s.zoom / 1.15, 0.5, 2.2) })
          break
        case ' ':
          surface.post({ kind: 'toggle-pause' })
          break
        case 'r':
          surface.setState({ ...initial(props), ...{ live: s.live }, t: s.t, pulse: 0 })
          break
        default:
          break
      }
    })
    return <Text dimColor>warming up…</Text>
  }

  const s = surface.state
  const liveChanged =
    s.live.phase !== props.phase ||
    s.live.tempo !== props.tempo ||
    s.live.speed !== props.speed ||
    s.live.paused !== props.paused
  if (liveChanged) {
    // New props the clock must see; a phase change also bursts, then settles into the new colour.
    const changed = s.lastPhase !== props.phase
    surface.setState({
      ...s,
      live: { phase: props.phase, tempo: props.tempo, speed: props.speed, paused: props.paused },
      lastPhase: props.phase,
      pulse: changed ? 1 : s.pulse,
      flashes: changed ? [] : s.flashes,
      ticksSinceProps: changed ? 0 : s.ticksSinceProps,
    })
  }

  const columns = surface.columns
  const rows = surface.rows
  if (columns < 12 || rows < 5) return <Text dimColor>{props.label}</Text>

  const bodyRows = rows - 2
  const { grid, nodeHits } = paint(props, s, columns, bodyRows)

  // Which node is under the pointer, if any (nearest within a cell and a half).
  let hover: string | null = null
  if (s.pointer) {
    let best = 2.5
    for (const n of nodeHits) {
      const d = Math.abs(n.x - s.pointer.x) + Math.abs(n.y - s.pointer.y) * 2
      if (d < best) {
        best = d
        hover = n.id
      }
    }
  }
  if (hover !== s.hover) surface.setState({ ...s, hover })

  const hovered = props.nodes.find(n => n.id === (hover ?? s.hover))
  const elapsed = props.elapsedMs > 0 ? fmtElapsed(props.elapsedMs + s.ticksSinceProps * FRAME_MS) : ''
  const paused = props.paused

  const lines = grid.map(row => {
    const runs: Array<{ text: string; color: string; dim: boolean; bold: boolean }> = []
    for (const cell of row) {
      const ch = cell?.ch ?? ' '
      const color = cell?.color ?? props.dim
      const dim = cell?.dim ?? true
      const bold = cell?.bold ?? false
      const last = runs[runs.length - 1]
      if (last && last.color === color && last.dim === dim && last.bold === bold) last.text += ch
      else runs.push({ text: ch, color, dim, bold })
    }
    return runs
  })

  const title = `${props.label.toUpperCase()}${props.detail ? '  ' + props.detail : ''}`
  const titleMax = Math.max(4, columns - elapsed.length - 2)
  const shownTitle = title.length > titleMax ? title.slice(0, titleMax - 1) + '…' : title

  const footer = hovered
    ? `◉ ${hovered.tool} ${hovered.label}${hovered.ms === undefined ? '' : ' ' + fmtElapsed(hovered.ms)}`
    : paused
      ? '⏸ paused · space resumes · drag to spin'
      : `drag to spin · ←→↑↓ turn · +/- zoom · space pause${props.tools ? ` · ${props.tools} tools` : ''}`

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text color={props.color} bold>
          {shownTitle}
        </Text>
        <Text dimColor>{elapsed}</Text>
      </Box>
      {lines.map(runs => (
        <Text>
          {runs.map(run => (
            <Text color={run.color} dimColor={run.dim} bold={run.bold}>
              {run.text}
            </Text>
          ))}
        </Text>
      ))}
      <Text color={hovered ? props.color : undefined} dimColor={!hovered} wrap="truncate-end">
        {footer.length > columns ? footer.slice(0, columns - 1) + '…' : footer}
      </Text>
    </Box>
  )
}

export default Brain3d
