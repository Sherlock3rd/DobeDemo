import { describe, expect, it } from 'vitest'
import {
  campaignConfig,
  getEnemyCount,
  getFirstClearReward,
  getStage,
  isStageUnlocked,
  parseCampaignConfig,
} from './campaignConfig'

describe('campaign config', () => {
  it('holds exactly 20 stages with monotonically increasing globals', () => {
    expect(campaignConfig.stages).toHaveLength(20)
    expect(campaignConfig.stages.map((s) => s.global)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    )
  })

  it('maps enemy counts by the §3.2 bands', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(getEnemyCount)).toEqual([
      1, 1, 1, 2, 2, 2, 2,
    ])
    expect([8, 11, 12, 15, 16, 20].map(getEnemyCount)).toEqual([
      3, 3, 4, 4, 5, 5,
    ])
    expect(() => getEnemyCount(0)).toThrow()
    expect(() => getEnemyCount(21)).toThrow()
  })

  it('materializes derived enemy curves and rewards', () => {
    expect(getStage(3).enemy).toEqual({ level: 2, hp: 560, atk: 94, def: 23 })
    expect(getStage(20).enemy).toEqual({
      level: 10,
      hp: 1920,
      atk: 298,
      def: 91,
    })
    expect(getFirstClearReward(1)).toBe(500)
    expect(getFirstClearReward(20)).toBe(10000)
    expect(getStage(1).id).toBe('1-1')
    expect(getStage(20).id).toBe('2-10')
  })

  it('unlocks only cleared stages and the next stage', () => {
    expect(isStageUnlocked(1, 0)).toBe(true)
    expect(isStageUnlocked(2, 0)).toBe(false)
    expect(isStageUnlocked(2, 1)).toBe(true)
    expect(isStageUnlocked(6, 5)).toBe(true)
    expect(isStageUnlocked(7, 5)).toBe(false)
  })

  it('rejects an enemyCount inconsistent with getEnemyCount', () => {
    const bad = structuredClone(campaignConfig) as unknown as Record<
      string,
      unknown
    >
    ;(bad.stages as Record<string, unknown>[])[0].enemyCount = 2
    expect(() => parseCampaignConfig(bad)).toThrow(
      'Invalid campaign config: stages.0.enemyCount',
    )
  })
})
