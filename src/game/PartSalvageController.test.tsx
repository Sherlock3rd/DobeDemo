import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdventureStore } from '../store/useAdventureStore'
import { CITY_STORAGE_KEY, useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { getPartDropIntervalMs } from './equipmentProgression'
import { getTotalReputationForLevel } from './gangProgression'
import { PartSalvageController } from './PartSalvageController'

const NOW = 1_700_000_000_000

describe('PartSalvageController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    window.localStorage.clear()
    useGangStore.getState().reset(NOW)
    useCityStore.getState().reset(NOW)
    useAdventureStore.getState().reset(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('preserves accumulated time without automatically adding parts', () => {
    const random = vi.spyOn(Math, 'random')
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      currentLevel: 8,
      lastUpdatedAt: NOW,
    })
    useCityStore.setState({ claimedBuildingIds: ['recycling-yard'] })
    useAdventureStore.setState({
      partIdleClock: NOW - getPartDropIntervalMs(1),
    })
    render(<PartSalvageController />)

    act(() => {
      vi.advanceTimersByTime(getPartDropIntervalMs(1) * 2)
    })

    expect(useAdventureStore.getState().carPartInventory).toEqual([])
    expect(useAdventureStore.getState().partIdleClock).toBe(
      NOW - getPartDropIntervalMs(1),
    )
    expect(random).not.toHaveBeenCalled()
  })

  it('resets the salvage clock only on a not-claimed-to-claimed edge', () => {
    useAdventureStore.setState({
      partIdleClock: NOW - getPartDropIntervalMs(1),
    })
    render(<PartSalvageController />)

    act(() => {
      vi.setSystemTime(NOW + 5_000)
      useCityStore.setState({ claimedBuildingIds: ['recycling-yard'] })
    })

    expect(useAdventureStore.getState().carPartInventory).toEqual([])
    expect(useAdventureStore.getState().partIdleClock).toBe(Date.now())
  })

  it('treats a claimed rehydrate as initial state instead of a claim edge', async () => {
    const accumulatedClock = NOW - getPartDropIntervalMs(1) * 2
    useAdventureStore.setState({ partIdleClock: accumulatedClock })
    render(<PartSalvageController />)
    const city = useCityStore.getState()
    window.localStorage.setItem(
      CITY_STORAGE_KEY,
      JSON.stringify({
        state: {
          buildingProgress: city.buildingProgress,
          resources: city.resources,
          lastResourceUpdatedAt: NOW,
          activeProducerIds: [],
          claimedBuildingIds: ['recycling-yard'],
          pendingMainUpgrades: [],
          appliedStageRewardIds: [],
        },
        version: 6,
      }),
    )

    await act(async () => {
      await useCityStore.persist.rehydrate()
    })

    expect(useAdventureStore.getState().carPartInventory).toEqual([])
    expect(useAdventureStore.getState().partIdleClock).toBe(accumulatedClock)
  })
})
