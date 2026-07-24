import { economyConfig, type ResourceWallet } from '../config/economyConfig'
import {
  getBuildingChildCount,
  getUnlockedChildCount,
} from '../game/buildingUpgrade'
import { isBuildingId } from '../game/buildingCatalog'
import {
  BUILDING_IDS,
  type BuildingId,
  type BuildingLevel,
  type BuildingProgress,
  type ChildBuildingLevel,
} from '../game/cityTypes'
import { addWalletSaturated } from '../game/resourceEconomy'

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
const V2_CHILD_COST_BY_TARGET_LEVEL = {
  1: { money: 5, oil: 0, materials: 0 },
  2: { money: 10, oil: 0, materials: 0 },
  3: { money: 20, oil: 0, materials: 0 },
  4: { money: 35, oil: 0, materials: 0 },
  5: { money: 50, oil: 0, materials: 0 },
  6: { money: 75, oil: 0, materials: 0 },
  7: { money: 105, oil: 0, materials: 0 },
  8: { money: 140, oil: 0, materials: 0 },
  9: { money: 180, oil: 0, materials: 0 },
  10: { money: 225, oil: 0, materials: 0 },
} as const

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

  return Object.fromEntries(
    BUILDING_IDS.map((id) => {
      const entry = isRecord(source[id]) ? source[id] : {}
      const level = normalizeInteger(entry.level, 1, 10) as BuildingLevel
      const rawChildren = Array.isArray(entry.childLevels)
        ? entry.childLevels
        : []
      const unlockedChildCount = getUnlockedChildCount(id, level)
      const childLevels = Array.from(
        { length: getBuildingChildCount(id) },
        (_, index) =>
          (index < unlockedChildCount
            ? normalizeInteger(rawChildren[index], 0, level)
            : 0) as ChildBuildingLevel,
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

function getHiddenChildRefund(
  value: unknown,
  progress: BuildingProgressById,
): ResourceWallet {
  const source = isRecord(value) ? value : {}
  let refund: ResourceWallet = { ...EMPTY_RESOURCES }

  for (const id of BUILDING_IDS) {
    const entry = isRecord(source[id]) ? source[id] : {}
    const rawChildren = Array.isArray(entry.childLevels)
      ? entry.childLevels
      : []
    const mainLevel = progress[id].level
    const unlockedChildCount = getUnlockedChildCount(id, mainLevel)
    for (
      let index = unlockedChildCount;
      index < getBuildingChildCount(id);
      index += 1
    ) {
      const oldLevel = normalizeInteger(rawChildren[index], 0, mainLevel)
      for (let targetLevel = 1; targetLevel <= oldLevel; targetLevel += 1) {
        refund = addWalletSaturated(
          refund,
          V2_CHILD_COST_BY_TARGET_LEVEL[
            targetLevel as keyof typeof V2_CHILD_COST_BY_TARGET_LEVEL
          ],
        )
      }
    }
  }

  return refund
}

function upgradeV2ShapeToV3(
  value: unknown,
  refundHiddenChildren: boolean,
  now: number,
): CityDurableState {
  const source = isRecord(value) ? value : {}
  const normalized = normalizeCityDurableState(source, now)
  if (!refundHiddenChildren) {
    return normalized
  }

  return {
    ...normalized,
    resources: addWalletSaturated(
      normalized.resources,
      getHiddenChildRefund(
        source.buildingProgress,
        normalized.buildingProgress,
      ),
    ),
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

      const maximum = id === 'clubhouse' ? 10 : 5
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

  const clubhouseLevel = provisional.clubhouse.level
  return Object.fromEntries(
    BUILDING_IDS.map((id) => {
      const maximum = id === 'clubhouse' ? 10 : Math.min(5, clubhouseLevel)
      const level = normalizeInteger(
        provisional[id].level,
        1,
        maximum,
      ) as BuildingLevel
      return [
        id,
        {
          level,
          childLevels: provisional[id].childLevels.map(
            (childLevel) =>
              normalizeInteger(childLevel, 0, level) as ChildBuildingLevel,
          ),
        },
      ]
    }),
  ) as BuildingProgressById
}

export function migrateCityState(
  persistedState: unknown,
  persistedVersion: number,
  now: number = Date.now(),
): CityDurableState {
  const source = isRecord(persistedState) ? persistedState : {}
  const migrationTime = validNow(now)
  if (persistedVersion < 2) {
    return upgradeV2ShapeToV3(
      {
        buildingProgress: migrateV1BuildingProgress(source.buildingProgress),
        resources: { ...EMPTY_RESOURCES },
        lastResourceUpdatedAt: migrationTime,
        activeProducerIds: [...INITIAL_PRODUCERS],
      },
      false,
      migrationTime,
    )
  }
  if (persistedVersion < 3) {
    return upgradeV2ShapeToV3(source, true, migrationTime)
  }

  return upgradeV2ShapeToV3(source, false, migrationTime)
}
