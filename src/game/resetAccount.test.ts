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
    useCityStore.getState().reset(BASE_TIME)
    useGangStore.getState().reset(BASE_TIME)
  })

  afterEach(() => {
    vi.useRealTimers()
    useCityStore.getState().reset(BASE_TIME)
    useGangStore.getState().reset(BASE_TIME)
    window.localStorage.clear()
  })

  it('restores both progression stores and clears the selected building', () => {
    useGangStore.setState({ totalReputation: 480, lastUpdatedAt: BASE_TIME })
    useCityStore.setState({
      selectedBuildingId: 'repair-shop',
      buildingProgress: {
        ...useCityStore.getState().buildingProgress,
        'repair-shop': { level: 5, childLevels: [5, 4, 3, 2, 1] },
      },
      resources: { money: 99, oil: 8, materials: 7 },
      activeProducerIds: ['repair-shop', 'commercial-street'],
    })

    resetAccount(RESET_TIME)

    expect(useGangStore.getState().totalReputation).toBe(0)
    expect(useGangStore.getState().lastUpdatedAt).toBe(RESET_TIME)
    expect(useCityStore.getState().selectedBuildingId).toBeNull()
    expect(useCityStore.getState().buildingProgress['repair-shop']).toEqual({
      level: 1,
      childLevels: [0, 0, 0, 0, 0],
    })
    expect(useCityStore.getState().resources).toEqual({
      money: 10_000,
      oil: 0,
      materials: 0,
    })
    expect(useCityStore.getState().lastResourceUpdatedAt).toBe(RESET_TIME)
    expect(useCityStore.getState().activeProducerIds).toEqual(['repair-shop'])
  })

  it('persists reset state to storage and survives rehydrate', async () => {
    useGangStore.setState({ totalReputation: 480, lastUpdatedAt: BASE_TIME })
    useCityStore.setState({
      selectedBuildingId: 'repair-shop',
      buildingProgress: {
        ...useCityStore.getState().buildingProgress,
        'repair-shop': { level: 5, childLevels: [5, 4, 3, 2, 1] },
        'gas-station': { level: 3, childLevels: Array(10).fill(1) },
      },
      resources: { money: 99, oil: 8, materials: 7 },
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
        childLevels: Array(id === 'repair-shop' ? 5 : 10).fill(0),
      })
    }
    expect(cityPersisted?.resources).toEqual({
      money: 10_000,
      oil: 0,
      materials: 0,
    })
    expect(cityPersisted?.lastResourceUpdatedAt).toBe(RESET_TIME)
    expect(cityPersisted?.activeProducerIds).toEqual(['repair-shop'])

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
          useCityStore
            .getState()
            .buildingProgress[id].childLevels.every((level) => level === 0),
      ),
    ).toBe(true)
  })

  it('falls back to Date.now() when reset receives a non-finite timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(FALLBACK_TIME)

    useGangStore.setState({ totalReputation: 480, lastUpdatedAt: BASE_TIME })

    resetAccount(Number.NaN)

    expect(useGangStore.getState().lastUpdatedAt).toBe(FALLBACK_TIME)
    expect(useCityStore.getState().lastResourceUpdatedAt).toBe(FALLBACK_TIME)
  })
})
