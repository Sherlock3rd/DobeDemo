import type { DevelopmentTab } from '../ui/HeroesPanel'
import type { BuildingId } from './cityTypes'
import type { GangWallRewardId } from './gangPhotoWall'

export type StoryArtworkId =
  | 'police-chase'
  | 'gang-convoy'
  | 'cargo-ambush'
  | 'highway-gunfight'
  | 'tow-convoy'
  | 'garage-repair'
  | 'workshop-takeover'
  | 'scrapyard-salvage'
  | 'one-on-one-race'
  | 'blond-sacrifice'
  | 'memorial-succession'
  | 'assassination-rescue'
  | 'informant-interrogation'
  | 'council-promotion'
  | 'garage-explosion'

export type CarModificationScenario =
  | 'repair-trio'
  | 'tune-engine'
  | 'nitrous-install'
  | 'race-prep'
  | 'revenge-build'

export type CarDismantleScenario =
  'salvage-single' | 'salvage-pair' | 'pursuit-wreck'

export type ParallelStoryOrder = 'industry-first' | 'investigation-first'

export type StoryAction =
  | { kind: 'continue'; label: string }
  | { kind: 'wreck-collection'; label: string }
  | { kind: 'parallel-choice'; label: string }
  | { kind: 'race'; stage: number; label: string; meetingAfter?: boolean }
  | { kind: 'heroes'; tab: DevelopmentTab; label: string }
  | { kind: 'car-customize'; scenario: CarModificationScenario; label: string }
  | { kind: 'car-dismantle'; scenario: CarDismantleScenario; label: string }
  | { kind: 'building-claim'; buildingId: BuildingId; label: string }
  | {
      kind: 'building-claim-batch'
      buildingIds: readonly BuildingId[]
      label: string
    }
  | { kind: 'building-upgrade'; buildingId: BuildingId; label: string }
  | {
      kind: 'campaign'
      targetStage: number
      label: string
      meetingAfter?: boolean
      followUpRaceStage?: number
    }
  | {
      kind: 'gang-tree'
      label: string
      rewardId?: GangWallRewardId
      rewardIds?: readonly GangWallRewardId[]
      buildingId?: BuildingId
      promotionTier?: number
      meetingAfterPromotion?: boolean
      continueLabel?: string
    }
  | { kind: 'meeting'; label: string }

export interface StoryStep {
  number: number
  act: number
  time: string
  title: string
  kicker: string
  speaker: string
  lines: readonly string[]
  objective: string
  artwork: StoryArtworkId
  action: StoryAction
  reputationReward: number
}

export interface StoryRank {
  tier: number
  title: string
  chineseTitle: string
  startsAtStep: number
  systemLevel: number
  reputationThreshold: number
  promotionEvent: string
  duty: string
}

