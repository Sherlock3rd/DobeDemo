import { describe, expect, it } from 'vitest'
import { createInitialAdventureState } from '../store/adventureMigration'
import { createInitialBuildingProgress } from '../store/cityProgressMigration'
import {
  CHAPTERS,
  getChapterForGangLevel,
  getTaskProgress,
  isChapterComplete,
} from './chapterProgression'
import { getBuildingUnlock } from './progressionUnlocks'

function snapshot() {
  const adventure = createInitialAdventureState(0)
  return {
    heroLevels: adventure.heroLevels,
    gunLevels: adventure.gunLevels,
    carPartInventory: adventure.carPartInventory,
    highestClearedStage: adventure.highestClearedStage,
    highestClearedRacingStage: adventure.highestClearedRacingStage,
    buildingProgress: createInitialBuildingProgress(),
  }
}

describe('chapter progression', () => {
  it('defines exactly seven chapters matching the seven gang roles', () => {
    expect(CHAPTERS).toHaveLength(7)
    expect(CHAPTERS.map((chapter) => chapter.minimumLevel)).toEqual([
      1, 8, 16, 24, 32, 40, 50,
    ])
    expect(getChapterForGangLevel(7).number).toBe(1)
    expect(getChapterForGangLevel(8).number).toBe(2)
    expect(getChapterForGangLevel(50).number).toBe(7)
  })

  it('balances each promotion chapter to its full rank experience interval', () => {
    expect(
      CHAPTERS.slice(0, 6).map((chapter) =>
        chapter.tasks.reduce(
          (sum, task) => sum + task.reward.gangReputation,
          0,
        ),
      ),
    ).toEqual([212, 240, 240, 240, 240, 300])
  })

  it('never references a building unlocked after the chapter begins', () => {
    for (const chapter of CHAPTERS) {
      for (const task of chapter.tasks) {
        if (task.requirement.kind !== 'building-level') continue
        expect(
          getBuildingUnlock(task.requirement.buildingId)?.requiredLevel,
        ).toBeLessThanOrEqual(chapter.minimumLevel)
      }
    }
  })

  it('grants a complete epic four-slot set in the first chapter', () => {
    const parts = CHAPTERS[0].tasks.flatMap((task) => task.reward.carParts)
    expect(parts).toEqual(
      expect.arrayContaining([
        { slot: 'tires', quality: 'epic' },
        { slot: 'engine', quality: 'epic' },
        { slot: 'bumper', quality: 'epic' },
        { slot: 'suspension', quality: 'epic' },
      ]),
    )
  })

  it('evaluates derived task progress and chapter completion', () => {
    const state = snapshot()
    expect(isChapterComplete(CHAPTERS[0], state)).toBe(false)

    const complete = {
      ...state,
      heroLevels: { ...state.heroLevels, foreman: 3 },
      highestClearedStage: 2,
      highestClearedRacingStage: 1,
      buildingProgress: {
        ...state.buildingProgress,
        'repair-shop': {
          ...state.buildingProgress['repair-shop'],
          level: 2 as const,
        },
      },
    }
    expect(getTaskProgress(CHAPTERS[0].tasks[0], complete)).toMatchObject({
      current: 3,
      target: 3,
      complete: true,
    })
    expect(isChapterComplete(CHAPTERS[0], complete)).toBe(true)
  })
})
