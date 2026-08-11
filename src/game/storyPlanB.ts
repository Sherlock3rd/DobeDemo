import type { BuildingId } from './cityTypes'
import type { DevelopmentTab } from '../ui/HeroesPanel'

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

export type StoryAction =
  | { kind: 'continue'; label: string }
  | { kind: 'race'; stage: number; label: string }
  | { kind: 'heroes'; tab: DevelopmentTab; label: string }
  | { kind: 'car-customize'; label: string }
  | { kind: 'car-dismantle'; label: string }
  | { kind: 'building-claim'; buildingId: BuildingId; label: string }
  | { kind: 'building-upgrade'; buildingId: BuildingId; label: string }
  | { kind: 'campaign'; targetStage: number; label: string }
  | { kind: 'gang-tree'; label: string }
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
}

export interface StoryRank {
  tier: number
  title: string
  chineseTitle: string
  startsAtStep: number
  systemLevel: number
  duty: string
}

export const STORY_RANKS: readonly StoryRank[] = [
  {
    tier: 1,
    title: 'Prospect',
    chineseTitle: '见习',
    startsAtStep: 1,
    systemLevel: 1,
    duty: '证明自己，熟悉修车厂与公路规矩',
  },
  {
    tier: 2,
    title: 'Full Patch',
    chineseTitle: '正式成员',
    startsAtStep: 11,
    systemLevel: 8,
    duty: '接管修车厂管理权，开始带领见习成员',
  },
  {
    tier: 3,
    title: 'Enforcer',
    chineseTitle: '执行者',
    startsAtStep: 23,
    systemLevel: 16,
    duty: '接管废车回收厂，替帮派处理威胁',
  },
  {
    tier: 4,
    title: 'Roadman',
    chineseTitle: '道路成员',
    startsAtStep: 28,
    systemLevel: 24,
    duty: '接管商业街，维持镇上的现金网络',
  },
  {
    tier: 5,
    title: 'Road Captain',
    chineseTitle: '路线队长',
    startsAtStep: 32,
    systemLevel: 32,
    duty: '接管加油站，掌控车队路线与燃油',
  },
  {
    tier: 6,
    title: 'Treasurer',
    chineseTitle: '财务官',
    startsAtStep: 36,
    systemLevel: 40,
    duty: '接管金属加工厂，统筹帮派物资',
  },
  {
    tier: 7,
    title: 'Sergeant-at-Arms',
    chineseTitle: '纪律官',
    startsAtStep: 39,
    systemLevel: 42,
    duty: '负责成员纪律与武装行动',
  },
  {
    tier: 8,
    title: 'Senior Member',
    chineseTitle: '资深成员',
    startsAtStep: 40,
    systemLevel: 44,
    duty: '参与核心表决，协调多条行动线',
  },
  {
    tier: 9,
    title: 'Vice President',
    chineseTitle: '副主席',
    startsAtStep: 42,
    systemLevel: 46,
    duty: '代行主席职责，管理 Clubhouse',
  },
  {
    tier: 10,
    title: 'President',
    chineseTitle: '主席',
    startsAtStep: 44,
    systemLevel: 50,
    duty: '统领帮派与整座城市的管理网络',
  },
]

