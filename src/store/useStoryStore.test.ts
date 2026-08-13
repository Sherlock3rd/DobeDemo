import { beforeEach, describe, expect, it } from 'vitest'
import { STORY_STORAGE_KEY } from './useStoryStore'
import { useStoryStore } from './useStoryStore'

describe('useStoryStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useStoryStore.getState().reset()
  })

  it('starts at L01 and advances only from the expected node', () => {
    expect(useStoryStore.getState().currentStepNumber).toBe(1)
    expect(useStoryStore.getState().advance(2)).toBe(false)
    expect(useStoryStore.getState().advance(1)).toBe(true)
    expect(useStoryStore.getState().currentStepNumber).toBe(2)
  })

  it('persists briefed nodes without duplicates', () => {
    useStoryStore.getState().markBriefed(1)
    useStoryStore.getState().markBriefed(1)
    expect(useStoryStore.getState().briefedStepNumbers).toEqual([1])
    expect(window.localStorage.getItem(STORY_STORAGE_KEY)).toContain(
      'briefedStepNumbers',
    )
  })

  it('resets the full Plan C route', () => {
    useStoryStore.getState().advance(1)
    useStoryStore.getState().markBriefed(2)
    useStoryStore.getState().setEnabled(false)
    useStoryStore.getState().reset()
    expect(useStoryStore.getState()).toMatchObject({
      enabled: true,
      currentStepNumber: 1,
      completedStepNumbers: [],
      parallelOrder: null,
      briefedStepNumbers: [],
      claimedGangWallRewardIds: [],
    })
  })

  it('allows only the previous tier rewards after their story release step', () => {
    useStoryStore.setState({ currentStepNumber: 19 })
    expect(
      useStoryStore.getState().claimGangWallReward('hugo-garage-manager'),
    ).toBe(true)
    expect(
      useStoryStore.getState().claimGangWallReward('walter-yard-manager'),
    ).toBe(true)
    expect(
      useStoryStore.getState().claimGangWallReward('spencer-gas-manager'),
    ).toBe(false)
  })

  it('runs either L18 branch first and joins only after both finish', () => {
    useStoryStore.setState({ currentStepNumber: 18 })
    expect(
      useStoryStore.getState().chooseParallelOrder('investigation-first'),
    ).toBe(true)
    expect(useStoryStore.getState()).toMatchObject({
      currentStepNumber: 22,
      parallelOrder: 'investigation-first',
    })
    expect(useStoryStore.getState().advance(22)).toBe(true)
    expect(useStoryStore.getState().advance(23)).toBe(true)
    expect(useStoryStore.getState().advance(24)).toBe(true)
    expect(useStoryStore.getState().currentStepNumber).toBe(19)
    expect(useStoryStore.getState().advance(19)).toBe(true)
    expect(useStoryStore.getState().advance(20)).toBe(true)
    expect(useStoryStore.getState().advance(21)).toBe(true)
    expect(useStoryStore.getState().currentStepNumber).toBe(25)
  })
})
