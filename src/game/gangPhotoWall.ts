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
  'walter-yard-manager',
  'full-patch-operator',
  'maeve-investigator',
  'koten-street-manager',
  'enforcer-operator',
  'merrill-rescue',
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
 * 方案 C 的纵向照片墙。玩家晋升至 N 层后，只能承接 N-1 层的人物和奖励；
 * 原成员照片不会消失，空席位也会继续保留。
 */
export const GANG_PHOTO_WALL: readonly GangWallTier[] = [
  {
    tier: 1,
    title: 'Prospect',
    chineseTitle: '见习',
    systemLevel: 1,
    reputationThreshold: 0,
    promotionEvent: '加入帮派并完成转正终考',
    duty: '修好灰狐、赢下一对一竞速并通过入会表决',
    slots: [
      {
        id: 'hugo-garage-manager',
        kind: 'person',
        name: 'Hugo Vale',
        position: '修车厂看守人',
        task: '恢复修车厂工位与日常生产',
        description:
          '产业始终属于帮派；完成双线试炼时，Hugo 把修车厂管理职责交给你。',
        portraitIndex: 5,
        buildingId: 'repair-shop',
        tags: ['building', 'parts'],
        availableFromStep: 19,
        claimLabel: '完成 Hugo 与修车厂管理交接',
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
    duty: '完成全员反击任务，并查清精准伏击背后的内鬼',
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
        availableFromStep: 19,
        claimLabel: '完成 Walter 与废车回收厂交接',
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
        availableFromStep: 21,
        claimLabel: '接过 Nora 的经营班组',
      },
      {
        id: 'maeve-investigator',
        kind: 'person',
        name: 'Maeve Quinn',
        position: '内鬼调查支援英雄',
        task: '复盘伏击现场并锁定口供',
        description: '被派来协助 Thomas 查案，不替代玩家成为战斗主控。',
        portraitIndex: 3,
        tags: ['hero'],
        availableFromStep: 22,
        claimLabel: '确认 Maeve 的调查支援',
      },
      empty('t2-empty-2'),
    ],
  },
  {
    tier: 3,
    title: 'Enforcer',
    chineseTitle: '打手',
    systemLevel: 16,
    reputationThreshold: 300,
    promotionEvent: '全员任务复盘与打手职责授予',
    duty: '完成产业、调查双线，并追击绑走 Merrill 的科腾',
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
        availableFromStep: 29,
        claimLabel: '接管 Koten 留下的商业街账本',
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
        availableFromStep: 29,
        claimLabel: '接过 Isaac 的收账班组',
      },
      {
        id: 'merrill-rescue',
        kind: 'person',
        name: 'Merrill Shaw',
        position: '获救的路线英雄',
        task: '提供科腾撤离路线并加入追击',
        description: '从绑架点救出后，Merrill 交出科腾的撤离路线。',
        portraitIndex: 5,
        tags: ['hero'],
        availableFromStep: 28,
        claimLabel: '确认 Merrill 的追击支援',
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
    promotionEvent: '产业与调查双线完成，晋升路线成员',
    duty: '救回 Merrill，制裁科腾并恢复商业街现金网络',
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
        availableFromStep: 33,
        claimLabel: '完成 Spencer 与加油站交接',
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
        availableFromStep: 31,
        claimLabel: '确认 Caleb 的火力小队',
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
        availableFromStep: 34,
        claimLabel: '接过 Milo 的补给班组',
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
    promotionEvent: '救援完成并制裁科腾，授予路线队长背章',
    duty: '复盘商业街、加油站与物流中心的经营恢复',
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
        availableFromStep: 30,
        claimLabel: '承接 Billy 留下的关系网',
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
        availableFromStep: 36,
        claimLabel: '完成物流负责人和物流中心交接',
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
        availableFromStep: 37,
        claimLabel: '接过 Finn 的物流班组',
      },
    ],
  },
  {
    tier: 6,
    title: 'Treasurer',
    chineseTitle: '财务官',
    systemLevel: 40,
    reputationThreshold: 1_700,
    promotionEvent: '三条产业恢复并完成账本复盘',
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
        claimLabel: '接过 Eli 的稽核职责',
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
        claimLabel: '接过 Dale 的物资线',
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
        claimLabel: '接过 Alfie 的结算班组',
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
        availableFromStep: 38,
        claimLabel: '确认 Bo 的武装支援',
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
        availableFromStep: 38,
        claimLabel: '接过 Ray 与高阶枪械库',
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
    promotionEvent: '追回全员物资并完成护送',
    duty: '参与核心表决，协调车队与多条行动线',
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
        claimLabel: '确认 Hank 的资深行动线',
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
        availableFromStep: 41,
        claimLabel: '接过 Wayne 与会长装备库',
      },
    ],
  },
  {
    tier: 10,
    title: 'President',
    chineseTitle: '会长',
    systemLevel: 50,
    reputationThreshold: 5_500,
    promotionEvent: '全体选举与会长木槌授章',
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
        claimLabel: '完成会长席位与 Clubhouse 交接',
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
