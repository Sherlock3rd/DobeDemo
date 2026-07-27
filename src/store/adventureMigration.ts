import { HERO_IDS, isHeroId, isHeroUnlocked, type HeroId } from '../game/heroes'
import type { FormationAssignment } from '../game/combat/power'
import {
  CAR_IDS,
  CAR_PART_SLOT_IDS,
  GUN_IDS,
  isCarId,
  isCarPartQuality,
  isCarPartSlot,
  isGunId,
  type CarPartInstance,
  type CarPartQuality,
  type CarPartSlotsByCar,
  type CarId,
  type EquipmentByHero,
  type GunId,
  type GunUpgradeLevels,
} from '../game/equipmentTypes'
import {
  CAR_PART_INVENTORY_LIMIT,
  CAR_PART_MAX_LEVEL,
  GUN_MAX_LEVEL,
  createInitialCarPartSlots,
  createInitialGunLevels,
  getCarPartUpgradeCost,
  getGunUpgradeCost,
} from '../game/equipmentProgression'
import {
  CHAPTER_EQUIPMENT_UNLOCKS,
  isCarUnlocked,
  isGunUnlocked,
} from '../game/progressionUnlocks'
import { PROLOGUE_BROKEN_PART, PROLOGUE_BROKEN_PART_ID } from '../game/prologue'

export const ADVENTURE_STORAGE_KEY = 'dobe-adventure-progression-v1'

export interface AdventureDurableState {
  heroLevels: Record<HeroId, number>
  sharedExp: number
  formation: FormationAssignment
  highestClearedStage: number
  highestClearedRacingStage: number
  equipmentByHero: EquipmentByHero
  idleClock: number
  spareParts: number
  gunLevels: GunUpgradeLevels
  carPartInventory: CarPartInstance[]
  carPartSlotsByCar: CarPartSlotsByCar
  carPartUpgradeCount: number
  partIdleClock: number
  nextPartSerial: number
  chapterUnlockedCarIds: CarId[]
  chapterUnlockedGunIds: GunId[]
  chapterEquipmentMigrationVersion: number
}

const DEFAULT_FORMATION: FormationAssignment = [
  { heroId: 'foreman', row: 'back', index: 1 },
]

const MAX_INDEX_BY_ROW = { front: 1, back: 2 } as const

function createInitialEquipment(): EquipmentByHero {
  return {
    foreman: { carId: 'rust-fox', gunId: null },
    anvil: { carId: null, gunId: null },
    skyline: { carId: null, gunId: null },
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function clampInt(
  v: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(v)))
}

export function createInitialAdventureState(
  now: number,
): AdventureDurableState {
  const initialCarPartSlots = createInitialCarPartSlots()
  initialCarPartSlots['rust-fox'].engine = PROLOGUE_BROKEN_PART_ID
  return {
    heroLevels: { foreman: 1, anvil: 1, skyline: 1 },
    sharedExp: 0,
    formation: DEFAULT_FORMATION.map((s) => ({ ...s })),
    highestClearedStage: 0,
    highestClearedRacingStage: 0,
    equipmentByHero: createInitialEquipment(),
    idleClock: Number.isFinite(now) ? now : Date.now(),
    spareParts: 0,
    gunLevels: createInitialGunLevels(),
    carPartInventory: [{ ...PROLOGUE_BROKEN_PART }],
    carPartSlotsByCar: initialCarPartSlots,
    carPartUpgradeCount: 0,
    partIdleClock: Number.isFinite(now) ? now : Date.now(),
    nextPartSerial: 1,
    chapterUnlockedCarIds: [],
    chapterUnlockedGunIds: [],
    chapterEquipmentMigrationVersion: 1,
  }
}

function normalizeChapterUnlockedCarIds(value: unknown): CarId[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter(
        (entry): entry is CarId =>
          typeof entry === 'string' &&
          isCarId(entry) &&
          CHAPTER_EQUIPMENT_UNLOCKS.some(
            (unlock) => unlock.kind === 'car' && unlock.carId === entry,
          ),
      ),
    ),
  ]
}

