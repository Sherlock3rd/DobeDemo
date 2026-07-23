import { describe, expect, it } from 'vitest'
import { BUILDING_LEVELS, type BuildingLevel } from './cityTypes'
import {
  BUILDING_MAX_LEVEL,
  completeNextBuildingFragment,
  confirmBuildingLevelUp,
  getBuildingUpgradePercent,
  getRequiredFragmentCount,
  getTargetBuildingLevel,
  isBuildingReadyToLevelUp,
  normalizeBuildingLevel,
  normalizeBuildingProgress,
} from './buildingUpgrade'

describe('building upgrade rules', () => {
  it('defines every building level from 1 through 10', () => {
    expect(BUILDING_LEVELS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(BUILDING_MAX_LEVEL).toBe(10)
  })

  it.each([
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [8, 9],
    [9, 10],
    [10, 10],
  ] satisfies readonly (readonly [BuildingLevel, BuildingLevel])[])(
    'advances current level %i to target level %i',
    (level, targetLevel) => {
      expect(getTargetBuildingLevel(level)).toBe(targetLevel)
    },
  )

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const)(
    'requires the target level fragment count at Lv.%i',
    (level) => {
      expect(getRequiredFragmentCount(level)).toBe(
        level === BUILDING_MAX_LEVEL ? BUILDING_MAX_LEVEL : level + 1,
      )
    },
  )

  it('completes exactly one fragment without changing the building level', () => {
    const progress = { level: 4 as const, completedFragments: 2 }

    expect(completeNextBuildingFragment(progress)).toEqual({
      level: 4,
      completedFragments: 3,
    })
  })

  it('waits for confirmation after all target fragments are complete', () => {
    const progress = { level: 2 as const, completedFragments: 3 }

    expect(isBuildingReadyToLevelUp(progress)).toBe(true)
    expect(getBuildingUpgradePercent(progress)).toBe(100)
    expect(completeNextBuildingFragment(progress)).toBe(progress)
  })

  it('reports partial fragment progress as a percentage', () => {
    expect(
      getBuildingUpgradePercent({
        level: 1,
        completedFragments: 1,
      }),
    ).toBe(50)
  })

  it('does not confirm an incomplete target level', () => {
    const progress = { level: 5 as const, completedFragments: 5 }

    expect(isBuildingReadyToLevelUp(progress)).toBe(false)
    expect(confirmBuildingLevelUp(progress)).toBe(progress)
  })

  it('confirms a ready level atomically and clears fragment progress', () => {
    const progress = { level: 8 as const, completedFragments: 9 }

    expect(confirmBuildingLevelUp(progress)).toEqual({
      level: 9,
      completedFragments: 0,
    })
  })

  it('caps level 10 and keeps its progress complete', () => {
    const progress = { level: 10 as const, completedFragments: 0 }

    expect(getTargetBuildingLevel(progress.level)).toBe(10)
    expect(getBuildingUpgradePercent(progress)).toBe(100)
    expect(isBuildingReadyToLevelUp(progress)).toBe(false)
    expect(completeNextBuildingFragment(progress)).toBe(progress)
    expect(confirmBuildingLevelUp(progress)).toBe(progress)
  })

  it.each([
    [-5, 1],
    [1.9, 1],
    [6.8, 6],
    [99, 10],
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1],
    ['4', 1],
    [null, 1],
  ])('normalizes building level %j to %i', (value, expected) => {
    expect(normalizeBuildingLevel(value)).toBe(expected)
  })

  it('normalizes legacy numeric progress and malformed progress objects', () => {
    expect(normalizeBuildingProgress(7)).toEqual({
      level: 7,
      completedFragments: 0,
    })
    expect(
      normalizeBuildingProgress({
        level: 3.9,
        completedFragments: 99.8,
        ignored: true,
      }),
    ).toEqual({ level: 3, completedFragments: 4 })
    expect(
      normalizeBuildingProgress({
        level: 8,
        completedFragments: -4,
      }),
    ).toEqual({ level: 8, completedFragments: 0 })
    expect(
      normalizeBuildingProgress({
        level: 10,
        completedFragments: 10,
      }),
    ).toEqual({ level: 10, completedFragments: 0 })
    expect(
      normalizeBuildingProgress({
        level: Number.POSITIVE_INFINITY,
        completedFragments: Number.NaN,
      }),
    ).toEqual({ level: 1, completedFragments: 0 })
    expect(normalizeBuildingProgress(null)).toEqual({
      level: 1,
      completedFragments: 0,
    })
  })

  it('normalizes array input as default progress', () => {
    expect(normalizeBuildingProgress([8, 9])).toEqual({
      level: 1,
      completedFragments: 0,
    })
  })
})
