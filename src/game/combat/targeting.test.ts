import { describe, expect, it } from 'vitest'
import { selectTarget, type CombatUnitState } from './targeting'

const u = (
  globalIndex: number,
  row: 'front' | 'back',
  alive: boolean,
): CombatUnitState => ({
  globalIndex,
  row,
  side: 'enemy',
  hp: alive ? 10 : 0,
  alive,
})

describe('targeting', () => {
  it('prefers living front units by ascending globalIndex', () => {
    const defenders = [
      u(0, 'front', true),
      u(1, 'front', true),
      u(2, 'back', true),
    ]
    expect(selectTarget(defenders)?.globalIndex).toBe(0)
  })

  it('falls back to back only when all front are dead', () => {
    const defenders = [
      u(0, 'front', false),
      u(1, 'front', false),
      u(2, 'back', true),
      u(3, 'back', true),
    ]
    expect(selectTarget(defenders)?.globalIndex).toBe(2)
  })

  it('returns null when nothing is alive', () => {
    expect(selectTarget([u(0, 'front', false)])).toBeNull()
  })
})
