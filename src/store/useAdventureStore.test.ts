import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ADVENTURE_STORAGE_KEY,
  getClaimableIdleExp,
  useAdventureStore,
} from './useAdventureStore'
import { getPartDropIntervalMs } from '../game/equipmentProgression'

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
    expect(s.spareParts).toBe(0)
    expect(s.carPartInventory).toEqual([])
    expect(Object.values(s.gunLevels)).toEqual([0, 0, 0, 0, 0])
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

  it('moves a unique car and gun atomically between heroes', () => {
    const store = useAdventureStore.getState()
    expect(store.equipCar('anvil', 'rust-fox', 40)).toBe(true)
    expect(store.equipGun('anvil', 'rivet-smg', 40)).toBe(true)
    const equipment = useAdventureStore.getState().equipmentByHero
    expect(equipment.foreman).toEqual({ carId: null, gunId: null })
    expect(equipment.anvil).toEqual({
      carId: 'rust-fox',
      gunId: 'rivet-smg',
    })
  })

  it('settles recycling-yard idle drops without granting them before a tick', () => {
    expect(
      useAdventureStore.getState().settleCarPartIdle(NOW + 1000, 1),
    ).toEqual({
      received: 0,
      autoRecycled: 0,
    })
    const interval = getPartDropIntervalMs(1)
    expect(
      useAdventureStore.getState().settleCarPartIdle(NOW + interval, 1),
    ).toEqual({ received: 1, autoRecycled: 0 })
    expect(useAdventureStore.getState().carPartInventory).toEqual([
      { id: 'part-1', slot: 'tires', quality: 'worn', level: 1 },
    ])
  })

  it('installs, upgrades, unequips, and recycles a car part atomically', () => {
    const interval = getPartDropIntervalMs(1)
    useAdventureStore.getState().settleCarPartIdle(NOW + interval, 1)
    useAdventureStore.setState({ spareParts: 100 })

    expect(
      useAdventureStore.getState().equipCarPart('rust-fox', 'part-1', 1),
    ).toMatchObject({ applied: true, reason: 'ready' })
    expect(
      useAdventureStore.getState().carPartSlotsByCar['rust-fox'].tires,
    ).toBe('part-1')
    expect(useAdventureStore.getState().recycleCarPart('part-1')).toMatchObject(
      { applied: false, reason: 'part-installed' },
    )
    expect(useAdventureStore.getState().upgradeCarPart('part-1')).toMatchObject(
      { applied: true, cost: 12 },
    )
    expect(useAdventureStore.getState().carPartInventory[0].level).toBe(2)
    expect(useAdventureStore.getState().spareParts).toBe(88)
    expect(
      useAdventureStore.getState().unequipCarPart('rust-fox', 'tires', 1),
    ).toMatchObject({ applied: true })
    expect(useAdventureStore.getState().recycleCarPart('part-1')).toMatchObject(
      { applied: true },
    )
    expect(useAdventureStore.getState().carPartInventory).toEqual([])
    expect(useAdventureStore.getState().spareParts).toBeGreaterThan(88)
  })

  it('upgrades unlocked guns with spare parts and blocks locked guns', () => {
    useAdventureStore.setState({ spareParts: 1_000 })
    expect(
      useAdventureStore.getState().upgradeGun('rivet-smg', 1),
    ).toMatchObject({ applied: true, reason: 'ready' })
    expect(useAdventureStore.getState().gunLevels['rivet-smg']).toBe(1)
    expect(useAdventureStore.getState().spareParts).toBeLessThan(1_000)
    expect(
      useAdventureStore.getState().upgradeGun('president-cannon', 1),
    ).toMatchObject({ applied: false, reason: 'equipment-locked' })
    expect(useAdventureStore.getState().gunLevels['president-cannon']).toBe(0)
  })

  it('rejects invalid gang levels for all new equipment actions', () => {
    const before = structuredClone({
      inventory: useAdventureStore.getState().carPartInventory,
      slots: useAdventureStore.getState().carPartSlotsByCar,
      gunLevels: useAdventureStore.getState().gunLevels,
    })
    expect(
      useAdventureStore
        .getState()
        .equipCarPart('rust-fox', 'part-1', Number.NaN),
    ).toMatchObject({ applied: false, reason: 'invalid-request' })
    expect(
      useAdventureStore
        .getState()
        .unequipCarPart('rust-fox', 'engine', Number.POSITIVE_INFINITY),
    ).toMatchObject({ applied: false, reason: 'invalid-request' })
    expect(
      useAdventureStore.getState().upgradeGun('rivet-smg', 0),
    ).toMatchObject({ applied: false, reason: 'invalid-request' })
    expect({
      inventory: useAdventureStore.getState().carPartInventory,
      slots: useAdventureStore.getState().carPartSlotsByCar,
      gunLevels: useAdventureStore.getState().gunLevels,
    }).toEqual(before)
  })

  it('rejects locked gear and locked hero assignments without mutation', () => {
    const before = structuredClone(useAdventureStore.getState().equipmentByHero)
    expect(
      useAdventureStore.getState().equipCar('foreman', 'black-throne', 1),
    ).toBe(false)
    expect(useAdventureStore.getState().equipGun('anvil', 'rivet-smg', 1)).toBe(
      false,
    )
    expect(useAdventureStore.getState().equipmentByHero).toEqual(before)
  })

  it('records racing first-clears only in strict order and grants exp once', () => {
    expect(useAdventureStore.getState().recordRacingVictory(2)).toEqual({
      firstClear: false,
      rewardExp: 0,
    })
    expect(useAdventureStore.getState().recordRacingVictory(1)).toEqual({
      firstClear: true,
      rewardExp: 160,
    })
    expect(useAdventureStore.getState().highestClearedRacingStage).toBe(1)
    expect(useAdventureStore.getState().sharedExp).toBe(160)
    expect(useAdventureStore.getState().recordRacingVictory(1)).toEqual({
      firstClear: false,
      rewardExp: 0,
    })
    expect(useAdventureStore.getState().sharedExp).toBe(160)
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
        'equipmentByHero',
        'formation',
        'heroLevels',
        'highestClearedRacingStage',
        'highestClearedStage',
        'idleClock',
        'sharedExp',
        'spareParts',
        'gunLevels',
        'carPartInventory',
        'carPartSlotsByCar',
        'partIdleClock',
        'nextPartSerial',
      ].sort(),
    )
  })
})
