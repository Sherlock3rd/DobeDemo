import {
  CAR_PART_QUALITY_INFO,
  pickWeighted,
  type RandomSource,
} from './equipmentProgression'
import {
  CAR_PART_QUALITY_IDS,
  CAR_PART_SLOT_IDS,
  type CarPartInstance,
  type CarPartQuality,
} from './equipmentTypes'

export type PartQualityWeights = Readonly<Record<CarPartQuality, number>>

const CAMPAIGN_WEIGHTS: readonly PartQualityWeights[] = [
  { common: 0.75, uncommon: 0.15, rare: 0.1, epic: 0, legendary: 0 },
  { common: 0.45, uncommon: 0.2, rare: 0.25, epic: 0.1, legendary: 0 },
  { common: 0.25, uncommon: 0.2, rare: 0.3, epic: 0.2, legendary: 0.05 },
  { common: 0.1, uncommon: 0.15, rare: 0.3, epic: 0.3, legendary: 0.15 },
]

const RACING_WEIGHTS: readonly PartQualityWeights[] = [
  { common: 0.75, uncommon: 0.15, rare: 0.1, epic: 0, legendary: 0 },
  { common: 0.55, uncommon: 0.2, rare: 0.2, epic: 0.05, legendary: 0 },
  {
    common: 0.35,
    uncommon: 0.2,
    rare: 0.25,
    epic: 0.15,
    legendary: 0.05,
  },
  { common: 0.2, uncommon: 0.2, rare: 0.3, epic: 0.2, legendary: 0.1 },
  {
    common: 0.08,
    uncommon: 0.12,
    rare: 0.28,
    epic: 0.32,
    legendary: 0.2,
  },
]

export function getCampaignPartQualityWeights(
  stage: number,
): PartQualityWeights {
  const tier = Math.min(3, Math.max(0, Math.floor((stage - 1) / 5)))
  return CAMPAIGN_WEIGHTS[tier]
}

export function getRacingPartQualityWeights(stage: number): PartQualityWeights {
  const tier = Math.min(4, Math.max(0, Math.floor((stage - 1) / 2)))
  return RACING_WEIGHTS[tier]
}

export function rollStageRewardPart(input: {
  chance: number
  qualityWeights: PartQualityWeights
  nextPartSerial: number
  random?: RandomSource
}): { part: CarPartInstance | null; nextPartSerial: number } {
  const random = input.random ?? Math.random
  const dropped = pickWeighted(
    [
      { value: true, weight: input.chance },
      { value: false, weight: 1 - input.chance },
    ],
    random,
  )
  if (!dropped) {
    return { part: null, nextPartSerial: input.nextPartSerial }
  }
  const slot = pickWeighted(
    CAR_PART_SLOT_IDS.map((value) => ({ value, weight: 1 })),
    random,
  )
  const quality = pickWeighted(
    CAR_PART_QUALITY_IDS.map((value) => ({
      value,
      weight: input.qualityWeights[value],
    })),
    random,
  )
  return {
    part: {
      id: `part-${input.nextPartSerial}`,
      slot,
      quality,
      level: 1,
    },
    nextPartSerial: input.nextPartSerial + 1,
  }
}

export function getRewardPartRecycleValue(part: CarPartInstance): number {
  return CAR_PART_QUALITY_INFO[part.quality].recycleBase
}
