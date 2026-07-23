import {
  economyConfig,
  type ResourceCost,
  type ResourceWallet,
} from '../config/economyConfig'
import { canAfford } from './resourceEconomy'
import { isBuildingUnlocked } from './gangProgression'
import {
  type BuildingId,
  type BuildingLevel,
  type BuildingProgress,
} from './cityTypes'

export const NON_CLUBHOUSE_MAX_LEVEL = 5
export const CLUBHOUSE_MAX_LEVEL = 10

export type UpgradeBlockReason =
  | 'ready'
  | 'building-locked'
  | 'child-at-main-level'
  | 'children-not-caught-up'
  | 'building-maxed'
  | 'clubhouse-locked'
  | 'clubhouse-too-low'
  | 'insufficient-resources'

export interface UpgradeDecision {
  reason: UpgradeBlockReason
  targetLevel: number | null
  cost: ResourceCost | null
  missingResources: ResourceCost
}

export interface ChildUpgradeDecisionInput {
  buildingId: BuildingId
  childIndex: number
  progress: BuildingProgress
  wallet: ResourceWallet
  gangLevel: number
}

export interface MainUpgradeDecisionInput {
  buildingId: BuildingId
  progress: BuildingProgress
  clubhouseProgress: BuildingProgress
  wallet: ResourceWallet
  gangLevel: number
}

const noMissing: ResourceCost = { money: 0, oil: 0, materials: 0 }

export function getBuildingChildCount(id: BuildingId): 5 | 10 {
  return id === 'repair-shop' ? 5 : 10
}

export function getBuildingMaxLevel(id: BuildingId): BuildingLevel {
  return id === 'clubhouse' ? CLUBHOUSE_MAX_LEVEL : NON_CLUBHOUSE_MAX_LEVEL
}

export function getCaughtUpChildCount(progress: BuildingProgress): number {
  return progress.childLevels.filter((level) => level === progress.level).length
}

function missingResources(
  wallet: ResourceWallet,
  cost: ResourceCost,
): ResourceCost {
  return {
    money: Math.max(0, cost.money - wallet.money),
    oil: Math.max(0, cost.oil - wallet.oil),
    materials: Math.max(0, cost.materials - wallet.materials),
  }
}

function blocked(
  reason: UpgradeBlockReason,
  targetLevel: number | null = null,
  cost: ResourceCost | null = null,
  wallet?: ResourceWallet,
): UpgradeDecision {
  return {
    reason,
    targetLevel,
    cost,
    missingResources:
      cost && wallet ? missingResources(wallet, cost) : { ...noMissing },
  }
}

export function getChildUpgradeDecision(
  input: ChildUpgradeDecisionInput,
): UpgradeDecision {
  const { buildingId, childIndex, progress, wallet, gangLevel } = input
  if (!isBuildingUnlocked(buildingId, gangLevel)) {
    return blocked('building-locked')
  }

  const childLevel = progress.childLevels[childIndex]
  if (childLevel >= progress.level) {
    return blocked('child-at-main-level')
  }

  const targetLevel = childLevel + 1
  const cost =
    economyConfig.childUpgradeCostByTargetLevel[targetLevel as BuildingLevel]
  if (!canAfford(wallet, cost)) {
    return blocked('insufficient-resources', targetLevel, cost, wallet)
  }

  return blocked('ready', targetLevel, cost, wallet)
}

export function getMainUpgradeDecision(
  input: MainUpgradeDecisionInput,
): UpgradeDecision {
  const { buildingId, progress, clubhouseProgress, wallet, gangLevel } = input
  if (!isBuildingUnlocked(buildingId, gangLevel)) {
    return blocked('building-locked')
  }

  if (progress.level >= getBuildingMaxLevel(buildingId)) {
    return blocked('building-maxed')
  }

  if (getCaughtUpChildCount(progress) !== progress.childLevels.length) {
    return blocked('children-not-caught-up')
  }

  const targetLevel = (progress.level + 1) as BuildingLevel
  if (
    buildingId !== 'clubhouse' &&
    !isBuildingUnlocked('clubhouse', gangLevel)
  ) {
    return blocked('clubhouse-locked', targetLevel)
  }

  if (buildingId !== 'clubhouse' && targetLevel > clubhouseProgress.level) {
    return blocked('clubhouse-too-low', targetLevel)
  }

  const cost = economyConfig.buildingUpgradeCostByTargetLevel[targetLevel]
  if (!cost || !canAfford(wallet, cost)) {
    return blocked('insufficient-resources', targetLevel, cost ?? null, wallet)
  }

  return blocked('ready', targetLevel, cost, wallet)
}
