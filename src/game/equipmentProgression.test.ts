import { describe, expect, it } from 'vitest'
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
  it('creates zeroed gun levels and empty slots for all cars', () => {
    expect(Object.values(createInitialGunLevels())).toEqual([0, 0, 0, 0, 0])
    expect(
      Object.values(createInitialCarPartSlots()).every((slots) =>
        Object.values(slots).every((partId) => partId === null),
      ),
    ).toBe(true)
  })

  it('drops deterministic slot and quality sequences from the recycling yard', () => {
    const settlement = settlePartSalvage({
      inventory: [],
      spareParts: 0,
      nextPartSerial: 1,
      lastUpdatedAt: NOW,
      now: NOW + getPartDropIntervalMs(5) * 5,
      recyclingYardLevel: 5,
    })
    expect(settlement.received).toBe(5)
    expect(settlement.inventory.map((part) => part.slot)).toEqual([
      'engine',
      'armor',
      'tires',
      'turbo',
      'engine',
    ])
    expect(settlement.inventory.map((part) => part.quality)).toEqual([
      'worn',
      'tuned',
      'worn',
      'tuned',
      'elite',
    ])
    expect(settlement.nextPartSerial).toBe(6)
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
      slot: 'armor',
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
    slots['rust-fox'].armor = 'part-2'
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
          slot: 'armor',
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
