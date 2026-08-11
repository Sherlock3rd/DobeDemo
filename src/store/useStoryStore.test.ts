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

  it('resets the full Plan B route', () => {
    useStoryStore.getState().advance(1)
    useStoryStore.getState().markBriefed(2)
    useStoryStore.getState().setEnabled(false)
    useStoryStore.getState().reset()
    expect(useStoryStore.getState()).toMatchObject({
      enabled: true,
      currentStepNumber: 1,
      briefedStepNumbers: [],
    })
  })
})
