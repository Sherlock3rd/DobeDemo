import { describe, expect, it, vi } from 'vitest'
import {
  buildBattleInput,
  createBattleSeed,
  simulateBattle,
  type BattleInput,
  type BattleUnitInput,
} from './battleEngine'

function foremanVsStage1(): BattleInput {
  return buildBattleInput(
    1,
    [{ heroId: 'foreman', row: 'back', index: 1 }],
    { foreman: 1, anvil: 1, skyline: 1 },
    1,
  )
}

describe('battleEngine', () => {
  it('is fully deterministic for identical input', () => {
    const input = foremanVsStage1()
    const a = simulateBattle(input)
    const b = simulateBattle(input)
    expect(a).toEqual(b)
    expect(a.timeline).toEqual(b.timeline)
  })

  it('never reads Math.random or Date.now', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be called')
    })
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Date.now must not be called')
    })
    try {
      const input = buildBattleInput(
        1,
        [{ heroId: 'foreman', row: 'back', index: 1 }],
        { foreman: 1, anvil: 1, skyline: 1 },
        1,
      )
      createBattleSeed({
        stage: input.stage,
        allies: input.allies,
        enemies: input.enemies,
      })
      simulateBattle(input)
      expect(randomSpy).not.toHaveBeenCalled()
      expect(nowSpy).not.toHaveBeenCalled()
    } finally {
      randomSpy.mockRestore()
      nowSpy.mockRestore()
    }
  })

  it('wins stage 1 with foreman and reports enemies-cleared', () => {
    const result = simulateBattle(foremanVsStage1())
    expect(result.outcome).toBe('victory')
    expect(result.reason).toBe('enemies-cleared')
    expect(result.alliesSurvived).toBeGreaterThanOrEqual(1)
    expect(result.endedAtTick).toBeLessThanOrEqual(600)
  })

  it('records tick snapshots with hits and a final death', () => {
    const result = simulateBattle(foremanVsStage1())
    expect(result.timeline.length).toBe(result.endedAtTick)
    expect(result.timeline.some((t) => t.hits.length > 0)).toBe(true)
    expect(result.timeline.some((t) => t.deaths.length > 0)).toBe(true)
  })

  it('times out to defeat when no side can kill (Lv1 vs Lv10 wall)', () => {
    const input = buildBattleInput(
      20,
      [{ heroId: 'foreman', row: 'back', index: 1 }],
      { foreman: 1, anvil: 1, skyline: 1 },
      1,
    )
    const result = simulateBattle(input)
    expect(result.outcome).toBe('defeat')
    expect(['allies-defeated', 'timeout']).toContain(result.reason)
  })

  it('builds enemies by count and shared stage stats, filling front then back', () => {
    const input = buildBattleInput(
      8,
      [{ heroId: 'foreman', row: 'back', index: 1 }],
      { foreman: 1, anvil: 1, skyline: 1 },
      1,
    )
    expect(input.enemies).toHaveLength(3) // getEnemyCount(8) === 3
    expect(input.enemies.map((e) => `${e.row}:${e.index}`)).toEqual([
      'front:0',
      'front:1',
      'back:0',
    ])
  })
})

