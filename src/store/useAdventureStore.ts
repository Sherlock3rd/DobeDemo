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
  CAR_IDS,
  CAR_PART_SLOT_IDS,
  isCarId,
  isCarPartSlot,
  isGunId,
  type CarId,
  type CarPartSlot,
  type EquipmentByHero,
  type GunId,
} from '../game/equipmentTypes'
import {
  CAR_PART_MAX_LEVEL,
  GUN_MAX_LEVEL,
  getCarPartRecycleValue,
  getCarPartUpgradeCost,
  getGunUpgradeCost,
  isPartInstalled,
  settlePartSalvage as calculatePartSalvage,
} from '../game/equipmentProgression'
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

export type EquipmentActionResult = {
  applied: boolean
  reason:
    | 'ready'
    | 'invalid-request'
    | 'equipment-locked'
    | 'part-not-found'
    | 'part-installed'
    | 'max-level'
    | 'insufficient-spare-parts'
  cost?: number
  gained?: number
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
  settleCarPartIdle: (
    now: number,
    recyclingYardLevel: number,
  ) => { received: number; autoRecycled: number }
  resetPartIdleClock: (now: number) => void
  equipCarPart: (
    carId: string,
    partId: string,
    gangLevel: number,
  ) => EquipmentActionResult
  unequipCarPart: (
    carId: string,
    slot: string,
    gangLevel: number,
  ) => EquipmentActionResult
  recycleCarPart: (partId: string) => EquipmentActionResult
  upgradeCarPart: (partId: string) => EquipmentActionResult
  upgradeGun: (gunId: string, gangLevel: number) => EquipmentActionResult
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

function cloneCarPartSlots(
  source: AdventureDurableState['carPartSlotsByCar'],
): AdventureDurableState['carPartSlotsByCar'] {
  return Object.fromEntries(
    CAR_IDS.map((carId) => [carId, { ...source[carId] }]),
  ) as AdventureDurableState['carPartSlotsByCar']
}

function removePartFromSlots(
  slotsByCar: AdventureDurableState['carPartSlotsByCar'],
  partId: string,
): void {
  for (const carId of CAR_IDS) {
    for (const slot of CAR_PART_SLOT_IDS) {
      if (slotsByCar[carId][slot] === partId) {
        slotsByCar[carId][slot] = null
      }
    }
  }
}

function isValidGangLevel(gangLevel: number): boolean {
  return (
    Number.isSafeInteger(gangLevel) &&
    gangLevel >= GANG_MIN_LEVEL &&
    gangLevel <= GANG_MAX_LEVEL
  )
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
      settleCarPartIdle: (now, recyclingYardLevel) => {
        let outcome = { received: 0, autoRecycled: 0 }
        if (
          !Number.isFinite(now) ||
          !Number.isInteger(recyclingYardLevel) ||
          recyclingYardLevel < 1 ||
          recyclingYardLevel > 10
        ) {
          return outcome
        }
        set((state) => {
          const settlement = calculatePartSalvage({
            inventory: state.carPartInventory,
            spareParts: state.spareParts,
            nextPartSerial: state.nextPartSerial,
            lastUpdatedAt: state.partIdleClock,
            now,
            recyclingYardLevel,
          })
          outcome = {
            received: settlement.received,
            autoRecycled: settlement.autoRecycled,
          }
          if (
            settlement.received === 0 &&
            settlement.autoRecycled === 0 &&
            settlement.nextUpdatedAt === state.partIdleClock
          ) {
            return state
          }
          return {
            carPartInventory: settlement.inventory,
            spareParts: settlement.spareParts,
            nextPartSerial: settlement.nextPartSerial,
            partIdleClock: settlement.nextUpdatedAt,
          }
        })
        return outcome
      },
      resetPartIdleClock: (now) => {
        if (!Number.isFinite(now)) return
        set({ partIdleClock: now })
      },
      equipCarPart: (carId, partId, gangLevel) => {
        if (!isValidGangLevel(gangLevel)) {
          return { applied: false, reason: 'invalid-request' }
        }
        if (
          !isCarId(carId) ||
          !isCarUnlocked(carId, gangLevel) ||
          typeof partId !== 'string'
        ) {
          return { applied: false, reason: 'equipment-locked' }
        }
        let result: EquipmentActionResult = {
          applied: false,
          reason: 'part-not-found',
        }
        set((state) => {
          const part = state.carPartInventory.find(
            (candidate) => candidate.id === partId,
          )
          if (!part) return state
          const carPartSlotsByCar = cloneCarPartSlots(state.carPartSlotsByCar)
          removePartFromSlots(carPartSlotsByCar, partId)
          carPartSlotsByCar[carId][part.slot] = partId
          result = { applied: true, reason: 'ready' }
          return { carPartSlotsByCar }
        })
        return result
      },
      unequipCarPart: (carId, slot, gangLevel) => {
        if (!isValidGangLevel(gangLevel)) {
          return { applied: false, reason: 'invalid-request' }
        }
        if (
          !isCarId(carId) ||
          !isCarUnlocked(carId, gangLevel) ||
          typeof slot !== 'string' ||
          !isCarPartSlot(slot)
        ) {
          return { applied: false, reason: 'invalid-request' }
        }
        let applied = false
        set((state) => {
          if (!state.carPartSlotsByCar[carId][slot]) return state
          const carPartSlotsByCar = cloneCarPartSlots(state.carPartSlotsByCar)
          carPartSlotsByCar[carId][slot as CarPartSlot] = null
          applied = true
          return { carPartSlotsByCar }
        })
        return {
          applied,
          reason: applied ? 'ready' : 'part-not-found',
        }
      },
      recycleCarPart: (partId) => {
        if (typeof partId !== 'string' || partId.trim() === '') {
          return { applied: false, reason: 'invalid-request' }
        }
        let result: EquipmentActionResult = {
          applied: false,
          reason: 'part-not-found',
        }
        set((state) => {
          const part = state.carPartInventory.find(
            (candidate) => candidate.id === partId,
          )
          if (!part) return state
          if (isPartInstalled(partId, state.carPartSlotsByCar)) {
            result = { applied: false, reason: 'part-installed' }
            return state
          }
          const gained = getCarPartRecycleValue(part)
          result = { applied: true, reason: 'ready', gained }
          return {
            carPartInventory: state.carPartInventory.filter(
              (candidate) => candidate.id !== partId,
            ),
            spareParts: Math.min(
              Number.MAX_SAFE_INTEGER,
              state.spareParts + gained,
            ),
          }
        })
        return result
      },
      upgradeCarPart: (partId) => {
        if (typeof partId !== 'string' || partId.trim() === '') {
          return { applied: false, reason: 'invalid-request' }
        }
        let result: EquipmentActionResult = {
          applied: false,
          reason: 'part-not-found',
        }
        set((state) => {
          const index = state.carPartInventory.findIndex(
            (candidate) => candidate.id === partId,
          )
          if (index < 0) return state
          const part = state.carPartInventory[index]
          if (part.level >= CAR_PART_MAX_LEVEL) {
            result = { applied: false, reason: 'max-level' }
            return state
          }
          const cost = getCarPartUpgradeCost(part)
          if (state.spareParts < cost) {
            result = {
              applied: false,
              reason: 'insufficient-spare-parts',
              cost,
            }
            return state
          }
          const carPartInventory = state.carPartInventory.map(
            (candidate, candidateIndex) =>
              candidateIndex === index
                ? { ...candidate, level: candidate.level + 1 }
                : candidate,
          )
          result = { applied: true, reason: 'ready', cost }
          return {
            carPartInventory,
            spareParts: state.spareParts - cost,
          }
        })
        return result
      },
      upgradeGun: (gunId, gangLevel) => {
        if (!isValidGangLevel(gangLevel)) {
          return { applied: false, reason: 'invalid-request' }
        }
        if (!isGunId(gunId) || !isGunUnlocked(gunId, gangLevel)) {
          return { applied: false, reason: 'equipment-locked' }
        }
        let result: EquipmentActionResult = {
          applied: false,
          reason: 'invalid-request',
        }
        set((state) => {
          const level = state.gunLevels[gunId]
          if (level >= GUN_MAX_LEVEL) {
            result = { applied: false, reason: 'max-level' }
            return state
          }
          const cost = getGunUpgradeCost(gunId, level)
          if (state.spareParts < cost) {
            result = {
              applied: false,
              reason: 'insufficient-spare-parts',
              cost,
            }
            return state
          }
          result = { applied: true, reason: 'ready', cost }
          return {
            gunLevels: {
              ...state.gunLevels,
              [gunId]: Math.min(GUN_MAX_LEVEL, level + 1),
            },
            spareParts: state.spareParts - cost,
          }
        })
        return result
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
      version: 3,
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
        spareParts,
        gunLevels,
        carPartInventory,
        carPartSlotsByCar,
        partIdleClock,
        nextPartSerial,
      }) => ({
        heroLevels,
        sharedExp,
        formation,
        highestClearedStage,
        highestClearedRacingStage,
        equipmentByHero,
        idleClock,
        spareParts,
        gunLevels,
        carPartInventory,
        carPartSlotsByCar,
        partIdleClock,
        nextPartSerial,
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
