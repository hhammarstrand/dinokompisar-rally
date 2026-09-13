import type { Terrain } from './physics.ts'

export type TrackId = 'grotta' | 'skog' | 'moln'

export interface Waypoint {
  x: number
  y: number
}

export interface Track {
  id: TrackId
  name: string
  size: number
  /** 0 wall 1 road 2 offroad 3 boost 4 item */
  cells: Uint8Array
  start: Waypoint & { angle: number }
  waypoints: Waypoint[]
  items: Waypoint[]
  startLine: Waypoint[]
  /** 0 none 1 center dash 2 curb */
  marks: Uint8Array
  skyTop: string
  skyBot: string
  roadRgb: [number, number, number]
  offRgb: [number, number, number]
  wallRgb: [number, number, number]
  boostRgb: [number, number, number]
}

const WALL = 0
const ROAD = 1
const OFF = 2
const BOOST = 3
const ITEM = 4

export function terrainAt(t: Track, x: number, y: number): Terrain {
  const ix = x | 0
  const iy = y | 0
  if (ix < 0 || iy < 0 || ix >= t.size || iy >= t.size) return 'wall'
  const v = t.cells[iy * t.size + ix]
  if (v === ROAD) return 'road'
  if (v === OFF) return 'offroad'
  if (v === BOOST) return 'boost'
  if (v === ITEM) return 'item'
  return 'wall'
}

export function onStartLine(t: Track, x: number, y: number): boolean {
  const dx = x - t.start.x
  const dy = y - t.start.y
  const ca = Math.cos(t.start.angle)
  const sa = Math.sin(t.start.angle)
  const along = dx * ca + dy * sa
  const across = -dx * sa + dy * ca
  return Math.abs(along) < 6 && Math.abs(across) < 44
}

export function buildTrack(id: TrackId): Track {
  if (id === 'grotta') return makeGrotta()
  if (id === 'skog') return makeSkog()
  return makeMoln()
}

function stamp(cells: Uint8Array, size: number, x: number, y: number, r: number, v: number): void {
  const r2 = r * r
  const x0 = Math.max(0, (x - r) | 0)
  const y0 = Math.max(0, (y - r) | 0)
  const x1 = Math.min(size - 1, (x + r) | 0)
  const y1 = Math.min(size - 1, (y + r) | 0)
  for (let iy = y0; iy <= y1; iy++) {
    for (let ix = x0; ix <= x1; ix++) {
      const dx = ix - x
      const dy = iy - y
      if (dx * dx + dy * dy <= r2) cells[iy * size + ix] = v
    }
  }
}

function pathPoints(n: number, fn: (i: number, u: number) => Waypoint): Waypoint[] {
  const pts: Waypoint[] = []
  for (let i = 0; i < n; i++) pts.push(fn(i, i / n))
  return pts
}

function layRoad(cells: Uint8Array, size: number, pts: Waypoint[], width: number): void {
  cells.fill(OFF)
  for (const p of pts) stamp(cells, size, p.x, p.y, width + 16, WALL)
  for (const p of pts) stamp(cells, size, p.x, p.y, width + 5, OFF)
  for (const p of pts) stamp(cells, size, p.x, p.y, width, ROAD)
  const edge = 18
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x < edge || y < edge || x >= size - edge || y >= size - edge) {
        cells[y * size + x] = WALL
      }
    }
  }
}

function everyNth(pts: Waypoint[], step: number, offset = 0): Waypoint[] {
  const out: Waypoint[] = []
  for (let i = offset; i < pts.length; i += step) out.push(pts[i]!)
  return out
}

function heading(pts: Waypoint[], i: number): number {
  const a = pts[i]!
  const b = pts[(i + 8) % pts.length]!
  return Math.atan2(b.y - a.y, b.x - a.x)
}

function makeStartLine(pts: Waypoint[]): Waypoint[] {
  const start = pts[0]!
  const angle = heading(pts, 0)
  const line: Waypoint[] = []
  for (let i = -8; i <= 8; i++) {
    line.push({
      x: start.x + Math.cos(angle + Math.PI / 2) * i * 5,
      y: start.y + Math.sin(angle + Math.PI / 2) * i * 5,
    })
  }
  return line
}

function finish(id: TrackId, name: string, size: number, pts: Waypoint[], cells: Uint8Array, items: Waypoint[], theme: Omit<Track, 'id' | 'name' | 'size' | 'cells' | 'start' | 'waypoints' | 'items' | 'startLine' | 'marks'>): Track {
  const start = pts[0]!
  const angle = heading(pts, 0)
  return {
    id,
    name,
    size,
    cells,
    start: { ...start, angle },
    waypoints: pts,
    items,
    startLine: makeStartLine(pts),
    marks: bakeMarks(cells, size, pts),
    ...theme,
  }
}

