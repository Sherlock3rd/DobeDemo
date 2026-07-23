import { normalizeBuildingProgress } from '../game/buildingUpgrade'
import {
  BUILDING_IDS,
  type BuildingId,
  type BuildingProgress,
} from '../game/cityTypes'

export const CITY_STORAGE_KEY = 'dobe-city-progression-v1'

export type BuildingProgressById = Record<BuildingId, BuildingProgress>

export function createInitialBuildingProgress(): BuildingProgressById {
  return Object.fromEntries(
    BUILDING_IDS.map((id) => [id, { level: 1, completedFragments: 0 }]),
  ) as BuildingProgressById
}

/**
 * Normalizes an untrusted persisted value into a complete, valid
 * BuildingProgressById map. Handles legacy numeric levels, missing buildings,
 * out-of-range levels/fragments, level-10 fragment reset, and corrupt or
 * non-object roots. Unknown building ids are dropped; only the six known
 * buildings are ever present in the result.
 */
export function normalizeBuildingProgressById(
  value: unknown,
): BuildingProgressById {
  const source =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}

  return Object.fromEntries(
    BUILDING_IDS.map((id) => [id, normalizeBuildingProgress(source[id])]),
  ) as BuildingProgressById
}
