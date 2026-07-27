import { describe, expect, it } from 'vitest'
import { getChapterAssessment } from './chapterAssessment'

describe('chapter assessment meeting', () => {
  it('defines one deterministic neutral event for every chapter transition', () => {
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
      expect(first.options.map((option) => option.id)).toEqual([
        'option-a',
        'option-b',
      ])
      expect(first.memberVotes).toHaveLength(6)
      expect(first.optionACount + first.optionBCount).toBe(6)
    }
  })

  it('offers exactly three packages containing one, two, and three meeting tasks', () => {
    for (
      let completedChapterNumber = 1;
      completedChapterNumber < 7;
      completedChapterNumber += 1
    ) {
      expect(
        getChapterAssessment(completedChapterNumber)?.taskPackages.map(
          (taskPackage) => taskPackage.tasks.length,
        ),
      ).toEqual([1, 2, 3])
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
