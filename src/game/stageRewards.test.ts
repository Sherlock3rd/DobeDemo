import { describe, expect, it } from 'vitest'
import {
  getCampaignPartQualityWeights,
  getRacingPartQualityWeights,
  rollStageRewardPart,
} from './stageRewards'

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
        quality: 'prototype',
        level: 1,
      },
      nextPartSerial: 5,
    })
  })

  it('raises quality weights by campaign and racing tier', () => {
    expect(getCampaignPartQualityWeights(1).prototype).toBe(0)
    expect(getCampaignPartQualityWeights(20).prototype).toBe(0.15)
    expect(getRacingPartQualityWeights(1).prototype).toBe(0)
    expect(getRacingPartQualityWeights(10).prototype).toBe(0.2)
  })
})
