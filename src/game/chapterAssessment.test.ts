import { describe, expect, it } from 'vitest'
import {
  getChapterAssessment,
  getChapterPerformanceReview,
} from './chapterAssessment'

describe('chapter assessment meeting', () => {
  it('uses the formal-member vote as the only first transition vote and keeps later neutral events deterministic', () => {
    for (
      let completedChapterNumber = 1;
      completedChapterNumber < 7;
      completedChapterNumber += 1
    ) {
      const first = getChapterAssessment(completedChapterNumber)
      const second = getChapterAssessment(completedChapterNumber)

      expect(first).not.toBeNull()
      if (!first) throw new Error('Missing chapter transition assessment')
      expect(second).toEqual(first)
      expect(first.completedChapter.number).toBe(completedChapterNumber)
      expect(first.nextChapter.number).toBe(completedChapterNumber + 1)
      expect(first.eventVoteRequired).toBe(completedChapterNumber !== 1)
      expect(first.options.map((option) => option.id)).toEqual([
        'option-a',
        'option-b',
      ])
      expect(first.memberVotes).toHaveLength(6)
      expect(first.optionACount + first.optionBCount).toBe(6)
    }
  })

  it('offers three deterministic packages with lighter early and fuller late counts', () => {
    for (
      let completedChapterNumber = 1;
      completedChapterNumber < 7;
      completedChapterNumber += 1
    ) {
      const first = getChapterAssessment(completedChapterNumber)?.taskPackages
      const second = getChapterAssessment(completedChapterNumber)?.taskPackages
      expect(first).toEqual(second)
      expect(first).toHaveLength(3)
      const nextChapterNumber = completedChapterNumber + 1
      const minimum = nextChapterNumber <= 4 ? 1 : 2
      const maximum = nextChapterNumber <= 4 ? 2 : 3
      for (const taskPackage of first ?? []) {
        expect(taskPackage.tasks.length).toBeGreaterThanOrEqual(minimum)
        expect(taskPackage.tasks.length).toBeLessThanOrEqual(maximum)
      }
    }
  })

  it('skips the prologue review but rates every later meeting participant deterministically', () => {
    expect(getChapterPerformanceReview(1)).toBeNull()

    for (const completedChapterNumber of [2, 3, 4, 5, 6]) {
      const first = getChapterPerformanceReview(completedChapterNumber)
      const second = getChapterPerformanceReview(completedChapterNumber)
      expect(first).toEqual(second)
      expect(first?.entries).toHaveLength(5)
      expect(first?.entries[0]).toMatchObject({
        name: 'Thomas Shelby',
        grade: 'S',
        isPlayer: true,
      })
      expect(
        new Set(first?.entries.slice(1).map((entry) => entry.grade)),
      ).toEqual(new Set(['A', 'B', 'C', 'D']))
    }
  })

  it('adds fixed eligibility votes only before formal membership and the presidency', () => {
    const formalMemberVote = getChapterAssessment(1)?.specialVote
    const presidentVote = getChapterAssessment(6)?.specialVote

    expect(formalMemberVote).toMatchObject({
      id: 'formal-member',
      approveCount: 5,
      abstainCount: 1,
      dialogueEventId: 'special-vote:formal-member',
    })
    expect(formalMemberVote?.memberVotes).toHaveLength(6)
    expect(presidentVote).toMatchObject({
      id: 'president',
      approveCount: 6,
      abstainCount: 0,
      dialogueEventId: 'special-vote:president',
    })
    expect(presidentVote?.memberVotes).toHaveLength(6)

    for (const completedChapterNumber of [2, 3, 4, 5]) {
      expect(
        getChapterAssessment(completedChapterNumber)?.specialVote,
      ).toBeNull()
    }
  })

  it('rejects numbers without a next chapter', () => {
    expect(getChapterAssessment(0)).toBeNull()
    expect(getChapterAssessment(7)).toBeNull()
    expect(getChapterAssessment(8)).toBeNull()
  })
})
