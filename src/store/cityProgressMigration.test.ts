import { describe, expect, it } from 'vitest'
import { economyConfig, type ResourceWallet } from '../config/economyConfig'
import { BUILDING_IDS } from '../game/cityTypes'
import {
  CITY_STORAGE_KEY,
  createInitialBuildingProgress,
  migrateCityState,
  normalizeCityDurableState,
} from './cityProgressMigration'

const MIGRATION_TIME = 1_700_000_000_000
const ZERO_CLUBHOUSE_CHILDREN = Array(10).fill(0)

function getConfiguredChildRefund(...levels: number[]) {
  const refund = { money: 0, oil: 0, materials: 0 }
  for (const level of levels) {
    for (let targetLevel = 1; targetLevel <= level; targetLevel += 1) {
      const cost =
        economyConfig.childUpgradeCostByTargetLevel[
          targetLevel as keyof typeof economyConfig.childUpgradeCostByTargetLevel
        ]
      refund.money += cost.money
      refund.oil += cost.oil
      refund.materials += cost.materials
    }
  }
  return refund
}

function withChildUpgradeCostFixture<T>(
  targetLevel: keyof typeof economyConfig.childUpgradeCostByTargetLevel,
  cost: ResourceWallet,
  run: () => T,
): T {
  const costs = economyConfig.childUpgradeCostByTargetLevel
  const original = costs[targetLevel]
  costs[targetLevel] = cost
  try {
    return run()
  } finally {
    costs[targetLevel] = original
  }
}

