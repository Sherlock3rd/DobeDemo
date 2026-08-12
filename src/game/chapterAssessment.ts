import {
  getChapterByNumber,
  getChapterTaskPackages,
  type ChapterDefinition,
  type ChapterTaskPackage,
} from './chapterProgression'
import {
  GANG_CORE_SEATS,
  roleForCoreSeat,
  type GangCoreSeat,
} from './gangHierarchy'

export type ChapterMeetingVote = 'option-a' | 'option-b'
export type ChapterMeetingDecision =
  ChapterMeetingVote | 'formal-member-approved'

export interface NeutralEventOption {
  id: ChapterMeetingVote
  label: string
  detail: string
}

export interface AssessmentMemberVote {
  name: string
  role: string
  portraitIndex: number
  vote: ChapterMeetingVote
}

export type SpecialEligibilityDecision = 'approve' | 'abstain'

export interface SpecialEligibilityMemberVote {
  name: string
  role: string
  portraitIndex: number
  vote: SpecialEligibilityDecision
}

export interface SpecialEligibilityVote {
  id: 'formal-member' | 'president'
  title: string
  question: string
  description: string
  resultTitle: string
  resultDetail: string
  memberVotes: readonly SpecialEligibilityMemberVote[]
  approveCount: number
  abstainCount: number
  dialogueEventId: 'special-vote:formal-member' | 'special-vote:president'
}

export interface ChapterAssessment {
  completedChapter: ChapterDefinition
  nextChapter: ChapterDefinition
  chair: GangCoreSeat
  specialVote: SpecialEligibilityVote | null
  eventVoteRequired: boolean
  eventTitle: string
  eventDescription: string
  options: readonly [NeutralEventOption, NeutralEventOption]
  memberVotes: readonly AssessmentMemberVote[]
  optionACount: number
  optionBCount: number
  taskPackages: readonly ChapterTaskPackage[]
}

export type PerformanceGrade = 'S' | 'A' | 'B' | 'C' | 'D'

export interface PerformanceReviewEntry {
  name: string
  position: string
  taskName: string
  grade: PerformanceGrade
  portraitIndex: number | null
  isPlayer: boolean
}

export interface ChapterPerformanceReview {
  chapter: ChapterDefinition
  entries: readonly PerformanceReviewEntry[]
  playerGrade: 'S'
  verdict: string
}

const TRANSITION_EVENTS: Readonly<
  Record<
    number,
    {
      title: string
      description: string
      optionA: Omit<NeutralEventOption, 'id'>
      optionB: Omit<NeutralEventOption, 'id'>
    }
  >
> = {
  1: {
    title: '无主废车涌入南区',
    description:
      '修车厂重启后，一批来源复杂的废车停在南区。车辆本身属于帮派可以处置的资产，但先查来源还是先保产线，会影响下一阶段的工作重心。',
    optionA: {
      label: '先核清来源',
      detail: '优先整理账目和来源，再逐步扩大拆解规模。',
    },
    optionB: {
      label: '先保住产线',
      detail: '优先恢复产能，同时在生产中补齐登记。',
    },
  },
  2: {
    title: '商业街夜间货流改道',
    description:
      '废车生意稳定后，商业街的夜间货流出现拥堵。委员会需要决定先疏通仓储，还是先强化押运。',
    optionA: {
      label: '先疏通仓储',
      detail: '先解决物资周转和经营秩序。',
    },
    optionB: {
      label: '先强化押运',
      detail: '先保证高价值货物能够安全通行。',
    },
  },
  3: {
    title: '金属炉线收到加急订单',
    description:
      '商业街带来一批加急金属订单。先扩大炉线还是先校准军火，都能推进帮派利益，但资源分配顺序不同。',
    optionA: {
      label: '优先扩大炉线',
      detail: '先让物流中心稳定连续运转。',
    },
    optionB: {
      label: '优先校准军火',
      detail: '先把有限产能投向车辆和枪械强化。',
    },
  },
  4: {
    title: '公路油料出现季节性缺口',
    description:
      '多条路线同时消耗油料。委员会需要在扩大储备与提高车队效率之间选择本轮优先级。',
    optionA: {
      label: '扩大油料储备',
      detail: '用更多库存换取路线稳定。',
    },
    optionB: {
      label: '提高车队效率',
      detail: '用更强车辆减少每次行动的损耗。',
    },
  },
  5: {
    title: '核心席位要求统一调度',
    description:
      '产业、车队和枪手已经形成多条独立汇报线。副主席阶段需要决定先统一账目，还是先统一武装调度。',
    optionA: {
      label: '先统一账目',
      detail: '从会所、资金和资源清点开始整顿。',
    },
    optionB: {
      label: '先统一武装',
      detail: '先建立车辆、枪械与人员的统一行动标准。',
    },
  },
  6: {
    title: '主席席位需要最终章程',
    description:
      '所有产业已经在 Thomas 的调度范围内。最后一次表决将决定主席阶段先稳固全城储备，还是先树立最高战力标准。',
    optionA: {
      label: '先稳固全城储备',
      detail: '以资源和会所秩序作为最终章程的基础。',
    },
    optionB: {
      label: '先树立战力标准',
      detail: '以英雄、车辆和整体战力作为最终章程的基础。',
    },
  },
}

