export interface InputState {
  throttle: number
  steer: number
}

export function attachInput(target: HTMLElement): {
  read: () => InputState
  dispose: () => void
} {
  const keys = new Set<string>()
  let touchSteer = 0
  let touchThrottle = 0

  const down = (e: KeyboardEvent) => {
    keys.add(e.key)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
  }
  const up = (e: KeyboardEvent) => keys.delete(e.key)

  const onTouch = (e: TouchEvent) => {
    e.preventDefault()
    touchSteer = 0
    touchThrottle = 0
    const rect = target.getBoundingClientRect()
    for (const t of Array.from(e.touches)) {
      const x = (t.clientX - rect.left) / rect.width
      const y = (t.clientY - rect.top) / rect.height
      if (x < 0.45) touchSteer = x < 0.22 ? -1 : 1
      else touchThrottle = y < 0.55 ? 1 : -1
    }
  }
  const clearTouch = () => {
    touchSteer = 0
    touchThrottle = 0
  }

  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  target.addEventListener('touchstart', onTouch, { passive: false })
  target.addEventListener('touchmove', onTouch, { passive: false })
  target.addEventListener('touchend', clearTouch)
  target.addEventListener('touchcancel', clearTouch)

  return {
    read() {
      let throttle = touchThrottle
      let steer = touchSteer
      if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) throttle = 1
      if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) throttle = -1
      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) steer = -1
      if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) steer = 1
      return { throttle, steer }
    },
    dispose() {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    },
  }
}
