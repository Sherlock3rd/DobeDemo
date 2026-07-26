import { describe, expect, it } from 'vitest'
import { createInitialAdventureState } from '../store/adventureMigration'
import { createInitialBuildingProgress } from '../store/cityProgressMigration'
import {
  CHAPTERS,
  getChapterForGangLevel,
  getTaskProgress,
  isChapterComplete,
} from './chapterProgression'
import {
  getCarPartUpgradeCost,
  getGunUpgradeCost,
} from './equipmentProgression'
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

  it('splits promotion experience between task rewards and chapter completion', () => {
    expect(
      CHAPTERS.slice(0, 6).map((chapter) =>
        chapter.tasks.reduce(
          (sum, task) => sum + task.reward.gangReputation,
          0,
        ),
      ),
    ).toEqual([80, 80, 80, 80, 80, 100])
    expect(
      CHAPTERS.slice(0, 6).map(
        (chapter) =>
          chapter.tasks.reduce(
            (sum, task) => sum + task.reward.gangReputation,
            0,
          ) + chapter.completionReward.gangReputation,
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

  it('delays deliberate hero growth until chapter three and equipment growth until chapter four', () => {
    const growthKinds = (chapterIndex: number) =>
      CHAPTERS[chapterIndex].tasks.map((task) => task.requirement.kind)

    expect(growthKinds(0)).not.toContain('part-level')
    expect(growthKinds(0)).not.toContain('gun-level')
    expect(growthKinds(1)).not.toContain('hero-level')
    expect(growthKinds(1)).not.toContain('part-level')
    expect(growthKinds(1)).not.toContain('gun-level')

    expect(CHAPTERS[2].tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirement: { kind: 'hero-level', target: 18 },
        }),
      ]),
    )
    expect(growthKinds(2)).not.toContain('part-level')
    expect(growthKinds(2)).not.toContain('gun-level')

    expect(CHAPTERS[3].tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirement: { kind: 'part-level', target: 3 },
        }),
        expect.objectContaining({
          requirement: { kind: 'gun-level', target: 3 },
        }),
      ]),
    )
  })

  it('funds the first chapter-four equipment gate from prior chapter rewards', () => {
    const sparePartsBeforeChapterFour = CHAPTERS.slice(0, 3)
      .flatMap((chapter) => chapter.tasks)
      .reduce((sum, task) => sum + task.reward.spareParts, 0)
    const epicPart = {
      id: 'budget-check',
      slot: 'tires' as const,
      quality: 'epic' as const,
      level: 1,
    }
    const partCost = [1, 2].reduce(
      (sum, level) => sum + getCarPartUpgradeCost({ ...epicPart, level }),
      0,
    )
    const gunCost = [0, 1, 2].reduce(
      (sum, level) => sum + getGunUpgradeCost('rivet-smg', level),
      0,
    )

    expect(sparePartsBeforeChapterFour).toBe(350)
    expect(partCost + gunCost).toBe(324)
    expect(sparePartsBeforeChapterFour).toBeGreaterThanOrEqual(
      partCost + gunCost,
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
      current: 1,
      target: 1,
      complete: true,
    })
    expect(isChapterComplete(CHAPTERS[0], complete)).toBe(true)
  })
})
