import { describe, expect, it } from 'vitest'
import {
  BUILDING_UNLOCKS,
  GANG_MAX_LEVEL,
  GANG_MIN_LEVEL,
  GANG_ROLES,
  MAX_OFFLINE_SECONDS,
  MAX_REPUTATION,
  REPUTATION_PER_LEVEL,
  REPUTATION_PER_SECOND,
  calculateIdleReputation,
  calculateIdleSettlement,
  getBuildingUnlock,
  getGangLevel,
  getGangRole,
  getLevelProgress,
  getNextGangRole,
  getTotalReputationForLevel,
  isBuildingUnlocked,
} from './gangProgression'

const EXPECTED_ROLES = [
  { threshold: 1, title: 'Prospect', chineseTitle: '见习' },
  { threshold: 8, title: 'Full Patch', chineseTitle: '正式成员' },
  { threshold: 16, title: 'Wrench', chineseTitle: '技术骨干' },
  { threshold: 24, title: 'Bar Liaison', chineseTitle: '酒吧联络人' },
  { threshold: 32, title: 'Road Captain', chineseTitle: '路线队长' },
  { threshold: 40, title: 'V. PRESIDENT', chineseTitle: '副主席' },
  { threshold: 50, title: 'PRESIDENT', chineseTitle: '主席' },
]

