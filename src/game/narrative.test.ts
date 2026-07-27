import { describe, expect, it } from 'vitest'
import { BUILDING_IDS } from './cityTypes'
import { getNarrativeEvent, isNarrativeEventId } from './narrative'

describe('progression narrative', () => {
  it('provides one to three in-world lines for every required trigger', () => {
    const ids = [
      'first-entry',
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
})
