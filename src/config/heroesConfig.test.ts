import { describe, expect, it } from 'vitest'
import { expToLevel, heroesConfig, parseHeroesConfig } from './heroesConfig'

function heroesConfigWithUnsafeInteger(
  path: readonly string[],
): Record<string, unknown> {
  const bad = structuredClone(heroesConfig) as unknown as Record<
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

describe('heroes config', () => {
  it('exposes hero base stats and skill', () => {
    expect(heroesConfig.version).toBe(1)
    expect(heroesConfig.heroes.foreman.baseHp).toBe(800)
    expect(heroesConfig.heroes.anvil.role).toBe('front')
    expect(heroesConfig.heroes.skyline.skill.targetMultiplier).toBe(3.2)
    expect(heroesConfig.heroes.foreman.skill).toMatchObject({
      description: '猛烈轰击主目标，并波及其他敌人。',
      rageCost: 100,
      ragePerBasicAttack: 20,
      ragePerHitTaken: 10,
    })
    expect(heroesConfig.heroes.anvil.skill.description).toBe(
      '重击主目标，并震伤周围敌人。',
    )
    expect(heroesConfig.heroes.skyline.skill.description).toBe(
      '狙击主目标，同时压制其他敌人。',
    )
  })

  it.each([
    ['rageCost', 101],
    ['ragePerBasicAttack', 21],
    ['ragePerHitTaken', 11],
  ] as const)('rejects a non-literal skill %s', (key, value) => {
    const bad = structuredClone(heroesConfig) as unknown as Record<
      string,
      unknown
    >
    const skill = (bad.heroes as Record<string, Record<string, unknown>>)
      .foreman.skill as Record<string, unknown>
    skill[key] = value

    expect(() => parseHeroesConfig(bad)).toThrow(
      `Invalid heroes config: heroes.foreman.skill.${key}`,
    )
  })

  it.each(['rageCost', 'ragePerBasicAttack', 'ragePerHitTaken'] as const)(
    'rejects a non-positive skill %s',
    (key) => {
      const bad = structuredClone(heroesConfig) as unknown as Record<
        string,
        unknown
      >
      const skill = (bad.heroes as Record<string, Record<string, unknown>>)
        .foreman.skill as Record<string, unknown>
      skill[key] = 0

      expect(() => parseHeroesConfig(bad)).toThrow(
        `Invalid heroes config: heroes.foreman.skill.${key}`,
      )
    },
  )

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

  it.each([
    { label: 'expToLevel.1', path: ['expToLevel', '1'] },
    {
      label: 'heroes.foreman.defaultSlot.index',
      path: ['heroes', 'foreman', 'defaultSlot', 'index'],
    },
    {
      label: 'heroes.foreman.unlockGangLevel',
      path: ['heroes', 'foreman', 'unlockGangLevel'],
    },
    {
      label: 'heroes.foreman.baseHp',
      path: ['heroes', 'foreman', 'baseHp'],
    },
    {
      label: 'heroes.foreman.baseAtk',
      path: ['heroes', 'foreman', 'baseAtk'],
    },
    {
      label: 'heroes.foreman.baseDef',
      path: ['heroes', 'foreman', 'baseDef'],
    },
    {
      label: 'heroes.foreman.hpPerLevel',
      path: ['heroes', 'foreman', 'hpPerLevel'],
    },
    {
      label: 'heroes.foreman.atkPerLevel',
      path: ['heroes', 'foreman', 'atkPerLevel'],
    },
    {
      label: 'heroes.foreman.defPerLevel',
      path: ['heroes', 'foreman', 'defPerLevel'],
    },
    {
      label: 'heroes.foreman.skill.initialCooldownTicks',
      path: ['heroes', 'foreman', 'skill', 'initialCooldownTicks'],
    },
    {
      label: 'heroes.foreman.skill.cooldownTicks',
      path: ['heroes', 'foreman', 'skill', 'cooldownTicks'],
    },
    {
      label: 'heroes.foreman.skill.rageCost',
      path: ['heroes', 'foreman', 'skill', 'rageCost'],
    },
    {
      label: 'heroes.foreman.skill.ragePerBasicAttack',
      path: ['heroes', 'foreman', 'skill', 'ragePerBasicAttack'],
    },
    {
      label: 'heroes.foreman.skill.ragePerHitTaken',
      path: ['heroes', 'foreman', 'skill', 'ragePerHitTaken'],
    },
  ])('rejects an unsafe integer for $label', ({ label, path }) => {
    expect(() =>
      parseHeroesConfig(heroesConfigWithUnsafeInteger(path)),
    ).toThrow(`Invalid heroes config: ${label}`)
  })

  it.each([
    { row: 'front', index: 2 },
    { row: 'back', index: 3 },
  ] as const)('rejects default slot $row[$index]', ({ row, index }) => {
    const bad = structuredClone(heroesConfig) as unknown as Record<
      string,
      unknown
    >
    const slot = (bad.heroes as Record<string, Record<string, unknown>>).foreman
      .defaultSlot as Record<string, unknown>
    slot.row = row
    slot.index = index

    expect(() => parseHeroesConfig(bad)).toThrow(
      'Invalid heroes config: heroes.foreman.defaultSlot.index',
    )
  })

  it.each([
    {
      baseKey: 'baseHp',
      growthKey: 'hpPerLevel',
      derivedKey: 'hpAtLevel50',
    },
    {
      baseKey: 'baseAtk',
      growthKey: 'atkPerLevel',
      derivedKey: 'atkAtLevel50',
    },
    {
      baseKey: 'baseDef',
      growthKey: 'defPerLevel',
      derivedKey: 'defAtLevel50',
    },
  ] as const)(
    'rejects individually safe $derivedKey inputs whose derived value is unsafe',
    ({ baseKey, growthKey, derivedKey }) => {
      const bad = structuredClone(heroesConfig) as unknown as Record<
        string,
        unknown
      >
      const foreman = (bad.heroes as Record<string, Record<string, unknown>>)
        .foreman
      foreman[baseKey] = Number.MAX_SAFE_INTEGER
      foreman[growthKey] = 1

      expect(() => parseHeroesConfig(bad)).toThrow(
        `Invalid heroes config: heroes.foreman.${derivedKey}`,
      )
    },
  )

  it('rejects an unknown top-level key', () => {
    const bad = structuredClone(heroesConfig) as unknown as Record<
      string,
      unknown
    >
    bad.extra = 1
    expect(() => parseHeroesConfig(bad)).toThrow('Invalid heroes config: extra')
  })

  it('rejects an unknown hero key', () => {
    const bad = structuredClone(heroesConfig) as unknown as Record<
      string,
      unknown
    >
    ;(bad.heroes as Record<string, Record<string, unknown>>).foreman.extra = 1
    expect(() => parseHeroesConfig(bad)).toThrow(
      'Invalid heroes config: heroes.foreman.extra',
    )
  })

  it('rejects an unknown defaultSlot key', () => {
    const bad = structuredClone(heroesConfig) as unknown as Record<
      string,
      unknown
    >
    ;(
      (bad.heroes as Record<string, Record<string, unknown>>).foreman
        .defaultSlot as Record<string, unknown>
    ).extra = 1
    expect(() => parseHeroesConfig(bad)).toThrow(
      'Invalid heroes config: heroes.foreman.defaultSlot.extra',
    )
  })

  it('rejects an unknown skill key', () => {
    const bad = structuredClone(heroesConfig) as unknown as Record<
      string,
      unknown
    >
    ;(
      (bad.heroes as Record<string, Record<string, unknown>>).foreman
        .skill as Record<string, unknown>
    ).extra = 1
    expect(() => parseHeroesConfig(bad)).toThrow(
      'Invalid heroes config: heroes.foreman.skill.extra',
    )
  })

  it('rejects an unknown appearance key', () => {
    const bad = structuredClone(heroesConfig) as unknown as Record<
      string,
      unknown
    >
    ;(
      (bad.heroes as Record<string, Record<string, unknown>>).foreman
        .appearance as Record<string, unknown>
    ).extra = 1
    expect(() => parseHeroesConfig(bad)).toThrow(
      'Invalid heroes config: heroes.foreman.appearance.extra',
    )
  })
})
