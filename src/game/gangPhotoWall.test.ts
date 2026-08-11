import { describe, expect, it } from 'vitest'
import {
  GANG_PHOTO_WALL,
  GANG_WALL_REWARD_IDS,
  getGangWallReward,
  getGangWallTierForReward,
  getGangWallTierForSystemLevel,
} from './gangPhotoWall'

describe('gang photo wall', () => {
  it('uses the ten Plan A hierarchy tiers with no more than two empty slots', () => {
    expect(GANG_PHOTO_WALL).toHaveLength(10)
    expect(GANG_PHOTO_WALL.map((tier) => tier.tier)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
    for (const tier of GANG_PHOTO_WALL) {
      expect(tier.slots.length).toBeGreaterThanOrEqual(1)
      expect(tier.slots.length).toBeLessThanOrEqual(5)
      const emptySlotCount = tier.slots.filter(
        (slot) => slot.kind === 'empty',
      ).length
      expect(emptySlotCount).toBeLessThanOrEqual(2)
    }
  })

  it('keeps the first repair shop as a standalone vacant building photo', () => {
    const repairShop = getGangWallReward('repair-shop-vacancy')
    expect(repairShop).toMatchObject({
      kind: 'building',
      name: '修车厂',
      position: '管理席位空置',
      buildingId: 'repair-shop',
      tags: ['building'],
    })
    expect(getGangWallTierForReward(repairShop.id).tier).toBe(1)
  })

  it('maps each reward to exactly one tier and preserves unique ids', () => {
    expect(new Set(GANG_WALL_REWARD_IDS).size).toBe(GANG_WALL_REWARD_IDS.length)
    for (const id of GANG_WALL_REWARD_IDS) {
      expect(getGangWallTierForReward(id).slots).toContainEqual(
        expect.objectContaining({ id }),
      )
    }
  })

  it('maps system levels onto the matching photo-wall rank', () => {
    expect(getGangWallTierForSystemLevel(1).tier).toBe(1)
    expect(getGangWallTierForSystemLevel(8).tier).toBe(2)
    expect(getGangWallTierForSystemLevel(43).tier).toBe(7)
    expect(getGangWallTierForSystemLevel(50).tier).toBe(10)
  })
})
