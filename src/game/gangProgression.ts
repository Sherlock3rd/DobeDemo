import type { BuildingId } from './cityTypes'

export const GANG_MIN_LEVEL = 1
export const GANG_MAX_LEVEL = 50
export const REPUTATION_PER_LEVEL = 30
export const REPUTATION_PER_SECOND = 5
export const MAX_OFFLINE_SECONDS = 28_800
export const MAX_REPUTATION = 1_470

export interface GangRole {
  threshold: number
  title: string
  chineseTitle: string
}

export interface BuildingUnlock {
  buildingId: BuildingId
  requiredLevel: number
  roleTitle: string
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

export const BUILDING_UNLOCKS: readonly BuildingUnlock[] = [
  { buildingId: 'repair-shop', requiredLevel: 1, roleTitle: 'Prospect' },
  {
    buildingId: 'recycling-yard',
    requiredLevel: 8,
    roleTitle: 'Full Patch',
  },
  {
    buildingId: 'commercial-street',
    requiredLevel: 16,
    roleTitle: 'Wrench',
  },
  {
    buildingId: 'metalworking-plant',
    requiredLevel: 24,
    roleTitle: 'Bar Liaison',
  },
  {
    buildingId: 'gas-station',
    requiredLevel: 32,
    roleTitle: 'Road Captain',
  },
  {
    buildingId: 'clubhouse',
    requiredLevel: 40,
    roleTitle: 'V. PRESIDENT',
  },
]

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

export function getBuildingUnlock(buildingId: string): BuildingUnlock | null {
  return (
    BUILDING_UNLOCKS.find((unlock) => unlock.buildingId === buildingId) ?? null
  )
}

export function isBuildingUnlocked(buildingId: string, level: number): boolean {
  const unlock = getBuildingUnlock(buildingId)

  return unlock !== null && normalizeLevel(level) >= unlock.requiredLevel
}

export interface IdleSettlement {
  earnedReputation: number
  nextUpdatedAt: number
}

export function calculateIdleSettlement(
  lastUpdatedAt: number,
  now: number,
): IdleSettlement {
  if (
    !Number.isFinite(lastUpdatedAt) ||
    !Number.isFinite(now) ||
    now <= lastUpdatedAt
  ) {
    return { earnedReputation: 0, nextUpdatedAt: lastUpdatedAt }
  }

  const elapsedSeconds = Math.floor((now - lastUpdatedAt) / 1_000)

  if (elapsedSeconds < 1) {
    return { earnedReputation: 0, nextUpdatedAt: lastUpdatedAt }
  }

  if (elapsedSeconds >= MAX_OFFLINE_SECONDS) {
    return {
      earnedReputation: MAX_OFFLINE_SECONDS * REPUTATION_PER_SECOND,
      nextUpdatedAt: now,
    }
  }

  return {
    earnedReputation: elapsedSeconds * REPUTATION_PER_SECOND,
    nextUpdatedAt: lastUpdatedAt + elapsedSeconds * 1_000,
  }
}

export function calculateIdleReputation(
  lastUpdatedAt: number,
  now: number,
): number {
  return calculateIdleSettlement(lastUpdatedAt, now).earnedReputation
}
