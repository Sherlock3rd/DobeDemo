import { describe, expect, it } from 'vitest'
import {
  CHAPTER_EQUIPMENT_UNLOCKS,
  PROGRESSION_UNLOCKS,
  carUnlockLevel,
  getBuildingUnlock,
  gunUnlockLevel,
  heroUnlockLevel,
  isCarUnlocked,
  isFeatureUnlocked,
  isGunUnlocked,
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
    expect(lv1).toHaveLength(7) // starter building/features, hero, car and gun
  })

  it('moves selected cars and guns from gang levels into chapter rewards', () => {
    expect(CHAPTER_EQUIPMENT_UNLOCKS).toEqual([
      {
        kind: 'car',
        carId: 'iron-fang',
        chapterNumber: 1,
        legacyRequiredLevel: 8,
      },
      {
        kind: 'gun',
        gunId: 'industrial-carbine',
        chapterNumber: 3,
        legacyRequiredLevel: 24,
      },
      {
        kind: 'car',
        carId: 'black-throne',
        chapterNumber: 5,
        legacyRequiredLevel: 40,
      },
    ])
    expect(
      PROGRESSION_UNLOCKS.some(
        (unlock) => unlock.kind === 'car' && unlock.carId === 'iron-fang',
      ),
    ).toBe(false)
    expect(isCarUnlocked('iron-fang', 50)).toBe(false)
    expect(isCarUnlocked('iron-fang', 1, ['iron-fang'])).toBe(true)
    expect(isGunUnlocked('industrial-carbine', 50)).toBe(false)
    expect(isGunUnlocked('industrial-carbine', 1, ['industrial-carbine'])).toBe(
      true,
    )
    expect(carUnlockLevel('iron-fang')).toBe(8)
    expect(gunUnlockLevel('industrial-carbine')).toBe(24)
  })
})