// Supplementary deterministic sub-tests: skill releases after
// initialCooldownTicks, splash hits multiple living enemies on the same tick,
// tie-break by globalIndex ascending, dead units removed at tick end.
describe('battleEngine skills / determinism', () => {
  // A durable ally that outlasts its own skill cooldown against three
  // high-HP, negligible-damage dummies so we can observe skill + splash.
  function skillScenario(): BattleInput {
    const skill = {
      targetMultiplier: 2.5,
      splashMultiplier: 0.8,
      initialCooldownTicks: 30,
      cooldownTicks: 90,
    }
    const dummySkill = {
      targetMultiplier: 2,
      splashMultiplier: 0.5,
      initialCooldownTicks: 999,
      cooldownTicks: 999,
    }
    const ally: BattleUnitInput = {
      side: 'ally',
      heroId: 'foreman',
      level: 1,
      row: 'back',
      index: 1,
      hp: 100000,
      atk: 100,
      def: 50,
      skill,
    }
    const enemies: BattleUnitInput[] = [
      {
        side: 'enemy',
        level: 1,
        row: 'front',
        index: 0,
        hp: 5000,
        atk: 1,
        def: 10,
        skill: dummySkill,
      },
      {
        side: 'enemy',
        level: 1,
        row: 'front',
        index: 1,
        hp: 5000,
        atk: 1,
        def: 10,
        skill: dummySkill,
      },
      {
        side: 'enemy',
        level: 1,
        row: 'back',
        index: 0,
        hp: 5000,
        atk: 1,
        def: 10,
        skill: dummySkill,
      },
    ]
    const allies = [ally]
    const seed = createBattleSeed({ stage: 99, allies, enemies })
    return { stage: 99, allies, enemies, seed }
  }

  it('releases a skill once the cooldown elapses (skill-main event)', () => {
    const result = simulateBattle(skillScenario())
    const skillMainTicks = result.timeline.filter((t) =>
      t.hits.some((h) => h.kind === 'skill-main'),
    )
    expect(skillMainTicks.length).toBeGreaterThan(0)
    // ally acts at tick % 8 === 3; cooldown reaches 0 at tick 30 -> first
    // eligible action tick is 35.
    expect(skillMainTicks[0]?.tick).toBe(35)
  })

  it('splashes all other living enemies on the skill tick', () => {
    const result = simulateBattle(skillScenario())
    const skillTick = result.timeline.find((t) =>
      t.hits.some((h) => h.kind === 'skill-main'),
    )
    expect(skillTick).toBeDefined()
    const splashes = skillTick!.hits.filter((h) => h.kind === 'skill-splash')
    // one main target + two splashed enemies
    expect(splashes).toHaveLength(2)
    expect(
      splashes.map((h) => h.targetGlobalIndex).sort((a, b) => a - b),
    ).toEqual([1, 2])
  })

  it('resolves attacks against the lowest living front globalIndex first', () => {
    const result = simulateBattle(skillScenario())
    const firstHit = result.timeline
      .flatMap((t) => t.hits)
      .find((h) => h.attackerSide === 'ally')
    expect(firstHit?.targetGlobalIndex).toBe(0)
  })

  it('removes a unit from the target pool once it dies (deaths at tick end)', () => {
    const result = simulateBattle(foremanVsStage1())
    const deathTick = result.timeline.find((t) => t.deaths.length > 0)
    expect(deathTick).toBeDefined()
    const dead = deathTick!.deaths[0]
    // after the death tick the unit is never targeted again
    const laterHits = result.timeline
      .filter((t) => t.tick > deathTick!.tick)
      .flatMap((t) => t.hits)
      .filter(
        (h) =>
          h.targetSide === dead.side &&
          h.targetGlobalIndex === dead.globalIndex,
      )
    expect(laterHits).toHaveLength(0)
  })
})

describe('buildBattleInput validation (spec §14.3, no silent clamp)', () => {
  it('rejects an empty formation', () => {
    expect(() =>
      buildBattleInput(1, [], { foreman: 1, anvil: 1, skyline: 1 }, 1),
    ).toThrow(/Invalid battle input/)
  })

  it('rejects a locked hero', () => {
    // anvil unlocks at gang level 12; gang level 1 -> locked
    expect(() =>
      buildBattleInput(
        1,
        [{ heroId: 'anvil', row: 'front', index: 0 }],
        { foreman: 1, anvil: 1, skyline: 1 },
        1,
      ),
    ).toThrow(/Invalid battle input/)
  })

  it('rejects a hero level above the gang cap (no clamp)', () => {
    // cap = min(50, gangLevel) = 1; level 5 is illegal and must fail
    expect(() =>
      buildBattleInput(
        1,
        [{ heroId: 'foreman', row: 'back', index: 1 }],
        { foreman: 5, anvil: 1, skyline: 1 },
        1,
      ),
    ).toThrow(/Invalid battle input/)
  })

  it('rejects duplicate slots', () => {
    expect(() =>
      buildBattleInput(
        1,
        [
          { heroId: 'foreman', row: 'back', index: 1 },
          { heroId: 'foreman', row: 'back', index: 1 },
        ],
        { foreman: 1, anvil: 1, skyline: 1 },
        1,
      ),
    ).toThrow(/Invalid battle input/)
  })

  it('rejects an unknown stage with Invalid battle input: stage', () => {
    expect(() =>
      buildBattleInput(
        0,
        [{ heroId: 'foreman', row: 'back', index: 1 }],
        { foreman: 1, anvil: 1, skyline: 1 },
        1,
      ),
    ).toThrow('Invalid battle input: stage')
    expect(() =>
      buildBattleInput(
        21,
        [{ heroId: 'foreman', row: 'back', index: 1 }],
        { foreman: 1, anvil: 1, skyline: 1 },
        1,
      ),
    ).toThrow('Invalid battle input: stage')
    expect(() =>
      buildBattleInput(
        1.5,
        [{ heroId: 'foreman', row: 'back', index: 1 }],
        { foreman: 1, anvil: 1, skyline: 1 },
        1,
      ),
    ).toThrow('Invalid battle input: stage')
  })

  it('rejects illegal gangLevel without silent normalize', () => {
    const formation = [
      { heroId: 'foreman' as const, row: 'back' as const, index: 1 },
    ]
    const levels = { foreman: 1, anvil: 1, skyline: 1 }
    for (const gangLevel of [0, 51, 1.5, NaN, Infinity, -1]) {
      expect(() => buildBattleInput(1, formation, levels, gangLevel)).toThrow(
        'Invalid battle input: gangLevel',
      )
    }
  })

  it('accepts a legal formation at the cap', () => {
    expect(() =>
      buildBattleInput(
        1,
        [{ heroId: 'foreman', row: 'back', index: 1 }],
        { foreman: 1, anvil: 1, skyline: 1 },
        1,
      ),
    ).not.toThrow()
  })
})

