import { describe, expect, it } from 'vitest'
import {
  idleExperienceConfig,
  parseIdleExperienceConfig,
  ratePerTick,
  settleIdleExperience,
} from './idleExperienceConfig'

function idleConfigWithUnsafeInteger(
  path: readonly string[],
): Record<string, unknown> {
  const bad = structuredClone(idleExperienceConfig) as unknown as Record<
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

describe('idle experience config', () => {
  it('scales rate as 2 * highestClearedStage and 0 when unopened', () => {
    expect(ratePerTick(1)).toBe(2)
    expect(ratePerTick(20)).toBe(40)
    expect(ratePerTick(0)).toBe(0)
  })

  it('accrues whole ticks and keeps the remainder', () => {
    const base = 1_000_000
    const r = settleIdleExperience({
      lastUpdatedAt: base,
      now: base + 25_000,
      highestClearedStage: 1,
    })
    expect(r).toEqual({ earnedExp: 4, nextUpdatedAt: base + 20_000 }) // 2 ticks * 2
  })

  it('no-ops on unopened idle, clock rewind and sub-tick', () => {
    const base = 1_000_000
    expect(
      settleIdleExperience({
        lastUpdatedAt: base,
        now: base + 25_000,
        highestClearedStage: 0,
      }),
    ).toEqual({ earnedExp: 0, nextUpdatedAt: base })
    expect(
      settleIdleExperience({
        lastUpdatedAt: base,
        now: base - 1,
        highestClearedStage: 1,
      }),
    ).toEqual({ earnedExp: 0, nextUpdatedAt: base })
    expect(
      settleIdleExperience({
        lastUpdatedAt: base,
        now: base + 9_999,
        highestClearedStage: 1,
      }),
    ).toEqual({ earnedExp: 0, nextUpdatedAt: base })
  })

  it('caps offline earnings at 8 hours and sets clock to now', () => {
    const base = 1_000_000
    const nineHours = 9 * 3600 * 1000
    const r = settleIdleExperience({
      lastUpdatedAt: base,
      now: base + nineHours,
      highestClearedStage: 1,
    })
    expect(r.earnedExp).toBe(2 * 2880) // 8h / 10s = 2880 ticks
    expect(r.nextUpdatedAt).toBe(base + nineHours)
  })

  it('no-ops and does not advance the clock for a non-finite highestClearedStage', () => {
    const base = 1_000_000
    expect(
      settleIdleExperience({
        lastUpdatedAt: base,
        now: base + 25_000,
        highestClearedStage: Number.NaN,
      }),
    ).toEqual({ earnedExp: 0, nextUpdatedAt: base })
    expect(
      settleIdleExperience({
        lastUpdatedAt: base,
        now: base + 25_000,
        highestClearedStage: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({ earnedExp: 0, nextUpdatedAt: base })
  })

  it.each([
    { label: 'tickSeconds', path: ['tickSeconds'] },
    { label: 'maxOfflineSeconds', path: ['maxOfflineSeconds'] },
    {
      label: 'ratePerTickByHighestStage.1',
      path: ['ratePerTickByHighestStage', '1'],
    },
  ])('rejects an unsafe integer for $label', ({ label, path }) => {
    expect(() =>
      parseIdleExperienceConfig(idleConfigWithUnsafeInteger(path)),
    ).toThrow(`Invalid idle-experience config: ${label}`)
  })

  it('rejects a safe rate whose maximum offline reward is unsafe', () => {
    const bad = structuredClone(idleExperienceConfig) as unknown as Record<
      string,
      unknown
    >
    ;(bad.ratePerTickByHighestStage as Record<string, unknown>)['1'] =
      Number.MAX_SAFE_INTEGER

    expect(() => parseIdleExperienceConfig(bad)).toThrow(
      'Invalid idle-experience config: ratePerTickByHighestStage.1',
    )
  })

  it('rejects an unknown top-level key', () => {
    const bad = structuredClone(idleExperienceConfig) as unknown as Record<
      string,
      unknown
    >
    bad.extra = 1
    expect(() => parseIdleExperienceConfig(bad)).toThrow(
      'Invalid idle-experience config: extra',
    )
  })
})
