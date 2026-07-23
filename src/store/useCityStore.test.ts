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

  it('starts with canonical progress, zero resources, and repair active', () => {
    const state = useCityStore.getState()
    expect(state.selectedBuildingId).toBeNull()
    expect(state.buildingProgress['repair-shop']).toEqual({
      level: 1,
      childLevels: [0, 0, 0, 0, 0],
    })
    expect(state.resources).toEqual({ money: 0, oil: 0, materials: 0 })
    expect(state.lastResourceUpdatedAt).toBe(START)
    expect(state.activeProducerIds).toEqual(['repair-shop'])
  })

  it('settles old producers before activating newly unlocked producers', () => {
    useCityStore
      .getState()
      .syncResourceProduction(START + 8 * 60 * 60 * 1000, 16)

    const state = useCityStore.getState()
    expect(state.resources.money).toBe(2_880)
    expect(state.activeProducerIds).toEqual([
      'repair-shop',
      'commercial-street',
    ])
  })

  it('does not backdate production for a newly activated commercial street', () => {
    const unlockTime = START + 8 * 60 * 60 * 1000
    useCityStore.getState().syncResourceProduction(unlockTime, 16)
    useCityStore.getState().syncResourceProduction(unlockTime + 10_000, 16)

    expect(useCityStore.getState().resources.money).toBe(2_883)
  })

  it('settles old production, charges five money, and upgrades only child 4', () => {
    useCityStore.setState({
      resources: { money: 5, oil: 0, materials: 0 },
    })

    useCityStore
      .getState()
      .upgradeChildBuilding('repair-shop', 4, 1, START + 10_000)

    const state = useCityStore.getState()
    expect(state.resources.money).toBe(1)
    expect(state.buildingProgress['repair-shop'].childLevels).toEqual([
      0, 0, 0, 0, 1,
    ])
    expect(state.lastResourceUpdatedAt).toBe(START + 10_000)
  })

  it('keeps the complete state reference when child funds are insufficient', () => {
    const before = useCityStore.getState()
    useCityStore.getState().upgradeChildBuilding('repair-shop', 0, 1, START)
    expect(useCityStore.getState()).toBe(before)
  })

  it('atomically charges and upgrades a caught-up repair main building', () => {
    useCityStore.setState((state) => ({
      resources: { money: 25, oil: 0, materials: 0 },
      buildingProgress: {
        ...state.buildingProgress,
        'repair-shop': { level: 1, childLevels: Array(5).fill(1) },
        clubhouse: { level: 2, childLevels: Array(10).fill(0) },
      },
    }))

    useCityStore.getState().upgradeMainBuilding('repair-shop', 40, START)

    expect(useCityStore.getState().resources.money).toBe(0)
    expect(useCityStore.getState().buildingProgress['repair-shop']).toEqual({
      level: 2,
      childLevels: Array(5).fill(1),
    })
  })

  it('keeps state unchanged when clubhouse is locked or too low', () => {
    useCityStore.setState((state) => ({
      resources: { money: 100, oil: 0, materials: 0 },
      buildingProgress: {
        ...state.buildingProgress,
        'repair-shop': { level: 1, childLevels: Array(5).fill(1) },
      },
    }))

    const locked = useCityStore.getState()
    locked.upgradeMainBuilding('repair-shop', 39, START)
    expect(useCityStore.getState()).toBe(locked)

    const tooLow = useCityStore.getState()
    tooLow.upgradeMainBuilding('repair-shop', 40, START)
    expect(useCityStore.getState()).toBe(tooLow)
  })

  it('ignores unknown ids, bad indexes, and non-finite timestamps', () => {
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
          .upgradeChildBuilding('repair-shop', 0, 50, Number.NaN),
      () => useCityStore.getState().upgradeMainBuilding('unknown', 50, START),
      () =>
        useCityStore
          .getState()
          .syncResourceProduction(Number.POSITIVE_INFINITY, 50),
    ]) {
      const before = useCityStore.getState()
      run()
      expect(useCityStore.getState()).toBe(before)
    }
  })

  it('keeps temporary bridge actions canonical', () => {
    useCityStore.getState().completeNextFragment('repair-shop')
    expect(useCityStore.getState().buildingProgress['repair-shop']).toEqual({
      level: 1,
      childLevels: [1, 0, 0, 0, 0],
    })
    for (let index = 0; index < 4; index += 1) {
      useCityStore.getState().completeNextFragment('repair-shop')
    }
    useCityStore.getState().confirmBuildingLevelUp('repair-shop')
    expect(useCityStore.getState().buildingProgress['repair-shop']).toEqual({
      level: 2,
      childLevels: Array(5).fill(1),
    })
  })

  it('persists only the four durable v2 fields', () => {
    useCityStore.getState().selectBuilding('repair-shop')
    useCityStore.getState().syncResourceProduction(START + 10_000, 1)

    const raw = window.localStorage.getItem(CITY_STORAGE_KEY)
    const persisted = JSON.parse(raw as string) as {
      version: number
      state: Record<string, unknown>
    }
    expect(persisted.version).toBe(2)
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
