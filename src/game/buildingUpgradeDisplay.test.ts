import { describe, expect, it } from 'vitest'
import type { PendingMainUpgrade } from './cityTypes'
import {
  formatMainUpgradeRemaining,
  getBuildingUpgradeDisplay,
} from './buildingUpgradeDisplay'

const task: PendingMainUpgrade = {
  buildingId: 'repair-shop',
  targetLevel: 3,
  completesAt: 120_000,
}

describe('building upgrade display', () => {
  it('derives a clamped percentage from the target-level duration', () => {
    expect(getBuildingUpgradeDisplay(task, 100_000)).toMatchObject({
      progressPercent: 0,
      remainingMs: 20_000,
      remainingLabel: '20秒',
    })
    expect(getBuildingUpgradeDisplay(task, 90_000)).toMatchObject({
      progressPercent: 0,
      remainingMs: 20_000,
      remainingLabel: '20秒',
    })
    expect(getBuildingUpgradeDisplay(task, 110_000)).toMatchObject({
      progressPercent: 50,
      remainingMs: 10_000,
      remainingLabel: '10秒',
    })
    expect(getBuildingUpgradeDisplay(task, 130_000)).toMatchObject({
      progressPercent: 100,
      remainingMs: 0,
      remainingLabel: '0秒',
    })
  })

  it('formats sub-minute and multi-minute countdowns', () => {
    expect(formatMainUpgradeRemaining(59_001)).toBe('1分00秒')
    expect(formatMainUpgradeRemaining(65_000)).toBe('1分05秒')
    expect(formatMainUpgradeRemaining(-1)).toBe('0秒')
  })
})
