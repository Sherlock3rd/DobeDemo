import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getBuildingPower } from '../config/economyConfig'
import { heroesConfig } from '../config/heroesConfig'
import type { ChapterMeetingDecision } from '../game/chapterAssessment'
import {
  CHAPTERS,
  areChapterTasksComplete,
  getAllSelectableChapterTasks,
  getChapterByNumber,
  getChapterTaskPackages,
  getChapterTasks,
  getTaskProgress,
  type ChapterProgressSnapshot,
} from '../game/chapterProgression'
import { BUILDING_IDS } from '../game/cityTypes'
import { getAccountTotalPower, unitPower } from '../game/combat/power'
import { CAR_IDS, type CarId } from '../game/equipmentTypes'
import { getHeroCombatStats } from '../game/heroEquipment'
import { HERO_IDS, isHeroUnlocked } from '../game/heroes'
import { isBuildingUnlocked } from '../game/progressionUnlocks'
import { isNarrativeEventId, type NarrativeEventId } from '../game/narrative'
import { isPrologueStep, type PrologueStep } from '../game/prologue'
import { createSafeStorage } from './safeStorage'
import { useAdventureStore } from './useAdventureStore'
import { useCityStore } from './useCityStore'
import { useGangStore } from './useGangStore'

export const CHAPTER_STORAGE_KEY = 'dobe-chapter-progression-v1'

interface ChapterState {
  prologueStep: PrologueStep
  activeChapterNumber: number
  selectedTaskPackageIds: Record<number, string>
  meetingVotes: Record<number, ChapterMeetingDecision>
  claimedTaskIds: string[]
  claimedChapterNumbers: number[]
  seenNarrativeIds: NarrativeEventId[]
  completedAssessmentChapterNumbers: number[]
  advancePrologue: (expected: PrologueStep, next: PrologueStep) => boolean
  claimTask: (taskId: string) => boolean
  claimChapterReward: (chapterNumber: number) => boolean
  markNarrativeSeen: (eventId: NarrativeEventId) => void
  completeAssessment: (
    completedChapterNumber: number,
    selectedPackageId: string,
    decision: ChapterMeetingDecision,
  ) => boolean
  reset: () => void
}

function currentRowForHero(
  heroId: (typeof HERO_IDS)[number],
  formation: ReturnType<typeof useAdventureStore.getState>['formation'],
) {
  return (
    formation.find((slot) => slot.heroId === heroId)?.row ??
    heroesConfig.heroes[heroId].role
  )
}

export function getChapterProgressSnapshot(): ChapterProgressSnapshot {
  const adventure = useAdventureStore.getState()
  const city = useCityStore.getState()
  const gangLevel = useGangStore.getState().currentLevel
  const progression = {
    gunLevels: adventure.gunLevels,
    carPartInventory: adventure.carPartInventory,
    carPartSlotsByCar: adventure.carPartSlotsByCar,
  }
  const heroPowers = HERO_IDS.filter((heroId) =>
    isHeroUnlocked(heroId, gangLevel),
  ).map((heroId) => {
    const row = currentRowForHero(heroId, adventure.formation)
    return {
      heroId,
      carId: adventure.equipmentByHero[heroId].carId,
      power: unitPower(
        row,
        getHeroCombatStats(
          heroId,
          adventure.heroLevels[heroId],
          adventure.equipmentByHero[heroId],
          progression,
        ),
      ),
    }
  })
  const carPowerById = Object.fromEntries(
    CAR_IDS.map((carId) => [
      carId,
      Math.max(
        0,
        ...heroPowers
          .filter((entry) => entry.carId === carId)
          .map((entry) => entry.power),
      ),
    ]),
  ) as Record<CarId, number>
  const completedBuildingPowers = BUILDING_IDS.filter((buildingId) =>
    isBuildingUnlocked(buildingId, gangLevel),
  ).map((buildingId) =>
    getBuildingPower(buildingId, city.buildingProgress[buildingId].level),
  )

  return {
    heroLevels: adventure.heroLevels,
    gunLevels: adventure.gunLevels,
    carPartInventory: adventure.carPartInventory,
    carPartUpgradeCount: adventure.carPartUpgradeCount,
    highestClearedStage: adventure.highestClearedStage,
    highestClearedRacingStage: adventure.highestClearedRacingStage,
    claimedBuildingIds: city.claimedBuildingIds,
    installedPartIds: Object.values(adventure.carPartSlotsByCar).flatMap(
      (slots) => Object.values(slots).filter((partId) => partId !== null),
    ),
    buildingProgress: city.buildingProgress,
    gangLevel,
    resources: city.resources,
    spareParts: adventure.spareParts,
    totalPower: getAccountTotalPower({
      unlockedHeroPowers: heroPowers.map((entry) => entry.power),
      completedBuildingPowers,
    }),
    carPowerById,
  }
}