const EXPECTED_UNLOCKS = [
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

describe('gang progression constants', () => {
  it('exports the specified progression and idle values', () => {
    expect({
      GANG_MIN_LEVEL,
      GANG_MAX_LEVEL,
      REPUTATION_PER_LEVEL,
      REPUTATION_PER_SECOND,
      MAX_OFFLINE_SECONDS,
      MAX_REPUTATION,
    }).toEqual({
      GANG_MIN_LEVEL: 1,
      GANG_MAX_LEVEL: 50,
      REPUTATION_PER_LEVEL: 30,
      REPUTATION_PER_SECOND: 5,
      MAX_OFFLINE_SECONDS: 28_800,
      MAX_REPUTATION: 1_470,
    })
  })
})

describe('gang roles', () => {
  it('defines every role in exact threshold order', () => {
    expect(GANG_ROLES).toEqual(EXPECTED_ROLES)
  })

  it.each([
    [1, 'Prospect'],
    [8, 'Full Patch'],
    [16, 'Wrench'],
    [24, 'Bar Liaison'],
    [32, 'Road Captain'],
    [40, 'V. PRESIDENT'],
    [50, 'PRESIDENT'],
  ])('selects the role at level %i', (level, title) => {
    expect(getGangRole(level).title).toBe(title)
  })

  it.each([
    [7, 'Prospect'],
    [15, 'Full Patch'],
    [23, 'Wrench'],
    [31, 'Bar Liaison'],
    [39, 'Road Captain'],
    [49, 'V. PRESIDENT'],
  ])('selects the role for intermediate level %i', (level, title) => {
    expect(getGangRole(level).title).toBe(title)
  })

  it('clamps role lookup levels to 1 through 50', () => {
    expect(getGangRole(-100).title).toBe('Prospect')
    expect(getGangRole(100).title).toBe('PRESIDENT')
  })

  it('normalizes non-finite and fractional levels for current roles', () => {
    expect(getGangRole(Number.NaN).title).toBe('Prospect')
    expect(getGangRole(Number.NEGATIVE_INFINITY).title).toBe('Prospect')
    expect(getGangRole(Number.POSITIVE_INFINITY).title).toBe('PRESIDENT')
    expect(getGangRole(1.9).title).toBe('Prospect')
    expect(getGangRole(8.9).title).toBe('Full Patch')
    expect(getGangRole(50.9).title).toBe('PRESIDENT')
  })

  it.each([
    [1, 'Full Patch'],
    [8, 'Wrench'],
    [39, 'V. PRESIDENT'],
    [40, 'PRESIDENT'],
    [49, 'PRESIDENT'],
  ])('returns the first role strictly above level %i', (level, title) => {
    expect(getNextGangRole(level)?.title).toBe(title)
  })

  it('returns no next role at the maximum level', () => {
    expect(getNextGangRole(50)).toBeNull()
    expect(getNextGangRole(500)).toBeNull()
  })

  it('normalizes non-finite and fractional levels for next roles', () => {
    expect(getNextGangRole(Number.NaN)?.title).toBe('Full Patch')
    expect(getNextGangRole(Number.NEGATIVE_INFINITY)?.title).toBe('Full Patch')
    expect(getNextGangRole(Number.POSITIVE_INFINITY)).toBeNull()
    expect(getNextGangRole(1.9)?.title).toBe('Full Patch')
    expect(getNextGangRole(8.9)?.title).toBe('Wrench')
    expect(getNextGangRole(50.9)).toBeNull()
  })
})

describe('gang level and reputation progress', () => {
  it.each([
    [0, 1],
    [29, 1],
    [30, 2],
    [1_469, 49],
    [1_470, 50],
    [100_000, 50],
  ])('maps %s reputation to level %i', (reputation, level) => {
    expect(getGangLevel(reputation)).toBe(level)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'treats invalid reputation %s as zero',
    (reputation) => {
      expect(getGangLevel(reputation)).toBe(1)
      expect(getLevelProgress(reputation)).toEqual({ current: 0, required: 30 })
    },
  )

  it.each([
    [1, 0],
    [2, 30],
    [49, 1_440],
    [50, 1_470],
  ])('returns total reputation required for level %i', (level, reputation) => {
    expect(getTotalReputationForLevel(level)).toBe(reputation)
  })

  it('clamps level inputs when calculating required reputation', () => {
    expect(getTotalReputationForLevel(-10)).toBe(0)
    expect(getTotalReputationForLevel(500)).toBe(1_470)
  })

  it('normalizes non-finite and fractional levels for total reputation', () => {
    expect(getTotalReputationForLevel(Number.NaN)).toBe(0)
    expect(getTotalReputationForLevel(Number.NEGATIVE_INFINITY)).toBe(0)
    expect(getTotalReputationForLevel(Number.POSITIVE_INFINITY)).toBe(1_470)
    expect(getTotalReputationForLevel(1.9)).toBe(0)
    expect(getTotalReputationForLevel(8.9)).toBe(210)
    expect(getTotalReputationForLevel(50.9)).toBe(1_470)
  })

  it('reports the remainder toward the next level', () => {
    expect(getLevelProgress(0)).toEqual({ current: 0, required: 30 })
    expect(getLevelProgress(29)).toEqual({ current: 29, required: 30 })
    expect(getLevelProgress(30)).toEqual({ current: 0, required: 30 })
    expect(getLevelProgress(1_469)).toEqual({ current: 29, required: 30 })
  })

  it('reports full progress at and beyond maximum reputation', () => {
    expect(getLevelProgress(1_470)).toEqual({ current: 30, required: 30 })
    expect(getLevelProgress(9_999)).toEqual({ current: 30, required: 30 })
  })
})

describe('building unlocks', () => {
  it('defines unlocks in exact building and threshold order', () => {
    expect(BUILDING_UNLOCKS).toEqual(EXPECTED_UNLOCKS)
  })

  it('finds each known building unlock', () => {
    for (const unlock of EXPECTED_UNLOCKS) {
      expect(getBuildingUnlock(unlock.buildingId)).toEqual(unlock)
    }
  })

  it('returns null and false for an unknown building', () => {
    expect(getBuildingUnlock('unknown-building')).toBeNull()
    expect(isBuildingUnlocked('unknown-building', 50)).toBe(false)
  })

  it('unlocks only the repair shop initially', () => {
    expect(
      EXPECTED_UNLOCKS.filter(({ buildingId }) =>
        isBuildingUnlocked(buildingId, 1),
      ).map(({ buildingId }) => buildingId),
    ).toEqual(['repair-shop'])
  })

  it.each(EXPECTED_UNLOCKS)(
    'unlocks $buildingId precisely at level $requiredLevel',
    ({ buildingId, requiredLevel }) => {
      if (requiredLevel > GANG_MIN_LEVEL) {
        expect(isBuildingUnlocked(buildingId, requiredLevel - 1)).toBe(false)
      }
      expect(isBuildingUnlocked(buildingId, requiredLevel)).toBe(true)
    },
  )

  it('clamps building level checks to 1 through 50', () => {
    expect(isBuildingUnlocked('repair-shop', -100)).toBe(true)
    expect(isBuildingUnlocked('clubhouse', 100)).toBe(true)
  })

  it('normalizes non-finite and fractional levels for building unlocks', () => {
    expect(isBuildingUnlocked('repair-shop', Number.NaN)).toBe(true)
    expect(isBuildingUnlocked('repair-shop', Number.NEGATIVE_INFINITY)).toBe(
      true,
    )
    expect(isBuildingUnlocked('clubhouse', Number.POSITIVE_INFINITY)).toBe(true)
    expect(isBuildingUnlocked('recycling-yard', 1.9)).toBe(false)
    expect(isBuildingUnlocked('recycling-yard', 8.9)).toBe(true)
    expect(isBuildingUnlocked('clubhouse', 50.9)).toBe(true)
  })
})

describe('idle reputation', () => {
  it('awards five reputation for each complete elapsed second', () => {
    expect(calculateIdleReputation(1_000, 11_000)).toBe(50)
  })

  it('ignores partial seconds', () => {
    expect(calculateIdleReputation(1_000, 2_999)).toBe(5)
    expect(calculateIdleReputation(1_000, 1_999)).toBe(0)
  })

  it('returns zero for non-positive elapsed time', () => {
    expect(calculateIdleReputation(2_000, 1_000)).toBe(0)
    expect(calculateIdleReputation(1_000, 1_000)).toBe(0)
  })

  it.each([
    [Number.NaN, 1_000],
    [1_000, Number.NaN],
    [Number.NEGATIVE_INFINITY, 1_000],
    [1_000, Number.POSITIVE_INFINITY],
  ])('returns zero for non-finite timestamps', (lastUpdatedAt, now) => {
    expect(calculateIdleReputation(lastUpdatedAt, now)).toBe(0)
  })

  it('caps idle earnings at eight hours', () => {
    const eightHoursInMs = MAX_OFFLINE_SECONDS * 1_000

    expect(calculateIdleReputation(0, eightHoursInMs)).toBe(144_000)
    expect(calculateIdleReputation(0, eightHoursInMs * 2)).toBe(144_000)
  })
})

describe('idle settlement', () => {
  it('settles five complete seconds into twenty-five reputation', () => {
    expect(calculateIdleSettlement(1_000, 6_000)).toEqual({
      earnedReputation: 25,
      nextUpdatedAt: 6_000,
    })
  })

  it('settles only complete seconds and keeps the sub-second remainder', () => {
    expect(calculateIdleSettlement(1_000, 2_500)).toEqual({
      earnedReputation: 5,
      nextUpdatedAt: 2_000,
    })
  })

  it('does not advance lastUpdatedAt when less than one second elapsed', () => {
    expect(calculateIdleSettlement(1_000, 1_999)).toEqual({
      earnedReputation: 0,
      nextUpdatedAt: 1_000,
    })
  })

  it('caps earnings at eight hours and snaps lastUpdatedAt to now beyond the cap', () => {
    const eightHoursInMs = MAX_OFFLINE_SECONDS * 1_000

    expect(calculateIdleSettlement(0, eightHoursInMs)).toEqual({
      earnedReputation: 144_000,
      nextUpdatedAt: eightHoursInMs,
    })

    const beyondCapNow = eightHoursInMs * 2 + 500
    expect(calculateIdleSettlement(0, beyondCapNow)).toEqual({
      earnedReputation: 144_000,
      nextUpdatedAt: beyondCapNow,
    })
  })

  it('leaves the settlement unchanged for non-positive or non-finite elapsed time', () => {
    expect(calculateIdleSettlement(2_000, 1_000)).toEqual({
      earnedReputation: 0,
      nextUpdatedAt: 2_000,
    })
    expect(calculateIdleSettlement(1_000, 1_000)).toEqual({
      earnedReputation: 0,
      nextUpdatedAt: 1_000,
    })
    expect(calculateIdleSettlement(Number.NaN, 1_000)).toEqual({
      earnedReputation: 0,
      nextUpdatedAt: Number.NaN,
    })
    expect(calculateIdleSettlement(1_000, Number.POSITIVE_INFINITY)).toEqual({
      earnedReputation: 0,
      nextUpdatedAt: 1_000,
    })
  })

  it('backs calculateIdleReputation with the settlement earned amount', () => {
    expect(calculateIdleReputation(1_000, 6_000)).toBe(
      calculateIdleSettlement(1_000, 6_000).earnedReputation,
    )
  })
})
