import { describe, expect, it } from 'vitest'
import {
  getChapterAssessment,
  getChapterPerformanceReview,
} from './chapterAssessment'

describe('chapter assessment meeting', () => {
  it('defines one deterministic passed resolution for every chapter', () => {
    for (let chapterNumber = 1; chapterNumber <= 7; chapterNumber += 1) {
      const first = getChapterAssessment(chapterNumber)
      const second = getChapterAssessment(chapterNumber)

      expect(first).not.toBeNull()
      if (!first) throw new Error(`Missing chapter ${chapterNumber} assessment`)
      expect(second).toEqual(first)
      expect(first.passed).toBe(true)
      expect(first.memberVotes).toHaveLength(6)
      expect(first.crewAssignments).toHaveLength(4)
      expect(
        new Set(first.crewAssignments.map((task) => task.memberName)).size,
      ).toBe(4)
      expect(first.supportCount).toBeGreaterThan(3)
      expect(first.supportRate).toBe(
        Math.round((first.supportCount / first.memberVotes.length) * 100),
      )
    }
  })

  it('reviews the exact crew assignments from the prior meeting with a fixed player S and shuffled A-D grades', () => {
    for (let chapterNumber = 1; chapterNumber <= 7; chapterNumber += 1) {
      const assessment = getChapterAssessment(chapterNumber)
      const review = getChapterPerformanceReview(chapterNumber)
      expect(assessment).not.toBeNull()
      expect(review).not.toBeNull()
      if (!assessment || !review) continue

      expect(review.entries[0]).toMatchObject({
        name: 'Thomas Shelby',
        grade: 'S',
        isPlayer: true,
      })
      expect(review.entries.slice(1).map((entry) => entry.name)).toEqual(
        assessment.crewAssignments.map((task) => task.memberName),
      )
      expect(review.entries.slice(1).map((entry) => entry.taskName)).toEqual(
        assessment.crewAssignments.map((task) => task.taskName),
      )
      expect(
        [...review.entries.slice(1).map((entry) => entry.grade)].sort(),
      ).toEqual(['A', 'B', 'C', 'D'])
    }
  })

  it('keeps Thomas as a non-voting observer only in chapter one', () => {
    expect(getChapterAssessment(1)?.playerCanVote).toBe(false)
    for (let chapterNumber = 2; chapterNumber <= 7; chapterNumber += 1) {
      expect(getChapterAssessment(chapterNumber)?.playerCanVote).toBe(true)
    }
  })

  it('rejects unknown chapter numbers', () => {
    expect(getChapterAssessment(0)).toBeNull()
    expect(getChapterAssessment(8)).toBeNull()
  })
})
