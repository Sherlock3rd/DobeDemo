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
})
