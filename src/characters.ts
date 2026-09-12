export type CharId = 'dino' | 'rex' | 'stega' | 'laga'

export interface KartStats {
  accel: number
  brake: number
  maxSpeed: number
  turn: number
  offroad: number
  friction: number
}

export interface Character {
  id: CharId
  name: string
  blurb: string
  body: string
  belly: string
  stats: KartStats
}

export const CHARACTERS: Character[] = [
  {
    id: 'dino',
    name: 'Dino',
    blurb: 'Liten, snäll, lagom i allt.',
    body: '#3aa35a',
    belly: '#b7e3a1',
    stats: { accel: 0.17, brake: 0.22, maxSpeed: 4.1, turn: 0.048, offroad: 0.72, friction: 0.985 },
  },
  {
    id: 'rex',
    name: 'Rex',
    blurb: 'Snabb på rakorna, vinglig i kurvorna.',
    body: '#d94a3a',
    belly: '#f4a15a',
    stats: { accel: 0.21, brake: 0.2, maxSpeed: 4.7, turn: 0.034, offroad: 0.48, friction: 0.988 },
  },
  {
    id: 'stega',
    name: 'Stega',
    blurb: 'Taggig tank. Gillar skogen.',
    body: '#3d6fd9',
    belly: '#9ec4ff',
    stats: { accel: 0.14, brake: 0.24, maxSpeed: 3.7, turn: 0.042, offroad: 0.92, friction: 0.982 },
  },
  {
    id: 'laga',
    name: 'Laga',
    blurb: 'Störst och snabbast. Svår att styra.',
    body: '#6b4a2b',
    belly: '#c4a574',
    stats: { accel: 0.16, brake: 0.18, maxSpeed: 5.1, turn: 0.028, offroad: 0.4, friction: 0.99 },
  },
]

export function character(id: CharId): Character {
  const c = CHARACTERS.find((x) => x.id === id)
  if (!c) throw new Error(`okänd kart: ${id}`)
  return c
}
