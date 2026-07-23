import type { BuildingId, BuildingLevel } from '../game/cityTypes'
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
  version: 1
  resourceTickSeconds: 10
  maxOfflineSeconds: 28_800
  production: Partial<Record<BuildingId, ProductionConfig>>
  childUpgradeCostByTargetLevel: Record<BuildingLevel, ResourceCost>
  buildingUpgradeCostByTargetLevel: Partial<Record<BuildingLevel, ResourceCost>>
}

const PRODUCTION_BUILDING_IDS = [
  'repair-shop',
  'commercial-street',
  'gas-station',
  'metalworking-plant',
] as const satisfies readonly BuildingId[]

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

function parseProductionConfig(value: unknown, path: string): ProductionConfig {
  if (!isRecord(value)) {
    invalidConfig(path)
  }

  return {
    resource: parseResourceType(value.resource, `${path}.resource`),
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

export function parseEconomyConfig(value: unknown): EconomyConfig {
  if (!isRecord(value)) {
    invalidConfig('version')
  }

  if (value.version !== 1) {
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
    version: 1,
    resourceTickSeconds: parsePositiveInteger(
      value.resourceTickSeconds,
      'resourceTickSeconds',
    ) as 10,
    maxOfflineSeconds: parsePositiveInteger(
      value.maxOfflineSeconds,
      'maxOfflineSeconds',
    ) as 28_800,
    production: parseProduction(value.production),
    childUpgradeCostByTargetLevel,
    buildingUpgradeCostByTargetLevel,
  }
}

export const economyConfig = parseEconomyConfig(rawEconomyConfig)
