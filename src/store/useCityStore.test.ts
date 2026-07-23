import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BUILDING_IDS } from '../game/cityTypes'
import { CITY_STORAGE_KEY } from './cityProgressMigration'
import { useCityStore } from './useCityStore'

function readPersistedState(): Record<string, unknown> | null {
  const raw = window.localStorage.getItem(CITY_STORAGE_KEY)
  if (raw === null) {
    return null
  }
  return JSON.parse(raw).state as Record<string, unknown>
}

describe('useCityStore defaults', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset()
  })

  it('starts with no selection and all six buildings at level 1 / 0 fragments', () => {
    const state = useCityStore.getState()

    expect(state.selectedBuildingId).toBeNull()
    expect(Object.keys(state.buildingProgress)).toHaveLength(
      BUILDING_IDS.length,
    )
    expect(
      BUILDING_IDS.every(
        (id) =>
          state.buildingProgress[id].level === 1 &&
          state.buildingProgress[id].completedFragments === 0,
      ),
    ).toBe(true)
  })

  it('exposes buildingProgress as the single source of truth without a legacy levels view', () => {
    const state = useCityStore.getState() as unknown as Record<string, unknown>

    expect(state.buildingLevels).toBeUndefined()
    expect(state.upgradeBuilding).toBeUndefined()
  })
})

describe('useCityStore selection', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset()
  })

  it('selects, switches, and clears a building', () => {
    useCityStore.getState().selectBuilding('recycling-yard')
    expect(useCityStore.getState().selectedBuildingId).toBe('recycling-yard')

    useCityStore.getState().selectBuilding('repair-shop')
    expect(useCityStore.getState().selectedBuildingId).toBe('repair-shop')

    useCityStore.getState().clearSelection()
    expect(useCityStore.getState().selectedBuildingId).toBeNull()
  })
})

describe('useCityStore fragment progression', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset()
  })

  it('completes one fragment on the target building only', () => {
    useCityStore.getState().completeNextFragment('gas-station')

    const state = useCityStore.getState()
    expect(state.buildingProgress['gas-station']).toEqual({
      level: 1,
      completedFragments: 1,
    })
    expect(
      BUILDING_IDS.filter((id) => id !== 'gas-station').every(
        (id) => state.buildingProgress[id].completedFragments === 0,
      ),
    ).toBe(true)
  })

  it('reaches readiness without leveling up until confirmation, then commits the level', () => {
    const complete = () =>
      useCityStore.getState().completeNextFragment('repair-shop')

    // Level 1 -> target level 2 requires two fragments.
    complete()
    complete()

    let state = useCityStore.getState()
    expect(state.buildingProgress['repair-shop']).toEqual({
      level: 1,
      completedFragments: 2,
    })

    // A third completion while ready keeps the same state object.
    const ready = useCityStore.getState()
    useCityStore.getState().completeNextFragment('repair-shop')
    expect(useCityStore.getState()).toBe(ready)

    useCityStore.getState().confirmBuildingLevelUp('repair-shop')

    state = useCityStore.getState()
    expect(state.buildingProgress['repair-shop']).toEqual({
      level: 2,
      completedFragments: 0,
    })
  })

  it('ignores confirmation before readiness by keeping the same state object', () => {
    useCityStore.getState().completeNextFragment('clubhouse')

    const before = useCityStore.getState()
    useCityStore.getState().confirmBuildingLevelUp('clubhouse')

    expect(useCityStore.getState()).toBe(before)
  })

  it('keeps the same state reference for an unknown building id', () => {
    useCityStore.getState().selectBuilding('metalworking-plant')
    const before = useCityStore.getState()

    useCityStore.getState().completeNextFragment('unknown')
    expect(useCityStore.getState()).toBe(before)

    useCityStore.getState().confirmBuildingLevelUp('unknown')
    expect(useCityStore.getState()).toBe(before)

    expect(useCityStore.getState().selectedBuildingId).toBe(
      'metalworking-plant',
    )
  })
})

