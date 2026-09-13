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
          // Start/mål-linje (vit streckad vid waypoint 0-området)
          const isStartLine = ix > 480 && ix < 560 && iy > 480 && iy < 560
          if (isStartLine) {
            r = 255
            g = 255
            b = 255
          } else {
            r = Math.min(255, r + 12)
            g = Math.min(255, g + 12)
            b = Math.min(255, b + 12)
          }
        }
        // Vägkant (OFF-cell intill ROAD)
        if (v === 2 && ix > 0 && cells[iy * size + (ix - 1)] === 1) {
          r = Math.max(0, r - 30)
          g = Math.max(0, g - 30)
          b = Math.max(0, b - 30)
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
  // Rita dekorationer baserat på bana-id
  const decorations = track.id === 'grotta' ? drawCrystal : track.id === 'skog' ? drawTree : drawCloud
  // Placera några dekorationer längs banan (vid waypoints)
  for (let i = 0; i < track.waypoints.length; i += 30) {
    const wp = track.waypoints[i]!
    const p = project(wp.x, wp.y, camX, camY, camA)
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

export function drawMinimap(ctx: CanvasRenderingContext2D, track: Track, racers: { kart: { x: number; y: number } }[], _p: { x: number; y: number }): void {
  const size = 100
  const margin = 8
  const mx = W - size - margin
  const my = H - size - margin
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(mx, my, size, size)
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 1
  ctx.strokeRect(mx, my, size, size)

  const scale = (size - 16) / track.size
  const ox = mx + 8
  const oy = my + 8

  // Rita banan som linjer mellan waypoints
  ctx.strokeStyle = 'rgba(200,200,200,0.6)'
  ctx.lineWidth = 2
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

  // Rita racers som prickar
  for (let i = 0; i < racers.length; i++) {
    const r = racers[i]!
    const rx = ox + r.kart.x * scale
    const ry = oy + r.kart.y * scale
    ctx.fillStyle = i === 0 ? '#ffd700' : '#ff6b6b'
    ctx.beginPath()
    ctx.arc(rx, ry, i === 0 ? 4 : 3, 0, Math.PI * 2)
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

export const TOUCH_BTN_Y = H - 60
export const TOUCH_BTN_H = 50

export function drawTouchButtons(ctx: CanvasRenderingContext2D): void {
  const bw = 70
  const bh = TOUCH_BTN_H
  const gap = 10
  const totalW = 4 * bw + 3 * gap
  const startX = (W - totalW) / 2
  const y = TOUCH_BTN_Y

  const buttons = [
    { label: '<', color: '#6baed6' },
    { label: 'V', color: '#fd8d3c' },
    { label: '^', color: '#74a059' },
    { label: '>', color: '#6baed6' },
  ]

  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i]!
    const bx = startX + i * (bw + gap)
    ctx.fillStyle = b.color
    ctx.beginPath()
    ctx.roundRect(bx, y, bw, bh, 8)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 24px ui-rounded, system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(b.label, bx + bw / 2, y + bh / 2 + 8)
  }

  // Item-knapp (höger om de fyra)
  const itemX = W - 90
  const itemY = H - 100
  ctx.fillStyle = '#e5986b'
  ctx.beginPath()
  ctx.roundRect(itemX, itemY, 80, 70, 10)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 20px ui-rounded, system-ui'
  ctx.textAlign = 'center'
  ctx.fillText('ITEM', itemX + 40, itemY + 45)
}

export function getTouchButtons(): {
  left: { x: number; y: number; w: number; h: number }
  right: { x: number; y: number; w: number; h: number }
  up: { x: number; y: number; w: number; h: number }
  item: { x: number; y: number; w: number; h: number }
} {
  const bw = 70
  const bh = TOUCH_BTN_H
  const gap = 10
  const totalW = 4 * bw + 3 * gap
  const startX = (W - totalW) / 2
  const y = TOUCH_BTN_Y

  return {
    left: { x: startX, y, w: bw, h: bh },
    right: { x: startX + 3 * (bw + gap), y, w: bw, h: bh },
    up: { x: startX + bw + gap, y, w: bw, h: bh },
    item: { x: W - 90, y: H - 100, w: 80, h: 70 },
  }
}

export { W, H }
