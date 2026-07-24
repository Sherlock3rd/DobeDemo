import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'

export function unlockGangTreeForDebug(now: number = Date.now()): boolean {
  if (!Number.isFinite(now)) {
    return false
  }

  useCityStore.getState().syncResourceProduction(now, 50)
  useGangStore.getState().unlockForDebug(now)
  return true
}

export function grantAllResourcesForDebug(now: number = Date.now()): boolean {
  if (!Number.isFinite(now)) {
    return false
  }

  useCityStore.getState().grantDebugResources(now)
  return true
}
