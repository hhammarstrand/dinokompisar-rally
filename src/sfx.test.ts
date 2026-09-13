import { describe, expect, it } from 'vitest'
import { countdownHz, goHz } from './sfx.ts'

describe('sfx', () => {
  it('raises pitch through 3-2-1 then GO', () => {
    expect(countdownHz(3)).toBeLessThan(countdownHz(2))
    expect(countdownHz(2)).toBeLessThan(countdownHz(1))
    expect(goHz()).toBeGreaterThan(countdownHz(1))
  })
})
