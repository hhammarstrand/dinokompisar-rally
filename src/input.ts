import { hitTouch, pointerToCanvas } from './render.ts'

export interface InputState {
  throttle: number
  steer: number
  useItem: boolean
}

export function attachInput(target: HTMLElement): {
  read: () => InputState
  dispose: () => void
} {
  const keys = new Set<string>()
  const fingers = new Map<number, ReturnType<typeof hitTouch>>()
  let itemPulse = false

  const down = (e: KeyboardEvent) => {
    keys.add(e.key)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
  }
  const up = (e: KeyboardEvent) => keys.delete(e.key)

  const sampleTouches = (e: TouchEvent) => {
    fingers.clear()
    const rect = target.getBoundingClientRect()
    for (const t of Array.from(e.touches)) {
      const p = pointerToCanvas(t.clientX, t.clientY, rect)
      const hit = hitTouch(p.x, p.y)
      fingers.set(t.identifier, hit)
      if (hit === 'item') itemPulse = true
    }
  }

  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault()
    sampleTouches(e)
  }
  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    sampleTouches(e)
  }
  const onTouchEnd = (e: TouchEvent) => {
    sampleTouches(e)
  }

  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  target.addEventListener('touchstart', onTouchStart, { passive: false })
  target.addEventListener('touchmove', onTouchMove, { passive: false })
  target.addEventListener('touchend', onTouchEnd)
  target.addEventListener('touchcancel', onTouchEnd)

  return {
    read() {
      let throttle = 0
      let steer = 0
      for (const hit of fingers.values()) {
        if (hit === 'gas') throttle = 1
        if (hit === 'brake') throttle = -1
        if (hit === 'left') steer = -1
        if (hit === 'right') steer = 1
      }
      if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) throttle = 1
      if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) throttle = -1
      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) steer = -1
      if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) steer = 1
      const useItem = itemPulse || keys.has(' ')
      itemPulse = false
      return { throttle, steer, useItem }
    },
    dispose() {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      target.removeEventListener('touchstart', onTouchStart)
      target.removeEventListener('touchmove', onTouchMove)
      target.removeEventListener('touchend', onTouchEnd)
      target.removeEventListener('touchcancel', onTouchEnd)
    },
  }
}
