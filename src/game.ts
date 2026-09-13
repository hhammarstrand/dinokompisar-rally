import { CHARACTERS, character, type CharId } from './characters.ts'
import { cpuInput } from './ai.ts'
import { attachInput } from './input.ts'
import {
  emptyItems,
  ITEM_LABEL,
  pickItem,
  stepItems,
  useItem,
  type ItemWorld,
} from './items.ts'
import { bounceFromWall, dist, stepKart, type KartState } from './physics.ts'
import { drawHud, drawItemBox, drawKart, drawMinimap, drawPortrait, drawTouchButtons, project, drawWorld, H, W } from './render.ts'
import { buildTrack, TRACKS, terrainAt, type Track, type TrackId } from './track.ts'

const LAPS = 3
const CPU_CHARS: CharId[] = ['dino', 'rex', 'stega', 'laga']

type Countdown = 'countdown' | 'go'
type Screen = 'title' | 'char' | 'track' | 'race' | 'results'

interface Racer {
  kart: KartState
  charId: CharId
  wp: number
  laps: number
  finished: number
}

export function boot(root: HTMLElement): void {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  canvas.tabIndex = 0
  root.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('ingen canvas')

  const overlay = document.createElement('div')
  overlay.className = 'ui'
  root.appendChild(overlay)

  const input = attachInput(canvas)
  let screen: Screen = 'title'
  let playerChar: CharId = 'dino'
  let trackId: TrackId = 'grotta'
  let track: Track | null = null
  let racers: Racer[] = []
  let items: ItemWorld = emptyItems(4)
  let now = 0
  let spaceLatch = false
  let places: string[] = []
  let countdown: Countdown | null = null
  let countdownTimer = 0
  let podiumWait = 0

  // Puff för att rita karaktärs-porträtt i menyn
  const portraitCanvas = document.createElement('canvas')
  portraitCanvas.width = 80
  portraitCanvas.height = 80
  const portraitCtx = portraitCanvas.getContext('2d')
  if (!portraitCtx) throw new Error('ingen portraitCtx')

  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' && screen === 'race') {
      e.preventDefault()
      if (!spaceLatch) {
        useItem(items, 0, racers.map((r) => r.kart), now)
        spaceLatch = true
      }
    }
  })
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') spaceLatch = false
  })

  function spawn(): void {
    track = buildTrack(trackId)
    const ids: CharId[] = [playerChar, ...CPU_CHARS.filter((c) => c !== playerChar).slice(0, 3)]
    racers = ids.map((id, i) => {
      const ang = track!.start.angle
      const side = (i - 1.5) * 18
      const back = i * 16
      return {
        charId: id,
        wp: 4,
        laps: 0,
        finished: 0,
        kart: {
          x: track!.start.x - Math.cos(ang) * back + Math.cos(ang + Math.PI / 2) * side,
          y: track!.start.y - Math.sin(ang) * back + Math.sin(ang + Math.PI / 2) * side,
          angle: ang,
          speed: 0,
          stun: 0,
          slip: 0,
        },
      }
    })
    items = emptyItems(racers.length)
    now = 0
    places = []
    countdown = 'countdown'
    countdownTimer = 3
    podiumWait = 0
  }

  function advanceWp(r: Racer): void {
    const pts = track!.waypoints
    const t = pts[r.wp % pts.length]!
    if (dist(r.kart.x, r.kart.y, t.x, t.y) < 52) {
      const prev = r.wp
      r.wp = (r.wp + 5) % pts.length
      if (prev > pts.length * 0.7 && r.wp < pts.length * 0.2) {
        r.laps += 1
        if (r.laps >= LAPS && r.finished === 0) {
          r.finished = places.length + 1
          places.push(character(r.charId).name)
        }
      }
    }
  }

  function step(dt: number): void {
    if (screen !== 'race' || !track) return

    // Countdown-logik
    if (countdown === 'countdown') {
      countdownTimer -= dt
      if (countdownTimer <= 0) {
        countdown = 'go'
        countdownTimer = 1.5
      }
      now += dt
      return
    }
    if (countdown === 'go') {
      countdownTimer -= dt
      if (countdownTimer <= 0) {
        countdown = null
      }
      now += dt
      return
    }

    now += dt
    const drive = input.read()
    for (let i = 0; i < racers.length; i++) {
      const r = racers[i]!
      if (r.finished) continue
      const ch = character(r.charId)
      let throttle = 0
      let steer = 0
      if (i === 0) {
        throttle = drive.throttle
        steer = drive.steer
      } else {
        const cpu = cpuInput(r.kart, track, r.wp)
        throttle = cpu.throttle
        steer = cpu.steer
        r.wp = cpu.next
      }
      const terr = terrainAt(track, r.kart.x, r.kart.y)
      const ox = r.kart.x
      const oy = r.kart.y
      stepKart(r.kart, { throttle, steer }, dt, ch.stats, terr)
      if (terrainAt(track, r.kart.x, r.kart.y) === 'wall') {
        r.kart.x = ox
        r.kart.y = oy
        bounceFromWall(r.kart, Math.cos(r.kart.angle + Math.PI), Math.sin(r.kart.angle + Math.PI))
        r.kart.x = ox
        r.kart.y = oy
      }
      pickItem(items, i, track, racers.map((x) => x.kart))
      if (i !== 0 && items.held[i] && Math.random() < 0.008) {
        useItem(items, i, racers.map((x) => x.kart), now)
      }
      advanceWp(r)
    }
    stepItems(items, racers.map((r) => r.kart), dt)
    if (racers[0]!.finished && !places.includes(character(racers[0]!.charId).name)) {
      // Vänta in alla racers
      const allFinished = racers.every((r) => r.finished > 0)
      if (allFinished || podiumWait > 2) {
        screen = 'results'
        podiumWait = 0
        renderMenu()
      } else {
        podiumWait += dt
      }
    } else {
      podiumWait = 0
    }
  }

  function paint(): void {
    if (!ctx || screen !== 'race' || !track) return
    const p = racers[0]!.kart
    const fog = items.fogUntil[0]! > now
    drawWorld(ctx, track, p.x, p.y, p.angle, fog)

    // Rita item-boxar på banan (syns i världen)
    for (const wp of track.items) {
      const ip = project(wp.x, wp.y, p.x, p.y, p.angle)
      if (!ip) continue
      drawItemBox(ctx, ip.sx, ip.sy, ip.scale)
    }

    const order = [...racers].sort((a, b) => {
      const pa = projectScore(a)
      const pb = projectScore(b)
      return pb - pa
    })
    const sortedDraw = [...racers].sort((a, b) => {
      const da = dist(a.kart.x, a.kart.y, p.x, p.y)
      const db = dist(b.kart.x, b.kart.y, p.x, p.y)
      return db - da
    })
    for (const r of sortedDraw) {
      drawKart(ctx, r.kart, character(r.charId), p.x, p.y, p.angle, r === racers[0])
    }
    const place = order.findIndex((r) => r === racers[0]) + 1
    const held = items.held[0]
    drawHud(ctx, {
      lap: racers[0]!.laps + 1,
      laps: LAPS,
      place,
      item: held ? ITEM_LABEL[held] : null,
      trackName: track.name,
      finished: !!racers[0]!.finished,
    })

    // Rita countdown
    if (countdown === 'countdown') {
      const num = Math.ceil(countdownTimer)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 72px ui-rounded, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(num), W / 2, H / 2 + 20)
      ctx.textAlign = 'left'
    } else if (countdown === 'go') {
      ctx.fillStyle = '#ffd700'
      ctx.font = 'bold 56px ui-rounded, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('KÖR!', W / 2, H / 2 + 18)
      ctx.textAlign = 'left'
    }

    // Rita minikarta
    drawMinimap(ctx, track, racers, p)

    // Rita synliga touch-knappar
    drawTouchButtons(ctx)
  }

  function projectScore(r: Racer): number {
    return r.laps * 10000 + r.wp * 10 - dist(r.kart.x, r.kart.y, track!.waypoints[r.wp]!.x, track!.waypoints[r.wp]!.y) * 0.01
  }

  function renderMenu(): void {
    if (screen === 'race') {
      overlay.innerHTML = ''
      overlay.style.pointerEvents = 'none'
      canvas.focus()
      return
    }
    overlay.style.pointerEvents = 'auto'
    if (screen === 'title') {
      overlay.innerHTML = `
        <div class="panel">
          <h1>Dinokompisar Rally</h1>
          <p>Ett kart-race i dalen. 3 varv. Inga elaka vapen.</p>
          <button data-go="char">Kör!</button>
        </div>`
    } else if (screen === 'char') {
      const charCards = CHARACTERS.map((c) => {
        const canvasId = `portrait-${c.id}`
        return `\n              <button class="card ${c.id === playerChar ? 'on' : ''}" data-char="${c.id}">\n                <canvas id="${canvasId}" width="80" height="80"></canvas>\n                <b>${c.name}</b>\n                <span>${c.blurb}</span>\n              </button>`
      }).join('')
      overlay.innerHTML = `
        <div class="panel">
          <h2>Välj kart</h2>
          <div class="grid">
            ${charCards}
          </div>
          <button data-go="track">Nästa</button>
        </div>`
      // Rita porträtt på canvas
      for (const c of CHARACTERS) {
        const el = document.getElementById(`portrait-${c.id}`) as HTMLCanvasElement | null
        if (el && portraitCtx) {
          portraitCtx.clearRect(0, 0, 80, 80)
          drawPortrait(portraitCtx, c, 80)
        }
      }
    } else if (screen === 'track') {
      overlay.innerHTML = `
        <div class="panel">
          <h2>Välj bana</h2>
          <div class="grid">
            ${TRACKS.map(
              (t) => `
              <button class="card ${t.id === trackId ? 'on' : ''}" data-track="${t.id}">
                <b>${t.name}</b>
              </button>`,
            ).join('')}
          </div>
          <button data-go="race">Starta race</button>
        </div>`
    } else if (screen === 'results') {
      overlay.innerHTML = `
        <div class="panel">
          <h2>Målgång!</h2>
          <ol>${places.map((n) => `<li>${n}</li>`).join('')}</ol>
          <button data-go="title">Hem</button>
          <button data-go="race">Kör igen</button>
        </div>`
    }
  }

  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
    const go = t.closest('[data-go]') as HTMLElement | null
    const ch = t.closest('[data-char]') as HTMLElement | null
    const tr = t.closest('[data-track]') as HTMLElement | null
    if (ch?.dataset.char) playerChar = ch.dataset.char as CharId
    if (tr?.dataset.track) trackId = tr.dataset.track as TrackId
    if (go?.dataset.go === 'char') screen = 'char'
    if (go?.dataset.go === 'track') screen = 'track'
    if (go?.dataset.go === 'race') {
      spawn()
      screen = 'race'
    }
    if (go?.dataset.go === 'title') screen = 'title'
    renderMenu()
  })

  renderMenu()
  let last = performance.now()
  let acc = 0
  const tick = (t: number) => {
    const dt = Math.min(0.05, (t - last) / 1000)
    last = t
    acc += dt
    while (acc >= 1 / 60) {
      step(1 / 60)
      acc -= 1 / 60
    }
    if (screen === 'race') paint()
    if (screen === 'results') {
      /* overlay handles */
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
