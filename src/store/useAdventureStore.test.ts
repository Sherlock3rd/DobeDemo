import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ADVENTURE_STORAGE_KEY,
  getClaimableIdleExp,
  useAdventureStore,
} from './useAdventureStore'
import {
  CAR_PART_INVENTORY_LIMIT,
  PART_IDLE_CAP_MS,
  getPartDropIntervalMs,
} from '../game/equipmentProgression'
import type { CarPartInstance, CarPartQuality } from '../game/equipmentTypes'
import { useCityStore } from './useCityStore'

const NOW = 1_700_000_000_000

type PartSalvageClaimResult = {
  applied: boolean
  receivedParts: CarPartInstance[]
  autoRecycled: number
  sparePartsGained: number
  batchCount: number
}

function getClaimPartSalvage():
  | ((
      now: number,
      recyclingYardLevel: number,
      gangLevel: number,
      random?: () => number,
    ) => PartSalvageClaimResult)
  | undefined {
  return (
    useAdventureStore.getState() as unknown as {
      claimPartSalvage?: (
        now: number,
        recyclingYardLevel: number,
        gangLevel: number,
        random?: () => number,
      ) => PartSalvageClaimResult
    }
  ).claimPartSalvage
}

describe('useAdventureStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAdventureStore.getState().reset(NOW)
    useCityStore.getState().reset(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
    const r = useAdventureStore
      .getState()
      .recordVictory(1, NOW + 5_000, () => 0.99)
    expect(r).toEqual({
      firstClear: true,
      rewardExp: 500,
      rewardMoney: 100,
      rewardPart: null,
      rewardSpareParts: 0,
    })
    expect(useAdventureStore.getState().highestClearedStage).toBe(1)
    expect(useAdventureStore.getState().sharedExp).toBe(500)
    expect(useAdventureStore.getState().idleClock).toBe(NOW + 5_000)
    expect(useCityStore.getState().resources.money).toBe(10_100)
    const again = useAdventureStore
      .getState()
      .recordVictory(1, NOW + 6_000, () => 0)
    expect(again).toEqual({
      firstClear: false,
      rewardExp: 0,
      rewardMoney: 0,
      rewardPart: null,
      rewardSpareParts: 0,
    })
    expect(useAdventureStore.getState().sharedExp).toBe(500)
  })

  it('uses injected randomness to grant a first-clear car part', () => {
    const reward = useAdventureStore
      .getState()
      .recordVictory(1, NOW + 5_000, () => 0)
    expect(reward.rewardPart).toEqual({
      id: 'part-1',
      slot: 'tires',
      quality: 'common',
      level: 1,
    })
    expect(useAdventureStore.getState().carPartInventory).toEqual([
      reward.rewardPart,
    ])
    expect(useAdventureStore.getState().nextPartSerial).toBe(2)
  })

  it('recovers cross-store money rewards idempotently from cleared progress', () => {
    useAdventureStore.setState({
      highestClearedStage: 2,
      highestClearedRacingStage: 1,
    })
    useAdventureStore.getState().syncCityRewardMoney()
    useAdventureStore.getState().syncCityRewardMoney()

    expect(useCityStore.getState().resources.money).toBe(10_450)
    expect(useCityStore.getState().appliedStageRewardIds).toEqual([
      'campaign:1',
      'campaign:2',
      'racing:1',
    ])
  })

  it('rejects an out-of-order victory', () => {
    const r = useAdventureStore.getState().recordVictory(3, NOW)
    expect(r).toMatchObject({ firstClear: false, rewardExp: 0, rewardMoney: 0 })
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

  it('does not expose the legacy automatic salvage settlement entry point', () => {
    expect('settleCarPartIdle' in useAdventureStore.getState()).toBe(false)
  })

  it('does not claim or mutate state before one salvage batch completes', () => {
    const claimPartSalvage = getClaimPartSalvage()
    expect(claimPartSalvage).toBeTypeOf('function')
    if (!claimPartSalvage) return
    const random = vi.fn(() => 0)
    const before = useAdventureStore.getState()

    expect(
      claimPartSalvage(NOW + getPartDropIntervalMs(1) - 1, 1, 8, random),
    ).toEqual({
      applied: false,
      receivedParts: [],
      autoRecycled: 0,
      sparePartsGained: 0,
      batchCount: 0,
    })
    expect(useAdventureStore.getState()).toBe(before)
    expect(random).not.toHaveBeenCalled()
  })

  it.each([
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1],
    [NOW - 1, 1],
    [NOW + getPartDropIntervalMs(1), 0],
    [NOW + getPartDropIntervalMs(1), 11],
    [NOW + getPartDropIntervalMs(1), 1.5],
    [NOW + getPartDropIntervalMs(1), Number.NaN],
  ])(
    'rejects invalid salvage claim time %s or yard level %s atomically',
    (now, level) => {
      const claimPartSalvage = getClaimPartSalvage()
      expect(claimPartSalvage).toBeTypeOf('function')
      if (!claimPartSalvage) return
      const before = useAdventureStore.getState()

      expect(claimPartSalvage(now, level, 8, () => 0)).toEqual({
        applied: false,
        receivedParts: [],
        autoRecycled: 0,
        sparePartsGained: 0,
        batchCount: 0,
      })
      expect(useAdventureStore.getState()).toBe(before)
    },
  )

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, 1.5, 51])(
    'rejects invalid salvage claim gang level %s atomically',
    (gangLevel) => {
      const claimPartSalvage = getClaimPartSalvage()
      expect(claimPartSalvage).toBeTypeOf('function')
      if (!claimPartSalvage) return
      const before = useAdventureStore.getState()
      const random = vi.fn(() => 0)
      let result: PartSalvageClaimResult | undefined

      expect(() => {
        result = claimPartSalvage(
          NOW + getPartDropIntervalMs(1),
          1,
          gangLevel,
          random,
        )
      }).not.toThrow()
      expect(result).toEqual({
        applied: false,
        receivedParts: [],
        autoRecycled: 0,
        sparePartsGained: 0,
        batchCount: 0,
      })
      expect(useAdventureStore.getState()).toBe(before)
      expect(random).not.toHaveBeenCalled()
    },
  )

  it('rejects salvage claims while the recycling yard is locked', () => {
    const claimPartSalvage = getClaimPartSalvage()
    expect(claimPartSalvage).toBeTypeOf('function')
    if (!claimPartSalvage) return
    const before = useAdventureStore.getState()
    const random = vi.fn(() => 0)
    let result: PartSalvageClaimResult | undefined

    expect(() => {
      result = claimPartSalvage(NOW + getPartDropIntervalMs(1), 1, 7, random)
    }).not.toThrow()
    expect(result).toEqual({
      applied: false,
      receivedParts: [],
      autoRecycled: 0,
      sparePartsGained: 0,
      batchCount: 0,
    })
    expect(useAdventureStore.getState()).toBe(before)
    expect(random).not.toHaveBeenCalled()
  })

  it('claims injected salvage drops and preserves partial-batch time', () => {
    const claimPartSalvage = getClaimPartSalvage()
    expect(claimPartSalvage).toBeTypeOf('function')
    if (!claimPartSalvage) return
    const interval = getPartDropIntervalMs(10)
    const rolls = [0.99, 0, 0.08, 0.2, 0.99]

    const result = claimPartSalvage(
      NOW + interval + 5_000,
      10,
      8,
      () => rolls.shift() ?? 0,
    )

    expect(result).toEqual({
      applied: true,
      receivedParts: [
        { id: 'part-1', slot: 'tires', quality: 'common', level: 1 },
        { id: 'part-2', slot: 'engine', quality: 'uncommon', level: 1 },
        { id: 'part-3', slot: 'bumper', quality: 'rare', level: 1 },
        {
          id: 'part-4',
          slot: 'suspension',
          quality: 'legendary',
          level: 1,
        },
      ],
      autoRecycled: 0,
      sparePartsGained: 0,
      batchCount: 1,
    })
    expect(useAdventureStore.getState().carPartInventory).toEqual(
      result.receivedParts,
    )
    expect(useAdventureStore.getState().nextPartSerial).toBe(5)
    expect(useAdventureStore.getState().partIdleClock).toBe(NOW + interval)
  })

  it('moves the salvage clock to now after claiming the eight-hour cap', () => {
    const claimPartSalvage = getClaimPartSalvage()
    expect(claimPartSalvage).toBeTypeOf('function')
    if (!claimPartSalvage) return
    const now = NOW + PART_IDLE_CAP_MS + 1_234

    const result = claimPartSalvage(now, 1, 8, () => 0)

    expect(result.applied).toBe(true)
    expect(result.batchCount).toBe(960)
    expect(result.receivedParts).toHaveLength(CAR_PART_INVENTORY_LIMIT)
    expect(result.autoRecycled).toBe(920)
    expect(result.sparePartsGained).toBe(7_360)
    expect(useAdventureStore.getState().partIdleClock).toBe(now)
    expect(useAdventureStore.getState().nextPartSerial).toBe(961)
  })

  it('auto-recycles full-inventory salvage for its quality base value', () => {
    const claimPartSalvage = getClaimPartSalvage()
    expect(claimPartSalvage).toBeTypeOf('function')
    if (!claimPartSalvage) return
    useAdventureStore.setState({
      carPartInventory: Array.from(
        { length: CAR_PART_INVENTORY_LIMIT },
        (_, index) => ({
          id: `stored-${index}`,
          slot: 'engine' as const,
          quality: 'common' as const,
          level: 1,
        }),
      ),
    })

    expect(
      claimPartSalvage(NOW + getPartDropIntervalMs(1), 1, 8, () => 0),
    ).toEqual({
      applied: true,
      receivedParts: [],
      autoRecycled: 1,
      sparePartsGained: 8,
      batchCount: 1,
    })
    expect(useAdventureStore.getState().carPartInventory).toHaveLength(
      CAR_PART_INVENTORY_LIMIT,
    )
    expect(useAdventureStore.getState().spareParts).toBe(8)
    expect(useAdventureStore.getState().nextPartSerial).toBe(2)
  })

  it('installs, upgrades, unequips, and recycles a car part atomically', () => {
    const interval = getPartDropIntervalMs(1)
    useAdventureStore.getState().claimPartSalvage(NOW + interval, 1, 8, () => 0)
    useAdventureStore.setState((state) => ({
      spareParts: 100,
      heroLevels: { ...state.heroLevels, foreman: 2 },
    }))

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

  it('caps gun and car-part upgrades at the highest unlocked hero level', () => {
    useAdventureStore.setState((state) => ({
      heroLevels: { foreman: 5, anvil: 1, skyline: 1 },
      spareParts: 10_000,
      gunLevels: { ...state.gunLevels, 'rivet-smg': 5 },
      carPartInventory: [
        {
          id: 'dynamic-cap-part',
          slot: 'engine',
          quality: 'legendary',
          level: 5,
        },
      ],
    }))

    expect(
      useAdventureStore.getState().upgradeGun('rivet-smg', 50),
    ).toMatchObject({ applied: false, reason: 'max-level' })
    expect(
      useAdventureStore.getState().upgradeCarPart('dynamic-cap-part'),
    ).toMatchObject({ applied: false, reason: 'max-level' })
    expect(useAdventureStore.getState().gunLevels['rivet-smg']).toBe(5)
    expect(useAdventureStore.getState().carPartInventory[0].level).toBe(5)
  })

  it('recycles one quality in bulk while excluding every installed part', () => {
    useAdventureStore.setState((state) => ({
      carPartInventory: [
        { id: 'installed-common', slot: 'tires', quality: 'common', level: 1 },
        { id: 'idle-common-1', slot: 'engine', quality: 'common', level: 1 },
        { id: 'idle-common-2', slot: 'bumper', quality: 'common', level: 2 },
        { id: 'idle-epic', slot: 'suspension', quality: 'epic', level: 1 },
      ],
      carPartSlotsByCar: {
        ...state.carPartSlotsByCar,
        'rust-fox': {
          ...state.carPartSlotsByCar['rust-fox'],
          tires: 'installed-common',
        },
      },
    }))
    const store =
      useAdventureStore.getState() as typeof useAdventureStore extends {
        getState: () => infer State
      }
        ? State & {
            recycleCarPartsByQuality?: (quality: CarPartQuality) => {
              applied: boolean
              recycledCount: number
              gained: number
            }
          }
        : never

    expect(
      store.recycleCarPartsByQuality,
      'AdventureStore must expose quality bulk recycling',
    ).toBeTypeOf('function')
    if (!store.recycleCarPartsByQuality) return

    const result = store.recycleCarPartsByQuality('common')
    expect(result).toMatchObject({
      applied: true,
      recycledCount: 2,
      gained: expect.any(Number),
    })
    expect(result.gained).toBeGreaterThan(0)
    expect(
      useAdventureStore
        .getState()
        .carPartInventory.map((part) => part.id)
        .sort(),
    ).toEqual(['idle-epic', 'installed-common'])
    expect(
      useAdventureStore.getState().carPartSlotsByCar['rust-fox'].tires,
    ).toBe('installed-common')
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
    expect(useAdventureStore.getState().recordRacingVictory(2)).toMatchObject({
      firstClear: false,
      rewardExp: 0,
    })
    expect(
      useAdventureStore.getState().recordRacingVictory(1, () => 0.99),
    ).toMatchObject({ firstClear: true, rewardExp: 160, rewardMoney: 150 })
    expect(useAdventureStore.getState().highestClearedRacingStage).toBe(1)
    expect(useAdventureStore.getState().sharedExp).toBe(160)
    expect(useAdventureStore.getState().recordRacingVictory(1)).toMatchObject({
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
    const parsed = JSON.parse(raw as string) as {
      state: Record<string, unknown>
      version: number
    }
    expect(parsed.version).toBe(6)
    const persisted = parsed.state
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
