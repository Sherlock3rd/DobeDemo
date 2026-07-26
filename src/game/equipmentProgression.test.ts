import { describe, expect, it, vi } from 'vitest'
import * as equipmentProgression from './equipmentProgression'
import {
  CAR_PART_QUALITY_INFO,
  CAR_PART_INVENTORY_LIMIT,
  CAR_PART_MAX_LEVEL,
  createInitialCarPartSlots,
  createInitialGunLevels,
  getCarPartRecycleValue,
  getCarPartUpgradeCost,
  getGunHeroAtk,
  getGunPursuitDamage,
  getGunUpgradeCost,
  getHighestInstalledPartLevel,
  getInstalledPartHeroBonus,
  getInstalledPartRacingBonus,
  getPartDropIntervalMs,
  settlePartSalvage,
} from './equipmentProgression'
import { CAR_PART_QUALITY_IDS } from './equipmentTypes'
import type {
  CarPartInstance,
  EquipmentProgressionSnapshot,
} from './equipmentTypes'

const NOW = 1_700_000_000_000

type PartSalvagePreview = {
  accumulatedMs: number
  batchCount: number
  progressInBatchMs: number
  intervalMs: number
  nextBatchInMs: number
  canClaim: boolean
  capped: boolean
}

function getPreviewFunction():
  | ((input: {
      lastUpdatedAt: number
      now: number
      recyclingYardLevel: number
    }) => PartSalvagePreview)
  | undefined {
  return (
    equipmentProgression as unknown as {
      getPartSalvagePreview?: (input: {
        lastUpdatedAt: number
        now: number
        recyclingYardLevel: number
      }) => PartSalvagePreview
    }
  ).getPartSalvagePreview
}

