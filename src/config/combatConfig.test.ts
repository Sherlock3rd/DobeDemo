import { describe, expect, it } from 'vitest'
import { combatConfig, parseCombatConfig } from './combatConfig'

describe('combat config', () => {
  it('locks tickMs and maxBattleTicks', () => {
    expect(combatConfig.tickMs).toBe(100)
    expect(combatConfig.maxBattleTicks).toBe(600)
    expect(combatConfig.positionModifiers.front.aggro).toBe(true)
    expect(combatConfig.positionModifiers.back.aggro).toBe(false)
  })

  it('rejects a wrong tickMs', () => {
    const bad = structuredClone(combatConfig) as unknown as Record<
      string,
      unknown
    >
    bad.tickMs = 50
    expect(() => parseCombatConfig(bad)).toThrow(
      'Invalid combat config: tickMs',
    )
  })

  it('rejects a non-positive defenseConstant', () => {
    const bad = structuredClone(combatConfig) as unknown as Record<
      string,
      unknown
    >
    bad.defenseConstant = 0
    expect(() => parseCombatConfig(bad)).toThrow(
      'Invalid combat config: defenseConstant',
    )
  })

  it('rejects an unknown top-level key', () => {
    const bad = structuredClone(combatConfig) as unknown as Record<
      string,
      unknown
    >
    bad.extra = 1
    expect(() => parseCombatConfig(bad)).toThrow('Invalid combat config: extra')
  })

  it('rejects an unknown skillDefaults key', () => {
    const bad = structuredClone(combatConfig) as unknown as Record<
      string,
      unknown
    >
    ;(bad.skillDefaults as Record<string, unknown>).extra = 1
    expect(() => parseCombatConfig(bad)).toThrow(
      'Invalid combat config: skillDefaults.extra',
    )
  })

  it('rejects an unknown positionModifier key', () => {
    const bad = structuredClone(combatConfig) as unknown as Record<
      string,
      unknown
    >
    ;(
      (bad.positionModifiers as Record<string, unknown>).front as Record<
        string,
        unknown
      >
    ).extra = 1
    expect(() => parseCombatConfig(bad)).toThrow(
      'Invalid combat config: positionModifiers.front.extra',
    )
  })

  it('rejects an unknown powerWeights key', () => {
    const bad = structuredClone(combatConfig) as unknown as Record<
      string,
      unknown
    >
    ;(bad.powerWeights as Record<string, unknown>).extra = 1
    expect(() => parseCombatConfig(bad)).toThrow(
      'Invalid combat config: powerWeights.extra',
    )
  })
})
