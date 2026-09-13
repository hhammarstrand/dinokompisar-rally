import { describe, expect, it } from 'vitest'
import { buildTrack, terrainAt, TRACKS } from './track.ts'

function count(t: ReturnType<typeof buildTrack>, v: number): number {
  let n = 0
  for (const c of t.cells) if (c === v) n++
  return n
}

function bbox(pts: { x: number; y: number }[]): { w: number; h: number } {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { w: maxX - minX, h: maxY - minY }
}

describe('tracks', () => {
  it('has three courses', () => {
    expect(TRACKS.map((t) => t.id)).toEqual(['grotta', 'skog', 'moln'])
  })

  for (const id of ['grotta', 'skog', 'moln'] as const) {
    it(`${id} has start on road and a closed waypoint ring`, () => {
      const t = buildTrack(id)
      expect(t.waypoints.length).toBeGreaterThan(100)
      expect(terrainAt(t, t.start.x, t.start.y)).toBe('road')
      const w = t.waypoints[40]!
      expect(terrainAt(t, w.x, w.y)).toBe('road')
      expect(t.items.length).toBeGreaterThan(3)
      let curbs = 0
      let dashes = 0
      for (const m of t.marks) {
        if (m === 2) curbs++
        if (m === 1) dashes++
      }
      expect(curbs).toBeGreaterThan(200)
      expect(dashes).toBeGreaterThan(80)
    })

    it(`${id} paints the start line at the start, not the map center`, () => {
      const t = buildTrack(id)
      expect(t.startLine.length).toBeGreaterThan(4)
      for (const p of t.startLine) {
        const d = Math.hypot(p.x - t.start.x, p.y - t.start.y)
        expect(d).toBeLessThan(80)
      }
      const mid = { x: t.size / 2, y: t.size / 2 }
      const dMid = Math.hypot(t.start.x - mid.x, t.start.y - mid.y)
      expect(dMid).toBeGreaterThan(40)
    })
  }

  it('grotta is two chambers, skog kinks more, moln has more boost', () => {
    const grotta = buildTrack('grotta')
    const skog = buildTrack('skog')
    const moln = buildTrack('moln')
    const g = bbox(grotta.waypoints)
    const s = bbox(skog.waypoints)
    expect(g.w / g.h).toBeGreaterThan(1.15)
    expect(s.w / s.h).toBeLessThan(g.w / g.h)
    const radii = grotta.waypoints.map((p) => Math.hypot(p.x - grotta.size / 2, p.y - grotta.size / 2))
    expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(1.85)
    const len = (pts: { x: number; y: number }[]) => {
      let n = 0
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!
        const b = pts[(i + 1) % pts.length]!
        n += Math.hypot(a.x - b.x, a.y - b.y)
      }
      return n
    }
    expect(len(skog.waypoints) / (s.w + s.h)).toBeGreaterThan(len(grotta.waypoints) / (g.w + g.h))
    expect(count(moln, 3)).toBeGreaterThan(count(grotta, 3))
    expect(count(skog, 1)).toBeLessThan(count(grotta, 1))
  })
})
