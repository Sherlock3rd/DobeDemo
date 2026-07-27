import { useEffect } from 'react'
import { useAdventureStore } from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'

export function PartSalvageController(): null {
  const resetPartIdleClock = useAdventureStore(
    (state) => state.resetPartIdleClock,
  )

  useEffect(() => {
    let hydrating = false
    let wasClaimed = useCityStore
      .getState()
      .claimedBuildingIds.includes('recycling-yard')

    const unsubscribeHydrate = useCityStore.persist.onHydrate(() => {
      hydrating = true
    })
    const unsubscribeFinishHydration = useCityStore.persist.onFinishHydration(
      (state) => {
        wasClaimed = state.claimedBuildingIds.includes('recycling-yard')
        hydrating = false
      },
    )
    const unsubscribeStore = useCityStore.subscribe((state) => {
      if (hydrating) return
      const claimed = state.claimedBuildingIds.includes('recycling-yard')
      if (!wasClaimed && claimed) {
        resetPartIdleClock(Date.now())
      }
      wasClaimed = claimed
    })

    return () => {
      unsubscribeStore()
      unsubscribeFinishHydration()
      unsubscribeHydrate()
    }
  }, [resetPartIdleClock])

  return null
}