const ALL_TASKS = getAllSelectableChapterTasks()
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
          getChapterByNumber(entry) !== null,
      ),
    ),
  ].sort((left, right) => left - right)
}

function normalizeSeenNarrativeIds(value: unknown): NarrativeEventId[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(isNarrativeEventId))].slice(-64)
}

function normalizeCompletedAssessmentChapterNumbers(value: unknown): number[] {
  return normalizeClaimedChapterNumbers(value).filter(
    (chapterNumber) => chapterNumber < CHAPTERS.length,
  )
}

function fallbackActiveChapter(
  claimedChapterNumbers: readonly number[],
): number {
  return (
    CHAPTERS.find((chapter) => !claimedChapterNumbers.includes(chapter.number))
      ?.number ?? CHAPTERS.length
  )
}

function normalizeActiveChapterNumber(
  value: unknown,
  claimedChapterNumbers: readonly number[],
): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    getChapterByNumber(value) !== null
    ? value
    : fallbackActiveChapter(claimedChapterNumbers)
}

function normalizeSelectedTaskPackageIds(
  value: unknown,
): Record<number, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  const source = value as Record<string, unknown>
  const result: Record<number, string> = {}
  for (const chapter of CHAPTERS.slice(1)) {
    const candidate = source[String(chapter.number)]
    if (
      typeof candidate === 'string' &&
      getChapterTaskPackages(chapter.number).some(
        (taskPackage) => taskPackage.id === candidate,
      )
    ) {
      result[chapter.number] = candidate
    }
  }
  return result
}

function normalizeMeetingVotes(
  value: unknown,
): Record<number, ChapterMeetingDecision> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  const source = value as Record<string, unknown>
  const result: Record<number, ChapterMeetingDecision> = {}
  for (const chapter of CHAPTERS.slice(0, -1)) {
    const candidate = source[String(chapter.number)]
    if (
      chapter.number === 1 &&
      (candidate === 'formal-member-approved' ||
        candidate === 'option-a' ||
        candidate === 'option-b')
    ) {
      result[chapter.number] = 'formal-member-approved'
    } else if (candidate === 'option-a' || candidate === 'option-b') {
      result[chapter.number] = candidate
    }
  }
  return result
}

function defaultSelectedPackagesThrough(
  chapterNumber: number,
): Record<number, string> {
  const result: Record<number, string> = {}
  for (let number = 2; number <= chapterNumber; number += 1) {
    const firstPackage = getChapterTaskPackages(number)[0]
    if (firstPackage) result[number] = firstPackage.id
  }
  return result
}

