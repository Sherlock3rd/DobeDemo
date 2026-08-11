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

  it('reveals HUD systems only when the story reaches them', () => {
    expect(getStoryVisibility(1)).toMatchObject({
      heroes: false,
      gangTree: false,
      campaign: false,
      money: false,
    })
    expect(getStoryVisibility(8)).toMatchObject({
      heroes: true,
      gangTree: true,
      campaign: false,
      money: true,
    })
    expect(getStoryVisibility(26).campaign).toBe(true)
    expect(getStoryVisibility(34).oil).toBe(true)
    expect(getStoryVisibility(38).materials).toBe(true)
  })

  it('places the 3D vehicle workshops into the existing story route', () => {
    expect(STORY_STEPS[6].action).toEqual({
      kind: 'car-customize',
      label: '进入 3D 改车工位',
    })
    expect(STORY_STEPS[14].action).toEqual({
      kind: 'car-dismantle',
      label: '进入 3D 拆车工位',
    })
    expect(STORY_STEPS).toHaveLength(43)
  })
})
