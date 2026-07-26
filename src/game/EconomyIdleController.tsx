import { useEffect } from 'react'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'

const SYNC_INTERVAL_MS = 1_000

export function EconomyIdleController(): null {
  const syncResourceProduction = useCityStore(
    (state) => state.syncResourceProduction,
  )

  useEffect(() => {
    const sync = (): void => {
      const gangLevel = useGangStore.getState().currentLevel
      syncResourceProduction(Date.now(), gangLevel)
    }

    sync()
    const intervalId = window.setInterval(sync, SYNC_INTERVAL_MS)

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        sync()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [syncResourceProduction])

  return null
}
