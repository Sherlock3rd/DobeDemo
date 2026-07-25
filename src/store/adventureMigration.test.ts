import { describe, expect, it } from 'vitest'
import {
  createInitialAdventureState,
  normalizeAdventureDurableState,
  reconcileAdventureWithGang,
} from './adventureMigration'

const NOW = 1_700_000_000_000

describe('adventureMigration', () => {
  it('null persisted keeps initial state', () => {
    const initial = createInitialAdventureState(NOW)
    expect(initial).toMatchObject({
      heroLevels: { foreman: 1, anvil: 1, skyline: 1 },
      sharedExp: 0,
      formation: [{ heroId: 'foreman', row: 'back', index: 1 }],
      highestClearedStage: 0,
      highestClearedRacingStage: 0,
      equipmentByHero: {
        foreman: { carId: 'rust-fox', gunId: 'rivet-smg' },
        anvil: { carId: null, gunId: null },
        skyline: { carId: null, gunId: null },
      },
      idleClock: NOW,
      spareParts: 0,
      partIdleClock: NOW,
      nextPartSerial: 1,
    })
    expect(Object.values(initial.gunLevels)).toEqual([0, 0, 0, 0, 0])
    expect(initial.carPartInventory).toEqual([])
    expect(
      Object.values(initial.carPartSlotsByCar).every((slots) =>
        Object.values(slots).every((partId) => partId === null),
      ),
    ).toBe(true)
  })

  it('clamps hero levels, drops unknown heroes, backfills missing', () => {
    const n = normalizeAdventureDurableState(
      {
        heroLevels: { foreman: 999, ghost: 5 },
        sharedExp: -3,
        highestClearedStage: 99,
        idleClock: 'x',
        formation: [],
      },
      NOW,
    )
    expect(n.heroLevels).toEqual({ foreman: 50, anvil: 1, skyline: 1 })
    expect(n.sharedExp).toBe(0)
    expect(n.highestClearedStage).toBe(20)
    expect(n.idleClock).toBe(NOW)
    expect(n.formation).toEqual([{ heroId: 'foreman', row: 'back', index: 1 }])
  })

  it('filters illegal formation slots, dedupes, caps to 5', () => {
    const n = normalizeAdventureDurableState(
      {
        heroLevels: {},
        sharedExp: 0,
        highestClearedStage: 0,
        idleClock: NOW,
        formation: [
          { heroId: 'foreman', row: 'front', index: 0 },
          { heroId: 'foreman', row: 'back', index: 2 },
          { heroId: 'anvil', row: 'front', index: 0 },
          { heroId: 'skyline', row: 'back', index: 9 },
          { heroId: 'ghost', row: 'back', index: 1 },
        ],
      },
      NOW,
    )
    expect(n.formation).toEqual([{ heroId: 'foreman', row: 'front', index: 0 }])
  })

  it('migrates a v1 save by preserving progress and adding starter gear', () => {
    const migrated = normalizeAdventureDurableState(
      {
        heroLevels: { foreman: 7, anvil: 2, skyline: 1 },
        sharedExp: 345,
        highestClearedStage: 4,
        idleClock: NOW - 1000,
        formation: [{ heroId: 'foreman', row: 'back', index: 1 }],
      },
      NOW,
    )
    expect(migrated.heroLevels.foreman).toBe(7)
    expect(migrated.sharedExp).toBe(345)
    expect(migrated.highestClearedStage).toBe(4)
    expect(migrated.highestClearedRacingStage).toBe(0)
    expect(migrated.equipmentByHero.foreman).toEqual({
      carId: 'rust-fox',
      gunId: 'rivet-smg',
    })
  })

  it('deduplicates malformed equipment assignments', () => {
    const normalized = normalizeAdventureDurableState(
      {
        equipmentByHero: {
          foreman: { carId: 'rust-fox', gunId: 'rivet-smg' },
          anvil: { carId: 'rust-fox', gunId: 'rivet-smg' },
          skyline: { carId: 'unknown', gunId: null },
        },
      },
      NOW,
    )
    expect(normalized.equipmentByHero.foreman).toEqual({
      carId: 'rust-fox',
      gunId: 'rivet-smg',
    })
    expect(normalized.equipmentByHero.anvil).toEqual({
      carId: null,
      gunId: null,
    })
  })

  it('normalizes gun levels, part inventory, installed slots, and serials', () => {
    const normalized = normalizeAdventureDurableState(
      {
        spareParts: 90,
        gunLevels: { 'rivet-smg': 99, 'double-barrel': 3.8 },
        carPartInventory: [
          {
            id: 'part-4',
            slot: 'engine',
            quality: 'elite',
            level: 99,
          },
          {
            id: 'part-4',
            slot: 'armor',
            quality: 'worn',
            level: 1,
          },
          {
            id: 'bad',
            slot: 'unknown',
            quality: 'worn',
            level: 1,
          },
        ],
        carPartSlotsByCar: {
          'rust-fox': { engine: 'part-4', armor: 'part-4' },
          'iron-fang': { engine: 'part-4' },
        },
        nextPartSerial: 1,
      },
      NOW,
    )
    expect(normalized.spareParts).toBe(90)
    expect(normalized.gunLevels['rivet-smg']).toBe(10)
    expect(normalized.gunLevels['double-barrel']).toBe(3)
    expect(normalized.carPartInventory).toEqual([
      { id: 'part-4', slot: 'engine', quality: 'elite', level: 10 },
    ])
    expect(normalized.carPartSlotsByCar['rust-fox'].engine).toBe('part-4')
    expect(normalized.carPartSlotsByCar['iron-fang'].engine).toBeNull()
    expect(normalized.nextPartSerial).toBe(5)
  })

  it('reconciles hero levels and formation against gang level', () => {
    const state = {
      ...createInitialAdventureState(NOW),
      heroLevels: { foreman: 40, anvil: 30, skyline: 20 },
      sharedExp: 0,
      highestClearedStage: 0,
      highestClearedRacingStage: 0,
      equipmentByHero: {
        foreman: { carId: 'rust-fox' as const, gunId: 'rivet-smg' as const },
        anvil: { carId: null, gunId: null },
        skyline: { carId: null, gunId: null },
      },
      idleClock: NOW,
      formation: [
        { heroId: 'anvil' as const, row: 'front' as const, index: 0 },
      ],
    }
    const reconciled = reconcileAdventureWithGang(state, 12)
    expect(reconciled.heroLevels.foreman).toBe(12)
    expect(reconciled.heroLevels.skyline).toBe(12)
    expect(reconciled.formation).toEqual([
      { heroId: 'anvil', row: 'front', index: 0 },
    ])
  })

  it('drops locked heroes from formation and falls back when empty', () => {
    const state = {
      ...createInitialAdventureState(NOW),
      heroLevels: { foreman: 1, anvil: 1, skyline: 1 },
      sharedExp: 0,
      highestClearedStage: 0,
      highestClearedRacingStage: 0,
      equipmentByHero: {
        foreman: { carId: 'rust-fox' as const, gunId: 'rivet-smg' as const },
        anvil: { carId: null, gunId: null },
        skyline: { carId: null, gunId: null },
      },
      idleClock: NOW,
      formation: [
        { heroId: 'skyline' as const, row: 'back' as const, index: 0 },
      ],
    }
    const reconciled = reconcileAdventureWithGang(state, 1)
    expect(reconciled.formation).toEqual([
      { heroId: 'foreman', row: 'back', index: 1 },
    ])
  })
})
