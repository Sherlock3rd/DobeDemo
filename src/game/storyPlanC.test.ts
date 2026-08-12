import { describe, expect, it } from 'vitest'
import {
  STORY_COMPLETE_STEP,
  STORY_RANKS,
  STORY_STEPS,
  getStoryClaimBuilding,
  getStoryClaimBuildings,
  getStoryRank,
  getStoryReputation,
  getStoryVisibility,
} from './storyPlanC'

describe('latest Plan C story progression', () => {
  it('contains the complete 44-node, 7-act route', () => {
    expect(STORY_STEPS).toHaveLength(44)
    expect(STORY_COMPLETE_STEP).toBe(45)
    expect(STORY_STEPS.map((step) => step.number)).toEqual(
      Array.from({ length: 44 }, (_, index) => index + 1),
    )
    expect(new Set(STORY_STEPS.map((step) => step.act))).toEqual(
      new Set([0, 1, 2, 3, 4, 5, 6]),
    )
  })

  it('maps all ten ranks after their matching promotion nodes', () => {
    expect(STORY_RANKS.map((rank) => rank.startsAtStep)).toEqual([
      1, 9, 20, 28, 32, 37, 40, 41, 43, 45,
    ])
    expect(STORY_RANKS.map((rank) => rank.reputationThreshold)).toEqual([
      0, 100, 300, 650, 1_100, 1_700, 2_400, 3_200, 4_200, 5_500,
    ])
    for (const rank of STORY_RANKS) {
      expect(getStoryReputation(rank.startsAtStep)).toBeGreaterThanOrEqual(
        rank.reputationThreshold,
      )
    }
    expect([8, 19, 27, 31, 36, 39, 40, 42, 44].map(getStoryReputation)).toEqual(
      [100, 300, 650, 1_100, 1_700, 2_400, 3_200, 4_200, 5_500],
    )
  })

  it('models the L20 parallel window and both complete branch chains', () => {
    expect(STORY_STEPS[19].action).toMatchObject({ kind: 'parallel-choice' })
    expect(STORY_STEPS.slice(20, 23).map((step) => step.title)).toEqual([
      '产业线·收复两名管理者',
      '产业线·任意顺序接管两座建筑',
      '产业线·废车厂自动化',
    ])
    expect(STORY_STEPS.slice(23, 26).map((step) => step.title)).toEqual([
      '调查线·收复英雄 NPC',
      '调查线·首次推关寻找线索',
      '调查线·挡风玻璃逼问',
    ])
  })

  it('requires both L22 buildings and keeps later claims in source order', () => {
    expect(getStoryClaimBuildings(22)).toEqual([
      'repair-shop',
      'recycling-yard',
    ])
    expect(getStoryClaimBuilding(22)).toBeNull()
    expect([32, 34, 37].map(getStoryClaimBuilding)).toEqual([
      'commercial-street',
      'gas-station',
      'metalworking-plant',
    ])
  })

  it('keeps N-1 rewards behind explicit photo-wall clicks', () => {
    expect(STORY_STEPS[9].action).toMatchObject({
      kind: 'gang-tree',
      rewardId: 'hugo-garage-manager',
    })
    expect(STORY_STEPS[20].action).toMatchObject({
      kind: 'gang-tree',
      rewardId: 'walter-yard-manager',
    })
    expect(STORY_STEPS[33].action).toMatchObject({
      kind: 'gang-tree',
      rewardId: 'spencer-gas-manager',
      buildingId: 'gas-station',
    })
  })

  it('keeps the blond ally alive at L17', () => {
    const returnStep = STORY_STEPS[16]
    expect(returnStep.title).toContain('与金发一起返城')
    expect(returnStep.lines.join('')).toContain('一起回城')
    expect(returnStep.artwork).not.toBe('blond-sacrifice')
  })

  it('reveals systems only when the latest route reaches them', () => {
    expect(getStoryVisibility(1)).toMatchObject({
      heroes: false,
      gangTree: false,
      campaign: false,
      money: false,
    })
    expect(getStoryVisibility(7).gangTree).toBe(true)
    expect(getStoryVisibility(24).heroes).toBe(true)
    expect(getStoryVisibility(25).campaign).toBe(true)
    expect(getStoryVisibility(33).money).toBe(true)
    expect(getStoryVisibility(35).oil).toBe(true)
    expect(getStoryVisibility(38).materials).toBe(true)
  })

  it('places the required 3D workshop jobs in the revised opening', () => {
    expect(STORY_STEPS[4].action).toMatchObject({
      kind: 'car-customize',
      scenario: 'nitrous-install',
    })
    expect(STORY_STEPS[12].action).toMatchObject({
      kind: 'car-dismantle',
      scenario: 'salvage-pair',
    })
    expect(STORY_STEPS[13].action).toMatchObject({
      kind: 'car-customize',
      scenario: 'repair-trio',
    })
  })

  it('gives every slide cause, action, objective, and reputation data', () => {
    for (const step of STORY_STEPS) {
      expect(step.lines.length).toBeGreaterThanOrEqual(2)
      expect(step.objective.trim()).not.toBe('')
      expect(step.action.label.trim()).not.toBe('')
      expect(step.reputationReward).toBeGreaterThanOrEqual(0)
    }
  })

  it('switches ranks only after the matching promotion event', () => {
    expect(getStoryRank(8).title).toBe('Prospect')
    expect(getStoryRank(9).title).toBe('Full Patch')
    expect(getStoryRank(44).title).toBe('Vice President')
    expect(getStoryRank(45).title).toBe('President')
  })
})
