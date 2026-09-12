import type { KartState } from './physics.ts'
import { wrapAngle } from './physics.ts'
import type { Track } from './track.ts'

export function cpuInput(k: KartState, track: Track, wpIndex: number): {
  throttle: number
  steer: number
  next: number
} {
  const pts = track.waypoints
  const target = pts[wpIndex % pts.length]!
  const dx = target.x - k.x
  const dy = target.y - k.y
  const d = Math.hypot(dx, dy)
  let next = wpIndex
  if (d < 48) next = (wpIndex + 6) % pts.length
  const want = Math.atan2(dy, dx)
  let diff = wrapAngle(want - k.angle)
  const steer = Math.max(-1, Math.min(1, diff * 1.8))
  const throttle = Math.abs(diff) > 1.1 ? 0.35 : 1
  return { throttle, steer, next }
}
