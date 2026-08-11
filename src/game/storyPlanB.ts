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

export type CarModificationScenario =
  'repair-trio' | 'tune-engine' | 'race-prep' | 'revenge-build'

export type CarDismantleScenario = 'salvage-pair' | 'pursuit-wreck'

export type StoryAction =
  | { kind: 'continue'; label: string }
  | { kind: 'race'; stage: number; label: string }
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
      '警察从州界一路追到这条陌生公路，我的灰狐已经快撑不住了。',
      '先甩掉后视镜里的警灯；只要冲进前面那座小镇，我就还有活路。',
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
    lines: [
      '你能从州警手里撑到这里，至少不是个只会踩油门的蠢货。',
      '跟紧我的后轮，车队会替你切开包围；进了小镇，再谈你凭什么留下。',
    ],
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
    lines: [
      '州警被甩掉了，黑手党的伏兵却堵住了回城岔路——他们冲我们来的，也把你算进去了。',
      '用后座的公用枪架打掉头车；活着跟上队伍，我就替你争一个见习名额。',
    ],
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
      '伏兵退了，但你的灰狐已经开不回去。把车挂上拖绳，人跟我的车走。',
      '你替车队守住了退路，这算第一份见习证明；回城以后，还有两件事要做。',
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
      '先把规矩说清：这座城和城里的产业本来就属于剃刀党，不需要你从谁手里夺回来。',
      '职位决定你能管理哪些人和产业。你现在只是见习，只能使用修车厂完成剩下两份证明。',
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
      '伏击毁了你的散热系统，也伤了两辆接应车；三辆车都得在今晚重新上路。',
      '你有工位使用权，但还没有管理权。先修自己的灰狐，再分别处理兄弟们的轮组和护杠。',
    ],
    objective: '完成三辆车的维修，首次获得钱。见习职责 2/3。',
    artwork: 'garage-repair',
    action: {
      kind: 'car-customize',
      scenario: 'repair-trio',
      label: '进入 3D 三车维修工位',
    },
  },
  {
    number: 7,
    act: 1,
    time: '06:00',
    title: '一件能救命的好配件',
    kicker: '车辆养成',
    speaker: 'Bo Carter',
    lines: [
      '三辆车按时交付，你已经挣到第二份认可；但灰狐的旧引擎仍经不起下一场追击。',
      '把我带来的调校引擎装好。车能稳定点火后，我再把执行最后任务的枪交给你。',
    ],
    objective: '进入 3D 改车工位，拆下损坏引擎并安装调校引擎。',
    artwork: 'garage-repair',
    action: {
      kind: 'car-customize',
      scenario: 'tune-engine',
      label: '进入 3D 引擎强化工位',
    },
  },
  {
    number: 8,
    act: 1,
    time: '07:20',
    title: '夺回被截走的货',
    kicker: '第一次带枪出车',
    speaker: 'Bo Carter',
    lines: [
      '岔路上的伏兵截走了一批帮派货物，这就是你的第三份见习任务。',
      '追上运输队，枪会持续压制；你负责把握强化火力的时机，把货完整带回来。',
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
    lines: [
      '货物追回来了，三份见习证明也已经齐了。',
      '跟在我右后方回 Clubhouse；我会在桌边提出你的名字，但正式背章还要由全体表决。',
    ],
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
      'Thomas 已完成护送、维修和夺货三项见习任务，今晚先表决他能否获得正式背章。',
      '若表决通过，他将离开见习席，并接下第一项职责：管理修车厂的日常运转。',
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
      '表决已经通过，你现在是正式成员。修车厂也一直是帮派产业，今天不改变它的归属。',
      '去入口确认交接；从那一锤落下开始，由你负责对账、派人，并承担经营结果。',
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
      '钥匙已经在你手里，但第一座维修工位仍停在伏击后的损坏状态。',
      '先把工位升级到可生产状态；它开始结算收入后，你才有条件安排成员长期值守。',
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
      '工位已经修好，接下来不能让你每天亲自守着扳手。',
      '把见习成员 Eddie 派驻进来；他负责日常维修，你负责人员安排和最终产出。',
    ],
    objective: '完成成员派驻，开启修车厂自动经营。',
    artwork: 'workshop-takeover',
    action: { kind: 'continue', label: '派驻 Eddie' },
  },
  {
    number: 14,
    act: 2,
    time: '15:20',
    title: '回收场管理员的邀约',
    kicker: '废车回收厂',
    speaker: 'Freddie Thorne',
    lines: [
      '修车厂能自己运转，说明你终于腾得出手了。我是 Freddie，替帮派管废车回收场。',
      '来场一对一怎么样？赛前先去我的场子拆两辆黑市车，挑件真正能让你跑快的东西。',
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
    speaker: 'Freddie Thorne',
    lines: [
      '这里仍由我管理，所以我可以准你使用拆解台，但钥匙和账本还不归你。',
      '把两辆黑市车按轮组、引擎和车壳依次拆开；能留下的配件，正好拿去准备比赛。',
    ],
    objective: '在 3D 拆车工位拆解两辆黑市车辆，首次获得零件。',
    artwork: 'scrapyard-salvage',
    action: {
      kind: 'car-dismantle',
      scenario: 'salvage-pair',
      label: '进入 3D 黑市车拆解台',
    },
  },
  {
    number: 16,
    act: 2,
    time: '17:30',
    title: '赛前再检查一次',
    kicker: '配件确认',
    speaker: 'Freddie Thorne',
    lines: [
      '两辆废车已经拆完，这套悬挂是里面最适合竞速的一件。',
      '别把零件扔进后备箱就上路；在 3D 工位拆掉弯曲悬挂，完成安装和四轮定位。',
    ],
    objective: '在 3D 赛前工位安装回收所得悬挂并完成定位。',
    artwork: 'garage-repair',
    action: {
      kind: 'car-customize',
      scenario: 'race-prep',
      label: '进入 3D 赛前换件工位',
    },
  },
  {
    number: 17,
    act: 2,
    time: '18:20',
    title: '一对一，谁先到桥下',
    kicker: '友好竞速',
    speaker: 'Freddie Thorne',
    lines: [
      '新悬挂已经定位完成，现在该看看它在公路上值不值这番功夫。',
      '别把油门留给葬礼。今天没有第三名——只有你和我，谁先冲到桥下谁赢。',
    ],
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
    speaker: 'Freddie Thorne',
    lines: [
      '我们刚离开赛道，黑手党的战车就准确堵住了返城路线——这不是巧合，是有人泄了行踪。',
      '别回头，Thomas！我替你挡住火力。活着回城，把内鬼的消息带到桌边！',
    ],
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
      '你把 Freddie 和敌人的残车都带回来了。主席已把这次越界袭击定性为必须偿还的血债。',
      '先向兄弟致意，再拆开追杀车；车架编号和残留装备会告诉我们该向哪支车队追债。',
    ],
    objective: '拆解追杀残车，查明袭击车队并取得反击配件。',
    artwork: 'memorial-succession',
    action: {
      kind: 'car-dismantle',
      scenario: 'pursuit-wreck',
      label: '致意后进入 3D 残车拆解台',
    },
  },
  {
    number: 20,
    act: 2,
    time: '22:20',
    title: '把他守着的铁獠交给你',
    kicker: '遗物继承',
    speaker: 'Arthur Shelby',
    lines: [
      '残车上的标记已经锁定袭击者，拆下的部件也足够修好一辆更能扛火力的车。',
      '这辆铁獠一直由 Freddie 看守。把引擎和装甲重新装好，驾驶它替他完成最后一次出车。',
    ],
    objective: '在 3D 工位修复铁獠装甲车，准备复仇行动。',
    artwork: 'garage-repair',
    action: {
      kind: 'car-customize',
      scenario: 'revenge-build',
      label: '进入 3D 铁獠整备工位',
    },
  },
  {
    number: 21,
    act: 2,
    time: '23:20',
    title: '债要在公路上收回来',
    kicker: '复仇行动',
    speaker: 'Bo Carter',
    lines: [
      '铁獠已经修好，车架编号也把我们带到了负责伏击的黑手党车队。',
      '摧毁头车，夺回 Freddie 的背章和回收场钥匙；留下的活口还要带回去审问。',
    ],
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
      '你带回了 Freddie 的背章、钥匙和复仇结果，他留下的执行者席位却仍然空着。',
      '会议先为他完成追悼，再评定由谁接过回收场和执行者的责任。',
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
      '会议已经任命你为执行者，Freddie 留下的回收场钥匙现在正式交到你手里。',
      '去入口完成内部交接；从此你不只使用设备，还要对人员、账目和流出的每件装备负责。',
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
    lines: [
      '管理权已经生效，但追杀后拖回的残车挤停了第一条分拣线。',
      '把工位升级到可生产状态。我们会记住 Freddie，但他的场子不能永远停在追悼里。',
    ],
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
    title: '主席派 Maeve 来查这桩案子',
    kicker: '首名英雄加入',
    speaker: 'Maeve Quinn',
    lines: [
      '你刚把成员派进回收场，黑手党的摩托就准确找到了工位；我撞开他们，才保住这条刚恢复的分拣线。',
      '连续两次袭击都掌握了精确路线，帮派内部一定有人报信。主席派我加入你的行动队：你查清泄密链，我替你带人清场。',
    ],
    objective: '接收首名英雄 Maeve “Red” Quinn 的协助，开始调查内鬼案。',
    artwork: 'assassination-rescue',
    action: { kind: 'continue', label: '让 Maeve 加入行动队' },
  },
  {
    number: 26,
    act: 3,
    time: '26:50',
    title: '顺着线索清理五个据点',
    kicker: '推关解锁',
    speaker: 'Maeve Quinn',
    lines: [
      '袭击者的联络链通向五个城外据点，内鬼只用代号与他们联系。',
      '你留在后方统筹线索，不必亲自进入火线。把我编入行动队，从最外围逐个打进去；第五处留一个活口。',
    ],
    objective: '以 Maeve 为首名推关英雄连续完成 5 关，取得叛徒代号。',
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
    lines: [
      '五处联络点已经清除，你和 Maeve 也带回了内鬼代号，调查终于有了可以继续追的方向。',
      '会议将评定你晋升道路成员；通过后，商业街的账本会成为追查真实身份的新入口。',
    ],
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
    lines: [
      '道路成员的任命已经生效，前任负责人也把商业街的钥匙和旧账送来了。',
      '这条街一直认剃刀党的标志；现在改的是内部负责人，以后商户的问题先到你的桌上。',
    ],
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
    lines: [
      '交接完成了，但袭击造成的停业让账目断了几天，内鬼留下的资金痕迹也藏在里面。',
      '先升级第一间店面、收回当天账款，再付清警长的约定份额；他才会继续提供道路消息。',
    ],
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
      '商业街账目与据点口供相互印证：把行车路线卖给黑手党的人，是路线队长 Billy Kimber。',
      '今晚表决摘除他的背章和职位；若他拒绝接受裁决，车队就上路把帮派财产追回来。',
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
    lines: [
      '表决刚落锤，Billy 就带着路线图冲上北线；他的逃跑等于承认了全部指控。',
      '追上他，执行议会裁决并取回背章。带着路线图回来，桌边会确认新的路线队长。',
    ],
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
      '你带回背章和路线图，会议已经确认你接任路线队长。',
      '给所有路线供血的加油站也随职位交给你管理；去完成内部交接，别让帮派车辆因缺油停下。',
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
    lines: [
      '加油站钥匙已经交接，但第一座泵岛长期欠修，现有储量无法支撑车队。',
      '修复并升级泵岛，完成首批入账；从此油料会正式进入你的资源调度。',
    ],
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
    lines: [
      'Billy 的同党绑走了 Merrill，想在东边仓库烧掉能牵出物流账目的证据。',
      '带队打穿沿路三个据点，把她和账本一起带回来；兄弟和证据，一个都不能丢。',
    ],
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
    lines: [
      '你救回 Merrill，也追回了我没能守住的物流账本；这次失察应当由我承担。',
      '我会在会议上辞去财务官席位。若桌边通过，由你接管物资账和对应产业。',
    ],
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
    lines: [
      '会议接受了我的辞任，你现在是财务官。帮派的物资账最终都落在这座金属加工厂。',
      '工厂从来属于帮派；我会把仓位、车队和排班表逐项交给你，之后由你统一结算。',
    ],
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
    lines: [
      '管理资料已经核对完，但被篡改的排班让第一条加工线仍处于停产状态。',
      '升级产线并收下首批材料；以后每块钢材、每箱维修料都必须能在你的账上找到。',
    ],
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
    lines: [
      '人、钱、油和物资都已恢复，下一步要证明你能约束帮派的武装力量。',
      '现任纪律官会与你进行一场友好追击枪战。打的是判断，不是仇；赢下后他会和平交棒。',
    ],
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
      '纪律官刚完成交接，Billy 的残党就盗走了加工厂材料，想用最后几处藏点拖垮生产。',
      '先清掉三个据点，再护送材料返厂并修复仓位；完成整套行动，你才够资格进入资深成员席。',
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
    lines: [
      '材料已经回库，会议也确认你进入资深席。恰好，服刑多年的老成员 Hank 今天获释。',
      '他带着能清算旧关系的账本，却有人不想让他回城。护送车队穿过封锁，再一起回到会议桌。',
    ],
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
    speaker: 'Michael Gray',
    lines: [
      '你护送 Hank 回城并理清旧账，资深成员已经同意把你的名字送进副主席挑战。',
      '这个席位不只靠举手产生。按传统与我跑一场；赢下比赛，我就交出 Clubhouse 的日常管理权。',
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
      '你赢得挑战，已经以副主席身份主持日常事务；主席席位不会只凭一场比赛决定。',
      '调动钱、油和物资清理三个残余据点，护送成员返城并恢复受损建筑，证明你能统筹整座城。',
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
    speaker: 'Winston Cole',
    lines: [
      '你已经以副主席身份完成了一次全城行动，六条管理线也都接受了你的调度。',
      '这座城始终属于剃刀党。今天桌边表决的，是由谁接过主席木槌，并替所有人承担每个决定的后果。',
    ],
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
    heroes: stepNumber >= 25,
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