export const STORY_STEPS: readonly StoryStep[] = [
  {
    number: 1,
    act: 0,
    time: '00:00',
    title: '警灯咬住后视镜',
    kicker: '亡命入城',
    speaker: 'Thomas Shelby',
    lines: [
      '警察从州界一路追到这里。再被贴住一分钟，这辆车和我都会留在公路上。',
    ],
    objective: '驾驶灰狐旧改车甩开警察。',
    artwork: 'police-chase',
    action: { kind: 'race', stage: 1, label: '进入 SUP · 甩开警察' },
  },
  {
    number: 2,
    act: 0,
    time: '01:20',
    title: '陌生车队切开包围',
    kicker: '车队接应',
    speaker: 'Bo Carter',
    lines: ['跟紧金发骑手。我们替你分走警车，但你得证明自己配得上这条路。'],
    objective: '跟随帮派车队变换队形，驶向小镇。',
    artwork: 'gang-convoy',
    action: { kind: 'continue', label: '跟紧车队' },
  },
  {
    number: 3,
    act: 0,
    time: '02:00',
    title: '黑手党从岔路截杀',
    kicker: '伏击反击',
    speaker: 'Bo Carter',
    lines: ['他们不是冲警察来的，是冲我们。拿起后座的公用枪架，把头车打下来！'],
    objective: '在追击枪战中摧毁伏击车队。',
    artwork: 'cargo-ambush',
    action: { kind: 'race', stage: 2, label: '进入 SUP · 反击伏兵' },
  },
  {
    number: 4,
    act: 0,
    time: '03:00',
    title: '车坏了，人还活着',
    kicker: '拖车撤离',
    speaker: 'Bo Carter',
    lines: [
      '把他的车挂到拖绳上。能从这场伏击里活着出来，算他完成了第一份见习差事。',
    ],
    objective: '随拖车队撤回小镇，见习职责 1/3。',
    artwork: 'tow-convoy',
    action: { kind: 'continue', label: '随拖车撤回小镇' },
  },
  {
    number: 5,
    act: 1,
    time: '03:20',
    title: '这座城本来就是我们的',
    kicker: '帮派规矩',
    speaker: 'Bo Carter',
    lines: [
      '这里没有外人的地盘。你能得到多少管理权，只取决于你在帮派里坐到什么位置。',
    ],
    objective: '查看纵向帮派树，认识职位与管理权限。',
    artwork: 'tow-convoy',
    action: { kind: 'gang-tree', label: '查看帮派权力树' },
  },
  {
    number: 6,
    act: 1,
    time: '04:30',
    title: '先把三辆车送回路上',
    kicker: '修车厂使用权',
    speaker: 'Arthur Shelby',
    lines: [
      '你现在只能使用修车厂，不能管理它。修好自己的车，再替两个兄弟处理损伤。',
    ],
    objective: '完成三辆车的维修，首次获得钱。见习职责 2/3。',
    artwork: 'garage-repair',
    action: { kind: 'continue', label: '完成三辆车的维修' },
  },
  {
    number: 7,
    act: 1,
    time: '06:00',
    title: '一件能救命的好配件',
    kicker: '车辆养成',
    speaker: 'Arthur Shelby',
    lines: ['旧引擎撑不到下一次追击。把这个调校件换上，之后这把枪也归你保管。'],
    objective: '进入 3D 改车工位，拆下损坏引擎并安装调校引擎。',
    artwork: 'garage-repair',
    action: { kind: 'car-customize', label: '进入 3D 改车工位' },
  },
  {
    number: 8,
    act: 1,
    time: '07:20',
    title: '夺回被截走的货',
    kicker: '第一次带枪出车',
    speaker: 'Bo Carter',
    lines: [
      '刚才那批人带走了我们的货。追上去，枪会自动压制，你只管找准强化火力的时机。',
    ],
    objective: '突袭运输车队，夺回货物并首次获得声望。见习职责 3/3。',
    artwork: 'highway-gunfight',
    action: { kind: 'race', stage: 3, label: '进入 SUP · 夺回货物' },
  },
  {
    number: 9,
    act: 1,
    time: '09:00',
    title: '按队形回家',
    kicker: '正式邀请',
    speaker: 'Bo Carter',
    lines: ['三件差事都办完了。跟在我右后方回去，桌边会有人提出你的名字。'],
    objective: '随车队回到 Clubhouse，等待第一次评定会议。',
    artwork: 'gang-convoy',
    action: { kind: 'continue', label: '返回 Clubhouse' },
  },
  {
    number: 10,
    act: 1,
    time: '10:00',
    title: '第一次坐到桌边',
    kicker: '评定会议',
    speaker: 'Arthur Shelby',
    lines: [
      '今晚只讨论一件事：Thomas 是否配得上正式背章。表决之后，我们会交给他第一块管理权。',
    ],
    objective: '参加会议、完成表决并晋升正式成员。',
    artwork: 'council-promotion',
    action: { kind: 'meeting', label: '参加评定会议' },
  },
  {
    number: 11,
    act: 2,
    time: '11:50',
    title: '修车厂管理权交接',
    kicker: '正式成员职责',
    speaker: 'Arthur Shelby',
    lines: [
      '厂一直是帮派的。今天改变的不是归属，而是由谁对账、派人和承担结果。',
    ],
    objective: '在城市地图点击修车厂上方的可交接标记。',
    artwork: 'workshop-takeover',
    action: {
      kind: 'building-claim',
      buildingId: 'repair-shop',
      label: '前往修车厂',
    },
  },
  {
    number: 12,
    act: 2,
    time: '13:00',
    title: '让第一个工位运转',
    kicker: '建筑经营',
    speaker: 'Arthur Shelby',
    lines: [
      '管理权不是墙上的牌子。先把第一个维修工位升级，让账面开始自己说话。',
    ],
    objective: '打开修车厂，升级首个子建筑。',
    artwork: 'garage-repair',
    action: {
      kind: 'building-upgrade',
      buildingId: 'repair-shop',
      label: '升级修车厂工位',
    },
  },
  {
    number: 13,
    act: 2,
    time: '14:20',
    title: '第一次安排见习成员',
    kicker: '自动经营',
    speaker: 'Bo Carter',
    lines: [
      '把 Eddie 派到修车厂。他替你盯住日常维修，你只需要对最终产出负责。',
    ],
    objective: '完成成员派驻，开启修车厂自动经营。',
    artwork: 'workshop-takeover',
    action: { kind: 'continue', label: '派驻 Eddie' },
  },
  {
    number: 14,
    act: 2,
    time: '15:20',
    title: '金发管理员的邀约',
    kicker: '废车回收厂',
    speaker: 'Billy Kimber',
    lines: [
      '想知道废铁怎么变成好零件？来我的回收场。先帮我拆两辆黑市车，再跟我比一场。',
    ],
    objective: '前往废车回收厂，接受管理员的竞速邀约。',
    artwork: 'scrapyard-salvage',
    action: { kind: 'continue', label: '跟他去回收场' },
  },
  {
    number: 15,
    act: 2,
    time: '16:20',
    title: '废铁里总有能用的东西',
    kicker: '配件产出',
    speaker: 'Billy Kimber',
    lines: [
      '你还没有这里的管理权，但可以用我的设备。拆掉两辆车，留下真正有价值的部件。',
    ],
    objective: '在 3D 拆车工位拆解两辆黑市车辆，首次获得零件。',
    artwork: 'scrapyard-salvage',
    action: { kind: 'car-dismantle', label: '进入 3D 拆车工位' },
  },
  {
    number: 16,
    act: 2,
    time: '17:30',
    title: '赛前再检查一次',
    kicker: '配件确认',
    speaker: 'Billy Kimber',
    lines: [
      '别带着从废车上拆下来的东西直接上路。确认部位，把最好的那件装到你的车上。',
    ],
    objective: '进入车辆养成，检查并安装获得的配件。',
    artwork: 'garage-repair',
    action: { kind: 'heroes', tab: 'car', label: '检查车辆配件' },
  },
  {
    number: 17,
    act: 2,
    time: '18:20',
    title: '一对一，谁先到桥下',
    kicker: '友好竞速',
    speaker: 'Billy Kimber',
    lines: ['别把油门留给葬礼。跑进前三不算本事——今天只有你和我。'],
    objective: '完成与金发管理员的一对一竞速。',
    artwork: 'one-on-one-race',
    action: { kind: 'race', stage: 4, label: '进入 SUP · 一对一竞速' },
  },
  {
    number: 18,
    act: 2,
    time: '20:00',
    title: '他把自己的车横在枪口前',
    kicker: '牺牲与逃生',
    speaker: 'Billy Kimber',
    lines: ['别回头，Thomas！把消息带回去——帮派里有人给他们报了路线。'],
    objective: '在枪战追击中逃离包围。',
    artwork: 'blond-sacrifice',
    action: { kind: 'race', stage: 5, label: '进入 SUP · 突围' },
  },
  {
    number: 19,
    act: 2,
    time: '21:30',
    title: '把他的名字留在桌上',
    kicker: '纪念与复仇',
    speaker: 'Bo Carter',
    lines: [
      '我们先送别兄弟，再处理债。追来的那辆车已经拖回回收场，它会告诉我们该找谁。',
    ],
    objective: '完成纪念仪式，制定复仇计划。',
    artwork: 'memorial-succession',
    action: { kind: 'continue', label: '向兄弟致意' },
  },
  {
    number: 20,
    act: 2,
    time: '22:20',
    title: '把他的铁獠交给你',
    kicker: '遗物继承',
    speaker: 'Arthur Shelby',
    lines: ['这辆铁獠原本由他保管。修好它，别让它只在仓库里积灰。'],
    objective: '获得并修复铁獠装甲车。',
    artwork: 'garage-repair',
    action: { kind: 'continue', label: '接收铁獠装甲车' },
  },
  {
    number: 21,
    act: 2,
    time: '23:20',
    title: '债要在公路上收回来',
    kicker: '复仇行动',
    speaker: 'Bo Carter',
    lines: ['目标就在前方车队。摧毁头车，把剩下的人留给审问。'],
    objective: '完成复仇追击枪战。',
    artwork: 'highway-gunfight',
    action: { kind: 'race', stage: 6, label: '进入 SUP · 完成复仇' },
  },
  {
    number: 22,
    act: 2,
    time: '25:00',
    title: '空下来的位置必须有人承担',
    kicker: '纪念会议',
    speaker: 'Arthur Shelby',
    lines: [
      '复仇已经完成。现在评定行动结果，并决定谁接手回收场和执行者的职责。',
    ],
    objective: '参加会议，晋升执行者并取得回收场管理授权。',
    artwork: 'council-promotion',
    action: { kind: 'meeting', label: '参加纪念评定会议' },
  },
  {
    number: 23,
    act: 2,
    time: '26:10',
    title: '废车回收厂交接',
    kicker: '执行者权限',
    speaker: 'Bo Carter',
    lines: [
      '他留下的场子不能停。你来管人、管账，也管住每一件从废铁里出来的武器。',
    ],
    objective: '在地图完成废车回收厂管理权交接。',
    artwork: 'workshop-takeover',
    action: {
      kind: 'building-claim',
      buildingId: 'recycling-yard',
      label: '前往废车回收厂',
    },
  },
  {
    number: 24,
    act: 2,
    time: '26:25',
    title: '让回收线重新运转',
    kicker: '回收厂经营',
    speaker: 'Bo Carter',
    lines: ['先升级第一条分拣线。有人会怀念旧管理员，但机器必须继续响。'],
    objective: '升级废车回收厂首个子建筑。',
    artwork: 'scrapyard-salvage',
    action: {
      kind: 'building-upgrade',
      buildingId: 'recycling-yard',
      label: '升级回收分拣线',
    },
  },
  {
    number: 25,
    act: 2,
    time: '26:40',
    title: '精准刺杀与紧急接应',
    kicker: '叛徒线索',
    speaker: 'Maeve Quinn',
    lines: [
      '把成员派到回收场后跟我走。刺杀目标认识内鬼；情况失控时，我会开肌肉车接你。',
    ],
    objective: '完成派驻与刺杀演出，开启叛徒调查。',
    artwork: 'assassination-rescue',
    action: { kind: 'continue', label: '开始精准刺杀' },
  },
  {
    number: 26,
    act: 3,
    time: '26:50',
    title: '顺着线索清理五个据点',
    kicker: '推关解锁',
    speaker: 'Maeve Quinn',
    lines: ['内鬼用了代号。连拔五个据点，把最后一个活口按在挡风玻璃前问清楚。'],
    objective: '连续完成 5 个推关关卡，取得叛徒代号。',
    artwork: 'informant-interrogation',
    action: {
      kind: 'campaign',
      targetStage: 5,
      label: '进入推关 · 清理五个据点',
    },
  },
  {
    number: 27,
    act: 3,
    time: '32:00',
    title: '代号被摆上桌面',
    kicker: '道路成员晋升',
    speaker: 'Arthur Shelby',
    lines: ['调查有了结果。会议评定你为道路成员，并把商业街的管理责任交给你。'],
    objective: '参加会议，晋升道路成员。',
    artwork: 'council-promotion',
    action: { kind: 'meeting', label: '参加线索评定会议' },
  },
  {
    number: 28,
    act: 3,
    time: '33:00',
    title: '商业街管理权交接',
    kicker: '现金网络',
    speaker: 'Merrill Gray',
    lines: ['这条街每一扇门都认帮派的标志。以后商户的问题先到你的桌上。'],
    objective: '完成商业街管理权交接。',
    artwork: 'workshop-takeover',
    action: {
      kind: 'building-claim',
      buildingId: 'commercial-street',
      label: '前往商业街',
    },
  },
  {
    number: 29,
    act: 3,
    time: '34:00',
    title: '钱要流动，关系也要维护',
    kicker: '商业经营',
    speaker: 'Merrill Gray',
    lines: ['升级第一间店面，收下今天的账，再把该给警长的那份送过去。'],
    objective: '升级商业街首个子建筑并完成第一次收账。',
    artwork: 'garage-repair',
    action: {
      kind: 'building-upgrade',
      buildingId: 'commercial-street',
      label: '升级商业街店面',
    },
  },
  {
    number: 30,
    act: 3,
    time: '36:00',
    title: '庆功酒变成了审判',
    kicker: '叛徒现身',
    speaker: 'Arthur Shelby',
    lines: [
      '证据指向 Billy。摘下他的背章——如果他选择逃跑，就让公路替桌子完成裁决。',
    ],
    objective: '参加会议，表决摘除叛徒背章。',
    artwork: 'council-promotion',
    action: { kind: 'meeting', label: '参加叛徒审判会议' },
  },
  {
    number: 31,
    act: 3,
    time: '38:00',
    title: '追上逃跑的叛徒',
    kicker: '路线队长试炼',
    speaker: 'Bo Carter',
    lines: ['Billy 冲上了北线。追回背章，回来接掌路线队长的位置。'],
    objective: '完成追逐与惩戒，晋升路线队长。',
    artwork: 'one-on-one-race',
    action: { kind: 'race', stage: 7, label: '进入 SUP · 追击 Billy' },
  },
  {
    number: 32,
    act: 3,
    time: '41:00',
    title: '加油站管理权交接',
    kicker: '燃油网络',
    speaker: 'Bo Carter',
    lines: [
      '路线归你，给路线供血的加油站也归你负责。别让任何一辆帮派车因缺油停下。',
    ],
    objective: '完成加油站管理权交接。',
    artwork: 'workshop-takeover',
    action: {
      kind: 'building-claim',
      buildingId: 'gas-station',
      label: '前往加油站',
    },
  },
  {
    number: 33,
    act: 3,
    time: '42:00',
    title: '第一座泵岛开始供油',
    kicker: '油资源解锁',
    speaker: 'Bo Carter',
    lines: ['升级泵岛，确认储量。此后油会进入你的资源账本。'],
    objective: '升级加油站首个子建筑，首次获得油。',
    artwork: 'garage-repair',
    action: {
      kind: 'building-upgrade',
      buildingId: 'gas-station',
      label: '升级加油泵岛',
    },
  },
  {
    number: 34,
    act: 4,
    time: '45:00',
    title: '把 Merrill 从仓库救出来',
    kicker: '英雄解锁',
    speaker: 'Bo Carter',
    lines: ['Merrill 被扣在东边仓库。打穿三个据点，把她完整带回来。'],
    objective: '完成 3 个推关关卡，解锁 Merrill Gray。',
    artwork: 'assassination-rescue',
    action: {
      kind: 'campaign',
      targetStage: 8,
      label: '进入推关 · 救出 Merrill',
    },
  },
  {
    number: 35,
    act: 4,
    time: '50:00',
    title: '旧财务官主动让位',
    kicker: '财务官晋升',
    speaker: 'Dale Conway',
    lines: ['你守住了人、钱和路线。我会在会议上辞去席位，把物资账交到你手里。'],
    objective: '参加会议，晋升财务官并取得物资生产授权。',
    artwork: 'council-promotion',
    action: { kind: 'meeting', label: '参加财务交接会议' },
  },
  {
    number: 36,
    act: 4,
    time: '52:00',
    title: '金属加工厂管理权交接',
    kicker: '物流与材料',
    speaker: 'Dale Conway',
    lines: ['帮派的物流线落在这座金属加工厂。运输、加工和仓储都从这里结算。'],
    objective: '完成金属加工厂管理权交接。',
    artwork: 'workshop-takeover',
    action: {
      kind: 'building-claim',
      buildingId: 'metalworking-plant',
      label: '前往金属加工厂',
    },
  },
  {
    number: 37,
    act: 4,
    time: '54:00',
    title: '第一批材料入库',
    kicker: '物资资源解锁',
    speaker: 'Dale Conway',
    lines: ['升级第一条加工线。以后每一块钢材、每一箱维修料都要能在账上找到。'],
    objective: '升级金属加工厂首个子建筑，首次获得物资。',
    artwork: 'garage-repair',
    action: {
      kind: 'building-upgrade',
      buildingId: 'metalworking-plant',
      label: '升级加工线',
    },
  },
  {
    number: 38,
    act: 5,
    time: '60:00',
    title: '用枪声确认彼此的分寸',
    kicker: '纪律官试炼',
    speaker: 'Maeve Quinn',
    lines: ['这是友好枪战，打的是判断，不是仇。活着回桌边，你就是新的纪律官。'],
    objective: '完成友好追击枪战，晋升纪律官。',
    artwork: 'highway-gunfight',
    action: { kind: 'race', stage: 8, label: '进入 SUP · 友好枪战' },
  },
  {
    number: 39,
    act: 5,
    time: '65:00',
    title: '叛徒余党袭击材料车',
    kicker: '资深成员试炼',
    speaker: 'Maeve Quinn',
    lines: [
      '先清掉三个据点，再护送材料回厂。修复损伤后，核心桌边会为你留一个位置。',
    ],
    objective: '完成 3 个推关关卡与护送演出，晋升资深成员。',
    artwork: 'garage-explosion',
    action: { kind: 'campaign', targetStage: 11, label: '进入推关 · 夺回材料' },
  },
  {
    number: 40,
    act: 5,
    time: '72:00',
    title: 'Hank 带着旧账回来了',
    kicker: '核心成员护送',
    speaker: 'Arthur Shelby',
    lines: ['Hank 的车队带着关键账本。护送他穿过封锁，再一起回到会议桌。'],
    objective: '完成车队护送并参加核心议事。',
    artwork: 'gang-convoy',
    action: { kind: 'race', stage: 9, label: '进入 SUP · 护送 Hank' },
  },
  {
    number: 41,
    act: 5,
    time: '77:00',
    title: '副主席的传统一对一',
    kicker: '最高竞速试炼',
    speaker: 'Arthur Shelby',
    lines: [
      '副主席不靠举手产生。跑赢这场传统赛，Clubhouse 的日常管理权就交给你。',
    ],
    objective: '完成一对一竞速，晋升副主席。',
    artwork: 'one-on-one-race',
    action: { kind: 'race', stage: 10, label: '进入 SUP · 副主席试炼' },
  },
  {
    number: 42,
    act: 5,
    time: '82:00',
    title: '替主席处理整座城的日常',
    kicker: '副主席职责',
    speaker: 'Arthur Shelby',
    lines: [
      '动用钱、油和物资，清理三个据点，护送最后一支车队，并把受损建筑恢复运转。',
    ],
    objective: '完成 3 个推关关卡与城市综合职责。',
    artwork: 'workshop-takeover',
    action: {
      kind: 'campaign',
      targetStage: 14,
      label: '进入推关 · 履行副主席职责',
    },
  },
  {
    number: 43,
    act: 5,
    time: '88:00',
    title: '和平接过最后一把锤子',
    kicker: '主席交接',
    speaker: 'Arthur Shelby',
    lines: ['这座城从来都属于帮派。今天，桌边的人决定由你承担它的全部重量。'],
    objective: '参加最终会议，完成主席职位与 Clubhouse 的和平交接。',
    artwork: 'council-promotion',
    action: { kind: 'meeting', label: '参加主席交接会议' },
  },
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

export function getStoryVisibility(stepNumber: number) {
  return {
    heroes: stepNumber >= 7,
    gangTree: stepNumber >= 5,
    story: stepNumber >= 10,
    campaign: stepNumber >= 26,
    gangStatus: stepNumber >= 8,
    money: stepNumber >= 7,
    oil: stepNumber >= 34,
    materials: stepNumber >= 38,
  }
}

export function getStoryClaimBuilding(stepNumber: number): BuildingId | null {
  const action = getStoryStep(stepNumber)?.action
  return action?.kind === 'building-claim' ? action.buildingId : null
}
