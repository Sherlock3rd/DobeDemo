import { equipmentConfig } from '../config/equipmentConfig'
import {
  CAR_IDS,
  CAR_PART_SLOT_IDS,
  GUN_IDS,
  type CarId,
  type CarPartInstance,
  type CarPartQuality,
  type CarPartSlot,
  type CarPartSlotsByCar,
  type EquipmentProgressionSnapshot,
  type GunId,
  type GunUpgradeLevels,
} from './equipmentTypes'

export const CAR_PART_MAX_LEVEL = 10
export const GUN_MAX_LEVEL = 10
export const CAR_PART_INVENTORY_LIMIT = 40
export const PART_IDLE_CAP_MS = 8 * 60 * 60 * 1000

export const CAR_PART_SLOT_INFO: Readonly<
  Record<CarPartSlot, { name: string; shortName: string; description: string }>
> = {
  engine: {
    name: '动力核心',
    shortName: '动力',
    description: '提高英雄攻击与车辆加速度。',
  },
  armor: {
    name: '装甲组件',
    shortName: '装甲',
    description: '提高英雄生命、防御与车辆耐久。',
  },
  tires: {
    name: '抓地轮胎',
    shortName: '轮胎',
    description: '提高英雄防御与车辆抓地性能。',
  },
  turbo: {
    name: '涡轮总成',
    shortName: '涡轮',
    description: '提高英雄攻击与车辆极速。',
  },
}

export const CAR_PART_QUALITY_INFO: Readonly<
  Record<
    CarPartQuality,
    { name: string; color: string; strength: number; recycleBase: number }
  >
> = {
  worn: {
    name: '旧件',
    color: '#94a3b8',
    strength: 1,
    recycleBase: 8,
  },
  tuned: {
    name: '调校',
    color: '#38bdf8',
    strength: 1.5,
    recycleBase: 18,
  },
  elite: {
    name: '精工',
    color: '#c084fc',
    strength: 2.2,
    recycleBase: 40,
  },
  prototype: {
    name: '原型',
    color: '#f59e0b',
    strength: 3.2,
    recycleBase: 90,
  },
}

export interface CarPartHeroBonus {
  hp: number
  atk: number
  def: number
}

export interface CarRacingUpgradeBonus {
  maxSpeed: number
  acceleration: number
  durability: number
  grip: number
}

export interface PartSalvageSettlement {
  inventory: CarPartInstance[]
  spareParts: number
  nextPartSerial: number
  nextUpdatedAt: number
  received: number
  autoRecycled: number
}

export function createInitialGunLevels(): GunUpgradeLevels {
  return Object.fromEntries(GUN_IDS.map((id) => [id, 0])) as GunUpgradeLevels
}

function createEmptySlots(): Record<CarPartSlot, string | null> {
  return {
    engine: null,
    armor: null,
    tires: null,
    turbo: null,
  }
}

export function createInitialCarPartSlots(): CarPartSlotsByCar {
  return Object.fromEntries(
    CAR_IDS.map((id) => [id, createEmptySlots()]),
  ) as CarPartSlotsByCar
}

export function getPartDropIntervalMs(recyclingYardLevel: number): number {
  const level = Math.min(10, Math.max(1, Math.trunc(recyclingYardLevel)))
  return 30_000 - (level - 1) * 2_000
}

function qualityForDrop(
  serial: number,
  recyclingYardLevel: number,
): CarPartQuality {
  if (recyclingYardLevel >= 8 && serial % 11 === 0) return 'prototype'
  if (recyclingYardLevel >= 5 && serial % 5 === 0) return 'elite'
  if (recyclingYardLevel >= 2 && serial % 2 === 0) return 'tuned'
  return 'worn'
}

function partForDrop(
  serial: number,
  recyclingYardLevel: number,
): CarPartInstance {
  return {
    id: `part-${serial}`,
    slot: CAR_PART_SLOT_IDS[(serial - 1) % CAR_PART_SLOT_IDS.length],
    quality: qualityForDrop(serial, recyclingYardLevel),
    level: 1,
  }
}

function saturatedAdd(left: number, right: number): number {
  return Math.min(
    Number.MAX_SAFE_INTEGER,
    Math.max(0, left) + Math.max(0, right),
  )
}

export function settlePartSalvage(input: {
  inventory: readonly CarPartInstance[]
  spareParts: number
  nextPartSerial: number
  lastUpdatedAt: number
  now: number
  recyclingYardLevel: number
}): PartSalvageSettlement {
  const inventory = input.inventory.map((part) => ({ ...part }))
  const fallback = {
    inventory,
    spareParts: input.spareParts,
    nextPartSerial: input.nextPartSerial,
    nextUpdatedAt: input.lastUpdatedAt,
    received: 0,
    autoRecycled: 0,
  }
  if (
    !Number.isFinite(input.now) ||
    !Number.isFinite(input.lastUpdatedAt) ||
    input.now <= input.lastUpdatedAt ||
    !Number.isInteger(input.recyclingYardLevel) ||
    input.recyclingYardLevel < 1
  ) {
    return fallback
  }

  const interval = getPartDropIntervalMs(input.recyclingYardLevel)
  const effectiveStart = Math.max(
    input.lastUpdatedAt,
    input.now - PART_IDLE_CAP_MS,
  )
  const dropCount = Math.floor((input.now - effectiveStart) / interval)
  if (dropCount <= 0) {
    return {
      ...fallback,
      nextUpdatedAt: effectiveStart,
    }
  }

  let serial = Math.max(1, Math.trunc(input.nextPartSerial))
  let spareParts = input.spareParts
  let received = 0
  let autoRecycled = 0
  for (let index = 0; index < dropCount; index += 1) {
    const part = partForDrop(serial, input.recyclingYardLevel)
    serial += 1
    if (inventory.length < CAR_PART_INVENTORY_LIMIT) {
      inventory.push(part)
      received += 1
    } else {
      spareParts = saturatedAdd(
        spareParts,
        CAR_PART_QUALITY_INFO[part.quality].recycleBase,
      )
      autoRecycled += 1
    }
  }

  return {
    inventory,
    spareParts,
    nextPartSerial: serial,
    nextUpdatedAt: effectiveStart + dropCount * interval,
    received,
    autoRecycled,
  }
}

