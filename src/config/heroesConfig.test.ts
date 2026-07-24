import { describe, expect, it } from 'vitest'
import { expToLevel, heroesConfig, parseHeroesConfig } from './heroesConfig'

describe('heroes config', () => {
  it('exposes hero base stats and skill', () => {
    expect(heroesConfig.version).toBe(1)
    expect(heroesConfig.heroes.foreman.baseHp).toBe(800)
    expect(heroesConfig.heroes.anvil.role).toBe('front')
    expect(heroesConfig.heroes.skyline.skill.targetMultiplier).toBe(3.2)
  })

  it('materializes expToLevel(L) = 50 * (L + 1)', () => {
    expect(expToLevel(1)).toBe(100)
    expect(expToLevel(2)).toBe(150)
    expect(expToLevel(49)).toBe(2500)
    expect(() => expToLevel(50)).toThrow()
    expect(() => expToLevel(0)).toThrow()
  })

  it('rejects unlockGangLevel diverging from PROGRESSION_UNLOCKS', () => {
    const bad = structuredClone(heroesConfig) as unknown as Record<
      string,
      unknown
    >
    ;(
      bad.heroes as Record<string, Record<string, unknown>>
    ).anvil.unlockGangLevel = 13
    expect(() => parseHeroesConfig(bad)).toThrow(
      'Invalid heroes config: heroes.anvil.unlockGangLevel',
    )
  })

  it('rejects negative or non-integer base stats', () => {
    const bad = structuredClone(heroesConfig) as unknown as Record<
      string,
      unknown
    >
    ;(bad.heroes as Record<string, Record<string, unknown>>).foreman.baseHp = -1
    expect(() => parseHeroesConfig(bad)).toThrow(
      'Invalid heroes config: heroes.foreman.baseHp',
    )
  })
})
