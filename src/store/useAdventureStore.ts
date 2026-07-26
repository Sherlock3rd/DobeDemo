import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { expToLevel } from '../config/heroesConfig'
import {
  getFirstClearRewardDefinition,
  isStageUnlocked,
} from '../config/campaignConfig'
import { getRacingStage, isRacingStageUnlocked } from '../config/racingConfig'
import { settleIdleExperience } from '../config/idleExperienceConfig'
import {
  getHeroLevelCap,
  isHeroId,
  isHeroUnlocked,
  type HeroId,
} from '../game/heroes'
import {
  CHAPTER_EQUIPMENT_UNLOCKS,
  GANG_MAX_LEVEL,
  GANG_MIN_LEVEL,
  isBuildingUnlocked,
  isCarUnlocked,
  isGunUnlocked,
} from '../game/progressionUnlocks'
import {
  CAR_IDS,
  CAR_PART_SLOT_IDS,
  isCarId,
  isCarPartSlot,
  isGunId,
  type CarId,
  type CarPartQuality,
  type CarPartSlot,
  type EquipmentByHero,
  type GunId,
} from '../game/equipmentTypes'
import {
  CAR_PART_MAX_LEVEL,
  CAR_PART_INVENTORY_LIMIT,
  CAR_PART_QUALITY_INFO,
  GUN_MAX_LEVEL,
  getCarPartRecycleValue,
  getCarPartUpgradeCost,
  getGunUpgradeCost,
  getPartSalvagePreview,
  isPartInstalled,
  settlePartSalvage as calculatePartSalvage,
} from '../game/equipmentProgression'
import type { RandomSource } from '../game/equipmentProgression'
import {
  getCampaignPartQualityWeights,
  getRacingPartQualityWeights,
  rollStageRewardPart,
} from '../game/stageRewards'
import type { FormationAssignment } from '../game/combat/power'
import type { ChapterAdventureReward } from '../game/chapterProgression'
import { createSafeStorage } from './safeStorage'
import { useCityStore } from './useCityStore'
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
  recycledCount?: number
}

export interface StageVictoryReward {
  firstClear: boolean
  rewardExp: number
  rewardMoney: number
  rewardPart: AdventureDurableState['carPartInventory'][number] | null
  rewardSpareParts: number
}

export interface PartSalvageClaimResult {
  applied: boolean
  receivedParts: AdventureDurableState['carPartInventory']
  autoRecycled: number
  sparePartsGained: number
  batchCount: number
}

