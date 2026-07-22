import type { BuildingLevel } from './cityTypes'

export function upgradeBuildingLevel(level: BuildingLevel): BuildingLevel {
  return level === 3 ? 3 : ((level + 1) as BuildingLevel)
}
