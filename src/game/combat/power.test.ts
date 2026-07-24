import { describe, expect, it } from 'vitest'
import { effectiveStats, globalIndexOf, teamPower, unitPower } from './power'

describe('power', () => {
  it('maps slots to a fixed global order', () => {
    expect(globalIndexOf('front', 0)).toBe(0)
    expect(globalIndexOf('front', 1)).toBe(1)
    expect(globalIndexOf('back', 0)).toBe(2)
    expect(globalIndexOf('back', 2)).toBe(4)
  })

  it('applies position modifiers to atk/def but not hp', () => {
    // back: atkMul 1.15, defMul 0.9; atk 160 -> round(184)=184, def 30 -> round(27)=27, hp unchanged
    expect(effectiveStats('back', { hp: 650, atk: 160, def: 30 })).toEqual({
      effAtk: 184,
      effDef: 27,
      effHp: 650,
    })
    // front: atkMul 1.0, defMul 1.25; def 90 -> round(112.5)=113 (round half up)
    expect(effectiveStats('front', { hp: 1500, atk: 80, def: 90 })).toEqual({
      effAtk: 80,
      effDef: 113,
      effHp: 1500,
    })
  })

  it('computes integer power via weights', () => {
    // back skyline: effHp650*0.5 + effAtk184*2.0 + effDef27*1.5 = 325 + 368 + 40.5 = 733.5 -> round 734
    expect(unitPower('back', { hp: 650, atk: 160, def: 30 })).toBe(734)
    expect(teamPower([{ row: 'back', hp: 650, atk: 160, def: 30 }])).toBe(734)
  })
})