function bakeMarks(cells: Uint8Array, size: number, pts: Waypoint[]): Uint8Array {
  const marks = new Uint8Array(size * size)
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const n = pts[(i + 1) % pts.length]!
    const steps = Math.max(1, Math.hypot(n.x - p.x, n.y - p.y) | 0)
    for (let s = 0; s < steps; s++) {
      const x = (p.x + ((n.x - p.x) * s) / steps) | 0
      const y = (p.y + ((n.y - p.y) * s) / steps) | 0
      if (x < 0 || y < 0 || x >= size || y >= size) continue
      if (cells[y * size + x] !== ROAD) continue
      if ((i + s) % 12 < 7) marks[y * size + x] = 1
    }
  }
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x
      const v = cells[i]!
      if (v !== ROAD && v !== BOOST && v !== ITEM) continue
      const near =
        cells[i - 1] === OFF ||
        cells[i + 1] === OFF ||
        cells[i - size] === OFF ||
        cells[i + size] === OFF ||
        cells[i - 1] === WALL ||
        cells[i + 1] === WALL ||
        cells[i - size] === WALL ||
        cells[i + size] === WALL
      if (near) marks[i] = 2
    }
  }
  return marks
}

function scatter(cells: Uint8Array, size: number, pts: Waypoint[], offset: number, r: number, v: number, step: number): void {
  const cx = size / 2
  const cy = size / 2
  for (let i = 0; i < pts.length; i += step) {
    const p = pts[i]!
    const ox = p.x - cx
    const oy = p.y - cy
    const len = Math.hypot(ox, oy) || 1
    stamp(cells, size, p.x + (ox / len) * offset, p.y + (oy / len) * offset, r, v)
  }
}

function makeGrotta(): Track {
  const size = 1024
  const cx = size / 2
  const cy = size / 2
  const pts = pathPoints(400, (_i, u) => {
    const a = u * Math.PI * 2
    const pinch = 0.52 + 0.48 * Math.cos(2 * a)
    return {
      x: cx + Math.cos(a) * 390 * pinch,
      y: cy + Math.sin(a) * 200 * (0.75 + 0.35 * Math.abs(Math.cos(a))),
    }
  })
  const cells = new Uint8Array(size * size)
  layRoad(cells, size, pts, 50)
  scatter(cells, size, pts, 78, 18, WALL, 12)
  const items = everyNth(pts, 60, 10)
  for (const p of items) stamp(cells, size, p.x, p.y, 7, ITEM)
  return finish('grotta', 'Den ljusa grottan', size, pts, cells, items, {
    skyTop: '#2a1848',
    skyBot: '#e8b86a',
    roadRgb: [92, 78, 110],
    offRgb: [58, 42, 36],
    wallRgb: [28, 18, 32],
    boostRgb: [240, 196, 80],
  })
}

function makeSkog(): Track {
  const size = 1024
  const pts = pathPoints(480, (_i, u) => {
    const a = u * Math.PI * 2
    const squircle = 0.78 + 0.22 * Math.cos(4 * a)
    return {
      x: 512 + Math.cos(a) * 260 * squircle + Math.cos(a * 3) * 48,
      y: 512 + Math.sin(a) * 310 * squircle + Math.sin(a * 5) * 62,
    }
  })
  const cells = new Uint8Array(size * size)
  layRoad(cells, size, pts, 30)
  scatter(cells, size, pts, 52, 11, WALL, 8)
  const items = everyNth(pts, 50, 8)
  for (const p of items) stamp(cells, size, p.x, p.y, 7, ITEM)
  return finish('skog', 'Den mörka skogen', size, pts, cells, items, {
    skyTop: '#102010',
    skyBot: '#3d6b3a',
    roadRgb: [62, 56, 48],
    offRgb: [28, 72, 34],
    wallRgb: [12, 28, 14],
    boostRgb: [180, 220, 90],
  })
}

function makeMoln(): Track {
  const size = 1024
  const pts = pathPoints(420, (_i, u) => {
    const a = u * Math.PI * 2
    const s = Math.sin(a)
    const c = Math.cos(a)
    const sc = 1 + 0.35 * Math.sin(2 * a)
    return { x: 512 + c * 340 * sc, y: 512 + s * c * 280 }
  })
  const cells = new Uint8Array(size * size)
  layRoad(cells, size, pts, 36)
  for (const p of everyNth(pts, 36, 12)) stamp(cells, size, p.x, p.y, 16, BOOST)
  const items = everyNth(pts, 55, 4)
  for (const p of items) stamp(cells, size, p.x, p.y, 7, ITEM)
  return finish('moln', 'Molntoppen', size, pts, cells, items, {
    skyTop: '#6ec8f0',
    skyBot: '#f7f3ea',
    roadRgb: [210, 214, 222],
    offRgb: [186, 214, 232],
    wallRgb: [255, 255, 255],
    boostRgb: [255, 214, 64],
  })
}

export const TRACKS: { id: TrackId; name: string }[] = [
  { id: 'grotta', name: 'Den ljusa grottan' },
  { id: 'skog', name: 'Den mörka skogen' },
  { id: 'moln', name: 'Molntoppen' },
]
