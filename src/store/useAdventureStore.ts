import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { expToLevel } from '../config/heroesConfig'
import { getFirstClearReward, isStageUnlocked } from '../config/campaignConfig'
import { settleIdleExperience } from '../config/idleExperienceConfig'
import {
  getHeroLevelCap,
  isHeroId,
  isHeroUnlocked,
  type HeroId,
} from '../game/heroes'
import type { FormationAssignment } from '../game/combat/power'
import { createSafeStorage } from './safeStorage'
import {
  ADVENTURE_STORAGE_KEY,
  createInitialAdventureState,
  normalizeAdventureDurableState,
  reconcileAdventureWithGang,
  type AdventureDurableState,
} from './adventureMigration'

export { ADVENTURE_STORAGE_KEY }

export type UpgradeHeroResult = {
  applied: boolean
  reason:
    | 'ready'
    | 'hero-level-capped-by-gang'
    | 'hero-maxed'
    | 'insufficient-shared-exp'
    | 'invalid-request'
}

export interface AdventureState extends AdventureDurableState {
  claimIdleChest: (now: number) => number
  upgradeHero: (heroId: string, gangLevel: number) => UpgradeHeroResult
  recordVictory: (
    stage: number,
    now: number,
  ) => { firstClear: boolean; rewardExp: number }
  setFormation: (formation: FormationAssignment, gangLevel: number) => boolean
  reconcileWithGang: (gangLevel: number) => void
  reset: (now?: number) => void
}

export function getClaimableIdleExp(
  idleClock: number,
  highestClearedStage: number,
  now: number,
): number {
  return settleIdleExperience({
    lastUpdatedAt: idleClock,
    now,
    highestClearedStage,
  }).earnedExp
}

function isValidFormation(
  formation: FormationAssignment,
  gangLevel: number,
): boolean {
  if (formation.length < 1 || formation.length > 5) return false
  const heroes = new Set<string>()
  const slots = new Set<string>()
  for (const s of formation) {
    if (!isHeroId(s.heroId) || !isHeroUnlocked(s.heroId, gangLevel)) {
      return false
    }
    const maxIndex = s.row === 'front' ? 1 : 2
    if (!Number.isInteger(s.index) || s.index < 0 || s.index > maxIndex) {
      return false
    }
    if (heroes.has(s.heroId) || slots.has(`${s.row}:${s.index}`)) {
      return false
    }
    heroes.add(s.heroId)
    slots.add(`${s.row}:${s.index}`)
  }
  return true
}

export const useAdventureStore = create<AdventureState>()(
  persist(
    (set) => ({
      ...createInitialAdventureState(Date.now()),
      claimIdleChest: (now) => {
        let claimed = 0
        set((state) => {
          const settlement = settleIdleExperience({
            lastUpdatedAt: state.idleClock,
            now,
            highestClearedStage: state.highestClearedStage,
          })
          if (settlement.earnedExp <= 0) return state
          claimed = settlement.earnedExp
          return {
            sharedExp: Math.min(
              Number.MAX_SAFE_INTEGER,
              state.sharedExp + settlement.earnedExp,
            ),
            idleClock: settlement.nextUpdatedAt,
          }
        })
        return claimed
      },
      upgradeHero: (heroId, gangLevel) => {
        if (!isHeroId(heroId)) {
          return { applied: false, reason: 'invalid-request' }
        }
        let result: UpgradeHeroResult = {
          applied: false,
          reason: 'invalid-request',
        }
        set((state) => {
          const level = state.heroLevels[heroId as HeroId]
          const cap = getHeroLevelCap(gangLevel)
          if (level >= 50) {
            result = { applied: false, reason: 'hero-maxed' }
            return state
          }
          if (level >= cap) {
            result = { applied: false, reason: 'hero-level-capped-by-gang' }
            return state
          }
          const cost = expToLevel(level)
          if (state.sharedExp < cost) {
            result = { applied: false, reason: 'insufficient-shared-exp' }
            return state
          }
          result = { applied: true, reason: 'ready' }
          return {
            sharedExp: state.sharedExp - cost,
            heroLevels: { ...state.heroLevels, [heroId]: level + 1 },
          }
        })
        return result
      },
      recordVictory: (stage, now) => {
        let outcome = { firstClear: false, rewardExp: 0 }
        set((state) => {
          if (stage !== state.highestClearedStage + 1) return state
          if (!isStageUnlocked(stage, state.highestClearedStage)) return state
          const reward = getFirstClearReward(stage)
          const idleWasClosed = state.highestClearedStage < 1
          outcome = { firstClear: true, rewardExp: reward }
          return {
            highestClearedStage: stage,
            sharedExp: Math.min(
              Number.MAX_SAFE_INTEGER,
              state.sharedExp + reward,
            ),
            idleClock:
              idleWasClosed && Number.isFinite(now) ? now : state.idleClock,
          }
        })
        return outcome
      },
      setFormation: (formation, gangLevel) => {
        if (!isValidFormation(formation, gangLevel)) return false
        set({ formation: formation.map((s) => ({ ...s })) })
        return true
      },
      reconcileWithGang: (gangLevel) =>
        set((state) => reconcileAdventureWithGang(state, gangLevel)),
      reset: (now = Date.now()) => set(createInitialAdventureState(now)),
    }),
    {
      name: ADVENTURE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: () => undefined,
      partialize: ({
        heroLevels,
        sharedExp,
        formation,
        highestClearedStage,
        idleClock,
      }) => ({
        heroLevels,
        sharedExp,
        formation,
        highestClearedStage,
        idleClock,
      }),
      merge: (persisted, current) =>
        persisted == null
          ? current
          : {
              ...current,
              ...normalizeAdventureDurableState(persisted, Date.now()),
            },
    },
  ),
)