const VOTING_SEATS = GANG_CORE_SEATS.slice(1)
const REVIEW_GRADES = ['A', 'B', 'C', 'D'] as const
const REVIEW_MEMBERS = GANG_CORE_SEATS.flatMap((seat) => seat.support)
const REVIEW_TASKS: Readonly<
  Record<number, readonly { taskName: string; description: string }[]>
> = {
  2: [
    { taskName: '整理废车来源', description: '登记每批废车的来路与价值' },
    { taskName: '压住零件黑市', description: '阻止外人截走可用配件' },
    { taskName: '重开北侧车库', description: '恢复废车拆解与分类工位' },
    { taskName: '护送回收车队', description: '保证运输车辆按时回场' },
  ],
  3: [
    { taskName: '核清商业街租账', description: '完成本月所有店铺账目核验' },
    { taskName: '联络夜市掌柜', description: '重新确认帮派内部的经营规矩' },
    { taskName: '安排货场巡逻', description: '填补晚班巡逻的空缺路线' },
    { taskName: '处理假账商户', description: '追回隐瞒的营业分成' },
  ],
  4: [
    { taskName: '恢复金属炉线', description: '让停摆的两条加工线重新点火' },
    { taskName: '校验军火批次', description: '剔除不合格枪械与弹药' },
    { taskName: '护送钢材入库', description: '保证原料完整进入帮派仓库' },
    { taskName: '安抚工厂领班', description: '稳定工人并重新排定轮班' },
  ],
  5: [
    { taskName: '盘点公路油料', description: '核对沿线加油点的储备' },
    { taskName: '绘制备用路线', description: '准备绕开封锁的第二条车道' },
    { taskName: '训练护送车手', description: '让新车手熟悉车队手势' },
    { taskName: '清除沿途路障', description: '保证主车队可以高速通过' },
  ],
  6: [
    { taskName: '整顿会所纪律', description: '统一各席位的值守与汇报规则' },
    { taskName: '审计产业分账', description: '核对所有产业的季度账目' },
    { taskName: '重排武装巡逻', description: '覆盖城市内的关键节点' },
    { taskName: '协调车队与枪手', description: '建立统一的行动时间表' },
  ],
}

function getSpecialEligibilityVote(
  completedChapterNumber: number,
): SpecialEligibilityVote | null {
  if (completedChapterNumber !== 1 && completedChapterNumber !== 6) return null

  const decisions: readonly SpecialEligibilityDecision[] =
    completedChapterNumber === 1
      ? ['approve', 'approve', 'approve', 'approve', 'abstain', 'approve']
      : ['approve', 'approve', 'approve', 'approve', 'approve', 'approve']
  const memberVotes = VOTING_SEATS.map((seat, index) => ({
    name: seat.holder,
    role: roleForCoreSeat(seat).chineseTitle,
    portraitIndex: seat.portraitIndex,
    vote: decisions[index],
  }))
  const approveCount = memberVotes.filter(
    (member) => member.vote === 'approve',
  ).length

  if (completedChapterNumber === 1) {
    return {
      id: 'formal-member',
      title: '正式成员资格表决',
      question: '是否接纳 Thomas Shelby 成为剃刀党正式成员？',
      description:
        'Thomas 已以见习身份完成修车厂重启、街区清理与首次公路行动。核心席位现在按帮派规矩表决他是否有资格佩戴完整补丁。',
      resultTitle: '正式成员资格通过',
      resultDetail:
        '5 席赞成、1 席保留。Thomas 获准在完成席位交接后成为正式成员。',
      memberVotes,
      approveCount,
      abstainCount: memberVotes.length - approveCount,
      dialogueEventId: 'special-vote:formal-member',
    }
  }

  return {
    id: 'president',
    title: '主席继任资格表决',
    question: '是否推举 Thomas Shelby 接掌剃刀党主席席位？',
    description:
      'Thomas 已完成副主席阶段的产业整编，账本、车队、工厂与 Clubhouse 都进入同一条指挥链。核心席位将对最高权力交接作最终表决。',
    resultTitle: '主席继任资格通过',
    resultDetail: '6 席一致赞成。Thomas 获准在完成最终席位交接后接掌主席职责。',
    memberVotes,
    approveCount,
    abstainCount: memberVotes.length - approveCount,
    dialogueEventId: 'special-vote:president',
  }
}

