import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  CHAPTERS,
  getTaskProgress,
  isChapterComplete,
  type ChapterProgressSnapshot,
} from '../game/chapterProgression'
import { createSafeStorage } from './safeStorage'
import { useAdventureStore } from './useAdventureStore'
import { useCityStore } from './useCityStore'
import { useGangStore } from './useGangStore'

export const CHAPTER_STORAGE_KEY = 'dobe-chapter-progression-v1'

interface ChapterState {
  claimedTaskIds: string[]
  claimedChapterNumbers: number[]
  claimTask: (taskId: string) => boolean
  claimChapterReward: (chapterNumber: number) => boolean
  reset: () => void
}

export function getChapterProgressSnapshot(): ChapterProgressSnapshot {
  const adventure = useAdventureStore.getState()
  return {
    heroLevels: adventure.heroLevels,
    gunLevels: adventure.gunLevels,
    carPartInventory: adventure.carPartInventory,
    highestClearedStage: adventure.highestClearedStage,
    highestClearedRacingStage: adventure.highestClearedRacingStage,
    buildingProgress: useCityStore.getState().buildingProgress,
  }
}

const ALL_TASKS = CHAPTERS.flatMap((chapter) => chapter.tasks)
const VALID_TASK_IDS = new Set(ALL_TASKS.map((task) => task.id))

function normalizeClaimedTaskIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter(
        (entry): entry is string =>
          typeof entry === 'string' && VALID_TASK_IDS.has(entry),
      ),
    ),
  ]
}

function normalizeClaimedChapterNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter(
        (entry): entry is number =>
          typeof entry === 'number' &&
          Number.isInteger(entry) &&
          CHAPTERS.some((chapter) => chapter.number === entry),
      ),
    ),
  ]
}

export const useChapterStore = create<ChapterState>()(
  persist(
    (set, get) => ({
      claimedTaskIds: [],
      claimedChapterNumbers: [],
      claimTask: (taskId) => {
        const task = ALL_TASKS.find((candidate) => candidate.id === taskId)
        if (!task || get().claimedTaskIds.includes(taskId)) return false
        const chapter = CHAPTERS.find((candidate) =>
          candidate.tasks.some((chapterTask) => chapterTask.id === taskId),
        )
        if (
          !chapter ||
          useGangStore.getState().currentLevel < chapter.minimumLevel
        ) {
          return false
        }
        if (!getTaskProgress(task, getChapterProgressSnapshot()).complete) {
          return false
        }
        set((state) => ({
          claimedTaskIds: [...state.claimedTaskIds, taskId],
        }))
        useGangStore
          .getState()
          .addReputation(task.reward.gangReputation, Date.now())
        useAdventureStore.getState().grantChapterReward(task.reward)
        return true
      },
      claimChapterReward: (chapterNumber) => {
        const chapter = CHAPTERS.find(
          (candidate) => candidate.number === chapterNumber,
        )
        if (
          !chapter ||
          get().claimedChapterNumbers.includes(chapterNumber) ||
          useGangStore.getState().currentLevel < chapter.minimumLevel ||
          !isChapterComplete(chapter, getChapterProgressSnapshot())
        ) {
          return false
        }
        set((state) => ({
          claimedChapterNumbers: [
            ...state.claimedChapterNumbers,
            chapterNumber,
          ],
        }))
        useGangStore
          .getState()
          .addReputation(chapter.completionReward.gangReputation, Date.now())
        useAdventureStore
          .getState()
          .grantChapterReward(chapter.completionReward)
        useCityStore
          .getState()
          .grantRewardResources(
            `chapter:${chapter.number}`,
            chapter.completionReward.resources,
          )
        return true
      },
      reset: () =>
        set({
          claimedTaskIds: [],
          claimedChapterNumbers: [],
        }),
    }),
    {
      name: CHAPTER_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => createSafeStorage()),
      partialize: ({ claimedTaskIds, claimedChapterNumbers }) => ({
        claimedTaskIds,
        claimedChapterNumbers,
      }),
      merge: (persisted, current) => {
        const source =
          typeof persisted === 'object' && persisted !== null
            ? (persisted as {
                claimedTaskIds?: unknown
                claimedChapterNumbers?: unknown
              })
            : {}
        return {
          ...current,
          claimedTaskIds: normalizeClaimedTaskIds(source.claimedTaskIds),
          claimedChapterNumbers: normalizeClaimedChapterNumbers(
            source.claimedChapterNumbers,
          ),
        }
      },
    },
  ),
)
