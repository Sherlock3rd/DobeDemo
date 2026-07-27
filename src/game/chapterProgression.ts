import type { ResourceWallet } from '../config/economyConfig'
import { buildingCatalogById } from './buildingCatalog'
import type { BuildingId } from './cityTypes'
import type {
  CarId,
  CarPartQuality,
  CarPartSlot,
  GunId,
} from './equipmentTypes'
import { GANG_ROLES, type GangRole } from './gangProgression'
import type { AdventureDurableState } from '../store/adventureMigration'
import type { BuildingProgressById } from '../store/cityProgressMigration'

export type ChapterTaskRequirement =
  | { kind: 'hero-level'; target: number }
  | { kind: 'part-level'; target: number }
  | { kind: 'gun-level'; target: number }
  | { kind: 'building-level'; buildingId: BuildingId; target: number }
  | { kind: 'campaign-clears'; target: number }
  | { kind: 'racing-clears'; target: number }

export interface ChapterPartReward {
  slot: CarPartSlot
  quality: CarPartQuality
}

export interface ChapterTaskReward {
  gangReputation: number
  heroExperience: number
  spareParts: number
  carParts: readonly ChapterPartReward[]
}

export interface ChapterCompletionReward extends ChapterTaskReward {
  resources: ResourceWallet
  unlockCarIds: readonly CarId[]
  unlockGunIds: readonly GunId[]
}

export type ChapterAdventureReward = ChapterTaskReward | ChapterCompletionReward

export interface ChapterTaskDefinition {
  id: string
  name: string
  description: string
  requirement: ChapterTaskRequirement
  reward: ChapterTaskReward
}

export interface ChapterDefinition {
  number: number
  role: GangRole
  minimumLevel: number
  nextRoleLevel: number | null
  title: string
  story: string
  tasks: readonly ChapterTaskDefinition[]
  completionReward: ChapterCompletionReward
}

export interface ChapterProgressSnapshot {
  heroLevels: AdventureDurableState['heroLevels']
  gunLevels: AdventureDurableState['gunLevels']
  carPartInventory: AdventureDurableState['carPartInventory']
  highestClearedStage: number
  highestClearedRacingStage: number
  buildingProgress: BuildingProgressById
}

export interface TaskProgress {
  current: number
  target: number
  complete: boolean
}

const reward = (
  gangReputation: number,
  heroExperience: number,
  spareParts: number,
  carParts: readonly ChapterPartReward[] = [],
): ChapterTaskReward => ({
  gangReputation,
  heroExperience,
  spareParts,
  carParts,
})

const completionReward = (
  gangReputation: number,
  heroExperience: number,
  spareParts: number,
  resources: ResourceWallet,
  carParts: readonly ChapterPartReward[] = [],
  unlockCarIds: readonly CarId[] = [],
  unlockGunIds: readonly GunId[] = [],
): ChapterCompletionReward => ({
  gangReputation,
  heroExperience,
  spareParts,
  resources,
  carParts,
  unlockCarIds,
  unlockGunIds,
})

const epicSet: readonly ChapterPartReward[] = [
  { slot: 'tires', quality: 'epic' },
  { slot: 'engine', quality: 'epic' },
  { slot: 'bumper', quality: 'epic' },
  { slot: 'suspension', quality: 'epic' },
]

