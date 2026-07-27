import { describe, expect, it } from 'vitest'
import {
  ROLE_HANDOVER_LEVELS,
  getRoleHandover,
  getRoleHandoverAccessibleName,
} from './roleHandover'

describe('role handovers', () => {
  it('assigns all six key roles to the three requested handover modes', () => {
    expect(
      ROLE_HANDOVER_LEVELS.map((level) => getRoleHandover(level)?.mode),
    ).toEqual(['dialogue', 'battle', 'dialogue', 'race', 'battle', 'dialogue'])
  })

  it('uses campaign stages only for battle and a racing stage only for race', () => {
    for (const level of ROLE_HANDOVER_LEVELS) {
      const handover = getRoleHandover(level)
      expect(handover).not.toBeNull()
      expect(handover?.challengeStage === null).toBe(
        handover?.mode === 'dialogue',
      )
    }
    expect(getRoleHandover(16)?.challengeStage).toBe(3)
    expect(getRoleHandover(32)?.challengeStage).toBe(3)
    expect(getRoleHandover(40)?.challengeStage).toBe(8)
  })

  it('rejects ordinary gang levels and names a valid handover accessibly', () => {
    expect(getRoleHandover(7)).toBeNull()
    expect(getRoleHandoverAccessibleName(32)).toBe(
      '路线队长职位交接：Charlie Strong',
    )
  })
})
