import { describe, expect, it } from 'vitest'
import {
  getRacingStage,
  isRacingStageUnlocked,
  racingConfig,
} from './racingConfig'

describe('racingConfig', () => {
  it('defines ten ordered alternating stages with extended race routes', () => {
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
    expect(
      racingConfig.stages
        .filter((stage) => stage.mode === 'race')
        .map((stage) => stage.distance),
    ).toEqual([4_650, 5_100, 5_550, 5_925, 6_300])
    for (const stage of racingConfig.stages) {
      if (stage.mode === 'race') {
        expect(stage.durationMs).toBe(85_000)
        expect(stage.distance).toBeGreaterThanOrEqual(3_100)
        expect(stage.opponentSpeeds).toHaveLength(3)
      } else {
        expect(stage.durationMs).toBeGreaterThanOrEqual(60_000)
        expect(stage.durationMs).toBeLessThanOrEqual(65_000)
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

  it('defines racing first-clears as exp, money, and two-stage part chances', () => {
    expect(getRacingStage(1)).toMatchObject({
      firstClearExp: 160,
      firstClearMoney: 150,
      partDropChance: 0.2,
    })
    expect(
      [2, 3, 4, 5, 6, 7, 8, 9, 10].map((stage) => {
        const definition = getRacingStage(stage) as unknown as Record<
          string,
          number
        >
        return [definition.firstClearMoney, definition.partDropChance]
      }),
    ).toEqual([
      [300, 0.2],
      [450, 0.3],
      [600, 0.3],
      [750, 0.4],
      [900, 0.4],
      [1_050, 0.5],
      [1_200, 0.5],
      [1_350, 0.6],
      [1_500, 0.6],
    ])
  })

  it('configures pursuit escort counts as 0, 1, 1, 2, 2', () => {
    expect(
      [2, 4, 6, 8, 10].map(
        (stage) =>
          (
            getRacingStage(stage) as unknown as {
              escortCount?: number
            }
          ).escortCount,
      ),
    ).toEqual([0, 1, 1, 2, 2])
  })
})