describe('city progress v3 defaults', () => {
  it('keeps the storage key and creates canonical fixed-capacity arrays', () => {
    const progress = createInitialBuildingProgress()

    expect(CITY_STORAGE_KEY).toBe('dobe-city-progression-v1')
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

describe('migrateCityState to v3', () => {
  const hiddenProgress = {
    'repair-shop': { level: 2, childLevels: [2, 1, 2, 0, 1] },
    'commercial-street': {
      level: 3,
      childLevels: [3, 2, 1, 2, 1, 0, 0, 0, 0, 0],
    },
  }

  it('refunds v2 hidden child steps using the frozen cumulative costs', () => {
    const migrated = migrateCityState(
      {
        buildingProgress: hiddenProgress,
        resources: { money: 100, oil: 7, materials: 9 },
      },
      2,
      MIGRATION_TIME,
    )

    expect(migrated.buildingProgress['repair-shop'].childLevels).toEqual([
      2, 1, 0, 0, 0,
    ])
    expect(migrated.buildingProgress['commercial-street'].childLevels).toEqual([
      3, 2, 1, 0, 0, 0, 0, 0, 0, 0,
    ])
    expect(migrated.resources).toEqual({
      money: 140,
      oil: 7,
      materials: 9,
    })
  })

  it('clears v3 hidden levels without refunding them again', () => {
    const migrated = migrateCityState(
      {
        buildingProgress: hiddenProgress,
        resources: { money: 100, oil: 7, materials: 9 },
      },
      3,
      MIGRATION_TIME,
    )

    expect(migrated.buildingProgress['repair-shop'].childLevels).toEqual([
      2, 1, 0, 0, 0,
    ])
    expect(migrated.resources).toEqual({
      money: 100,
      oil: 7,
      materials: 9,
    })
  })

  it('chains v1 fragment mapping into v3 clearing without a refund', () => {
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
      childLevels: [2, 2, 0, 0, 0],
    })
    expect(migrated.resources).toEqual({ money: 0, oil: 0, materials: 0 })
    expect(migrated.activeProducerIds).toEqual(['repair-shop'])
    expect(migrated.lastResourceUpdatedAt).toBe(MIGRATION_TIME)
  })

  it('saturates a v2 refund near the safe integer limit', () => {
    const migrated = migrateCityState(
      {
        buildingProgress: {
          'repair-shop': { level: 2, childLevels: [2, 1, 2, 0, 0] },
        },
        resources: {
          money: Number.MAX_SAFE_INTEGER - 1,
          oil: Number.MAX_SAFE_INTEGER,
          materials: Number.MAX_SAFE_INTEGER,
        },
      },
      2,
      MIGRATION_TIME,
    )

    expect(migrated.resources).toEqual({
      money: Number.MAX_SAFE_INTEGER,
      oil: Number.MAX_SAFE_INTEGER,
      materials: Number.MAX_SAFE_INTEGER,
    })
  })
})

describe('migrateCityState to v4', () => {
  it('refunds every v3 clubhouse child step and preserves the main level', () => {
    const migrated = migrateCityState(
      {
        buildingProgress: {
          clubhouse: {
            level: 3,
            childLevels: [1, 2, 3, 0, 0, 0, 0, 0, 0, 0],
          },
        },
        resources: { money: 100, oil: 7, materials: 9 },
      },
      3,
      MIGRATION_TIME,
    )
    const refund = getConfiguredChildRefund(1, 2, 3)

    expect(migrated.buildingProgress.clubhouse).toEqual({
      level: 3,
      childLevels: ZERO_CLUBHOUSE_CHILDREN,
    })
    expect(migrated.resources).toEqual({
      money: 100 + refund.money,
      oil: 7 + refund.oil,
      materials: 9 + refund.materials,
    })
  })

  it('refunds configured money, oil, and materials without leaking the fixture', () => {
    const originalCost = economyConfig.childUpgradeCostByTargetLevel[1]
    const migrated = withChildUpgradeCostFixture(
      1,
      { money: 11, oil: 13, materials: 17 },
      () =>
        migrateCityState(
          {
            buildingProgress: {
              clubhouse: {
                level: 1,
                childLevels: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              },
            },
            resources: { money: 100, oil: 200, materials: 300 },
          },
          3,
          MIGRATION_TIME,
        ),
    )

    expect(migrated.resources).toEqual({
      money: 111,
      oil: 213,
      materials: 317,
    })
    expect(economyConfig.childUpgradeCostByTargetLevel[1]).toBe(originalCost)
  })

  it('normalizes v4 clubhouse children without refunding them again', () => {
    const migrated = migrateCityState(
      {
        buildingProgress: {
          clubhouse: {
            level: 3,
            childLevels: [1, 2, 3, 0, 0, 0, 0, 0, 0, 0],
          },
        },
        resources: { money: 100, oil: 7, materials: 9 },
      },
      4,
      MIGRATION_TIME,
    )

    expect(migrated.buildingProgress.clubhouse.childLevels).toEqual(
      ZERO_CLUBHOUSE_CHILDREN,
    )
    expect(migrated.resources).toEqual({
      money: 100,
      oil: 7,
      materials: 9,
    })
  })

  it('does not refund a v2 hidden clubhouse slot twice', () => {
    const migrated = migrateCityState(
      {
        buildingProgress: {
          clubhouse: {
            level: 1,
            childLevels: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
          },
        },
        resources: { money: 0, oil: 0, materials: 0 },
      },
      2,
      MIGRATION_TIME,
    )

    expect(migrated.buildingProgress.clubhouse.childLevels).toEqual(
      ZERO_CLUBHOUSE_CHILDREN,
    )
    expect(migrated.resources).toEqual({
      money: 10,
      oil: 0,
      materials: 0,
    })
  })

  it('clears v1 clubhouse children without issuing an economic refund', () => {
    const migrated = migrateCityState(
      {
        buildingProgress: {
          clubhouse: { level: 2, completedFragments: 1 },
        },
      },
      1,
      MIGRATION_TIME,
    )

    expect(migrated.buildingProgress.clubhouse).toEqual({
      level: 3,
      childLevels: ZERO_CLUBHOUSE_CHILDREN,
    })
    expect(migrated.resources).toEqual({ money: 0, oil: 0, materials: 0 })
  })

  it('saturates the v3 clubhouse refund at the safe integer limit', () => {
    const migrated = migrateCityState(
      {
        buildingProgress: {
          clubhouse: {
            level: 10,
            childLevels: [10, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          },
        },
        resources: {
          money: Number.MAX_SAFE_INTEGER - 1,
          oil: Number.MAX_SAFE_INTEGER,
          materials: Number.MAX_SAFE_INTEGER,
        },
      },
      3,
      MIGRATION_TIME,
    )

    expect(migrated.resources).toEqual({
      money: Number.MAX_SAFE_INTEGER,
      oil: Number.MAX_SAFE_INTEGER,
      materials: Number.MAX_SAFE_INTEGER,
    })
  })
})

describe('normalize v4 durable state', () => {
  it('repairs malformed levels and arrays without the old clubhouse cap', () => {
    const normalized = normalizeCityDurableState(
      {
        buildingProgress: {
          clubhouse: { level: 2.9, childLevels: [9, 2, -1] },
          'repair-shop': {
            level: 8.8,
            childLevels: [9, 4.9, 3, Number.NaN, 1, 5],
          },
        },
      },
      MIGRATION_TIME,
    )

    expect(normalized.buildingProgress.clubhouse).toEqual({
      level: 2,
      childLevels: ZERO_CLUBHOUSE_CHILDREN,
    })
    expect(normalized.buildingProgress['repair-shop']).toEqual({
      level: 8,
      childLevels: [8, 4, 3, 0, 1],
    })
  })

  it('sanitizes resources, producers, and non-finite time', () => {
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

  it('produces zeroed clubhouse children from null and malformed saves', () => {
    expect(
      normalizeCityDurableState(null, MIGRATION_TIME).buildingProgress.clubhouse
        .childLevels,
    ).toEqual(ZERO_CLUBHOUSE_CHILDREN)
    expect(
      normalizeCityDurableState(
        {
          buildingProgress: {
            clubhouse: {
              level: 'bad',
              childLevels: [10, Number.NaN, -1, 5],
            },
          },
        },
        MIGRATION_TIME,
      ).buildingProgress.clubhouse.childLevels,
    ).toEqual(ZERO_CLUBHOUSE_CHILDREN)
  })
})

describe('building takeover migration', () => {
  it('preserves access for pre-v6 saves by marking every legacy building claimed', () => {
    const migrated = migrateCityState(
      {
        buildingProgress: createInitialBuildingProgress(),
        resources: { money: 100, oil: 0, materials: 0 },
        lastResourceUpdatedAt: MIGRATION_TIME,
        activeProducerIds: ['repair-shop'],
      },
      5,
      MIGRATION_TIME,
    )

    expect(migrated.claimedBuildingIds).toEqual(BUILDING_IDS)
  })

  it('sanitizes explicit v6 building claims without inventing fresh access', () => {
    const normalized = migrateCityState(
      {
        claimedBuildingIds: [
          'repair-shop',
          'unknown',
          'repair-shop',
          'recycling-yard',
        ],
      },
      6,
      MIGRATION_TIME,
    )

    expect(normalized.claimedBuildingIds).toEqual([
      'repair-shop',
      'recycling-yard',
    ])
  })
})
