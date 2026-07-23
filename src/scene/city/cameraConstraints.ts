import { MOUSE, TOUCH } from 'three'
import { CAMERA_CONFIG } from '../../game/cityLayout'

export const CAMERA_MOUSE_BUTTONS = {
  LEFT: MOUSE.PAN,
  MIDDLE: MOUSE.DOLLY,
  RIGHT: MOUSE.PAN,
} as const

export const CAMERA_TOUCHES = {
  ONE: TOUCH.PAN,
  TWO: TOUCH.DOLLY_PAN,
} as const

export const CAMERA_CONTROL_FLAGS = {
  enableRotate: false,
  enablePan: true,
  enableZoom: true,
  screenSpacePanning: false,
} as const

export interface PanPoint {
  x: number
  z: number
}

export function clampPanTarget(point: PanPoint): PanPoint {
  return {
    x: Math.min(
      CAMERA_CONFIG.panBounds.maxX,
      Math.max(CAMERA_CONFIG.panBounds.minX, point.x),
    ),
    z: Math.min(
      CAMERA_CONFIG.panBounds.maxZ,
      Math.max(CAMERA_CONFIG.panBounds.minZ, point.z),
    ),
  }
}
