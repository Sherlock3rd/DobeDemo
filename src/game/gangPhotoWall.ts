import type { BuildingId } from './cityTypes'

export const GANG_WALL_TAGS = {
  hero: '英雄解锁',
  building: '建筑管理者',
  operator: '经营者',
} as const

export type GangWallTag = keyof typeof GANG_WALL_TAGS

export const GANG_WALL_REWARD_IDS = [
  'repair-shop-vacancy',
  'eddie-operator',
  'freddie-yard-manager',
  'maeve-hero',
  'merrill-street-manager',
  'arthur-hero',
  'liam-operator',
  'billy-gas-manager',
  'polly-hero',
  'ruby-operator',
  'dale-plant-manager',
  'charlie-operator',
  'finn-operator',
  'bo-arms-master',
  'hank-senior-member',
  'michael-clubhouse-manager',
  'winston-chairman',
] as const

export type GangWallRewardId = (typeof GANG_WALL_REWARD_IDS)[number]

export interface GangWallPhoto {
  id: GangWallRewardId
  kind: 'person' | 'building'
  name: string
  position: string
  description: string
  portraitIndex?: number
  buildingId?: BuildingId
  tags: readonly GangWallTag[]
  availableFromStep: number
  claimLabel: string
}

export interface GangWallEmptySlot {
  kind: 'empty'
  id: string
}

export type GangWallSlot = GangWallPhoto | GangWallEmptySlot

export interface GangWallTier {
  tier: number
  title: string
  chineseTitle: string
  systemLevel: number
  duty: string
  slots: readonly GangWallSlot[]
}

const empty = (id: string): GangWallEmptySlot => ({ kind: 'empty', id })

/**
 * The wall follows Plan A's ten-rank organization shape while Plan B supplies
 * the people, buildings and unlock order used by the playable route.
 */
