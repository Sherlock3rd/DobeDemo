import { describe, expect, it } from 'vitest'
import { economyConfig } from '../config/economyConfig'
import {
  BUILDING_IDS,
  BUILDING_LEVELS,
  type BuildingId,
  type BuildingLevel,
  type BuildingProgress,
} from './cityTypes'
import {
  BUILDING_MAX_LEVEL,
  getBuildingChildCount,
  getBuildingUpgradeProgress,
  getChildUpgradeDecision,
  getMainUpgradeDecision,
  getUnlockedChildCount,
} from './buildingUpgrade'

const emptyWallet = { money: 0, oil: 0, materials: 0 }
const richWallet = { money: 10_000, oil: 10_000, materials: 10_000 }

function progress(
  level: BuildingLevel,
  childLevels: BuildingProgress['childLevels'],
): BuildingProgress {
  return { level, childLevels }
}

function caughtUpProgress(
  buildingId: BuildingId,
  level: BuildingLevel,
): BuildingProgress {
  const childCount = buildingId === 'repair-shop' ? 5 : 10
  const unlockedCount =
    buildingId === 'repair-shop' ? Math.min(level, 5) : level
  return progress(level, [
    ...Array(unlockedCount).fill(level),
    ...Array(childCount - unlockedCount).fill(0),
  ])
}

function mainInput(
  overrides: Partial<Parameters<typeof getMainUpgradeDecision>[0]> = {},
): Parameters<typeof getMainUpgradeDecision>[0] {
  return {
    buildingId: 'repair-shop',
    progress: caughtUpProgress('repair-shop', 1),
    repairShopProgress: caughtUpProgress('repair-shop', 10),
    clubhouseProgress: caughtUpProgress('clubhouse', 10),
    wallet: richWallet,
    gangLevel: 50,
    ...overrides,
  }
}

