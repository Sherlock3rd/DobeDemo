import { describe, expect, it } from 'vitest'
import { CAMERA_CONFIG } from '../../game/cityLayout'
import { BATTLE_CAMERA_CONFIG } from './battleCamera'

describe('battle camera', () => {
  it('uses the same diagonal bird-view direction as the city camera', () => {
    expect(BATTLE_CAMERA_CONFIG.position).toEqual(
      CAMERA_CONFIG.position.map((value) => value / 2),
    )
    expect(BATTLE_CAMERA_CONFIG.position[0]).toBeGreaterThan(0)
    expect(BATTLE_CAMERA_CONFIG.position[1]).toBeGreaterThan(0)
    expect(BATTLE_CAMERA_CONFIG.position[2]).toBeGreaterThan(0)
    expect(BATTLE_CAMERA_CONFIG.rotation[0]).toBeLessThan(0)
    expect(BATTLE_CAMERA_CONFIG.rotation[1]).not.toBe(0)
  })
})
