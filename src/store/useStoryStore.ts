import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { STORY_COMPLETE_STEP, getStoryStep } from '../game/storyPlanB'
import { createSafeStorage } from './safeStorage'

export const STORY_STORAGE_KEY = 'dobe-story-plan-b-v1'

interface StoryState {
  enabled: boolean
  currentStepNumber: number
  briefedStepNumbers: number[]
  advance: (expectedStepNumber: number) => boolean
  markBriefed: (stepNumber: number) => void
  setEnabled: (enabled: boolean) => void
  reset: () => void
}

function normalizeStep(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1
  return Math.min(STORY_COMPLETE_STEP, Math.max(1, Math.trunc(value)))
}

function normalizeBriefed(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter(
        (entry): entry is number =>
          typeof entry === 'number' &&
          Number.isInteger(entry) &&
          getStoryStep(entry) !== null,
      ),
    ),
  ]
}

export const useStoryStore = create<StoryState>()(
  persist(
    (set, get) => ({
      enabled: true,
      currentStepNumber: 1,
      briefedStepNumbers: [],
      advance: (expectedStepNumber) => {
        if (get().currentStepNumber !== expectedStepNumber) return false
        set({
          currentStepNumber: Math.min(
            STORY_COMPLETE_STEP,
            expectedStepNumber + 1,
          ),
        })
        return true
      },
      markBriefed: (stepNumber) => {
        if (!getStoryStep(stepNumber)) return
        set((state) =>
          state.briefedStepNumbers.includes(stepNumber)
            ? state
            : {
                briefedStepNumbers: [...state.briefedStepNumbers, stepNumber],
              },
        )
      },
      setEnabled: (enabled) => set({ enabled }),
      reset: () =>
        set({
          enabled: true,
          currentStepNumber: 1,
          briefedStepNumbers: [],
        }),
    }),
    {
      name: STORY_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted) => {
        const source =
          typeof persisted === 'object' && persisted !== null
            ? (persisted as {
                enabled?: unknown
                currentStepNumber?: unknown
                briefedStepNumbers?: unknown
              })
            : {}
        return {
          enabled: source.enabled !== false,
          currentStepNumber: normalizeStep(source.currentStepNumber),
          briefedStepNumbers: normalizeBriefed(source.briefedStepNumbers),
        }
      },
      partialize: (state) => ({
        enabled: state.enabled,
        currentStepNumber: state.currentStepNumber,
        briefedStepNumbers: state.briefedStepNumbers,
      }),
    },
  ),
)
