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

export type StoryAction =
  | { kind: 'continue'; label: string }
  | {
      kind: 'race'
      stage: number
      label: string
      meetingAfter?: boolean
    }
  | { kind: 'heroes'; tab: DevelopmentTab; label: string }
  | {
      kind: 'car-customize'
      scenario: CarModificationScenario
      label: string
    }
  | {
      kind: 'car-dismantle'
      scenario: CarDismantleScenario
      label: string
    }
  | { kind: 'building-claim'; buildingId: BuildingId; label: string }
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
    promotionEvent: '加入帮派与照片墙开启',
    duty: '完成反伏击、收车拆解和竞速终考',
  },
  {
    tier: 2,
    title: 'Full Patch',
    chineseTitle: '正式成员',
    startsAtStep: 11,
    systemLevel: 8,
    reputationThreshold: 100,
    promotionEvent: '入会投票与正式授章',
    duty: '修复并接过改装厂，带领见习成员',
  },
  {
    tier: 3,
    title: 'Enforcer',
    chineseTitle: '打手',
    startsAtStep: 21,
    systemLevel: 16,
    reputationThreshold: 300,
    promotionEvent: '复仇结果与责任授予',
    duty: '接过废车回收厂并处理精准袭击',
  },
  {
    tier: 4,
    title: 'Roadman',
    chineseTitle: '路线成员',
    startsAtStep: 27,
    systemLevel: 24,
    reputationThreshold: 650,
    promotionEvent: '内奸线索嘉奖',
    duty: '恢复商业街并追查内奸真实身份',
  },
  {
    tier: 5,
    title: 'Road Captain',
    chineseTitle: '路线队长',
    startsAtStep: 31,
    systemLevel: 32,
    reputationThreshold: 1_100,
    promotionEvent: '叛徒制裁与路线授章',
    duty: '掌控道路、燃油与车队路线',
  },
  {
    tier: 6,
    title: 'Treasurer',
    chineseTitle: '财务官',
    startsAtStep: 35,
    systemLevel: 40,
    reputationThreshold: 1_700,
    promotionEvent: '救援与账本复盘',
    duty: '统筹钱、油、物资和物流账目',
  },
  {
    tier: 7,
    title: 'Sergeant-at-Arms',
    chineseTitle: '武装队长',
    startsAtStep: 38,
    systemLevel: 42,
    reputationThreshold: 2_400,
    promotionEvent: '帮内切磋',
    duty: '负责成员纪律与武装行动',
  },
  {
    tier: 8,
    title: 'Senior Members',
    chineseTitle: '元老成员',
    startsAtStep: 39,
    systemLevel: 44,
    reputationThreshold: 3_200,
    promotionEvent: '产业防卫复盘',
    duty: '参与核心表决并协调多条产业线',
  },
  {
    tier: 9,
    title: 'Vice President',
    chineseTitle: '副会长',
    startsAtStep: 41,
    systemLevel: 46,
    reputationThreshold: 4_200,
    promotionEvent: '传统竞速与车队授位',
    duty: '主持 Clubhouse 与全城日常调度',
  },
  {
    tier: 10,
    title: 'President',
    chineseTitle: '会长',
    startsAtStep: 43,
    systemLevel: 50,
    reputationThreshold: 5_500,
    promotionEvent: '全体选举与会长授章',
    duty: '统领帮派与整座城市的管理网络',
  },
]

