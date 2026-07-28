import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialAdventureState } from './adventureMigration'
import { useAdventureStore } from './useAdventureStore'
import { CHAPTER_STORAGE_KEY, useChapterStore } from './useChapterStore'
import { useCityStore } from './useCityStore'
import { useGangStore } from './useGangStore'
import { PROLOGUE_TUNED_PART } from '../game/prologue'

const BASE_TIME = 1_700_000_000_000

function completeChapterOneRequirements(): void {
  const adventure = useAdventureStore.getState()
  useAdventureStore.setState({
    carPartInventory: [
      ...adventure.carPartInventory.filter(
        (part) => part.id !== PROLOGUE_TUNED_PART.id,
      ),
      PROLOGUE_TUNED_PART,
    ],
    carPartSlotsByCar: {
      ...adventure.carPartSlotsByCar,
      'rust-fox': {
        ...adventure.carPartSlotsByCar['rust-fox'],
        engine: PROLOGUE_TUNED_PART.id,
      },
    },
  })
  useCityStore.setState((state) => ({
    claimedBuildingIds: ['repair-shop'],
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
    useCityStore.setState({ claimedBuildingIds: ['repair-shop'] })
    expect(
      useChapterStore.getState().claimTask('chapter-1-prologue-claim'),
    ).toBe(true)
    expect(useGangStore.getState().totalReputation).toBe(30)
    expect(useAdventureStore.getState()).toMatchObject({
      sharedExp: 120,
      spareParts: 12,
    })
  })

  it('rejects incomplete and non-active chapter tasks', () => {
    expect(
      useChapterStore.getState().claimTask('chapter-1-prologue-upgrade'),
    ).toBe(false)
    useAdventureStore.setState({ highestClearedStage: 20 })
    expect(
      useChapterStore.getState().claimTask('chapter-7-package-random-a-1'),
    ).toBe(false)
  })

  it('advances the prologue only from the expected current step', () => {
    expect(
      useChapterStore
        .getState()
        .advancePrologue('opening-dialogue', 'police-race'),
    ).toBe(true)
    expect(
      useChapterStore
        .getState()
        .advancePrologue('opening-dialogue', 'bo-invitation'),
    ).toBe(false)
    expect(useChapterStore.getState().prologueStep).toBe('police-race')
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
          'chapter-2-package-random-b',
          'formal-member-approved',
        ),
    ).toBe(true)
    expect(useChapterStore.getState()).toMatchObject({
      activeChapterNumber: 2,
      selectedTaskPackageIds: {
        2: 'chapter-2-package-random-b',
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
          'chapter-2-package-random-b',
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
        2: 'chapter-2-package-random-a',
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
            2: 'chapter-2-package-random-b',
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

  it('moves a version-seven fixed package onto the deterministic unlocked random package', async () => {
    window.localStorage.setItem(
      CHAPTER_STORAGE_KEY,
      JSON.stringify({
        state: {
          prologueStep: 'complete',
          activeChapterNumber: 3,
          selectedTaskPackageIds: {
            2: 'chapter-2-package-yard',
            3: 'chapter-3-package-armed-convoy',
          },
          claimedTaskIds: [
            'chapter-3-package-armed-convoy-1',
            'chapter-3-extra-campaign',
          ],
          claimedChapterNumbers: [1, 2],
          completedAssessmentChapterNumbers: [1, 2],
        },
        version: 7,
      }),
    )

    await useChapterStore.persist.rehydrate()

    expect(useChapterStore.getState()).toMatchObject({
      prologueStep: 'complete',
      activeChapterNumber: 3,
      selectedTaskPackageIds: {
        3: 'chapter-3-package-random-a',
      },
      claimedTaskIds: ['chapter-3-extra-campaign'],
      claimedChapterNumbers: [1, 2],
      completedAssessmentChapterNumbers: [1, 2],
    })
  })

  it('persists the post-meeting promotion and takeover guide checkpoints', async () => {
    for (const prologueStep of [
      'formal-promotion',
      'chapter-briefing',
      'recycling-takeover',
    ] as const) {
      window.localStorage.setItem(
        CHAPTER_STORAGE_KEY,
        JSON.stringify({
          state: {
            prologueStep,
            activeChapterNumber: 2,
            selectedTaskPackageIds: {
              2: 'chapter-2-package-random-b',
            },
            claimedChapterNumbers: [1],
            completedAssessmentChapterNumbers: [1],
          },
          version: 9,
        }),
      )

      await useChapterStore.persist.rehydrate()

      expect(useChapterStore.getState()).toMatchObject({
        prologueStep,
        activeChapterNumber: 2,
        selectedTaskPackageIds: {
          2: 'chapter-2-package-random-b',
        },
      })
    }
  })
})
