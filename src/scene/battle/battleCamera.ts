const BATTLE_CAMERA_POSITION = [0, 14, 15] as const

export const BATTLE_CAMERA_CONFIG = {
  position: BATTLE_CAMERA_POSITION,
  rotation: [
    -Math.atan2(BATTLE_CAMERA_POSITION[1], BATTLE_CAMERA_POSITION[2]),
    0,
    0,
  ] as const,
  zoom: 48,
  near: 0.1,
  far: 100,
} as const
