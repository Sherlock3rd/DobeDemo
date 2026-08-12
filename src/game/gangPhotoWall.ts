import type { BuildingId } from './cityTypes'

export const GANG_WALL_TAGS = {
  hero: '英雄解锁',
  building: '建筑管理者',
  operator: '经营者',
  car: '车辆',
  gun: '枪械',
  reputation: '声望',
  parts: '零件',
  money: '金钱',
  oil: '汽油',
  materials: '物资',
} as const

export type GangWallTag = keyof typeof GANG_WALL_TAGS

export const GANG_WALL_REWARD_IDS = [
  'hugo-garage-manager',
  'prospect-wreck-runner',
  'walter-yard-manager',
  'full-patch-operator',
  'koten-street-manager',
  'enforcer-operator',
  'spencer-gas-manager',
  'caleb-olson',
  'roadman-operator',
  'billy-reputation-file',
  'logistics-manager',
  'route-operator',
  'eli-maddox',
  'dale-vance',
  'treasurer-operator',
  'bo-montgomery',
  'ray-harlan-gun',
  'hank-mccormick',
  'wayne-kowalski-kit',
  'jason-clubhouse',
] as const

export type GangWallRewardId = (typeof GANG_WALL_REWARD_IDS)[number]

export interface GangWallPhoto {
  id: GangWallRewardId
  kind: 'person' | 'building'
  name: string
  position: string
  task: string
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
  reputationThreshold: number
  promotionEvent: string
  duty: string
  slots: readonly GangWallSlot[]
}

const empty = (id: string): GangWallEmptySlot => ({ kind: 'empty', id })

/**
 * 方案 C 的纵向照片墙。玩家晋升至 N 层后，只能收复 N-1 层的人物和奖励；
 * 原成员照片不会消失，空席位也会继续保留。
 */