function normalizeChapterUnlockedGunIds(value: unknown): GunId[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter(
        (entry): entry is GunId =>
          typeof entry === 'string' &&
          isGunId(entry) &&
          CHAPTER_EQUIPMENT_UNLOCKS.some(
            (unlock) => unlock.kind === 'gun' && unlock.gunId === entry,
          ),
      ),
    ),
  ]
}

function normalizeGunLevels(value: unknown): GunUpgradeLevels {
  const result = createInitialGunLevels()
  if (!isRecord(value)) return result
  for (const gunId of GUN_IDS) {
    result[gunId] = clampInt(value[gunId], 0, GUN_MAX_LEVEL, 0)
  }
  return result
}

function normalizeCarPartSlot(value: unknown): CarPartInstance['slot'] | null {
  if (value === 'armor') return 'bumper'
  if (value === 'turbo') return 'suspension'
  return typeof value === 'string' && isCarPartSlot(value) ? value : null
}

const LEGACY_CAR_PART_QUALITY_IDS: Readonly<Record<string, CarPartQuality>> = {
  worn: 'common',
  tuned: 'rare',
  elite: 'epic',
  prototype: 'legendary',
}

export function normalizeLegacyPartQuality(
  value: unknown,
): CarPartQuality | null {
  if (typeof value !== 'string') return null
  const quality = LEGACY_CAR_PART_QUALITY_IDS[value] ?? value
  return isCarPartQuality(quality) ? quality : null
}

function normalizeCarPartInventory(value: unknown): CarPartInstance[] {
  if (!Array.isArray(value)) return []
  const result: CarPartInstance[] = []
  const seen = new Set<string>()
  for (const raw of value) {
    if (result.length >= CAR_PART_INVENTORY_LIMIT) break
    if (
      !isRecord(raw) ||
      typeof raw.id !== 'string' ||
      raw.id.trim() === '' ||
      seen.has(raw.id)
    ) {
      continue
    }
    const quality = normalizeLegacyPartQuality(raw.quality)
    if (!quality) continue
    const slot = normalizeCarPartSlot(raw.slot)
    if (!slot) continue
    seen.add(raw.id)
    result.push({
      id: raw.id,
      slot,
      quality,
      level: clampInt(raw.level, 1, CAR_PART_MAX_LEVEL, 1),
    })
  }
  return result
}

function clampEquipmentToHeroCap(input: {
  heroLevels: Record<HeroId, number>
  spareParts: number
  gunLevels: GunUpgradeLevels
  carPartInventory: CarPartInstance[]
}): Pick<
  AdventureDurableState,
  'spareParts' | 'gunLevels' | 'carPartInventory'
> {
  const cap = Math.min(
    CAR_PART_MAX_LEVEL,
    Math.max(1, ...Object.values(input.heroLevels)),
  )
  let refund = 0
  const gunLevels = { ...input.gunLevels }
  for (const gunId of GUN_IDS) {
    const previousLevel = gunLevels[gunId]
    for (let level = cap; level < previousLevel; level += 1) {
      refund = Math.min(
        Number.MAX_SAFE_INTEGER,
        refund + getGunUpgradeCost(gunId, level),
      )
    }
    gunLevels[gunId] = Math.min(previousLevel, cap)
  }
  const carPartInventory = input.carPartInventory.map((part) => {
    for (let level = cap; level < part.level; level += 1) {
      refund = Math.min(
        Number.MAX_SAFE_INTEGER,
        refund + getCarPartUpgradeCost({ ...part, level }),
      )
    }
    return part.level > cap ? { ...part, level: cap } : part
  })
  return {
    spareParts: Math.min(
      Number.MAX_SAFE_INTEGER,
      Math.max(0, input.spareParts) + refund,
    ),
    gunLevels,
    carPartInventory,
  }
}

function normalizeCarPartSlots(
  value: unknown,
  inventory: readonly CarPartInstance[],
): CarPartSlotsByCar {
  const result = createInitialCarPartSlots()
  if (!isRecord(value)) return result
  const inventoryById = new Map(inventory.map((part) => [part.id, part]))
  const installed = new Set<string>()
  for (const carId of CAR_IDS) {
    const rawCar = value[carId]
    if (!isRecord(rawCar)) continue
    for (const slot of CAR_PART_SLOT_IDS) {
      const legacySlot =
        slot === 'bumper' ? 'armor' : slot === 'suspension' ? 'turbo' : slot
      const partId =
        typeof rawCar[slot] === 'string' ? rawCar[slot] : rawCar[legacySlot]
      if (typeof partId !== 'string' || installed.has(partId)) continue
      const part = inventoryById.get(partId)
      if (!part || part.slot !== slot) continue
      result[carId][slot] = partId
      installed.add(partId)
    }
  }
  return result
}

