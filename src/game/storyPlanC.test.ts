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
  it('contains the complete 43-node, 7-act route', () => {
    expect(STORY_STEPS).toHaveLength(43)
    expect(STORY_COMPLETE_STEP).toBe(44)
    expect(STORY_STEPS.map((step) => step.number)).toEqual(
      Array.from({ length: 43 }, (_, index) => index + 1),
    )
    expect(new Set(STORY_STEPS.map((step) => step.act))).toEqual(
      new Set([0, 1, 2, 3, 4, 5, 6]),
    )
  })

  it('maps all ten ranks after their matching promotion nodes', () => {
    expect(STORY_RANKS.map((rank) => rank.startsAtStep)).toEqual([
      1, 9, 18, 26, 31, 36, 39, 40, 42, 44,
    ])
    expect(STORY_RANKS.map((rank) => rank.reputationThreshold)).toEqual([
      0, 100, 300, 650, 1_100, 1_700, 2_400, 3_200, 4_200, 5_500,
    ])
    for (const rank of STORY_RANKS) {
      expect(getStoryReputation(rank.startsAtStep)).toBeGreaterThanOrEqual(
        rank.reputationThreshold,
      )
    }
    expect([8, 17, 25, 30, 35, 38, 39, 41, 43].map(getStoryReputation)).toEqual(
      [100, 300, 650, 1_100, 1_700, 2_400, 3_200, 4_200, 5_500],
    )
  })

  it('models the L18 parallel window and both complete branch chains', () => {
    expect(STORY_STEPS[17].action).toMatchObject({ kind: 'parallel-choice' })
    expect(STORY_STEPS.slice(18, 21).map((step) => step.title)).toEqual([
      '产业线·确认两名管理者交接',
      '产业线·任意顺序接管两座建筑',
      '产业线·废车厂自动化',
    ])
    expect(STORY_STEPS.slice(21, 24).map((step) => step.title)).toEqual([
      '调查线·获得英雄协助',
      '调查线·首次推关寻找线索',
      '调查线·挡风玻璃逼问',
    ])
  })

  it('requires both L20 buildings and keeps later claims in source order', () => {
    expect(getStoryClaimBuildings(20)).toEqual([
      'repair-shop',
      'recycling-yard',
    ])
    expect(getStoryClaimBuilding(20)).toBeNull()
    expect([31, 33, 36].map(getStoryClaimBuilding)).toEqual([
      'commercial-street',
      'gas-station',
      'metalworking-plant',
    ])
  })

  it('keeps N-1 rewards behind explicit photo-wall clicks', () => {
    expect(STORY_STEPS[18].action).toMatchObject({
      kind: 'gang-tree',
      rewardIds: ['hugo-garage-manager', 'walter-yard-manager'],
    })
    expect(STORY_STEPS[32].action).toMatchObject({
      kind: 'gang-tree',
      rewardId: 'spencer-gas-manager',
      buildingId: 'gas-station',
    })
  })

  it('keeps the blond ally alive at L15', () => {
    const returnStep = STORY_STEPS[14]
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
    expect(getStoryVisibility(22).heroes).toBe(true)
    expect(getStoryVisibility(23).campaign).toBe(true)
    expect(getStoryVisibility(32).money).toBe(true)
    expect(getStoryVisibility(34).oil).toBe(true)
    expect(getStoryVisibility(37).materials).toBe(true)
  })

  it('places the required 3D workshop jobs in the revised opening', () => {
    expect(STORY_STEPS[4].action).toMatchObject({
      kind: 'car-customize',
      scenario: 'nitrous-install',
    })
    expect(STORY_STEPS[10].action).toMatchObject({
      kind: 'car-dismantle',
      scenario: 'salvage-pair',
    })
    expect(STORY_STEPS[11].action).toMatchObject({
      kind: 'car-customize',
      scenario: 'repair-trio',
    })
  })

  it('uses the revised operation order without the old early handover', () => {
    expect(STORY_STEPS[8].title).toContain('爆炸')
    expect(STORY_STEPS[8].action.kind).toBe('continue')
    expect(STORY_STEPS[9].action.kind).toBe('wreck-collection')
    expect(STORY_STEPS[25].title).toContain('抢走')
    expect(STORY_STEPS[5].action).toMatchObject({ kind: 'race', stage: 3 })
    expect(STORY_STEPS[13].action).toMatchObject({ kind: 'race', stage: 4 })
    expect(STORY_STEPS[37].action).toMatchObject({ kind: 'race', stage: 7 })
    expect(STORY_STEPS[38].action).toMatchObject({
      kind: 'campaign',
      followUpRaceStage: 8,
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
    expect(getStoryRank(43).title).toBe('Vice President')
    expect(getStoryRank(44).title).toBe('President')
  })
})
