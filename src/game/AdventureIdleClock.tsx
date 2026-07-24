import { useEffect } from 'react'
import { useChestTick } from './chestTick'

const REFRESH_MS = 1_000

export function AdventureIdleClock(): null {
  const increment = useChestTick((s) => s.increment)

  useEffect(() => {
    // Seed wall-clock without advancing tick so HUD can compute claimable immediately.
    useChestTick.setState({ now: Date.now() })
    const id = window.setInterval(increment, REFRESH_MS)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') increment()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [increment])

  return null
}
