import { describe, expect, it } from 'vitest'
import { CAMERA_CONFIG } from '../../game/cityLayout'
import { CAMERA_CONTROL_FLAGS, clampPanTarget } from './cameraConstraints'

describe('CAMERA_CONTROL_FLAGS', () => {
  it('keeps rotation disabled while pan and zoom remain enabled', () => {
    expect(CAMERA_CONTROL_FLAGS).toEqual({
      enableRotate: false,
      enablePan: true,
      enableZoom: true,
      screenSpacePanning: false,
    })
  })
})

describe('clampPanTarget', () => {
  it('returns an unchanged copy for a point inside the bounds', () => {
    const point = { x: 2, z: -3 }

    expect(clampPanTarget(point)).toEqual(point)
    expect(clampPanTarget(point)).not.toBe(point)
  })

  it.each([
    [
      { x: CAMERA_CONFIG.panBounds.minX - 1, z: 0 },
      { x: CAMERA_CONFIG.panBounds.minX, z: 0 },
    ],
    [
      { x: CAMERA_CONFIG.panBounds.maxX + 1, z: 0 },
      { x: CAMERA_CONFIG.panBounds.maxX, z: 0 },
    ],
    [
      { x: 0, z: CAMERA_CONFIG.panBounds.minZ - 1 },
      { x: 0, z: CAMERA_CONFIG.panBounds.minZ },
    ],
    [
      { x: 0, z: CAMERA_CONFIG.panBounds.maxZ + 1 },
      { x: 0, z: CAMERA_CONFIG.panBounds.maxZ },
    ],
  ])('clamps an out-of-bounds edge %#', (point, expected) => {
    expect(clampPanTarget(point)).toEqual(expected)
  })

  it('does not mutate its input object', () => {
    const point = {
      x: CAMERA_CONFIG.panBounds.maxX + 4,
      z: CAMERA_CONFIG.panBounds.minZ - 4,
    }
    const original = { ...point }

    clampPanTarget(point)

    expect(point).toEqual(original)
  })
})
