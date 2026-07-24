import { render } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADVENTURE_STORAGE_KEY } from '../store/adventureMigration'
import { AdventureIdleClock } from './AdventureIdleClock'
import { useChestTick } from './chestTick'

describe('AdventureIdleClock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useChestTick.setState({ tick: 0, now: 0 })
    localStorage.setItem(ADVENTURE_STORAGE_KEY, '{"sentinel":true}')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mounts, ticks on an interval, and never persists on its own', () => {
    const { unmount } = render(<AdventureIdleClock />)
    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    expect(useChestTick.getState().tick).toBe(3)
    expect(localStorage.getItem(ADVENTURE_STORAGE_KEY)).toBe(
      '{"sentinel":true}',
    )
    unmount()
  })
})
