import { beforeEach, describe, expect, it } from 'vitest'
import { BUILDING_IDS } from '../game/cityTypes'
import { useCityStore } from './useCityStore'

describe('useCityStore', () => {
  beforeEach(() => useCityStore.getState().reset())

  it('starts with no selection and all six buildings at level 1', () => {
    const state = useCityStore.getState()

    expect(state.selectedBuildingId).toBeNull()
    expect(Object.keys(state.buildingLevels)).toHaveLength(BUILDING_IDS.length)
    expect(BUILDING_IDS.every((id) => state.buildingLevels[id] === 1)).toBe(
      true,
    )
  })

  it('selects, switches, and clears a building', () => {
    useCityStore.getState().selectBuilding('recycling-yard')
    expect(useCityStore.getState().selectedBuildingId).toBe('recycling-yard')

    useCityStore.getState().selectBuilding('repair-shop')
    expect(useCityStore.getState().selectedBuildingId).toBe('repair-shop')

    useCityStore.getState().clearSelection()
    expect(useCityStore.getState().selectedBuildingId).toBeNull()
  })

  it('upgrades only the target building once', () => {
    useCityStore.getState().upgradeBuilding('gas-station')

    const levels = useCityStore.getState().buildingLevels
    expect(levels['gas-station']).toBe(2)
    expect(
      BUILDING_IDS.filter((id) => id !== 'gas-station').every(
        (id) => levels[id] === 1,
      ),
    ).toBe(true)
  })

  it('caps repeated upgrades at level 3', () => {
    const { upgradeBuilding } = useCityStore.getState()

    upgradeBuilding('clubhouse')
    upgradeBuilding('clubhouse')
    upgradeBuilding('clubhouse')

    expect(useCityStore.getState().buildingLevels.clubhouse).toBe(3)
  })

  it('ignores an unknown building without changing state', () => {
    useCityStore.getState().selectBuilding('metalworking-plant')
    const before = useCityStore.getState()

    useCityStore.getState().upgradeBuilding('unknown')

    expect(useCityStore.getState()).toBe(before)
    expect(useCityStore.getState().selectedBuildingId).toBe(
      'metalworking-plant',
    )
    expect(useCityStore.getState().buildingLevels).toEqual(
      before.buildingLevels,
    )
  })

  it('resets selection and every level using a new levels object', () => {
    useCityStore.getState().selectBuilding('commercial-street')
    useCityStore.getState().upgradeBuilding('commercial-street')
    const previousLevels = useCityStore.getState().buildingLevels

    useCityStore.getState().reset()

    const state = useCityStore.getState()
    expect(state.selectedBuildingId).toBeNull()
    expect(BUILDING_IDS.every((id) => state.buildingLevels[id] === 1)).toBe(
      true,
    )
    expect(state.buildingLevels).not.toBe(previousLevels)

    useCityStore.getState().selectBuilding('repair-shop')
    useCityStore.getState().upgradeBuilding('repair-shop')
  })

  it('starts reset after the prior test ended non-default', () => {
    expect(useCityStore.getState().selectedBuildingId).toBeNull()
    expect(useCityStore.getState().buildingLevels.clubhouse).toBe(1)

    useCityStore.getState().selectBuilding('clubhouse')
    useCityStore.getState().upgradeBuilding('clubhouse')

    expect(useCityStore.getState().selectedBuildingId).toBe('clubhouse')
    expect(useCityStore.getState().buildingLevels.clubhouse).toBe(2)
  })
})
