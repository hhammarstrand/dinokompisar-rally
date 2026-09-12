import { describe, expect, it } from 'vitest'
import { CHARACTERS } from './characters.ts'
import { stepKart, type KartState } from './physics.ts'

function kart(): KartState {
  return { x: 0, y: 0, angle: 0, speed: 0, stun: 0, slip: 0 }
}

describe('stepKart', () => {
  const stats = CHARACTERS[0]!.stats

  it('accelerates forward', () => {
    const k = kart()
    stepKart(k, { throttle: 1, steer: 0 }, 1 / 60, stats, 'road')
    expect(k.speed).toBeGreaterThan(0)
    expect(k.x).toBeGreaterThan(0)
  })

  it('turns while moving', () => {
    const k = kart()
    k.speed = 2
    stepKart(k, { throttle: 0, steer: 1 }, 1 / 60, stats, 'road')
    expect(k.angle).toBeGreaterThan(0)
  })

  it('is slower offroad at cap', () => {
    const road = kart()
    const dirt = kart()
    for (let i = 0; i < 180; i++) {
      stepKart(road, { throttle: 1, steer: 0 }, 1 / 60, stats, 'road')
      stepKart(dirt, { throttle: 1, steer: 0 }, 1 / 60, stats, 'offroad')
    }
    expect(dirt.speed).toBeLessThan(road.speed)
  })

  it('ignores steer while stunned', () => {
    const k = kart()
    k.stun = 1
    k.speed = 3
    const a = k.angle
    stepKart(k, { throttle: 1, steer: 1 }, 1 / 60, stats, 'road')
    expect(k.angle).toBe(a)
    expect(k.stun).toBeLessThan(1)
  })
})
