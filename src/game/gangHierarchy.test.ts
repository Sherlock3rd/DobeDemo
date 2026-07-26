import { describe, expect, it } from 'vitest'
import { GANG_ROLES } from './gangProgression'
import {
  GANG_CORE_SEATS,
  GANG_NAME,
  PLAYER_GANG_LEADER,
  getGangCoreSeat,
  getGangSeatState,
  getManagedCoreSeatCount,
  roleForCoreSeat,
} from './gangHierarchy'

describe('gangHierarchy', () => {
  it('defines the Peaky Blinders name and one unique holder for every core role', () => {
    expect(GANG_NAME).toBe('剃刀党')
    expect(PLAYER_GANG_LEADER).toBe('Thomas Shelby')
    expect(GANG_CORE_SEATS.map((seat) => seat.threshold)).toEqual(
      GANG_ROLES.map((role) => role.threshold),
    )
    expect(new Set(GANG_CORE_SEATS.map((seat) => seat.holder)).size).toBe(
      GANG_CORE_SEATS.length,
    )
    expect(GANG_CORE_SEATS.every((seat) => seat.support.length > 0)).toBe(true)
    expect(GANG_CORE_SEATS.map(roleForCoreSeat)).toEqual(GANG_ROLES)
  })

  it('places higher roles above the player and completed roles under command', () => {
    expect(getGangSeatState(1, 16)).toBe('subordinate')
    expect(getGangSeatState(8, 16)).toBe('subordinate')
    expect(getGangSeatState(16, 16)).toBe('current')
    expect(getGangSeatState(24, 16)).toBe('superior')
    expect(getManagedCoreSeatCount(16)).toBe(3)
  })

  it('resolves seats and rejects non-core thresholds', () => {
    expect(getGangCoreSeat(32).holder).toBe('Charlie Strong')
    expect(() => getGangCoreSeat(31)).toThrow(/Unknown gang core seat/)
  })
})
