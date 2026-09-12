import type { KartStats } from './characters.ts'

export type Terrain = 'wall' | 'road' | 'offroad' | 'boost' | 'item'

export interface KartState {
  x: number
  y: number
  angle: number
  speed: number
  stun: number
  slip: number
}

export interface DriveInput {
  throttle: number
  steer: number
}

export function stepKart(
  k: KartState,
  input: DriveInput,
  dt: number,
  stats: KartStats,
  terrain: Terrain,
): void {
  if (k.stun > 0) {
    k.stun = Math.max(0, k.stun - dt)
    k.speed *= 0.92
    return
  }

  const throttle = clamp(input.throttle, -1, 1)
  const steer = clamp(input.steer, -1, 1)

  if (throttle > 0) k.speed += stats.accel * throttle * dt * 60
  else if (throttle < 0) k.speed += stats.brake * throttle * dt * 60
  else k.speed *= stats.friction

  let max = stats.maxSpeed
  if (terrain === 'offroad') max *= stats.offroad
  if (terrain === 'boost') max *= 1.45
  if (k.speed > max) k.speed += (max - k.speed) * 0.2
  if (k.speed < -max * 0.35) k.speed = -max * 0.35

  const speedTurn = Math.min(1, Math.abs(k.speed) / 1.4)
  let turn = stats.turn * steer * speedTurn * Math.sign(k.speed || 1)
  if (k.slip > 0) {
    turn += (Math.random() - 0.5) * 0.12
    k.slip = Math.max(0, k.slip - dt)
  }
  k.angle += turn * dt * 60

  k.x += Math.cos(k.angle) * k.speed
  k.y += Math.sin(k.angle) * k.speed
}

export function bounceFromWall(k: KartState, nx: number, ny: number): void {
  const v = Math.hypot(nx, ny) || 1
  nx /= v
  ny /= v
  k.x += nx * 3
  k.y += ny * 3
  k.speed *= -0.35
}

export function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}
