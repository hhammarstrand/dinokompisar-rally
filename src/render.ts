import type { Character } from './characters.ts'
import type { KartState } from './physics.ts'
import { onStartLine, type Track } from './track.ts'

const W = 480
const H = 270
const HORIZON = 92
const CAM_H = 42
const FOV = 220
const CAM_BACK = 10

export type TouchKind = 'left' | 'right' | 'gas' | 'brake' | 'item'
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function cameraBehind(x: number, y: number, angle: number): { x: number; y: number; angle: number } {
  return {
    x: x - Math.cos(angle) * CAM_BACK,
    y: y - Math.sin(angle) * CAM_BACK,
    angle,
  }
}

export function pointerToCanvas(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  return {
    x: ((clientX - rect.left) / Math.max(1, rect.width)) * W,
    y: ((clientY - rect.top) / Math.max(1, rect.height)) * H,
  }
}

export function project(
  wx: number,
  wy: number,
  camX: number,
  camY: number,
  camA: number,
): { sx: number; sy: number; scale: number } | null {
  const dx = wx - camX
  const dy = wy - camY
  const ca = Math.cos(camA)
  const sa = Math.sin(camA)
  const forward = dx * ca + dy * sa
  const right = -dx * sa + dy * ca
  if (forward < 2) return null
  const z = forward / 8
  const sx = W / 2 + (right / (z * 1.15)) * FOV
  const sy = HORIZON + CAM_H / z - 1
  const scale = Math.max(0.35, Math.min(3.2, 18 / forward))
  if (sy < HORIZON - 8 || sy > H + 30) return null
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
        if ((v === 1 || v === 3 || v === 4) && onStartLine(track, ix, iy)) {
          const chk = ((ix >> 3) + (iy >> 3)) & 1
          r = chk ? 250 : 30
          g = chk ? 250 : 30
          b = chk ? 250 : 30
        } else if (v === 1 && stripe) {
          r = Math.min(255, r + 12)
          g = Math.min(255, g + 12)
          b = Math.min(255, b + 12)
        }
        if (v === 2) {
          const left = ix > 0 ? cells[iy * size + (ix - 1)] : 0
          const up = iy > 0 ? cells[(iy - 1) * size + ix] : 0
          if (left === 1 || up === 1) {
            r = Math.min(255, r + 50)
            g = Math.min(255, g + 40)
            b = Math.min(255, b + 20)
          }
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

  // Dekorationer per bana (ritas ovanpå golvet)
  drawDecorations(ctx, track, camX, camY, camA)

  if (fog) {
    ctx.fillStyle = 'rgba(220,220,230,0.72)'
    ctx.fillRect(0, 0, W, H)
  }
}

function drawDecorations(ctx: CanvasRenderingContext2D, track: Track, camX: number, camY: number, camA: number): void {
  const decorations = track.id === 'grotta' ? drawCrystal : track.id === 'skog' ? drawTree : drawCloud
  const step = track.id === 'skog' ? 8 : 10
  const offset = track.id === 'moln' ? 36 : 58
  for (let i = 0; i < track.waypoints.length; i += step) {
    const wp = track.waypoints[i]!
    const nxt = track.waypoints[(i + 4) % track.waypoints.length]!
    const a = Math.atan2(nxt.y - wp.y, nxt.x - wp.x)
    const side = i % (step * 2) === 0 ? 1 : -1
    const x = wp.x + Math.cos(a + Math.PI / 2) * offset * side
    const y = wp.y + Math.sin(a + Math.PI / 2) * offset * side
    const p = project(x, y, camX, camY, camA)
    if (!p) continue
    decorations(ctx, p.sx, p.sy, p.scale)
  }
}

function drawCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  const s = 8 * scale
  ctx.fillStyle = '#f0c060'
  ctx.beginPath()
  ctx.moveTo(x, y - s * 2)
  ctx.lineTo(x + s * 0.5, y)
  ctx.lineTo(x - s * 0.5, y)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#ffe8a0'
  ctx.beginPath()
  ctx.moveTo(x, y - s * 2)
  ctx.lineTo(x + s * 0.3, y - s * 0.5)
  ctx.lineTo(x - s * 0.5, y)
  ctx.closePath()
  ctx.fill()
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  const s = 10 * scale
  // Stam
  ctx.fillStyle = '#4a3520'
  ctx.fillRect(x - s * 0.15, y - s * 0.5, s * 0.3, s * 0.8)
  // Krontyp (tre lager)
  ctx.fillStyle = '#2d5a27'
  ctx.beginPath()
  ctx.moveTo(x, y - s * 2.5)
  ctx.lineTo(x + s * 0.8, y - s * 0.8)
  ctx.lineTo(x - s * 0.8, y - s * 0.8)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x, y - s * 1.8)
  ctx.lineTo(x + s * 0.7, y - s * 0.3)
  ctx.lineTo(x - s * 0.7, y - s * 0.3)
  ctx.closePath()
  ctx.fill()
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  const s = 12 * scale
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.beginPath()
  ctx.arc(x, y, s * 0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + s * 0.4, y - s * 0.15, s * 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x - s * 0.35, y - s * 0.1, s * 0.35, 0, Math.PI * 2)
  ctx.fill()
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

  // Skugga
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.ellipse(0, s * 0.55, s * 0.65, s * 0.18, 0, 0, Math.PI * 2)
  ctx.fill()

  if (ch.id === 'dino') {
    // Grön liten rund dino
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.arc(0, -s * 0.1, s * 0.55, 0, Math.PI * 2)
    ctx.fill()
    // Buk
    ctx.fillStyle = ch.belly
    ctx.beginPath()
    ctx.arc(0, s * 0.05, s * 0.32, 0, Math.PI * 2)
    ctx.fill()
    // Ögon (glada)
    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(-s * 0.16, -s * 0.18, s * 0.09, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(s * 0.16, -s * 0.18, s * 0.09, 0, Math.PI * 2)
    ctx.fill()
    // Ögonhighlight
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(-s * 0.13, -s * 0.21, s * 0.04, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(s * 0.19, -s * 0.21, s * 0.04, 0, Math.PI * 2)
    ctx.fill()
    // Mun (smile)
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(0, -s * 0.08, s * 0.18, 0.2, Math.PI - 0.2)
    ctx.stroke()
    // Stjärt
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.ellipse(-s * 0.55, s * 0.15, s * 0.18, s * 0.1, -0.3, 0, Math.PI * 2)
    ctx.fill()
  } else if (ch.id === 'rex') {
    // Röd-orange T-Rex med små armar
    ctx.fillStyle = ch.body
    // Kropp
    ctx.beginPath()
    ctx.ellipse(0, s * 0.05, s * 0.5, s * 0.45, 0, 0, Math.PI * 2)
    ctx.fill()
    // Huvud (stort)
    ctx.beginPath()
    ctx.ellipse(s * 0.25, -s * 0.25, s * 0.38, s * 0.28, 0, 0, Math.PI * 2)
    ctx.fill()
    // Käke
    ctx.beginPath()
    ctx.ellipse(s * 0.32, -s * 0.12, s * 0.28, s * 0.12, 0, 0, Math.PI)
    ctx.fill()
    // Öga
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(s * 0.35, -s * 0.32, s * 0.08, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(s * 0.37, -s * 0.32, s * 0.045, 0, Math.PI * 2)
    ctx.fill()
    // Små armar
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.ellipse(s * 0.15, s * 0.15, s * 0.08, s * 0.18, 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(s * 0.05, s * 0.2, s * 0.07, s * 0.15, -0.2, 0, Math.PI * 2)
    ctx.fill()
    // Svans
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.ellipse(-s * 0.45, s * 0.1, s * 0.35, s * 0.12, -0.2, 0, Math.PI * 2)
    ctx.fill()
    // Buk
    ctx.fillStyle = ch.belly
    ctx.beginPath()
    ctx.ellipse(s * 0.05, s * 0.18, s * 0.3, s * 0.2, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (ch.id === 'stega') {
    // Blå med taggar på ryggen
    ctx.fillStyle = ch.body
    // Kropp
    ctx.beginPath()
    ctx.ellipse(0, s * 0.05, s * 0.48, s * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()
    // Taggar på ryggen
    ctx.fillStyle = '#1a3fa0'
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(i * s * 0.15 - s * 0.06, -s * 0.35)
      ctx.lineTo(i * s * 0.15, -s * 0.55 - Math.abs(i) * s * 0.04)
      ctx.lineTo(i * s * 0.15 + s * 0.06, -s * 0.35)
      ctx.closePath()
      ctx.fill()
    }
    // Huvud
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.ellipse(s * 0.28, -s * 0.18, s * 0.32, s * 0.24, 0, 0, Math.PI * 2)
    ctx.fill()
    // Öga
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(s * 0.38, -s * 0.25, s * 0.07, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(s * 0.4, -s * 0.25, s * 0.04, 0, Math.PI * 2)
    ctx.fill()
    // Buk
    ctx.fillStyle = ch.belly
    ctx.beginPath()
    ctx.ellipse(0, s * 0.15, s * 0.28, s * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()
    // Stjält
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.ellipse(-s * 0.45, s * 0.08, s * 0.3, s * 0.1, -0.15, 0, Math.PI * 2)
    ctx.fill()
  } else if (ch.id === 'laga') {
    // Stor brun T-Rex
    ctx.fillStyle = ch.body
    // Stort kropp
    ctx.beginPath()
    ctx.ellipse(0, s * 0.05, s * 0.6, s * 0.52, 0, 0, Math.PI * 2)
    ctx.fill()
    // Huvud (större än Rex)
    ctx.beginPath()
    ctx.ellipse(s * 0.3, -s * 0.28, s * 0.42, s * 0.32, 0, 0, Math.PI * 2)
    ctx.fill()
    // Käke
    ctx.beginPath()
    ctx.ellipse(s * 0.38, -s * 0.1, s * 0.32, s * 0.14, 0, 0, Math.PI)
    ctx.fill()
    // Öga (stor)
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(s * 0.42, -s * 0.35, s * 0.09, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(s * 0.44, -s * 0.35, s * 0.05, 0, Math.PI * 2)
    ctx.fill()
    // Armar (små som Rex)
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.ellipse(s * 0.18, s * 0.18, s * 0.09, s * 0.2, 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(s * 0.06, s * 0.24, s * 0.08, s * 0.17, -0.2, 0, Math.PI * 2)
    ctx.fill()
    // Svans (stor)
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.ellipse(-s * 0.55, s * 0.12, s * 0.42, s * 0.14, -0.15, 0, Math.PI * 2)
    ctx.fill()
    // Buk
    ctx.fillStyle = ch.belly
    ctx.beginPath()
    ctx.ellipse(0, s * 0.2, s * 0.35, s * 0.25, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  if (isPlayer) {
    ctx.strokeStyle = '#fff8c0'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(0, -s * 0.05, s * 0.72, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawItemBox(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  const s = 8 * scale
  ctx.fillStyle = '#ffd700'
  ctx.strokeStyle = '#a06030'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(x - s, y - s * 0.7, s * 2, s * 1.4, 3)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${Math.max(8, Math.round(s))}px ui-rounded, system-ui`
  ctx.textAlign = 'center'
  ctx.fillText('?', x, y + s * 0.25)
  ctx.textAlign = 'left'
}

export function drawEgg(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  const s = 7 * scale
  ctx.fillStyle = '#f4e4c4'
  ctx.beginPath()
  ctx.ellipse(x, y, s * 0.55, s * 0.75, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#e07070'
  ctx.beginPath()
  ctx.arc(x - s * 0.12, y - s * 0.1, s * 0.16, 0, Math.PI * 2)
  ctx.fill()
}

export function drawPuddle(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  const s = 10 * scale
  ctx.fillStyle = 'rgba(80,160,70,0.7)'
  ctx.beginPath()
  ctx.ellipse(x, y, s, s * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()
}

export function drawMinimap(ctx: CanvasRenderingContext2D, track: Track, racers: { kart: { x: number; y: number } }[], _p: { x: number; y: number }): void {
  const m = getTouchButtons().minimap
  ctx.fillStyle = 'rgba(255,248,230,0.88)'
  ctx.strokeStyle = '#e8a030'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(m.x, m.y, m.w, m.h, 10)
  ctx.fill()
  ctx.stroke()

  const scale = (m.w - 16) / track.size
  const ox = m.x + 8
  const oy = m.y + 8

  ctx.strokeStyle = track.id === 'grotta' ? '#7a6a90' : track.id === 'skog' ? '#3d6b3a' : '#90b8d0'
  ctx.lineWidth = 3
  ctx.beginPath()
  for (let i = 0; i < track.waypoints.length; i++) {
    const wp = track.waypoints[i]!
    const wx = ox + wp.x * scale
    const wy = oy + wp.y * scale
    if (i === 0) ctx.moveTo(wx, wy)
    else ctx.lineTo(wx, wy)
  }
  ctx.closePath()
  ctx.stroke()

  for (let i = 0; i < racers.length; i++) {
    const r = racers[i]!
    ctx.fillStyle = i === 0 ? '#e8703a' : '#5aa0d0'
    ctx.beginPath()
    ctx.arc(ox + r.kart.x * scale, oy + r.kart.y * scale, i === 0 ? 4 : 3, 0, Math.PI * 2)
    ctx.fill()
  }
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
  ctx.fillStyle = 'rgba(255,250,240,0.9)'
  ctx.strokeStyle = '#ffb347'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(8, 8, 168, 50, 12)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#c45020'
  ctx.font = 'bold 12px Trebuchet MS, ui-rounded, system-ui, sans-serif'
  ctx.fillText(opts.trackName, 16, 26)
  ctx.fillStyle = '#3a2a1a'
  ctx.font = 'bold 14px Trebuchet MS, ui-rounded, system-ui, sans-serif'
  ctx.fillText(`Varv ${Math.min(opts.lap, opts.laps)}/${opts.laps}  #${opts.place}`, 16, 46)
  if (opts.item) {
    ctx.fillStyle = 'rgba(255,230,160,0.95)'
    ctx.strokeStyle = '#e8a030'
    ctx.beginPath()
    ctx.roundRect(8, 64, 168, 26, 10)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#7a3a10'
    ctx.font = 'bold 12px Trebuchet MS, ui-rounded, system-ui, sans-serif'
    ctx.fillText(opts.item, 16, 82)
  }
}

/** Rita ett porträtt av en karaktär på en canvas (används i menyn). */
export function drawPortrait(
  ctx: CanvasRenderingContext2D,
  ch: Character,
  size: number,
): void {
  const cx = size / 2
  const cy = size / 2
  const s = size * 0.45

  // Skugga
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + s * 0.48, s * 0.55, s * 0.14, 0, 0, Math.PI * 2)
  ctx.fill()

  if (ch.id === 'dino') {
    // Grön liten rund dino — porträtt
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.arc(cx, cy - s * 0.05, s * 0.62, 0, Math.PI * 2)
    ctx.fill()
    // Buk
    ctx.fillStyle = ch.belly
    ctx.beginPath()
    ctx.arc(cx, cy + s * 0.15, s * 0.34, 0, Math.PI * 2)
    ctx.fill()
    // Ögon (glada)
    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(cx - s * 0.18, cy - s * 0.18, s * 0.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx + s * 0.18, cy - s * 0.18, s * 0.1, 0, Math.PI * 2)
    ctx.fill()
    // Highlight
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(cx - s * 0.14, cy - s * 0.23, s * 0.045, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx + s * 0.22, cy - s * 0.23, s * 0.045, 0, Math.PI * 2)
    ctx.fill()
    // Mun (smile)
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.arc(cx, cy + s * 0.02, s * 0.2, 0.25, Math.PI - 0.25)
    ctx.stroke()
    // Stjärt (liten)
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.ellipse(cx - s * 0.58, cy + s * 0.18, s * 0.16, s * 0.09, -0.3, 0, Math.PI * 2)
    ctx.fill()
  } else if (ch.id === 'rex') {
    // Röd-orange T-Rex — porträtt
    ctx.fillStyle = ch.body
    // Kropp
    ctx.beginPath()
    ctx.ellipse(cx - s * 0.05, cy + s * 0.1, s * 0.48, s * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()
    // Huvud (stort, snett)
    ctx.beginPath()
    ctx.ellipse(cx + s * 0.18, cy - s * 0.22, s * 0.36, s * 0.26, 0, 0, Math.PI * 2)
    ctx.fill()
    // Käke
    ctx.beginPath()
    ctx.ellipse(cx + s * 0.25, cy - s * 0.1, s * 0.26, s * 0.11, 0, 0, Math.PI)
    ctx.fill()
    // Öga
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(cx + s * 0.28, cy - s * 0.3, s * 0.085, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(cx + s * 0.3, cy - s * 0.3, s * 0.048, 0, Math.PI * 2)
    ctx.fill()
    // Små armar
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.ellipse(cx + s * 0.1, cy + s * 0.22, s * 0.075, s * 0.16, 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx - s * 0.02, cy + s * 0.26, s * 0.065, s * 0.14, -0.2, 0, Math.PI * 2)
    ctx.fill()
    // Svans
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.ellipse(cx - s * 0.48, cy + s * 0.08, s * 0.32, s * 0.11, -0.2, 0, Math.PI * 2)
    ctx.fill()
    // Buk
    ctx.fillStyle = ch.belly
    ctx.beginPath()
    ctx.ellipse(cx + s * 0.02, cy + s * 0.2, s * 0.28, s * 0.18, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (ch.id === 'stega') {
    // Blå med taggar — porträtt
    ctx.fillStyle = ch.body
    // Kropp
    ctx.beginPath()
    ctx.ellipse(cx - s * 0.05, cy + s * 0.08, s * 0.46, s * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()
    // Taggar på ryggen
    ctx.fillStyle = '#1a3fa0'
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(cx + i * s * 0.14 - s * 0.055, cy - s * 0.38)
      ctx.lineTo(cx + i * s * 0.14, cy - s * 0.58 - Math.abs(i) * s * 0.035)
      ctx.lineTo(cx + i * s * 0.14 + s * 0.055, cy - s * 0.38)
      ctx.closePath()
      ctx.fill()
    }
    // Huvud
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.ellipse(cx + s * 0.2, cy - s * 0.15, s * 0.3, s * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()
    // Öga
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(cx + s * 0.28, cy - s * 0.22, s * 0.065, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(cx + s * 0.3, cy - s * 0.22, s * 0.038, 0, Math.PI * 2)
    ctx.fill()
    // Buk
    ctx.fillStyle = ch.belly
    ctx.beginPath()
    ctx.ellipse(cx - s * 0.05, cy + s * 0.18, s * 0.26, s * 0.2, 0, 0, Math.PI * 2)
    ctx.fill()
    // Stjärt
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.ellipse(cx - s * 0.48, cy + s * 0.06, s * 0.28, s * 0.095, -0.15, 0, Math.PI * 2)
    ctx.fill()
  } else if (ch.id === 'laga') {
    // Stor brun T-Rex — porträtt
    ctx.fillStyle = ch.body
    // Stort kropp
    ctx.beginPath()
    ctx.ellipse(cx - s * 0.05, cy + s * 0.1, s * 0.56, s * 0.48, 0, 0, Math.PI * 2)
    ctx.fill()
    // Huvud (större än Rex)
    ctx.beginPath()
    ctx.ellipse(cx + s * 0.22, cy - s * 0.26, s * 0.4, s * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
    // Käke
    ctx.beginPath()
    ctx.ellipse(cx + s * 0.3, cy - s * 0.1, s * 0.3, s * 0.13, 0, 0, Math.PI)
    ctx.fill()
    // Öga (stor)
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(cx + s * 0.32, cy - s * 0.34, s * 0.09, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(cx + s * 0.34, cy - s * 0.34, s * 0.05, 0, Math.PI * 2)
    ctx.fill()
    // Armar (små)
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.ellipse(cx + s * 0.12, cy + s * 0.24, s * 0.085, s * 0.18, 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx - s * 0.02, cy + s * 0.28, s * 0.075, s * 0.16, -0.2, 0, Math.PI * 2)
    ctx.fill()
    // Svans (stor)
    ctx.fillStyle = ch.body
    ctx.beginPath()
    ctx.ellipse(cx - s * 0.56, cy + s * 0.12, s * 0.4, s * 0.13, -0.15, 0, Math.PI * 2)
    ctx.fill()
    // Buk
    ctx.fillStyle = ch.belly
    ctx.beginPath()
    ctx.ellipse(cx - s * 0.05, cy + s * 0.22, s * 0.34, s * 0.24, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

export const TOUCH_BTN_Y = H - 52
export const TOUCH_BTN_H = 44

export function getTouchButtons(): {
  left: Rect
  right: Rect
  gas: Rect
  brake: Rect
  item: Rect
  minimap: Rect
} {
  const bw = 58
  const bh = TOUCH_BTN_H
  const gap = 8
  const y = TOUCH_BTN_Y
  const startX = 10
  return {
    left: { x: startX, y, w: bw, h: bh },
    brake: { x: startX + bw + gap, y, w: bw, h: bh },
    gas: { x: startX + 2 * (bw + gap), y, w: bw, h: bh },
    right: { x: startX + 3 * (bw + gap), y, w: bw, h: bh },
    item: { x: W - 76, y: H - 56, w: 68, h: 48 },
    minimap: { x: W - 108, y: 8, w: 100, h: 100 },
  }
}

export function hitTouch(x: number, y: number): TouchKind | null {
  const b = getTouchButtons()
  const order: TouchKind[] = ['item', 'gas', 'brake', 'left', 'right']
  for (const k of order) {
    const r = b[k]
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return k
  }
  return null
}

export function drawTouchButtons(ctx: CanvasRenderingContext2D): void {
  const b = getTouchButtons()
  const drawn: { r: Rect; label: string; color: string }[] = [
    { r: b.left, label: '<', color: '#6baed6' },
    { r: b.brake, label: 'V', color: '#fd8d3c' },
    { r: b.gas, label: '^', color: '#74a059' },
    { r: b.right, label: '>', color: '#6baed6' },
    { r: b.item, label: 'ITEM', color: '#e5986b' },
  ]
  for (const d of drawn) {
    ctx.fillStyle = d.color
    ctx.beginPath()
    ctx.roundRect(d.r.x, d.r.y, d.r.w, d.r.h, 10)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = d.label === 'ITEM' ? 'bold 14px Trebuchet MS, system-ui' : 'bold 22px Trebuchet MS, system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(d.label, d.r.x + d.r.w / 2, d.r.y + d.r.h / 2 + 7)
  }
  ctx.textAlign = 'left'
}

export { W, H }