export const GANG_PHOTO_WALL: readonly GangWallTier[] = [
  {
    tier: 1,
    title: 'Prospect',
    chineseTitle: '见习',
    systemLevel: 1,
    duty: '使用修车工位，完成帮派交付的基础任务',
    slots: [
      {
        id: 'repair-shop-vacancy',
        kind: 'building',
        name: '修车厂',
        position: '管理席位空置',
        description: '产业属于帮派；正式成员可接过日常管理权。',
        buildingId: 'repair-shop',
        tags: ['building'],
        availableFromStep: 11,
        claimLabel: '接管修车厂管理权',
      },
      {
        id: 'eddie-operator',
        kind: 'person',
        name: 'Eddie “Pins” Doyle',
        position: '维修工位经营者',
        description: '派驻后负责修车厂的日常维修与结算。',
        portraitIndex: 1,
        tags: ['operator'],
        availableFromStep: 13,
        claimLabel: '派驻 Eddie 经营修车厂',
      },
      empty('t1-empty-1'),
      empty('t1-empty-2'),
    ],
  },
  {
    tier: 2,
    title: 'Full Patch',
    chineseTitle: '正式成员',
    systemLevel: 8,
    duty: '管理修车厂，并接受执行者席位的直接调度',
    slots: [
      {
        id: 'freddie-yard-manager',
        kind: 'person',
        name: 'Freddie Thorne',
        position: '废车回收厂管理员',
        description: '他的钥匙与遗留职责将在纪念会议后完成交接。',
        portraitIndex: 5,
        tags: ['building'],
        availableFromStep: 23,
        claimLabel: '接过 Freddie 留下的回收厂职责',
      },
      {
        id: 'maeve-hero',
        kind: 'person',
        name: 'Maeve “Red” Quinn',
        position: '行动队调查员',
        description: '主席派来调查内鬼案的首名战斗英雄。',
        portraitIndex: 2,
        tags: ['hero'],
        availableFromStep: 25,
        claimLabel: '让 Maeve 加入行动队',
      },
      empty('t2-empty-1'),
      empty('t2-empty-2'),
    ],
  },
  {
    tier: 3,
    title: 'Enforcer',
    chineseTitle: '执行者',
    systemLevel: 16,
    duty: '处理威胁，统筹废车回收与行动队',
    slots: [
      {
        id: 'merrill-street-manager',
        kind: 'person',
        name: 'Merrill Gray',
        position: '商业街账本负责人',
        description: '负责把商业街的旧账与人员关系交给新负责人。',
        portraitIndex: 6,
        tags: ['building'],
        availableFromStep: 28,
        claimLabel: '接过商业街管理职责',
      },
      {
        id: 'arthur-hero',
        kind: 'person',
        name: 'Arthur Shelby',
        position: '首席机械师',
        description: '负责重装车辆，也能加入正面行动。',
        portraitIndex: 3,
        tags: ['hero'],
        availableFromStep: 28,
        claimLabel: '解锁 Arthur 的行动支援',
      },
      {
        id: 'liam-operator',
        kind: 'person',
        name: 'Liam Moss',
        position: '商业街收账人',
        description: '代为处理日常收账与商户联络。',
        portraitIndex: 1,
        tags: ['operator'],
        availableFromStep: 29,
        claimLabel: '安排 Liam 经营商业街',
      },
      empty('t3-empty-1'),
      empty('t3-empty-2'),
    ],
  },
  {
    tier: 4,
    title: 'Roadman',
    chineseTitle: '道路成员',
    systemLevel: 24,
    duty: '维护现金网络，追查道路与账本中的异常',
    slots: [
      {
        id: 'billy-gas-manager',
        kind: 'person',
        name: 'Billy Kimber',
        position: '前路线队长',
        description: '叛徒被除名后，他掌握的燃油路线转入新队长名下。',
        portraitIndex: 7,
        tags: ['building'],
        availableFromStep: 32,
        claimLabel: '接管 Billy 留下的燃油网络',
      },
      {
        id: 'polly-hero',
        kind: 'person',
        name: 'Polly Gray',
        position: '账本与情报联络人',
        description: '提供远程火力与商业情报支持。',
        portraitIndex: 4,
        tags: ['hero'],
        availableFromStep: 34,
        claimLabel: '解锁 Polly 的行动支援',
      },
      {
        id: 'ruby-operator',
        kind: 'person',
        name: 'Ruby Keane',
        position: '泵岛经营者',
        description: '负责加油站泵岛、库存与夜班结算。',
        portraitIndex: 2,
        tags: ['operator'],
        availableFromStep: 33,
        claimLabel: '安排 Ruby 经营加油站',
      },
      empty('t4-empty-1'),
    ],
  },
  {
    tier: 5,
    title: 'Road Captain',
    chineseTitle: '路线队长',
    systemLevel: 32,
    duty: '掌控车队路线、燃油供应与道路行动',
    slots: [
      {
        id: 'dale-plant-manager',
        kind: 'person',
        name: 'Dale Conway',
        position: '前财务官',
        description: '辞任后负责交清金属加工厂的仓位与物资账。',
        portraitIndex: 6,
        tags: ['building'],
        availableFromStep: 36,
        claimLabel: '接过金属加工厂与物资账',
      },
      {
        id: 'charlie-operator',
        kind: 'person',
        name: 'Charlie Strong',
        position: '车队路线经营者',
        description: '负责路线调度、护送与车库排班。',
        portraitIndex: 5,
        tags: ['operator'],
        availableFromStep: 36,
        claimLabel: '安排 Charlie 管理车队',
      },
      {
        id: 'finn-operator',
        kind: 'person',
        name: 'Finn Cooper',
        position: '零件与仓位监工',
        description: '负责加工厂的零件和材料入库。',
        portraitIndex: 1,
        tags: ['operator'],
        availableFromStep: 37,
        claimLabel: '安排 Finn 管理仓位',
      },
      empty('t5-empty-1'),
    ],
  },
  {
    tier: 6,
    title: 'Treasurer',
    chineseTitle: '财务官',
    systemLevel: 40,
    duty: '统筹金钱、燃油、材料与所有经营账目',
    slots: [
      {
        id: 'bo-arms-master',
        kind: 'person',
        name: 'Bo Carter',
        position: '纪律官与武装教官',
        description: '以友好追击检验下一任纪律官。',
        portraitIndex: 1,
        tags: ['hero'],
        availableFromStep: 39,
        claimLabel: '完成 Bo 的纪律官交接',
      },
      empty('t6-empty-1'),
      empty('t6-empty-2'),
    ],
  },
  {
    tier: 7,
    title: 'Sergeant-at-Arms',
    chineseTitle: '纪律官',
    systemLevel: 42,
    duty: '负责成员纪律与武装行动',
    slots: [
      {
        id: 'hank-senior-member',
        kind: 'person',
        name: 'Hank McCormick',
        position: '资深成员',
        description: '带着旧账返城，重新进入核心议事。',
        portraitIndex: 3,
        tags: ['operator'],
        availableFromStep: 40,
        claimLabel: '迎回 Hank 进入核心议事',
      },
      empty('t7-empty-1'),
      empty('t7-empty-2'),
    ],
  },
  {
    tier: 8,
    title: 'Senior Member',
    chineseTitle: '资深成员',
    systemLevel: 44,
    duty: '参与核心表决，协调多条行动线',
    slots: [
      {
        id: 'michael-clubhouse-manager',
        kind: 'person',
        name: 'Michael Gray',
        position: '副主席',
        description: '主持日常事务，并管理 Clubhouse 的运转。',
        portraitIndex: 6,
        tags: ['building', 'operator'],
        availableFromStep: 42,
        claimLabel: '接过 Clubhouse 日常管理权',
      },
      empty('t8-empty-1'),
      empty('t8-empty-2'),
    ],
  },
  {
    tier: 9,
    title: 'Vice President',
    chineseTitle: '副主席',
    systemLevel: 46,
    duty: '代行主席职责，主持全城日常管理',
    slots: [
      {
        id: 'winston-chairman',
        kind: 'person',
        name: 'Winston Cole',
        position: '现任主席',
        description: '最终评定后，以和平方式交出主席木槌。',
        portraitIndex: 7,
        tags: ['operator'],
        availableFromStep: 44,
        claimLabel: '完成主席席位和平交接',
      },
    ],
  },
  {
    tier: 10,
    title: 'President',
    chineseTitle: '主席',
    systemLevel: 50,
    duty: '统领帮派与整座城市的管理网络',
    slots: [empty('t10-open-seat')],
  },
]

