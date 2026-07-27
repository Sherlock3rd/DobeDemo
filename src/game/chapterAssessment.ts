import { CHAPTERS, type ChapterDefinition } from './chapterProgression'
import {
  GANG_CORE_SEATS,
  roleForCoreSeat,
  type GangCoreSeat,
} from './gangHierarchy'

export interface AssessmentMemberVote {
  name: string
  role: string
  seatDescription: string
  portraitIndex: number
  support: boolean
}

export interface CrewAssignment {
  memberName: string
  memberPosition: string
  taskName: string
  description: string
}

export interface ChapterAssessment {
  chapter: ChapterDefinition
  chair: GangCoreSeat
  playerCanVote: boolean
  memberVotes: readonly AssessmentMemberVote[]
  supportCount: number
  supportRate: number
  crewAssignments: readonly CrewAssignment[]
  passed: true
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

const VOTING_SEATS = GANG_CORE_SEATS.slice(1)
const SUPPORT_COUNTS = [4, 4, 5, 4, 5, 5, 4] as const
const REVIEW_GRADES = ['A', 'B', 'C', 'D'] as const
const REVIEW_MEMBERS = GANG_CORE_SEATS.flatMap((seat) => seat.support)
const CREW_TASKS: Readonly<
  Record<number, readonly { taskName: string; description: string }[]>
> = {
  1: [
    { taskName: '清点南区仓库', description: '核对封存工具与旧零件账目' },
    { taskName: '追回酒吧旧账', description: '收齐三家酒吧拖欠的帮派分成' },
    { taskName: '巡查运河货路', description: '确认夜间运输路线仍然安全' },
    { taskName: '召回修理工', description: '把离开的老师傅重新带回工位' },
  ],
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
  7: [
    { taskName: '主持全城账目', description: '完成所有产业的最终审计' },
    { taskName: '确认继任梯队', description: '为每个核心席位准备副手' },
    { taskName: '稳定外围关系', description: '重新确认盟友与生意边界' },
    { taskName: '执行主席命令', description: '让各条线按同一命令运转' },
  ],
}

function seededVoteScore(chapterNumber: number, memberIndex: number): number {
  let value = Math.imul(chapterNumber + 17, 0x45d9f3b)
  value ^= Math.imul(memberIndex + 31, 0x27d4eb2d)
  value ^= value >>> 16
  value = Math.imul(value, 0x45d9f3b)
  value ^= value >>> 16
  return value >>> 0
}

function getCrewAssignments(chapterNumber: number): CrewAssignment[] {
  const tasks = CREW_TASKS[chapterNumber] ?? CREW_TASKS[1]
  return [...REVIEW_MEMBERS]
    .map((member, index) => ({
      member,
      score: seededVoteScore(chapterNumber + 11, index),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, tasks.length)
    .map(({ member }, index) => ({
      memberName: member.name,
      memberPosition: member.position,
      taskName: tasks[index].taskName,
      description: tasks[index].description,
    }))
}

export function getChapterAssessment(
  chapterNumber: number,
): ChapterAssessment | null {
  const chapter = CHAPTERS.find(
    (candidate) => candidate.number === chapterNumber,
  )
  if (!chapter) return null

  const supportCount = SUPPORT_COUNTS[chapterNumber - 1]
  const supportedIndexes = new Set(
    VOTING_SEATS.map((_, index) => ({
      index,
      score: seededVoteScore(chapterNumber, index),
    }))
      .sort((left, right) => right.score - left.score)
      .slice(0, supportCount)
      .map(({ index }) => index),
  )
  const memberVotes = VOTING_SEATS.map((seat, index) => ({
    name: seat.holder,
    role: roleForCoreSeat(seat).chineseTitle,
    seatDescription: seat.seatDescription,
    portraitIndex: seat.portraitIndex,
    support: supportedIndexes.has(index),
  }))

  return {
    chapter,
    chair: VOTING_SEATS[Math.min(chapterNumber - 1, VOTING_SEATS.length - 1)],
    playerCanVote: chapterNumber > 1,
    memberVotes,
    supportCount,
    supportRate: Math.round((supportCount / memberVotes.length) * 100),
    crewAssignments: getCrewAssignments(chapterNumber),
    passed: true,
  }
}

export function getChapterPerformanceReview(
  chapterNumber: number,
): ChapterPerformanceReview | null {
  const chapter = CHAPTERS.find(
    (candidate) => candidate.number === chapterNumber,
  )
  if (!chapter) return null

  const crewAssignments = getCrewAssignments(chapterNumber)
  const shuffledGrades = REVIEW_GRADES.map((grade, index) => ({
    grade,
    score: seededVoteScore(chapterNumber + 29, index),
  }))
    .sort((left, right) => right.score - left.score)
    .map(({ grade }) => grade)

  return {
    chapter,
    entries: [
      {
        name: 'Thomas Shelby',
        position: `${chapter.role.chineseTitle} · 玩家章节任务`,
        taskName: `完成${chapter.title}玩家任务`,
        grade: 'S',
        portraitIndex: 0,
        isPlayer: true,
      },
      ...crewAssignments.map((assignment, index) => ({
        name: assignment.memberName,
        position: assignment.memberPosition,
        taskName: assignment.taskName,
        grade: shuffledGrades[index],
        portraitIndex: null,
        isPlayer: false,
      })),
    ],
    playerGrade: 'S',
    verdict: `Thomas 以 S 级完成${chapter.title}全部职责，其负责的玩家章节任务已正式归档。`,
  }
}
