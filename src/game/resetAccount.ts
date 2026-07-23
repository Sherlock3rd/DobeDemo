import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'

export function resetAccount(now: number = Date.now()): void {
  useCityStore.getState().reset()
  useGangStore.getState().reset(now)
}
