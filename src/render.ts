import type { Character } from './characters.ts'
import type { KartState } from './physics.ts'
import type { Track } from './track.ts'

const W = 480
const H = 270
const HORIZON = 92
const CAM_H = 42
const FOV = 220

export function project(
  wx: number,
  wy: number,
  camX: number,
  camY: number,
  camA: number,
): { sx: number; sy: number; scale: number } | null {
  const dx = wx - camX
  const dy = wy - camY
  const c = Math.cos(-camA)
  const s = Math.sin(-camA)
  const rx = dx * c - dy * s
  const ry = dx * s + dy * c
  if (ry < 8) return null
  const sx = W / 2 + (rx / ry) * FOV
  const sy = HORIZON + (CAM_H / ry) * FOV
  const scale = Math.max(0.15, Math.min(2.8, 28 / ry))
  if (sy < HORIZON - 4 || sy > H + 20) return null
  return { sx, sy, scale }
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  track: Track,
  camX: number,
  camY: number,
  camA: number,
  fog: boolean,
): void {
  ctx.imageSmoothingEnabled = false
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON)
  sky.addColorStop(0, track.skyTop)
  sky.addColorStop(1, track.skyBot)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, HORIZON)

  const img = ctx.getImageData(0, HORIZON, W, H - HORIZON)
  const pix = img.data
  const size = track.size
  const cells = track.cells
  const ca = Math.cos(camA)
  const sa = Math.sin(camA)

  for (let row = 0; row < H - HORIZON; row++) {
    const z = CAM_H / (row + 1)
    const step = z * (1 / FOV) * 1.15
    let wx = camX + ca * z * 8 - sa * (W / 2) * step
    let wy = camY + sa * z * 8 + ca * (W / 2) * step
    const dx = -sa * step
    const dy = ca * step
    const dest = row * W * 4
    for (let x = 0; x < W; x++) {
      const ix = wx | 0
      const iy = wy | 0
      let r = 0
      let g = 0
      let b = 0
      if (ix < 0 || iy < 0 || ix >= size || iy >= size) {
        r = track.wallRgb[0]
        g = track.wallRgb[1]
        b = track.wallRgb[2]
      } else {
        const v = cells[iy * size + ix]!
        const rgb =
          v === 1 ? track.roadRgb : v === 2 ? track.offRgb : v === 3 ? track.boostRgb : v === 4 ? [220, 80, 180] : track.wallRgb
        r = rgb[0]!
        g = rgb[1]!
        b = rgb[2]!
        const stripe = ((ix >> 4) + (iy >> 4)) & 1
        if (v === 1 && stripe) {
          r = Math.min(255, r + 12)
          g = Math.min(255, g + 12)
          b = Math.min(255, b + 12)
        }
      }
      const o = dest + x * 4
      pix[o] = r
      pix[o + 1] = g
      pix[o + 2] = b
      pix[o + 3] = 255
      wx += dx
      wy += dy
    }
  }
  ctx.putImageData(img, 0, HORIZON)
  if (fog) {
    ctx.fillStyle = 'rgba(220,220,230,0.72)'
    ctx.fillRect(0, 0, W, H)
  }
}

export function drawKart(
  ctx: CanvasRenderingContext2D,
  k: KartState,
  ch: Character,
  camX: number,
  camY: number,
  camA: number,
  isPlayer: boolean,
): void {
  const p = project(k.x, k.y, camX, camY, camA)
  if (!p) return
  const s = 10 * p.scale
  ctx.save()
  ctx.translate(p.sx, p.sy)
  ctx.fillStyle = '#222'
  ctx.beginPath()
  ctx.ellipse(0, s * 0.55, s * 0.7, s * 0.22, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = ch.body
  ctx.beginPath()
  ctx.ellipse(0, 0, s * 0.72, s * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = ch.belly
  ctx.beginPath()
  ctx.ellipse(0, s * 0.08, s * 0.38, s * 0.28, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.arc(-s * 0.18, -s * 0.08, s * 0.1, 0, Math.PI * 2)
  ctx.arc(s * 0.18, -s * 0.08, s * 0.1, 0, Math.PI * 2)
  ctx.fill()
  if (isPlayer) {
    ctx.strokeStyle = '#fff8c0'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.ellipse(0, 0, s * 0.85, s * 0.62, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  opts: {
    lap: number
    laps: number
    place: number
    item: string | null
    trackName: string
    finished: boolean
  },
): void {
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(8, 8, 150, 44)
  ctx.fillStyle = '#fff'
  ctx.font = '12px ui-rounded, system-ui, sans-serif'
  ctx.fillText(`${opts.trackName}`, 14, 24)
  ctx.fillText(`Varv ${Math.min(opts.lap, opts.laps)}/${opts.laps}   #${opts.place}`, 14, 42)
  if (opts.item) {
    ctx.fillStyle = 'rgba(80,40,90,0.7)'
    ctx.fillRect(W - 158, 8, 150, 28)
    ctx.fillStyle = '#ffe9a8'
    ctx.fillText(opts.item, W - 148, 27)
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(8, H - 28, W - 16, 20)
  ctx.fillStyle = '#eee'
  ctx.font = '10px ui-rounded, system-ui, sans-serif'
  ctx.fillText('pilar/WASD  gas ·  Mellanslag item ·  vänster/höger styr', 14, H - 14)
}

export { W, H }