export const STORY_RANKS: readonly StoryRank[] = [
  {
    tier: 1,
    title: 'Prospect',
    chineseTitle: '见习',
    startsAtStep: 1,
    systemLevel: 1,
    reputationThreshold: 0,
    promotionEvent: '加入帮派',
    duty: '完成反伏击与转正任务',
  },
  {
    tier: 2,
    title: 'Full Patch',
    chineseTitle: '正式成员',
    startsAtStep: 9,
    systemLevel: 8,
    reputationThreshold: 100,
    promotionEvent: '首次议会转正',
    duty: '完成全员备战与联手反击',
  },
  {
    tier: 3,
    title: 'Enforcer',
    chineseTitle: '打手',
    startsAtStep: 18,
    systemLevel: 16,
    reputationThreshold: 300,
    promotionEvent: '反击任务结算与内奸调查发布',
    duty: '处理产业与内奸调查双线',
  },
  {
    tier: 4,
    title: 'Roadman',
    chineseTitle: '路线成员',
    startsAtStep: 26,
    systemLevel: 24,
    reputationThreshold: 650,
    promotionEvent: '双线汇合会议',
    duty: '营救梅丽尔并追杀科腾',
  },
  {
    tier: 5,
    title: 'Road Captain',
    chineseTitle: '路线队长',
    startsAtStep: 31,
    systemLevel: 32,
    reputationThreshold: 1_100,
    promotionEvent: '叛徒制裁结案',
    duty: '恢复商业街与燃油产业',
  },
  {
    tier: 6,
    title: 'Treasurer',
    chineseTitle: '财务官',
    startsAtStep: 36,
    systemLevel: 40,
    reputationThreshold: 1_700,
    promotionEvent: '钱油产业复盘',
    duty: '统筹钱、油、物资与物流',
  },
  {
    tier: 7,
    title: 'Sergeant-at-Arms',
    chineseTitle: '武装队长',
    startsAtStep: 39,
    systemLevel: 42,
    reputationThreshold: 2_400,
    promotionEvent: '帮内武装切磋',
    duty: '负责纪律与武装行动',
  },
  {
    tier: 8,
    title: 'Senior Members',
    chineseTitle: '元老成员',
    startsAtStep: 40,
    systemLevel: 44,
    reputationThreshold: 3_200,
    promotionEvent: '追回本帮物资',
    duty: '参与核心表决与产业协调',
  },
  {
    tier: 9,
    title: 'Vice President',
    chineseTitle: '副会长',
    startsAtStep: 42,
    systemLevel: 46,
    reputationThreshold: 4_200,
    promotionEvent: '副会长传统挑战',
    duty: '主持 Clubhouse 与全城调度',
  },
  {
    tier: 10,
    title: 'President',
    chineseTitle: '会长',
    startsAtStep: 44,
    systemLevel: 50,
    reputationThreshold: 5_500,
    promotionEvent: '全体选举与木槌授章',
    duty: '统领帮派与城市管理网络',
  },
]

function s(
  number: number,
  act: number,
  time: string,
  title: string,
  kicker: string,
  speaker: string,
  lines: readonly [string, string],
  objective: string,
  artwork: StoryArtworkId,
  action: StoryAction,
  reputationReward = 0,
): StoryStep {
  return {
    number,
    act,
    time,
    title,
    kicker,
    speaker,
    lines,
    objective,
    artwork,
    action,
    reputationReward,
  }
}

