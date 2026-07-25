import { describe, expect, it } from 'vitest'
import * as equipmentProgression from './equipmentProgression'
import {
  CAR_PART_INVENTORY_LIMIT,
  CAR_PART_MAX_LEVEL,
  createInitialCarPartSlots,
  createInitialGunLevels,
  getCarPartRecycleValue,
  getCarPartUpgradeCost,
  getGunHeroAtk,
  getGunPursuitDamage,
  getGunUpgradeCost,
  getInstalledPartHeroBonus,
  getInstalledPartRacingBonus,
  getPartDropIntervalMs,
  settlePartSalvage,
} from './equipmentProgression'
import type {
  CarPartInstance,
  EquipmentProgressionSnapshot,
} from './equipmentTypes'

const NOW = 1_700_000_000_000

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

  it('configures level 10 salvage as 12 seconds, 2-4 parts, and 25% prototype', () => {
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

    const profile = getPartSalvageDropProfile(10)
    expect(profile.intervalMs).toBe(12_000)
    expect(profile.quantityWeights[1]).toBe(0)
    expect(profile.quantityWeights[2]).toBeGreaterThan(0)
    expect(profile.quantityWeights[3]).toBeGreaterThan(0)
    expect(profile.quantityWeights[4]).toBeGreaterThan(0)
    expect(profile.qualityWeights.prototype).toBe(0.25)
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

  it('uses injected randomness for batch quantity and part quality', () => {
    const rolls = [0.99, 0.05, 0.2, 0.5, 0.9]
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
      'worn',
      'tuned',
      'elite',
      'prototype',
    ])
    expect(settlement.nextPartSerial).toBe(5)
  })

  it('caps inventory and automatically recycles overflow drops', () => {
    const fullInventory = Array.from(
      { length: CAR_PART_INVENTORY_LIMIT },
      (_, index): CarPartInstance => ({
        id: `stored-${index}`,
        slot: 'engine',
        quality: 'worn',
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
      quality: 'tuned',
      level: 1,
    }
    expect(getCarPartUpgradeCost(part)).toBe(18)
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
          quality: 'elite',
          level: 4,
        },
        {
          id: 'part-2',
          slot: 'bumper',
          quality: 'tuned',
          level: 3,
        },
      ],
      carPartSlotsByCar: slots,
    }
    const heroBonus = getInstalledPartHeroBonus('rust-fox', progression)
    const racingBonus = getInstalledPartRacingBonus('rust-fox', progression)
    expect(heroBonus.atk).toBeGreaterThan(0)
    expect(heroBonus.hp).toBeGreaterThan(0)
    expect(racingBonus.acceleration).toBeGreaterThan(0)
    expect(racingBonus.durability).toBeGreaterThan(0)
    expect(getGunHeroAtk('rivet-smg', progression)).toBeGreaterThan(22)
    expect(getGunPursuitDamage('rivet-smg', 5)).toBeGreaterThan(13)
  })
})
