import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  STORY_COMPLETE_STEP,
  getStoryRank,
  getStoryStep,
  type ParallelStoryOrder,
} from '../game/storyPlanC'
import {
  getGangWallReward,
  getGangWallTierForSystemLevel,
  getGangWallTierForReward,
  getHistoricalGangWallRewards,
  isGangWallRewardId,
  type GangWallRewardId,
} from '../game/gangPhotoWall'
import { createSafeStorage } from './safeStorage'

export const STORY_STORAGE_KEY = 'dobe-story-plan-c-v3'

interface StoryState {
  enabled: boolean
  currentStepNumber: number
  completedStepNumbers: number[]
  parallelOrder: ParallelStoryOrder | null
  briefedStepNumbers: number[]
  claimedGangWallRewardIds: GangWallRewardId[]
  advance: (expectedStepNumber: number) => boolean
  chooseParallelOrder: (order: ParallelStoryOrder) => boolean
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
      completedStepNumbers: [],
      parallelOrder: null,
      briefedStepNumbers: [],
      claimedGangWallRewardIds: [],
      advance: (expectedStepNumber) => {
        if (get().currentStepNumber !== expectedStepNumber) return false
        const state = get()
        const completedStepNumbers = state.completedStepNumbers.includes(
          expectedStepNumber,
        )
          ? state.completedStepNumbers
          : [...state.completedStepNumbers, expectedStepNumber]
        let currentStepNumber = Math.min(
          STORY_COMPLETE_STEP,
          expectedStepNumber + 1,
        )
        if (expectedStepNumber === 21) {
          currentStepNumber =
            state.parallelOrder === 'investigation-first' ? 25 : 22
        } else if (expectedStepNumber === 24) {
          currentStepNumber = state.parallelOrder === 'industry-first' ? 25 : 19
        }
        set({ currentStepNumber, completedStepNumbers })
        return true
      },
      chooseParallelOrder: (order) => {
        const state = get()
        if (state.currentStepNumber !== 18 || state.parallelOrder !== null) {
          return false
        }
        set({
          currentStepNumber: order === 'industry-first' ? 19 : 22,
          parallelOrder: order,
          completedStepNumbers: state.completedStepNumbers.includes(18)
            ? state.completedStepNumbers
            : [...state.completedStepNumbers, 18],
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
        const action = getStoryStep(state.currentStepNumber)?.action
        const requiredRewardIds =
          action?.kind === 'gang-tree'
            ? [
                ...(action.rewardIds ?? []),
                ...(action.rewardId ? [action.rewardId] : []),
              ]
            : []
        const isRequiredByCurrentStep = requiredRewardIds.includes(reward.id)
        if (
          (!isRequiredByCurrentStep &&
            rewardTier.tier !== storyRank.tier - 1) ||
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
          completedStepNumbers: [],
          parallelOrder: null,
          briefedStepNumbers: [],
          claimedGangWallRewardIds: [],
        }),
    }),
    {
      name: STORY_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted) => {
        const source =
          typeof persisted === 'object' && persisted !== null
            ? (persisted as { enabled?: unknown })
            : {}
        // 新版方案 C 删除前段过早交接并重排为 L01-L43。旧版节点号
        // 无法安全映射，使用独立 v3 存档从 L01 开始，避免跳过新必做链。
        const currentStepNumber = normalizeStep(1)
        return {
          enabled: source.enabled !== false,
          currentStepNumber,
          completedStepNumbers: [],
          parallelOrder: null,
          briefedStepNumbers: normalizeBriefed([]),
          claimedGangWallRewardIds: normalizeClaimedRewards(
            [],
            currentStepNumber,
          ),
        }
      },
      partialize: (state) => ({
        enabled: state.enabled,
        currentStepNumber: state.currentStepNumber,
        completedStepNumbers: state.completedStepNumbers,
        parallelOrder: state.parallelOrder,
        briefedStepNumbers: state.briefedStepNumbers,
        claimedGangWallRewardIds: state.claimedGangWallRewardIds,
      }),
    },
  ),
)