export function getCarPartUpgradeCost(part: CarPartInstance): number {
  if (part.level >= CAR_PART_MAX_LEVEL) return 0
  const qualityBase: Record<CarPartQuality, number> = {
    worn: 12,
    tuned: 18,
    elite: 28,
    prototype: 44,
  }
  return qualityBase[part.quality] * part.level
}

export function getGunUpgradeCost(gunId: GunId, currentLevel: number): number {
  if (currentLevel >= GUN_MAX_LEVEL) return 0
  const tierCost = 38 + equipmentConfig.guns[gunId].unlockGangLevel * 2
  return tierCost * (currentLevel + 1)
}

export function getCarPartRecycleValue(part: CarPartInstance): number {
  let invested = 0
  for (let level = 1; level < part.level; level += 1) {
    invested += getCarPartUpgradeCost({ ...part, level })
  }
  return (
    CAR_PART_QUALITY_INFO[part.quality].recycleBase + Math.floor(invested * 0.7)
  )
}

function partStrength(part: CarPartInstance): number {
  return (
    CAR_PART_QUALITY_INFO[part.quality].strength * (1 + (part.level - 1) * 0.28)
  )
}

export function getCarPartHeroBonus(part: CarPartInstance): CarPartHeroBonus {
  const strength = partStrength(part)
  switch (part.slot) {
    case 'engine':
      return { hp: 0, atk: Math.round(10 * strength), def: 0 }
    case 'armor':
      return {
        hp: Math.round(70 * strength),
        atk: 0,
        def: Math.round(3 * strength),
      }
    case 'tires':
      return {
        hp: Math.round(25 * strength),
        atk: 0,
        def: Math.round(2 * strength),
      }
    case 'turbo':
      return { hp: 0, atk: Math.round(7 * strength), def: 0 }
  }
}

export function getCarPartRacingBonus(
  part: CarPartInstance,
): CarRacingUpgradeBonus {
  const strength = partStrength(part)
  switch (part.slot) {
    case 'engine':
      return {
        maxSpeed: 0,
        acceleration: 0.8 * strength,
        durability: 0,
        grip: 0,
      }
    case 'armor':
      return {
        maxSpeed: 0,
        acceleration: 0,
        durability: Math.round(5 * strength),
        grip: 0,
      }
    case 'tires':
      return {
        maxSpeed: 0.18 * strength,
        acceleration: 0,
        durability: 0,
        grip: 0.012 * strength,
      }
    case 'turbo':
      return {
        maxSpeed: 0.75 * strength,
        acceleration: 0.35 * strength,
        durability: 0,
        grip: 0,
      }
  }
}

export function getInstalledParts(
  carId: CarId,
  progression: EquipmentProgressionSnapshot | undefined,
): CarPartInstance[] {
  if (!progression) return []
  const inventoryById = new Map(
    progression.carPartInventory.map((part) => [part.id, part]),
  )
  return CAR_PART_SLOT_IDS.flatMap((slot) => {
    const partId = progression.carPartSlotsByCar[carId]?.[slot]
    const part = partId ? inventoryById.get(partId) : undefined
    return part && part.slot === slot ? [part] : []
  })
}

export function getInstalledPartHeroBonus(
  carId: CarId,
  progression: EquipmentProgressionSnapshot | undefined,
): CarPartHeroBonus {
  return getInstalledParts(carId, progression).reduce<CarPartHeroBonus>(
    (total, part) => {
      const bonus = getCarPartHeroBonus(part)
      return {
        hp: total.hp + bonus.hp,
        atk: total.atk + bonus.atk,
        def: total.def + bonus.def,
      }
    },
    { hp: 0, atk: 0, def: 0 },
  )
}

export function getInstalledPartRacingBonus(
  carId: CarId,
  progression: EquipmentProgressionSnapshot | undefined,
): CarRacingUpgradeBonus {
  return getInstalledParts(carId, progression).reduce<CarRacingUpgradeBonus>(
    (total, part) => {
      const bonus = getCarPartRacingBonus(part)
      return {
        maxSpeed: total.maxSpeed + bonus.maxSpeed,
        acceleration: total.acceleration + bonus.acceleration,
        durability: total.durability + bonus.durability,
        grip: total.grip + bonus.grip,
      }
    },
    { maxSpeed: 0, acceleration: 0, durability: 0, grip: 0 },
  )
}

export function getGunHeroAtk(
  gunId: GunId,
  progression: EquipmentProgressionSnapshot | undefined,
): number {
  const level = progression?.gunLevels[gunId] ?? 0
  return Math.round(
    equipmentConfig.guns[gunId].heroBonus.atk * (1 + level * 0.08),
  )
}

export function getGunPursuitDamage(gunId: GunId, gunLevel: number): number {
  const level = Math.min(GUN_MAX_LEVEL, Math.max(0, Math.trunc(gunLevel)))
  return Math.round(
    equipmentConfig.guns[gunId].pursuit.damage * (1 + level * 0.06),
  )
}

export function isPartInstalled(
  partId: string,
  slotsByCar: CarPartSlotsByCar,
): boolean {
  return CAR_IDS.some((carId) =>
    CAR_PART_SLOT_IDS.some((slot) => slotsByCar[carId][slot] === partId),
  )
}
