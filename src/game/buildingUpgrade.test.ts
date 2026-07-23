import { describe, expect, it } from 'vitest'
import type { BuildingProgress } from './cityTypes'
import {
  CLUBHOUSE_MAX_LEVEL,
  NON_CLUBHOUSE_MAX_LEVEL,
  getBuildingChildCount,
  getBuildingMaxLevel,
  getCaughtUpChildCount,
  getChildUpgradeDecision,
  getMainUpgradeDecision,
} from './buildingUpgrade'

const emptyWallet = { money: 0, oil: 0, materials: 0 }
const richWallet = { money: 10_000, oil: 10_000, materials: 10_000 }

function progress(
  level: BuildingProgress['level'],
  childLevels: BuildingProgress['childLevels'],
): BuildingProgress {
  return { level, childLevels }
}

describe('building shape rules', () => {
  it('uses five repair slots and ten slots for other buildings', () => {
    expect(getBuildingChildCount('repair-shop')).toBe(5)
    expect(getBuildingChildCount('clubhouse')).toBe(10)
    expect(getBuildingChildCount('commercial-street')).toBe(10)
  })

  it('caps non-clubhouse buildings at 5 and clubhouse at 10', () => {
    expect(NON_CLUBHOUSE_MAX_LEVEL).toBe(5)
    expect(CLUBHOUSE_MAX_LEVEL).toBe(10)
    expect(getBuildingMaxLevel('repair-shop')).toBe(5)
    expect(getBuildingMaxLevel('clubhouse')).toBe(10)
  })

  it('counts only child buildings caught up to the main level', () => {
    expect(getCaughtUpChildCount(progress(2, [2, 1, 2, 0, 2]))).toBe(3)
  })
})

describe('child upgrade decisions', () => {
  it('allows freely choosing repair child index 4', () => {
    expect(
      getChildUpgradeDecision({
        buildingId: 'repair-shop',
        childIndex: 4,
        progress: progress(1, [0, 0, 0, 0, 0]),
        wallet: richWallet,
        gangLevel: 1,
      }),
    ).toMatchObject({
      reason: 'ready',
      targetLevel: 1,
      cost: { money: 5, oil: 0, materials: 0 },
      missingResources: emptyWallet,
    })
  })

  it('blocks a child already caught up to its main building', () => {
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

  it('checks the building unlock before child progress', () => {
    expect(
      getChildUpgradeDecision({
        buildingId: 'commercial-street',
        childIndex: 0,
        progress: progress(1, Array(10).fill(1)),
        wallet: richWallet,
        gangLevel: 1,
      }).reason,
    ).toBe('building-locked')
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
    ).toMatchObject({
      reason: 'insufficient-resources',
      missingResources: { money: 3, oil: 0, materials: 0 },
    })
  })
})

describe('main building upgrade decisions', () => {
  it('requires all children to catch up first', () => {
    expect(
      getMainUpgradeDecision({
        buildingId: 'repair-shop',
        progress: progress(1, [1, 1, 1, 1, 0]),
        clubhouseProgress: progress(2, Array(10).fill(0)),
        wallet: richWallet,
        gangLevel: 40,
      }).reason,
    ).toBe('children-not-caught-up')
  })

  it('blocks non-clubhouse upgrades while clubhouse is locked', () => {
    expect(
      getMainUpgradeDecision({
        buildingId: 'repair-shop',
        progress: progress(1, Array(5).fill(1)),
        clubhouseProgress: progress(2, Array(10).fill(0)),
        wallet: richWallet,
        gangLevel: 39,
      }).reason,
    ).toBe('clubhouse-locked')
  })

  it('blocks non-clubhouse targets above the clubhouse level', () => {
    expect(
      getMainUpgradeDecision({
        buildingId: 'repair-shop',
        progress: progress(1, Array(5).fill(1)),
        clubhouseProgress: progress(1, Array(10).fill(1)),
        wallet: richWallet,
        gangLevel: 40,
      }).reason,
    ).toBe('clubhouse-too-low')
  })

  it('allows a caught-up repair shop to reach level 2', () => {
    expect(
      getMainUpgradeDecision({
        buildingId: 'repair-shop',
        progress: progress(1, Array(5).fill(1)),
        clubhouseProgress: progress(2, Array(10).fill(0)),
        wallet: richWallet,
        gangLevel: 40,
      }),
    ).toMatchObject({
      reason: 'ready',
      targetLevel: 2,
      cost: { money: 25, oil: 0, materials: 0 },
      missingResources: emptyWallet,
    })
  })

  it('caps non-clubhouse level 5 before clubhouse and resource checks', () => {
    expect(
      getMainUpgradeDecision({
        buildingId: 'repair-shop',
        progress: progress(5, Array(5).fill(5)),
        clubhouseProgress: progress(1, Array(10).fill(0)),
        wallet: emptyWallet,
        gangLevel: 1,
      }).reason,
    ).toBe('building-maxed')
  })

  it('caps clubhouse level 10', () => {
    expect(
      getMainUpgradeDecision({
        buildingId: 'clubhouse',
        progress: progress(10, Array(10).fill(10)),
        clubhouseProgress: progress(10, Array(10).fill(10)),
        wallet: richWallet,
        gangLevel: 50,
      }).reason,
    ).toBe('building-maxed')
  })

  it('reports insufficient main-upgrade resources last', () => {
    expect(
      getMainUpgradeDecision({
        buildingId: 'clubhouse',
        progress: progress(1, Array(10).fill(1)),
        clubhouseProgress: progress(1, Array(10).fill(1)),
        wallet: emptyWallet,
        gangLevel: 40,
      }),
    ).toMatchObject({
      reason: 'insufficient-resources',
      targetLevel: 2,
      missingResources: { money: 25, oil: 0, materials: 0 },
    })
  })
})