export const CHAPTERS: readonly ChapterDefinition[] = [
  {
    number: 1,
    role: GANG_ROLES[0],
    minimumLevel: 1,
    nextRoleLevel: 8,
    title: '第一章 · 冷炉初燃',
    story:
      '修理厂一直是剃刀党的闲置产业。Thomas 以见习身份接过管理权，要先证明自己能让这里重新运转。',
    completionReward: completionReward(
      132,
      600,
      80,
      { money: 500, oil: 0, materials: 0 },
      [{ slot: 'engine', quality: 'epic' }],
      ['iron-fang'],
    ),
    tasks: [
      {
        id: 'chapter-1-hero',
        name: '领头人就位',
        description: '拥有任意 Lv.1 英雄',
        requirement: { kind: 'hero-level', target: 1 },
        reward: reward(20, 120, 12),
      },
      {
        id: 'chapter-1-building',
        name: '点燃修理厂',
        description: '修理厂主建筑达到 Lv.2',
        requirement: {
          kind: 'building-level',
          buildingId: 'repair-shop',
          target: 2,
        },
        reward: reward(20, 140, 14, [{ slot: 'tires', quality: 'rare' }]),
      },
      {
        id: 'chapter-1-campaign',
        name: '清理街口',
        description: '推关完成 2 关',
        requirement: { kind: 'campaign-clears', target: 2 },
        reward: reward(20, 160, 16),
      },
      {
        id: 'chapter-1-racing',
        name: '第一面完整补丁',
        description: '赛车任务完成 1 关，领取一整套紫色配件',
        requirement: { kind: 'racing-clears', target: 1 },
        reward: reward(20, 200, 20, epicSet),
      },
    ],
  },
  {
    number: 2,
    role: GANG_ROLES[1],
    minimumLevel: 8,
    nextRoleLevel: 16,
    title: '第二章 · 废铁生意',
    story:
      '晋升正式成员后，Thomas 获准管理废车回收厂。每一块废铁都要重新进入帮派的生产体系。',
    completionReward: completionReward(
      160,
      900,
      120,
      { money: 1_000, oil: 100, materials: 50 },
      [{ slot: 'bumper', quality: 'epic' }],
    ),
    tasks: [
      {
        id: 'chapter-2-hero',
        name: '稳固总部',
        description: '修理厂主建筑达到 Lv.3',
        requirement: {
          kind: 'building-level',
          buildingId: 'repair-shop',
          target: 3,
        },
        reward: reward(20, 260, 28),
      },
      {
        id: 'chapter-2-building',
        name: '废车流水线',
        description: '废车回收厂达到 Lv.2',
        requirement: {
          kind: 'building-level',
          buildingId: 'recycling-yard',
          target: 2,
        },
        reward: reward(20, 280, 30, [{ slot: 'engine', quality: 'rare' }]),
      },
      {
        id: 'chapter-2-part',
        name: '调度运输线',
        description: '赛车任务完成 2 关',
        requirement: { kind: 'racing-clears', target: 2 },
        reward: reward(20, 300, 32),
      },
      {
        id: 'chapter-2-play',
        name: '城里有名',
        description: '推关完成 5 关',
        requirement: { kind: 'campaign-clears', target: 5 },
        reward: reward(20, 320, 34, [{ slot: 'bumper', quality: 'epic' }]),
      },
    ],
  },
  {
    number: 3,
    role: GANG_ROLES[2],
    minimumLevel: 16,
    nextRoleLevel: 24,
    title: '第三章 · 扳手与账本',
    story:
      '商业街本就是剃刀党的产业。技术骨干要接过调度权，让机器、生意和账本同时运转。',
    completionReward: completionReward(
      160,
      1_400,
      180,
      { money: 1_500, oil: 200, materials: 150 },
      [{ slot: 'suspension', quality: 'epic' }],
      [],
      ['industrial-carbine'],
    ),
    tasks: [
      {
        id: 'chapter-3-hero',
        name: '骨干训练',
        description: '任意英雄达到 Lv.18',
        requirement: { kind: 'hero-level', target: 18 },
        reward: reward(20, 380, 38),
      },
      {
        id: 'chapter-3-building',
        name: '管理商业街',
        description: '商业街达到 Lv.2',
        requirement: {
          kind: 'building-level',
          buildingId: 'commercial-street',
          target: 2,
        },
        reward: reward(20, 400, 40, [{ slot: 'suspension', quality: 'epic' }]),
      },
      {
        id: 'chapter-3-gun',
        name: '清算旧账',
        description: '推关完成 8 关',
        requirement: { kind: 'campaign-clears', target: 8 },
        reward: reward(20, 420, 42),
      },
      {
        id: 'chapter-3-play',
        name: '双线出击',
        description: '赛车任务完成 4 关',
        requirement: { kind: 'racing-clears', target: 4 },
        reward: reward(20, 440, 44, [{ slot: 'tires', quality: 'epic' }]),
      },
    ],
  },
  {
    number: 4,
    role: GANG_ROLES[3],
    minimumLevel: 24,
    nextRoleLevel: 32,
    title: '第四章 · 烈焰联络线',
    story:
      '酒吧里的承诺要靠工厂兑现。晋升酒吧联络人后，Thomas 将获得金属加工厂的管理权限。',
    completionReward: completionReward(
      160,
      2_000,
      260,
      { money: 2_200, oil: 350, materials: 300 },
      [{ slot: 'tires', quality: 'epic' }],
    ),
    tasks: [
      {
        id: 'chapter-4-building',
        name: '工业心脏',
        description: '金属加工厂达到 Lv.2',
        requirement: {
          kind: 'building-level',
          buildingId: 'metalworking-plant',
          target: 2,
        },
        reward: reward(20, 520, 100),
      },
      {
        id: 'chapter-4-hero',
        name: '紫装试制',
        description: '任意配件达到 Lv.3',
        requirement: { kind: 'part-level', target: 3 },
        reward: reward(20, 540, 100, [{ slot: 'engine', quality: 'epic' }]),
      },
      {
        id: 'chapter-4-gun',
        name: '武器校准',
        description: '任意枪械达到 Lv.3',
        requirement: { kind: 'gun-level', target: 3 },
        reward: reward(20, 560, 100),
      },
      {
        id: 'chapter-4-play',
        name: '穿过封锁',
        description: '推关完成 11 关',
        requirement: { kind: 'campaign-clears', target: 11 },
        reward: reward(20, 580, 100, [{ slot: 'bumper', quality: 'epic' }]),
      },
    ],
  },
  {
    number: 5,
    role: GANG_ROLES[4],
    minimumLevel: 32,
    nextRoleLevel: 40,
    title: '第五章 · 公路号令',
    story:
      '路线队长负责帮派的油料与道路。职位越高，能调度的补给节点和车队就越多。',
    completionReward: completionReward(
      160,
      2_800,
      400,
      { money: 3_000, oil: 600, materials: 500 },
      [{ slot: 'engine', quality: 'legendary' }],
      ['black-throne'],
    ),
    tasks: [
      {
        id: 'chapter-5-building',
        name: '控制油路',
        description: '加油站达到 Lv.2',
        requirement: {
          kind: 'building-level',
          buildingId: 'gas-station',
          target: 2,
        },
        reward: reward(20, 660, 120),
      },
      {
        id: 'chapter-5-hero',
        name: '队长威望',
        description: '任意英雄达到 Lv.34',
        requirement: { kind: 'hero-level', target: 34 },
        reward: reward(20, 680, 120, [{ slot: 'tires', quality: 'epic' }]),
      },
      {
        id: 'chapter-5-part',
        name: '长途套件',
        description: '任意配件达到 Lv.6',
        requirement: { kind: 'part-level', target: 6 },
        reward: reward(20, 700, 120),
      },
      {
        id: 'chapter-5-play',
        name: '称霸公路',
        description: '赛车任务完成 8 关',
        requirement: { kind: 'racing-clears', target: 8 },
        reward: reward(20, 720, 120, [
          { slot: 'suspension', quality: 'legendary' },
        ]),
      },
    ],
  },
  {
    number: 6,
    role: GANG_ROLES[5],
    minimumLevel: 40,
    nextRoleLevel: 50,
    title: '第六章 · 黑色议席',
    story:
      '副主席有权统筹会所、产业、枪火与车队，让帮派原有的各条线在同一套命令下运转。',
    completionReward: completionReward(
      200,
      3_800,
      600,
      { money: 4_500, oil: 900, materials: 800 },
      [
        { slot: 'bumper', quality: 'legendary' },
        { slot: 'suspension', quality: 'legendary' },
      ],
    ),
    tasks: [
      {
        id: 'chapter-6-building',
        name: '议事会所',
        description: '帮派会所达到 Lv.2',
        requirement: {
          kind: 'building-level',
          buildingId: 'clubhouse',
          target: 2,
        },
        reward: reward(25, 820, 150),
      },
      {
        id: 'chapter-6-hero',
        name: '副主席卫队',
        description: '任意英雄达到 Lv.42',
        requirement: { kind: 'hero-level', target: 42 },
        reward: reward(25, 840, 150, [
          { slot: 'engine', quality: 'legendary' },
        ]),
      },
      {
        id: 'chapter-6-gun',
        name: '最后的军火库',
        description: '任意枪械达到 Lv.6',
        requirement: { kind: 'gun-level', target: 6 },
        reward: reward(25, 860, 150),
      },
      {
        id: 'chapter-6-play',
        name: '肃清全城',
        description: '推关完成 18 关',
        requirement: { kind: 'campaign-clears', target: 18 },
        reward: reward(25, 880, 150, [
          { slot: 'bumper', quality: 'legendary' },
        ]),
      },
    ],
  },
  {
    number: 7,
    role: GANG_ROLES[6],
    minimumLevel: 50,
    nextRoleLevel: null,
    title: '第七章 · 主席之路',
    story:
      '主席不是城市的征服者，而是剃刀党最高管理者。让所有产业、车队与成员发挥最大价值，才配留下 PRESIDENT 的名字。',
    completionReward: completionReward(
      200,
      5_000,
      1_000,
      { money: 7_000, oil: 1_500, materials: 1_500 },
      epicSet.map((part) => ({ ...part, quality: 'legendary' as const })),
    ),
    tasks: [
      {
        id: 'chapter-7-building',
        name: '城市冠冕',
        description: '帮派会所达到 Lv.4',
        requirement: {
          kind: 'building-level',
          buildingId: 'clubhouse',
          target: 4,
        },
        reward: reward(25, 1_000, 190),
      },
      {
        id: 'chapter-7-hero',
        name: '传奇领袖',
        description: '任意英雄达到 Lv.50',
        requirement: { kind: 'hero-level', target: 50 },
        reward: reward(25, 1_100, 200, [
          { slot: 'tires', quality: 'legendary' },
        ]),
      },
      {
        id: 'chapter-7-gear',
        name: '终极改装',
        description: '任意配件达到 Lv.15',
        requirement: { kind: 'part-level', target: 15 },
        reward: reward(25, 1_200, 220, [
          { slot: 'engine', quality: 'legendary' },
        ]),
      },
      {
        id: 'chapter-7-play',
        name: '无人能挡',
        description: '推关完成全部 20 关',
        requirement: { kind: 'campaign-clears', target: 20 },
        reward: reward(25, 1_300, 240, [
          { slot: 'bumper', quality: 'legendary' },
          { slot: 'suspension', quality: 'legendary' },
        ]),
      },
    ],
  },
]

