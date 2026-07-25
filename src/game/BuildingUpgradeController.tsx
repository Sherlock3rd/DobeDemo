import { useEffect } from 'react'
import { useCityStore } from '../store/useCityStore'

const SYNC_INTERVAL_MS = 1_000

export function BuildingUpgradeController(): null {
  const syncMainUpgrades = useCityStore((state) => state.syncMainUpgrades)

  useEffect(() => {
    const sync = (): void => syncMainUpgrades(Date.now())

    sync()
    const intervalId = window.setInterval(sync, SYNC_INTERVAL_MS)
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [syncMainUpgrades])

  return null
}
