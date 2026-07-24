// Pure session-selection helpers for BuildingPanel, kept out of that file so
// it only exports the component (react-refresh/only-export-components).
import type { ResourceCost } from '../config/economyConfig'
import type { MainUpgradeDecision } from '../game/buildingUpgrade'
import type { BuildingLevel, BuildingProgress } from '../game/cityTypes'

export type MainUpgradeBlockReason = MainUpgradeDecision['reason']

export type BuildingPanelView =
  | { kind: 'details'; selectedChildIndex: number | null }
  | {
      kind: 'main-upgrade-confirm'
      selectedChildIndex: number | null
      actionReason: MainUpgradeBlockReason | null
    }

// Fixed order 钱 → 油 → 物资; zero entries are omitted and an all-zero cost
// reads as free. Used for shortfall hints and shared-button cost suffixes.
export function formatNonZeroCost(cost: ResourceCost): string {
  const parts: string[] = []
  if (cost.money > 0) {
    parts.push(`钱 ${cost.money}`)
  }
  if (cost.oil > 0) {
    parts.push(`油 ${cost.oil}`)
  }
  if (cost.materials > 0) {
    parts.push(`物资 ${cost.materials}`)
  }
  return parts.length === 0 ? '免费' : parts.join(' · ')
}

// The first unlocked, not-yet-caught-up slot in blueprint order, or null once
// every unlocked slot has reached the current main level.
export function findDefaultChildIndex(
  progress: BuildingProgress,
  unlockedChildCount: number,
): number | null {
  for (let index = 0; index < unlockedChildCount; index += 1) {
    if ((progress.childLevels[index] ?? 0) < progress.level) {
      return index
    }
  }
  return null
}

// Searches forward from just after `afterIndex`, wrapping through the
// unlocked prefix exactly once, for the next slot that has not caught up.
export function findNextIncompleteChildIndex(
  progress: BuildingProgress,
  unlockedChildCount: number,
  afterIndex: number,
): number | null {
  if (unlockedChildCount <= 0) {
    return null
  }
  for (let offset = 1; offset <= unlockedChildCount; offset += 1) {
    const index = (afterIndex + offset) % unlockedChildCount
    if ((progress.childLevels[index] ?? 0) < progress.level) {
      return index
    }
  }
  return null
}

// Exact confirmation-page copy. `mainLevel` is the building's *current* main
// level: children-not-caught-up fires before a target level is computed, so
// the message must reference the level children still need to reach rather
// than `decision.targetLevel` (which is null for that reason).
export function mainUpgradeBlockerMessage(
  decision: MainUpgradeDecision,
  mainLevel: BuildingLevel,
): string | null {
  switch (decision.reason) {
    case 'children-not-caught-up':
      return `请先将当前已解锁子建筑全部提升至 Lv.${mainLevel}`
    case 'repair-shop-too-low':
      return `需要先将修车厂提升至 Lv.${decision.requiredBuildingLevel}`
    case 'clubhouse-locked':
      return '需要先将帮派树提升至 Lv.40 解锁 Clubhouse'
    case 'clubhouse-too-low':
      return `需要先将 Clubhouse 提升至 Lv.${decision.requiredBuildingLevel}`
    case 'building-maxed':
      return '已达到最高等级 Lv.10'
    case 'insufficient-resources':
      return `资源不足，还需 ${formatNonZeroCost(decision.missingResources)}`
    default:
      return null
  }
}
