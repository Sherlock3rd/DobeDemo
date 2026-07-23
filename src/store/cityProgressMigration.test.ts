import { describe, expect, it } from 'vitest'
import { BUILDING_IDS } from '../game/cityTypes'
import {
  CITY_STORAGE_KEY,
  createInitialBuildingProgress,
  migrateCityState,
  normalizeCityDurableState,
} from './cityProgressMigration'

const MIGRATION_TIME = 1_700_000_000_000

describe('city progress v2 defaults', () => {
  it('keeps the documented storage key', () => {
    expect(CITY_STORAGE_KEY).toBe('dobe-city-progression-v1')
  })

  it('creates canonical 5/10 child arrays without legacy fields', () => {
    const progress = createInitialBuildingProgress()

    expect(progress['repair-shop']).toEqual({
      level: 1,
      childLevels: [0, 0, 0, 0, 0],
    })
    expect(progress.clubhouse.childLevels).toEqual(Array(10).fill(0))
    expect(
      BUILDING_IDS.every((id) => !('completedFragments' in progress[id])),
    ).toBe(true)
  })
})

describe('migrateCityState v1 to v2', () => {
  it('maps fragments, applies the clubhouse cap, and starts resources now', () => {
    const migrated = migrateCityState(
      {
        buildingProgress: {
          'repair-shop': { level: 3, completedFragments: 2 },
          clubhouse: { level: 2, completedFragments: 0 },
        },
      },
      1,
      MIGRATION_TIME,
    )

    expect(migrated.buildingProgress['repair-shop']).toEqual({
      level: 2,
      childLevels: [2, 2, 2, 0, 0],
    })
    expect(migrated.buildingProgress.clubhouse).toEqual({
      level: 2,
      childLevels: [2, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    })
    expect(migrated.resources).toEqual({ money: 0, oil: 0, materials: 0 })
    expect(migrated.activeProducerIds).toEqual(['repair-shop'])
    expect(migrated.lastResourceUpdatedAt).toBe(MIGRATION_TIME)
  })

  it('maps completed old fragments to the in-progress target level', () => {
    const migrated = migrateCityState(
      {
        buildingProgress: {
          'repair-shop': { level: 3, completedFragments: 2 },
          clubhouse: { level: 5, completedFragments: 0 },
        },
      },
      1,
      MIGRATION_TIME,
    )

    expect(migrated.buildingProgress['repair-shop']).toEqual({
      level: 4,
      childLevels: [4, 4, 3, 0, 0],
    })
  })
})

describe('normalize v2 durable state', () => {
  it('repairs bad child arrays and enforces the clubhouse level cap', () => {
    const normalized = normalizeCityDurableState(
      {
        buildingProgress: {
          clubhouse: { level: 2, childLevels: [9, 2, -1] },
          'repair-shop': {
            level: 5,
            childLevels: [5, 4, 3, Number.NaN, 1, 5],
          },
        },
      },
      MIGRATION_TIME,
    )

    expect(normalized.buildingProgress.clubhouse).toEqual({
      level: 2,
      childLevels: [2, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    })
    expect(normalized.buildingProgress['repair-shop']).toEqual({
      level: 2,
      childLevels: [2, 2, 2, 0, 1],
    })
  })

  it('sanitizes negative resources, unknown producers, and non-finite time', () => {
    const normalized = normalizeCityDurableState(
      {
        resources: { money: -1, oil: 2.8, materials: Number.POSITIVE_INFINITY },
        activeProducerIds: [
          'repair-shop',
          'unknown',
          'recycling-yard',
          'commercial-street',
          'repair-shop',
        ],
        lastResourceUpdatedAt: Number.NaN,
      },
      MIGRATION_TIME,
    )

    expect(normalized.resources).toEqual({ money: 0, oil: 2, materials: 0 })
    expect(normalized.activeProducerIds).toEqual([
      'repair-shop',
      'commercial-street',
    ])
    expect(normalized.lastResourceUpdatedAt).toBe(MIGRATION_TIME)
  })
})
