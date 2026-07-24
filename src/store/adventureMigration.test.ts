import { describe, expect, it } from 'vitest'
import {
  createInitialAdventureState,
  normalizeAdventureDurableState,
  reconcileAdventureWithGang,
} from './adventureMigration'

const NOW = 1_700_000_000_000

describe('adventureMigration', () => {
  it('null persisted keeps initial state', () => {
    expect(createInitialAdventureState(NOW)).toEqual({
      heroLevels: { foreman: 1, anvil: 1, skyline: 1 },
      sharedExp: 0,
      formation: [{ heroId: 'foreman', row: 'back', index: 1 }],
      highestClearedStage: 0,
      idleClock: NOW,
    })
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

  it('reconciles hero levels and formation against gang level', () => {
    const state = {
      heroLevels: { foreman: 40, anvil: 30, skyline: 20 },
      sharedExp: 0,
      highestClearedStage: 0,
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
      heroLevels: { foreman: 1, anvil: 1, skyline: 1 },
      sharedExp: 0,
      highestClearedStage: 0,
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
