import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdventureStore } from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
import { GANG_STORAGE_KEY, useGangStore } from '../store/useGangStore'
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
      lastUpdatedAt: NOW,
    })
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

  it('resets the salvage clock only on a locked-to-unlocked edge', () => {
    useAdventureStore.setState({
      partIdleClock: NOW - getPartDropIntervalMs(1),
    })
    render(<PartSalvageController />)

    act(() => {
      vi.setSystemTime(NOW + 5_000)
      useGangStore.setState({
        totalReputation: getTotalReputationForLevel(8),
        lastUpdatedAt: Date.now(),
      })
    })

    expect(useAdventureStore.getState().carPartInventory).toEqual([])
    expect(useAdventureStore.getState().partIdleClock).toBe(Date.now())
  })

  it('treats an unlocked rehydrate as initial state instead of an unlock edge', async () => {
    const accumulatedClock = NOW - getPartDropIntervalMs(1) * 2
    useAdventureStore.setState({ partIdleClock: accumulatedClock })
    render(<PartSalvageController />)
    window.localStorage.setItem(
      GANG_STORAGE_KEY,
      JSON.stringify({
        state: {
          totalReputation: getTotalReputationForLevel(8),
          lastUpdatedAt: NOW,
        },
        version: 0,
      }),
    )

    await act(async () => {
      await useGangStore.persist.rehydrate()
    })

    expect(useAdventureStore.getState().carPartInventory).toEqual([])
    expect(useAdventureStore.getState().partIdleClock).toBe(accumulatedClock)
  })
})
