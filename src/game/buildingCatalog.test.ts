import { describe, expect, it } from 'vitest'
import { BUILDING_IDS } from './cityTypes'
import {
  buildingCatalog,
  buildingCatalogById,
  isBuildingId,
} from './buildingCatalog'

const EXPECTED_NAMES = [
  '修车厂',
  '废车回收厂',
  '商业街',
  '金属加工厂',
  '加油站',
  'Clubhouse',
]

describe('buildingCatalog', () => {
  it('contains exactly six buildings in BUILDING_IDS order', () => {
    expect(buildingCatalog).toHaveLength(6)
    expect(buildingCatalog.map(({ id }) => id)).toEqual(BUILDING_IDS)
  })

  it('uses the required names in catalog order', () => {
    expect(buildingCatalog.map(({ name }) => name)).toEqual(EXPECTED_NAMES)
  })

  it('contains unique building IDs', () => {
    const ids = buildingCatalog.map(({ id }) => id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('provides three non-empty level appearance summaries per building', () => {
    for (const building of buildingCatalog) {
      expect(building.levelSummary).toHaveLength(3)
      expect(
        building.levelSummary.every((summary) => summary.trim().length > 0),
      ).toBe(true)
    }
  })

  it('indexes every definition by ID', () => {
    for (const building of buildingCatalog) {
      expect(buildingCatalogById[building.id]).toBe(building)
    }
  })

  it('recognizes only catalog building IDs', () => {
    for (const id of BUILDING_IDS) {
      expect(isBuildingId(id)).toBe(true)
    }
    expect(isBuildingId('unknown-building')).toBe(false)
  })
})