function nextPartSerialFrom(
  value: unknown,
  inventory: readonly CarPartInstance[],
): number {
  const highestExisting = inventory.reduce((highest, part) => {
    const match = /^part-(\d+)$/.exec(part.id)
    if (!match) return highest
    const serial = Number(match[1])
    return Number.isSafeInteger(serial) ? Math.max(highest, serial) : highest
  }, 0)
  return Math.max(
    highestExisting + 1,
    clampInt(value, 1, Number.MAX_SAFE_INTEGER, 1),
  )
}

function normalizeEquipment(value: unknown): EquipmentByHero {
  if (!isRecord(value)) return createInitialEquipment()
  const result = createInitialEquipment()
  for (const id of HERO_IDS) {
    result[id] = { carId: null, gunId: null }
  }
  const seenCars = new Set<string>()
  const seenGuns = new Set<string>()
  for (const id of HERO_IDS) {
    const raw = value[id]
    if (!isRecord(raw)) continue
    const carId =
      typeof raw.carId === 'string' &&
      isCarId(raw.carId) &&
      !seenCars.has(raw.carId)
        ? raw.carId
        : null
    const gunId =
      typeof raw.gunId === 'string' &&
      isGunId(raw.gunId) &&
      !seenGuns.has(raw.gunId)
        ? raw.gunId
        : null
    if (carId) seenCars.add(carId)
    if (gunId) seenGuns.add(gunId)
    result[id] = { carId, gunId }
  }
  return result
}

function normalizeFormation(value: unknown): FormationAssignment {
  if (!Array.isArray(value)) return DEFAULT_FORMATION.map((s) => ({ ...s }))
  const seenHeroes = new Set<string>()
  const seenSlots = new Set<string>()
  const result: FormationAssignment = []
  for (const raw of value) {
    if (
      !isRecord(raw) ||
      typeof raw.heroId !== 'string' ||
      !isHeroId(raw.heroId)
    ) {
      continue
    }
    const row = raw.row
    if (row !== 'front' && row !== 'back') continue
    const index = raw.index
    if (
      typeof index !== 'number' ||
      !Number.isInteger(index) ||
      index < 0 ||
      index > MAX_INDEX_BY_ROW[row]
    ) {
      continue
    }
    const slotKey = `${row}:${index}`
    if (seenHeroes.has(raw.heroId) || seenSlots.has(slotKey)) continue
    if (result.length >= 5) break
    seenHeroes.add(raw.heroId)
    seenSlots.add(slotKey)
    result.push({ heroId: raw.heroId, row, index })
  }
  return result.length === 0 ? DEFAULT_FORMATION.map((s) => ({ ...s })) : result
}

