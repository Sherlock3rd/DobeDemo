import type { BuildingId } from './cityTypes'
import type { HeroId } from './heroes'

export type UnlockKind = 'building' | 'hero' | 'feature'
export type FeatureId = 'adventure' | 'heroes'

export interface ProgressionUnlockBase {
  requiredLevel: number
  roleTitle: string
}

export type ProgressionUnlock =
  | (ProgressionUnlockBase & { kind: 'building'; buildingId: BuildingId })
  | (ProgressionUnlockBase & { kind: 'hero'; heroId: HeroId })
  | (ProgressionUnlockBase & { kind: 'feature'; featureId: FeatureId })

export const PROGRESSION_UNLOCKS: readonly ProgressionUnlock[] = [
  {
    kind: 'building',
    buildingId: 'repair-shop',
    requiredLevel: 1,
    roleTitle: 'Prospect',
  },
  {
    kind: 'feature',
    featureId: 'adventure',
    requiredLevel: 1,
    roleTitle: 'Prospect',
  },
  {
    kind: 'feature',
    featureId: 'heroes',
    requiredLevel: 1,
    roleTitle: 'Prospect',
  },
  {
    kind: 'hero',
    heroId: 'foreman',
    requiredLevel: 1,
    roleTitle: 'Prospect',
  },
  {
    kind: 'building',
    buildingId: 'recycling-yard',
    requiredLevel: 8,
    roleTitle: 'Full Patch',
  },
  {
    kind: 'hero',
    heroId: 'anvil',
    requiredLevel: 12,
    roleTitle: 'Full Patch',
  },
  {
    kind: 'building',
    buildingId: 'commercial-street',
    requiredLevel: 16,
    roleTitle: 'Wrench',
  },
  {
    kind: 'building',
    buildingId: 'metalworking-plant',
    requiredLevel: 24,
    roleTitle: 'Bar Liaison',
  },
  {
    kind: 'hero',
    heroId: 'skyline',
    requiredLevel: 28,
    roleTitle: 'Bar Liaison',
  },
  {
    kind: 'building',
    buildingId: 'gas-station',
    requiredLevel: 32,
    roleTitle: 'Road Captain',
  },
  {
    kind: 'building',
    buildingId: 'clubhouse',
    requiredLevel: 40,
    roleTitle: 'V. PRESIDENT',
  },
]

export const GANG_MIN_LEVEL = 1
export const GANG_MAX_LEVEL = 50

export function normalizeGangLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return level === Number.POSITIVE_INFINITY ? GANG_MAX_LEVEL : GANG_MIN_LEVEL
  }

  return Math.min(Math.max(Math.floor(level), GANG_MIN_LEVEL), GANG_MAX_LEVEL)
}

export interface BuildingUnlock {
  buildingId: BuildingId
  requiredLevel: number
  roleTitle: string
}

export const BUILDING_UNLOCKS: readonly BuildingUnlock[] =
  PROGRESSION_UNLOCKS.filter(
    (unlock): unlock is ProgressionUnlock & { kind: 'building' } =>
      unlock.kind === 'building',
  ).map(({ buildingId, requiredLevel, roleTitle }) => ({
    buildingId,
    requiredLevel,
    roleTitle,
  }))

export function getBuildingUnlock(buildingId: string): BuildingUnlock | null {
  return (
    BUILDING_UNLOCKS.find((unlock) => unlock.buildingId === buildingId) ?? null
  )
}

export function isBuildingUnlocked(buildingId: string, level: number): boolean {
  const unlock = getBuildingUnlock(buildingId)

  return unlock !== null && normalizeGangLevel(level) >= unlock.requiredLevel
}

export function heroUnlockLevel(heroId: HeroId): number {
  const unlock = PROGRESSION_UNLOCKS.find(
    (candidate): candidate is ProgressionUnlock & { kind: 'hero' } =>
      candidate.kind === 'hero' && candidate.heroId === heroId,
  )
  if (!unlock) {
    throw new Error(`Unknown hero unlock: ${heroId}`)
  }
  return unlock.requiredLevel
}

export function isHeroUnlocked(heroId: HeroId, gangLevel: number): boolean {
  return normalizeGangLevel(gangLevel) >= heroUnlockLevel(heroId)
}

export function isFeatureUnlocked(
  featureId: FeatureId,
  gangLevel: number,
): boolean {
  const unlock = PROGRESSION_UNLOCKS.find(
    (candidate): candidate is ProgressionUnlock & { kind: 'feature' } =>
      candidate.kind === 'feature' && candidate.featureId === featureId,
  )
  return (
    unlock !== undefined &&
    normalizeGangLevel(gangLevel) >= unlock.requiredLevel
  )
}
