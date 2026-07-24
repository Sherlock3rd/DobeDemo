import { describe, expect, it } from 'vitest'
import { hasAdventureRedDot, hasHeroesRedDot, hasRedDot } from './redDots'

describe('redDots', () => {
  it('adventure dot when a new stage is challengeable or chest has exp', () => {
    expect(hasAdventureRedDot(0, 0)).toBe(true)
    expect(hasAdventureRedDot(20, 0)).toBe(false)
    expect(hasAdventureRedDot(20, 5)).toBe(true)
  })

  it('heroes dot when any unlocked hero can level up with available exp', () => {
    expect(hasHeroesRedDot({ foreman: 1, anvil: 1, skyline: 1 }, 100, 1)).toBe(
      false,
    )
    expect(hasHeroesRedDot({ foreman: 1, anvil: 1, skyline: 1 }, 99, 2)).toBe(
      false,
    )
    expect(hasHeroesRedDot({ foreman: 1, anvil: 1, skyline: 1 }, 100, 2)).toBe(
      true,
    )
  })

  it('routes hasRedDot by bottom nav entry', () => {
    const input = {
      highestClearedStage: 0,
      claimableChestExp: 0,
      heroLevels: { foreman: 1, anvil: 1, skyline: 1 },
      sharedExp: 100,
      gangLevel: 2,
    }
    expect(hasRedDot('adventure', input)).toBe(true)
    expect(hasRedDot('heroes', input)).toBe(true)
    expect(hasRedDot('settings', input)).toBe(false)
  })
})