const REWARDS = GANG_PHOTO_WALL.flatMap((tier) =>
  tier.slots.filter((slot): slot is GangWallPhoto => slot.kind !== 'empty'),
)

const REWARD_BY_ID = new Map(REWARDS.map((reward) => [reward.id, reward]))

export function isGangWallRewardId(value: unknown): value is GangWallRewardId {
  return (
    typeof value === 'string' &&
    GANG_WALL_REWARD_IDS.some((rewardId) => rewardId === value)
  )
}

export function getGangWallReward(id: GangWallRewardId): GangWallPhoto {
  const reward = REWARD_BY_ID.get(id)
  if (!reward) throw new Error(`Unknown gang wall reward: ${id}`)
  return reward
}

export function getGangWallTierForReward(id: GangWallRewardId): GangWallTier {
  const tier = GANG_PHOTO_WALL.find((candidate) =>
    candidate.slots.some((slot) => slot.kind !== 'empty' && slot.id === id),
  )
  if (!tier) throw new Error(`Missing gang wall tier for reward: ${id}`)
  return tier
}

export function getGangWallTierForSystemLevel(level: number): GangWallTier {
  for (let index = GANG_PHOTO_WALL.length - 1; index >= 0; index -= 1) {
    if (level >= GANG_PHOTO_WALL[index].systemLevel) {
      return GANG_PHOTO_WALL[index]
    }
  }
  return GANG_PHOTO_WALL[0]
}

export function getHistoricalGangWallRewards(
  currentStepNumber: number,
): GangWallRewardId[] {
  return REWARDS.filter(
    (reward) => reward.availableFromStep < currentStepNumber,
  ).map((reward) => reward.id)
}
