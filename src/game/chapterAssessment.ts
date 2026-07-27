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

export interface ChapterAssessment {
  chapter: ChapterDefinition
  chair: GangCoreSeat
  playerCanVote: boolean
  memberVotes: readonly AssessmentMemberVote[]
  supportCount: number
  supportRate: number
  passed: true
}

const VOTING_SEATS = GANG_CORE_SEATS.slice(1)
const SUPPORT_COUNTS = [4, 4, 5, 4, 5, 5, 4] as const

function seededVoteScore(chapterNumber: number, memberIndex: number): number {
  let value = Math.imul(chapterNumber + 17, 0x45d9f3b)
  value ^= Math.imul(memberIndex + 31, 0x27d4eb2d)
  value ^= value >>> 16
  value = Math.imul(value, 0x45d9f3b)
  value ^= value >>> 16
  return value >>> 0
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
    passed: true,
  }
}
