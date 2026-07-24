import { describe, expect, it } from 'vitest'
import {
  basicAttackDamage,
  mitigation,
  skillMainDamage,
  skillSplashDamage,
} from './damage'

describe('damage', () => {
  it('computes mitigation from defenseConstant 100', () => {
    expect(mitigation(0)).toBe(1)
    expect(mitigation(100)).toBeCloseTo(0.5, 10)
  })

  it('floors basic attack with a minimum of 1', () => {
    // effAtk 184, effDef 27 -> mitigation 100/127; 184*100/127 = 144.88 -> floor 144
    expect(basicAttackDamage(184, 27)).toBe(144)
    // tiny attacker vs huge defender -> at least 1
    expect(basicAttackDamage(1, 100000)).toBe(1)
  })

  it('scales skill damage by multipliers with floor and min 1', () => {
    expect(skillMainDamage(184, 27, 3.2)).toBe(
      Math.max(1, Math.floor(184 * 3.2 * (100 / 127))),
    )
    expect(skillSplashDamage(184, 27, 0.4)).toBe(
      Math.max(1, Math.floor(184 * 0.4 * (100 / 127))),
    )
  })
})
