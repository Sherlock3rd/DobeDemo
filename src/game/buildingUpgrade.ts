import {
  economyConfig,
  type ResourceCost,
  type ResourceWallet,
} from '../config/economyConfig'
import { EMPTY_WALLET, canAfford } from './resourceEconomy'
import { isBuildingUnlocked } from './gangProgression'
import {
  type BuildingId,
  type BuildingLevel,
  type BuildingProgress,
} from './cityTypes'

export const BUILDING_MAX_LEVEL = 10

export interface BuildingUpgradeProgress {
  unlockedChildCount: number
  completedSteps: number
  totalSteps: number
  ratio: number
  percent: number
  complete: boolean
}

export type ChildUpgradeBlockReason =
  | 'ready'
  | 'building-locked'
  | 'child-locked'
  | 'child-at-main-level'
  | 'insufficient-resources'

export interface ChildUpgradeDecisionInput {
  buildingId: BuildingId
  childIndex: number
  progress: BuildingProgress
  wallet: ResourceWallet
  gangLevel: number
}

export interface ChildUpgradeDecision {
  reason: ChildUpgradeBlockReason
  targetLevel: BuildingLevel | null
  cost: ResourceCost | null
  missingResources: ResourceCost
}

export type MainUpgradeBlockReason =
  | 'ready'
  | 'building-locked'
  | 'building-maxed'
  | 'children-not-caught-up'
  | 'repair-shop-too-low'
  | 'clubhouse-locked'
  | 'clubhouse-too-low'
  | 'insufficient-resources'

export interface MainUpgradeDecision {
  reason: MainUpgradeBlockReason
  targetLevel: BuildingLevel | null
  cost: ResourceCost | null
  missingResources: ResourceCost
  requiredBuildingId: BuildingId | null
  requiredBuildingLevel: BuildingLevel | null
}

export interface MainUpgradeDecisionInput {
  buildingId: BuildingId
  progress: BuildingProgress
  repairShopProgress: BuildingProgress
  clubhouseProgress: BuildingProgress
  wallet: ResourceWallet
  gangLevel: number
}

export function getBuildingChildCount(id: BuildingId): 5 | 10 {
  return id === 'repair-shop' ? 5 : 10
}

export function getUnlockedChildCount(
  id: BuildingId,
  mainLevel: BuildingLevel,
): number {
  return id === 'repair-shop' ? Math.min(mainLevel, 5) : mainLevel
}

export function getBuildingUpgradeProgress(
  buildingId: BuildingId,
  progress: BuildingProgress,
): BuildingUpgradeProgress {
  const unlockedChildCount = getUnlockedChildCount(buildingId, progress.level)
  const completedSteps = progress.childLevels
    .slice(0, unlockedChildCount)
    .reduce<number>(
      (sum, level) => sum + Math.min(progress.level, Math.max(0, level)),
      0,
    )
  const totalSteps = unlockedChildCount * progress.level
  const ratio = totalSteps <= 0 ? 0 : Math.min(1, completedSteps / totalSteps)
  return {
    unlockedChildCount,
    completedSteps,
    totalSteps,
    ratio,
    percent: ratio * 100,
    complete: totalSteps > 0 && completedSteps === totalSteps,
  }
}

function getMissingResources(
  cost: ResourceCost,
  wallet?: ResourceWallet,
): ResourceCost {
  if (!wallet) {
    return { ...EMPTY_WALLET }
  }
  return {
    money: Math.max(0, cost.money - wallet.money),
    oil: Math.max(0, cost.oil - wallet.oil),
    materials: Math.max(0, cost.materials - wallet.materials),
  }
}

function childDecision(
  reason: ChildUpgradeBlockReason,
  targetLevel: BuildingLevel | null = null,
  cost: ResourceCost | null = null,
  wallet?: ResourceWallet,
): ChildUpgradeDecision {
  return {
    reason,
    targetLevel,
    cost,
    missingResources: cost
      ? getMissingResources(cost, wallet)
      : { ...EMPTY_WALLET },
  }
}

