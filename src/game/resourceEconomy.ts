import {
  economyConfig,
  type ResourceCost,
  type ResourceWallet,
} from '../config/economyConfig'
import type { BuildingProgressById } from '../store/cityProgressMigration'
import type { BuildingId } from './cityTypes'

export type BuildingProgressByIdLike = Readonly<
  Record<BuildingId, { childLevels: readonly number[] }>
>

export interface ResourceSettlement {
  wallet: ResourceWallet
  earned: ResourceWallet
  nextUpdatedAt: number
}

export const EMPTY_WALLET: ResourceWallet = {
  money: 0,
  oil: 0,
  materials: 0,
}

export function canAfford(wallet: ResourceWallet, cost: ResourceCost): boolean {
  return (
    wallet.money >= cost.money &&
    wallet.oil >= cost.oil &&
    wallet.materials >= cost.materials
  )
}

export function subtractCost(
  wallet: ResourceWallet,
  cost: ResourceCost,
): ResourceWallet {
  return {
    money: wallet.money - cost.money,
    oil: wallet.oil - cost.oil,
    materials: wallet.materials - cost.materials,
  }
}

export function getBuildingProductionPerTick(
  buildingId: BuildingId,
  childLevels: readonly number[],
): ResourceWallet {
  const productionConfig = economyConfig.production[buildingId]
  if (!productionConfig) {
    return { ...EMPTY_WALLET }
  }

  const childLevelSum = childLevels.reduce((total, level) => total + level, 0)
  const perTick =
    productionConfig.basePerTick +
    Math.floor(childLevelSum / productionConfig.childLevelStep) *
      productionConfig.bonusPerStep

  const wallet: ResourceWallet = { ...EMPTY_WALLET }
  wallet[productionConfig.resource] = perTick
  return wallet
}

export function addWalletSaturated(
  left: ResourceWallet,
  right: ResourceWallet,
): ResourceWallet {
  const add = (leftValue: number, rightValue: number) =>
    Math.min(Number.MAX_SAFE_INTEGER, leftValue + rightValue)
  return {
    money: add(left.money, right.money),
    oil: add(left.oil, right.oil),
    materials: add(left.materials, right.materials),
  }
}

export function getCurrentProductionRates(
  buildingProgress: BuildingProgressById,
  activeProducerIds: readonly BuildingId[],
): ResourceWallet {
  return activeProducerIds.reduce<ResourceWallet>(
    (total, buildingId) => {
      const progress = buildingProgress[buildingId]
      if (!progress) {
        return total
      }

      return addWalletSaturated(
        total,
        getBuildingProductionPerTick(buildingId, progress.childLevels),
      )
    },
    { ...EMPTY_WALLET },
  )
}

function scaleWallet(wallet: ResourceWallet, ticks: number): ResourceWallet {
  return {
    money: wallet.money * ticks,
    oil: wallet.oil * ticks,
    materials: wallet.materials * ticks,
  }
}

export function settleResourceProduction(input: {
  wallet: ResourceWallet
  buildingProgress: BuildingProgressByIdLike
  activeProducerIds: readonly BuildingId[]
  lastUpdatedAt: number
  now: number
}): ResourceSettlement {
  const { wallet, buildingProgress, activeProducerIds, lastUpdatedAt, now } =
    input

  if (!Number.isFinite(now) || !Number.isFinite(lastUpdatedAt)) {
    return {
      wallet,
      earned: { ...EMPTY_WALLET },
      nextUpdatedAt: lastUpdatedAt,
    }
  }

  if (now < lastUpdatedAt) {
    return {
      wallet,
      earned: { ...EMPTY_WALLET },
      nextUpdatedAt: lastUpdatedAt,
    }
  }

  const tickMs = economyConfig.resourceTickSeconds * 1000
  const maxOfflineMs = economyConfig.maxOfflineSeconds * 1000
  const elapsedMs = now - lastUpdatedAt
  const capped = elapsedMs > maxOfflineMs
  const effectiveElapsedMs = Math.min(elapsedMs, maxOfflineMs)
  const ticks = Math.floor(effectiveElapsedMs / tickMs)

  if (ticks === 0) {
    return {
      wallet,
      earned: { ...EMPTY_WALLET },
      nextUpdatedAt: lastUpdatedAt,
    }
  }

  let earned: ResourceWallet = { ...EMPTY_WALLET }

  for (const buildingId of activeProducerIds) {
    const progress = buildingProgress[buildingId]
    if (!progress) {
      continue
    }

    const perTick = getBuildingProductionPerTick(
      buildingId,
      progress.childLevels,
    )
    earned = addWalletSaturated(earned, scaleWallet(perTick, ticks))
  }

  const nextUpdatedAt = capped ? now : lastUpdatedAt + ticks * tickMs

  return {
    wallet: addWalletSaturated(wallet, earned),
    earned,
    nextUpdatedAt,
  }
}
