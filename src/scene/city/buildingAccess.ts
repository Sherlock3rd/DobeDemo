import { getGangLevel, isBuildingUnlocked } from '../../game/gangProgression'

export type BuildingRenderMode = 'locked' | 'unlocked'

export function getBuildingRenderMode(
  buildingId: string,
  totalReputation: number,
): BuildingRenderMode {
  return getBuildingRenderModeForLevel(
    buildingId,
    getGangLevel(totalReputation),
  )
}

export function getBuildingRenderModeForLevel(
  buildingId: string,
  gangLevel: number,
): BuildingRenderMode {
  return isBuildingUnlocked(buildingId, gangLevel) ? 'unlocked' : 'locked'
}
