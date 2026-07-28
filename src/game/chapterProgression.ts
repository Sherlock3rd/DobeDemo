import type { ResourceWallet } from '../config/economyConfig'
import { equipmentConfig } from '../config/equipmentConfig'
import { buildingCatalogById } from './buildingCatalog'
import { BUILDING_IDS, type BuildingId } from './cityTypes'
import {
  CAR_IDS,
  type CarId,
  type CarPartQuality,
  type CarPartSlot,
  type GunId,
} from './equipmentTypes'
import { GANG_ROLES, type GangRole } from './gangProgression'
import { PROLOGUE_TUNED_PART_ID } from './prologue'
import { carUnlockLevel, getBuildingUnlock } from './progressionUnlocks'
import type { AdventureDurableState } from '../store/adventureMigration'
import type { BuildingProgressById } from '../store/cityProgressMigration'

export type ChapterTaskRequirement =
  | { kind: 'hero-level'; target: number }
  | { kind: 'part-level'; target: number }
  | { kind: 'part-upgrades'; target: number }
  | { kind: 'gun-level'; target: number }
  | {
      kind: 'building-claimed'
      buildingId: BuildingId
      target: 1
    }
  | { kind: 'building-level'; buildingId: BuildingId; target: number }
  | { kind: 'part-installed'; partId: string; target: 1 }
  | { kind: 'resource-money'; target: number }
  | { kind: 'resource-oil'; target: number }
  | { kind: 'resource-materials'; target: number }
  | { kind: 'spare-parts'; target: number }
  | { kind: 'total-power'; target: number }
  | { kind: 'car-power'; carId: CarId; target: number }
  | { kind: 'gang-level'; target: number }
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
  carPartUpgradeCount: number
  highestClearedStage: number
  highestClearedRacingStage: number
  claimedBuildingIds: readonly BuildingId[]
  installedPartIds: readonly string[]
  buildingProgress: BuildingProgressById
  gangLevel: number
  resources: ResourceWallet
  spareParts: number
  totalPower: number
  carPowerById: Readonly<Record<CarId, number>>
}

export interface TaskProgress {
  current: number
  target: number
  complete: boolean
}

