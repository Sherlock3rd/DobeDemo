import { HERO_IDS, isHeroId, isHeroUnlocked, type HeroId } from '../game/heroes'
import type { FormationAssignment } from '../game/combat/power'

export const ADVENTURE_STORAGE_KEY = 'dobe-adventure-progression-v1'

export interface AdventureDurableState {
  heroLevels: Record<HeroId, number>
  sharedExp: number
  formation: FormationAssignment
  highestClearedStage: number
  idleClock: number
}

const DEFAULT_FORMATION: FormationAssignment = [
  { heroId: 'foreman', row: 'back', index: 1 },
]

const MAX_INDEX_BY_ROW = { front: 1, back: 2 } as const

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
  return {
    heroLevels: { foreman: 1, anvil: 1, skyline: 1 },
    sharedExp: 0,
    formation: DEFAULT_FORMATION.map((s) => ({ ...s })),
    highestClearedStage: 0,
    idleClock: Number.isFinite(now) ? now : Date.now(),
  }
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
  return {
    heroLevels,
    sharedExp: clampInt(src.sharedExp, 0, Number.MAX_SAFE_INTEGER, 0),
    formation: normalizeFormation(src.formation),
    highestClearedStage: clampInt(src.highestClearedStage, 0, 20, 0),
    idleClock:
      typeof src.idleClock === 'number' && Number.isFinite(src.idleClock)
        ? src.idleClock
        : Number.isFinite(now)
          ? now
          : Date.now(),
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
  const formation = state.formation.filter((slot) =>
    isHeroUnlocked(slot.heroId, gangLevel),
  )
  return {
    ...state,
    heroLevels,
    formation:
      formation.length === 0
        ? DEFAULT_FORMATION.map((s) => ({ ...s }))
        : formation,
  }
}
