import { useEffect } from 'react'
import { useAdventureStore } from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { getGangLevel, isBuildingUnlocked } from './gangProgression'

const SYNC_INTERVAL_MS = 1_000

export function PartSalvageController(): null {
  const settleCarPartIdle = useAdventureStore(
    (state) => state.settleCarPartIdle,
  )
  const resetPartIdleClock = useAdventureStore(
    (state) => state.resetPartIdleClock,
  )

  useEffect(() => {
    const initialGangLevel = getGangLevel(
      useGangStore.getState().totalReputation,
    )
    let wasUnlocked = isBuildingUnlocked('recycling-yard', initialGangLevel)

    const sync = (): void => {
      const now = Date.now()
      const gangLevel = getGangLevel(useGangStore.getState().totalReputation)
      const unlocked = isBuildingUnlocked('recycling-yard', gangLevel)
      if (!unlocked) {
        wasUnlocked = false
        return
      }
      if (!wasUnlocked) {
        resetPartIdleClock(now)
        wasUnlocked = true
        return
      }
      const level =
        useCityStore.getState().buildingProgress['recycling-yard'].level
      settleCarPartIdle(now, level)
    }

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
  }, [resetPartIdleClock, settleCarPartIdle])

  return null
}
