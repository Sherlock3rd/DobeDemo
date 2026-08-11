import { describe, expect, it } from 'vitest'
import {
  STORY_COMPLETE_STEP,
  STORY_RANKS,
  STORY_STEPS,
  getStoryClaimBuilding,
  getStoryRank,
  getStoryVisibility,
} from './storyPlanB'

describe('Plan B story progression', () => {
  it('contains the complete 43-node, 6-act route', () => {
    expect(STORY_STEPS).toHaveLength(43)
    expect(STORY_COMPLETE_STEP).toBe(44)
    expect(STORY_STEPS.map((step) => step.number)).toEqual(
      Array.from({ length: 43 }, (_, index) => index + 1),
    )
    expect(new Set(STORY_STEPS.map((step) => step.act))).toEqual(
      new Set([0, 1, 2, 3, 4, 5]),
    )
  })

  it('maps all ten Plan B ranks onto existing system levels', () => {
    expect(STORY_RANKS).toHaveLength(10)
    expect(getStoryRank(1).title).toBe('Prospect')
    expect(getStoryRank(11).title).toBe('Full Patch')
    expect(getStoryRank(23).title).toBe('Enforcer')
    expect(getStoryRank(44).title).toBe('President')
    expect(STORY_RANKS.map((rank) => rank.systemLevel)).toEqual([
      1, 8, 16, 24, 32, 40, 42, 44, 46, 50,
    ])
  })

  it('releases buildings in the intended management order', () => {
    expect([11, 23, 28, 32, 36].map(getStoryClaimBuilding)).toEqual([
      'repair-shop',
      'recycling-yard',
      'commercial-street',
      'gas-station',
      'metalworking-plant',
    ])
    expect(getStoryClaimBuilding(22)).toBeNull()
  })

  it('gates early Plan B people and buildings behind explicit photo-wall clicks', () => {
    expect(STORY_STEPS[10].action).toMatchObject({
      kind: 'gang-tree',
      rewardId: 'repair-shop-vacancy',
      buildingId: 'repair-shop',
    })
    expect(STORY_STEPS[12].action).toMatchObject({
      kind: 'gang-tree',
      rewardId: 'eddie-operator',
    })
    expect(STORY_STEPS[22].action).toMatchObject({
      kind: 'gang-tree',
      rewardId: 'freddie-yard-manager',
      buildingId: 'recycling-yard',
    })
    expect(STORY_STEPS[24].action).toMatchObject({
      kind: 'gang-tree',
      rewardId: 'maeve-hero',
    })
  })

  it('reveals HUD systems only when the story reaches them', () => {
    expect(getStoryVisibility(1)).toMatchObject({
      heroes: false,
      gangTree: false,
      campaign: false,
      money: false,
    })
    expect(getStoryVisibility(8)).toMatchObject({
      heroes: false,
      gangTree: true,
      campaign: false,
      money: true,
    })
    expect(getStoryVisibility(25).heroes).toBe(true)
    expect(getStoryVisibility(26).campaign).toBe(true)
    expect(getStoryVisibility(34).oil).toBe(true)
    expect(getStoryVisibility(38).materials).toBe(true)
  })

  it('introduces the first combat hero before campaign and keeps Thomas out of the formation story', () => {
    const heroArrival = STORY_STEPS[24]
    const firstCampaign = STORY_STEPS[25]

    expect(heroArrival.title).toContain('Maeve')
    expect(heroArrival.kicker).toBe('首名英雄加入')
    expect(heroArrival.objective).toContain('首名英雄 Maeve “Red” Quinn')
    expect(firstCampaign.lines.join('')).toContain('不必亲自进入火线')
    expect(firstCampaign.objective).toContain('以 Maeve 为首名推关英雄')
  })

  it('places the customized 3D vehicle workshops into the Plan B route', () => {
    expect(STORY_STEPS[5].action).toEqual({
      kind: 'car-customize',
      scenario: 'repair-trio',
      label: '进入 3D 三车维修工位',
    })
    expect(STORY_STEPS[6].action).toEqual({
      kind: 'car-customize',
      scenario: 'tune-engine',
      label: '进入 3D 引擎强化工位',
    })
    expect(STORY_STEPS[14].action).toEqual({
      kind: 'car-dismantle',
      scenario: 'salvage-pair',
      label: '进入 3D 黑市车拆解台',
    })
    expect(STORY_STEPS[15].action).toEqual({
      kind: 'car-customize',
      scenario: 'race-prep',
      label: '进入 3D 赛前换件工位',
    })
    expect(STORY_STEPS[18].action).toEqual({
      kind: 'car-dismantle',
      scenario: 'pursuit-wreck',
      label: '致意后进入 3D 残车拆解台',
    })
    expect(STORY_STEPS[19].action).toEqual({
      kind: 'car-customize',
      scenario: 'revenge-build',
      label: '进入 3D 铁獠整备工位',
    })
    expect(STORY_STEPS).toHaveLength(43)
  })

  it('gives every story slide enough context to connect cause, action, and result', () => {
    for (const step of STORY_STEPS) {
      expect(
        step.lines.length,
        `L${step.number} dialogue lines`,
      ).toBeGreaterThanOrEqual(2)
      expect(step.objective.trim(), `L${step.number} objective`).not.toBe('')
      expect(step.action.label.trim(), `L${step.number} action`).not.toBe('')
    }
  })

  it('keeps Freddie the fallen yard manager distinct from Billy the traitor', () => {
    expect(STORY_STEPS[13].speaker).toBe('Freddie Thorne')
    expect(STORY_STEPS[17].speaker).toBe('Freddie Thorne')
    expect(STORY_STEPS[29].lines.join(' ')).toContain('Billy Kimber')
    expect(STORY_STEPS[29].lines.join(' ')).not.toContain('Freddie')
  })
})
