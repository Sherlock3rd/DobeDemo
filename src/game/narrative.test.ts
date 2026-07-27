import { describe, expect, it } from 'vitest'
import { BUILDING_IDS } from './cityTypes'
import { getNarrativeEvent, isNarrativeEventId } from './narrative'

describe('progression narrative', () => {
  it('provides one to three in-world lines for every required trigger', () => {
    const ids = [
      'first-entry',
      'prologue:police-chase',
      'prologue:bo-invitation',
      'prologue:garage',
      'prologue:ambush',
      'prologue:prospect',
      'prologue:tasks',
      'prologue:gun-gift',
      'prologue:gang-training',
      'special-vote:formal-member',
      'special-vote:president',
      ...Array.from({ length: 7 }, (_, index) => `chapter-start:${index + 1}`),
      ...Array.from({ length: 7 }, (_, index) => `chapter-end:${index + 1}`),
      ...BUILDING_IDS.map((id) => `building-claimed:${id}`),
      ...[8, 16, 24, 32, 40, 50].map((level) => `promotion:${level}`),
    ]

    for (const id of ids) {
      const event = getNarrativeEvent(id)
      expect(event, id).not.toBeNull()
      expect(event?.lines.length, id).toBeGreaterThanOrEqual(1)
      expect(event?.lines.length, id).toBeLessThanOrEqual(3)
      expect(
        event?.lines.every(
          (line) =>
            line.speaker.length > 0 &&
            line.speakerRole.length > 0 &&
            line.text.length > 0,
        ),
        id,
      ).toBe(true)
      expect(isNarrativeEventId(id), id).toBe(true)
    }
  })

  it('rejects unknown narrative events', () => {
    expect(getNarrativeEvent('chapter-start:99')).toBeNull()
    expect(getNarrativeEvent('building-claimed:unknown')).toBeNull()
    expect(getNarrativeEvent('promotion:2')).toBeNull()
    expect(isNarrativeEventId('anything')).toBe(false)
  })

  it('frames progression as internal gang authority rather than conquering the city', () => {
    const intro = getNarrativeEvent('first-entry')
    const repairShop = getNarrativeEvent('building-claimed:repair-shop')
    const allCopy = [...(intro?.lines ?? []), ...(repairShop?.lines ?? [])]
      .map((line) => line.text)
      .join(' ')

    expect(allCopy).toContain('城市一直是剃刀党的')
    expect(repairShop?.title).toBe('修车厂管理权交接')
    expect(allCopy).not.toMatch(/第一块地盘|拿下修车厂|换了主人|整座城市服从/)
  })

  it('provides post-vote portrait dialogue for the two key eligibility decisions', () => {
    expect(getNarrativeEvent('special-vote:formal-member')).toMatchObject({
      title: '正式成员资格通过',
      lines: [
        expect.objectContaining({ speaker: 'Maeve “Red” Quinn' }),
        expect.objectContaining({ speaker: 'Thomas Shelby' }),
      ],
    })
    expect(getNarrativeEvent('special-vote:president')).toMatchObject({
      title: '主席继任资格通过',
      lines: [
        expect.objectContaining({ speaker: 'Winston Cole' }),
        expect.objectContaining({ speaker: 'Thomas Shelby' }),
      ],
    })
  })

  it('frames chapter one as the prologue and later openings as post-meeting task packages', () => {
    const firstChapterCopy =
      getNarrativeEvent('chapter-start:1')
        ?.lines.map((line) => line.text)
        .join(' ') ?? ''
    expect(firstChapterCopy).toContain('三项转正任务')
    expect(firstChapterCopy).toContain('权力树参加转正会议')
    expect(firstChapterCopy).not.toMatch(/投票|表决|会议结束/)

    for (let chapterNumber = 2; chapterNumber <= 7; chapterNumber += 1) {
      const event = getNarrativeEvent(`chapter-start:${chapterNumber}`)
      const copy = event?.lines.map((line) => line.text).join(' ') ?? ''

      expect(copy, `chapter ${chapterNumber}`).toMatch(/会议|委员会/)
      expect(copy, `chapter ${chapterNumber}`).toContain('任务包')
      expect(copy, `chapter ${chapterNumber}`).toMatch(/先|再/)
    }
  })

  it('sends every non-final chapter ending to its assessment meeting', () => {
    for (let chapterNumber = 1; chapterNumber <= 6; chapterNumber += 1) {
      const copy =
        getNarrativeEvent(`chapter-end:${chapterNumber}`)
          ?.lines.map((line) => line.text)
          .join(' ') ?? ''
      expect(copy, `chapter ${chapterNumber}`).toContain('评定会议')
    }
  })
})