describe('progressive building shape and progress', () => {
  it('uses one level 10 maximum for every building', () => {
    expect(BUILDING_MAX_LEVEL).toBe(10)
    for (const buildingId of BUILDING_IDS) {
      expect(
        getMainUpgradeDecision(
          mainInput({
            buildingId,
            progress: caughtUpProgress(buildingId, 10),
          }),
        ).reason,
      ).toBe('building-maxed')
    }
  })

  it('uses five repair slots and ten slots for other buildings', () => {
    expect(getBuildingChildCount('repair-shop')).toBe(5)
    for (const buildingId of BUILDING_IDS.filter(
      (id) => id !== 'repair-shop',
    )) {
      expect(getBuildingChildCount(buildingId)).toBe(10)
    }
  })

  it('unlocks the repair prefix through five slots', () => {
    expect(
      BUILDING_LEVELS.map((level) =>
        getUnlockedChildCount('repair-shop', level),
      ),
    ).toEqual([1, 2, 3, 4, 5, 5, 5, 5, 5, 5])
  })

  it('unlocks one ordinary slot per main level', () => {
    expect(
      BUILDING_LEVELS.map((level) =>
        getUnlockedChildCount('commercial-street', level),
      ),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('calculates exact progress from unlocked children only', () => {
    expect(
      getBuildingUpgradeProgress('commercial-street', {
        level: 3,
        childLevels: [3, 2, 1, 3, 3, 3, 3, 3, 3, 3],
      }),
    ).toEqual({
      unlockedChildCount: 3,
      completedSteps: 6,
      totalSteps: 9,
      ratio: 2 / 3,
      percent: (2 / 3) * 100,
      complete: false,
    })
  })

  it('clamps malformed child levels defensively', () => {
    expect(
      getBuildingUpgradeProgress('repair-shop', {
        level: 2,
        childLevels: [9, -4] as BuildingProgress['childLevels'],
      }),
    ).toEqual({
      unlockedChildCount: 2,
      completedSteps: 2,
      totalSteps: 4,
      ratio: 0.5,
      percent: 50,
      complete: false,
    })
  })
})

describe('child upgrade decisions', () => {
  it('checks building unlock before child gates', () => {
    expect(
      getChildUpgradeDecision({
        buildingId: 'commercial-street',
        childIndex: 99,
        progress: progress(1, Array(10).fill(1)),
        wallet: emptyWallet,
        gangLevel: 1,
      }).reason,
    ).toBe('building-locked')
  })

  it.each([-1, 1, 5, 99, 0.5])(
    'returns child-locked for invalid or hidden index %s',
    (childIndex) => {
      expect(
        getChildUpgradeDecision({
          buildingId: 'repair-shop',
          childIndex,
          progress: progress(1, [0, 0, 0, 0, 0]),
          wallet: richWallet,
          gangLevel: 1,
        }),
      ).toEqual({
        reason: 'child-locked',
        targetLevel: null,
        cost: null,
        missingResources: emptyWallet,
      })
    },
  )

  it('blocks a child already at the main level', () => {
    expect(
      getChildUpgradeDecision({
        buildingId: 'repair-shop',
        childIndex: 0,
        progress: progress(1, [1, 0, 0, 0, 0]),
        wallet: richWallet,
        gangLevel: 1,
      }).reason,
    ).toBe('child-at-main-level')
  })

  it('reports exact missing resources', () => {
    expect(
      getChildUpgradeDecision({
        buildingId: 'repair-shop',
        childIndex: 0,
        progress: progress(1, [0, 0, 0, 0, 0]),
        wallet: { money: 2, oil: 0, materials: 0 },
        gangLevel: 1,
      }),
    ).toEqual({
      reason: 'insufficient-resources',
      targetLevel: 1,
      cost: { money: 5, oil: 0, materials: 0 },
      missingResources: { money: 3, oil: 0, materials: 0 },
    })
  })

  it('returns ready with the next level and cost', () => {
    expect(
      getChildUpgradeDecision({
        buildingId: 'repair-shop',
        childIndex: 0,
        progress: progress(1, [0, 0, 0, 0, 0]),
        wallet: richWallet,
        gangLevel: 1,
      }),
    ).toEqual({
      reason: 'ready',
      targetLevel: 1,
      cost: { money: 5, oil: 0, materials: 0 },
      missingResources: emptyWallet,
    })
  })

  it('throws rather than treating missing child cost as free', () => {
    const costs = economyConfig.childUpgradeCostByTargetLevel
    const original = costs[1]
    delete (costs as Partial<typeof costs>)[1]
    try {
      expect(() =>
        getChildUpgradeDecision({
          buildingId: 'repair-shop',
          childIndex: 0,
          progress: progress(1, [0, 0, 0, 0, 0]),
          wallet: richWallet,
          gangLevel: 1,
        }),
      ).toThrow('Invalid economy config: childUpgradeCostByTargetLevel.1')
    } finally {
      costs[1] = original
    }
  })
})

describe('main building upgrade decision priority', () => {
  it('returns building-locked before max and progress checks', () => {
    expect(
      getMainUpgradeDecision(
        mainInput({
          buildingId: 'commercial-street',
          progress: progress(10, Array(10).fill(0)),
          wallet: emptyWallet,
          gangLevel: 1,
        }),
      ).reason,
    ).toBe('building-locked')
  })

  it('returns building-maxed before incomplete progress', () => {
    expect(
      getMainUpgradeDecision(
        mainInput({
          progress: progress(10, [0, 0, 0, 0, 0]),
          wallet: emptyWallet,
          gangLevel: 1,
        }),
      ).reason,
    ).toBe('building-maxed')
  })

  it('returns children-not-caught-up before repair gate', () => {
    expect(
      getMainUpgradeDecision(
        mainInput({
          buildingId: 'commercial-street',
          progress: progress(1, Array(10).fill(0)),
          repairShopProgress: caughtUpProgress('repair-shop', 1),
          wallet: emptyWallet,
          gangLevel: 40,
        }),
      ).reason,
    ).toBe('children-not-caught-up')
  })

  it('returns repair-shop-too-low for ordinary targets level 2 through 5', () => {
    expect(
      getMainUpgradeDecision(
        mainInput({
          buildingId: 'commercial-street',
          progress: caughtUpProgress('commercial-street', 1),
          repairShopProgress: caughtUpProgress('repair-shop', 1),
        }),
      ),
    ).toEqual({
      reason: 'repair-shop-too-low',
      targetLevel: 2,
      cost: null,
      missingResources: emptyWallet,
      requiredBuildingId: 'repair-shop',
      requiredBuildingLevel: 2,
    })
  })

  it('does not apply the repair gate to repair-shop or clubhouse', () => {
    expect(
      getMainUpgradeDecision(
        mainInput({
          progress: caughtUpProgress('repair-shop', 1),
          repairShopProgress: caughtUpProgress('repair-shop', 1),
        }),
      ).reason,
    ).toBe('ready')
    expect(
      getMainUpgradeDecision(
        mainInput({
          buildingId: 'clubhouse',
          progress: caughtUpProgress('clubhouse', 1),
          repairShopProgress: caughtUpProgress('repair-shop', 1),
          gangLevel: 40,
        }),
      ).reason,
    ).toBe('ready')
  })

  it('returns clubhouse-locked before clubhouse level and resources', () => {
    expect(
      getMainUpgradeDecision(
        mainInput({
          progress: caughtUpProgress('repair-shop', 5),
          clubhouseProgress: caughtUpProgress('clubhouse', 1),
          wallet: emptyWallet,
          gangLevel: 39,
        }),
      ),
    ).toEqual({
      reason: 'clubhouse-locked',
      targetLevel: 6,
      cost: null,
      missingResources: emptyWallet,
      requiredBuildingId: 'clubhouse',
      requiredBuildingLevel: null,
    })
  })

  it('returns clubhouse-too-low after clubhouse unlock', () => {
    expect(
      getMainUpgradeDecision(
        mainInput({
          progress: caughtUpProgress('repair-shop', 5),
          clubhouseProgress: caughtUpProgress('clubhouse', 1),
          wallet: emptyWallet,
          gangLevel: 40,
        }),
      ),
    ).toEqual({
      reason: 'clubhouse-too-low',
      targetLevel: 6,
      cost: null,
      missingResources: emptyWallet,
      requiredBuildingId: 'clubhouse',
      requiredBuildingLevel: 6,
    })
  })

  it('reports insufficient resources only after all gates pass', () => {
    expect(
      getMainUpgradeDecision(
        mainInput({
          buildingId: 'clubhouse',
          progress: caughtUpProgress('clubhouse', 1),
          wallet: emptyWallet,
          gangLevel: 40,
        }),
      ),
    ).toEqual({
      reason: 'insufficient-resources',
      targetLevel: 2,
      cost: { money: 25, oil: 0, materials: 0 },
      missingResources: { money: 25, oil: 0, materials: 0 },
      requiredBuildingId: null,
      requiredBuildingLevel: null,
    })
  })

  it('returns ready with complete decision data', () => {
    expect(getMainUpgradeDecision(mainInput())).toEqual({
      reason: 'ready',
      targetLevel: 2,
      cost: { money: 25, oil: 0, materials: 0 },
      missingResources: emptyWallet,
      requiredBuildingId: null,
      requiredBuildingLevel: null,
    })
  })

  it('throws rather than treating missing main cost as free', () => {
    const costs = economyConfig.buildingUpgradeCostByTargetLevel
    const original = costs[2]
    delete costs[2]
    try {
      expect(() => getMainUpgradeDecision(mainInput())).toThrow(
        'Invalid economy config: buildingUpgradeCostByTargetLevel.2',
      )
    } finally {
      costs[2] = original
    }
  })
})