function seededVoteScore(chapterNumber: number, memberIndex: number): number {
  let value = Math.imul(chapterNumber + 17, 0x45d9f3b)
  value ^= Math.imul(memberIndex + 31, 0x27d4eb2d)
  value ^= value >>> 16
  value = Math.imul(value, 0x45d9f3b)
  value ^= value >>> 16
  return value >>> 0
}

export function getChapterPerformanceReview(
  completedChapterNumber: number,
): ChapterPerformanceReview | null {
  if (completedChapterNumber <= 1) return null
  const chapter = getChapterByNumber(completedChapterNumber)
  const tasks = REVIEW_TASKS[completedChapterNumber]
  if (!chapter || !tasks) return null

  const reviewedMembers = REVIEW_MEMBERS.map((member, index) => ({
    member,
    score: seededVoteScore(completedChapterNumber + 11, index),
  }))
    .sort((left, right) => right.score - left.score)
    .slice(0, tasks.length)
  const shuffledGrades = REVIEW_GRADES.map((grade, index) => ({
    grade,
    score: seededVoteScore(completedChapterNumber + 29, index),
  }))
    .sort((left, right) => right.score - left.score)
    .map(({ grade }) => grade)

  return {
    chapter,
    entries: [
      {
        name: 'Thomas Shelby',
        position: `${chapter.role.chineseTitle} · 玩家章节任务`,
        taskName: `完成${chapter.title}全部玩家职责`,
        grade: 'S',
        portraitIndex: 0,
        isPlayer: true,
      },
      ...reviewedMembers.map(({ member }, index) => ({
        name: member.name,
        position: member.position,
        taskName: tasks[index].taskName,
        grade: shuffledGrades[index],
        portraitIndex: null,
        isPlayer: false,
      })),
    ],
    playerGrade: 'S',
    verdict: `Thomas 以 S 级完成${chapter.title}全部职责；其他成员的完成度已按本轮结果归档。`,
  }
}

export function getChapterAssessment(
  completedChapterNumber: number,
): ChapterAssessment | null {
  const completedChapter = getChapterByNumber(completedChapterNumber)
  const nextChapter = getChapterByNumber(completedChapterNumber + 1)
  const event = TRANSITION_EVENTS[completedChapterNumber]
  const taskPackages = getChapterTaskPackages(completedChapterNumber + 1)
  if (
    !completedChapter ||
    !nextChapter ||
    !event ||
    taskPackages.length !== 3
  ) {
    return null
  }

  const memberVotes = VOTING_SEATS.map((seat, index) => ({
    name: seat.holder,
    role: roleForCoreSeat(seat).chineseTitle,
    portraitIndex: seat.portraitIndex,
    vote:
      seededVoteScore(completedChapterNumber, index) % 2 === 0
        ? ('option-a' as const)
        : ('option-b' as const),
  }))
  const optionACount = memberVotes.filter(
    (member) => member.vote === 'option-a',
  ).length

  return {
    completedChapter,
    nextChapter,
    chair:
      VOTING_SEATS[
        Math.min(completedChapterNumber - 1, VOTING_SEATS.length - 1)
      ],
    specialVote: getSpecialEligibilityVote(completedChapterNumber),
    eventVoteRequired: completedChapterNumber !== 1,
    eventTitle: event.title,
    eventDescription: event.description,
    options: [
      { id: 'option-a', ...event.optionA },
      { id: 'option-b', ...event.optionB },
    ],
    memberVotes,
    optionACount,
    optionBCount: memberVotes.length - optionACount,
    taskPackages,
  }
}
