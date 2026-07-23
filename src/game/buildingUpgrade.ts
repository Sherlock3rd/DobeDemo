import {
  BUILDING_LEVELS,
  type BuildingLevel,
  type BuildingProgress,
} from './cityTypes'

export const BUILDING_MAX_LEVEL = 10

export function normalizeBuildingLevel(value: unknown): BuildingLevel {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1
  }

  const normalized = Math.min(
    BUILDING_MAX_LEVEL,
    Math.max(BUILDING_LEVELS[0], Math.trunc(value)),
  )

  return BUILDING_LEVELS[normalized - 1]
}

export function getTargetBuildingLevel(level: BuildingLevel): BuildingLevel {
  return level === BUILDING_MAX_LEVEL
    ? BUILDING_MAX_LEVEL
    : BUILDING_LEVELS[level]
}

export function getRequiredFragmentCount(level: BuildingLevel): number {
  return getTargetBuildingLevel(level)
}

export function normalizeBuildingProgress(value: unknown): BuildingProgress {
  const source =
    typeof value === 'number'
      ? { level: value }
      : typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
  const level = normalizeBuildingLevel(source.level)

  if (level === BUILDING_MAX_LEVEL) {
    return { level, completedFragments: 0 }
  }

  const rawFragments = source.completedFragments
  const completedFragments =
    typeof rawFragments === 'number' && Number.isFinite(rawFragments)
      ? Math.min(
          getRequiredFragmentCount(level),
          Math.max(0, Math.trunc(rawFragments)),
        )
      : 0

  return { level, completedFragments }
}

export function getBuildingUpgradePercent(progress: BuildingProgress): number {
  if (progress.level === BUILDING_MAX_LEVEL) {
    return 100
  }

  return (
    (progress.completedFragments / getRequiredFragmentCount(progress.level)) *
    100
  )
}

export function isBuildingReadyToLevelUp(progress: BuildingProgress): boolean {
  return (
    progress.level < BUILDING_MAX_LEVEL &&
    progress.completedFragments === getRequiredFragmentCount(progress.level)
  )
}

export function completeNextBuildingFragment(
  progress: BuildingProgress,
): BuildingProgress {
  if (
    progress.level === BUILDING_MAX_LEVEL ||
    progress.completedFragments >= getRequiredFragmentCount(progress.level)
  ) {
    return progress
  }

  return {
    ...progress,
    completedFragments: progress.completedFragments + 1,
  }
}

export function confirmBuildingLevelUp(
  progress: BuildingProgress,
): BuildingProgress {
  if (!isBuildingReadyToLevelUp(progress)) {
    return progress
  }

  return {
    level: getTargetBuildingLevel(progress.level),
    completedFragments: 0,
  }
}
