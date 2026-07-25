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
  { worn: 0.85, tuned: 0.15, elite: 0, prototype: 0 },
  { worn: 0.6, tuned: 0.3, elite: 0.1, prototype: 0 },
  { worn: 0.35, tuned: 0.4, elite: 0.2, prototype: 0.05 },
  { worn: 0.15, tuned: 0.35, elite: 0.35, prototype: 0.15 },
]

const RACING_WEIGHTS: readonly PartQualityWeights[] = [
  { worn: 0.85, tuned: 0.15, elite: 0, prototype: 0 },
  { worn: 0.65, tuned: 0.3, elite: 0.05, prototype: 0 },
  { worn: 0.45, tuned: 0.35, elite: 0.15, prototype: 0.05 },
  { worn: 0.25, tuned: 0.4, elite: 0.25, prototype: 0.1 },
  { worn: 0.1, tuned: 0.3, elite: 0.4, prototype: 0.2 },
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
