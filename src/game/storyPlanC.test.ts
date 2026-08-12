import { describe, expect, it } from 'vitest'
import {
  STORY_COMPLETE_STEP,
  STORY_RANKS,
  STORY_STEPS,
  getStoryClaimBuilding,
  getStoryRank,
  getStoryReputation,
  getStoryVisibility,
} from './storyPlanC'

describe('Plan C story progression', () => {
  it('contains the complete 42-node, 6-act route', () => {
    expect(STORY_STEPS).toHaveLength(42)
    expect(STORY_COMPLETE_STEP).toBe(43)
    expect(STORY_STEPS.map((step) => step.number)).toEqual(
      Array.from({ length: 42 }, (_, index) => index + 1),
    )
    expect(new Set(STORY_STEPS.map((step) => step.act))).toEqual(
      new Set([0, 1, 2, 3, 4, 5]),
    )
  })

  it('maps all ten Plan C ranks and exact reputation thresholds', () => {
    expect(STORY_RANKS).toHaveLength(10)
    expect(STORY_RANKS.map((rank) => rank.startsAtStep)).toEqual([
      1, 11, 21, 27, 31, 35, 38, 39, 41, 43,
    ])
    expect(STORY_RANKS.map((rank) => rank.systemLevel)).toEqual([
      1, 8, 16, 24, 32, 40, 42, 44, 46, 50,
    ])
    expect(STORY_RANKS.map((rank) => rank.reputationThreshold)).toEqual([
      0, 100, 300, 650, 1_100, 1_700, 2_400, 3_200, 4_200, 5_500,
    ])
    for (const rank of STORY_RANKS) {
      expect(getStoryReputation(rank.startsAtStep)).toBe(
        rank.reputationThreshold,
      )
    }
  })

  it('releases buildings in the Plan C management order', () => {
    expect([13, 21, 27, 31, 35].map(getStoryClaimBuilding)).toEqual([
      'repair-shop',
      'recycling-yard',
      'commercial-street',
      'gas-station',
      'metalworking-plant',
    ])
    expect(getStoryClaimBuilding(12)).toBeNull()
  })

  it('gates the early N-1 rewards behind explicit photo-wall clicks', () => {
    expect(STORY_STEPS[12].action).toMatchObject({
      kind: 'gang-tree',
      rewardId: 'hugo-garage-manager',
      buildingId: 'repair-shop',
    })
    expect(STORY_STEPS[13].action).toMatchObject({
      kind: 'gang-tree',
      rewardId: 'prospect-wreck-runner',
    })
    expect(STORY_STEPS[20].action).toMatchObject({
      kind: 'gang-tree',
      rewardId: 'walter-yard-manager',
      buildingId: 'recycling-yard',
    })
  })

  it('reveals systems only when Plan C reaches them', () => {
    expect(getStoryVisibility(1)).toMatchObject({
      heroes: false,
      gangTree: false,
      campaign: false,
      money: false,
    })
    expect(getStoryVisibility(4).gangTree).toBe(true)
    expect(getStoryVisibility(23).heroes).toBe(true)
    expect(getStoryVisibility(24).campaign).toBe(true)
    expect(getStoryVisibility(28).money).toBe(true)
    expect(getStoryVisibility(32).oil).toBe(true)
    expect(getStoryVisibility(36).materials).toBe(true)
  })

  it('introduces Maeve before campaign and keeps Thomas outside the formation', () => {
    const heroArrival = STORY_STEPS[22]
    const firstCampaign = STORY_STEPS[23]

    expect(heroArrival.speaker).toContain('Maeve')
    expect(heroArrival.objective).toContain('首名英雄 Maeve')
    expect(firstCampaign.lines.join('')).toContain('Thomas 留在后方')
    expect(firstCampaign.objective).toContain('Maeve 为首名推关英雄')
  })

  it('places the custom 3D dismantle and modification jobs in the opening', () => {
    expect(STORY_STEPS[5].action).toMatchObject({
      kind: 'car-dismantle',
      scenario: 'salvage-single',
    })
    expect(STORY_STEPS[6].action).toMatchObject({
      kind: 'car-customize',
      scenario: 'nitrous-install',
    })
    expect(STORY_STEPS[14].action).toMatchObject({
      kind: 'car-dismantle',
      scenario: 'salvage-single',
    })
    expect(STORY_STEPS[15].action).toMatchObject({
      kind: 'car-customize',
      scenario: 'race-prep',
    })
  })

  it('gives every slide cause, action, objective, and reputation data', () => {
    for (const step of STORY_STEPS) {
      expect(
        step.lines.length,
        `L${step.number} dialogue`,
      ).toBeGreaterThanOrEqual(2)
      expect(step.objective.trim(), `L${step.number} objective`).not.toBe('')
      expect(step.action.label.trim(), `L${step.number} action`).not.toBe('')
      expect(step.reputationReward).toBeGreaterThanOrEqual(0)
    }
  })

  it('switches ranks only after the matching promotion event', () => {
    expect(getStoryRank(10).title).toBe('Prospect')
    expect(getStoryRank(11).title).toBe('Full Patch')
    expect(getStoryRank(42).title).toBe('Vice President')
    expect(getStoryRank(43).title).toBe('President')
  })

  it('has enough reputation when every photo-wall promotion becomes clickable', () => {
    const promotionSteps = [10, 20, 26, 34, 42]
    for (const stepNumber of promotionSteps) {
      const action = STORY_STEPS[stepNumber - 1].action
      expect(action.kind).toBe('gang-tree')
      if (action.kind !== 'gang-tree' || !action.promotionTier) continue
      const targetRank = STORY_RANKS[action.promotionTier - 1]
      expect(getStoryReputation(stepNumber)).toBeGreaterThanOrEqual(
        targetRank.reputationThreshold,
      )
    }
  })
})