export interface ChapterTaskPackage {
  id: string
  title: string
  summary: string
  tasks: readonly ChapterTaskDefinition[]
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
    title: '序章 · 逃亡者的补丁',
    story:
      'Thomas 在追捕中被博带进小镇。要留下来，他必须接过修车厂管理权、修好工位，并用博给的新引擎换掉车上的坏件。',
    completionReward: completionReward(
      120,
      600,
      80,
      { money: 500, oil: 0, materials: 0 },
      [],
      ['iron-fang'],
    ),
    tasks: [
      {
        id: 'chapter-1-prologue-claim',
        name: '接过修车厂',
        description: '完成一次修车厂管理权交接',
        requirement: {
          kind: 'building-claimed',
          buildingId: 'repair-shop',
          target: 1,
        },
        reward: reward(30, 120, 12),
      },
      {
        id: 'chapter-1-prologue-upgrade',
        name: '重新点炉',
        description: '修理厂主建筑达到 Lv.2',
        requirement: {
          kind: 'building-level',
          buildingId: 'repair-shop',
          target: 2,
        },
        reward: reward(30, 140, 14),
      },
      {
        id: 'chapter-1-prologue-part',
        name: '换下坏引擎',
        description: '将博赠送的调校引擎安装到锈狐',
        requirement: {
          kind: 'part-installed',
          partId: PROLOGUE_TUNED_PART_ID,
          target: 1,
        },
        reward: reward(30, 160, 16),
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
      '晋升正式成员后，Thomas 将获准管理废车回收厂。每一块废铁都要重新进入帮派的生产体系。',
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

const CHAPTER_CAMPAIGN_TARGETS = [2, 5, 8, 11, 14, 18, 20] as const
const CHAPTER_SUP_TARGETS = [1, 2, 4, 5, 8, 9, 10] as const

function chapterTaskReward(
  chapterNumber: number,
  gangReputation: number,
): ChapterTaskReward {
  return reward(
    gangReputation,
    100 + chapterNumber * 100,
    10 + chapterNumber * 10,
  )
}

function packageRewardShare(
  chapterNumber: number,
  taskCount: number,
  taskIndex: number,
): number {
  const total = chapterNumber <= 5 ? 20 : 25
  const base = Math.floor(total / taskCount)
  return base + (taskIndex < total % taskCount ? 1 : 0)
}

function defineTaskPackage(
  chapterNumber: number,
  packageId: string,
  title: string,
  summary: string,
  tasks: readonly Omit<ChapterTaskDefinition, 'id' | 'reward'>[],
): ChapterTaskPackage {
  return {
    id: `chapter-${chapterNumber}-package-${packageId}`,
    title,
    summary,
    tasks: tasks.map((task, index) => ({
      ...task,
      id: `chapter-${chapterNumber}-package-${packageId}-${index + 1}`,
      reward: chapterTaskReward(
        chapterNumber,
        packageRewardShare(chapterNumber, tasks.length, index),
      ),
    })),
  }
}

const CHAPTER_ONE_STARTER_TASKS: readonly ChapterTaskDefinition[] = [
  {
    id: 'chapter-1-prologue-claim',
    name: '接过修车厂',
    description: '完成一次修车厂管理权交接',
    requirement: {
      kind: 'building-claimed',
      buildingId: 'repair-shop',
      target: 1,
    },
    reward: reward(30, 120, 12),
  },
  {
    id: 'chapter-1-prologue-upgrade',
    name: '重新点炉',
    description: '修理厂主建筑达到 Lv.2',
    requirement: {
      kind: 'building-level',
      buildingId: 'repair-shop',
      target: 2,
    },
    reward: reward(30, 140, 14),
  },
  {
    id: 'chapter-1-prologue-part',
    name: '换下坏引擎',
    description: '将博赠送的调校引擎安装到锈狐',
    requirement: {
      kind: 'part-installed',
      partId: PROLOGUE_TUNED_PART_ID,
      target: 1,
    },
    reward: reward(30, 160, 16),
  },
]

export const CHAPTER_TWO_RECYCLING_TAKEOVER_TASK_ID =
  'chapter-2-mandatory-recycling-takeover'

const CHAPTER_TWO_MANDATORY_TASKS: readonly ChapterTaskDefinition[] = [
  {
    id: CHAPTER_TWO_RECYCLING_TAKEOVER_TASK_ID,
    name: '交接废车回收厂',
    description: '前往城市地图，完成废车回收厂管理权交接',
    requirement: {
      kind: 'building-claimed',
      buildingId: 'recycling-yard',
      target: 1,
    },
    reward: reward(20, 300, 30),
  },
]

const CHAPTER_TASK_BLUEPRINTS: Readonly<
  Record<number, readonly ChapterTaskPackage[]>
> = {
  2: [
    defineTaskPackage(
      2,
      'cashflow',
      '现金回笼',
      '先让废铁交易恢复稳定现金流。',
      [
        {
          name: '回笼废铁款',
          description: '持有钱资源 12,000',
          requirement: { kind: 'resource-money', target: 12_000 },
        },
      ],
    ),
    defineTaskPackage(2, 'yard', '拆解产线', '优先修复废车回收厂与原料供应。', [
      {
        name: '重启拆解线',
        description: '废车回收厂达到 Lv.2',
        requirement: {
          kind: 'building-level',
          buildingId: 'recycling-yard',
          target: 2,
        },
      },
      {
        name: '备齐拆解物资',
        description: '持有物资资源 100',
        requirement: { kind: 'resource-materials', target: 100 },
      },
    ]),
    defineTaskPackage(
      2,
      'crew',
      '车队整备',
      '用英雄、配件和整队战力证明车队已经就绪。',
      [
        {
          name: '正式成员训练',
          description: '任意英雄达到 Lv.8',
          requirement: { kind: 'hero-level', target: 8 },
        },
        {
          name: '完成两次配件强化',
          description: '累计升级车辆配件 2 次',
          requirement: { kind: 'part-upgrades', target: 2 },
        },
        {
          name: '整队战力过线',
          description: '账号总战力达到 1,400',
          requirement: { kind: 'total-power', target: 1_400 },
        },
      ],
    ),
  ],
  3: [
    defineTaskPackage(
      3,
      'materials',
      '商街备货',
      '先为商业街准备足够的经营物资。',
      [
        {
          name: '补齐商街库存',
          description: '持有物资资源 250',
          requirement: { kind: 'resource-materials', target: 250 },
        },
      ],
    ),
    defineTaskPackage(
      3,
      'street',
      '街区经营',
      '同时处理商业街等级和运输油料。',
      [
        {
          name: '扩建商业街',
          description: '商业街达到 Lv.2',
          requirement: {
            kind: 'building-level',
            buildingId: 'commercial-street',
            target: 2,
          },
        },
        {
          name: '储备运输油料',
          description: '持有汽油资源 250',
          requirement: { kind: 'resource-oil', target: 250 },
        },
      ],
    ),
    defineTaskPackage(
      3,
      'armed-convoy',
      '武装押运',
      '强化枪械、英雄与铁牙车队的单车战力。',
      [
        {
          name: '枪械校准',
          description: '任意枪械达到 Lv.2',
          requirement: { kind: 'gun-level', target: 2 },
        },
        {
          name: '铁牙出勤',
          description: '铁牙最高装备战力达到 1,200',
          requirement: {
            kind: 'car-power',
            carId: 'iron-fang',
            target: 1_200,
          },
        },
        {
          name: '骨干训练',
          description: '任意英雄达到 Lv.18',
          requirement: { kind: 'hero-level', target: 18 },
        },
      ],
    ),
  ],
  4: [
    defineTaskPackage(4, 'fuel', '炉线燃料', '先确保工厂拥有连续开炉的油料。', [
      {
        name: '储备开炉燃料',
        description: '持有汽油资源 500',
        requirement: { kind: 'resource-oil', target: 500 },
      },
    ]),
    defineTaskPackage(
      4,
      'factory',
      '工厂复产',
      '重开金属加工厂并准备周转资金。',
      [
        {
          name: '重启金属炉线',
          description: '金属加工厂达到 Lv.2',
          requirement: {
            kind: 'building-level',
            buildingId: 'metalworking-plant',
            target: 2,
          },
        },
        {
          name: '准备工人工钱',
          description: '持有钱资源 16,000',
          requirement: { kind: 'resource-money', target: 16_000 },
        },
      ],
    ),
    defineTaskPackage(
      4,
      'arsenal',
      '军火试制',
      '用配件、枪械与总战力完成新一轮试制。',
      [
        {
          name: '连续调校',
          description: '累计升级车辆配件 6 次',
          requirement: { kind: 'part-upgrades', target: 6 },
        },
        {
          name: '整体火力过线',
          description: '账号总战力达到 3,200',
          requirement: { kind: 'total-power', target: 3_200 },
        },
        {
          name: '武器校准',
          description: '任意枪械达到 Lv.3',
          requirement: { kind: 'gun-level', target: 3 },
        },
      ],
    ),
  ],
  5: [
    defineTaskPackage(5, 'parts', '零件储备', '为长途行动优先囤积可用零件。', [
      {
        name: '囤积维修零件',
        description: '持有零件资源 600',
        requirement: { kind: 'spare-parts', target: 600 },
      },
    ]),
    defineTaskPackage(
      5,
      'fuel-route',
      '油路经营',
      '升级加油站并补足公路物资。',
      [
        {
          name: '控制油路',
          description: '加油站达到 Lv.2',
          requirement: {
            kind: 'building-level',
            buildingId: 'gas-station',
            target: 2,
          },
        },
        {
          name: '补齐公路物资',
          description: '持有物资资源 700',
          requirement: { kind: 'resource-materials', target: 700 },
        },
      ],
    ),
    defineTaskPackage(
      5,
      'road-crew',
      '公路精锐',
      '提升英雄、铁牙单车与账号整体战力。',
      [
        {
          name: '队长训练',
          description: '任意英雄达到 Lv.34',
          requirement: { kind: 'hero-level', target: 34 },
        },
        {
          name: '铁牙重装',
          description: '铁牙最高装备战力达到 2,200',
          requirement: {
            kind: 'car-power',
            carId: 'iron-fang',
            target: 2_200,
          },
        },
        {
          name: '车队总动员',
          description: '账号总战力达到 5,000',
          requirement: { kind: 'total-power', target: 5_000 },
        },
      ],
    ),
  ],
  6: [
    defineTaskPackage(
      6,
      'treasury',
      '会所账目',
      '用充足现金稳定所有核心席位。',
      [
        {
          name: '充实会所金库',
          description: '持有钱资源 25,000',
          requirement: { kind: 'resource-money', target: 25_000 },
        },
      ],
    ),
    defineTaskPackage(
      6,
      'clubhouse',
      '会所整顿',
      '升级会所并保障各条线油料。',
      [
        {
          name: '议事会所',
          description: '帮派会所达到 Lv.2',
          requirement: {
            kind: 'building-level',
            buildingId: 'clubhouse',
            target: 2,
          },
        },
        {
          name: '统一油料调度',
          description: '持有汽油资源 1,000',
          requirement: { kind: 'resource-oil', target: 1_000 },
        },
      ],
    ),
    defineTaskPackage(
      6,
      'command',
      '统一武装',
      '同步强化枪械、车辆配件和账号总战力。',
      [
        {
          name: '军火库升级',
          description: '任意枪械达到 Lv.6',
          requirement: { kind: 'gun-level', target: 6 },
        },
        {
          name: '十二次车辆调校',
          description: '累计升级车辆配件 12 次',
          requirement: { kind: 'part-upgrades', target: 12 },
        },
        {
          name: '副主席战力',
          description: '账号总战力达到 8,000',
          requirement: { kind: 'total-power', target: 8_000 },
        },
      ],
    ),
  ],
  7: [
    defineTaskPackage(
      7,
      'supply',
      '全城储备',
      '先把所有产业的物资集中到会所。',
      [
        {
          name: '集中全城物资',
          description: '持有物资资源 1,500',
          requirement: { kind: 'resource-materials', target: 1_500 },
        },
      ],
    ),
    defineTaskPackage(7, 'seat', '主席议席', '升级会所并备齐最终维修零件。', [
      {
        name: '城市冠冕',
        description: '帮派会所达到 Lv.4',
        requirement: {
          kind: 'building-level',
          buildingId: 'clubhouse',
          target: 4,
        },
      },
      {
        name: '最终零件储备',
        description: '持有零件资源 1,200',
        requirement: { kind: 'spare-parts', target: 1_200 },
      },
    ]),
    defineTaskPackage(
      7,
      'legend',
      '主席传奇',
      '以英雄、黑王座与账号总战力完成最终证明。',
      [
        {
          name: '传奇领袖',
          description: '任意英雄达到 Lv.50',
          requirement: { kind: 'hero-level', target: 50 },
        },
        {
          name: '黑王座出征',
          description: '黑王座最高装备战力达到 3,200',
          requirement: {
            kind: 'car-power',
            carId: 'black-throne',
            target: 3_200,
          },
        },
        {
          name: '主席总战力',
          description: '账号总战力达到 12,000',
          requirement: { kind: 'total-power', target: 12_000 },
        },
      ],
    ),
  ],
}

type MeetingTaskBlueprint = Pick<
  ChapterTaskDefinition,
  'name' | 'description' | 'requirement'
>

const MEETING_TASK_TARGETS = {
  money: [12_000, 14_000, 16_000, 20_000, 25_000, 30_000],
  materials: [100, 200, 300, 700, 1_000, 1_500],
  oil: [100, 200, 350, 500, 1_000, 1_500],
  spareParts: [150, 250, 400, 600, 900, 1_200],
  heroLevel: [8, 18, 26, 34, 42, 50],
  gunLevel: [1, 2, 3, 4, 6, 8],
  partUpgrades: [2, 4, 6, 9, 12, 15],
  partLevel: [1, 2, 3, 4, 5, 6],
  totalPower: [1_400, 2_200, 3_200, 5_000, 8_000, 12_000],
  carPower: [1_000, 1_300, 1_700, 2_200, 2_800, 3_400],
} as const

const PACKAGE_PRESENTATIONS = [
  {
    id: 'random-a',
    title: '稳妥推进',
    summary: '从当前已经具备的产业和养成能力中抽取一组职责。',
  },
  {
    id: 'random-b',
    title: '多线协作',
    summary: '把当前可执行的经营、城建与战力任务重新组合。',
  },
  {
    id: 'random-c',
    title: '强硬执行',
    summary: '只从本章真实解锁的功能中形成另一组行动命令。',
  },
] as const

function meetingTaskBlueprintKey(task: MeetingTaskBlueprint): string {
  const requirement = task.requirement
  if (requirement.kind === 'building-level') {
    return `${requirement.kind}:${requirement.buildingId}`
  }
  if (requirement.kind === 'car-power') {
    return `${requirement.kind}:${requirement.carId}`
  }
  return requirement.kind
}

const MEETING_TASK_BLUEPRINTS: readonly MeetingTaskBlueprint[] = [
  ...new Map(
    [
      ...Object.values(CHAPTER_TASK_BLUEPRINTS).flatMap((taskPackages) =>
        taskPackages.flatMap((taskPackage) =>
          taskPackage.tasks.map(({ name, description, requirement }) => ({
            name,
            description,
            requirement,
          })),
        ),
      ),
      ...BUILDING_IDS.map((buildingId): MeetingTaskBlueprint => ({
        name: buildingCatalogById[buildingId].name,
        description: `${buildingCatalogById[buildingId].name}升级任务`,
        requirement: { kind: 'building-level', buildingId, target: 2 },
      })),
      ...CAR_IDS.map((carId): MeetingTaskBlueprint => ({
        name: equipmentConfig.cars[carId].name,
        description: equipmentConfig.cars[carId].description,
        requirement: { kind: 'car-power', carId, target: 1 },
      })),
    ].map((task) => [meetingTaskBlueprintKey(task), task] as const),
  ).values(),
]

function taskUnlockLevel(task: MeetingTaskBlueprint): number {
  const requirement = task.requirement
  switch (requirement.kind) {
    case 'resource-money':
      return getBuildingUnlock('repair-shop')?.requiredLevel ?? 1
    case 'resource-materials':
      return (
        getBuildingUnlock('metalworking-plant')?.requiredLevel ??
        Number.MAX_SAFE_INTEGER
      )
    case 'resource-oil':
      return (
        getBuildingUnlock('gas-station')?.requiredLevel ??
        Number.MAX_SAFE_INTEGER
      )
    case 'spare-parts':
    case 'part-level':
    case 'part-upgrades':
      return (
        getBuildingUnlock('recycling-yard')?.requiredLevel ??
        Number.MAX_SAFE_INTEGER
      )
    case 'building-level':
      return (
        getBuildingUnlock(requirement.buildingId)?.requiredLevel ??
        Number.MAX_SAFE_INTEGER
      )
    case 'car-power':
      return carUnlockLevel(requirement.carId)
    case 'hero-level':
    case 'gun-level':
    case 'total-power':
      return 1
    default:
      return Number.MAX_SAFE_INTEGER
  }
}

function chapterScaleIndex(chapterNumber: number): number {
  return Math.min(
    MEETING_TASK_TARGETS.money.length - 1,
    Math.max(0, chapterNumber - 2),
  )
}

function displayTarget(target: number): string {
  return target.toLocaleString('en-US')
}

function retargetMeetingTask(
  blueprint: MeetingTaskBlueprint,
  chapter: ChapterDefinition,
): MeetingTaskBlueprint | null {
  const scaleIndex = chapterScaleIndex(chapter.number)
  const requirement = blueprint.requirement
  switch (requirement.kind) {
    case 'resource-money': {
      const target = MEETING_TASK_TARGETS.money[scaleIndex]
      return {
        name: '筹齐行动资金',
        description: `持有钱资源 ${displayTarget(target)}`,
        requirement: { kind: 'resource-money', target },
      }
    }
    case 'resource-materials': {
      const target = MEETING_TASK_TARGETS.materials[scaleIndex]
      return {
        name: '备齐工业物资',
        description: `持有物资资源 ${displayTarget(target)}`,
        requirement: { kind: 'resource-materials', target },
      }
    }
    case 'resource-oil': {
      const target = MEETING_TASK_TARGETS.oil[scaleIndex]
      return {
        name: '备齐路线油料',
        description: `持有汽油资源 ${displayTarget(target)}`,
        requirement: { kind: 'resource-oil', target },
      }
    }
    case 'spare-parts': {
      const target = MEETING_TASK_TARGETS.spareParts[scaleIndex]
      return {
        name: '整理维修零件',
        description: `持有零件资源 ${displayTarget(target)}`,
        requirement: { kind: 'spare-parts', target },
      }
    }
    case 'building-level': {
      const unlock = getBuildingUnlock(requirement.buildingId)
      if (!unlock) return null
      const target = Math.min(
        10,
        2 + Math.ceil((chapter.minimumLevel - unlock.requiredLevel) / 16),
      )
      const buildingName = buildingCatalogById[requirement.buildingId].name
      return {
        name: `升级${buildingName}`,
        description: `${buildingName}达到 Lv.${target}`,
        requirement: {
          kind: 'building-level',
          buildingId: requirement.buildingId,
          target,
        },
      }
    }
    case 'hero-level': {
      const target = MEETING_TASK_TARGETS.heroLevel[scaleIndex]
      return {
        name: '核心成员训练',
        description: `任意英雄达到 Lv.${target}`,
        requirement: { kind: 'hero-level', target },
      }
    }
    case 'gun-level': {
      const target = MEETING_TASK_TARGETS.gunLevel[scaleIndex]
      return {
        name: '枪械升级',
        description: `任意枪械达到 Lv.${target}`,
        requirement: { kind: 'gun-level', target },
      }
    }
    case 'part-upgrades': {
      const target = MEETING_TASK_TARGETS.partUpgrades[scaleIndex]
      return {
        name: '车辆配件强化',
        description: `累计升级车辆配件 ${target} 次`,
        requirement: { kind: 'part-upgrades', target },
      }
    }
    case 'part-level': {
      const target = MEETING_TASK_TARGETS.partLevel[scaleIndex]
      return {
        name: '配件等级检验',
        description: `任意车辆配件达到 Lv.${target}`,
        requirement: { kind: 'part-level', target },
      }
    }
    case 'total-power': {
      const target = MEETING_TASK_TARGETS.totalPower[scaleIndex]
      return {
        name: '整队战力过线',
        description: `账号总战力达到 ${displayTarget(target)}`,
        requirement: { kind: 'total-power', target },
      }
    }
    case 'car-power': {
      const target = MEETING_TASK_TARGETS.carPower[scaleIndex]
      const carName = equipmentConfig.cars[requirement.carId].name
      return {
        name: `${carName}整备`,
        description: `${carName}最高装备战力达到 ${displayTarget(target)}`,
        requirement: {
          kind: 'car-power',
          carId: requirement.carId,
          target,
        },
      }
    }
    default:
      return null
  }
}

function seededTaskScore(
  chapterNumber: number,
  packageIndex: number,
  taskIndex: number,
): number {
  let value = Math.imul(chapterNumber + 41, 0x45d9f3b)
  value ^= Math.imul(packageIndex + 17, 0x27d4eb2d)
  value ^= Math.imul(taskIndex + 73, 0x165667b1)
  value ^= value >>> 16
  value = Math.imul(value, 0x45d9f3b)
  value ^= value >>> 16
  return value >>> 0
}

function packageTaskCount(chapterNumber: number, packageIndex: number): number {
  const minimum = chapterNumber <= 4 ? 1 : 2
  const maximum = chapterNumber <= 4 ? 2 : 3
  return (
    minimum +
    (seededTaskScore(chapterNumber, packageIndex, 97) % (maximum - minimum + 1))
  )
}

function createRandomChapterTaskPackages(
  chapter: ChapterDefinition,
): readonly ChapterTaskPackage[] {
  const eligibleTasks = MEETING_TASK_BLUEPRINTS.filter(
    (task) => taskUnlockLevel(task) <= chapter.minimumLevel,
  )
    .map((task) => retargetMeetingTask(task, chapter))
    .filter((task): task is MeetingTaskBlueprint => task !== null)
    .map((task, taskIndex) => ({
      task,
      score: seededTaskScore(chapter.number, 11, taskIndex),
    }))
    .sort((left, right) => right.score - left.score)
    .map(({ task }) => task)

  let taskOffset = 0
  return PACKAGE_PRESENTATIONS.map((presentation, packageIndex) => {
    const taskCount = Math.min(
      packageTaskCount(chapter.number, packageIndex),
      eligibleTasks.length,
    )
    const selectedTasks = Array.from(
      { length: taskCount },
      (_, taskIndex) =>
        eligibleTasks[(taskOffset + taskIndex) % eligibleTasks.length],
    )
    taskOffset += taskCount
    return defineTaskPackage(
      chapter.number,
      presentation.id,
      presentation.title,
      presentation.summary,
      selectedTasks,
    )
  })
}

const CHAPTER_TASK_PACKAGES: Readonly<
  Record<number, readonly ChapterTaskPackage[]>
> = Object.fromEntries(
  CHAPTERS.slice(1).map((chapter) => [
    chapter.number,
    createRandomChapterTaskPackages(chapter),
  ]),
)

function getChapterExtraTasks(
  chapterNumber: number,
): readonly ChapterTaskDefinition[] {
  const chapter = CHAPTERS[chapterNumber - 1]
  if (!chapter) return []
  if (chapterNumber === 1) return []
  const reputationPerTask = chapterNumber <= 5 ? 20 : 25
  return [
    {
      id: `chapter-${chapterNumber}-extra-gang`,
      name: '职位声望',
      description: `帮派声望等级达到 Lv.${chapter.minimumLevel}`,
      requirement: { kind: 'gang-level', target: chapter.minimumLevel },
      reward: chapterTaskReward(chapterNumber, reputationPerTask),
    },
    {
      id: `chapter-${chapterNumber}-extra-campaign`,
      name: '清理街区',
      description: `推关完成 ${CHAPTER_CAMPAIGN_TARGETS[chapterNumber - 1]} 关`,
      requirement: {
        kind: 'campaign-clears',
        target: CHAPTER_CAMPAIGN_TARGETS[chapterNumber - 1],
      },
      reward: chapterTaskReward(chapterNumber, reputationPerTask),
    },
    {
      id: `chapter-${chapterNumber}-extra-sup`,
      name: '公路行动',
      description: `完成 SUP 玩法 ${CHAPTER_SUP_TARGETS[chapterNumber - 1]} 关`,
      requirement: {
        kind: 'racing-clears',
        target: CHAPTER_SUP_TARGETS[chapterNumber - 1],
      },
      reward:
        chapterNumber === 1
          ? {
              ...chapterTaskReward(chapterNumber, reputationPerTask),
              carParts: epicSet,
            }
          : chapterTaskReward(chapterNumber, reputationPerTask),
    },
  ]
}

function getChapterMandatoryTasks(
  chapterNumber: number,
): readonly ChapterTaskDefinition[] {
  return chapterNumber === 2 ? CHAPTER_TWO_MANDATORY_TASKS : []
}

export function getChapterByNumber(
  chapterNumber: number,
): ChapterDefinition | null {
  return CHAPTERS.find((chapter) => chapter.number === chapterNumber) ?? null
}

export function getChapterTaskPackages(
  chapterNumber: number,
): readonly ChapterTaskPackage[] {
  return CHAPTER_TASK_PACKAGES[chapterNumber] ?? []
}

export function getChapterTasks(
  chapterNumber: number,
  selectedPackageId?: string | null,
): readonly ChapterTaskDefinition[] {
  const extraTasks = getChapterExtraTasks(chapterNumber)
  if (chapterNumber === 1) {
    return [...CHAPTER_ONE_STARTER_TASKS, ...extraTasks]
  }
  const mandatoryTasks = getChapterMandatoryTasks(chapterNumber)
  const selectedPackage = getChapterTaskPackages(chapterNumber).find(
    (taskPackage) => taskPackage.id === selectedPackageId,
  )
  return selectedPackage
    ? [...mandatoryTasks, ...selectedPackage.tasks, ...extraTasks]
    : []
}

export function getAllSelectableChapterTasks(): readonly ChapterTaskDefinition[] {
  return [
    ...getChapterTasks(1),
    ...CHAPTERS.slice(1).flatMap((chapter) => [
      ...getChapterMandatoryTasks(chapter.number),
      ...getChapterTaskPackages(chapter.number).flatMap(
        (taskPackage) => taskPackage.tasks,
      ),
      ...getChapterExtraTasks(chapter.number),
    ]),
  ]
}

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
    case 'part-upgrades':
      current = snapshot.carPartUpgradeCount
      break
    case 'gun-level':
      current = Math.max(...Object.values(snapshot.gunLevels))
      break
    case 'building-claimed':
      current = snapshot.claimedBuildingIds.includes(requirement.buildingId)
        ? 1
        : 0
      break
    case 'building-level':
      current = snapshot.buildingProgress[requirement.buildingId].level
      break
    case 'part-installed':
      current = snapshot.installedPartIds.includes(requirement.partId) ? 1 : 0
      break
    case 'resource-money':
      current = snapshot.resources.money
      break
    case 'resource-oil':
      current = snapshot.resources.oil
      break
    case 'resource-materials':
      current = snapshot.resources.materials
      break
    case 'spare-parts':
      current = snapshot.spareParts
      break
    case 'total-power':
      current = snapshot.totalPower
      break
    case 'car-power':
      current = snapshot.carPowerById[requirement.carId]
      break
    case 'gang-level':
      current = snapshot.gangLevel
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

export function areChapterTasksComplete(
  tasks: readonly ChapterTaskDefinition[],
  snapshot: ChapterProgressSnapshot,
): boolean {
  return (
    tasks.length > 0 &&
    tasks.every((task) => getTaskProgress(task, snapshot).complete)
  )
}

export function getTaskRequirementLabel(
  requirement: ChapterTaskRequirement,
): string {
  if (requirement.kind === 'building-level') {
    return `${buildingCatalogById[requirement.buildingId].name} Lv.${requirement.target}`
  }
  if (requirement.kind === 'car-power') {
    return `${requirement.carId} ${requirement.target}`
  }
  return `${requirement.target}`
}