function storyStep(
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
  reputationReward: number,
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
  storyStep(
    1,
    0,
    '00:00',
    '警匪追逐',
    '无人机下压',
    'Thomas Shelby',
    [
      '警方从州界一路咬住我，灰狐已经快撑不住了。',
      '先利用岔路和障碍甩掉他们；只要冲出封锁，我就还有活路。',
    ],
    '完成第一次警匪追逐 SUP，以闪避、择路和甩脱为主。',
    'police-chase',
    { kind: 'race', stage: 1, label: '进入 SUP · 甩开警方' },
    15,
  ),
  storyStep(
    2,
    0,
    '01:20',
    '摩托帮成员分流警方',
    '兄弟接应',
    'Bo Montgomery',
    [
      '跟紧我的后轮。其他人会按队形分开，把警车引去不同岔路。',
      '等警灯从后视镜里消失，再跟我去接应点。别让任何一辆警车看见你的落脚处。',
    ],
    '跟随车队变换队形，确认警方已经被分流。',
    'gang-convoy',
    { kind: 'continue', label: '跟紧车队完成分流' },
    10,
  ),
  storyStep(
    3,
    0,
    '01:50',
    '黑手党伏击反击',
    '接应点突袭',
    'Bo Montgomery',
    [
      '警察刚退，黑手党就从岔路撞了进来。他们打坏了你的车，也把我们堵在公路上。',
      '我会跟你同屏压住侧翼；你用公用枪架持续射击，把头车打烂。',
    ],
    '与 Bo 协作完成枪战 SUP，击退伏击车队。',
    'cargo-ambush',
    { kind: 'race', stage: 2, label: '进入 SUP · 反击伏兵' },
    25,
  ),
  storyStep(
    4,
    0,
    '03:10',
    '拖走玩家车辆与任务进度',
    '见习任务 1 / 3',
    'Bo Montgomery',
    [
      '你的车已经开不回去，我们会把它挂上拖车带回修车厂。',
      '你守住了接应点，这算第一项转正任务。打开照片墙，看看自己现在站在哪一层。',
    ],
    '查看帮派照片墙，确认 Prospect 转正任务进度 1 / 3。',
    'tow-convoy',
    {
      kind: 'gang-tree',
      label: '首次查看帮派照片墙',
      continueLabel: '确认转正进度 1 / 3',
    },
    10,
  ),
  storyStep(
    5,
    1,
    '03:20',
    '搭乘返城与见习任务说明',
    '任务系统开启',
    'Bo Montgomery',
    [
      '这座城和产业本来就属于帮派；职位决定你能调动多少人、能碰哪把钥匙。',
      '任务板还差两项：收一辆车拆出强化件，再赢下我的竞速终考。先完成一次成长升级。',
    ],
    '查看任务清单，在帮派树完成一次见习成长升级。',
    'gang-convoy',
    {
      kind: 'gang-tree',
      label: '进入帮派树 · 完成成长升级',
      continueLabel: '完成一次成长升级',
    },
    10,
  ),
  storyStep(
    6,
    1,
    '04:50',
    '首次收车与废车拆解',
    '核心循环首次出现',
    'Bo Montgomery',
    [
      '这辆无人认领的黑市车已经被帮派收回，不能直接拿去上路。',
      '把它送进废车场，按轮组、动力和车壳拆开；零件留下，氮气装置装到你自己的车上。',
    ],
    '完成首次 3D 拆车，获得零件与氮气装置，转正进度 2 / 3。',
    'scrapyard-salvage',
    {
      kind: 'car-dismantle',
      scenario: 'salvage-single',
      label: '进入 3D 首次拆车工位',
    },
    15,
  ),
  storyStep(
    7,
    1,
    '06:30',
    '给自己的车装上氮气',
    '车辆养成开启',
    'Bo Montgomery',
    [
      '拆出来的氮气装置还能用，但管线和固定架必须重新装。',
      '把它装进灰狐，消耗零件完成调校。下一场一对一就是你的最终考核。',
    ],
    '在 3D 工位安装氮气装置并完成点火测试。',
    'garage-repair',
    {
      kind: 'car-customize',
      scenario: 'nitrous-install',
      label: '进入 3D 氮气安装工位',
    },
    5,
  ),
  storyStep(
    8,
    1,
    '08:00',
    '与金发小哥 1v1 竞速终考',
    '转正最终考核',
    'Bo Montgomery',
    [
      '今天没有第三名，只有你和我。主动用氮气完成超车，先冲过桥下的人赢。',
      '赢下这场，你的三项见习任务就全部完成，我会把名字带到议会桌上。',
    ],
    '完成 1v1 竞速 SUP，主动释放氮气并赢下终考。',
    'one-on-one-race',
    { kind: 'race', stage: 4, label: '进入 SUP · 1v1 竞速终考' },
    10,
  ),
  storyStep(
    9,
    1,
    '09:30',
    '骑行返程与正式邀请',
    '转正任务 3 / 3',
    'Bo Montgomery',
    [
      '竞速、拆车和反伏击都已经记进任务板，三项见习证明齐了。',
      '按标准队形回 Clubhouse。抵达后提交任务，晋升入口会在照片墙上点亮。',
    ],
    '随车队返程并提交全部见习任务。',
    'gang-convoy',
    { kind: 'continue', label: '返程并提交转正任务' },
    0,
  ),
  storyStep(
    10,
    1,
    '10:20',
    '点击晋升·首次议会转正',
    '完整补丁',
    'Jason “Rusty” Montgomery',
    [
      'Thomas 已完成三项见习任务，声望也达到一百。先由他在照片墙提出晋升申请。',
      '申请确认后，全体成员按职级落座并表决；木槌落下，才授予正式背章。',
    ],
    '在帮派树点击晋升 Full Patch，再参加首次评定会议。',
    'council-promotion',
    {
      kind: 'gang-tree',
      label: '打开照片墙 · 申请晋升',
      promotionTier: 2,
      meetingAfterPromotion: true,
    },
    0,
  ),
  storyStep(
    11,
    2,
    '11:50',
    '前往接管·改装厂先遭袭',
    '交接被打断',
    'Bo Montgomery',
    [
      '会议刚把改装厂职责交给你，黑手党就抢先炸了工位。交接还没完成，他们想让你接到一片废墟。',
      '我先把你从火场带出来，再去找袭击车队的路线。你留下，和 Hugo 恢复最低维修能力。',
    ],
    '前往改装厂，接取应急修复与复仇准备任务。',
    'garage-explosion',
    { kind: 'continue', label: '进入受袭改装厂' },
    15,
  ),
  storyStep(
    12,
    2,
    '12:50',
    '接管前应急修复',
    '恢复工位',
    'Hugo Vale',
    [
      '爆炸掀翻了供电箱，也让第一座工位停摆。现在交钥匙只会把问题推给你。',
      '先清掉残骸、恢复供电并扶正设备；工位重新亮灯后，我们再按帮派规矩完成交接。',
    ],
    '清理爆炸残骸并升级改装厂首个工位。',
    'garage-repair',
    {
      kind: 'building-upgrade',
      buildingId: 'repair-shop',
      label: '修复改装厂工位',
    },
    20,
  ),
  storyStep(
    13,
    2,
    '13:30',
    '收复 Hugo·正式接管改装厂',
    'N-1 收复教学',
    'Hugo Vale',
    [
      '工位已经恢复。我是 T1 见习层的修车负责人，而你现在位于 T2。',
      '按 N-1 规则，你只能收复前一层成员。点击我的照片，再到地图入口让小锤落下，交接才正式生效。',
    ],
    '在照片墙收复 Hugo，再到地图完成改装厂内部管理交接。',
    'workshop-takeover',
    {
      kind: 'gang-tree',
      rewardId: 'hugo-garage-manager',
      buildingId: 'repair-shop',
      label: '打开照片墙 · 收复 Hugo',
    },
    20,
  ),
  storyStep(
    14,
    2,
    '14:30',
    '收复一名见习·取得废车',
    'N-1 横向收集',
    'T1 见习帮手',
    [
      '我已经把一辆能拆的废车拖到场外。它不能参加比赛，但足够拆出强化灰狐的材料。',
      '把我的照片翻到“已归队”，这辆任务车和后续拆解职责就一起交给你。',
    ],
    '在照片墙收复 T1 见习帮手，获得任务废车。',
    'tow-convoy',
    {
      kind: 'gang-tree',
      rewardId: 'prospect-wreck-runner',
      label: '打开照片墙 · 收复见习帮手',
    },
    15,
  ),
  storyStep(
    15,
    2,
    '15:20',
    '废车回收站拆车',
    '材料回收',
    'Hugo Vale',
    [
      '见习带回的废车已经固定到拆解台，别把还能用的东西连车壳一起压掉。',
      '先分离轮组、动力和车壳，留下零件与配件，下一步直接强化灰狐。',
    ],
    '在 3D 拆车台完成废车拆解与配件分拣。',
    'scrapyard-salvage',
    {
      kind: 'car-dismantle',
      scenario: 'salvage-single',
      label: '进入 3D 废车拆解台',
    },
    20,
  ),
  storyStep(
    16,
    2,
    '16:50',
    '直接强化玩家车辆',
    '配件安装',
    'Hugo Vale',
    [
      '刚拆出的悬挂比灰狐现在这套完整，零件也足够完成一次调校。',
      '回到改装厂，拆下弯曲悬挂、装好回收件并做四轮定位。强化必须真正落在你的车上。',
    ],
    '在 3D 工位安装回收悬挂并完成定位。',
    'garage-repair',
    {
      kind: 'car-customize',
      scenario: 'race-prep',
      label: '进入 3D 配件安装工位',
    },
    20,
  ),
  storyStep(
    17,
    2,
    '18:20',
    'Bo 带回情报·出发伏击',
    '复仇路线确认',
    'Bo Montgomery',
    [
      '袭击者沿北线往返，我已经把他们的加油点和回城路线标在地图上。',
      '灰狐强化完成，我们不再等下一次炸弹。确认伏击点，一起把主要袭击者留在公路上。',
    ],
    '提交车辆强化目标并确认伏击路线。',
    'workshop-takeover',
    { kind: 'continue', label: '确认伏击路线并出发' },
    20,
  ),
  storyStep(
    18,
    2,
    '19:10',
    '伏击袭击者车队',
    '主动反击',
    'Bo Montgomery',
    [
      '头车进入射界，别让他们再靠近帮派产业。普通攻击会自动压制，你负责把强化火力留给关键目标。',
      '我会封住侧路。摧毁主要车辆，确认这批袭击者再也回不到城里。',
    ],
    '完成枪战 SUP，摧毁袭击者主要车辆。',
    'highway-gunfight',
    { kind: 'race', stage: 5, label: '进入 SUP · 伏击车队' },
    35,
  ),
  storyStep(
    19,
    2,
    '20:20',
    'Bo 为保护玩家牺牲',
    '背章与遗物',
    'Bo Montgomery',
    [
      '主要敌人已经倒下，但残敌从死角抬枪——Thomas，趴下！',
      '把我的背章带回 Clubhouse。告诉他们，袭击者知道我们每一次行动，帮派里还有人在泄密。',
    ],
    '取回 Bo 的背章与遗物，并将他带回城市。',
    'blond-sacrifice',
    { kind: 'continue', label: '带 Bo 与背章返城' },
    35,
  ),
  storyStep(
    20,
    2,
    '21:50',
    '追悼复盘与 Enforcer 晋升',
    '责任授予',
    'Jason “Rusty” Montgomery',
    [
      'Bo 的背心和遗物留在纪念位。你完成了复仇，也把内鬼警告带回了桌边。',
      '声望达到三百。点击申请 Enforcer，会议会用木槌确认你接过他留下的责任。',
    ],
    '在照片墙申请晋升 Enforcer，并参加追悼评定。',
    'memorial-succession',
    {
      kind: 'gang-tree',
      label: '打开照片墙 · 申请 Enforcer',
      promotionTier: 3,
      meetingAfterPromotion: true,
    },
    0,
  ),
  storyStep(
    21,
    2,
    '22:50',
    '收复 Walter·获得废车回收厂',
    'T3 → T2 收复',
    'Walter Vale',
    [
      '我在 T2 正式成员层负责回收厂，钥匙和零件账都等着新的上级确认。',
      '你已经到 T3，只能向下收复一层。翻开我的照片，再到建筑入口完成内部接管。',
    ],
    '收复 Walter，取得废车回收厂与零件功能。',
    'workshop-takeover',
    {
      kind: 'gang-tree',
      rewardId: 'walter-yard-manager',
      buildingId: 'recycling-yard',
      label: '打开照片墙 · 收复 Walter',
    },
    50,
  ),
  storyStep(
    22,
    2,
    '23:20',
    '建设废车回收厂',
    '拆解线恢复',
    'Walter Vale',
    [
      '管理权已经生效，但第一条分拣线仍停在袭击后的损坏状态。',
      '升级拆解工位，让回收厂具备正式生产条件；工位稳定后，成员派遣位才会开放。',
    ],
    '升级废车回收厂首个工位，开放成员派遣。',
    'scrapyard-salvage',
    {
      kind: 'building-upgrade',
      buildingId: 'recycling-yard',
      label: '升级废车回收厂工位',
    },
    50,
  ),
  storyStep(
    23,
    2,
    '24:20',
    '派遣自动化与英雄救场',
    '精准刺杀',
    'Maeve “Red” Quinn',
    [
      '你刚把成员派进回收厂，黑手党的摩托就准确找到了新工位。我撞开他们，才保住这条线。',
      '连续袭击都能锁定你的位置，内部一定有人报信。会长派我加入行动队：你看线索，我带人清场。',
    ],
    '确认回收厂自动运行，并让首名英雄 Maeve 加入调查。',
    'assassination-rescue',
    { kind: 'continue', label: '接受 Maeve 的调查支援' },
    50,
  ),
  storyStep(
    24,
    3,
    '25:20',
    '首次推关·寻找内奸线索',
    '五处联络点',
    'Maeve “Red” Quinn',
    [
      '袭击者的联络链通向五个城外据点。Thomas 留在后方拼通信记录，不需要进入战场。',
      '把我编进行动队，从最外围逐个打进去；第五处留一个活口，我们要拿到接头人的位置。',
    ],
    '以 Maeve 为首名推关英雄连续完成 5 关。',
    'informant-interrogation',
    {
      kind: 'campaign',
      targetStage: 5,
      label: '进入推关 · 清理五个据点',
    },
    120,
  ),
  storyStep(
    25,
    3,
    '27:30',
    '挡风玻璃逼问',
    '内奸代号',
    'Maeve “Red” Quinn',
    [
      '五处记录拼出了接头人的路线。我会把俘虏固定在肌肉车挡风玻璃上，让他没有躲开的地方。',
      '高速压迫、甩掉追兵，逼他交代内奸代号。真实姓名可以以后查，今晚先拿到能继续追的线。',
    ],
    '完成定制追击 SUP，逼问出内奸代号。',
    'informant-interrogation',
    { kind: 'race', stage: 6, label: '进入 SUP · 挡风玻璃逼问' },
    80,
  ),
  storyStep(
    26,
    3,
    '28:30',
    '提交线索·晋升 Roadman',
    '内奸调查嘉奖',
    'Jason “Rusty” Montgomery',
    [
      '五个据点和接头人口供都已经入档，内奸代号足够打开下一阶段调查。',
      '声望达到六百五十。提交章节任务，在照片墙申请 Roadman，再由会议确认新的路线职责。',
    ],
    '完成章节任务，点击晋升 Roadman 并参加确认会议。',
    'council-promotion',
    {
      kind: 'gang-tree',
      label: '打开照片墙 · 申请 Roadman',
      promotionTier: 4,
      meetingAfterPromotion: true,
    },
    0,
  ),
  storyStep(
    27,
    3,
    '29:30',
    '收复 Koten·接管商业街',
    'T4 → T3 收复',
    'Koten Vance',
    [
      '我在 T3 负责商业街的旧账，里面藏着内鬼和黑手党往来的资金痕迹。',
      '你已到 T4。先完成我的收复任务，再接过街区钥匙；钱和消息都会先到你的桌上。',
    ],
    '收复 Koten，取得商业街与钱功能。',
    'workshop-takeover',
    {
      kind: 'gang-tree',
      rewardId: 'koten-street-manager',
      buildingId: 'commercial-street',
      label: '打开照片墙 · 收复 Koten',
    },
    100,
  ),
  storyStep(
    28,
    3,
    '31:00',
    '建设商业街与支付佣金',
    '钱资源解锁',
    'Caleb Olson',
    [
      '袭击让几家店面停业，账目也断了。先恢复商铺，收回第一笔钱。',
      '再付清警长的约定份额，他才会继续提供道路消息；商业街从此稳定产钱。',
    ],
    '升级商业街首个店面并收取第一笔钱。',
    'garage-repair',
    {
      kind: 'building-upgrade',
      buildingId: 'commercial-street',
      label: '恢复商业街经营',
    },
    100,
  ),
  storyStep(
    29,
    3,
    '32:30',
    '庆功酒变成叛徒审判',
    '内部越界',
    'Jason “Rusty” Montgomery',
    [
      '商业街账目与据点口供相互印证：把路线卖给黑手党的人，是路线队长 Billy Cruz。',
      '今晚表决摘除他的背章和职位。若他拒绝裁决，车队就上路把帮派财产追回来。',
    ],
    '参加议会，表决摘除 Billy 的背章。',
    'council-promotion',
    { kind: 'meeting', label: '参加叛徒审判会议' },
    100,
  ),
  storyStep(
    30,
    3,
    '34:30',
    '追击 Billy 与路线授章',
    '绝对制裁',
    'Maeve “Red” Quinn',
    [
      '木槌刚落，Billy 就带着路线图冲上北线；逃跑已经替他承认了全部指控。',
      '追上他，取回背章和路线图。返城后会议会确认你晋升 Road Captain。',
    ],
    '完成追击 SUP，执行裁决并接受路线队长授章。',
    'one-on-one-race',
    {
      kind: 'race',
      stage: 7,
      label: '进入 SUP · 追击 Billy',
      meetingAfter: true,
    },
    150,
  ),
  storyStep(
    31,
    3,
    '37:30',
    '收复 Spencer·接管加油站',
    'T5 → T4 收复',
    'Spencer Manson',
    [
      '我在 T4 管理加油站和补给路线，Billy 逃跑前篡改了几张油单。',
      '你已到 T5。完成我的线索任务并翻开照片，我就把路线图、钥匙和油账全部交给你。',
    ],
    '收复 Spencer，取得加油站与油功能。',
    'workshop-takeover',
    {
      kind: 'gang-tree',
      rewardId: 'spencer-gas-manager',
      buildingId: 'gas-station',
      label: '打开照片墙 · 收复 Spencer',
    },
    180,
  ),
  storyStep(
    32,
    3,
    '40:30',
    '建设加油站',
    '油资源解锁',
    'Spencer Manson',
    [
      '管理权已经交接，但第一座泵岛长期欠修，现有储量撑不起车队。',
      '修复泵机、安排补给路线并收取首批油；从此所有长途行动都有稳定燃料。',
    ],
    '升级加油站首个泵岛，收取第一批油。',
    'garage-repair',
    {
      kind: 'building-upgrade',
      buildingId: 'gas-station',
      label: '修复加油站泵岛',
    },
    200,
  ),
  storyStep(
    33,
    4,
    '43:30',
    '解救 Merrill·追回物流账本',
    '兄弟不会被丢下',
    'Maeve “Red” Quinn',
    [
      'Billy 的同党绑走了 Merrill，想在东边仓库烧掉能牵出物流线的账本。',
      '带队打穿三个据点，把她和账本一起带回来。人和证据，一个都不能丢。',
    ],
    '连续完成 3 个推关关卡，救回 Merrill 并取得物流账本。',
    'assassination-rescue',
    {
      kind: 'campaign',
      targetStage: 8,
      label: '进入推关 · 解救 Merrill',
    },
    220,
  ),
  storyStep(
    34,
    4,
    '47:30',
    '账本复盘·晋升 Treasurer',
    '财务责任',
    'Merrill Gray',
    [
      '你救回了我，也把完整物流账本带回桌边。钱、油和物资终于能在同一轮复盘里对上。',
      '声望达到一千七百。申请 Treasurer，会议会确认你负责整个帮派的资源账。',
    ],
    '在照片墙申请晋升 Treasurer，并参加账本复盘会议。',
    'council-promotion',
    {
      kind: 'gang-tree',
      label: '打开照片墙 · 申请 Treasurer',
      promotionTier: 6,
      meetingAfterPromotion: true,
    },
    0,
  ),
  storyStep(
    35,
    4,
    '49:30',
    '收复物流负责人·接管物流中心',
    'T6 → T5 收复',
    '物流负责人',
    [
      '我在 T5 负责物流中心、仓位和运输排班。追回的账本已经证明哪几条线路被人动过手脚。',
      '你已到 T6。完成收复任务后，我会把仓库、车辆和排班表逐项交给你。',
    ],
    '收复物流负责人，取得物流中心与物资功能。',
    'workshop-takeover',
    {
      kind: 'gang-tree',
      rewardId: 'logistics-manager',
      buildingId: 'metalworking-plant',
      label: '打开照片墙 · 收复物流负责人',
    },
    220,
  ),
  storyStep(
    36,
    4,
    '54:30',
    '建设物流中心',
    '物资资源解锁',
    '物流负责人',
    [
      '仓位和车辆已经交接，但首条运输线仍停摆，账面库存没有意义。',
      '修复仓位、安排人员和第一趟运输。首批物资入库后，三种经营资源才真正形成循环。',
    ],
    '升级物流中心首个仓位并收取第一批物资。',
    'garage-repair',
    {
      kind: 'building-upgrade',
      buildingId: 'metalworking-plant',
      label: '恢复物流中心运输线',
    },
    230,
  ),
  storyStep(
    37,
    5,
    '58:30',
    '武装队长切磋',
    '帮内友好枪战',
    'Ray Harlan',
    [
      '人、钱、油和物资都已经恢复。下一步要证明你能约束武装力量，而不是只会调账。',
      '这是一场帮内追击枪战，打的是判断，不是仇。赢下后，会议会确认你为 Sergeant-at-Arms。',
    ],
    '完成友好枪战 SUP，并接受武装队长晋升确认。',
    'highway-gunfight',
    {
      kind: 'race',
      stage: 8,
      label: '进入 SUP · 武装切磋',
      meetingAfter: true,
    },
    250,
  ),
  storyStep(
    38,
    5,
    '62:30',
    '追回本帮物资',
    '产业防卫复盘',
    'Maeve “Red” Quinn',
    [
      'Billy 的残党盗走物流中心物资，还用最后几处藏点拖住追兵。',
      '先清掉三个据点，再把物资护送返城并修好仓位；完成整套行动，元老席会向你开放。',
    ],
    '完成 3 个推关关卡、护送物资返城，并参加元老评定。',
    'cargo-ambush',
    {
      kind: 'campaign',
      targetStage: 11,
      label: '进入推关 · 追回本帮物资',
      meetingAfter: true,
    },
    800,
  ),
  storyStep(
    39,
    5,
    '68:30',
    'Hank 回归',
    '车队荣耀巡游',
    'Jason “Rusty” Montgomery',
    [
      'Hank 今天出狱，他带着能清算旧关系的账本，也有人不想让他回到 Clubhouse。',
      '按标准车队阵型完成护送。返城后议会会确认他的新职责，并把你的名字送进副会长挑战。',
    ],
    '完成车队护送 SUP，迎接 Hank 回归。',
    'gang-convoy',
    { kind: 'race', stage: 9, label: '进入 SUP · 护送 Hank' },
    400,
  ),
  storyStep(
    40,
    5,
    '74:30',
    '副会长传统挑战',
    '竞速仪式',
    'Wayne “Gus” Kowalski',
    [
      '副会长不只靠举手产生。先选好改装和路线，再按传统与我跑一场。',
      '赢下比赛后带领车队按阵型返城；全体成员会在终点见证你进入 Vice President 席位。',
    ],
    '完成副会长传统竞速，并带队返城接受授位。',
    'one-on-one-race',
    {
      kind: 'race',
      stage: 10,
      label: '进入 SUP · 副会长传统挑战',
      meetingAfter: true,
    },
    600,
  ),
  storyStep(
    41,
    5,
    '80:30',
    '副会长履职',
    '全城调度',
    'Jason “Rusty” Montgomery',
    [
      '你已经主持 Clubhouse 日常事务，但会长席位不会只凭一场竞速决定。',
      '调动钱、油和物资清理三个残余据点，再护送成员返城并恢复受损产业，证明你能统筹全城。',
    ],
    '完成 3 个推关关卡，再进行一次车队护送 SUP。',
    'workshop-takeover',
    {
      kind: 'campaign',
      targetStage: 14,
      label: '进入推关 · 履行副会长职责',
      followUpRaceStage: 9,
    },
    1_300,
  ),
  storyStep(
    42,
    5,
    '88:00',
    '会长晋升事件',
    '最终声望·木槌授章',
    'Jason “Rusty” Montgomery',
    [
      '你以副会长身份完成了全城行动，六条管理线都接受你的调度，声望达到五千五百。',
      '现在由你在照片墙提出会长申请。全体成员表决后，我会交出木槌、背章和主持位置。',
    ],
    '申请晋升 President，参加最终选举并完成和平交接。',
    'council-promotion',
    {
      kind: 'gang-tree',
      label: '打开照片墙 · 申请 President',
      promotionTier: 10,
      meetingAfterPromotion: true,
    },
    0,
  ),
]

export const STORY_COMPLETE_STEP = STORY_STEPS.length + 1

export function getStoryStep(stepNumber: number): StoryStep | null {
  return STORY_STEPS[stepNumber - 1] ?? null
}

export function getStoryRank(stepNumber: number): StoryRank {
  for (let index = STORY_RANKS.length - 1; index >= 0; index -= 1) {
    if (stepNumber >= STORY_RANKS[index].startsAtStep) {
      return STORY_RANKS[index]
    }
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
    heroes: stepNumber >= 23,
    gangTree: stepNumber >= 4,
    story: stepNumber >= 5,
    campaign: stepNumber >= 24,
    gangStatus: stepNumber >= 4,
    money: stepNumber >= 28,
    oil: stepNumber >= 32,
    materials: stepNumber >= 36,
  }
}

export function getStoryClaimBuilding(stepNumber: number): BuildingId | null {
  const action = getStoryStep(stepNumber)?.action
  if (action?.kind === 'building-claim') return action.buildingId
  return action?.kind === 'gang-tree' && action.buildingId
    ? action.buildingId
    : null
}
