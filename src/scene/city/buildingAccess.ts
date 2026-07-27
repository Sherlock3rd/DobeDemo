import { getGangLevel, isBuildingUnlocked } from '../../game/gangProgression'
import type { BuildingId } from '../../game/cityTypes'

export type BuildingRenderMode = 'locked' | 'unlocked'
export type BuildingAccessState = 'locked' | 'claimable' | 'claimed'

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

export function getBuildingAccessState(
  buildingId: string,
  gangLevel: number,
  claimedBuildingIds: readonly BuildingId[],
): BuildingAccessState {
  if (!isBuildingUnlocked(buildingId, gangLevel)) return 'locked'
  return claimedBuildingIds.some((id) => id === buildingId)
    ? 'claimed'
    : 'claimable'
}
