import type { KartState } from './physics.ts'
import { dist } from './physics.ts'
import type { Track } from './track.ts'
import { terrainAt } from './track.ts'

export type ItemId = 'sten' | 'agg' | 'lov' | 'dimma'

export interface Projectile {
  x: number
  y: number
  angle: number
  life: number
  owner: number
}

export interface Puddle {
  x: number
  y: number
  life: number
}

export interface ItemWorld {
  held: (ItemId | null)[]
  cooldown: number[]
  projectiles: Projectile[]
  puddles: Puddle[]
  fogUntil: number[]
}

const BAG: ItemId[] = ['sten', 'agg', 'lov', 'dimma']

export function emptyItems(n: number): ItemWorld {
  return {
    held: Array.from({ length: n }, () => null),
    cooldown: Array.from({ length: n }, () => 0),
    projectiles: [],
    puddles: [],
    fogUntil: Array.from({ length: n }, () => 0),
  }
}

export function pickItem(w: ItemWorld, i: number, track: Track, karts: KartState[]): void {
  if (w.held[i] || w.cooldown[i]! > 0) return
  const k = karts[i]!
  if (terrainAt(track, k.x, k.y) !== 'item') return
  w.held[i] = BAG[(Math.random() * BAG.length) | 0]!
  w.cooldown[i] = 2.2
}

export function useItem(w: ItemWorld, i: number, karts: KartState[], now: number): void {
  const id = w.held[i]
  if (!id) return
  const k = karts[i]!
  w.held[i] = null
  if (id === 'sten') k.speed = Math.max(k.speed, 0) + 3.2
  if (id === 'agg') {
    w.projectiles.push({ x: k.x, y: k.y, angle: k.angle, life: 1.6, owner: i })
  }
  if (id === 'lov') {
    w.puddles.push({
      x: k.x - Math.cos(k.angle) * 28,
      y: k.y - Math.sin(k.angle) * 28,
      life: 6,
    })
  }
  if (id === 'dimma') {
    for (let j = 0; j < karts.length; j++) {
      if (j !== i) w.fogUntil[j] = now + 2.2
    }
  }
}

export function stepItems(w: ItemWorld, karts: KartState[], dt: number): void {
  for (let i = 0; i < w.cooldown.length; i++) w.cooldown[i] = Math.max(0, w.cooldown[i]! - dt)
  for (const p of w.projectiles) {
    p.x += Math.cos(p.angle) * 9
    p.y += Math.sin(p.angle) * 9
    p.life -= dt
    for (let j = 0; j < karts.length; j++) {
      if (j === p.owner) continue
      if (dist(p.x, p.y, karts[j]!.x, karts[j]!.y) < 18) {
        karts[j]!.stun = Math.max(karts[j]!.stun, 1)
        p.life = 0
      }
    }
  }
  w.projectiles = w.projectiles.filter((p) => p.life > 0)
  for (const pud of w.puddles) {
    pud.life -= dt
    for (const k of karts) {
      if (dist(pud.x, pud.y, k.x, k.y) < 16) k.slip = Math.max(k.slip, 0.7)
    }
  }
  w.puddles = w.puddles.filter((p) => p.life > 0)
}

export const ITEM_LABEL: Record<ItemId, string> = {
  sten: 'Vänskapssten',
  agg: 'Ägg',
  lov: 'Lövhög',
  dimma: 'Dimma',
}
