import { getTouchButtons } from './render.ts'

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
  let touchSteer = 0
  let touchThrottle = 0
  let touchUseItem = false

  const down = (e: KeyboardEvent) => {
    keys.add(e.key)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
  }
  const up = (e: KeyboardEvent) => keys.delete(e.key)

  const buttons = getTouchButtons()

  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault()
    touchSteer = 0
    touchThrottle = 0
    touchUseItem = false
    const rect = target.getBoundingClientRect()
    for (const t of Array.from(e.touches)) {
      const x = t.clientX - rect.left
      const y = t.clientY - rect.top
      // Kolla item-knapp först
      if (x >= buttons.item.x && x < buttons.item.x + buttons.item.w &&
          y >= buttons.item.y && y < buttons.item.y + buttons.item.h) {
        touchUseItem = true
        continue
      }
      // Styr-knappar
      if (x >= buttons.left.x && x < buttons.left.x + buttons.left.w &&
          y >= buttons.left.y && y < buttons.left.y + buttons.left.h) {
        touchSteer = -1
        continue
      }
      if (x >= buttons.right.x && x < buttons.right.x + buttons.right.w &&
          y >= buttons.right.y && y < buttons.right.y + buttons.right.h) {
        touchSteer = 1
        continue
      }
      // Gas-knapp
      if (x >= buttons.up.x && x < buttons.up.x + buttons.up.w &&
          y >= buttons.up.y && y < buttons.up.y + buttons.up.h) {
        touchThrottle = 1
        continue
      }
    }
  }

  const onTouchEnd = () => {
    touchSteer = 0
    touchThrottle = 0
    touchUseItem = false
  }

  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  target.addEventListener('touchstart', onTouchStart, { passive: false })
  target.addEventListener('touchend', onTouchEnd)
  target.addEventListener('touchcancel', onTouchEnd)

  return {
    read() {
      let throttle = touchThrottle
      let steer = touchSteer
      if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) throttle = 1
      if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) throttle = -1
      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) steer = -1
      if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) steer = 1
      const useItem = touchUseItem || !!keys.has(' ')
      return { throttle, steer, useItem }
    },
    dispose() {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    },
  }
}
