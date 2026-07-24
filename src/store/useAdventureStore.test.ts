import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ADVENTURE_STORAGE_KEY,
  getClaimableIdleExp,
  useAdventureStore,
} from './useAdventureStore'

const NOW = 1_700_000_000_000

describe('useAdventureStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAdventureStore.getState().reset(NOW)
  })

  afterEach(() => {
    window.localStorage.clear()
    useAdventureStore.getState().reset(NOW)
  })

  it('starts at documented initial state', () => {
    const s = useAdventureStore.getState()
    expect(s.sharedExp).toBe(0)
    expect(s.highestClearedStage).toBe(0)
    expect(s.formation).toEqual([{ heroId: 'foreman', row: 'back', index: 1 }])
  })

  it('claim idle chest settles, adds to pool, keeps remainder', () => {
    useAdventureStore.setState({ highestClearedStage: 1, idleClock: NOW })
    const claimed = useAdventureStore.getState().claimIdleChest(NOW + 25_000)
    expect(claimed).toBe(4) // 2 ticks * rate 2
    expect(useAdventureStore.getState().sharedExp).toBe(4)
    expect(useAdventureStore.getState().idleClock).toBe(NOW + 20_000)
  })

  it('upgrade hero blocks by gang cap then by exp then applies atomically', () => {
    useAdventureStore.setState({
      sharedExp: 1_000,
      heroLevels: { foreman: 12, anvil: 1, skyline: 1 },
    })
    expect(useAdventureStore.getState().upgradeHero('foreman', 12)).toEqual({
      applied: false,
      reason: 'hero-level-capped-by-gang',
    })
    useAdventureStore.setState({
      sharedExp: 50,
      heroLevels: { foreman: 1, anvil: 1, skyline: 1 },
    })
    expect(useAdventureStore.getState().upgradeHero('foreman', 50)).toEqual({
      applied: false,
      reason: 'insufficient-shared-exp',
    })
    useAdventureStore.setState({ sharedExp: 100 })
    expect(useAdventureStore.getState().upgradeHero('foreman', 50)).toEqual({
      applied: true,
      reason: 'ready',
    })
    expect(useAdventureStore.getState().heroLevels.foreman).toBe(2)
    expect(useAdventureStore.getState().sharedExp).toBe(0)
  })

  it('rejects a locked hero upgrade atomically with a locked reason', () => {
    useAdventureStore.setState({
      sharedExp: 1_000,
      heroLevels: { foreman: 1, anvil: 1, skyline: 1 },
    })

    expect(useAdventureStore.getState().upgradeHero('anvil', 1)).toEqual({
      applied: false,
      reason: 'hero-locked',
    })
    expect(useAdventureStore.getState().heroLevels.anvil).toBe(1)
    expect(useAdventureStore.getState().sharedExp).toBe(1_000)
  })

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    0,
    1.5,
    51,
    Number.MAX_SAFE_INTEGER + 1,
  ])(
    'rejects invalid gang level %s without mutating upgrade state',
    (gangLevel) => {
      useAdventureStore.setState({
        sharedExp: 1_000,
        heroLevels: { foreman: 1, anvil: 1, skyline: 1 },
      })

      expect(
        useAdventureStore.getState().upgradeHero('foreman', gangLevel),
      ).toEqual({
        applied: false,
        reason: 'invalid-request',
      })
      expect(useAdventureStore.getState().heroLevels.foreman).toBe(1)
      expect(useAdventureStore.getState().sharedExp).toBe(1_000)
    },
  )

  it('records first clear in one transaction and initializes idle clock', () => {
    const r = useAdventureStore.getState().recordVictory(1, NOW + 5_000)
    expect(r).toEqual({ firstClear: true, rewardExp: 500 })
    expect(useAdventureStore.getState().highestClearedStage).toBe(1)
    expect(useAdventureStore.getState().sharedExp).toBe(500)
    expect(useAdventureStore.getState().idleClock).toBe(NOW + 5_000)
    const again = useAdventureStore.getState().recordVictory(1, NOW + 6_000)
    expect(again).toEqual({ firstClear: false, rewardExp: 0 })
    expect(useAdventureStore.getState().sharedExp).toBe(500)
  })

  it('rejects an out-of-order victory', () => {
    const r = useAdventureStore.getState().recordVictory(3, NOW)
    expect(r).toEqual({ firstClear: false, rewardExp: 0 })
    expect(useAdventureStore.getState().highestClearedStage).toBe(0)
  })

  it('validates formation before applying and reconciles with gang', () => {
    expect(
      useAdventureStore
        .getState()
        .setFormation([{ heroId: 'skyline', row: 'back', index: 0 }], 1),
    ).toBe(false)
    expect(
      useAdventureStore
        .getState()
        .setFormation([{ heroId: 'foreman', row: 'front', index: 0 }], 1),
    ).toBe(true)
    useAdventureStore.setState({
      heroLevels: { foreman: 40, anvil: 40, skyline: 40 },
    })
    useAdventureStore.getState().reconcileWithGang(12)
    expect(useAdventureStore.getState().heroLevels.foreman).toBe(12)
  })

  it('reports claimable idle exp without mutating state', () => {
    useAdventureStore.setState({ highestClearedStage: 1, idleClock: NOW })
    expect(getClaimableIdleExp(NOW, 1, NOW + 25_000)).toBe(4)
    expect(useAdventureStore.getState().sharedExp).toBe(0)
    expect(useAdventureStore.getState().idleClock).toBe(NOW)
  })

  it('persists only durable adventure fields', () => {
    useAdventureStore.setState({
      sharedExp: 42,
      highestClearedStage: 2,
      idleClock: NOW + 1,
    })
    const raw = window.localStorage.getItem(ADVENTURE_STORAGE_KEY)
    expect(raw).not.toBeNull()
    const persisted = JSON.parse(raw as string).state as Record<string, unknown>
    expect(Object.keys(persisted).sort()).toEqual(
      [
        'formation',
        'heroLevels',
        'highestClearedStage',
        'idleClock',
        'sharedExp',
      ].sort(),
    )
  })
})