export const STORY_STEPS: readonly StoryStep[] = [
  s(
    1,
    0,
    '0:00–1:20',
    '警匪追逐',
    'SUP 首次出现',
    '警方频道',
    ['目标车辆正在向工业区逃逸。', '别硬撞警车，择路、闪避，把他们甩掉。'],
    '完成警匪追逐 SUP，暂时摆脱警方',
    'police-chase',
    { kind: 'race', stage: 1, label: '开始警匪追逐' },
  ),
  s(
    2,
    0,
    '1:20–1:50',
    '摩托帮接应·黑手党劫货预警',
    '兄弟接应',
    '博',
    ['你总算甩掉他们了。', '黑手党要来劫货，准备接敌。'],
    '与帮派成员会合并确认伏击预警',
    'gang-convoy',
    { kind: 'continue', label: '与博会合' },
  ),
  s(
    3,
    0,
    '1:50–3:10',
    '黑手党伏击反击',
    '枪战 SUP 首次出现',
    '金发小哥',
    ['他们已经到了，别让货落到他们手里。', '我掩护你，狠狠干回去。'],
    '完成枪战 SUP，击退黑手党伏击',
    'highway-gunfight',
    { kind: 'race', stage: 2, label: '反击黑手党' },
  ),
  s(
    4,
    0,
    '3:10–3:20',
    '拖回玩家车辆·转正任务完成',
    '转正任务结算',
    '博',
    ['车坏了，但货和人都回来了。', '把它拖回修车厂，这项转正任务算你完成。'],
    '拖回受损车辆并提交转正任务',
    'tow-convoy',
    { kind: 'continue', label: '拖车返城' },
  ),
  s(
    5,
    1,
    '3:20–4:20',
    '修好自己的车·安装氮气',
    '维修小游戏与车辆养成开启',
    '博',
    [
      '雨果先帮你找到伏击留下的损伤；把车修好，这套氮气装置就归你。',
      '亲手把瓶组和管线装稳，下一场一对一要靠它完成超车。',
    ],
    '在 3D 工位修复受损车辆并完成氮气安装',
    'garage-repair',
    {
      kind: 'car-customize',
      scenario: 'nitrous-install',
      label: '进入改装工位',
    },
  ),
  s(
    6,
    1,
    '4:20–5:50',
    '与金发小哥 1v1 飙车',
    '转正庆祝竞速',
    '金发小哥',
    ['跟紧我，弯道前别把氮气浪费掉。', '赢不赢不重要，得让我看到你会开。'],
    '完成 1v1 竞速终考',
    'one-on-one-race',
    { kind: 'race', stage: 3, label: '开始 1v1 竞速' },
  ),
  s(
    7,
    1,
    '5:50–6:40',
    '返程·帮派树首次出现',
    '帮派关系可视化',
    '博',
    [
      '现在你有资格看看帮里的人和位置。',
      '回 Clubhouse，议会会决定你能不能穿上整章。',
    ],
    '查看帮派树并返回 Clubhouse',
    'gang-convoy',
    { kind: 'gang-tree', label: '打开帮派树', continueLabel: '返回议会' },
    100,
  ),
  s(
    8,
    1,
    '6:40–8:10',
    '首次议会·确认转正',
    '木槌授章',
    '杰森',
    [
      '反伏击、保住货物、完成竞速，你已经证明了自己。',
      '由议会确认：从今天起你是 Full Patch。',
    ],
    '在帮派树点击晋升并完成首次议会',
    'council-promotion',
    {
      kind: 'gang-tree',
      label: '申请 Full Patch 晋升',
      promotionTier: 2,
      meetingAfterPromotion: true,
    },
  ),
  s(
    9,
    2,
    '8:10–9:10',
    '帮派建筑爆炸·会长发布全员任务',
    '精准袭击与全员动员',
    '杰森',
    [
      '他们炸了我们的产业点，还准确掐中了交班时间。',
      '所有人分头备战；你负责收车、拆件、强化车辆，再和博一起反击。',
    ],
    '接受全员反击任务并确认自己的任务链',
    'garage-explosion',
    { kind: 'continue', label: '接受全员任务' },
  ),
  s(
    10,
    2,
    '9:10–10:00',
    '收车小游戏·地图点选废车',
    '收车首次出现',
    '博',
    ['任务地图上标了几台能回收的废车。', '依次确认点位，把它们送去废车场。'],
    '打开任务地图并确认多个废车点位',
    'scrapyard-salvage',
    { kind: 'wreck-collection', label: '打开收车任务地图' },
  ),
  s(
    11,
    2,
    '10:00–11:30',
    '前往废车场·批量拆车',
    '拆解与分拣',
    '沃尔特',
    [
      '废车已经排好，按顺序拆。',
      '把能用的零件和配件分开，下一步要强化全队车辆。',
    ],
    '批量拆解任务废车并取得强化材料',
    'scrapyard-salvage',
    { kind: 'car-dismantle', scenario: 'salvage-pair', label: '开始批量拆车' },
  ),
  s(
    12,
    2,
    '11:30–13:00',
    '强化大家的车辆',
    '全帮战力准备',
    '雨果',
    [
      '别只改你自己的车，这批配件要装给全队。',
      '做完提交任务，等金发带情报回来。',
    ],
    '为帮派成员车辆批量安装配件',
    'garage-repair',
    { kind: 'car-customize', scenario: 'repair-trio', label: '强化成员车辆' },
  ),
  s(
    13,
    2,
    '13:00–13:10',
    '金发带回情报·出发伏击',
    '兄弟一起做任务',
    '金发小哥',
    ['袭击者的路线和停靠点都在这里。', '车已经备好，我们一起去把账算清。'],
    '确认伏击路线并与金发小哥出发',
    'gang-convoy',
    { kind: 'continue', label: '出发伏击' },
  ),
  s(
    14,
    2,
    '13:10–14:20',
    '伏击袭击者车队',
    '兄弟协作',
    '金发小哥',
    ['我压住他们的头车，你从侧面切进去。', '主要目标一个都别放走。'],
    '完成枪战 SUP，击杀主要袭击者',
    'highway-gunfight',
    { kind: 'race', stage: 4, label: '伏击袭击者' },
  ),
  s(
    15,
    2,
    '14:20–14:40',
    '清理现场·与金发一起返城',
    '兄弟并肩',
    '金发小哥',
    ['目标确认清除，现场记录也拿到了。', '一起回城，把战果交给会长。'],
    '清理现场并与金发小哥安全返城',
    'gang-convoy',
    { kind: 'continue', label: '带战果返城' },
  ),
  s(
    16,
    2,
    '14:40–15:40',
    '提交全员任务·晋升入口点亮',
    '声望结算',
    '博',
    [
      '收车、拆车、强化和伏击都已完成。',
      '你的声望够了，Enforcer 晋升入口已经点亮。',
    ],
    '提交完整行动结果并查看晋升入口',
    'council-promotion',
    { kind: 'continue', label: '提交全员任务' },
    200,
  ),
  s(
    17,
    2,
    '15:40–16:40',
    'Enforcer 晋升·提出内奸调查',
    '授章与内部危机',
    '杰森',
    [
      '先确认你的 Enforcer 职责。',
      '连续袭击都太精准，帮里有内奸；调查任务交给你。',
    ],
    '在同一场会议完成晋升并接取内奸调查',
    'council-promotion',
    {
      kind: 'gang-tree',
      label: '申请 Enforcer 晋升',
      promotionTier: 3,
      meetingAfterPromotion: true,
    },
  ),
  s(
    18,
    2,
    '16:40–17:00',
    '会后试炼·开启两条并行线',
    '双线可任选先后',
    '杰森',
    [
      '靠自己的能力完成几项内部交接，让我看看你能做到什么。',
      '产业管理线和内奸调查线都要完成，但先做哪条由你决定。',
    ],
    '选择先执行产业线或调查线；两线完成后开放 L25',
    'council-promotion',
    { kind: 'parallel-choice', label: '选择先执行的任务线' },
  ),
  s(
    19,
    3,
    '17:00–18:00',
    '产业线·确认两名管理者交接',
    '产业管理线 1/3',
    '沃尔特',
    [
      '雨果守改装，我来负责废车与调度。',
      '先确认管理关系，再办理两座建筑的内部接管。',
    ],
    '在照片墙依次点击雨果与沃尔特，确认两名管理者的内部交接',
    'workshop-takeover',
    {
      kind: 'gang-tree',
      label: '确认两名产业管理者交接',
      rewardIds: ['hugo-garage-manager', 'walter-yard-manager'],
    },
  ),
  s(
    20,
    3,
    '18:00–19:20',
    '产业线·任意顺序接管两座建筑',
    '产业管理线 2/3',
    '沃尔特',
    ['改装厂和废车厂都等着你确认。', '两处可以任意先后，全部接管后再派遣。'],
    '任意顺序接管改装厂与废车回收厂',
    'workshop-takeover',
    {
      kind: 'building-claim-batch',
      buildingIds: ['repair-shop', 'recycling-yard'],
      label: '返回城市接管两座建筑',
    },
  ),
  s(
    21,
    3,
    '19:20–20:20',
    '产业线·废车厂自动化',
    '产业管理线 3/3',
    '沃尔特',
    [
      '把我派到废车场，回收和分拣就能持续运转。',
      '产业线完成后，去处理另一条试炼。',
    ],
    '建设废车回收厂并完成自动化派遣',
    'scrapyard-salvage',
    {
      kind: 'building-upgrade',
      buildingId: 'recycling-yard',
      label: '建设废车回收厂',
    },
  ),
  s(
    22,
    3,
    '20:20–21:00',
    '调查线·获得英雄协助',
    '内奸调查线 1/3',
    'Maeve Quinn',
    [
      '我能帮你追线索，但我要进入正式行动编队。',
      '先在英雄界面确认我，再去推关。',
    ],
    '获得首名推关英雄 Maeve 协助',
    'assassination-rescue',
    { kind: 'heroes', tab: 'level', label: '接受 Maeve 协助' },
  ),
  s(
    23,
    3,
    '21:00–22:40',
    '调查线·首次推关寻找线索',
    '内奸调查线 2/3',
    'Maeve Quinn',
    ['Thomas 留在后方负责产业线。', '我跟你连续推进五关，把接头人逼出来。'],
    '由 Maeve 作为首名推关英雄连续推进五关',
    'assassination-rescue',
    { kind: 'campaign', targetStage: 5, label: '推进五关寻找线索' },
  ),
  s(
    24,
    3,
    '22:40–23:40',
    '调查线·挡风玻璃逼问',
    '内奸调查线 3/3',
    '接头人',
    ['别开枪，我只知道代号和交接路线！', '真正的名字在会议桌上的账本里。'],
    '完成挡风玻璃逼问并取得内奸代号',
    'informant-interrogation',
    { kind: 'race', stage: 5, label: '开始特殊逼问 SUP' },
    350,
  ),
  s(
    25,
    3,
    '23:40–25:10',
    '双线汇合·晋升与紧急会议',
    'Roadman 晋升',
    '杰森',
    [
      '产业和调查两条线都完成了。',
      '科腾已经叛逃，还绑走了梅丽尔；你晋升 Roadman，立即去救人。',
    ],
    '两线汇合，晋升 Roadman 并进入紧急会议',
    'council-promotion',
    {
      kind: 'gang-tree',
      label: '申请 Roadman 晋升',
      promotionTier: 4,
      meetingAfterPromotion: true,
    },
  ),
  s(
    26,
    4,
    '25:10–25:30',
    '科腾抢走梅丽尔',
    '人质危机过渡',
    'Maeve Quinn',
    [
      '科腾趁会议结束从商业街后巷抢走了梅丽尔。',
      '我看清了车队方向，立刻追上去，不能让他带人出城。',
    ],
    '确认人质与逃跑方向，立即开始追踪营救',
    'assassination-rescue',
    { kind: 'continue', label: '追踪科腾车队' },
  ),
  s(
    27,
    4,
    '25:30–27:10',
    '新章·推关营救梅丽尔',
    '独立营救章节',
    'Maeve Quinn',
    ['科腾的人把梅丽尔押在前面的据点。', '连续推进五关，先把人救出来。'],
    '再推进五关，突破关押梅丽尔的据点',
    'assassination-rescue',
    { kind: 'campaign', targetStage: 10, label: '推进营救章节' },
  ),
  s(
    28,
    4,
    '27:10–28:10',
    '救出梅丽尔·取得科腾去向',
    '救援结算',
    '梅丽尔',
    ['科腾刚带人离开，我记得他的路线。', '带上我，我能帮你找到最后的落脚点。'],
    '救出梅丽尔并取得科腾逃亡路线',
    'assassination-rescue',
    { kind: 'continue', label: '带梅丽尔追击' },
  ),
  s(
    29,
    4,
    '28:10–31:10',
    '追杀科腾·执行叛徒制裁',
    '绝对制裁',
    '杰森',
    [
      '叛徒已经确认，不接受投降。',
      '追回商业街账本和管理钥匙，把科腾的问题彻底解决。',
    ],
    '完成追击枪战并取回商业街账本与钥匙',
    'highway-gunfight',
    { kind: 'race', stage: 6, label: '追杀科腾' },
    450,
  ),
  s(
    30,
    4,
    '31:10–34:10',
    '章节结算·晋升 Road Captain',
    '叛徒线结案',
    '杰森',
    [
      '梅丽尔获救，科腾已被制裁，证据和资产都回来了。',
      '议会授予你 Road Captain 背章，接管他留下的路线职责。',
    ],
    '完成章节会议并晋升 Road Captain',
    'council-promotion',
    {
      kind: 'gang-tree',
      label: '申请 Road Captain 晋升',
      promotionTier: 5,
      meetingAfterPromotion: true,
    },
  ),
  s(
    31,
    5,
    '34:10–35:40',
    '紧急接管商业街',
    '内部管理权交接',
    '梅丽尔',
    [
      '科腾留下的钥匙和账本都核对过了。',
      '现场人员会按 Road Captain 授权完成交接。',
    ],
    '使用管理钥匙接管商业街',
    'workshop-takeover',
    {
      kind: 'building-claim',
      buildingId: 'commercial-street',
      label: '接管商业街',
    },
  ),
  s(
    32,
    5,
    '35:40–37:10',
    '恢复商业街经营',
    '钱资源首次获得',
    '梅丽尔',
    ['先恢复商铺，再对完遗留账目。', '完成第一次收取，商业街才算真正稳定。'],
    '建设商业街并完成首次收取',
    'workshop-takeover',
    {
      kind: 'building-upgrade',
      buildingId: 'commercial-street',
      label: '恢复商业街经营',
    },
  ),
  s(
    33,
    5,
    '37:10–40:10',
    '斯宾塞交接·接管加油站',
    '燃油产业开启',
    '斯宾塞',
    ['我会交出路线图和管理钥匙。', '让我继续管现场，你来决定加油站的方向。'],
    '与斯宾塞完成职责交接并接管加油站',
    'workshop-takeover',
    {
      kind: 'gang-tree',
      label: '与斯宾塞交接',
      rewardId: 'spencer-gas-manager',
      buildingId: 'gas-station',
    },
  ),
  s(
    34,
    5,
    '40:10–43:10',
    '建设加油站',
    '油资源首次获得',
    '斯宾塞',
    ['修复泵机，再把首条补给路线接上。', '第一批油到账后，这条产业就能运转。'],
    '建设加油站并收取首批油',
    'garage-repair',
    {
      kind: 'building-upgrade',
      buildingId: 'gas-station',
      label: '建设加油站',
    },
    600,
  ),
  s(
    35,
    5,
    '43:10–45:10',
    '财务官晋升',
    '三席之一',
    '杰森',
    [
      '商业街和加油站都恢复了。',
      '议会授予你 Treasurer 职责，接下来统筹跨产业账目。',
    ],
    '复盘钱油产业并晋升 Treasurer',
    'council-promotion',
    {
      kind: 'gang-tree',
      label: '申请 Treasurer 晋升',
      promotionTier: 6,
      meetingAfterPromotion: true,
    },
  ),
  s(
    36,
    5,
    '45:10–49:10',
    '物流负责人交接·接管物流中心',
    '物资产线开启',
    '物流负责人',
    ['仓库、车辆和排班表都可以交接。', '我留下负责运行，你来接管物流中心。'],
    '与物流负责人完成职责交接并接管物流中心',
    'workshop-takeover',
    {
      kind: 'gang-tree',
      label: '与物流负责人交接',
      rewardId: 'logistics-manager',
      buildingId: 'metalworking-plant',
    },
  ),
  s(
    37,
    5,
    '49:10–52:30',
    '建设物流中心',
    '物资首次获得',
    '物流负责人',
    ['先修仓位，再排第一条运输线。', '第一批物资入库后，三类资源链就齐了。'],
    '建设物流中心并收取首批物资',
    'workshop-takeover',
    {
      kind: 'building-upgrade',
      buildingId: 'metalworking-plant',
      label: '建设物流中心',
    },
    700,
  ),
  s(
    38,
    6,
    '52:30–56:30',
    '武装队长切磋',
    '友好枪战晋升',
    '现任武装队长',
    [
      '补给已经齐了，接下来证明你能指挥战斗。',
      '这是一场帮内切磋，赢下来就接过职责。',
    ],
    '完成友好枪战并晋升 Sergeant-at-Arms',
    'highway-gunfight',
    { kind: 'race', stage: 7, label: '开始武装切磋', meetingAfter: true },
    800,
  ),
  s(
    39,
    6,
    '56:30–59:30',
    '追回本帮物资',
    '复合行动',
    '杰森',
    [
      '科腾的同党偷走了一批物流物资。',
      '清理三个藏点，护送物资返城并修复仓位。',
    ],
    '推进三关并追回本帮物资，晋升 Senior Members',
    'assassination-rescue',
    {
      kind: 'campaign',
      targetStage: 13,
      label: '追回本帮物资',
      followUpRaceStage: 8,
      meetingAfter: true,
    },
  ),
  s(
    40,
    6,
    '59:30–65:30',
    '汉克回归',
    '车队荣耀巡游',
    '博',
    [
      '汉克今天出狱，我们按标准车队阵型去接他。',
      '把人平安护送回来，旧成员关系也该重新归位。',
    ],
    '完成车队护送并确认汉克的新职责',
    'gang-convoy',
    { kind: 'race', stage: 9, label: '护送汉克返城' },
    1_000,
  ),
  s(
    41,
    6,
    '65:30–71:30',
    '副会长传统挑战',
    '竞速晋升仪式',
    '汉克',
    [
      '副会长的位置要靠传统挑战赢下来。',
      '选好改装和路线，带队返程，所有人都会看着。',
    ],
    '完成传统竞速并晋升 Vice President',
    'one-on-one-race',
    { kind: 'race', stage: 10, label: '开始副会长挑战', meetingAfter: true },
  ),
  s(
    42,
    6,
    '71:30–74:30',
    '副会长履职',
    '会长前最终职责',
    '杰森',
    [
      '在 Clubhouse 主持议会，再清理最后的叛徒残余。',
      '护送成员返城并修复建筑，证明你能代理整场行动。',
    ],
    '主持议会、推进三关并完成护送 SUP',
    'council-promotion',
    {
      kind: 'campaign',
      targetStage: 16,
      followUpRaceStage: 8,
      label: '完成副会长履职',
    },
    1_300,
  ),
  s(
    43,
    6,
    '74:30–75:00',
    '会长晋升事件',
    '最终木槌授章',
    '杰森',
    [
      '你的履职证明已经完整。',
      '由全体成员表决，把背章、木槌与主持权限交给新会长。',
    ],
    '完成全体选举并晋升 President',
    'council-promotion',
    {
      kind: 'gang-tree',
      label: '申请 President 晋升',
      promotionTier: 10,
      meetingAfterPromotion: true,
    },
  ),
]

