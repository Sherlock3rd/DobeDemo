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

export const CAR_PART_MAX_LEVEL = 50
export const GUN_MAX_LEVEL = 50
export const CAR_PART_INVENTORY_LIMIT = 40
export const PART_IDLE_CAP_MS = 8 * 60 * 60 * 1000

export type RandomSource = () => number
export type PartDropQuantity = 1 | 2 | 3 | 4

export interface PartSalvageDropProfile {
  intervalMs: number
  quantityWeights: Readonly<Record<PartDropQuantity, number>>
  qualityWeights: Readonly<Record<CarPartQuality, number>>
}

const PART_SALVAGE_DROP_PROFILES: readonly PartSalvageDropProfile[] = [
  {
    intervalMs: 30_000,
    quantityWeights: { 1: 1, 2: 0, 3: 0, 4: 0 },
    qualityWeights: { worn: 1, tuned: 0, elite: 0, prototype: 0 },
  },
  {
    intervalMs: 28_000,
    quantityWeights: { 1: 1, 2: 0, 3: 0, 4: 0 },
    qualityWeights: { worn: 0.9, tuned: 0.1, elite: 0, prototype: 0 },
  },
  {
    intervalMs: 26_000,
    quantityWeights: { 1: 0.8, 2: 0.2, 3: 0, 4: 0 },
    qualityWeights: { worn: 0.8, tuned: 0.2, elite: 0, prototype: 0 },
  },
  {
    intervalMs: 24_000,
    quantityWeights: { 1: 0.6, 2: 0.4, 3: 0, 4: 0 },
    qualityWeights: { worn: 0.7, tuned: 0.25, elite: 0.05, prototype: 0 },
  },
  {
    intervalMs: 22_000,
    quantityWeights: { 1: 0.4, 2: 0.6, 3: 0, 4: 0 },
    qualityWeights: { worn: 0.6, tuned: 0.3, elite: 0.1, prototype: 0 },
  },
  {
    intervalMs: 20_000,
    quantityWeights: { 1: 0.25, 2: 0.65, 3: 0.1, 4: 0 },
    qualityWeights: { worn: 0.5, tuned: 0.35, elite: 0.15, prototype: 0 },
  },
  {
    intervalMs: 18_000,
    quantityWeights: { 1: 0.15, 2: 0.65, 3: 0.2, 4: 0 },
    qualityWeights: { worn: 0.4, tuned: 0.35, elite: 0.2, prototype: 0.05 },
  },
  {
    intervalMs: 16_000,
    quantityWeights: { 1: 0, 2: 0.7, 3: 0.3, 4: 0 },
    qualityWeights: { worn: 0.3, tuned: 0.35, elite: 0.25, prototype: 0.1 },
  },
  {
    intervalMs: 14_000,
    quantityWeights: { 1: 0, 2: 0.5, 3: 0.4, 4: 0.1 },
    qualityWeights: { worn: 0.2, tuned: 0.35, elite: 0.3, prototype: 0.15 },
  },
  {
    intervalMs: 12_000,
    quantityWeights: { 1: 0, 2: 0.3, 3: 0.5, 4: 0.2 },
    qualityWeights: { worn: 0.1, tuned: 0.3, elite: 0.35, prototype: 0.25 },
  },
]

export const CAR_PART_SLOT_INFO: Readonly<
  Record<CarPartSlot, { name: string; shortName: string; description: string }>
> = {
  tires: {
    name: '高抓地轮胎',
    shortName: '轮胎',
    description: '提高英雄防御与车辆抓地性能。',
  },
  engine: {
    name: '强化引擎',
    shortName: '引擎',
    description: '提高英雄攻击、车辆极速与加速度。',
  },
  bumper: {
    name: '防撞保险杠',
    shortName: '保险杠',
    description: '提高英雄生命、防御与车辆耐久。',
  },
  suspension: {
    name: '运动悬挂',
    shortName: '悬挂',
    description: '提高英雄防御、车辆抓地与加速稳定性。',
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
    tires: null,
    engine: null,
    bumper: null,
    suspension: null,
  }
}

export function createInitialCarPartSlots(): CarPartSlotsByCar {
  return Object.fromEntries(
    CAR_IDS.map((id) => [id, createEmptySlots()]),
  ) as CarPartSlotsByCar
}

export function getPartDropIntervalMs(recyclingYardLevel: number): number {
  return getPartSalvageDropProfile(recyclingYardLevel).intervalMs
}

export function getPartSalvageDropProfile(
  recyclingYardLevel: number,
): PartSalvageDropProfile {
  const level = Math.min(10, Math.max(1, Math.trunc(recyclingYardLevel)))
  return PART_SALVAGE_DROP_PROFILES[level - 1]
}

