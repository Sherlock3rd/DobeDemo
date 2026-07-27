import { getGangCoreSeat } from './gangHierarchy'
import { getGangRole } from './gangProgression'

export type RoleHandoverMode = 'dialogue' | 'battle' | 'race'

export interface RoleHandoverLine {
  speaker: string
  portraitIndex: number
  text: string
}

export interface RoleHandoverDefinition {
  targetLevel: 8 | 16 | 24 | 32 | 40 | 50
  mode: RoleHandoverMode
  modeLabel: string
  title: string
  summary: string
  challengeStage: number | null
  lines: readonly RoleHandoverLine[]
}

const HANDOVERS: Readonly<Record<number, RoleHandoverDefinition>> = {
  8: {
    targetLevel: 8,
    mode: 'dialogue',
    modeLabel: '和平对话交接',
    title: '完整补丁的归属',
    summary:
      'Maeve 已认可你的执行力。委员会表决通过后，她会当面交出正式成员名单与完整补丁。',
    challengeStage: null,
    lines: [
      {
        speaker: 'Maeve “Red” Quinn',
        portraitIndex: 2,
        text: '你已经证明自己不是来借剃刀党的名头。名单和完整补丁可以交给你，但每一个名字都要由你负责。',
      },
      {
        speaker: 'Thomas Shelby',
        portraitIndex: 0,
        text: '我接下名单，也接下他们惹出的麻烦。席位交给我以后，你仍然留在这条指挥链里。',
      },
    ],
  },
  16: {
    targetLevel: 16,
    mode: 'battle',
    modeLabel: '推关对战交接',
    title: '扳手席位的硬规矩',
    summary:
      'Arthur 不会把车库与行动队交给只会看账本的人。带领现有编队赢下一场正面对战，证明你能指挥他们。',
    challengeStage: 3,
    lines: [
      {
        speaker: 'Arthur Shelby',
        portraitIndex: 3,
        text: '技术骨干的扳手不只用来修车。先带人打赢我安排的对手，再来拿车库钥匙。',
      },
    ],
  },
  24: {
    targetLevel: 24,
    mode: 'dialogue',
    modeLabel: '和平对话交接',
    title: '账本与酒吧的钥匙',
    summary:
      'Polly 更看重判断而不是拳头。她会通过一次面对面的谈话确认你是否理解这张席位背后的代价。',
    challengeStage: null,
    lines: [
      {
        speaker: 'Polly Gray',
        portraitIndex: 4,
        text: '酒吧听见的秘密比街上的枪声更值钱。你接过账本，就必须知道什么时候该收钱，什么时候该闭嘴。',
      },
      {
        speaker: 'Thomas Shelby',
        portraitIndex: 0,
        text: '账会对上，消息也不会从我手里漏出去。你留下来监督我，直到所有人习惯新的命令。',
      },
    ],
  },
  32: {
    targetLevel: 32,
    mode: 'race',
    modeLabel: 'SUP 竞速交接',
    title: '路线队长的公路试炼',
    summary:
      'Charlie 只服能在高速下作出正确判断的人。驾驶 Thomas 当前装备的车辆完成竞速，赢得车队指挥权。',
    challengeStage: 3,
    lines: [
      {
        speaker: 'Charlie Strong',
        portraitIndex: 5,
        text: '地图谁都会看，路线队长要在两百英里时速下还能看到三步以后。到公路上赢给我看。',
      },
    ],
  },
  40: {
    targetLevel: 40,
    mode: 'battle',
    modeLabel: '推关对战交接',
    title: '副主席的指挥权',
    summary:
      'Michael 要确认你能同时承受资源、人员与地盘的压力。赢下一场高强度推关挑战，接管第二指挥席。',
    challengeStage: 8,
    lines: [
      {
        speaker: 'Michael Gray',
        portraitIndex: 6,
        text: '副主席不能只在顺风时发号施令。打穿这次封锁，再回来接我的账本和指挥权。',
      },
    ],
  },
  50: {
    targetLevel: 50,
    mode: 'dialogue',
    modeLabel: '和平对话交接',
    title: '主席席位的最后交接',
    summary:
      '核心席位已经一致通过继任表决。Winston 会亲自交出主席钥匙，并说明最高席位真正需要承担的责任。',
    challengeStage: null,
    lines: [
      {
        speaker: 'Winston Cole',
        portraitIndex: 7,
        text: '六个席位都投了赞成票。我可以交出钥匙，但你要记住，主席拥有的不是城市，是替整个帮派承担后果的权力。',
      },
      {
        speaker: 'Thomas Shelby',
        portraitIndex: 0,
        text: '城市一直属于剃刀党。我会让每一道命令、每一辆车和每一笔账都沿着同一条路前进。',
      },
    ],
  },
}

export const ROLE_HANDOVER_LEVELS = [8, 16, 24, 32, 40, 50] as const

export function getRoleHandover(
  targetLevel: number,
): RoleHandoverDefinition | null {
  return HANDOVERS[targetLevel] ?? null
}

export function getRoleHandoverAccessibleName(targetLevel: number): string {
  const handover = getRoleHandover(targetLevel)
  if (!handover) return '职位交接'
  const role = getGangRole(targetLevel)
  const seat = getGangCoreSeat(targetLevel)
  return `${role.chineseTitle}职位交接：${seat.holder}`
}
