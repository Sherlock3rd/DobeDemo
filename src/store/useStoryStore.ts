import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  STORY_COMPLETE_STEP,
  getStoryRank,
  getStoryStep,
} from '../game/storyPlanB'
import {
  getGangWallReward,
  getGangWallTierForSystemLevel,
  getGangWallTierForReward,
  getHistoricalGangWallRewards,
  isGangWallRewardId,
  type GangWallRewardId,
} from '../game/gangPhotoWall'
import { createSafeStorage } from './safeStorage'

export const STORY_STORAGE_KEY = 'dobe-story-plan-b-v1'

interface StoryState {
  enabled: boolean
  currentStepNumber: number
  briefedStepNumbers: number[]
  claimedGangWallRewardIds: GangWallRewardId[]
  advance: (expectedStepNumber: number) => boolean
  markBriefed: (stepNumber: number) => void
  claimGangWallReward: (rewardId: GangWallRewardId) => boolean
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

function normalizeClaimedRewards(
  value: unknown,
  currentStepNumber: number,
): GangWallRewardId[] {
  const saved = Array.isArray(value)
    ? value.filter(isGangWallRewardId)
    : getHistoricalGangWallRewards(currentStepNumber)
  return [...new Set(saved)]
}

export const useStoryStore = create<StoryState>()(
  persist(
    (set, get) => ({
      enabled: true,
      currentStepNumber: 1,
      briefedStepNumbers: [],
      claimedGangWallRewardIds: [],
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
      claimGangWallReward: (rewardId) => {
        const state = get()
        if (state.claimedGangWallRewardIds.includes(rewardId)) return false
        const reward = getGangWallReward(rewardId)
        const storyRank = getGangWallTierForSystemLevel(
          getStoryRank(state.currentStepNumber).systemLevel,
        )
        const rewardTier = getGangWallTierForReward(reward.id)
        if (
          rewardTier.tier !== storyRank.tier - 1 ||
          reward.availableFromStep > state.currentStepNumber
        ) {
          return false
        }
        set({
          claimedGangWallRewardIds: [
            ...state.claimedGangWallRewardIds,
            rewardId,
          ],
        })
        return true
      },
      setEnabled: (enabled) => set({ enabled }),
      reset: () =>
        set({
          enabled: true,
          currentStepNumber: 1,
          briefedStepNumbers: [],
          claimedGangWallRewardIds: [],
        }),
    }),
    {
      name: STORY_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted) => {
        const source =
          typeof persisted === 'object' && persisted !== null
            ? (persisted as {
                enabled?: unknown
                currentStepNumber?: unknown
                briefedStepNumbers?: unknown
                claimedGangWallRewardIds?: unknown
              })
            : {}
        const currentStepNumber = normalizeStep(source.currentStepNumber)
        return {
          enabled: source.enabled !== false,
          currentStepNumber,
          briefedStepNumbers: normalizeBriefed(source.briefedStepNumbers),
          claimedGangWallRewardIds: normalizeClaimedRewards(
            source.claimedGangWallRewardIds,
            currentStepNumber,
          ),
        }
      },
      partialize: (state) => ({
        enabled: state.enabled,
        currentStepNumber: state.currentStepNumber,
        briefedStepNumbers: state.briefedStepNumbers,
        claimedGangWallRewardIds: state.claimedGangWallRewardIds,
      }),
    },
  ),
)
