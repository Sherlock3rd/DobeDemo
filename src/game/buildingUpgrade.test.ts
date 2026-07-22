import { describe, expect, it } from 'vitest'
import { upgradeBuildingLevel } from './buildingUpgrade'

describe('upgradeBuildingLevel', () => {
  it('upgrades level 1 to level 2', () => {
    expect(upgradeBuildingLevel(1)).toBe(2)
  })

  it('upgrades level 2 to level 3', () => {
    expect(upgradeBuildingLevel(2)).toBe(3)
  })

  it('keeps level 3 capped at level 3', () => {
    expect(upgradeBuildingLevel(3)).toBe(3)
  })
})