export function getChildUpgradeDecision(
  input: ChildUpgradeDecisionInput,
): ChildUpgradeDecision {
  const { buildingId, childIndex, progress, wallet, gangLevel } = input
  if (!isBuildingUnlocked(buildingId, gangLevel)) {
    return childDecision('building-locked')
  }

  if (
    !Number.isInteger(childIndex) ||
    childIndex < 0 ||
    childIndex >= getBuildingChildCount(buildingId) ||
    childIndex >= getUnlockedChildCount(buildingId, progress.level)
  ) {
    return childDecision('child-locked')
  }

  const childLevel = progress.childLevels[childIndex]
  if (childLevel === undefined) {
    return childDecision('child-locked')
  }
  if (childLevel >= progress.level) {
    return childDecision('child-at-main-level')
  }

  const targetLevel = (childLevel + 1) as BuildingLevel
  const cost = economyConfig.childUpgradeCostByTargetLevel[targetLevel]
  if (!cost) {
    throw new Error(
      `Invalid economy config: childUpgradeCostByTargetLevel.${targetLevel}`,
    )
  }
  if (!canAfford(wallet, cost)) {
    return childDecision('insufficient-resources', targetLevel, cost, wallet)
  }

  return childDecision('ready', targetLevel, cost, wallet)
}

function blocked(
  reason: MainUpgradeBlockReason,
  targetLevel: BuildingLevel | null = null,
  cost: ResourceCost | null = null,
  requiredBuildingId: BuildingId | null = null,
  requiredBuildingLevel: BuildingLevel | null = null,
  wallet?: ResourceWallet,
): MainUpgradeDecision {
  const missingResources =
    cost && wallet
      ? {
          money: Math.max(0, cost.money - wallet.money),
          oil: Math.max(0, cost.oil - wallet.oil),
          materials: Math.max(0, cost.materials - wallet.materials),
        }
      : { ...EMPTY_WALLET }
  return {
    reason,
    targetLevel,
    cost,
    missingResources,
    requiredBuildingId,
    requiredBuildingLevel,
  }
}

export function getMainUpgradeDecision(
  input: MainUpgradeDecisionInput,
): MainUpgradeDecision {
  const {
    buildingId,
    progress,
    repairShopProgress,
    clubhouseProgress,
    wallet,
    gangLevel,
  } = input
  if (!isBuildingUnlocked(buildingId, gangLevel)) {
    return blocked('building-locked')
  }

  if (progress.level >= BUILDING_MAX_LEVEL) {
    return blocked('building-maxed')
  }

  if (!getBuildingUpgradeProgress(buildingId, progress).complete) {
    return blocked('children-not-caught-up')
  }

  const targetLevel = (progress.level + 1) as BuildingLevel
  if (
    targetLevel <= 5 &&
    buildingId !== 'repair-shop' &&
    buildingId !== 'clubhouse' &&
    targetLevel > repairShopProgress.level
  ) {
    return blocked(
      'repair-shop-too-low',
      targetLevel,
      null,
      'repair-shop',
      targetLevel,
    )
  }

  if (targetLevel >= 6 && buildingId !== 'clubhouse') {
    if (!isBuildingUnlocked('clubhouse', gangLevel)) {
      return blocked('clubhouse-locked', targetLevel, null, 'clubhouse', null)
    }
    if (targetLevel > clubhouseProgress.level) {
      return blocked(
        'clubhouse-too-low',
        targetLevel,
        null,
        'clubhouse',
        targetLevel,
      )
    }
  }

  const cost = economyConfig.buildingUpgradeCostByTargetLevel[targetLevel]
  if (!cost) {
    throw new Error(
      `Invalid economy config: buildingUpgradeCostByTargetLevel.${targetLevel}`,
    )
  }
  if (!canAfford(wallet, cost)) {
    return blocked(
      'insufficient-resources',
      targetLevel,
      cost,
      null,
      null,
      wallet,
    )
  }

  return blocked('ready', targetLevel, cost, null, null, wallet)
}
