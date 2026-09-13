export function countdownHz(n: number): number {
  if (n >= 3) return 330
  if (n === 2) return 392
  return 523
}

export function goHz(): number {
  return 784
}

type Ctx = AudioContext

let ac: Ctx | null = null

function context(): Ctx | null {
  const C = globalThis.AudioContext || (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!C) return null
  if (!ac) ac = new C()
  return ac
}

export function resumeSfx(): void {
  const c = context()
  if (c?.state === 'suspended') void c.resume()
}

export function beep(hz: number, ms = 140): void {
  const c = context()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'square'
  o.frequency.value = hz
  g.gain.value = 0.07
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + ms / 1000)
  o.connect(g)
  g.connect(c.destination)
  o.start()
  o.stop(c.currentTime + ms / 1000)
}

export function itemBeep(): void {
  beep(660, 90)
  beep(880, 140)
}