export const STORY_COMPLETE_STEP = STORY_STEPS.length + 1

export function getStoryStep(stepNumber: number): StoryStep | null {
  return STORY_STEPS[stepNumber - 1] ?? null
}

export function getStoryRank(stepNumber: number): StoryRank {
  for (let index = STORY_RANKS.length - 1; index >= 0; index -= 1) {
    if (stepNumber >= STORY_RANKS[index].startsAtStep) return STORY_RANKS[index]
  }
  return STORY_RANKS[0]
}

export function getStoryReputation(stepNumber: number): number {
  return STORY_STEPS.filter((step) => step.number < stepNumber).reduce(
    (total, step) => total + step.reputationReward,
    0,
  )
}

export function getStoryVisibility(stepNumber: number) {
  return {
    heroes: stepNumber >= 22,
    gangTree: stepNumber >= 7,
    story: stepNumber >= 7,
    campaign: stepNumber >= 23,
    gangStatus: stepNumber >= 7,
    money: stepNumber >= 32,
    oil: stepNumber >= 34,
    materials: stepNumber >= 37,
  }
}

export function getStoryClaimBuildings(
  stepNumber: number,
): readonly BuildingId[] {
  const action = getStoryStep(stepNumber)?.action
  if (action?.kind === 'building-claim') return [action.buildingId]
  if (action?.kind === 'building-claim-batch') return action.buildingIds
  if (action?.kind === 'gang-tree' && action.buildingId)
    return [action.buildingId]
  return []
}

export function getStoryClaimBuilding(stepNumber: number): BuildingId | null {
  const buildings = getStoryClaimBuildings(stepNumber)
  return buildings.length === 1 ? buildings[0] : null
}