export function pickWeighted<T>(
  entries: readonly { value: T; weight: number }[],
  random: RandomSource = Math.random,
): T {
  if (entries.length === 0) throw new RangeError('Weighted entries are empty')
  if (entries.some(({ weight }) => !Number.isFinite(weight) || weight < 0)) {
    throw new RangeError('Weights must be finite and non-negative')
  }
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  if (!Number.isFinite(total) || total <= 0) {
    throw new RangeError('At least one weight must be positive')
  }
  const roll = random()
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new RangeError('Random source must return a value in [0, 1)')
  }
  let cursor = roll * total
  for (const entry of entries) {
    cursor -= entry.weight
    if (cursor < 0 && entry.weight > 0) return entry.value
  }
  const fallback = [...entries].reverse().find(({ weight }) => weight > 0)
  if (!fallback) throw new RangeError('At least one weight must be positive')
  return fallback.value
}

function partForDrop(serial: number, quality: CarPartQuality): CarPartInstance {
  return {
    id: `part-${serial}`,
    slot: CAR_PART_SLOT_IDS[(serial - 1) % CAR_PART_SLOT_IDS.length],
    quality,
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
  random?: RandomSource
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

  const profile = getPartSalvageDropProfile(input.recyclingYardLevel)
  const interval = profile.intervalMs
  const effectiveStart = Math.max(
    input.lastUpdatedAt,
    input.now - PART_IDLE_CAP_MS,
  )
  const batchCount = Math.floor((input.now - effectiveStart) / interval)
  if (batchCount <= 0) {
    return {
      ...fallback,
      nextUpdatedAt: effectiveStart,
    }
  }

  let serial = Math.max(1, Math.trunc(input.nextPartSerial))
  let spareParts = input.spareParts
  let received = 0
  let autoRecycled = 0
  const random = input.random ?? Math.random
  const quantityEntries = (
    Object.entries(profile.quantityWeights) as [string, number][]
  ).map(([value, weight]) => ({
    value: Number(value) as PartDropQuantity,
    weight,
  }))
  const qualityEntries = (
    Object.entries(profile.qualityWeights) as [CarPartQuality, number][]
  ).map(([value, weight]) => ({ value, weight }))
  for (let batch = 0; batch < batchCount; batch += 1) {
    const quantity = pickWeighted(quantityEntries, random)
    for (let index = 0; index < quantity; index += 1) {
      const quality = pickWeighted(qualityEntries, random)
      const part = partForDrop(serial, quality)
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
  }

  return {
    inventory,
    spareParts,
    nextPartSerial: serial,
    nextUpdatedAt: effectiveStart + batchCount * interval,
    received,
    autoRecycled,
  }
}

export function getEquipmentLevelMultiplier(
  level: number,
  growthThroughLevel10: number,
  growthAfterLevel10: number,
  startsAtLevelOne = false,
): number {
  const normalized = Math.max(startsAtLevelOne ? 1 : 0, Math.trunc(level))
  const upgrades = startsAtLevelOne ? normalized - 1 : normalized
  const earlyUpgrades = Math.min(10 - (startsAtLevelOne ? 1 : 0), upgrades)
  const lateUpgrades = Math.max(0, upgrades - earlyUpgrades)
  return (
    1 + earlyUpgrades * growthThroughLevel10 + lateUpgrades * growthAfterLevel10
  )
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
    CAR_PART_QUALITY_INFO[part.quality].strength *
    getEquipmentLevelMultiplier(part.level, 0.28, 0.08, true)
  )
}

export function getCarPartHeroBonus(part: CarPartInstance): CarPartHeroBonus {
  const strength = partStrength(part)
  switch (part.slot) {
    case 'tires':
      return {
        hp: Math.round(25 * strength),
        atk: 0,
        def: Math.round(2 * strength),
      }
    case 'engine':
      return { hp: 0, atk: Math.round(10 * strength), def: 0 }
    case 'bumper':
      return {
        hp: Math.round(70 * strength),
        atk: 0,
        def: Math.round(3 * strength),
      }
    case 'suspension':
      return {
        hp: Math.round(25 * strength),
        atk: 0,
        def: Math.round(2 * strength),
      }
  }
}

export function getCarPartRacingBonus(
  part: CarPartInstance,
): CarRacingUpgradeBonus {
  const strength = partStrength(part)
  switch (part.slot) {
    case 'tires':
      return {
        maxSpeed: 0.18 * strength,
        acceleration: 0,
        durability: 0,
        grip: 0.012 * strength,
      }
    case 'engine':
      return {
        maxSpeed: 0.75 * strength,
        acceleration: 0.8 * strength,
        durability: 0,
        grip: 0,
      }
    case 'bumper':
      return {
        maxSpeed: 0,
        acceleration: 0,
        durability: Math.round(5 * strength),
        grip: 0,
      }
    case 'suspension':
      return {
        acceleration: 0.35 * strength,
        durability: 0,
        maxSpeed: 0,
        grip: 0.01 * strength,
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
    equipmentConfig.guns[gunId].heroBonus.atk *
      getEquipmentLevelMultiplier(level, 0.08, 0.025),
  )
}

export function getGunPursuitDamage(gunId: GunId, gunLevel: number): number {
  const level = Math.min(GUN_MAX_LEVEL, Math.max(0, Math.trunc(gunLevel)))
  return Math.round(
    equipmentConfig.guns[gunId].pursuit.damage *
      getEquipmentLevelMultiplier(level, 0.06, 0.02),
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
