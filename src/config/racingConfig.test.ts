import { describe, expect, it } from 'vitest'
import {
  getRacingStage,
  isRacingStageUnlocked,
  racingConfig,
} from './racingConfig'

describe('racingConfig', () => {
  it('defines ten ordered alternating one-minute stages', () => {
    expect(racingConfig.stages).toHaveLength(10)
    expect(racingConfig.stages.map((stage) => stage.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
    expect(racingConfig.stages.map((stage) => stage.mode)).toEqual([
      'race',
      'pursuit',
      'race',
      'pursuit',
      'race',
      'pursuit',
      'race',
      'pursuit',
      'race',
      'pursuit',
    ])
    for (const stage of racingConfig.stages) {
      expect(stage.durationMs).toBeGreaterThanOrEqual(60_000)
      expect(stage.durationMs).toBeLessThanOrEqual(65_000)
      if (stage.mode === 'race') {
        expect(stage.opponentSpeeds).toHaveLength(3)
      }
    }
  })

  it('only unlocks the exact next uncleared stage', () => {
    expect(isRacingStageUnlocked(1, 0)).toBe(true)
    expect(isRacingStageUnlocked(1, 1)).toBe(false)
    expect(isRacingStageUnlocked(3, 1)).toBe(false)
    expect(isRacingStageUnlocked(10, 9)).toBe(true)
    expect(isRacingStageUnlocked(11, 10)).toBe(false)
    expect(getRacingStage(10).order).toBe(10)
  })
})
