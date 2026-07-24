import { describe, expect, it } from 'vitest'
import {
  PROGRESSION_UNLOCKS,
  getBuildingUnlock,
  heroUnlockLevel,
  isFeatureUnlocked,
  isHeroUnlocked,
} from './progressionUnlocks'

describe('progression unlocks', () => {
  it('derives building unlocks in the legacy order/shape', () => {
    expect(getBuildingUnlock('repair-shop')).toEqual({
      buildingId: 'repair-shop',
      requiredLevel: 1,
      roleTitle: 'Prospect',
    })
    expect(getBuildingUnlock('clubhouse')?.requiredLevel).toBe(40)
    expect(getBuildingUnlock('unknown')).toBeNull()
  })

  it('exposes hero unlock levels and gang-derived hero unlocks', () => {
    expect(heroUnlockLevel('foreman')).toBe(1)
    expect(heroUnlockLevel('anvil')).toBe(12)
    expect(heroUnlockLevel('skyline')).toBe(28)
    expect(isHeroUnlocked('anvil', 11)).toBe(false)
    expect(isHeroUnlocked('anvil', 12)).toBe(true)
    expect(isHeroUnlocked('skyline', 50)).toBe(true)
  })

  it('marks adventure and heroes features unlocked at Lv.1', () => {
    expect(isFeatureUnlocked('adventure', 1)).toBe(true)
    expect(isFeatureUnlocked('heroes', 1)).toBe(true)
  })

  it('allows multiple unlocks at level 1', () => {
    const lv1 = PROGRESSION_UNLOCKS.filter((u) => u.requiredLevel === 1)
    expect(lv1).toHaveLength(4) // repair-shop building + adventure/heroes feature + foreman hero
  })
})
