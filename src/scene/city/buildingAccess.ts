import { getGangLevel, isBuildingUnlocked } from '../../game/gangProgression'

export type BuildingRenderMode = 'locked' | 'unlocked'

export function getBuildingRenderMode(
  buildingId: string,
  totalReputation: number,
): BuildingRenderMode {
  const level = getGangLevel(totalReputation)

  return isBuildingUnlocked(buildingId, level) ? 'unlocked' : 'locked'
}
