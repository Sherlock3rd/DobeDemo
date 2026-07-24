import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { expToLevel } from '../config/heroesConfig'
import { getFirstClearReward, isStageUnlocked } from '../config/campaignConfig'
import { getRacingStage, isRacingStageUnlocked } from '../config/racingConfig'
import { settleIdleExperience } from '../config/idleExperienceConfig'
import {
  getHeroLevelCap,
  isHeroId,
  isHeroUnlocked,
  type HeroId,
} from '../game/heroes'
import { GANG_MAX_LEVEL, GANG_MIN_LEVEL } from '../game/progressionUnlocks'
import { isCarUnlocked, isGunUnlocked } from '../game/progressionUnlocks'
import {
  isCarId,
  isGunId,
  type CarId,
  type EquipmentByHero,
  type GunId,
} from '../game/equipmentTypes'
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
    | 'hero-locked'
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
  recordRacingVictory: (stage: number) => {
    firstClear: boolean
    rewardExp: number
  }
  equipCar: (heroId: string, carId: string | null, gangLevel: number) => boolean
  equipGun: (heroId: string, gunId: string | null, gangLevel: number) => boolean
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

function cloneEquipment(source: EquipmentByHero): EquipmentByHero {
  return {
    foreman: { ...source.foreman },
    anvil: { ...source.anvil },
    skyline: { ...source.skyline },
  }
}

function unequipCar(equipment: EquipmentByHero, carId: CarId): void {
  for (const heroId of Object.keys(equipment) as HeroId[]) {
    if (equipment[heroId].carId === carId) {
      equipment[heroId].carId = null
    }
  }
}

function unequipGun(equipment: EquipmentByHero, gunId: GunId): void {
  for (const heroId of Object.keys(equipment) as HeroId[]) {
    if (equipment[heroId].gunId === gunId) {
      equipment[heroId].gunId = null
    }
  }
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
        if (
          !isHeroId(heroId) ||
          !Number.isSafeInteger(gangLevel) ||
          gangLevel < GANG_MIN_LEVEL ||
          gangLevel > GANG_MAX_LEVEL
        ) {
          return { applied: false, reason: 'invalid-request' }
        }
        let result: UpgradeHeroResult = {
          applied: false,
          reason: 'invalid-request',
        }
        set((state) => {
          const level = state.heroLevels[heroId as HeroId]
          if (!isHeroUnlocked(heroId, gangLevel)) {
            result = { applied: false, reason: 'hero-locked' }
            return state
          }
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
      recordRacingVictory: (stage) => {
        let outcome = { firstClear: false, rewardExp: 0 }
        set((state) => {
          if (!isRacingStageUnlocked(stage, state.highestClearedRacingStage)) {
            return state
          }
          const reward = getRacingStage(stage).firstClearExp
          outcome = { firstClear: true, rewardExp: reward }
          return {
            highestClearedRacingStage: stage,
            sharedExp: Math.min(
              Number.MAX_SAFE_INTEGER,
              state.sharedExp + reward,
            ),
          }
        })
        return outcome
      },
      equipCar: (heroId, carId, gangLevel) => {
        if (
          !isHeroId(heroId) ||
          !isHeroUnlocked(heroId, gangLevel) ||
          (carId !== null &&
            (!isCarId(carId) || !isCarUnlocked(carId, gangLevel)))
        ) {
          return false
        }
        set((state) => {
          const equipmentByHero = cloneEquipment(state.equipmentByHero)
          if (carId !== null) {
            unequipCar(equipmentByHero, carId)
          }
          equipmentByHero[heroId].carId = carId
          return { equipmentByHero }
        })
        return true
      },
      equipGun: (heroId, gunId, gangLevel) => {
        if (
          !isHeroId(heroId) ||
          !isHeroUnlocked(heroId, gangLevel) ||
          (gunId !== null &&
            (!isGunId(gunId) || !isGunUnlocked(gunId, gangLevel)))
        ) {
          return false
        }
        set((state) => {
          const equipmentByHero = cloneEquipment(state.equipmentByHero)
          if (gunId !== null) {
            unequipGun(equipmentByHero, gunId)
          }
          equipmentByHero[heroId].gunId = gunId
          return { equipmentByHero }
        })
        return true
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
      version: 2,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted) => persisted,
      partialize: ({
        heroLevels,
        sharedExp,
        formation,
        highestClearedStage,
        highestClearedRacingStage,
        equipmentByHero,
        idleClock,
      }) => ({
        heroLevels,
        sharedExp,
        formation,
        highestClearedStage,
        highestClearedRacingStage,
        equipmentByHero,
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
