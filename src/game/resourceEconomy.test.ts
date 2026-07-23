import { describe, expect, it } from 'vitest'
import type { BuildingId } from './cityTypes'
import { economyConfig } from '../config/economyConfig'
import {
  EMPTY_WALLET,
  canAfford,
  getBuildingProductionPerTick,
  settleResourceProduction,
  subtractCost,
  type BuildingProgressByIdLike,
} from './resourceEconomy'

const cost5 = { money: 5, oil: 0, materials: 0 }
const TICK_MS = economyConfig.resourceTickSeconds * 1000
const MAX_OFFLINE_MS = economyConfig.maxOfflineSeconds * 1000

const EMPTY_CHILD_LEVELS: Record<
  BuildingId,
  { childLevels: readonly number[] }
> = {
  'repair-shop': { childLevels: [] },
  'recycling-yard': { childLevels: [] },
  'commercial-street': { childLevels: [] },
  'metalworking-plant': { childLevels: [] },
  'gas-station': { childLevels: [] },
  clubhouse: { childLevels: [] },
}

function repairShopProgress(
  childLevels: readonly number[],
): BuildingProgressByIdLike {
  return {
    ...EMPTY_CHILD_LEVELS,
    'repair-shop': { childLevels },
  }
}

describe('resourceEconomy', () => {
  it('tracks affordability and subtracts costs', () => {
    expect(canAfford({ money: 5, oil: 0, materials: 0 }, cost5)).toBe(true)
    expect(subtractCost({ money: 5, oil: 2, materials: 3 }, cost5)).toEqual({
      money: 0,
      oil: 2,
      materials: 3,
    })
  })

  it('computes building production per tick from child levels', () => {
    expect(
      getBuildingProductionPerTick('repair-shop', [1, 1, 1, 1, 1]),
    ).toEqual({ money: 2, oil: 0, materials: 0 })
  })

  it('returns an empty wallet constant', () => {
    expect(EMPTY_WALLET).toEqual({ money: 0, oil: 0, materials: 0 })
  })

  it('does not settle partial ticks below one tick interval', () => {
    const lastUpdatedAt = 1_000
    const now = lastUpdatedAt + 9_999

    expect(
      settleResourceProduction({
        wallet: { money: 0, oil: 0, materials: 0 },
        buildingProgress: repairShopProgress([0, 0, 0, 0, 0]),
        activeProducerIds: ['repair-shop'],
        lastUpdatedAt,
        now,
      }),
    ).toEqual({
      wallet: { money: 0, oil: 0, materials: 0 },
      earned: { money: 0, oil: 0, materials: 0 },
      nextUpdatedAt: lastUpdatedAt,
    })
  })

  it('settles one full tick after 10 seconds', () => {
    const lastUpdatedAt = 5_000
    const now = lastUpdatedAt + TICK_MS

    expect(
      settleResourceProduction({
        wallet: { money: 0, oil: 0, materials: 0 },
        buildingProgress: repairShopProgress([0, 0, 0, 0, 0]),
        activeProducerIds: ['repair-shop'],
        lastUpdatedAt,
        now,
      }),
    ).toEqual({
      wallet: { money: 1, oil: 0, materials: 0 },
      earned: { money: 1, oil: 0, materials: 0 },
      nextUpdatedAt: now,
    })
  })

  it('settles multiple ticks and keeps leftover time', () => {
    const lastUpdatedAt = 0
    const now = 25_000

    expect(
      settleResourceProduction({
        wallet: { money: 0, oil: 0, materials: 0 },
        buildingProgress: repairShopProgress([0, 0, 0, 0, 0]),
        activeProducerIds: ['repair-shop'],
        lastUpdatedAt,
        now,
      }),
    ).toEqual({
      wallet: { money: 2, oil: 0, materials: 0 },
      earned: { money: 2, oil: 0, materials: 0 },
      nextUpdatedAt: 20_000,
    })
  })

  it('caps offline settlement at eight hours and advances to now', () => {
    const lastUpdatedAt = 0
    const now = MAX_OFFLINE_MS + 60_000

    expect(
      settleResourceProduction({
        wallet: { money: 0, oil: 0, materials: 0 },
        buildingProgress: repairShopProgress([0, 0, 0, 0, 0]),
        activeProducerIds: ['repair-shop'],
        lastUpdatedAt,
        now,
      }),
    ).toEqual({
      wallet: { money: 2_880, oil: 0, materials: 0 },
      earned: { money: 2_880, oil: 0, materials: 0 },
      nextUpdatedAt: now,
    })
  })

  it('earns nothing when no active producers are configured', () => {
    const lastUpdatedAt = 0
    const now = TICK_MS

    expect(
      settleResourceProduction({
        wallet: { money: 0, oil: 0, materials: 0 },
        buildingProgress: repairShopProgress([0, 0, 0, 0, 0]),
        activeProducerIds: [],
        lastUpdatedAt,
        now,
      }),
    ).toEqual({
      wallet: { money: 0, oil: 0, materials: 0 },
      earned: { money: 0, oil: 0, materials: 0 },
      nextUpdatedAt: now,
    })
  })

  it('no-ops when now is before lastUpdatedAt', () => {
    const wallet = { money: 10, oil: 0, materials: 0 }
    const lastUpdatedAt = 10_000

    expect(
      settleResourceProduction({
        wallet,
        buildingProgress: repairShopProgress([0, 0, 0, 0, 0]),
        activeProducerIds: ['repair-shop'],
        lastUpdatedAt,
        now: 5_000,
      }),
    ).toEqual({
      wallet,
      earned: { money: 0, oil: 0, materials: 0 },
      nextUpdatedAt: lastUpdatedAt,
    })
  })

  it.each([
    { label: 'NaN now', lastUpdatedAt: 0, now: Number.NaN },
    {
      label: 'Infinity now',
      lastUpdatedAt: 0,
      now: Number.POSITIVE_INFINITY,
    },
    { label: 'NaN lastUpdatedAt', lastUpdatedAt: Number.NaN, now: 10_000 },
    {
      label: 'Infinity lastUpdatedAt',
      lastUpdatedAt: Number.POSITIVE_INFINITY,
      now: 10_000,
    },
  ])('no-ops for invalid timestamps ($label)', ({ lastUpdatedAt, now }) => {
    const wallet = { money: 10, oil: 0, materials: 0 }

    const result = settleResourceProduction({
      wallet,
      buildingProgress: repairShopProgress([0, 0, 0, 0, 0]),
      activeProducerIds: ['repair-shop'],
      lastUpdatedAt,
      now,
    })

    expect(result.wallet).toEqual(wallet)
    expect(result.earned).toEqual({ money: 0, oil: 0, materials: 0 })
    expect(result.nextUpdatedAt).toBe(lastUpdatedAt)
    expect(Number.isFinite(result.wallet.money)).toBe(true)
    expect(Number.isFinite(result.wallet.oil)).toBe(true)
    expect(Number.isFinite(result.wallet.materials)).toBe(true)
  })

  it('aggregates production from multiple active producers', () => {
    const buildingProgress: BuildingProgressByIdLike = {
      ...EMPTY_CHILD_LEVELS,
      'repair-shop': { childLevels: [0, 0, 0, 0, 0] },
      'gas-station': { childLevels: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    }

    expect(
      settleResourceProduction({
        wallet: { money: 0, oil: 0, materials: 0 },
        buildingProgress,
        activeProducerIds: ['repair-shop', 'gas-station'],
        lastUpdatedAt: 0,
        now: TICK_MS,
      }),
    ).toEqual({
      wallet: { money: 1, oil: 1, materials: 0 },
      earned: { money: 1, oil: 1, materials: 0 },
      nextUpdatedAt: TICK_MS,
    })
  })
})
