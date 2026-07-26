import { useEffect } from 'react'
import { useAdventureStore } from '../store/useAdventureStore'
import { useGangStore } from '../store/useGangStore'
import { isBuildingUnlocked } from './gangProgression'

export function PartSalvageController(): null {
  const resetPartIdleClock = useAdventureStore(
    (state) => state.resetPartIdleClock,
  )

  useEffect(() => {
    let hydrating = false
    let wasUnlocked = isBuildingUnlocked(
      'recycling-yard',
      useGangStore.getState().currentLevel,
    )

    const unsubscribeHydrate = useGangStore.persist.onHydrate(() => {
      hydrating = true
    })
    const unsubscribeFinishHydration = useGangStore.persist.onFinishHydration(
      (state) => {
        wasUnlocked = isBuildingUnlocked('recycling-yard', state.currentLevel)
        hydrating = false
      },
    )
    const unsubscribeStore = useGangStore.subscribe((state) => {
      if (hydrating) return
      const unlocked = isBuildingUnlocked('recycling-yard', state.currentLevel)
      if (!wasUnlocked && unlocked) {
        resetPartIdleClock(Date.now())
      }
      wasUnlocked = unlocked
    })

    return () => {
      unsubscribeStore()
      unsubscribeFinishHydration()
      unsubscribeHydrate()
    }
  }, [resetPartIdleClock])

  return null
}
