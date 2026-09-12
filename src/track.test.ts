import { describe, expect, it } from 'vitest'
import { buildTrack, terrainAt, TRACKS } from './track.ts'

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
    })
  }
})
