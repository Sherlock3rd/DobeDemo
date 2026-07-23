import { economyConfig, type ResourceWallet } from '../config/economyConfig'
import {
  getBuildingChildCount,
  getBuildingMaxLevel,
} from '../game/buildingUpgrade'
import { isBuildingId } from '../game/buildingCatalog'
import {
  BUILDING_IDS,
  type BuildingId,
  type BuildingLevel,
  type BuildingProgress,
  type ChildBuildingLevel,
} from '../game/cityTypes'

export const CITY_STORAGE_KEY = 'dobe-city-progression-v1'

export type BuildingProgressById = Record<BuildingId, BuildingProgress>

export interface CityDurableState {
  buildingProgress: BuildingProgressById
  resources: ResourceWallet
  lastResourceUpdatedAt: number
  activeProducerIds: BuildingId[]
}

const INITIAL_PRODUCERS: BuildingId[] = ['repair-shop']
const EMPTY_RESOURCES: ResourceWallet = { money: 0, oil: 0, materials: 0 }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return minimum
  }
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)))
}

export function createInitialBuildingProgress(): BuildingProgressById {
  return Object.fromEntries(
    BUILDING_IDS.map((id) => [
      id,
      { level: 1, childLevels: Array(getBuildingChildCount(id)).fill(0) },
    ]),
  ) as BuildingProgressById
}

export function normalizeBuildingProgressById(
  value: unknown,
  now: number = Date.now(),
): BuildingProgressById {
  void now
  const source = isRecord(value) ? value : {}
  const clubhouseSource = isRecord(source.clubhouse) ? source.clubhouse : {}
  const clubhouseLevel = normalizeInteger(
    clubhouseSource.level,
    1,
    getBuildingMaxLevel('clubhouse'),
  ) as BuildingLevel

  return Object.fromEntries(
    BUILDING_IDS.map((id) => {
      const entry = isRecord(source[id]) ? source[id] : {}
      const ownMaximum = getBuildingMaxLevel(id)
      const maximum =
        id === 'clubhouse' ? ownMaximum : Math.min(ownMaximum, clubhouseLevel)
      const level = normalizeInteger(entry.level, 1, maximum) as BuildingLevel
      const rawChildren = Array.isArray(entry.childLevels)
        ? entry.childLevels
        : []
      const childLevels = Array.from(
        { length: getBuildingChildCount(id) },
        (_, index) =>
          normalizeInteger(rawChildren[index], 0, level) as ChildBuildingLevel,
      )
      return [id, { level, childLevels }]
    }),
  ) as BuildingProgressById
}

function normalizeResources(value: unknown): ResourceWallet {
  const source = isRecord(value) ? value : {}
  return {
    money: normalizeInteger(source.money, 0, Number.MAX_SAFE_INTEGER),
    oil: normalizeInteger(source.oil, 0, Number.MAX_SAFE_INTEGER),
    materials: normalizeInteger(source.materials, 0, Number.MAX_SAFE_INTEGER),
  }
}

function normalizeActiveProducerIds(value: unknown): BuildingId[] {
  if (!Array.isArray(value)) {
    return [...INITIAL_PRODUCERS]
  }

  return value.reduce<BuildingId[]>((result, item) => {
    if (
      typeof item === 'string' &&
      isBuildingId(item) &&
      economyConfig.production[item] !== undefined &&
      !result.includes(item)
    ) {
      result.push(item)
    }
    return result
  }, [])
}

function validNow(now: number): number {
  return Number.isFinite(now) ? now : Date.now()
}

export function normalizeCityDurableState(
  value: unknown,
  now: number = Date.now(),
): CityDurableState {
  const source = isRecord(value) ? value : {}
  const fallbackNow = validNow(now)
  return {
    buildingProgress: normalizeBuildingProgressById(source.buildingProgress),
    resources: normalizeResources(source.resources),
    lastResourceUpdatedAt:
      typeof source.lastResourceUpdatedAt === 'number' &&
      Number.isFinite(source.lastResourceUpdatedAt)
        ? source.lastResourceUpdatedAt
        : fallbackNow,
    activeProducerIds: normalizeActiveProducerIds(source.activeProducerIds),
  }
}

function migrateV1BuildingProgress(value: unknown): BuildingProgressById {
  const source = isRecord(value) ? value : {}
  const provisional = Object.fromEntries(
    BUILDING_IDS.map((id) => {
      const entry = isRecord(source[id]) ? source[id] : null
      if (!entry) {
        return [
          id,
          { level: 1, childLevels: Array(getBuildingChildCount(id)).fill(0) },
        ]
      }

      const maximum = getBuildingMaxLevel(id)
      const oldLevel = normalizeInteger(entry.level, 1, maximum)
      const oldTarget = Math.min(maximum, oldLevel + 1)
      const completed = normalizeInteger(entry.completedFragments, 0, oldTarget)
      const level = (completed > 0 ? oldTarget : oldLevel) as BuildingLevel
      const childLevels = Array.from(
        { length: getBuildingChildCount(id) },
        (_, index) =>
          (index < completed
            ? oldTarget
            : index < oldLevel
              ? oldLevel
              : 0) as ChildBuildingLevel,
      )
      return [id, { level, childLevels }]
    }),
  ) as BuildingProgressById

  return normalizeBuildingProgressById(provisional)
}

export function migrateCityState(
  persistedState: unknown,
  persistedVersion: number,
  now: number = Date.now(),
): CityDurableState {
  const source = isRecord(persistedState) ? persistedState : {}
  const migrationTime = validNow(now)
  if (persistedVersion < 2) {
    return {
      buildingProgress: migrateV1BuildingProgress(source.buildingProgress),
      resources: { ...EMPTY_RESOURCES },
      lastResourceUpdatedAt: migrationTime,
      activeProducerIds: [...INITIAL_PRODUCERS],
    }
  }

  return normalizeCityDurableState(source, migrationTime)
}
