import { getMainUpgradeDurationMs } from './buildingUpgrade'
import type { PendingMainUpgrade } from './cityTypes'

export interface BuildingUpgradeDisplay {
  progressPercent: number
  remainingMs: number
  remainingLabel: string
}

export function formatMainUpgradeRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) return `${seconds}秒`
  return `${minutes}分${String(seconds).padStart(2, '0')}秒`
}

export function getBuildingUpgradeDisplay(
  task: PendingMainUpgrade,
  now: number,
): BuildingUpgradeDisplay {
  const durationMs = getMainUpgradeDurationMs(task.targetLevel)
  const safeNow = Number.isFinite(now) ? now : task.completesAt - durationMs
  const remainingMs = Math.min(
    durationMs,
    Math.max(0, task.completesAt - safeNow),
  )
  const elapsedMs = Math.min(durationMs, Math.max(0, durationMs - remainingMs))
  const progressPercent = Math.round((elapsedMs / durationMs) * 100)

  return {
    progressPercent,
    remainingMs,
    remainingLabel: formatMainUpgradeRemaining(remainingMs),
  }
}
