import raw from './equipment.config.json'
import {
  CAR_IDS,
  GUN_IDS,
  type CarId,
  type GunId,
} from '../game/equipmentTypes'

export interface CarDefinition {
  name: string
  description: string
  unlockGangLevel: number
  heroBonus: { hp: number; def: number }
  racing: {
    maxSpeed: number
    acceleration: number
    handlingMs: number
    durability: number
  }
  appearance: { body: string; accent: string }
}

export interface GunDefinition {
  name: string
  description: string
  unlockGangLevel: number
  heroBonus: { atk: number }
  pursuit: {
    damage: number
    cooldownMs: number
    range: number
    projectileSpeed: number
  }
  appearance: { metal: string; flash: string }
}

export interface EquipmentConfig {
  version: 1
  cars: Record<CarId, CarDefinition>
  guns: Record<GunId, GunDefinition>
}

function invalid(path: string): never {
  throw new Error(`Invalid equipment config: ${path}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') invalid(path)
  return value
}

function positiveInt(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) invalid(path)
  return value as number
}

function nonNegativeInt(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) invalid(path)
  return value as number
}

function parseCar(value: unknown, path: string): CarDefinition {
  if (!isRecord(value)) invalid(path)
  const bonus = value.heroBonus
  const racing = value.racing
  const appearance = value.appearance
  if (!isRecord(bonus)) invalid(`${path}.heroBonus`)
  if (!isRecord(racing)) invalid(`${path}.racing`)
  if (!isRecord(appearance)) invalid(`${path}.appearance`)
  return {
    name: text(value.name, `${path}.name`),
    description: text(value.description, `${path}.description`),
    unlockGangLevel: positiveInt(
      value.unlockGangLevel,
      `${path}.unlockGangLevel`,
    ),
    heroBonus: {
      hp: nonNegativeInt(bonus.hp, `${path}.heroBonus.hp`),
      def: nonNegativeInt(bonus.def, `${path}.heroBonus.def`),
    },
    racing: {
      maxSpeed: positiveInt(racing.maxSpeed, `${path}.racing.maxSpeed`),
      acceleration: positiveInt(
        racing.acceleration,
        `${path}.racing.acceleration`,
      ),
      handlingMs: positiveInt(racing.handlingMs, `${path}.racing.handlingMs`),
      durability: positiveInt(racing.durability, `${path}.racing.durability`),
    },
    appearance: {
      body: text(appearance.body, `${path}.appearance.body`),
      accent: text(appearance.accent, `${path}.appearance.accent`),
    },
  }
}

function parseGun(value: unknown, path: string): GunDefinition {
  if (!isRecord(value)) invalid(path)
  const bonus = value.heroBonus
  const pursuit = value.pursuit
  const appearance = value.appearance
  if (!isRecord(bonus)) invalid(`${path}.heroBonus`)
  if (!isRecord(pursuit)) invalid(`${path}.pursuit`)
  if (!isRecord(appearance)) invalid(`${path}.appearance`)
  return {
    name: text(value.name, `${path}.name`),
    description: text(value.description, `${path}.description`),
    unlockGangLevel: positiveInt(
      value.unlockGangLevel,
      `${path}.unlockGangLevel`,
    ),
    heroBonus: {
      atk: nonNegativeInt(bonus.atk, `${path}.heroBonus.atk`),
    },
    pursuit: {
      damage: positiveInt(pursuit.damage, `${path}.pursuit.damage`),
      cooldownMs: positiveInt(pursuit.cooldownMs, `${path}.pursuit.cooldownMs`),
      range: positiveInt(pursuit.range, `${path}.pursuit.range`),
      projectileSpeed: positiveInt(
        pursuit.projectileSpeed,
        `${path}.pursuit.projectileSpeed`,
      ),
    },
    appearance: {
      metal: text(appearance.metal, `${path}.appearance.metal`),
      flash: text(appearance.flash, `${path}.appearance.flash`),
    },
  }
}

export function parseEquipmentConfig(value: unknown): EquipmentConfig {
  if (!isRecord(value) || value.version !== 1) invalid('version')
  if (!isRecord(value.cars)) invalid('cars')
  if (!isRecord(value.guns)) invalid('guns')
  const cars = {} as Record<CarId, CarDefinition>
  const guns = {} as Record<GunId, GunDefinition>
  for (const id of CAR_IDS) {
    cars[id] = parseCar(value.cars[id], `cars.${id}`)
  }
  for (const id of GUN_IDS) {
    guns[id] = parseGun(value.guns[id], `guns.${id}`)
  }
  if (Object.keys(value.cars).length !== CAR_IDS.length) invalid('cars')
  if (Object.keys(value.guns).length !== GUN_IDS.length) invalid('guns')
  return { version: 1, cars, guns }
}

export const equipmentConfig = parseEquipmentConfig(raw)
