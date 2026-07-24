import { beforeEach, describe, expect, it } from 'vitest'
import { BUILDING_IDS } from '../game/cityTypes'
import { CITY_STORAGE_KEY } from './cityProgressMigration'
import { useCityStore } from './useCityStore'

const START = 1_700_000_000_000

describe('useCityStore atomic economy', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset(START)
  })

  it('starts with canonical progress, 10000 money, and repair active', () => {
    const state = useCityStore.getState()
    expect(state.selectedBuildingId).toBeNull()
    expect(state.buildingProgress['repair-shop']).toEqual({
      level: 1,
      childLevels: [0, 0, 0, 0, 0],
    })
    expect(state.resources).toEqual({ money: 10_000, oil: 0, materials: 0 })
    expect(state.lastResourceUpdatedAt).toBe(START)
    expect(state.activeProducerIds).toEqual(['repair-shop'])
  })

  it('settles old producers before activating newly unlocked producers', () => {
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
    useCityStore.getState().syncResourceProduction(unlockTime, 16)
    useCityStore.getState().syncResourceProduction(unlockTime + 10_000, 16)

    expect(useCityStore.getState().resources.money).toBe(12_883)
  })

  it('does not move the resource clock backward when producers change', () => {
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

  it('atomically charges and upgrades a caught-up repair main building', () => {
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
      level: 2,
      childLevels: [1, 0, 0, 0, 0],
    })
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

  it('ignores a debug resource grant with non-finite time', () => {
    const before = useCityStore.getState()
    useCityStore.getState().grantDebugResources(Number.NaN)
    expect(useCityStore.getState()).toBe(before)
  })

  it('persists only the four durable v3 fields', () => {
    useCityStore.getState().selectBuilding('repair-shop')
    useCityStore.getState().syncResourceProduction(START + 10_000, 1)

    const raw = window.localStorage.getItem(CITY_STORAGE_KEY)
    const persisted = JSON.parse(raw as string) as {
      version: number
      state: Record<string, unknown>
    }
    expect(persisted.version).toBe(3)
    expect(Object.keys(persisted.state)).toEqual([
      'buildingProgress',
      'resources',
      'lastResourceUpdatedAt',
      'activeProducerIds',
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