describe('createBattleSeed encodes combat-affecting fields', () => {
  function baseUnit(overrides: Partial<BattleUnitInput> = {}): BattleUnitInput {
    return {
      side: 'ally',
      heroId: 'foreman',
      level: 1,
      row: 'back',
      index: 1,
      hp: 1000,
      atk: 100,
      def: 20,
      skill: {
        targetMultiplier: 2,
        splashMultiplier: 0.5,
        initialCooldownTicks: 30,
        cooldownTicks: 90,
      },
      ...overrides,
    }
  }

  it('changes when hp/atk/def differ', () => {
    const allies = [baseUnit()]
    const enemies = [
      baseUnit({ side: 'enemy', heroId: undefined, row: 'front', index: 0 }),
    ]
    const a = createBattleSeed({ stage: 1, allies, enemies })
    const b = createBattleSeed({
      stage: 1,
      allies: [baseUnit({ hp: 1001 })],
      enemies,
    })
    const c = createBattleSeed({
      stage: 1,
      allies: [baseUnit({ atk: 101 })],
      enemies,
    })
    const d = createBattleSeed({
      stage: 1,
      allies: [baseUnit({ def: 21 })],
      enemies,
    })
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
    expect(a).not.toBe(d)
  })

  it('changes when skill multipliers or cooldowns differ', () => {
    const allies = [baseUnit()]
    const enemies = [
      baseUnit({ side: 'enemy', heroId: undefined, row: 'front', index: 0 }),
    ]
    const a = createBattleSeed({ stage: 1, allies, enemies })
    const b = createBattleSeed({
      stage: 1,
      allies: [
        baseUnit({
          skill: {
            targetMultiplier: 2.1,
            splashMultiplier: 0.5,
            initialCooldownTicks: 30,
            cooldownTicks: 90,
          },
        }),
      ],
      enemies,
    })
    const c = createBattleSeed({
      stage: 1,
      allies: [
        baseUnit({
          skill: {
            targetMultiplier: 2,
            splashMultiplier: 0.6,
            initialCooldownTicks: 30,
            cooldownTicks: 90,
          },
        }),
      ],
      enemies,
    })
    const d = createBattleSeed({
      stage: 1,
      allies: [
        baseUnit({
          skill: {
            targetMultiplier: 2,
            splashMultiplier: 0.5,
            initialCooldownTicks: 31,
            cooldownTicks: 90,
          },
        }),
      ],
      enemies,
    })
    const e = createBattleSeed({
      stage: 1,
      allies: [
        baseUnit({
          skill: {
            targetMultiplier: 2,
            splashMultiplier: 0.5,
            initialCooldownTicks: 30,
            cooldownTicks: 91,
          },
        }),
      ],
      enemies,
    })
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
    expect(a).not.toBe(d)
    expect(a).not.toBe(e)
  })
})