export function getChapterForGangLevel(level: number): ChapterDefinition {
  for (let index = CHAPTERS.length - 1; index >= 0; index -= 1) {
    if (level >= CHAPTERS[index].minimumLevel) return CHAPTERS[index]
  }
  return CHAPTERS[0]
}

export function getTaskProgress(
  task: ChapterTaskDefinition,
  snapshot: ChapterProgressSnapshot,
): TaskProgress {
  const requirement = task.requirement
  let current = 0
  switch (requirement.kind) {
    case 'hero-level':
      current = Math.max(...Object.values(snapshot.heroLevels))
      break
    case 'part-level':
      current = Math.max(
        0,
        ...snapshot.carPartInventory.map((part) => part.level),
      )
      break
    case 'gun-level':
      current = Math.max(...Object.values(snapshot.gunLevels))
      break
    case 'building-level':
      current = snapshot.buildingProgress[requirement.buildingId].level
      break
    case 'campaign-clears':
      current = snapshot.highestClearedStage
      break
    case 'racing-clears':
      current = snapshot.highestClearedRacingStage
      break
  }
  current = Math.max(0, Math.trunc(current))
  return {
    current: Math.min(current, requirement.target),
    target: requirement.target,
    complete: current >= requirement.target,
  }
}

export function isChapterComplete(
  chapter: ChapterDefinition,
  snapshot: ChapterProgressSnapshot,
): boolean {
  return chapter.tasks.every((task) => getTaskProgress(task, snapshot).complete)
}

export function getTaskRequirementLabel(
  requirement: ChapterTaskRequirement,
): string {
  if (requirement.kind === 'building-level') {
    return `${buildingCatalogById[requirement.buildingId].name} Lv.${requirement.target}`
  }
  return `${requirement.target}`
}
