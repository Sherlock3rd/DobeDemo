import { describe, expect, it } from 'vitest'
import { BATTLE_CAMERA_CONFIG } from './battleCamera'

describe('battle camera', () => {
  it('keeps the battlefield level while using an angled bird view', () => {
    expect(BATTLE_CAMERA_CONFIG.position[0]).toBe(0)
    expect(BATTLE_CAMERA_CONFIG.position[1]).toBeGreaterThan(0)
    expect(BATTLE_CAMERA_CONFIG.position[2]).toBeGreaterThan(0)
    expect(BATTLE_CAMERA_CONFIG.rotation[0]).toBeLessThan(0)
    expect(BATTLE_CAMERA_CONFIG.rotation[1]).toBe(0)
    expect(BATTLE_CAMERA_CONFIG.rotation[2]).toBe(0)
    expect(Math.tan(-BATTLE_CAMERA_CONFIG.rotation[0])).toBeCloseTo(
      BATTLE_CAMERA_CONFIG.position[1] / BATTLE_CAMERA_CONFIG.position[2],
    )
  })
})