export const useChapterStore = create<ChapterState>()(
  persist(
    (set, get) => ({
      prologueStep: 'opening-dialogue',
      activeChapterNumber: 1,
      selectedTaskPackageIds: {},
      meetingVotes: {},
      claimedTaskIds: [],
      claimedChapterNumbers: [],
      seenNarrativeIds: [],
      completedAssessmentChapterNumbers: [],
      advancePrologue: (expected, next) => {
        if (!isPrologueStep(expected) || !isPrologueStep(next)) return false
        if (get().prologueStep !== expected) return false
        set({ prologueStep: next })
        return true
      },
      claimTask: (taskId) => {
        const state = get()
        const activeTasks = getChapterTasks(
          state.activeChapterNumber,
          state.selectedTaskPackageIds[state.activeChapterNumber],
        )
        const task = activeTasks.find((candidate) => candidate.id === taskId)
        if (!task || state.claimedTaskIds.includes(taskId)) return false
        const chapter = getChapterByNumber(state.activeChapterNumber)
        if (
          !chapter ||
          useGangStore.getState().currentLevel < chapter.minimumLevel ||
          !getTaskProgress(task, getChapterProgressSnapshot()).complete
        ) {
          return false
        }
        set((current) => ({
          claimedTaskIds: [...current.claimedTaskIds, taskId],
        }))
        useGangStore
          .getState()
          .addReputation(task.reward.gangReputation, Date.now())
        useAdventureStore.getState().grantChapterReward(task.reward)
        return true
      },
      claimChapterReward: (chapterNumber) => {
        const state = get()
        const chapter = getChapterByNumber(chapterNumber)
        const activeTasks = getChapterTasks(
          chapterNumber,
          state.selectedTaskPackageIds[chapterNumber],
        )
        if (
          !chapter ||
          state.activeChapterNumber !== chapterNumber ||
          state.claimedChapterNumbers.includes(chapterNumber) ||
          useGangStore.getState().currentLevel < chapter.minimumLevel ||
          !areChapterTasksComplete(activeTasks, getChapterProgressSnapshot())
        ) {
          return false
        }
        set((current) => ({
          claimedChapterNumbers: [
            ...current.claimedChapterNumbers,
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
      markNarrativeSeen: (eventId) => {
        if (!isNarrativeEventId(eventId)) return
        set((state) =>
          state.seenNarrativeIds.includes(eventId)
            ? state
            : {
                seenNarrativeIds: [...state.seenNarrativeIds, eventId].slice(
                  -64,
                ),
              },
        )
      },
      completeAssessment: (
        completedChapterNumber,
        selectedPackageId,
        decision,
      ) => {
        const state = get()
        const nextChapterNumber = completedChapterNumber + 1
        const hasValidDecision =
          completedChapterNumber === 1
            ? decision === 'formal-member-approved'
            : decision === 'option-a' || decision === 'option-b'
        if (
          state.activeChapterNumber !== completedChapterNumber ||
          !state.claimedChapterNumbers.includes(completedChapterNumber) ||
          state.completedAssessmentChapterNumbers.includes(
            completedChapterNumber,
          ) ||
          !getChapterTaskPackages(nextChapterNumber).some(
            (taskPackage) => taskPackage.id === selectedPackageId,
          ) ||
          !hasValidDecision
        ) {
          return false
        }
        set((current) => ({
          activeChapterNumber: nextChapterNumber,
          selectedTaskPackageIds: {
            ...current.selectedTaskPackageIds,
            [nextChapterNumber]: selectedPackageId,
          },
          meetingVotes: {
            ...current.meetingVotes,
            [completedChapterNumber]: decision,
          },
          completedAssessmentChapterNumbers: [
            ...current.completedAssessmentChapterNumbers,
            completedChapterNumber,
          ],
        }))
        return true
      },
      reset: () =>
        set({
          prologueStep: 'opening-dialogue',
          activeChapterNumber: 1,
          selectedTaskPackageIds: {},
          meetingVotes: {},
          claimedTaskIds: [],
          claimedChapterNumbers: [],
          seenNarrativeIds: [],
          completedAssessmentChapterNumbers: [],
        }),
    }),
    {
      name: CHAPTER_STORAGE_KEY,
      version: 9,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted, version) => {
        const source =
          typeof persisted === 'object' && persisted !== null
            ? (persisted as Record<string, unknown>)
            : {}
        if (version >= 7) return source
        if (version >= 5) {
          return {
            ...source,
            prologueStep: 'complete',
          }
        }
        const claimedChapterNumbers = normalizeClaimedChapterNumbers(
          source.claimedChapterNumbers,
        )
        const activeChapterNumber = fallbackActiveChapter(claimedChapterNumbers)
        return {
          ...source,
          prologueStep: 'complete',
          activeChapterNumber,
          selectedTaskPackageIds:
            defaultSelectedPackagesThrough(activeChapterNumber),
          meetingVotes: {},
          claimedTaskIds: [],
          completedAssessmentChapterNumbers: claimedChapterNumbers.filter(
            (chapterNumber) => chapterNumber < activeChapterNumber,
          ),
          seenNarrativeIds:
            version < 3 ? ['first-entry'] : source.seenNarrativeIds,
        }
      },
      partialize: ({
        prologueStep,
        activeChapterNumber,
        selectedTaskPackageIds,
        meetingVotes,
        claimedTaskIds,
        claimedChapterNumbers,
        seenNarrativeIds,
        completedAssessmentChapterNumbers,
      }) => ({
        prologueStep,
        activeChapterNumber,
        selectedTaskPackageIds,
        meetingVotes,
        claimedTaskIds,
        claimedChapterNumbers,
        seenNarrativeIds,
        completedAssessmentChapterNumbers,
      }),
      merge: (persisted, current) => {
        const source =
          typeof persisted === 'object' && persisted !== null
            ? (persisted as Record<string, unknown>)
            : {}
        const claimedChapterNumbers = normalizeClaimedChapterNumbers(
          source.claimedChapterNumbers,
        )
        const activeChapterNumber = normalizeActiveChapterNumber(
          source.activeChapterNumber,
          claimedChapterNumbers,
        )
        const selectedTaskPackageIds = normalizeSelectedTaskPackageIds(
          source.selectedTaskPackageIds,
        )
        if (
          activeChapterNumber > 1 &&
          !selectedTaskPackageIds[activeChapterNumber]
        ) {
          const firstPackage = getChapterTaskPackages(activeChapterNumber)[0]
          if (firstPackage) {
            selectedTaskPackageIds[activeChapterNumber] = firstPackage.id
          }
        }
        return {
          ...current,
          prologueStep: isPrologueStep(source.prologueStep)
            ? source.prologueStep
            : current.prologueStep,
          activeChapterNumber,
          selectedTaskPackageIds,
          meetingVotes: normalizeMeetingVotes(source.meetingVotes),
          claimedTaskIds: normalizeClaimedTaskIds(source.claimedTaskIds),
          claimedChapterNumbers,
          seenNarrativeIds: normalizeSeenNarrativeIds(source.seenNarrativeIds),
          completedAssessmentChapterNumbers:
            normalizeCompletedAssessmentChapterNumbers(
              source.completedAssessmentChapterNumbers,
            ),
        }
      },
    },
  ),
)
