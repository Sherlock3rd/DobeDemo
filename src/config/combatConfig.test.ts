import { describe, expect, it } from 'vitest'
import { combatConfig, parseCombatConfig } from './combatConfig'

function combatConfigWithUnsafeInteger(
  path: readonly string[],
): Record<string, unknown> {
  const bad = structuredClone(combatConfig) as unknown as Record<
    string,
    unknown
  >
  let target = bad
  for (const segment of path.slice(0, -1)) {
    target = target[segment] as Record<string, unknown>
  }
  target[path.at(-1) as string] = Number.MAX_SAFE_INTEGER + 1
  return bad
}

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

  it.each([
    { label: 'tickMs', path: ['tickMs'] },
    { label: 'maxBattleTicks', path: ['maxBattleTicks'] },
    { label: 'attackIntervalTicks', path: ['attackIntervalTicks'] },
    {
      label: 'skillDefaults.initialCooldownTicks',
      path: ['skillDefaults', 'initialCooldownTicks'],
    },
    {
      label: 'skillDefaults.cooldownTicks',
      path: ['skillDefaults', 'cooldownTicks'],
    },
    {
      label: 'enemySkillCooldownTicks',
      path: ['enemySkillCooldownTicks'],
    },
  ])('rejects an unsafe integer for $label', ({ label, path }) => {
    expect(() =>
      parseCombatConfig(combatConfigWithUnsafeInteger(path)),
    ).toThrow(`Invalid combat config: ${label}`)
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

  it('rejects an unknown positionModifiers container key', () => {
    const bad = structuredClone(combatConfig) as unknown as Record<
      string,
      unknown
    >
    ;(bad.positionModifiers as Record<string, unknown>).middle = {
      atkMul: 1,
      defMul: 1,
      aggro: false,
    }
    expect(() => parseCombatConfig(bad)).toThrow(
      'Invalid combat config: positionModifiers.middle',
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
