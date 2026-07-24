import { describe, expect, it } from 'vitest'
import {
  economyConfig,
  getBuildingPower,
  parseEconomyConfig,
} from './economyConfig'

describe('economyConfig', () => {
  it('loads validated defaults from JSON', () => {
    expect(economyConfig.version).toBe(2)
    expect(economyConfig.resourceTickSeconds).toBe(10)
    expect(economyConfig.maxOfflineSeconds).toBe(28_800)
    expect(economyConfig.production['repair-shop']).toEqual({
      resource: 'money',
      basePerTick: 1,
      childLevelStep: 5,
      bonusPerStep: 1,
    })
    expect(economyConfig.childUpgradeCostByTargetLevel[1]).toEqual({
      money: 5,
      oil: 0,
      materials: 0,
    })
    expect(economyConfig.buildingUpgradeCostByTargetLevel[10]?.money).toBe(1250)
    expect(getBuildingPower('repair-shop', 1)).toBe(100)
    expect(getBuildingPower('repair-shop', 10)).toBe(550)
    expect(getBuildingPower('clubhouse', 10)).toBe(1150)
  })

  it('rejects missing version', () => {
    expect(() => parseEconomyConfig({})).toThrow(
      'Invalid economy config: version',
    )
  })

  it('rejects resourceTickSeconds other than 10', () => {
    expect(() =>
      parseEconomyConfig({
        ...economyConfig,
        resourceTickSeconds: 11,
      }),
    ).toThrow('Invalid economy config: resourceTickSeconds')
  })

  it('rejects maxOfflineSeconds other than 28_800', () => {
    expect(() =>
      parseEconomyConfig({
        ...economyConfig,
        maxOfflineSeconds: 28_801,
      }),
    ).toThrow('Invalid economy config: maxOfflineSeconds')
  })

  it('rejects negative child upgrade cost fields', () => {
    expect(() =>
      parseEconomyConfig({
        ...economyConfig,
        childUpgradeCostByTargetLevel: {
          ...economyConfig.childUpgradeCostByTargetLevel,
          1: { money: -1, oil: 0, materials: 0 },
        },
      }),
    ).toThrow('Invalid economy config: childUpgradeCostByTargetLevel.1.money')
  })

  it('rejects unknown production buildings', () => {
    expect(() =>
      parseEconomyConfig({
        ...economyConfig,
        production: {
          ...economyConfig.production,
          'recycling-yard': {
            resource: 'money',
            basePerTick: 1,
            childLevelStep: 5,
            bonusPerStep: 1,
          },
        },
      }),
    ).toThrow('Invalid economy config: production.recycling-yard')
  })

  it('rejects unsupported production resources', () => {
    expect(() =>
      parseEconomyConfig({
        ...economyConfig,
        production: {
          ...economyConfig.production,
          'repair-shop': {
            resource: 'gold',
            basePerTick: 1,
            childLevelStep: 5,
            bonusPerStep: 1,
          },
        },
      }),
    ).toThrow('Invalid economy config: production.repair-shop.resource')
  })

  it('rejects wrong production resource mapping for repair-shop', () => {
    expect(() =>
      parseEconomyConfig({
        ...economyConfig,
        production: {
          ...economyConfig.production,
          'repair-shop': {
            resource: 'oil',
            basePerTick: 1,
            childLevelStep: 5,
            bonusPerStep: 1,
          },
        },
      }),
    ).toThrow('Invalid economy config: production.repair-shop.resource')
  })

  it('rejects wrong production resource mapping for gas-station', () => {
    expect(() =>
      parseEconomyConfig({
        ...economyConfig,
        production: {
          ...economyConfig.production,
          'gas-station': {
            resource: 'money',
            basePerTick: 1,
            childLevelStep: 5,
            bonusPerStep: 1,
          },
        },
      }),
    ).toThrow('Invalid economy config: production.gas-station.resource')
  })

  it('rejects missing child upgrade level 10', () => {
    const childUpgradeCostByTargetLevel = Object.fromEntries(
      Object.entries(economyConfig.childUpgradeCostByTargetLevel).filter(
        ([level]) => Number(level) !== 10,
      ),
    )

    expect(() =>
      parseEconomyConfig({
        ...economyConfig,
        childUpgradeCostByTargetLevel,
      }),
    ).toThrow('Invalid economy config: childUpgradeCostByTargetLevel.10')
  })

  it('rejects non-integer child upgrade costs', () => {
    expect(() =>
      parseEconomyConfig({
        ...economyConfig,
        childUpgradeCostByTargetLevel: {
          ...economyConfig.childUpgradeCostByTargetLevel,
          2: { money: 10.5, oil: 0, materials: 0 },
        },
      }),
    ).toThrow('Invalid economy config: childUpgradeCostByTargetLevel.2.money')
  })

  it('rejects infinite building upgrade costs', () => {
    expect(() =>
      parseEconomyConfig({
        ...economyConfig,
        buildingUpgradeCostByTargetLevel: {
          ...economyConfig.buildingUpgradeCostByTargetLevel,
          3: { money: Number.POSITIVE_INFINITY, oil: 0, materials: 0 },
        },
      }),
    ).toThrow(
      'Invalid economy config: buildingUpgradeCostByTargetLevel.3.money',
    )
  })

  it('rejects a missing building power level', () => {
    const missingLevel = structuredClone(economyConfig) as unknown as Record<
      string,
      unknown
    >
    delete (
      missingLevel.buildingPowerById as Record<string, Record<string, number>>
    )['repair-shop']['10']
    expect(() => parseEconomyConfig(missingLevel)).toThrow(
      'Invalid economy config: buildingPowerById.repair-shop.10',
    )
  })

  it('rejects an extra building power buildingId', () => {
    const extraBuilding = structuredClone(economyConfig) as unknown as Record<
      string,
      unknown
    >
    ;(
      extraBuilding.buildingPowerById as Record<string, Record<string, number>>
    ).warehouse = { 1: 100 }
    expect(() => parseEconomyConfig(extraBuilding)).toThrow(
      'Invalid economy config: buildingPowerById.warehouse',
    )
  })

  it('rejects an extra building power level', () => {
    const extraLevel = structuredClone(economyConfig) as unknown as Record<
      string,
      unknown
    >
    ;(extraLevel.buildingPowerById as Record<string, Record<string, number>>)[
      'repair-shop'
    ]['11'] = 600
    expect(() => parseEconomyConfig(extraLevel)).toThrow(
      'Invalid economy config: buildingPowerById.repair-shop.11',
    )
  })

  it.each([
    ['negative', -1],
    ['unsafe', Number.MAX_SAFE_INTEGER + 1],
    ['non-integer', 100.5],
  ])('rejects %s building power', (_label, power) => {
    const invalidPower = structuredClone(economyConfig) as unknown as Record<
      string,
      unknown
    >
    ;(invalidPower.buildingPowerById as Record<string, Record<string, number>>)[
      'repair-shop'
    ]['2'] = power
    expect(() => parseEconomyConfig(invalidPower)).toThrow(
      'Invalid economy config: buildingPowerById.repair-shop.2',
    )
  })

  it.each([
    ['equal', 100],
    ['decreasing', 99],
  ])('rejects %s adjacent building power', (_label, power) => {
    const nonIncreasingPower = structuredClone(
      economyConfig,
    ) as unknown as Record<string, unknown>
    ;(
      nonIncreasingPower.buildingPowerById as Record<
        string,
        Record<string, number>
      >
    )['repair-shop']['2'] = power
    expect(() => parseEconomyConfig(nonIncreasingPower)).toThrow(
      'Invalid economy config: buildingPowerById.repair-shop.2',
    )
  })
})
