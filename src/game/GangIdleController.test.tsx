import { act, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGangStore } from '../store/useGangStore'
import { GangIdleController } from './GangIdleController'

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('GangIdleController', () => {
  const originalSyncIdleProgress = useGangStore.getState().syncIdleProgress
  let syncSpy: ReturnType<typeof vi.fn<(now: number) => void>>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    window.localStorage.clear()
    syncSpy = vi.fn<(now: number) => void>()
    useGangStore.setState({ syncIdleProgress: syncSpy })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
  })

  afterEach(() => {
    useGangStore.setState({ syncIdleProgress: originalSyncIdleProgress })
    useGangStore.getState().reset(1_000)
    window.localStorage.clear()
    vi.useRealTimers()
  })

  it('renders nothing', () => {
    const { container } = render(<GangIdleController />)
    expect(container.innerHTML).toBe('')
  })

  it('syncs immediately on mount with the current time', () => {
    render(<GangIdleController />)

    expect(syncSpy).toHaveBeenCalledTimes(1)
    expect(syncSpy).toHaveBeenLastCalledWith(1_000)
  })

  it('syncs again every 1000ms while mounted', () => {
    render(<GangIdleController />)
    expect(syncSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1_000)
    expect(syncSpy).toHaveBeenCalledTimes(2)
    expect(syncSpy).toHaveBeenLastCalledWith(2_000)

    vi.advanceTimersByTime(1_000)
    expect(syncSpy).toHaveBeenCalledTimes(3)
    expect(syncSpy).toHaveBeenLastCalledWith(3_000)
  })

  it('does not sync when the document becomes hidden', () => {
    render(<GangIdleController />)
    expect(syncSpy).toHaveBeenCalledTimes(1)

    vi.setSystemTime(1_500)
    setVisibility('hidden')

    expect(syncSpy).toHaveBeenCalledTimes(1)
  })

  it('syncs when the document becomes visible again', () => {
    render(<GangIdleController />)
    expect(syncSpy).toHaveBeenCalledTimes(1)

    vi.setSystemTime(1_200)
    setVisibility('hidden')
    expect(syncSpy).toHaveBeenCalledTimes(1)

    vi.setSystemTime(1_800)
    setVisibility('visible')
    expect(syncSpy).toHaveBeenCalledTimes(2)
    expect(syncSpy).toHaveBeenLastCalledWith(1_800)
  })

  it('stops the interval and removes the visibility listener on unmount', () => {
    const { unmount } = render(<GangIdleController />)
    expect(syncSpy).toHaveBeenCalledTimes(1)

    unmount()

    vi.setSystemTime(5_000)
    vi.advanceTimersByTime(3_000)
    setVisibility('visible')

    expect(syncSpy).toHaveBeenCalledTimes(1)
  })

  it('settles once per second with the real store under StrictMode and stops after unmount', () => {
    useGangStore.setState({ syncIdleProgress: originalSyncIdleProgress })
    useGangStore.getState().reset(1_000)

    const { unmount } = render(
      <StrictMode>
        <GangIdleController />
      </StrictMode>,
    )

    expect(useGangStore.getState().totalReputation).toBe(0)

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(useGangStore.getState().totalReputation).toBe(5)
    expect(useGangStore.getState().lastUpdatedAt).toBe(2_000)

    unmount()
    act(() => {
      vi.advanceTimersByTime(2_000)
    })

    expect(useGangStore.getState().totalReputation).toBe(5)
    expect(useGangStore.getState().lastUpdatedAt).toBe(2_000)
  })
})
