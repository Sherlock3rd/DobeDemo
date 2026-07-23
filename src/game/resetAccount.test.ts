import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BUILDING_IDS } from './cityTypes'
import { CITY_STORAGE_KEY } from '../store/useCityStore'
import { GANG_STORAGE_KEY, useGangStore } from '../store/useGangStore'
import { useCityStore } from '../store/useCityStore'
import { resetAccount } from './resetAccount'

const BASE_TIME = 1_700_000_000_000
const RESET_TIME = BASE_TIME + 100_000
const FALLBACK_TIME = BASE_TIME + 200_000

function readCityPersistedState(): Record<string, unknown> | null {
  const raw = window.localStorage.getItem(CITY_STORAGE_KEY)
  if (raw === null) {
    return null
  }
  return JSON.parse(raw).state as Record<string, unknown>
}

function readGangPersistedState(): Record<string, unknown> | null {
  const raw = window.localStorage.getItem(GANG_STORAGE_KEY)
  if (raw === null) {
    return null
  }
  return JSON.parse(raw).state as Record<string, unknown>
}

describe('resetAccount', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset()
    useGangStore.getState().reset(BASE_TIME)
  })

  afterEach(() => {
    vi.useRealTimers()
    useCityStore.getState().reset()
    useGangStore.getState().reset(BASE_TIME)
    window.localStorage.clear()
  })

  it('restores both progression stores and clears the selected building', () => {
    useGangStore.setState({ totalReputation: 480, lastUpdatedAt: BASE_TIME })
    useCityStore.setState({
      selectedBuildingId: 'repair-shop',
      buildingProgress: {
        ...useCityStore.getState().buildingProgress,
        'repair-shop': { level: 7, completedFragments: 4 },
      },
    })

    resetAccount(RESET_TIME)

    expect(useGangStore.getState().totalReputation).toBe(0)
    expect(useGangStore.getState().lastUpdatedAt).toBe(RESET_TIME)
    expect(useCityStore.getState().selectedBuildingId).toBeNull()
    expect(useCityStore.getState().buildingProgress['repair-shop']).toEqual({
      level: 1,
      completedFragments: 0,
    })
  })

  it('persists reset state to storage and survives rehydrate', async () => {
    useGangStore.setState({ totalReputation: 480, lastUpdatedAt: BASE_TIME })
    useCityStore.setState({
      selectedBuildingId: 'repair-shop',
      buildingProgress: {
        ...useCityStore.getState().buildingProgress,
        'repair-shop': { level: 7, completedFragments: 4 },
        'gas-station': { level: 3, completedFragments: 1 },
      },
    })

    resetAccount(RESET_TIME)

    const cityPersisted = readCityPersistedState()
    expect(cityPersisted).not.toBeNull()
    const buildingProgress = (
      cityPersisted as { buildingProgress: Record<string, unknown> }
    ).buildingProgress
    for (const id of BUILDING_IDS) {
      expect(buildingProgress[id]).toEqual({
        level: 1,
        completedFragments: 0,
      })
    }

    const gangPersisted = readGangPersistedState()
    expect(gangPersisted).not.toBeNull()
    expect(gangPersisted?.totalReputation).toBe(0)
    expect(gangPersisted?.lastUpdatedAt).toBe(RESET_TIME)

    await useCityStore.persist.rehydrate()
    await useGangStore.persist.rehydrate()

    expect(useGangStore.getState().totalReputation).toBe(0)
    expect(useGangStore.getState().lastUpdatedAt).toBe(RESET_TIME)
    expect(useCityStore.getState().selectedBuildingId).toBeNull()
    expect(
      BUILDING_IDS.every(
        (id) =>
          useCityStore.getState().buildingProgress[id].level === 1 &&
          useCityStore.getState().buildingProgress[id].completedFragments === 0,
      ),
    ).toBe(true)
  })

  it('falls back to Date.now() when reset receives a non-finite timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(FALLBACK_TIME)

    useGangStore.setState({ totalReputation: 480, lastUpdatedAt: BASE_TIME })

    resetAccount(Number.NaN)

    expect(useGangStore.getState().lastUpdatedAt).toBe(FALLBACK_TIME)
  })
})
