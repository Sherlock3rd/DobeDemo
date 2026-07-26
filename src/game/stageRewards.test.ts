import { describe, expect, it } from 'vitest'
import {
  getCampaignPartQualityWeights,
  getRacingPartQualityWeights,
  rollStageRewardPart,
} from './stageRewards'
import { CAR_PART_QUALITY_IDS } from './equipmentTypes'

describe('stageRewards', () => {
  it('returns no part when the chance roll misses', () => {
    expect(
      rollStageRewardPart({
        chance: 0.2,
        qualityWeights: getCampaignPartQualityWeights(1),
        nextPartSerial: 4,
        random: () => 0.99,
      }),
    ).toEqual({ part: null, nextPartSerial: 4 })
  })

  it('uses injected rolls for drop, slot, and quality', () => {
    const rolls = [0, 0.3, 0.99]
    expect(
      rollStageRewardPart({
        chance: 0.5,
        qualityWeights: getCampaignPartQualityWeights(20),
        nextPartSerial: 4,
        random: () => rolls.shift() ?? 0,
      }),
    ).toEqual({
      part: {
        id: 'part-4',
        slot: 'engine',
        quality: 'legendary',
        level: 1,
      },
      nextPartSerial: 5,
    })
  })

  it('uses the five-quality campaign weight table at every tier boundary', () => {
    const expected = [
      [1, [0.75, 0.15, 0.1, 0, 0]],
      [5, [0.75, 0.15, 0.1, 0, 0]],
      [6, [0.45, 0.2, 0.25, 0.1, 0]],
      [10, [0.45, 0.2, 0.25, 0.1, 0]],
      [11, [0.25, 0.2, 0.3, 0.2, 0.05]],
      [15, [0.25, 0.2, 0.3, 0.2, 0.05]],
      [16, [0.1, 0.15, 0.3, 0.3, 0.15]],
      [20, [0.1, 0.15, 0.3, 0.3, 0.15]],
    ] as const

    expected.forEach(([stage, weights]) => {
      const actual = getCampaignPartQualityWeights(stage)
      expect(CAR_PART_QUALITY_IDS.map((id) => actual[id])).toEqual(weights)
    })
  })

  it('uses the five-quality racing weight table at every tier boundary', () => {
    const expected = [
      [1, [0.75, 0.15, 0.1, 0, 0]],
      [2, [0.75, 0.15, 0.1, 0, 0]],
      [3, [0.55, 0.2, 0.2, 0.05, 0]],
      [4, [0.55, 0.2, 0.2, 0.05, 0]],
      [5, [0.35, 0.2, 0.25, 0.15, 0.05]],
      [6, [0.35, 0.2, 0.25, 0.15, 0.05]],
      [7, [0.2, 0.2, 0.3, 0.2, 0.1]],
      [8, [0.2, 0.2, 0.3, 0.2, 0.1]],
      [9, [0.08, 0.12, 0.28, 0.32, 0.2]],
      [10, [0.08, 0.12, 0.28, 0.32, 0.2]],
    ] as const

    expected.forEach(([stage, weights]) => {
      const actual = getRacingPartQualityWeights(stage)
      expect(CAR_PART_QUALITY_IDS.map((id) => actual[id])).toEqual(weights)
    })
  })
})
