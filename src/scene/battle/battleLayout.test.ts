import { describe, expect, it } from 'vitest'
import {
  BATTLE_FORMATION_ROTATION_Y,
  rotateBattlePosition,
} from './battleLayout'

describe('battle layout', () => {
  it('places the ally side at lower-left and the enemy side at upper-right', () => {
    const allyCenter = rotateBattlePosition([0, 0, 3])
    const enemyCenter = rotateBattlePosition([0, 0, -3])

    expect(BATTLE_FORMATION_ROTATION_Y).toBeLessThan(0)
    expect(allyCenter[0]).toBeLessThan(0)
    expect(allyCenter[2]).toBeGreaterThan(0)
    expect(enemyCenter[0]).toBeGreaterThan(0)
    expect(enemyCenter[2]).toBeLessThan(0)
  })
})
