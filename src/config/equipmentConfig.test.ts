import { describe, expect, it } from 'vitest'
import { equipmentConfig, parseEquipmentConfig } from './equipmentConfig'
import raw from './equipment.config.json'
import { CAR_IDS, GUN_IDS } from '../game/equipmentTypes'
import { carUnlockLevel, gunUnlockLevel } from '../game/progressionUnlocks'

describe('equipmentConfig', () => {
  it('parses five unique cars and guns', () => {
    expect(Object.keys(equipmentConfig.cars)).toEqual([...CAR_IDS])
    expect(Object.keys(equipmentConfig.guns)).toEqual([...GUN_IDS])
  })

  it('matches all gang tree unlock levels', () => {
    for (const carId of CAR_IDS) {
      expect(equipmentConfig.cars[carId].unlockGangLevel).toBe(
        carUnlockLevel(carId),
      )
    }
    for (const gunId of GUN_IDS) {
      expect(equipmentConfig.guns[gunId].unlockGangLevel).toBe(
        gunUnlockLevel(gunId),
      )
    }
  })

  it('rejects a missing definition', () => {
    const invalid = structuredClone(raw) as unknown as {
      cars: Record<string, unknown>
    }
    delete invalid.cars['rust-fox']
    expect(() => parseEquipmentConfig(invalid)).toThrow(/cars\.rust-fox/)
  })
})
