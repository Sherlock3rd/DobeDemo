import { describe, expect, it } from 'vitest'
import { HERO_IDS, getHeroLevelCap, getHeroStats, isHeroId } from './heroes'
import { PROGRESSION_UNLOCKS } from './progressionUnlocks'

describe('heroes', () => {
  it('derives level-1 stats from config base values', () => {
    expect(getHeroStats('foreman', 1)).toEqual({ hp: 800, atk: 120, def: 40 })
  })

  it('applies per-level growth as safe integers', () => {
    // foreman Lv3: hp 800+60*2=920, atk 120+10*2=140, def 40+3*2=46
    expect(getHeroStats('foreman', 3)).toEqual({ hp: 920, atk: 140, def: 46 })
  })

  it('caps hero level by gang level', () => {
    expect(getHeroLevelCap(12)).toBe(12)
    expect(getHeroLevelCap(60)).toBe(50)
    expect(getHeroLevelCap(0)).toBe(1)
  })

  it('narrows hero ids', () => {
    expect(isHeroId('anvil')).toBe(true)
    expect(isHeroId('nobody')).toBe(false)
  })

  it('keeps HERO_IDS in exact sync with the PROGRESSION_UNLOCKS hero set', () => {
    const unlockHeroIds = PROGRESSION_UNLOCKS.filter(
      (
        unlock,
      ): unlock is (typeof PROGRESSION_UNLOCKS)[number] & {
        kind: 'hero'
      } => unlock.kind === 'hero',
    ).map((unlock) => unlock.heroId)

    expect(new Set(HERO_IDS)).toEqual(new Set(unlockHeroIds))
    expect(HERO_IDS).toHaveLength(unlockHeroIds.length)
  })
})