describe('equipmentProgression', () => {
  it('uses injectable weighted randomness at zero, exact, and near-one boundaries', () => {
    const pickWeighted = (
      equipmentProgression as unknown as {
        pickWeighted?: <T>(
          entries: readonly { value: T; weight: number }[],
          random: () => number,
        ) => T
      }
    ).pickWeighted

    expect(
      pickWeighted,
      'pickWeighted must be a public injectable-random API',
    ).toBeTypeOf('function')
    if (!pickWeighted) return

    const entries = [
      { value: 'first', weight: 0.25 },
      { value: 'last', weight: 0.75 },
    ] as const
    expect(pickWeighted(entries, () => 0)).toBe('first')
    expect(pickWeighted(entries, () => 0.249_999)).toBe('first')
    expect(pickWeighted(entries, () => 0.25)).toBe('last')
    expect(pickWeighted(entries, () => 1 - Number.EPSILON)).toBe('last')
  })

  it('defines five quality ids with their display and progression values', () => {
    expect(CAR_PART_QUALITY_IDS).toEqual([
      'common',
      'uncommon',
      'rare',
      'epic',
      'legendary',
    ])
    expect(CAR_PART_QUALITY_INFO).toEqual({
      common: {
        name: '普通',
        color: '#e2e8f0',
        strength: 1,
        recycleBase: 8,
        upgradeBase: 12,
      },
      uncommon: {
        name: '优秀',
        color: '#4ade80',
        strength: 1.25,
        recycleBase: 13,
        upgradeBase: 15,
      },
      rare: {
        name: '精良',
        color: '#60a5fa',
        strength: 1.5,
        recycleBase: 18,
        upgradeBase: 18,
      },
      epic: {
        name: '史诗',
        color: '#c084fc',
        strength: 2.2,
        recycleBase: 40,
        upgradeBase: 28,
      },
      legendary: {
        name: '传说',
        color: '#f97316',
        strength: 3.2,
        recycleBase: 90,
        upgradeBase: 44,
      },
    })
  })

  it('keeps salvage intervals and quantities while using the five-quality level table', () => {
    const getPartSalvageDropProfile = (
      equipmentProgression as unknown as {
        getPartSalvageDropProfile?: (level: number) => {
          intervalMs: number
          quantityWeights: Record<1 | 2 | 3 | 4, number>
          qualityWeights: Record<string, number>
        }
      }
    ).getPartSalvageDropProfile

    expect(
      getPartSalvageDropProfile,
      'getPartSalvageDropProfile must expose level-driven probabilities',
    ).toBeTypeOf('function')
    if (!getPartSalvageDropProfile) return

    const expected = [
      [30_000, [1, 0, 0, 0], [0.85, 0.15, 0, 0, 0]],
      [28_000, [1, 0, 0, 0], [0.75, 0.15, 0.1, 0, 0]],
      [26_000, [0.8, 0.2, 0, 0], [0.65, 0.2, 0.15, 0, 0]],
      [24_000, [0.6, 0.4, 0, 0], [0.55, 0.2, 0.2, 0.05, 0]],
      [22_000, [0.4, 0.6, 0, 0], [0.45, 0.2, 0.25, 0.1, 0]],
      [20_000, [0.25, 0.65, 0.1, 0], [0.35, 0.2, 0.3, 0.15, 0]],
      [18_000, [0.15, 0.65, 0.2, 0], [0.25, 0.2, 0.3, 0.2, 0.05]],
      [16_000, [0, 0.7, 0.3, 0], [0.18, 0.17, 0.3, 0.25, 0.1]],
      [14_000, [0, 0.5, 0.4, 0.1], [0.12, 0.13, 0.28, 0.32, 0.15]],
      [12_000, [0, 0.3, 0.5, 0.2], [0.08, 0.12, 0.25, 0.3, 0.25]],
    ] as const

    expected.forEach(([intervalMs, quantities, qualities], index) => {
      const profile = getPartSalvageDropProfile(index + 1)
      expect(profile.intervalMs).toBe(intervalMs)
      expect(Object.values(profile.quantityWeights)).toEqual(quantities)
      expect(
        CAR_PART_QUALITY_IDS.map((id) => profile.qualityWeights[id]),
      ).toEqual(qualities)
    })
  })

  it('raises gun and car-part hard caps to level 50', () => {
    expect(equipmentProgression.GUN_MAX_LEVEL).toBe(50)
    expect(equipmentProgression.CAR_PART_MAX_LEVEL).toBe(50)
  })

  it('creates zeroed gun levels and empty slots for all cars', () => {
    expect(Object.values(createInitialGunLevels())).toEqual([0, 0, 0, 0, 0])
    expect(
      Object.values(createInitialCarPartSlots()).every((slots) =>
        Object.values(slots).every((partId) => partId === null),
      ),
    ).toBe(true)
  })

  it('previews completed salvage batches without randomness or input mutation', () => {
    const getPartSalvagePreview = getPreviewFunction()
    expect(getPartSalvagePreview).toBeTypeOf('function')
    if (!getPartSalvagePreview) return
    const random = vi.spyOn(Math, 'random')
    const input = Object.freeze({
      lastUpdatedAt: NOW,
      now: NOW + 65_000,
      recyclingYardLevel: 1,
    })

    expect(getPartSalvagePreview(input)).toEqual({
      accumulatedMs: 65_000,
      batchCount: 2,
      progressInBatchMs: 5_000,
      intervalMs: 30_000,
      nextBatchInMs: 25_000,
      canClaim: true,
      capped: false,
    })
    expect(input).toEqual({
      lastUpdatedAt: NOW,
      now: NOW + 65_000,
      recyclingYardLevel: 1,
    })
    expect(random).not.toHaveBeenCalled()
  })

  it('caps salvage preview accumulation at eight hours', () => {
    const getPartSalvagePreview = getPreviewFunction()
    expect(getPartSalvagePreview).toBeTypeOf('function')
    if (!getPartSalvagePreview) return

    expect(
      getPartSalvagePreview({
        lastUpdatedAt: NOW,
        now: NOW + equipmentProgression.PART_IDLE_CAP_MS + 15_000,
        recyclingYardLevel: 2,
      }),
    ).toEqual({
      accumulatedMs: equipmentProgression.PART_IDLE_CAP_MS,
      batchCount: 1_028,
      progressInBatchMs: 16_000,
      intervalMs: 28_000,
      nextBatchInMs: 12_000,
      canClaim: true,
      capped: true,
    })
  })

  it('uses injected randomness for batch quantity and part quality', () => {
    const rolls = [0.99, 0, 0.08, 0.2, 0.99]
    const settlement = settlePartSalvage({
      inventory: [],
      spareParts: 0,
      nextPartSerial: 1,
      lastUpdatedAt: NOW,
      now: NOW + getPartDropIntervalMs(10),
      recyclingYardLevel: 10,
      random: () => rolls.shift() ?? 0,
    })
    expect(settlement.received).toBe(4)
    expect(settlement.inventory.map((part) => part.slot)).toEqual([
      'tires',
      'engine',
      'bumper',
      'suspension',
    ])
    expect(settlement.inventory.map((part) => part.quality)).toEqual([
      'common',
      'uncommon',
      'rare',
      'legendary',
    ])
    expect(settlement.nextPartSerial).toBe(5)
  })

  it('caps inventory and automatically recycles overflow drops', () => {
    const fullInventory = Array.from(
      { length: CAR_PART_INVENTORY_LIMIT },
      (_, index): CarPartInstance => ({
        id: `stored-${index}`,
        slot: 'engine',
        quality: 'common',
        level: 1,
      }),
    )
    const settlement = settlePartSalvage({
      inventory: fullInventory,
      spareParts: 0,
      nextPartSerial: 1,
      lastUpdatedAt: NOW,
      now: NOW + getPartDropIntervalMs(1) * 2,
      recyclingYardLevel: 1,
      random: () => 0,
    })
    expect(settlement.inventory).toHaveLength(CAR_PART_INVENTORY_LIMIT)
    expect(settlement.received).toBe(0)
    expect(settlement.autoRecycled).toBe(2)
    expect(settlement.spareParts).toBe(16)
  })

  it('prices upgrades and refunds base value plus part of invested parts', () => {
    const part: CarPartInstance = {
      id: 'part-1',
      slot: 'bumper',
      quality: 'uncommon',
      level: 1,
    }
    expect(getCarPartUpgradeCost(part)).toBe(15)
    expect(getCarPartUpgradeCost({ ...part, level: CAR_PART_MAX_LEVEL })).toBe(
      0,
    )
    expect(getCarPartRecycleValue({ ...part, level: 3 })).toBeGreaterThan(
      getCarPartRecycleValue(part),
    )
    expect(getGunUpgradeCost('rivet-smg', 0)).toBeGreaterThan(0)
  })

  it('applies installed part bonuses and gun levels to combat and racing', () => {
    const slots = createInitialCarPartSlots()
    slots['rust-fox'].engine = 'part-1'
    slots['rust-fox'].bumper = 'part-2'
    const progression: EquipmentProgressionSnapshot = {
      gunLevels: {
        ...createInitialGunLevels(),
        'rivet-smg': 5,
      },
      carPartInventory: [
        {
          id: 'part-1',
          slot: 'engine',
          quality: 'epic',
          level: 4,
        },
        {
          id: 'part-2',
          slot: 'bumper',
          quality: 'rare',
          level: 3,
        },
      ],
      carPartSlotsByCar: slots,
    }
    const heroBonus = getInstalledPartHeroBonus('rust-fox', progression)
    const racingBonus = getInstalledPartRacingBonus('rust-fox', progression)
    expect(getHighestInstalledPartLevel('rust-fox', progression)).toBe(4)
    expect(getHighestInstalledPartLevel('iron-fang', progression)).toBe(0)
    expect(heroBonus.atk).toBeGreaterThan(0)
    expect(heroBonus.hp).toBeGreaterThan(0)
    expect(racingBonus.acceleration).toBeGreaterThan(0)
    expect(racingBonus.durability).toBeGreaterThan(0)
    expect(getGunHeroAtk('rivet-smg', progression)).toBeGreaterThan(22)
    expect(getGunPursuitDamage('rivet-smg', 5)).toBeGreaterThan(13)
  })
})
