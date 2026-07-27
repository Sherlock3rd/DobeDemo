import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialAdventureState } from './adventureMigration'
import { useAdventureStore } from './useAdventureStore'
import { CHAPTER_STORAGE_KEY, useChapterStore } from './useChapterStore'
import { useCityStore } from './useCityStore'
import { useGangStore } from './useGangStore'

const BASE_TIME = 1_700_000_000_000

function completeChapterOneRequirements(): void {
  useAdventureStore.setState({
    highestClearedStage: 2,
    highestClearedRacingStage: 1,
  })
  useCityStore.setState((state) => ({
    buildingProgress: {
      ...state.buildingProgress,
      'repair-shop': {
        ...state.buildingProgress['repair-shop'],
        level: 2,
      },
    },
  }))
}

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

  it('publishes the starter chapter without requiring a meeting package', () => {
    expect(useChapterStore.getState()).toMatchObject({
      activeChapterNumber: 1,
      selectedTaskPackageIds: {},
      claimedChapterNumbers: [],
    })
    expect(useChapterStore.getState().claimTask('chapter-1-starter-hero')).toBe(
      true,
    )
    expect(useGangStore.getState().totalReputation).toBe(10)
    expect(useAdventureStore.getState()).toMatchObject({
      sharedExp: 200,
      spareParts: 20,
    })
  })

  it('rejects incomplete and non-active chapter tasks', () => {
    expect(
      useChapterStore.getState().claimTask('chapter-1-starter-building'),
    ).toBe(false)
    useAdventureStore.setState({ highestClearedStage: 20 })
    expect(
      useChapterStore.getState().claimTask('chapter-7-package-supply-1'),
    ).toBe(false)
  })

  it('delivers the first chapter full epic set from the mandatory SUP task', () => {
    useAdventureStore.setState({ highestClearedRacingStage: 1 })
    expect(useChapterStore.getState().claimTask('chapter-1-extra-sup')).toBe(
      true,
    )

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

  it('claims a completed chapter once but advances only after package selection', () => {
    completeChapterOneRequirements()

    expect(useChapterStore.getState().claimChapterReward(1)).toBe(true)
    expect(useChapterStore.getState().claimChapterReward(1)).toBe(false)
    expect(useChapterStore.getState()).toMatchObject({
      activeChapterNumber: 1,
      claimedChapterNumbers: [1],
    })
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

    expect(
      useChapterStore
        .getState()
        .completeAssessment(
          1,
          'chapter-2-package-yard',
          'formal-member-approved',
        ),
    ).toBe(true)
    expect(useChapterStore.getState()).toMatchObject({
      activeChapterNumber: 2,
      selectedTaskPackageIds: {
        2: 'chapter-2-package-yard',
      },
      meetingVotes: { 1: 'formal-member-approved' },
      completedAssessmentChapterNumbers: [1],
    })
  })

  it('rejects meeting completion before the current chapter is completed', () => {
    expect(
      useChapterStore
        .getState()
        .completeAssessment(
          1,
          'chapter-2-package-yard',
          'formal-member-approved',
        ),
    ).toBe(false)
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

  it('migrates an older completed save to the next active chapter with a safe default package', async () => {
    window.localStorage.setItem(
      CHAPTER_STORAGE_KEY,
      JSON.stringify({
        state: {
          claimedTaskIds: ['chapter-1-hero'],
          claimedChapterNumbers: [1],
          seenNarrativeIds: [
            'first-entry',
            'chapter-start:1',
            'chapter-start:2',
          ],
        },
        version: 4,
      }),
    )

    await useChapterStore.persist.rehydrate()

    expect(useChapterStore.getState()).toMatchObject({
      activeChapterNumber: 2,
      selectedTaskPackageIds: {
        2: 'chapter-2-package-cashflow',
      },
      claimedTaskIds: [],
      claimedChapterNumbers: [1],
      seenNarrativeIds: ['first-entry', 'chapter-start:1', 'chapter-start:2'],
      completedAssessmentChapterNumbers: [1],
    })
  })

  it('normalizes an old first-chapter neutral vote into the formal-member verdict', async () => {
    window.localStorage.setItem(
      CHAPTER_STORAGE_KEY,
      JSON.stringify({
        state: {
          activeChapterNumber: 2,
          selectedTaskPackageIds: {
            2: 'chapter-2-package-yard',
          },
          meetingVotes: { 1: 'option-b' },
          claimedChapterNumbers: [1],
          completedAssessmentChapterNumbers: [1],
        },
        version: 5,
      }),
    )

    await useChapterStore.persist.rehydrate()

    expect(useChapterStore.getState().meetingVotes).toEqual({
      1: 'formal-member-approved',
    })
  })
})
