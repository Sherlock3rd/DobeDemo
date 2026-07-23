import { describe, expect, it } from 'vitest'
import { economyConfig, parseEconomyConfig } from './economyConfig'

describe('economyConfig', () => {
  it('loads validated defaults from JSON', () => {
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
  })

  it('rejects missing version', () => {
    expect(() => parseEconomyConfig({})).toThrow(
      'Invalid economy config: version',
    )
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
})
