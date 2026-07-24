import {
  BUILDING_IDS,
  BUILDING_LEVELS,
  type BuildingId,
  type BuildingLevel,
} from '../game/cityTypes'
import rawEconomyConfig from './economy.config.json'

export const RESOURCE_TYPES = ['money', 'oil', 'materials'] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]

export interface ResourceWallet {
  money: number
  oil: number
  materials: number
}

export type ResourceCost = ResourceWallet

export interface ProductionConfig {
  resource: ResourceType
  basePerTick: number
  childLevelStep: number
  bonusPerStep: number
}

export interface EconomyConfig {
  version: 2
  resourceTickSeconds: 10
  maxOfflineSeconds: 28_800
  production: Partial<Record<BuildingId, ProductionConfig>>
  childUpgradeCostByTargetLevel: Record<BuildingLevel, ResourceCost>
  buildingUpgradeCostByTargetLevel: Partial<Record<BuildingLevel, ResourceCost>>
  buildingPowerById: Record<BuildingId, Record<BuildingLevel, number>>
}

const PRODUCTION_BUILDING_IDS = [
  'repair-shop',
  'commercial-street',
  'gas-station',
  'metalworking-plant',
] as const satisfies readonly BuildingId[]

const PRODUCTION_RESOURCE_BY_BUILDING: Record<
  (typeof PRODUCTION_BUILDING_IDS)[number],
  ResourceType
> = {
  'repair-shop': 'money',
  'commercial-street': 'money',
  'gas-station': 'oil',
  'metalworking-plant': 'materials',
}

const REQUIRED_RESOURCE_TICK_SECONDS = 10
const REQUIRED_MAX_OFFLINE_SECONDS = 28_800

const CHILD_UPGRADE_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
const BUILDING_UPGRADE_LEVELS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const

