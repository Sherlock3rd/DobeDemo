import { describe, expect, it } from 'vitest'
import { getHeroLevelCap, getHeroStats, isHeroId } from './heroes'

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
})
