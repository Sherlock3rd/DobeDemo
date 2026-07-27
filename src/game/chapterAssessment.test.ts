import { describe, expect, it } from 'vitest'
import { getChapterAssessment } from './chapterAssessment'

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
      expect(first.supportCount).toBeGreaterThan(3)
      expect(first.supportRate).toBe(
        Math.round((first.supportCount / first.memberVotes.length) * 100),
      )
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
