import { describe, expect, it } from 'vitest'
import { MOUSE, TOUCH } from 'three'
import { CAMERA_CONFIG } from '../../game/cityLayout'
import {
  CAMERA_CONTROL_FLAGS,
  CAMERA_MOUSE_BUTTONS,
  CAMERA_TOUCHES,
  clampPanTarget,
} from './cameraConstraints'

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

describe('camera input mappings', () => {
  it('maps every mouse button to pan or dolly without rotation', () => {
    expect(CAMERA_MOUSE_BUTTONS).toEqual({
      LEFT: MOUSE.PAN,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.PAN,
    })
  })

  it('maps one-finger pan and two-finger dolly-pan', () => {
    expect(CAMERA_TOUCHES).toEqual({
      ONE: TOUCH.PAN,
      TWO: TOUCH.DOLLY_PAN,
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
