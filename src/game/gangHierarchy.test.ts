import { describe, expect, it } from 'vitest'
import { GANG_ROLES } from './gangProgression'
import { heroesConfig } from '../config/heroesConfig'
import {
  GANG_CORE_SEATS,
  GANG_HERO_PROFILES,
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
    expect(GANG_CORE_SEATS.map((seat) => seat.support.length)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ])
    expect(GANG_CORE_SEATS.map(roleForCoreSeat)).toEqual(GANG_ROLES)
  })

  it('maps every released hero to the matching gang portrait, name and core seat', () => {
    expect(GANG_HERO_PROFILES.foreman).toMatchObject({
      seatThreshold: 1,
      portraitIndex: 0,
    })
    expect(heroesConfig.heroes.foreman.name).toBe(PLAYER_GANG_LEADER)

    for (const heroId of ['anvil', 'skyline'] as const) {
      const profile = GANG_HERO_PROFILES[heroId]
      const seat = getGangCoreSeat(profile.seatThreshold)
      expect(profile.portraitIndex).toBe(seat.portraitIndex)
      expect(heroesConfig.heroes[heroId].name).toBe(seat.holder)
    }
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