describe('useCityStore reset', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset()
  })

  it('resets selection and progress with fresh objects', () => {
    useCityStore.getState().selectBuilding('commercial-street')
    useCityStore.getState().completeNextFragment('commercial-street')
    const previousProgress = useCityStore.getState().buildingProgress

    useCityStore.getState().reset()

    const state = useCityStore.getState()
    expect(state.selectedBuildingId).toBeNull()
    expect(
      BUILDING_IDS.every(
        (id) =>
          state.buildingProgress[id].level === 1 &&
          state.buildingProgress[id].completedFragments === 0,
      ),
    ).toBe(true)
    expect(state.buildingProgress).not.toBe(previousProgress)
  })
})

describe('useCityStore persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset()
  })

  afterEach(() => {
    useCityStore.getState().reset()
    window.localStorage.clear()
  })

  it('persists only buildingProgress and never the selection', () => {
    useCityStore.getState().selectBuilding('repair-shop')
    useCityStore.getState().completeNextFragment('repair-shop')

    const persisted = readPersistedState()
    expect(persisted).not.toBeNull()
    expect(Object.keys(persisted as object)).toEqual(['buildingProgress'])
    expect(
      (persisted as { buildingProgress: Record<string, unknown> })
        .buildingProgress['repair-shop'],
    ).toEqual({ level: 1, completedFragments: 1 })
  })

  it('uses the documented storage key', () => {
    expect(CITY_STORAGE_KEY).toBe('dobe-city-progression-v1')
  })

  it('rehydrates a half-completed upgrade', async () => {
    window.localStorage.setItem(
      CITY_STORAGE_KEY,
      JSON.stringify({
        state: {
          buildingProgress: {
            'repair-shop': { level: 3, completedFragments: 2 },
          },
        },
        version: 1,
      }),
    )

    await useCityStore.persist.rehydrate()

    const state = useCityStore.getState()
    expect(state.buildingProgress['repair-shop']).toEqual({
      level: 3,
      completedFragments: 2,
    })
    // Buildings absent from the save fall back to level 1.
    expect(state.buildingProgress['gas-station']).toEqual({
      level: 1,
      completedFragments: 0,
    })
  })

  it('migrates legacy numeric and corrupt persisted structures on rehydrate', async () => {
    window.localStorage.setItem(
      CITY_STORAGE_KEY,
      JSON.stringify({
        state: {
          buildingProgress: {
            'repair-shop': 2,
            'recycling-yard': { level: 99, completedFragments: 100 },
            'commercial-street': 'corrupt',
            clubhouse: { level: 10, completedFragments: 5 },
          },
        },
        version: 1,
      }),
    )

    await useCityStore.persist.rehydrate()

    const state = useCityStore.getState()
    expect(state.buildingProgress['repair-shop']).toEqual({
      level: 2,
      completedFragments: 0,
    })
    expect(state.buildingProgress['recycling-yard']).toEqual({
      level: 10,
      completedFragments: 0,
    })
    expect(state.buildingProgress['commercial-street']).toEqual({
      level: 1,
      completedFragments: 0,
    })
    expect(state.buildingProgress['clubhouse']).toEqual({
      level: 10,
      completedFragments: 0,
    })
  })

  it('caps a rehydrated level-10 building against further fragments or level ups', async () => {
    window.localStorage.setItem(
      CITY_STORAGE_KEY,
      JSON.stringify({
        state: {
          buildingProgress: {
            clubhouse: { level: 10, completedFragments: 0 },
          },
        },
        version: 1,
      }),
    )

    await useCityStore.persist.rehydrate()

    const ready = useCityStore.getState()
    useCityStore.getState().completeNextFragment('clubhouse')
    expect(useCityStore.getState()).toBe(ready)

    useCityStore.getState().confirmBuildingLevelUp('clubhouse')
    expect(useCityStore.getState()).toBe(ready)

    expect(useCityStore.getState().buildingProgress['clubhouse']).toEqual({
      level: 10,
      completedFragments: 0,
    })
  })
})