function invalidConfig(path: string): never {
  throw new Error(`Invalid economy config: ${path}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsePositiveInteger(value: unknown, path: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    invalidConfig(path)
  }

  return value
}

function parseExactPositiveInteger(
  value: unknown,
  path: string,
  expected: number,
): number {
  parsePositiveInteger(value, path)

  if (value !== expected) {
    invalidConfig(path)
  }

  return expected
}

function parseNonNegativeInteger(value: unknown, path: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    invalidConfig(path)
  }

  return value
}

function parsePower(value: unknown, path: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    invalidConfig(path)
  }
  return value
}

function parseResourceType(value: unknown, path: string): ResourceType {
  if (
    typeof value !== 'string' ||
    !RESOURCE_TYPES.includes(value as ResourceType)
  ) {
    invalidConfig(path)
  }

  return value as ResourceType
}

function parseResourceCost(value: unknown, path: string): ResourceCost {
  if (!isRecord(value)) {
    invalidConfig(path)
  }

  const keys = Object.keys(value)
  if (
    keys.length !== RESOURCE_TYPES.length ||
    !RESOURCE_TYPES.every((resourceType) => resourceType in value)
  ) {
    invalidConfig(path)
  }

  return {
    money: parseNonNegativeInteger(value.money, `${path}.money`),
    oil: parseNonNegativeInteger(value.oil, `${path}.oil`),
    materials: parseNonNegativeInteger(value.materials, `${path}.materials`),
  }
}

function parseProductionConfig(
  value: unknown,
  path: string,
  buildingId: (typeof PRODUCTION_BUILDING_IDS)[number],
): ProductionConfig {
  if (!isRecord(value)) {
    invalidConfig(path)
  }

  const resource = parseResourceType(value.resource, `${path}.resource`)
  if (resource !== PRODUCTION_RESOURCE_BY_BUILDING[buildingId]) {
    invalidConfig(`${path}.resource`)
  }

  return {
    resource,
    basePerTick: parseNonNegativeInteger(
      value.basePerTick,
      `${path}.basePerTick`,
    ),
    childLevelStep: parsePositiveInteger(
      value.childLevelStep,
      `${path}.childLevelStep`,
    ),
    bonusPerStep: parseNonNegativeInteger(
      value.bonusPerStep,
      `${path}.bonusPerStep`,
    ),
  }
}

function parseProduction(
  value: unknown,
): Partial<Record<BuildingId, ProductionConfig>> {
  if (!isRecord(value)) {
    invalidConfig('production')
  }

  const production: Partial<Record<BuildingId, ProductionConfig>> = {}

  for (const key of Object.keys(value)) {
    if (
      !PRODUCTION_BUILDING_IDS.includes(
        key as (typeof PRODUCTION_BUILDING_IDS)[number],
      )
    ) {
      invalidConfig(`production.${key}`)
    }
  }

  for (const buildingId of PRODUCTION_BUILDING_IDS) {
    if (!(buildingId in value)) {
      invalidConfig(`production.${buildingId}`)
    }

    production[buildingId] = parseProductionConfig(
      value[buildingId],
      `production.${buildingId}`,
      buildingId,
    )
  }

  return production
}

function parseCostByLevel(
  value: unknown,
  path: string,
  requiredLevels: readonly number[],
): Record<number, ResourceCost> {
  if (!isRecord(value)) {
    invalidConfig(path)
  }

  const costs: Record<number, ResourceCost> = {}

  for (const key of Object.keys(value)) {
    const level = Number(key)
    if (
      !Number.isInteger(level) ||
      !requiredLevels.includes(level) ||
      String(level) !== key
    ) {
      invalidConfig(`${path}.${key}`)
    }
  }

  for (const level of requiredLevels) {
    if (!(String(level) in value)) {
      invalidConfig(`${path}.${level}`)
    }

    costs[level] = parseResourceCost(value[String(level)], `${path}.${level}`)
  }

  return costs
}

function parseBuildingPowerById(
  value: unknown,
): Record<BuildingId, Record<BuildingLevel, number>> {
  if (!isRecord(value)) {
    invalidConfig('buildingPowerById')
  }

  for (const key of Object.keys(value)) {
    if (!BUILDING_IDS.includes(key as BuildingId)) {
      invalidConfig(`buildingPowerById.${key}`)
    }
  }

  const powerById = {} as Record<BuildingId, Record<BuildingLevel, number>>
  for (const buildingId of BUILDING_IDS) {
    const path = `buildingPowerById.${buildingId}`
    const powerByLevel = value[buildingId]
    if (!isRecord(powerByLevel)) {
      invalidConfig(path)
    }

    for (const key of Object.keys(powerByLevel)) {
      const level = Number(key)
      if (
        !Number.isInteger(level) ||
        !BUILDING_LEVELS.includes(level as BuildingLevel) ||
        String(level) !== key
      ) {
        invalidConfig(`${path}.${key}`)
      }
    }

    const parsedPower = {} as Record<BuildingLevel, number>
    for (const level of BUILDING_LEVELS) {
      const levelPath = `${path}.${level}`
      if (!(String(level) in powerByLevel)) {
        invalidConfig(levelPath)
      }
      parsedPower[level] = parsePower(powerByLevel[String(level)], levelPath)
    }

    for (const level of BUILDING_LEVELS.slice(1)) {
      const previousLevel = (level - 1) as BuildingLevel
      if (parsedPower[level] <= parsedPower[previousLevel]) {
        invalidConfig(`${path}.${level}`)
      }
    }
    powerById[buildingId] = parsedPower
  }

  return powerById
}

export function parseEconomyConfig(value: unknown): EconomyConfig {
  if (!isRecord(value)) {
    invalidConfig('version')
  }

  if (value.version !== 2) {
    invalidConfig('version')
  }

  const childUpgradeCostByTargetLevel = parseCostByLevel(
    value.childUpgradeCostByTargetLevel,
    'childUpgradeCostByTargetLevel',
    CHILD_UPGRADE_LEVELS,
  ) as Record<BuildingLevel, ResourceCost>

  const buildingUpgradeCostByTargetLevel = parseCostByLevel(
    value.buildingUpgradeCostByTargetLevel,
    'buildingUpgradeCostByTargetLevel',
    BUILDING_UPGRADE_LEVELS,
  ) as Partial<Record<BuildingLevel, ResourceCost>>

  return {
    version: 2,
    resourceTickSeconds: parseExactPositiveInteger(
      value.resourceTickSeconds,
      'resourceTickSeconds',
      REQUIRED_RESOURCE_TICK_SECONDS,
    ) as 10,
    maxOfflineSeconds: parseExactPositiveInteger(
      value.maxOfflineSeconds,
      'maxOfflineSeconds',
      REQUIRED_MAX_OFFLINE_SECONDS,
    ) as 28_800,
    production: parseProduction(value.production),
    childUpgradeCostByTargetLevel,
    buildingUpgradeCostByTargetLevel,
    buildingPowerById: parseBuildingPowerById(value.buildingPowerById),
  }
}

export const economyConfig = parseEconomyConfig(rawEconomyConfig)

export function getBuildingPower(
  buildingId: BuildingId,
  level: BuildingLevel,
): number {
  const power = economyConfig.buildingPowerById[buildingId]?.[level]
  if (!Number.isSafeInteger(power)) {
    throw new Error(
      `Invalid economy config: buildingPowerById.${buildingId}.${level}`,
    )
  }
  return power
}
