export const GANG_MIN_LEVEL = 1
export const GANG_MAX_LEVEL = 50
export const REPUTATION_PER_LEVEL = 30
export const MAX_REPUTATION = 1_470

export interface GangRole {
  threshold: number
  title: string
  chineseTitle: string
}

export const GANG_ROLES: readonly GangRole[] = [
  { threshold: 1, title: 'Prospect', chineseTitle: '见习' },
  { threshold: 8, title: 'Full Patch', chineseTitle: '正式成员' },
  { threshold: 16, title: 'Wrench', chineseTitle: '技术骨干' },
  { threshold: 24, title: 'Bar Liaison', chineseTitle: '酒吧联络人' },
  { threshold: 32, title: 'Road Captain', chineseTitle: '路线队长' },
  { threshold: 40, title: 'V. PRESIDENT', chineseTitle: '副主席' },
  { threshold: 50, title: 'PRESIDENT', chineseTitle: '主席' },
]

// Permanent compatibility layer: building unlocks are now derived from the
// unified PROGRESSION_UNLOCKS array (src/game/progressionUnlocks.ts), which
// also carries hero/feature unlocks. This re-export keeps every existing
// importer of gangProgression working unchanged.
export {
  BUILDING_UNLOCKS,
  getBuildingUnlock,
  isBuildingUnlocked,
  normalizeGangLevel,
  type BuildingUnlock,
} from './progressionUnlocks'

function normalizeLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return level === Number.POSITIVE_INFINITY ? GANG_MAX_LEVEL : GANG_MIN_LEVEL
  }

  return Math.min(Math.max(Math.floor(level), GANG_MIN_LEVEL), GANG_MAX_LEVEL)
}

function normalizeReputation(totalReputation: number): number {
  if (!Number.isFinite(totalReputation) || totalReputation < 0) {
    return 0
  }

  return Math.min(totalReputation, MAX_REPUTATION)
}

export function getGangLevel(totalReputation: number): number {
  const reputation = normalizeReputation(totalReputation)

  return Math.min(
    Math.floor(reputation / REPUTATION_PER_LEVEL) + GANG_MIN_LEVEL,
    GANG_MAX_LEVEL,
  )
}

export function getGangRole(level: number): GangRole {
  const normalizedLevel = normalizeLevel(level)

  for (let index = GANG_ROLES.length - 1; index >= 0; index -= 1) {
    const role = GANG_ROLES[index]
    if (role.threshold <= normalizedLevel) {
      return role
    }
  }

  return GANG_ROLES[0]
}

export function getNextGangRole(level: number): GangRole | null {
  const normalizedLevel = normalizeLevel(level)

  return GANG_ROLES.find(({ threshold }) => threshold > normalizedLevel) ?? null
}

export function getTotalReputationForLevel(level: number): number {
  return (normalizeLevel(level) - GANG_MIN_LEVEL) * REPUTATION_PER_LEVEL
}

export function getLevelProgress(totalReputation: number): {
  current: number
  required: number
} {
  const reputation = normalizeReputation(totalReputation)

  if (reputation === MAX_REPUTATION) {
    return {
      current: REPUTATION_PER_LEVEL,
      required: REPUTATION_PER_LEVEL,
    }
  }

  return {
    current: reputation % REPUTATION_PER_LEVEL,
    required: REPUTATION_PER_LEVEL,
  }
}
