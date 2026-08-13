import { describe, expect, it } from 'vitest'
import {
  getRacingStage,
  isRacingStageUnlocked,
  racingConfig,
} from './racingConfig'

describe('racingConfig', () => {
  it('defines the Plan C story order of race and pursuit stages', () => {
    expect(racingConfig.stages).toHaveLength(10)
    expect(racingConfig.stages.map((stage) => stage.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
    expect(racingConfig.stages.map((stage) => stage.mode)).toEqual([
      'race',
      'pursuit',
      'race',
      'pursuit',
      'pursuit',
      'pursuit',
      'pursuit',
      'race',
      'race',
      'race',
    ])
    expect(
      racingConfig.stages
        .filter((stage) => stage.mode === 'race')
        .map((stage) => stage.distance),
    ).toEqual([3_500, 3_950, 4_450, 4_725, 5_000])
    expect(
      racingConfig.stages
        .filter((stage) => stage.mode === 'race')
        .map((stage) => stage.opponentSpeeds),
    ).toEqual([
      [30, 32, 34],
      [37, 39, 41],
      [46, 48, 50],
      [44, 46, 48],
      [46, 49, 52],
    ])
    expect(
      racingConfig.stages
        .filter((stage) => stage.mode === 'race')
        .map((stage) => [stage.opponentCount, stage.clearMaxRank]),
    ).toEqual([
      [6, 3],
      [1, 1],
      [6, 3],
      [6, 3],
      [6, 3],
    ])
    expect(racingConfig.stages.map((stage) => stage.requiredPartLevel)).toEqual(
      [0, 0, 0, 0, 0, 2, 3, 2, 3, 4],
    )
    for (const stage of racingConfig.stages) {
      if (stage.mode === 'race') {
        expect(stage.durationMs).toBe(85_000)
        expect(stage.distance).toBeGreaterThanOrEqual(3_500)
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
      [600, 0.3],
      [450, 0.3],
      [750, 0.4],
      [900, 0.4],
      [1_200, 0.5],
      [1_050, 0.5],
      [1_350, 0.6],
      [1_500, 0.6],
    ])
  })

  it('configures Plan C pursuit escort counts', () => {
    expect(
      [2, 4, 5, 6, 7].map(
        (stage) =>
          (
            getRacingStage(stage) as unknown as {
              escortCount?: number
            }
          ).escortCount,
      ),
    ).toEqual([0, 0, 1, 1, 2])
  })
})