export const GANG_PHOTO_WALL: readonly GangWallTier[] = [
  {
    tier: 1,
    title: 'Prospect',
    chineseTitle: '见习',
    systemLevel: 1,
    reputationThreshold: 0,
    promotionEvent: '加入帮派与照片墙开启',
    duty: '完成反伏击、收车拆解与一对一竞速终考',
    slots: [
      {
        id: 'hugo-garage-manager',
        kind: 'person',
        name: 'Hugo Vale',
        position: '修车厂看守人',
        task: '修复并守住改装厂',
        description: '产业始终属于帮派；转正后可收复 Hugo 与修车厂管理线。',
        portraitIndex: 5,
        buildingId: 'repair-shop',
        tags: ['building', 'parts'],
        availableFromStep: 10,
        claimLabel: '收复 Hugo 与修车厂管理线',
      },
      {
        id: 'prospect-wreck-runner',
        kind: 'person',
        name: 'Noah Pike',
        position: '见习废车帮手',
        task: '拖回一辆废车供拆解',
        description: '负责把能拆的车辆拖回工位，持续补充零件来源。',
        portraitIndex: 1,
        tags: ['operator', 'parts'],
        availableFromStep: 14,
        claimLabel: '收复见习废车帮手',
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
    reputationThreshold: 100,
    promotionEvent: '入会投票与正式授章',
    duty: '接过改装厂，完成复仇并带领见习成员',
    slots: [
      {
        id: 'walter-yard-manager',
        kind: 'person',
        name: 'Walter Vale',
        position: '废车回收厂管理员',
        task: '恢复废车回收厂生产',
        description: '掌握废车入场、拆解与零件回收，是第二条产业线。',
        portraitIndex: 6,
        buildingId: 'recycling-yard',
        tags: ['building', 'parts'],
        availableFromStep: 21,
        claimLabel: '收复 Walter 与废车回收厂',
      },
      {
        id: 'full-patch-operator',
        kind: 'person',
        name: 'Nora Bell',
        position: '正式成员经营者',
        task: '维持回收厂夜班运转',
        description: '接管日常排班与回收结算，让零件能够持续产出。',
        portraitIndex: 2,
        tags: ['operator'],
        availableFromStep: 22,
        claimLabel: '收复 Nora 的经营班组',
      },
      empty('t2-empty-1'),
      empty('t2-empty-2'),
    ],
  },
  {
    tier: 3,
    title: 'Enforcer',
    chineseTitle: '打手',
    systemLevel: 16,
    reputationThreshold: 300,
    promotionEvent: '复仇结果与责任授予',
    duty: '经营废车回收厂，处理精准袭击与内鬼调查',
    slots: [
      {
        id: 'koten-street-manager',
        kind: 'person',
        name: 'Koten Vance',
        position: '商业街账本负责人',
        task: '恢复商业街现金网络',
        description: '交出商户名册、账本与日常收账责任。',
        portraitIndex: 4,
        buildingId: 'commercial-street',
        tags: ['building', 'money'],
        availableFromStep: 27,
        claimLabel: '收复 Koten 与商业街',
      },
      {
        id: 'enforcer-operator',
        kind: 'person',
        name: 'Isaac Bell',
        position: '打手层经营者',
        task: '维持商户联络与收账',
        description: '在行动队外出时看住现金网络。',
        portraitIndex: 1,
        tags: ['operator', 'money'],
        availableFromStep: 28,
        claimLabel: '收复 Isaac 的收账班组',
      },
      empty('t3-empty-1'),
    ],
  },
  {
    tier: 4,
    title: 'Roadman',
    chineseTitle: '路线成员',
    systemLevel: 24,
    reputationThreshold: 650,
    promotionEvent: '内奸线索嘉奖',
    duty: '恢复商业街，并追查道路与账本里的内奸',
    slots: [
      {
        id: 'spencer-gas-manager',
        kind: 'person',
        name: 'Spencer Manson',
        position: '加油站管理员',
        task: '重开燃油补给线',
        description: '交出泵岛、库存和道路补给调度。',
        portraitIndex: 7,
        buildingId: 'gas-station',
        tags: ['building', 'oil'],
        availableFromStep: 31,
        claimLabel: '收复 Spencer 与加油站',
      },
      {
        id: 'caleb-olson',
        kind: 'person',
        name: 'Caleb Olson',
        position: '道路火力支援',
        task: '支援 Merrill 救援行动',
        description: '在车队遇袭时提供移动火力。',
        portraitIndex: 3,
        tags: ['hero'],
        availableFromStep: 33,
        claimLabel: '收复 Caleb 的火力小队',
      },
      {
        id: 'roadman-operator',
        kind: 'person',
        name: 'Milo Crane',
        position: '路线经营者',
        task: '管理泵岛夜班与油罐车',
        description: '负责加油站自动生产和补给车辆。',
        portraitIndex: 2,
        tags: ['operator', 'oil'],
        availableFromStep: 32,
        claimLabel: '收复 Milo 的补给班组',
      },
      empty('t4-empty-1'),
    ],
  },
  {
    tier: 5,
    title: 'Road Captain',
    chineseTitle: '路线队长',
    systemLevel: 32,
    reputationThreshold: 1_100,
    promotionEvent: '叛徒制裁与路线授章',
    duty: '掌控道路、燃油与车队路线',
    slots: [
      {
        id: 'billy-reputation-file',
        kind: 'person',
        name: 'Billy Cruz',
        position: '被除名的前路线队长',
        task: '结算叛徒留下的声望影响',
        description: '照片保留为帮派档案；他的关系网转入你的管理线。',
        portraitIndex: 5,
        tags: ['reputation'],
        availableFromStep: 35,
        claimLabel: '收复 Billy 留下的关系网',
      },
      {
        id: 'logistics-manager',
        kind: 'person',
        name: 'Grant Mercer',
        position: '物流中心管理员',
        task: '恢复仓储与材料运输',
        description: '把物流中心仓位、车辆与物资账交给新负责人。',
        portraitIndex: 6,
        buildingId: 'metalworking-plant',
        tags: ['building', 'materials'],
        availableFromStep: 35,
        claimLabel: '收复物流负责人和物流中心',
      },
      {
        id: 'route-operator',
        kind: 'person',
        name: 'Finn Cooper',
        position: '车队路线经营者',
        task: '安排仓储与护送班次',
        description: '负责物资入库、车队排班和路线日常结算。',
        portraitIndex: 1,
        tags: ['operator', 'materials'],
        availableFromStep: 36,
        claimLabel: '收复 Finn 的物流班组',
      },
    ],
  },
  {
    tier: 6,
    title: 'Treasurer',
    chineseTitle: '财务官',
    systemLevel: 40,
    reputationThreshold: 1_700,
    promotionEvent: '救援与账本复盘',
    duty: '统筹金钱、汽油、物资和物流账目',
    slots: [
      {
        id: 'eli-maddox',
        kind: 'person',
        name: 'Eli Maddox',
        position: '财务稽核人',
        task: '复核全城产业账目',
        description: '把三条资源线整理为统一账簿。',
        portraitIndex: 4,
        tags: ['reputation', 'money'],
        availableFromStep: 38,
        claimLabel: '收复 Eli 的稽核职责',
      },
      {
        id: 'dale-vance',
        kind: 'person',
        name: 'Dale Vance',
        position: '物资调度人',
        task: '清点物流中心库存',
        description: '负责材料调拨和行动前补给。',
        portraitIndex: 6,
        tags: ['materials'],
        availableFromStep: 38,
        claimLabel: '收复 Dale 的物资线',
      },
      {
        id: 'treasurer-operator',
        kind: 'person',
        name: 'Alfie Ward',
        position: '财务官经营者',
        task: '自动结算全城产业',
        description: '在会议与行动期间维持生产结算。',
        portraitIndex: 2,
        tags: ['operator'],
        availableFromStep: 38,
        claimLabel: '收复 Alfie 的结算班组',
      },
      empty('t6-empty-1'),
    ],
  },
  {
    tier: 7,
    title: 'Sergeant-at-Arms',
    chineseTitle: '武装队长',
    systemLevel: 42,
    reputationThreshold: 2_400,
    promotionEvent: '友好枪战与纪律授章',
    duty: '负责成员纪律、武装行动与枪械配置',
    slots: [
      {
        id: 'bo-montgomery',
        kind: 'person',
        name: 'Bo Montgomery',
        position: '武装行动英雄',
        task: '完成纪律官友好考核',
        description: '提供高阶追击火力和英雄支援。',
        portraitIndex: 3,
        tags: ['hero'],
        availableFromStep: 39,
        claimLabel: '收复 Bo 的武装支援',
      },
      {
        id: 'ray-harlan-gun',
        kind: 'person',
        name: 'Ray Harlan',
        position: '军械保管人',
        task: '开放高阶枪械库',
        description: '解锁一把可装备给英雄的高阶枪械。',
        portraitIndex: 7,
        tags: ['gun'],
        availableFromStep: 39,
        claimLabel: '收复 Ray 与高阶枪械库',
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
    reputationThreshold: 3_200,
    promotionEvent: '核心据点清理与资格表决',
    duty: '参与核心表决并协调多条行动线',
    slots: [
      {
        id: 'hank-mccormick',
        kind: 'person',
        name: 'Hank McCormick',
        position: '资深行动英雄',
        task: '完成成员护送并返城',
        description: '带着旧路线经验重新进入核心议事。',
        portraitIndex: 5,
        tags: ['hero'],
        availableFromStep: 40,
        claimLabel: '收复 Hank 的资深行动线',
      },
      empty('t8-empty-1'),
      empty('t8-empty-2'),
    ],
  },
  {
    tier: 9,
    title: 'Vice President',
    chineseTitle: '副会长',
    systemLevel: 46,
    reputationThreshold: 4_200,
    promotionEvent: '传统竞速与副会长授位',
    duty: '代行会长职责，主持全城日常管理',
    slots: [
      {
        id: 'wayne-kowalski-kit',
        kind: 'person',
        name: 'Wayne Kowalski',
        position: '会长车库与军械负责人',
        task: '交付会长级车辆和枪械',
        description: '开放最高阶车辆与枪械装备。',
        portraitIndex: 6,
        tags: ['car', 'gun'],
        availableFromStep: 42,
        claimLabel: '收复 Wayne 与会长装备库',
      },
    ],
  },
  {
    tier: 10,
    title: 'President',
    chineseTitle: '会长',
    systemLevel: 50,
    reputationThreshold: 5_500,
    promotionEvent: '最终表决与木槌授章',
    duty: '统领帮派与整座城市的管理网络',
    slots: [
      {
        id: 'jason-clubhouse',
        kind: 'person',
        name: 'Jason “Rusty” Montgomery',
        position: '前任会长',
        task: '主持会长席位和平交接',
        description: '原成员照片永久保留，Clubhouse 作为最高层例外资产。',
        portraitIndex: 7,
        buildingId: 'clubhouse',
        tags: ['building', 'operator'],
        availableFromStep: 43,
        claimLabel: '完成会长与 Clubhouse 交接',
      },
    ],
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
