import { describe, expect, it } from 'vitest'
import { CHARACTERS } from './characters.ts'
import {
  cameraBehind,
  getTouchButtons,
  hitTouch,
  pointerToCanvas,
  project,
  tintCell,
  W,
  H,
} from './render.ts'

describe('cameraBehind', () => {
  it('puts the camera behind the kart so the player projects on screen', () => {
    const k = { x: 500, y: 500, angle: 0 }
    const cam = cameraBehind(k.x, k.y, k.angle)
    expect(cam.x).toBeLessThan(k.x)
    const p = project(k.x, k.y, cam.x, cam.y, cam.angle)
    expect(p).not.toBeNull()
    expect(p!.sx).toBeGreaterThan(W * 0.3)
    expect(p!.sx).toBeLessThan(W * 0.7)
    expect(p!.sy).toBeGreaterThan(H * 0.4)
  })
})

describe('getTouchButtons', () => {
  it('has gas, brake, steer and item hitboxes that match the drawn layout', () => {
    const b = getTouchButtons()
    expect(b.gas.y).toBe(b.brake.y)
    expect(b.left.x).toBeLessThan(b.brake.x)
    expect(b.brake.x).toBeLessThan(b.gas.x)
    expect(b.gas.x).toBeLessThan(b.right.x)
    expect(b.item.x).toBeGreaterThan(b.right.x)
    expect(b.item.y + b.item.h).toBeLessThanOrEqual(H)
    expect(b.minimap.x + b.minimap.w).toBeLessThanOrEqual(W)
    const overlap =
      b.item.x < b.minimap.x + b.minimap.w &&
      b.item.x + b.item.w > b.minimap.x &&
      b.item.y < b.minimap.y + b.minimap.h &&
      b.item.y + b.item.h > b.minimap.y
    expect(overlap).toBe(false)
  })

  it('maps gas to the ^ button, not the V', () => {
    const b = getTouchButtons()
    expect(hitTouch(b.gas.x + 2, b.gas.y + 2)).toBe('gas')
    expect(hitTouch(b.brake.x + 2, b.brake.y + 2)).toBe('brake')
    expect(hitTouch(b.left.x + 2, b.left.y + 2)).toBe('left')
    expect(hitTouch(b.right.x + 2, b.right.y + 2)).toBe('right')
    expect(hitTouch(b.item.x + 2, b.item.y + 2)).toBe('item')
  })
})

describe('pointerToCanvas', () => {
  it('scales CSS pixels to canvas pixels', () => {
    const rect = { left: 0, top: 0, width: W * 2, height: H * 2 }
    const p = pointerToCanvas(W, H, rect)
    expect(p.x).toBeCloseTo(W / 2)
    expect(p.y).toBeCloseTo(H / 2)
  })
})

describe('tintCell', () => {
  it('makes grotta, skog and moln look different on the same dirt cell', () => {
    const base: [number, number, number] = [50, 50, 50]
    const grotta = tintCell('grotta', 2, 100, 100, base)
    const skog = tintCell('skog', 2, 100, 100, base)
    const moln = tintCell('moln', 2, 100, 100, base)
    expect(grotta).not.toEqual(skog)
    expect(skog).not.toEqual(moln)
    expect(skog[1]).toBeGreaterThan(grotta[1])
    expect(moln[2]).toBeGreaterThan(grotta[2])
  })
})

describe('characters', () => {
  it('keeps four dinos with unique body colors', () => {
    const colors = CHARACTERS.map((c) => c.body)
    expect(new Set(colors).size).toBe(4)
    expect(CHARACTERS.map((c) => c.id)).toEqual(['dino', 'rex', 'stega', 'laga'])
  })
})
