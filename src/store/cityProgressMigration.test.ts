import { describe, expect, it } from 'vitest'
import { BUILDING_IDS } from '../game/cityTypes'
import {
  CITY_STORAGE_KEY,
  createInitialBuildingProgress,
  normalizeBuildingProgressById,
} from './cityProgressMigration'

describe('cityProgressMigration constants', () => {
  it('uses the documented city storage key', () => {
    expect(CITY_STORAGE_KEY).toBe('dobe-city-progression-v1')
  })
})

describe('createInitialBuildingProgress', () => {
  it('creates all six buildings at level 1 with zero fragments', () => {
    const progress = createInitialBuildingProgress()

    expect(Object.keys(progress)).toHaveLength(BUILDING_IDS.length)
    expect(
      BUILDING_IDS.every(
        (id) =>
          progress[id].level === 1 && progress[id].completedFragments === 0,
      ),
    ).toBe(true)
  })

  it('returns a fresh object on each call', () => {
    expect(createInitialBuildingProgress()).not.toBe(
      createInitialBuildingProgress(),
    )
  })
})

describe('normalizeBuildingProgressById', () => {
  it('always returns every known building', () => {
    const progress = normalizeBuildingProgressById({})

    expect(Object.keys(progress).sort()).toEqual([...BUILDING_IDS].sort())
  })

  it('migrates legacy numeric levels to fragment progress objects', () => {
    const progress = normalizeBuildingProgressById({
      'repair-shop': 1,
      'recycling-yard': 2,
      'commercial-street': 3,
    })

    expect(progress['repair-shop']).toEqual({ level: 1, completedFragments: 0 })
    expect(progress['recycling-yard']).toEqual({
      level: 2,
      completedFragments: 0,
    })
    expect(progress['commercial-street']).toEqual({
      level: 3,
      completedFragments: 0,
    })
  })

  it('fills missing buildings with level 1', () => {
    const progress = normalizeBuildingProgressById({
      'gas-station': { level: 5, completedFragments: 2 },
    })

    expect(progress['gas-station']).toEqual({ level: 5, completedFragments: 2 })
    expect(
      BUILDING_IDS.filter((id) => id !== 'gas-station').every(
        (id) =>
          progress[id].level === 1 && progress[id].completedFragments === 0,
      ),
    ).toBe(true)
  })

  it('clamps and truncates out-of-range levels', () => {
    const progress = normalizeBuildingProgressById({
      'repair-shop': { level: 0, completedFragments: 0 },
      'recycling-yard': { level: 42, completedFragments: 0 },
      'commercial-street': { level: 4.9, completedFragments: 0 },
    })

    expect(progress['repair-shop'].level).toBe(1)
    expect(progress['recycling-yard'].level).toBe(10)
    expect(progress['commercial-street'].level).toBe(4)
  })

  it('clamps and truncates fragments to the 0..targetLevel range', () => {
    const progress = normalizeBuildingProgressById({
      // level 1 -> target level 2 -> at most 2 fragments
      'repair-shop': { level: 1, completedFragments: 9 },
      'recycling-yard': { level: 1, completedFragments: -3 },
      'commercial-street': { level: 2, completedFragments: 2.8 },
    })

    expect(progress['repair-shop']).toEqual({ level: 1, completedFragments: 2 })
    expect(progress['recycling-yard']).toEqual({
      level: 1,
      completedFragments: 0,
    })
    expect(progress['commercial-street']).toEqual({
      level: 2,
      completedFragments: 2,
    })
  })

  it('forces level 10 to zero fragments', () => {
    const progress = normalizeBuildingProgressById({
      clubhouse: { level: 10, completedFragments: 7 },
    })

    expect(progress['clubhouse']).toEqual({ level: 10, completedFragments: 0 })
  })

  it('safely ignores non-object, NaN, Infinity and corrupt entries', () => {
    const progress = normalizeBuildingProgressById({
      'repair-shop': null,
      'recycling-yard': 'oops',
      'commercial-street': { level: Number.NaN, completedFragments: 1 },
      'metalworking-plant': {
        level: Number.POSITIVE_INFINITY,
        completedFragments: Number.NaN,
      },
      'gas-station': [],
    })

    // null / string / array roots collapse to the level-1 default.
    expect(progress['repair-shop']).toEqual({ level: 1, completedFragments: 0 })
    expect(progress['recycling-yard']).toEqual({
      level: 1,
      completedFragments: 0,
    })
    expect(progress['gas-station']).toEqual({ level: 1, completedFragments: 0 })
    // NaN level collapses to 1, but a valid fragment count survives.
    expect(progress['commercial-street']).toEqual({
      level: 1,
      completedFragments: 1,
    })
    // Infinity level collapses to 1 and NaN fragments collapse to 0.
    expect(progress['metalworking-plant']).toEqual({
      level: 1,
      completedFragments: 0,
    })
  })

  it('ignores unknown building ids and non-object roots', () => {
    const withUnknown = normalizeBuildingProgressById({
      'repair-shop': { level: 3, completedFragments: 1 },
      'mystery-building': { level: 9, completedFragments: 9 },
    })

    expect('mystery-building' in withUnknown).toBe(false)
    expect(withUnknown['repair-shop']).toEqual({
      level: 3,
      completedFragments: 1,
    })

    for (const root of [null, undefined, 42, 'nope', [1, 2, 3]]) {
      const progress = normalizeBuildingProgressById(root)
      expect(
        BUILDING_IDS.every(
          (id) =>
            progress[id].level === 1 && progress[id].completedFragments === 0,
        ),
      ).toBe(true)
    }
  })
})
