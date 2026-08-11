import { useAdventureStore } from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
import { useChapterStore } from '../store/useChapterStore'
import { useGangStore } from '../store/useGangStore'
import { useStoryStore } from '../store/useStoryStore'

export function resetAccount(now: number = Date.now()): void {
  const resetTime = Number.isFinite(now) ? now : Date.now()
  useCityStore.getState().reset(resetTime)
  useGangStore.getState().reset(resetTime)
  useAdventureStore.getState().reset(resetTime)
  useChapterStore.getState().reset()
  useStoryStore.getState().reset()
}
