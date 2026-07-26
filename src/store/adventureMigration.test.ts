import { describe, expect, it } from 'vitest'
import {
  createInitialAdventureState,
  normalizeAdventureDurableState,
  normalizeLegacyPartQuality,
  reconcileAdventureWithGang,
} from './adventureMigration'

const NOW = 1_700_000_000_000

describe('adventureMigration', () => {
  it('normalizes legacy and current part quality IDs through the documented interface', () => {
    expect(
      ['worn', 'tuned', 'elite', 'prototype'].map(normalizeLegacyPartQuality),
    ).toEqual(['common', 'rare', 'epic', 'legendary'])
    expect(normalizeLegacyPartQuality('uncommon')).toBe('uncommon')
    expect(normalizeLegacyPartQuality('unknown')).toBeNull()
  })

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
        heroLevels: { foreman: 50, anvil: 1, skyline: 1 },
        spareParts: 90,
        gunLevels: { 'rivet-smg': 99, 'double-barrel': 3.8 },
        carPartInventory: [
          {
            id: 'part-4',
            slot: 'engine',
            quality: 'epic',
            level: 99,
          },
          {
            id: 'part-4',
            slot: 'armor',
            quality: 'common',
            level: 1,
          },
          {
            id: 'bad',
            slot: 'unknown',
            quality: 'common',
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
    expect(normalized.gunLevels['rivet-smg']).toBe(50)
    expect(normalized.gunLevels['double-barrel']).toBe(3)
    expect(normalized.carPartInventory).toEqual([
      { id: 'part-4', slot: 'engine', quality: 'epic', level: 50 },
    ])
    expect(normalized.carPartSlotsByCar['rust-fox'].engine).toBe('part-4')
    expect(normalized.carPartSlotsByCar['iron-fang'].engine).toBeNull()
    expect(normalized.nextPartSerial).toBe(5)
  })

  it('migrates legacy armor and turbo parts into bumper and suspension slots', () => {
    const normalized = normalizeAdventureDurableState(
      {
        heroLevels: { foreman: 3, anvil: 1, skyline: 1 },
        carPartInventory: [
          { id: 'legacy-armor', slot: 'armor', quality: 'common', level: 2 },
          { id: 'legacy-turbo', slot: 'turbo', quality: 'epic', level: 3 },
        ],
        carPartSlotsByCar: {
          'rust-fox': {
            armor: 'legacy-armor',
            turbo: 'legacy-turbo',
          },
        },
      },
      NOW,
    )

    expect(normalized.carPartInventory).toEqual([
      { id: 'legacy-armor', slot: 'bumper', quality: 'common', level: 2 },
      { id: 'legacy-turbo', slot: 'suspension', quality: 'epic', level: 3 },
    ])
    expect(normalized.carPartSlotsByCar['rust-fox'].bumper).toBe('legacy-armor')
    expect(normalized.carPartSlotsByCar['rust-fox'].suspension).toBe(
      'legacy-turbo',
    )
  })

  it('migrates four legacy quality ids before validation and preserves installs', () => {
    const normalized = normalizeAdventureDurableState(
      {
        heroLevels: { foreman: 10, anvil: 1, skyline: 1 },
        carPartInventory: [
          { id: 'old-worn', slot: 'tires', quality: 'worn', level: 2 },
          { id: 'old-tuned', slot: 'engine', quality: 'tuned', level: 3 },
          { id: 'old-elite', slot: 'bumper', quality: 'elite', level: 4 },
          {
            id: 'old-prototype',
            slot: 'suspension',
            quality: 'prototype',
            level: 5,
          },
          { id: 'unknown', slot: 'engine', quality: 'mythic', level: 6 },
        ],
        carPartSlotsByCar: {
          'rust-fox': {
            tires: 'old-worn',
            engine: 'old-tuned',
            bumper: 'old-elite',
            suspension: 'old-prototype',
          },
        },
      },
      NOW,
    )

    expect(normalized.carPartInventory).toEqual([
      { id: 'old-worn', slot: 'tires', quality: 'common', level: 2 },
      { id: 'old-tuned', slot: 'engine', quality: 'rare', level: 3 },
      { id: 'old-elite', slot: 'bumper', quality: 'epic', level: 4 },
      {
        id: 'old-prototype',
        slot: 'suspension',
        quality: 'legendary',
        level: 5,
      },
    ])
    expect(normalized.carPartSlotsByCar['rust-fox']).toEqual({
      tires: 'old-worn',
      engine: 'old-tuned',
      bumper: 'old-elite',
      suspension: 'old-prototype',
    })
  })

  it('clamps over-level equipment to the highest hero and refunds upgrades', () => {
    const normalized = normalizeAdventureDurableState(
      {
        heroLevels: { foreman: 2, anvil: 1, skyline: 1 },
        spareParts: 10,
        gunLevels: { 'rivet-smg': 4 },
        carPartInventory: [
          { id: 'over-cap', slot: 'engine', quality: 'common', level: 4 },
        ],
      },
      NOW,
    )

    expect(normalized.gunLevels['rivet-smg']).toBe(2)
    expect(normalized.carPartInventory[0].level).toBe(2)
    expect(normalized.spareParts).toBeGreaterThan(10)
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