export function normalizeAdventureDurableState(
  value: unknown,
  now: number,
): AdventureDurableState {
  const src = isRecord(value) ? value : {}
  const levelsSrc = isRecord(src.heroLevels) ? src.heroLevels : {}
  const heroLevels = {} as Record<HeroId, number>
  for (const id of HERO_IDS) {
    heroLevels[id] = clampInt(levelsSrc[id], 1, 50, 1)
  }
  const cappedEquipment = clampEquipmentToHeroCap({
    heroLevels,
    spareParts: clampInt(src.spareParts, 0, Number.MAX_SAFE_INTEGER, 0),
    gunLevels: normalizeGunLevels(src.gunLevels),
    carPartInventory: normalizeCarPartInventory(src.carPartInventory),
  })
  return {
    heroLevels,
    sharedExp: clampInt(src.sharedExp, 0, Number.MAX_SAFE_INTEGER, 0),
    formation: normalizeFormation(src.formation),
    highestClearedStage: clampInt(src.highestClearedStage, 0, 20, 0),
    highestClearedRacingStage: clampInt(
      src.highestClearedRacingStage,
      0,
      10,
      0,
    ),
    equipmentByHero: normalizeEquipment(src.equipmentByHero),
    idleClock:
      typeof src.idleClock === 'number' && Number.isFinite(src.idleClock)
        ? src.idleClock
        : Number.isFinite(now)
          ? now
          : Date.now(),
    spareParts: cappedEquipment.spareParts,
    gunLevels: cappedEquipment.gunLevels,
    carPartInventory: cappedEquipment.carPartInventory,
    carPartSlotsByCar: normalizeCarPartSlots(
      src.carPartSlotsByCar,
      cappedEquipment.carPartInventory,
    ),
    carPartUpgradeCount: clampInt(
      src.carPartUpgradeCount,
      0,
      Number.MAX_SAFE_INTEGER,
      0,
    ),
    partIdleClock:
      typeof src.partIdleClock === 'number' &&
      Number.isFinite(src.partIdleClock)
        ? src.partIdleClock
        : Number.isFinite(now)
          ? now
          : Date.now(),
    nextPartSerial: nextPartSerialFrom(
      src.nextPartSerial,
      cappedEquipment.carPartInventory,
    ),
    chapterUnlockedCarIds: normalizeChapterUnlockedCarIds(
      src.chapterUnlockedCarIds,
    ),
    chapterUnlockedGunIds: normalizeChapterUnlockedGunIds(
      src.chapterUnlockedGunIds,
    ),
    chapterEquipmentMigrationVersion: clampInt(
      src.chapterEquipmentMigrationVersion,
      0,
      1,
      0,
    ),
  }
}

export function reconcileAdventureWithGang(
  state: AdventureDurableState,
  gangLevel: number,
): AdventureDurableState {
  const cap = Math.min(
    50,
    Math.max(1, Math.floor(Number.isFinite(gangLevel) ? gangLevel : 1)),
  )
  const heroLevels = {} as Record<HeroId, number>
  for (const id of HERO_IDS) {
    heroLevels[id] = Math.min(state.heroLevels[id] ?? 1, cap)
  }
  const cappedEquipment = clampEquipmentToHeroCap({
    heroLevels,
    spareParts: state.spareParts,
    gunLevels: state.gunLevels,
    carPartInventory: state.carPartInventory,
  })
  const formation = state.formation.filter((slot) =>
    isHeroUnlocked(slot.heroId, gangLevel),
  )
  const chapterUnlockedCarIds = [...state.chapterUnlockedCarIds]
  const chapterUnlockedGunIds = [...state.chapterUnlockedGunIds]
  if (state.chapterEquipmentMigrationVersion < 1) {
    for (const unlock of CHAPTER_EQUIPMENT_UNLOCKS) {
      if (gangLevel < unlock.legacyRequiredLevel) continue
      if (
        unlock.kind === 'car' &&
        !chapterUnlockedCarIds.includes(unlock.carId)
      ) {
        chapterUnlockedCarIds.push(unlock.carId)
      }
      if (
        unlock.kind === 'gun' &&
        !chapterUnlockedGunIds.includes(unlock.gunId)
      ) {
        chapterUnlockedGunIds.push(unlock.gunId)
      }
    }
  }
  const equipmentByHero = {} as EquipmentByHero
  for (const id of HERO_IDS) {
    const equipment = state.equipmentByHero[id]
    equipmentByHero[id] = {
      carId:
        equipment?.carId &&
        isCarUnlocked(equipment.carId, gangLevel, chapterUnlockedCarIds)
          ? equipment.carId
          : null,
      gunId:
        equipment?.gunId &&
        isGunUnlocked(equipment.gunId, gangLevel, chapterUnlockedGunIds)
          ? equipment.gunId
          : null,
    }
  }
  return {
    ...state,
    heroLevels,
    spareParts: cappedEquipment.spareParts,
    gunLevels: cappedEquipment.gunLevels,
    carPartInventory: cappedEquipment.carPartInventory,
    chapterUnlockedCarIds,
    chapterUnlockedGunIds,
    chapterEquipmentMigrationVersion: 1,
    equipmentByHero,
    formation:
      formation.length === 0
        ? DEFAULT_FORMATION.map((s) => ({ ...s }))
        : formation,
  }
}
