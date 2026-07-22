import { describe, expect, it } from 'vitest'
import {
  BUILDING_UNLOCKS,
  getTotalReputationForLevel,
} from '../../game/gangProgression'
import { getBuildingRenderMode } from './buildingAccess'

describe('getBuildingRenderMode', () => {
  it('at zero reputation, only repair-shop is unlocked and the rest are locked', () => {
    expect(getBuildingRenderMode('repair-shop', 0)).toBe('unlocked')

    for (const unlock of BUILDING_UNLOCKS) {
      if (unlock.buildingId === 'repair-shop') {
        continue
      }

      expect(getBuildingRenderMode(unlock.buildingId, 0)).toBe('locked')
    }
  })

  it.each(BUILDING_UNLOCKS)(
    '$buildingId is locked just below its required level and unlocked at it',
    ({ buildingId, requiredLevel }) => {
      const thresholdReputation = getTotalReputationForLevel(requiredLevel)

      if (thresholdReputation > 0) {
        expect(getBuildingRenderMode(buildingId, thresholdReputation - 1)).toBe(
          'locked',
        )
      }

      expect(getBuildingRenderMode(buildingId, thresholdReputation)).toBe(
        'unlocked',
      )
    },
  )

  it('treats excess reputation beyond the max level as fully unlocked for every building', () => {
    const excessiveReputation = 10_000

    for (const unlock of BUILDING_UNLOCKS) {
      expect(
        getBuildingRenderMode(unlock.buildingId, excessiveReputation),
      ).toBe('unlocked')
    }
  })

  it('treats an unknown building id as locked regardless of reputation', () => {
    expect(getBuildingRenderMode('unknown-building', 0)).toBe('locked')
    expect(getBuildingRenderMode('unknown-building', 10_000)).toBe('locked')
  })
})
