import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdventureStore } from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
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
    vi.useRealTimers()
  })

  it('settles one deterministic part after an unlocked yard interval', () => {
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      lastUpdatedAt: NOW,
    })
    render(<PartSalvageController />)

    act(() => {
      vi.advanceTimersByTime(getPartDropIntervalMs(1))
    })

    expect(useAdventureStore.getState().carPartInventory).toEqual([
      {
        id: 'part-1',
        slot: 'tires',
        quality: 'worn',
        level: 1,
      },
    ])
  })

  it('does not backfill time accumulated before the yard unlocks', () => {
    const view = render(<PartSalvageController />)

    act(() => {
      vi.advanceTimersByTime(getPartDropIntervalMs(1) * 2)
      useGangStore.setState({
        totalReputation: getTotalReputationForLevel(8),
        lastUpdatedAt: Date.now(),
      })
      vi.advanceTimersByTime(1_000)
    })

    expect(useAdventureStore.getState().carPartInventory).toEqual([])
    expect(useAdventureStore.getState().partIdleClock).toBe(Date.now())
    view.unmount()
  })
})
