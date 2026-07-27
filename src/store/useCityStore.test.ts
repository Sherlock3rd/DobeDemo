import { beforeEach, describe, expect, it } from 'vitest'
import { economyConfig } from '../config/economyConfig'
import { BUILDING_IDS } from '../game/cityTypes'
import { CITY_STORAGE_KEY } from './cityProgressMigration'
import { useCityStore } from './useCityStore'

const START = 1_700_000_000_000

describe('useCityStore atomic economy', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset(START)
    useCityStore.getState().claimBuilding('repair-shop', 1, START)
  })

  it('starts with canonical progress, 10000 money, and no claimed building', () => {
    useCityStore.getState().reset(START)
    const state = useCityStore.getState()
    expect(state.selectedBuildingId).toBeNull()
    expect(state.buildingProgress['repair-shop']).toEqual({
      level: 1,
      childLevels: [0, 0, 0, 0, 0],
    })
    expect(state.buildingProgress.clubhouse.childLevels).toEqual(
      Array(10).fill(0),
    )
    expect(state.resources).toEqual({ money: 10_000, oil: 0, materials: 0 })
    expect(state.lastResourceUpdatedAt).toBe(START)
    expect(state.activeProducerIds).toEqual([])
    expect(state.claimedBuildingIds).toEqual([])
  })

  it('claims the repair shop once and activates its production from claim time', () => {
    useCityStore.getState().reset(START)

    expect(useCityStore.getState().claimBuilding('repair-shop', 1, START)).toBe(
      true,
    )
    expect(useCityStore.getState().claimBuilding('repair-shop', 1, START)).toBe(
      false,
    )
    expect(useCityStore.getState().claimedBuildingIds).toEqual(['repair-shop'])
    expect(useCityStore.getState().activeProducerIds).toEqual(['repair-shop'])
  })

  it('grants stage reward money through the city wallet', () => {
    useCityStore.setState({
      resources: { money: 25, oil: 3, materials: 4 },
    })
    const grantRewardMoney = (
      useCityStore.getState() as ReturnType<typeof useCityStore.getState> & {
        grantRewardMoney?: (rewardId: string, amount: number) => boolean
      }
    ).grantRewardMoney
    expect(grantRewardMoney).toBeTypeOf('function')
    expect(grantRewardMoney?.('campaign:1', 100)).toBe(true)
    expect(grantRewardMoney?.('campaign:1', 100)).toBe(false)
    expect(useCityStore.getState().resources).toEqual({
      money: 125,
      oil: 3,
      materials: 4,
    })
  })

  it('settles old producers before activating newly unlocked producers', () => {
    useCityStore
      .getState()
      .claimBuilding('commercial-street', 16, START + 8 * 60 * 60 * 1000)
    useCityStore
      .getState()
      .syncResourceProduction(START + 8 * 60 * 60 * 1000, 16)

    const state = useCityStore.getState()
    expect(state.resources.money).toBe(12_880)
    expect(state.activeProducerIds).toEqual([
      'repair-shop',
      'commercial-street',
    ])
  })

  it('does not backdate production for a newly activated commercial street', () => {
    const unlockTime = START + 8 * 60 * 60 * 1000
    useCityStore.getState().claimBuilding('commercial-street', 16, unlockTime)
    useCityStore.getState().syncResourceProduction(unlockTime, 16)
    useCityStore.getState().syncResourceProduction(unlockTime + 10_000, 16)

    expect(useCityStore.getState().resources.money).toBe(12_883)
  })

  it('does not move the resource clock backward when producers change', () => {
    useCityStore
      .getState()
      .claimBuilding('commercial-street', 16, START - 5_000)
    useCityStore.getState().syncResourceProduction(START - 5_000, 16)

    const state = useCityStore.getState()
    expect(state.lastResourceUpdatedAt).toBe(START)
    expect(state.activeProducerIds).toEqual([
      'repair-shop',
      'commercial-street',
    ])
  })

  it('settles old production, charges five money, and returns the applied result', () => {
    useCityStore.setState({
      resources: { money: 5, oil: 0, materials: 0 },
    })

    const result = useCityStore
      .getState()
      .upgradeChildBuilding('repair-shop', 0, 1, START + 10_000)

    const state = useCityStore.getState()
    expect(result).toEqual({ applied: true, reason: 'ready' })
    expect(state.resources.money).toBe(1)
    expect(state.buildingProgress['repair-shop'].childLevels).toEqual([
      1, 0, 0, 0, 0,
    ])
    expect(state.lastResourceUpdatedAt).toBe(START + 10_000)
  })

  it('keeps the complete state reference when child funds are insufficient', () => {
    useCityStore.setState({
      resources: { money: 0, oil: 0, materials: 0 },
    })
    const before = useCityStore.getState()
    const result = useCityStore
      .getState()
      .upgradeChildBuilding('repair-shop', 0, 1, START)
    expect(result).toEqual({
      applied: false,
      reason: 'insufficient-resources',
    })
    expect(useCityStore.getState()).toBe(before)
  })

  it('rejects clubhouse child upgrades without writing wallet, progress, or clock', () => {
    const before = useCityStore.getState()

    expect(
      before.upgradeChildBuilding('clubhouse', 0, 40, START + 10_000),
    ).toEqual({
      applied: false,
      reason: 'direct-main-upgrade-only',
    })
    expect(useCityStore.getState()).toBe(before)
  })

  it('atomically charges, queues, and later completes a caught-up repair main building', () => {
    useCityStore.setState((state) => ({
      resources: { money: 25, oil: 0, materials: 0 },
      buildingProgress: {
        ...state.buildingProgress,
        'repair-shop': { level: 1, childLevels: [1, 0, 0, 0, 0] },
      },
    }))

    const result = useCityStore
      .getState()
      .upgradeMainBuilding('repair-shop', 1, START)

    expect(result).toEqual({ applied: true, reason: 'ready' })
    expect(useCityStore.getState().resources.money).toBe(0)
    expect(useCityStore.getState().buildingProgress['repair-shop']).toEqual({
      level: 1,
      childLevels: [1, 0, 0, 0, 0],
    })
    useCityStore.getState().syncMainUpgrades(START + 10_000)
    expect(useCityStore.getState().buildingProgress['repair-shop']).toEqual({
      level: 2,
      childLevels: [1, 0, 0, 0, 0],
    })
  })

  it('queues clubhouse with exact main cost and preserves children on completion', () => {
    const cost = economyConfig.buildingUpgradeCostByTargetLevel[2]
    if (!cost) {
      throw new Error('Missing clubhouse level 2 upgrade cost')
    }
    useCityStore.setState((state) => ({
      resources: { ...cost },
      buildingProgress: {
        ...state.buildingProgress,
        clubhouse: { level: 1, childLevels: Array(10).fill(0) as never },
      },
    }))

    expect(
      useCityStore.getState().upgradeMainBuilding('clubhouse', 40, START),
    ).toEqual({ applied: true, reason: 'ready' })
    expect(useCityStore.getState().resources).toEqual({
      money: 0,
      oil: 0,
      materials: 0,
    })
    expect(useCityStore.getState().buildingProgress.clubhouse.level).toBe(1)
    useCityStore.getState().syncMainUpgrades(START + 10_000)
    expect(useCityStore.getState().buildingProgress.clubhouse).toEqual({
      level: 2,
      childLevels: Array(10).fill(0),
    })
  })

  it('queues clubhouse main upgrades instead of completing them immediately', () => {
    const cost = economyConfig.buildingUpgradeCostByTargetLevel[2]
    if (!cost) throw new Error('Missing clubhouse level 2 upgrade cost')
    useCityStore.setState((state) => ({
      resources: { ...cost },
      buildingProgress: {
        ...state.buildingProgress,
        clubhouse: { level: 1, childLevels: Array(10).fill(0) as never },
      },
    }))

    expect(
      useCityStore.getState().upgradeMainBuilding('clubhouse', 40, START),
    ).toMatchObject({ applied: true })
    const state = useCityStore.getState() as ReturnType<
      typeof useCityStore.getState
    > & {
      pendingMainUpgrades?: Array<{
        buildingId: string
        targetLevel: number
        completesAt: number
      }>
    }
    expect(state.buildingProgress.clubhouse.level).toBe(1)
    expect(state.pendingMainUpgrades).toEqual([
      {
        buildingId: 'clubhouse',
        targetLevel: 2,
        completesAt: START + 10_000,
      },
    ])
  })

  it('allows at most two concurrent main-building upgrade tasks', () => {
    useCityStore.setState((state) => ({
      resources: { money: 10_000, oil: 10_000, materials: 10_000 },
      buildingProgress: {
        ...state.buildingProgress,
        'repair-shop': {
          level: 10,
          childLevels: Array(5).fill(10) as never,
        },
        clubhouse: { level: 10, childLevels: Array(10).fill(0) as never },
        'commercial-street': {
          level: 1,
          childLevels: [1, ...Array(9).fill(0)] as never,
        },
        'metalworking-plant': {
          level: 1,
          childLevels: [1, ...Array(9).fill(0)] as never,
        },
        'gas-station': {
          level: 1,
          childLevels: [1, ...Array(9).fill(0)] as never,
        },
      },
    }))

    expect(
      useCityStore
        .getState()
        .upgradeMainBuilding('commercial-street', 50, START),
    ).toMatchObject({ applied: true })
    expect(
      useCityStore
        .getState()
        .upgradeMainBuilding('metalworking-plant', 50, START),
    ).toMatchObject({ applied: true })
    expect(
      useCityStore.getState().upgradeMainBuilding('gas-station', 50, START),
    ).toEqual({ applied: false, reason: 'upgrade-queue-full' })
    expect(
      (
        useCityStore.getState() as ReturnType<typeof useCityStore.getState> & {
          pendingMainUpgrades?: unknown[]
        }
      ).pendingMainUpgrades,
    ).toHaveLength(2)
  })

  it('atomically blocks clubhouse main upgrades below gang level 40', () => {
    const before = useCityStore.getState()

    expect(before.upgradeMainBuilding('clubhouse', 39, START)).toEqual({
      applied: false,
      reason: 'building-locked',
    })
    expect(useCityStore.getState()).toBe(before)
  })

  it('atomically blocks clubhouse main upgrades with insufficient resources', () => {
    useCityStore.setState({
      resources: { money: 0, oil: 0, materials: 0 },
    })
    const before = useCityStore.getState()

    expect(before.upgradeMainBuilding('clubhouse', 40, START)).toEqual({
      applied: false,
      reason: 'insufficient-resources',
    })
    expect(useCityStore.getState()).toBe(before)
  })

  it('atomically blocks clubhouse main upgrades at level 10', () => {
    useCityStore.setState((state) => ({
      buildingProgress: {
        ...state.buildingProgress,
        clubhouse: { level: 10, childLevels: Array(10).fill(0) as never },
      },
    }))
    const before = useCityStore.getState()

    expect(before.upgradeMainBuilding('clubhouse', 40, START)).toEqual({
      applied: false,
      reason: 'building-maxed',
    })
    expect(useCityStore.getState()).toBe(before)
  })

  it('settles before a stale main-upgrade confirmation is rechecked', () => {
    useCityStore.setState((state) => ({
      resources: { money: 24, oil: 0, materials: 0 },
      lastResourceUpdatedAt: START - 10_000,
      buildingProgress: {
        ...state.buildingProgress,
        'repair-shop': { level: 1, childLevels: [1, 0, 0, 0, 0] },
      },
    }))

    const result = useCityStore
      .getState()
      .upgradeMainBuilding('repair-shop', 1, START)

    expect(result).toEqual({ applied: true, reason: 'ready' })
    expect(useCityStore.getState().resources.money).toBe(0)
    expect(useCityStore.getState().buildingProgress['repair-shop'].level).toBe(
      1,
    )
    useCityStore.getState().syncMainUpgrades(START + 10_000)
    expect(useCityStore.getState().buildingProgress['repair-shop'].level).toBe(
      2,
    )
    expect(useCityStore.getState().lastResourceUpdatedAt).toBe(START)
  })

  it('persists settlement when a main upgrade still lacks resources', () => {
    useCityStore.setState((state) => ({
      resources: { money: 0, oil: 0, materials: 0 },
      lastResourceUpdatedAt: START - 10_000,
      buildingProgress: {
        ...state.buildingProgress,
        'repair-shop': { level: 1, childLevels: [1, 0, 0, 0, 0] },
      },
    }))

    const result = useCityStore
      .getState()
      .upgradeMainBuilding('repair-shop', 1, START)

    expect(result).toEqual({
      applied: false,
      reason: 'insufficient-resources',
    })
    expect(useCityStore.getState().resources.money).toBe(1)
    expect(useCityStore.getState().buildingProgress['repair-shop'].level).toBe(
      1,
    )
    expect(useCityStore.getState().lastResourceUpdatedAt).toBe(START)
  })

  it('returns invalid-request without changing state for invalid upgrades', () => {
    for (const run of [
      () =>
        useCityStore.getState().upgradeChildBuilding('unknown', 0, 50, START),
      () =>
        useCityStore
          .getState()
          .upgradeChildBuilding('repair-shop', 5, 50, START),
      () =>
        useCityStore
          .getState()
          .upgradeChildBuilding('repair-shop', 0.5, 50, START),
      () =>
        useCityStore
          .getState()
          .upgradeChildBuilding('repair-shop', 0, 50, Number.NaN),
      () => useCityStore.getState().upgradeMainBuilding('unknown', 50, START),
      () =>
        useCityStore
          .getState()
          .upgradeMainBuilding('repair-shop', 50, Number.POSITIVE_INFINITY),
    ]) {
      const before = useCityStore.getState()
      expect(run()).toEqual({ applied: false, reason: 'invalid-request' })
      expect(useCityStore.getState()).toBe(before)
    }
  })

  it('lets the pure decision reject a legal-capacity hidden child index', () => {
    const before = useCityStore.getState()
    expect(before.upgradeChildBuilding('repair-shop', 1, 1, START)).toEqual({
      applied: false,
      reason: 'child-locked',
    })
    expect(useCityStore.getState()).toBe(before)
  })

  it('grants debug resources after settlement, cumulatively and saturating', () => {
    useCityStore.setState({
      resources: {
        money: Number.MAX_SAFE_INTEGER - 5_000,
        oil: 0,
        materials: 0,
      },
      lastResourceUpdatedAt: START - 10_000,
    })

    useCityStore.getState().grantDebugResources(START)
    useCityStore.getState().grantDebugResources(START)

    expect(useCityStore.getState().resources).toEqual({
      money: Number.MAX_SAFE_INTEGER,
      oil: 20_000,
      materials: 20_000,
    })
    expect(useCityStore.getState().lastResourceUpdatedAt).toBe(START)
  })

  it('settles current production before adding 10000 to every resource', () => {
    useCityStore.getState().grantDebugResources(START + 10_000)

    expect(useCityStore.getState().resources).toEqual({
      money: 20_001,
      oil: 10_000,
      materials: 10_000,
    })
    expect(useCityStore.getState().lastResourceUpdatedAt).toBe(START + 10_000)
  })

  it('saturates every debug-granted resource at the safe integer limit', () => {
    useCityStore.setState({
      resources: {
        money: Number.MAX_SAFE_INTEGER - 1,
        oil: Number.MAX_SAFE_INTEGER - 2,
        materials: Number.MAX_SAFE_INTEGER - 3,
      },
    })

    useCityStore.getState().grantDebugResources(START)

    expect(useCityStore.getState().resources).toEqual({
      money: Number.MAX_SAFE_INTEGER,
      oil: Number.MAX_SAFE_INTEGER,
      materials: Number.MAX_SAFE_INTEGER,
    })
  })

  it('ignores a debug resource grant with non-finite time', () => {
    const before = useCityStore.getState()
    useCityStore.getState().grantDebugResources(Number.NaN)
    expect(useCityStore.getState()).toBe(before)
  })

  it('keeps the initial 10000 wallet when hydrating with empty storage', async () => {
    window.localStorage.clear()

    await useCityStore.persist.rehydrate()

    const state = useCityStore.getState()
    expect(state.resources).toEqual({ money: 10_000, oil: 0, materials: 0 })
    expect(state.buildingProgress['repair-shop']).toEqual({
      level: 1,
      childLevels: [0, 0, 0, 0, 0],
    })
    expect(state.activeProducerIds).toEqual(['repair-shop'])
    expect(state.claimedBuildingIds).toEqual(['repair-shop'])
  })

  it('migrates a v3 clubhouse refund once and rehydrates v7 without repeating it', async () => {
    window.localStorage.setItem(
      CITY_STORAGE_KEY,
      JSON.stringify({
        version: 3,
        state: {
          buildingProgress: {
            clubhouse: {
              level: 2,
              childLevels: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            },
          },
          resources: { money: 100, oil: 7, materials: 9 },
          lastResourceUpdatedAt: START,
          activeProducerIds: ['repair-shop'],
        },
      }),
    )

    await useCityStore.persist.rehydrate()
    expect(useCityStore.getState().resources).toEqual({
      money: 105,
      oil: 7,
      materials: 9,
    })
    expect(useCityStore.getState().buildingProgress.clubhouse).toEqual({
      level: 2,
      childLevels: Array(10).fill(0),
    })

    useCityStore.getState().selectBuilding('clubhouse')
    const raw = window.localStorage.getItem(CITY_STORAGE_KEY)
    expect(JSON.parse(raw as string).version).toBe(7)

    await useCityStore.persist.rehydrate()
    expect(useCityStore.getState().resources).toEqual({
      money: 105,
      oil: 7,
      materials: 9,
    })
  })

  it('normalizes a malformed v4 clubhouse without issuing a refund', async () => {
    window.localStorage.setItem(
      CITY_STORAGE_KEY,
      JSON.stringify({
        version: 4,
        state: {
          buildingProgress: {
            clubhouse: {
              level: 2,
              childLevels: [1, 2, 0, 0, 0, 0, 0, 0, 0, 0],
            },
          },
          resources: { money: 100, oil: 7, materials: 9 },
          lastResourceUpdatedAt: START,
          activeProducerIds: ['repair-shop'],
        },
      }),
    )

    await useCityStore.persist.rehydrate()

    expect(
      useCityStore.getState().buildingProgress.clubhouse.childLevels,
    ).toEqual(Array(10).fill(0))
    expect(useCityStore.getState().resources).toEqual({
      money: 100,
      oil: 7,
      materials: 9,
    })
  })

  it('persists only the seven durable v7 fields', () => {
    useCityStore.getState().selectBuilding('repair-shop')
    useCityStore.getState().syncResourceProduction(START + 10_000, 1)

    const raw = window.localStorage.getItem(CITY_STORAGE_KEY)
    const persisted = JSON.parse(raw as string) as {
      version: number
      state: Record<string, unknown>
    }
    expect(persisted.version).toBe(7)
    expect(Object.keys(persisted.state)).toEqual([
      'buildingProgress',
      'resources',
      'lastResourceUpdatedAt',
      'activeProducerIds',
      'claimedBuildingIds',
      'pendingMainUpgrades',
      'appliedStageRewardIds',
    ])
    expect(
      BUILDING_IDS.every(
        (id) =>
          !(
            'completedFragments' in
            (persisted.state.buildingProgress as Record<string, object>)[id]
          ),
      ),
    ).toBe(true)
  })
})
