import { describe, expect, it } from 'vitest'
import { createInitialAdventureState } from '../store/adventureMigration'
import { createInitialBuildingProgress } from '../store/cityProgressMigration'
import {
  CHAPTERS,
  CHAPTER_TWO_RECYCLING_TAKEOVER_TASK_ID,
  getChapterForGangLevel,
  getChapterTaskPackages,
  getChapterTasks,
  getTaskProgress,
  isChapterComplete,
} from './chapterProgression'
import {
  getCarPartUpgradeCost,
  getGunUpgradeCost,
} from './equipmentProgression'
import { carUnlockLevel, getBuildingUnlock } from './progressionUnlocks'

function snapshot() {
  const adventure = createInitialAdventureState(0)
  return {
    heroLevels: adventure.heroLevels,
    gunLevels: adventure.gunLevels,
    carPartInventory: adventure.carPartInventory,
    carPartUpgradeCount: adventure.carPartUpgradeCount,
    highestClearedStage: adventure.highestClearedStage,
    highestClearedRacingStage: adventure.highestClearedRacingStage,
    claimedBuildingIds: [],
    installedPartIds: Object.values(adventure.carPartSlotsByCar).flatMap(
      (slots) => Object.values(slots).filter((partId) => partId !== null),
    ),
    buildingProgress: createInitialBuildingProgress(),
    gangLevel: 1,
    resources: { money: 10_000, oil: 0, materials: 0 },
    spareParts: 0,
    totalPower: 951,
    carPowerById: {
      'rust-fox': 851,
      'iron-fang': 0,
      'neon-bee': 0,
      'road-wolf': 0,
      'black-throne': 0,
    },
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

  it('combines one selected package with fixed duties and the chapter-two takeover', () => {
    expect(getChapterTasks(1)).toHaveLength(3)
    for (let chapterNumber = 2; chapterNumber <= 7; chapterNumber += 1) {
      const packages = getChapterTaskPackages(chapterNumber)
      const minimum = chapterNumber <= 4 ? 1 : 2
      const maximum = chapterNumber <= 4 ? 2 : 3
      expect(packages).toHaveLength(3)
      for (const taskPackage of packages) {
        expect(taskPackage.tasks.length).toBeGreaterThanOrEqual(minimum)
        expect(taskPackage.tasks.length).toBeLessThanOrEqual(maximum)
        const tasks = getChapterTasks(chapterNumber, taskPackage.id)
        expect(tasks).toHaveLength(
          taskPackage.tasks.length + 3 + (chapterNumber === 2 ? 1 : 0),
        )
        expect(
          tasks
            .filter((task) => task.id.includes('-extra-'))
            .map((task) => task.requirement.kind),
        ).toEqual(['gang-level', 'campaign-clears', 'racing-clears'])
        if (chapterNumber === 2) {
          expect(tasks[0]).toMatchObject({
            id: CHAPTER_TWO_RECYCLING_TAKEOVER_TASK_ID,
            requirement: {
              kind: 'building-claimed',
              buildingId: 'recycling-yard',
              target: 1,
            },
          })
        }
      }
    }
  })

  it('never generates a task for a resource, building, or car that the chapter rank cannot unlock', () => {
    for (const chapter of CHAPTERS.slice(1)) {
      const tasks = getChapterTaskPackages(chapter.number).flatMap(
        (taskPackage) => taskPackage.tasks,
      )
      for (const task of tasks) {
        const requirement = task.requirement
        if (requirement.kind === 'resource-materials') {
          expect(chapter.minimumLevel).toBeGreaterThanOrEqual(
            getBuildingUnlock('metalworking-plant')?.requiredLevel ?? Infinity,
          )
        }
        if (requirement.kind === 'resource-oil') {
          expect(chapter.minimumLevel).toBeGreaterThanOrEqual(
            getBuildingUnlock('gas-station')?.requiredLevel ?? Infinity,
          )
        }
        if (
          requirement.kind === 'spare-parts' ||
          requirement.kind === 'part-level' ||
          requirement.kind === 'part-upgrades'
        ) {
          expect(chapter.minimumLevel).toBeGreaterThanOrEqual(
            getBuildingUnlock('recycling-yard')?.requiredLevel ?? Infinity,
          )
        }
        if (requirement.kind === 'building-level') {
          expect(
            getBuildingUnlock(requirement.buildingId)?.requiredLevel,
          ).toBeLessThanOrEqual(chapter.minimumLevel)
        }
        if (requirement.kind === 'car-power') {
          expect(carUnlockLevel(requirement.carId)).toBeLessThanOrEqual(
            chapter.minimumLevel,
          )
        }
      }
    }

    const earlyTasks = [2, 3].flatMap((chapterNumber) =>
      getChapterTaskPackages(chapterNumber).flatMap(
        (taskPackage) => taskPackage.tasks,
      ),
    )
    expect(
      earlyTasks.some(
        (task) =>
          task.requirement.kind === 'resource-oil' ||
          task.requirement.kind === 'resource-materials',
      ),
    ).toBe(false)
    const chapterFourTasks = getChapterTaskPackages(4).flatMap(
      (taskPackage) => taskPackage.tasks,
    )
    expect(
      chapterFourTasks.some((task) => task.requirement.kind === 'resource-oil'),
    ).toBe(false)
  })

  it('uses non-repeating random draws and keeps generated targets inside the current chapter ceiling', () => {
    for (const chapter of CHAPTERS.slice(1)) {
      const packageTasks = getChapterTaskPackages(chapter.number).flatMap(
        (taskPackage) => taskPackage.tasks,
      )
      const requirementKeys = packageTasks.map((task) => {
        const requirement = task.requirement
        if (requirement.kind === 'building-level') {
          return `${requirement.kind}:${requirement.buildingId}`
        }
        if (requirement.kind === 'car-power') {
          return `${requirement.kind}:${requirement.carId}`
        }
        return requirement.kind
      })
      expect(new Set(requirementKeys).size).toBe(requirementKeys.length)

      for (const task of packageTasks) {
        const requirement = task.requirement
        if (requirement.kind === 'hero-level') {
          expect(requirement.target).toBeLessThanOrEqual(
            chapter.nextRoleLevel ?? chapter.minimumLevel,
          )
        }
        if (requirement.kind === 'building-level') {
          expect(requirement.target).toBeGreaterThanOrEqual(2)
          expect(requirement.target).toBeLessThanOrEqual(10)
        }
      }
    }
  })

  it('splits promotion experience between task rewards and chapter completion', () => {
    expect(
      CHAPTERS.slice(0, 6).map((chapter) =>
        chapter.tasks.reduce(
          (sum, task) => sum + task.reward.gangReputation,
          0,
        ),
      ),
    ).toEqual([90, 80, 80, 80, 80, 100])
    expect(
      CHAPTERS.slice(0, 6).map(
        (chapter) =>
          chapter.tasks.reduce(
            (sum, task) => sum + task.reward.gangReputation,
            0,
          ) + chapter.completionReward.gangReputation,
      ),
    ).toEqual([210, 240, 240, 240, 240, 300])
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

  it('uses the three explicit prologue duties without campaign gates', () => {
    expect(CHAPTERS[0].tasks.map((task) => task.requirement.kind)).toEqual([
      'building-claimed',
      'building-level',
      'part-installed',
    ])
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

    expect(sparePartsBeforeChapterFour).toBe(330)
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
      claimedBuildingIds: ['repair-shop' as const],
      installedPartIds: [...state.installedPartIds, 'prologue-tuned-engine'],
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
