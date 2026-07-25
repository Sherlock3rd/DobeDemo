import { CAMERA_CONFIG } from '../../game/cityLayout'

export const BATTLE_CAMERA_CONFIG = {
  position: [
    CAMERA_CONFIG.position[0] / 2,
    CAMERA_CONFIG.position[1] / 2,
    CAMERA_CONFIG.position[2] / 2,
  ] as const,
  rotation: [-0.6, 0.675, 0] as const,
  zoom: 48,
  near: 0.1,
  far: 100,
} as const