export interface AdventureState extends AdventureDurableState {
  lastVictoryReward: {
    mode: 'campaign' | 'racing'
    stage: number
    reward: StageVictoryReward
  } | null
  claimIdleChest: (now: number) => number
  upgradeHero: (heroId: string, gangLevel: number) => UpgradeHeroResult
  recordVictory: (
    stage: number,
    now: number,
    random?: RandomSource,
  ) => StageVictoryReward
  recordRacingVictory: (
    stage: number,
    random?: RandomSource,
  ) => StageVictoryReward
  equipCar: (heroId: string, carId: string | null, gangLevel: number) => boolean
  equipGun: (heroId: string, gunId: string | null, gangLevel: number) => boolean
  claimPartSalvage: (
    now: number,
    recyclingYardLevel: number,
    gangLevel: number,
    random?: RandomSource,
  ) => PartSalvageClaimResult
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
  recycleCarPartsByQuality: (quality: CarPartQuality) => EquipmentActionResult
  upgradeCarPart: (partId: string) => EquipmentActionResult
  upgradeGun: (gunId: string, gangLevel: number) => EquipmentActionResult
  grantChapterReward: (reward: ChapterAdventureReward) => void
  unlockAllChapterEquipmentForDebug: () => void
  setFormation: (formation: FormationAssignment, gangLevel: number) => boolean
  reconcileWithGang: (gangLevel: number) => void
  syncCityRewardMoney: () => void
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

function getHighestHeroLevel(
  heroLevels: AdventureDurableState['heroLevels'],
): number {
  return Math.min(
    CAR_PART_MAX_LEVEL,
    Math.max(1, ...Object.values(heroLevels).map((level) => Math.trunc(level))),
  )
}

function emptyStageReward(): StageVictoryReward {
  return {
    firstClear: false,
    rewardExp: 0,
    rewardMoney: 0,
    rewardPart: null,
    rewardSpareParts: 0,
  }
}

export const useAdventureStore = create<AdventureState>()(
  persist(
    (set, get) => ({
      ...createInitialAdventureState(Date.now()),
      lastVictoryReward: null,
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
      recordVictory: (stage, now, random) => {
        let outcome = emptyStageReward()
        set((state) => {
          if (stage !== state.highestClearedStage + 1) return state
          if (!isStageUnlocked(stage, state.highestClearedStage)) return state
          const reward = getFirstClearRewardDefinition(stage)
          const rolledPart = rollStageRewardPart({
            chance: reward.partDropChance,
            qualityWeights: getCampaignPartQualityWeights(stage),
            nextPartSerial: state.nextPartSerial,
            random,
          })
          const carPartInventory = [...state.carPartInventory]
          let spareParts = state.spareParts
          let rewardSpareParts = 0
          if (rolledPart.part) {
            if (carPartInventory.length < CAR_PART_INVENTORY_LIMIT) {
              carPartInventory.push(rolledPart.part)
            } else {
              rewardSpareParts =
                CAR_PART_QUALITY_INFO[rolledPart.part.quality].recycleBase
              spareParts = Math.min(
                Number.MAX_SAFE_INTEGER,
                spareParts + rewardSpareParts,
              )
            }
          }
          const idleWasClosed = state.highestClearedStage < 1
          outcome = {
            firstClear: true,
            rewardExp: reward.sharedExp,
            rewardMoney: reward.money,
            rewardPart: rolledPart.part,
            rewardSpareParts,
          }
          return {
            highestClearedStage: stage,
            sharedExp: Math.min(
              Number.MAX_SAFE_INTEGER,
              state.sharedExp + reward.sharedExp,
            ),
            idleClock:
              idleWasClosed && Number.isFinite(now) ? now : state.idleClock,
            carPartInventory,
            spareParts,
            nextPartSerial: rolledPart.nextPartSerial,
            lastVictoryReward: {
              mode: 'campaign' as const,
              stage,
              reward: outcome,
            },
          }
        })
        if (outcome.firstClear) {
          get().syncCityRewardMoney()
        }
        return outcome
      },
      recordRacingVictory: (stage, random) => {
        let outcome = emptyStageReward()
        set((state) => {
          if (!isRacingStageUnlocked(stage, state.highestClearedRacingStage)) {
            return state
          }
          const reward = getRacingStage(stage)
          const rolledPart = rollStageRewardPart({
            chance: reward.partDropChance,
            qualityWeights: getRacingPartQualityWeights(stage),
            nextPartSerial: state.nextPartSerial,
            random,
          })
          const carPartInventory = [...state.carPartInventory]
          let spareParts = state.spareParts
          let rewardSpareParts = 0
          if (rolledPart.part) {
            if (carPartInventory.length < CAR_PART_INVENTORY_LIMIT) {
              carPartInventory.push(rolledPart.part)
            } else {
              rewardSpareParts =
                CAR_PART_QUALITY_INFO[rolledPart.part.quality].recycleBase
              spareParts = Math.min(
                Number.MAX_SAFE_INTEGER,
                spareParts + rewardSpareParts,
              )
            }
          }
          outcome = {
            firstClear: true,
            rewardExp: reward.firstClearExp,
            rewardMoney: reward.firstClearMoney,
            rewardPart: rolledPart.part,
            rewardSpareParts,
          }
          return {
            highestClearedRacingStage: stage,
            sharedExp: Math.min(
              Number.MAX_SAFE_INTEGER,
              state.sharedExp + reward.firstClearExp,
            ),
            carPartInventory,
            spareParts,
            nextPartSerial: rolledPart.nextPartSerial,
            lastVictoryReward: {
              mode: 'racing' as const,
              stage,
              reward: outcome,
            },
          }
        })
        if (outcome.firstClear) {
          get().syncCityRewardMoney()
        }
        return outcome
      },
      equipCar: (heroId, carId, gangLevel) => {
        const chapterUnlockedCarIds = get().chapterUnlockedCarIds
        if (
          !isHeroId(heroId) ||
          !isHeroUnlocked(heroId, gangLevel) ||
          (carId !== null &&
            (!isCarId(carId) ||
              !isCarUnlocked(carId, gangLevel, chapterUnlockedCarIds)))
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
        const chapterUnlockedGunIds = get().chapterUnlockedGunIds
        if (
          !isHeroId(heroId) ||
          !isHeroUnlocked(heroId, gangLevel) ||
          (gunId !== null &&
            (!isGunId(gunId) ||
              !isGunUnlocked(gunId, gangLevel, chapterUnlockedGunIds)))
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
      claimPartSalvage: (now, recyclingYardLevel, gangLevel, random) => {
        let result: PartSalvageClaimResult = {
          applied: false,
          receivedParts: [],
          autoRecycled: 0,
          sparePartsGained: 0,
          batchCount: 0,
        }
        if (
          !Number.isFinite(now) ||
          !Number.isInteger(recyclingYardLevel) ||
          recyclingYardLevel < 1 ||
          recyclingYardLevel > 10 ||
          !isValidGangLevel(gangLevel) ||
          !isBuildingUnlocked('recycling-yard', gangLevel)
        ) {
          return result
        }
        set((state) => {
          const preview = getPartSalvagePreview({
            lastUpdatedAt: state.partIdleClock,
            now,
            recyclingYardLevel,
          })
          if (!preview.canClaim) return state

          const previousInventoryLength = state.carPartInventory.length
          const settlement = calculatePartSalvage({
            inventory: state.carPartInventory,
            spareParts: state.spareParts,
            nextPartSerial: state.nextPartSerial,
            lastUpdatedAt: state.partIdleClock,
            now,
            recyclingYardLevel,
            random,
          })
          result = {
            applied: true,
            receivedParts: settlement.inventory.slice(previousInventoryLength),
            autoRecycled: settlement.autoRecycled,
            sparePartsGained: settlement.spareParts - state.spareParts,
            batchCount: preview.batchCount,
          }
          return {
            carPartInventory: settlement.inventory,
            spareParts: settlement.spareParts,
            nextPartSerial: settlement.nextPartSerial,
            partIdleClock: preview.capped ? now : settlement.nextUpdatedAt,
          }
        })
        return result
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
          !isCarUnlocked(carId, gangLevel, get().chapterUnlockedCarIds) ||
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
          !isCarUnlocked(carId, gangLevel, get().chapterUnlockedCarIds) ||
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
      recycleCarPartsByQuality: (quality) => {
        let result: EquipmentActionResult = {
          applied: false,
          reason: 'part-not-found',
          recycledCount: 0,
          gained: 0,
        }
        set((state) => {
          const recyclable = state.carPartInventory.filter(
            (part) =>
              part.quality === quality &&
              !isPartInstalled(part.id, state.carPartSlotsByCar),
          )
          if (recyclable.length === 0) return state
          const recyclableIds = new Set(recyclable.map((part) => part.id))
          const gained = recyclable.reduce(
            (total, part) =>
              Math.min(
                Number.MAX_SAFE_INTEGER,
                total + getCarPartRecycleValue(part),
              ),
            0,
          )
          result = {
            applied: true,
            reason: 'ready',
            recycledCount: recyclable.length,
            gained,
          }
          return {
            carPartInventory: state.carPartInventory.filter(
              (part) => !recyclableIds.has(part.id),
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
          const levelCap = getHighestHeroLevel(state.heroLevels)
          if (part.level >= levelCap || part.level >= CAR_PART_MAX_LEVEL) {
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
        if (
          !isGunId(gunId) ||
          !isGunUnlocked(gunId, gangLevel, get().chapterUnlockedGunIds)
        ) {
          return { applied: false, reason: 'equipment-locked' }
        }
        let result: EquipmentActionResult = {
          applied: false,
          reason: 'invalid-request',
        }
        set((state) => {
          const level = state.gunLevels[gunId]
          const levelCap = getHighestHeroLevel(state.heroLevels)
          if (level >= levelCap || level >= GUN_MAX_LEVEL) {
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
      grantChapterReward: (reward) => {
        set((state) => {
          const carPartInventory = [...state.carPartInventory]
          let nextPartSerial = state.nextPartSerial
          let spareParts = Math.min(
            Number.MAX_SAFE_INTEGER,
            state.spareParts + reward.spareParts,
          )
          for (const definition of reward.carParts) {
            const part = {
              id: `part-${nextPartSerial}`,
              slot: definition.slot,
              quality: definition.quality,
              level: 1,
            }
            nextPartSerial += 1
            if (carPartInventory.length < CAR_PART_INVENTORY_LIMIT) {
              carPartInventory.push(part)
            } else {
              spareParts = Math.min(
                Number.MAX_SAFE_INTEGER,
                spareParts + getCarPartRecycleValue(part),
              )
            }
          }
          return {
            sharedExp: Math.min(
              Number.MAX_SAFE_INTEGER,
              state.sharedExp + reward.heroExperience,
            ),
            spareParts,
            carPartInventory,
            nextPartSerial,
            chapterUnlockedCarIds:
              'unlockCarIds' in reward
                ? [
                    ...new Set([
                      ...state.chapterUnlockedCarIds,
                      ...reward.unlockCarIds,
                    ]),
                  ]
                : state.chapterUnlockedCarIds,
            chapterUnlockedGunIds:
              'unlockGunIds' in reward
                ? [
                    ...new Set([
                      ...state.chapterUnlockedGunIds,
                      ...reward.unlockGunIds,
                    ]),
                  ]
                : state.chapterUnlockedGunIds,
          }
        })
      },
      unlockAllChapterEquipmentForDebug: () =>
        set({
          chapterUnlockedCarIds: CHAPTER_EQUIPMENT_UNLOCKS.filter(
            (unlock) => unlock.kind === 'car',
          ).map((unlock) => unlock.carId),
          chapterUnlockedGunIds: CHAPTER_EQUIPMENT_UNLOCKS.filter(
            (unlock) => unlock.kind === 'gun',
          ).map((unlock) => unlock.gunId),
          chapterEquipmentMigrationVersion: 1,
        }),
      setFormation: (formation, gangLevel) => {
        if (!isValidFormation(formation, gangLevel)) return false
        set({ formation: formation.map((s) => ({ ...s })) })
        return true
      },
      reconcileWithGang: (gangLevel) =>
        set((state) => reconcileAdventureWithGang(state, gangLevel)),
      syncCityRewardMoney: () => {
        const state = get()
        const city = useCityStore.getState()
        for (let stage = 1; stage <= state.highestClearedStage; stage += 1) {
          city.grantRewardMoney(
            `campaign:${stage}`,
            getFirstClearRewardDefinition(stage).money,
          )
        }
        for (
          let stage = 1;
          stage <= state.highestClearedRacingStage;
          stage += 1
        ) {
          city.grantRewardMoney(
            `racing:${stage}`,
            getRacingStage(stage).firstClearMoney,
          )
        }
      },
      reset: (now = Date.now()) =>
        set({ ...createInitialAdventureState(now), lastVictoryReward: null }),
    }),
    {
      name: ADVENTURE_STORAGE_KEY,
      version: 7,
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
        chapterUnlockedCarIds,
        chapterUnlockedGunIds,
        chapterEquipmentMigrationVersion,
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
        chapterUnlockedCarIds,
        chapterUnlockedGunIds,
        chapterEquipmentMigrationVersion,
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
