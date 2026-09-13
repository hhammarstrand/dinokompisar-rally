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

export function buildTrack(id: TrackId): Track {
  if (id === 'grotta') return makeLoop('grotta', 'Den ljusa grottan', 1024, 0.34, 0.26, 46, false, {
    skyTop: '#2a1848',
    skyBot: '#e8b86a',
    roadRgb: [92, 78, 110],
    offRgb: [58, 42, 36],
    wallRgb: [28, 18, 32],
    boostRgb: [240, 196, 80],
  })
  if (id === 'skog') return makeWiggle()
  return makeEight()
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

function pathPoints(
  n: number,
  fn: (i: number, u: number) => Waypoint,
): Waypoint[] {
  const pts: Waypoint[] = []
  for (let i = 0; i < n; i++) pts.push(fn(i, i / n))
  return pts
}

function layRoad(cells: Uint8Array, size: number, pts: Waypoint[], width: number): void {
  cells.fill(OFF)
  for (const p of pts) stamp(cells, size, p.x, p.y, width + 14, WALL)
  for (const p of pts) stamp(cells, size, p.x, p.y, width + 4, OFF) // kant-zon
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

function makeLoop(
  id: TrackId,
  name: string,
  size: number,
  rx: number,
  ry: number,
  width: number,
  boosts: boolean,
  theme: Omit<Track, 'id' | 'name' | 'size' | 'cells' | 'start' | 'waypoints' | 'items'>,
): Track {
  const cx = size / 2
  const cy = size / 2
  const pts = pathPoints(360, (_i, u) => {
    const a = u * Math.PI * 2
    return { x: cx + Math.cos(a) * size * rx, y: cy + Math.sin(a) * size * ry }
  })
  const cells = new Uint8Array(size * size)
  layRoad(cells, size, pts, width)
  if (boosts) {
    for (const p of everyNth(pts, 90, 20)) stamp(cells, size, p.x, p.y, 14, BOOST)
  }
  const items = everyNth(pts, 60, 10)
  for (const p of items) stamp(cells, size, p.x, p.y, 7, ITEM)
  // Start/mål-linje vid waypoint 0
  const start = pts[0]!
  const nxt = pts[8]!
  const angle = Math.atan2(nxt.y - start.y, nxt.x - start.x)
  for (let i = -3; i <= 3; i++) {
    const px = start.x + Math.cos(angle + Math.PI / 2) * i * 5
    const py = start.y + Math.sin(angle + Math.PI / 2) * i * 5
    stamp(cells, size, px | 0, py | 0, 3, ROAD)
  }
  return {
    id,
    name,
    size,
    cells,
    start: { ...start, angle },
    waypoints: pts,
    items,
    ...theme,
  }
}

function makeWiggle(): Track {
  const size = 1024
  const pts = pathPoints(400, (_i, u) => {
    const a = u * Math.PI * 2
    const wobble = 90 * Math.sin(a * 3)
    return {
      x: 512 + Math.cos(a) * (310 + wobble),
      y: 512 + Math.sin(a) * (250 + wobble * 0.4),
    }
  })
  const cells = new Uint8Array(size * size)
  layRoad(cells, size, pts, 34)
  const items = everyNth(pts, 50, 8)
  for (const p of items) stamp(cells, size, p.x, p.y, 7, ITEM)
  // Start/mål-linje
  const start = pts[0]!
  const nxt = pts[6]!
  const angle = Math.atan2(nxt.y - start.y, nxt.x - start.x)
  for (let i = -3; i <= 3; i++) {
    const px = start.x + Math.cos(angle + Math.PI / 2) * i * 5
    const py = start.y + Math.sin(angle + Math.PI / 2) * i * 5
    stamp(cells, size, px | 0, py | 0, 3, ROAD)
  }
  return {
    id: 'skog',
    name: 'Den mörka skogen',
    size,
    cells,
    start: { ...start, angle },
    waypoints: pts,
    items,
    skyTop: '#102010',
    skyBot: '#3d6b3a',
    roadRgb: [62, 56, 48],
    offRgb: [28, 72, 34],
    wallRgb: [12, 28, 14],
    boostRgb: [180, 220, 90],
  }
}

function makeEight(): Track {
  const size = 1024
  const pts = pathPoints(420, (_i, u) => {
    const a = u * Math.PI * 2
    // lemniscate-ish
    const s = Math.sin(a)
    const c = Math.cos(a)
    const sc = 1 + 0.35 * Math.sin(2 * a)
    return { x: 512 + c * 340 * sc, y: 512 + s * c * 280 }
  })
  const cells = new Uint8Array(size * size)
  layRoad(cells, size, pts, 36)
  for (const p of everyNth(pts, 70, 15)) stamp(cells, size, p.x, p.y, 16, BOOST)
  const items = everyNth(pts, 55, 4)
  for (const p of items) stamp(cells, size, p.x, p.y, 7, ITEM)
  // Start/mål-linje
  const start = pts[0]!
  const nxt = pts[7]!
  const angle = Math.atan2(nxt.y - start.y, nxt.x - start.x)
  for (let i = -3; i <= 3; i++) {
    const px = start.x + Math.cos(angle + Math.PI / 2) * i * 5
    const py = start.y + Math.sin(angle + Math.PI / 2) * i * 5
    stamp(cells, size, px | 0, py | 0, 3, ROAD)
  }
  return {
    id: 'moln',
    name: 'Molntoppen',
    size,
    cells,
    start: { ...start, angle },
    waypoints: pts,
    items,
    skyTop: '#6ec8f0',
    skyBot: '#f7f3ea',
    roadRgb: [210, 214, 222],
    offRgb: [186, 214, 232],
    wallRgb: [255, 255, 255],
    boostRgb: [255, 214, 64],
  }
}

export const TRACKS: { id: TrackId; name: string }[] = [
  { id: 'grotta', name: 'Den ljusa grottan' },
  { id: 'skog', name: 'Den mörka skogen' },
  { id: 'moln', name: 'Molntoppen' },
]
