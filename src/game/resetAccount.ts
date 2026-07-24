import { useAdventureStore } from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'

export function resetAccount(now: number = Date.now()): void {
  const resetTime = Number.isFinite(now) ? now : Date.now()
  useCityStore.getState().reset(resetTime)
  useGangStore.getState().reset(resetTime)
  useAdventureStore.getState().reset(resetTime)
}
