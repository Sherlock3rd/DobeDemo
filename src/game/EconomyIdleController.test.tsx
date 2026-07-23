import { act, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { EconomyIdleController } from './EconomyIdleController'

const BASE_TIME = 1_700_000_000_000

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('EconomyIdleController', () => {
  const originalSyncResourceProduction =
    useCityStore.getState().syncResourceProduction

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE_TIME)
    window.localStorage.clear()
    useGangStore.getState().reset(BASE_TIME)
    useCityStore.getState().reset(BASE_TIME)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
  })

  afterEach(() => {
    useCityStore.setState({
      syncResourceProduction: originalSyncResourceProduction,
    })
    useGangStore.getState().reset(BASE_TIME)
    useCityStore.getState().reset(BASE_TIME)
    window.localStorage.clear()
    vi.useRealTimers()
  })

  it('renders nothing and syncs immediately on mount with current time and gang level', () => {
    const syncSpy = vi.fn<(now: number, gangLevel: number) => void>()
    useCityStore.setState({ syncResourceProduction: syncSpy })
    useGangStore.setState({ totalReputation: 210 })

    const { container } = render(<EconomyIdleController />)

    expect(container.innerHTML).toBe('')
    expect(syncSpy).toHaveBeenCalledTimes(1)
    expect(syncSpy).toHaveBeenCalledWith(BASE_TIME, 8)
  })

  it('checks every second without changing the wallet before ten seconds', () => {
    render(<EconomyIdleController />)

    act(() => {
      vi.advanceTimersByTime(9_000)
    })

    expect(useCityStore.getState().resources).toEqual({
      money: 0,
      oil: 0,
      materials: 0,
    })
  })

  it('credits repair-shop money on the tenth second', () => {
    render(<EconomyIdleController />)

    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(useCityStore.getState().resources.money).toBe(1)
    expect(useCityStore.getState().lastResourceUpdatedAt).toBe(
      BASE_TIME + 10_000,
    )
  })

  it('syncs when the document becomes visible', () => {
    const syncSpy = vi.fn<(now: number, gangLevel: number) => void>()
    useCityStore.setState({ syncResourceProduction: syncSpy })
    render(<EconomyIdleController />)

    vi.setSystemTime(BASE_TIME + 5_000)
    setVisibility('hidden')
    expect(syncSpy).toHaveBeenCalledTimes(1)

    setVisibility('visible')
    expect(syncSpy).toHaveBeenCalledTimes(2)
    expect(syncSpy).toHaveBeenLastCalledWith(BASE_TIME + 5_000, 1)
  })

  it('does not duplicate production under StrictMode', () => {
    render(
      <StrictMode>
        <EconomyIdleController />
      </StrictMode>,
    )

    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(useCityStore.getState().resources.money).toBe(1)
  })

  it('cleans up the interval and visibility listener on unmount', () => {
    const syncSpy = vi.fn<(now: number, gangLevel: number) => void>()
    useCityStore.setState({ syncResourceProduction: syncSpy })
    const { unmount } = render(<EconomyIdleController />)
    expect(syncSpy).toHaveBeenCalledTimes(1)

    unmount()
    vi.setSystemTime(BASE_TIME + 5_000)
    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    setVisibility('visible')

    expect(syncSpy).toHaveBeenCalledTimes(1)
  })
})
