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
    expect(useGangStore.getState().totalReputation).toBe(20)
    expect(useGangStore.getState().currentLevel).toBe(1)
    expect(useAdventureStore.getState()).toMatchObject({
      sharedExp: 120,
      spareParts: 12,
    })
  })

  it('rejects incomplete and future-rank tasks', () => {
    expect(useChapterStore.getState().claimTask('chapter-1-building')).toBe(
      false,
    )
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

  it('claims a completed chapter exactly once and grants its resource and gear unlock reward', () => {
    useAdventureStore.setState((state) => ({
      heroLevels: { ...state.heroLevels, foreman: 3 },
      highestClearedStage: 2,
      highestClearedRacingStage: 1,
    }))
    useCityStore.setState((state) => ({
      buildingProgress: {
        ...state.buildingProgress,
        'repair-shop': {
          ...state.buildingProgress['repair-shop'],
          level: 2,
        },
      },
    }))

    expect(useChapterStore.getState().claimChapterReward(1)).toBe(true)
    expect(useChapterStore.getState().claimChapterReward(1)).toBe(false)
    expect(useChapterStore.getState().claimedChapterNumbers).toEqual([1])
    expect(useGangStore.getState().totalReputation).toBe(132)
    expect(useAdventureStore.getState()).toMatchObject({
      sharedExp: 600,
      spareParts: 80,
      chapterUnlockedCarIds: ['iron-fang'],
    })
    expect(useCityStore.getState().resources).toMatchObject({
      money: 10_500,
      oil: 0,
      materials: 0,
    })
  })

  it('rejects chapter rewards before all chapter tasks are complete', () => {
    expect(useChapterStore.getState().claimChapterReward(1)).toBe(false)
    expect(useChapterStore.getState().claimedChapterNumbers).toEqual([])
  })

  it('records each known narrative once and clears it on account reset', () => {
    const store = useChapterStore.getState()
    store.markNarrativeSeen('first-entry')
    store.markNarrativeSeen('first-entry')
    store.markNarrativeSeen('chapter-start:1')

    expect(useChapterStore.getState().seenNarrativeIds).toEqual([
      'first-entry',
      'chapter-start:1',
    ])

    useChapterStore.getState().reset()
    expect(useChapterStore.getState().seenNarrativeIds).toEqual([])
  })
})
