import { useEffect } from 'react'
import { useGangStore } from '../store/useGangStore'

const SYNC_INTERVAL_MS = 1_000

export function GangIdleController(): null {
  const syncIdleProgress = useGangStore((state) => state.syncIdleProgress)

  useEffect(() => {
    syncIdleProgress(Date.now())

    const intervalId = window.setInterval(() => {
      syncIdleProgress(Date.now())
    }, SYNC_INTERVAL_MS)

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        syncIdleProgress(Date.now())
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [syncIdleProgress])

  return null
}
