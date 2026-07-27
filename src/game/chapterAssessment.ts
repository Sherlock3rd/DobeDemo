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
      detail: '先让金属加工厂稳定连续生产。',
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
