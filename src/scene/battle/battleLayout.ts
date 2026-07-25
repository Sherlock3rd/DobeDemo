export const BATTLE_FORMATION_ROTATION_Y = -Math.PI / 4

export const BATTLE_FORMATION_ROTATION = [
  0,
  BATTLE_FORMATION_ROTATION_Y,
  0,
] as const

export function rotateBattlePosition(
  position: readonly [number, number, number],
): [number, number, number] {
  const [x, y, z] = position
  const cosine = Math.cos(BATTLE_FORMATION_ROTATION_Y)
  const sine = Math.sin(BATTLE_FORMATION_ROTATION_Y)

  return [x * cosine + z * sine, y, -x * sine + z * cosine]
}
