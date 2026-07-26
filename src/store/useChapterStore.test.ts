import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialAdventureState } from './adventureMigration'
import { useAdventureStore } from './useAdventureStore'
import { useChapterStore } from './useChapterStore'
import { useCityStore } from './useCityStore'
import { useGangStore } from './useGangStore'

const BASE_TIME = 1_700_000_000_000

describe('useChapterStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useGangStore.getState().reset(BASE_TIME)
    useAdventureStore.setState({
      ...createInitialAdventureState(BASE_TIME),
      lastVictoryReward: null,
    })
    useCityStore.getState().reset(BASE_TIME)
    useChapterStore.getState().reset()
  })

  it('claims a completed task exactly once and grants all base currencies', () => {
    useAdventureStore.setState((state) => ({
      heroLevels: { ...state.heroLevels, foreman: 3 },
    }))

    expect(useChapterStore.getState().claimTask('chapter-1-hero')).toBe(true)
    expect(useChapterStore.getState().claimTask('chapter-1-hero')).toBe(false)
    expect(useChapterStore.getState().claimedTaskIds).toEqual([
      'chapter-1-hero',
    ])
    expect(useGangStore.getState().totalReputation).toBe(53)
    expect(useGangStore.getState().currentLevel).toBe(1)
    expect(useAdventureStore.getState()).toMatchObject({
      sharedExp: 120,
      spareParts: 12,
    })
  })

  it('rejects incomplete and future-rank tasks', () => {
    expect(useChapterStore.getState().claimTask('chapter-1-hero')).toBe(false)
    useAdventureStore.setState({ highestClearedStage: 20 })
    expect(useChapterStore.getState().claimTask('chapter-7-play')).toBe(false)
  })

  it('delivers the first chapter full epic set with stable slots', () => {
    useAdventureStore.setState({ highestClearedRacingStage: 1 })
    expect(useChapterStore.getState().claimTask('chapter-1-racing')).toBe(true)

    expect(
      useAdventureStore
        .getState()
        .carPartInventory.map(({ slot, quality }) => ({ slot, quality })),
    ).toEqual([
      { slot: 'tires', quality: 'epic' },
      { slot: 'engine', quality: 'epic' },
      { slot: 'bumper', quality: 'epic' },
      { slot: 'suspension', quality: 'epic' },
    ])
  })
})
