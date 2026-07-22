import type { JSX } from 'react'
import { buildingCatalogById } from '../../game/buildingCatalog'
import { BUILDING_RENDER_SCALE } from '../../game/cityLayout'
import type { BuildingId, BuildingLevel } from '../../game/cityTypes'
import { useGangStore } from '../../store/useGangStore'
import { BuildingModel } from './BuildingModel'
import { getBuildingRenderMode } from './buildingAccess'
import { LockedBuildingPlot } from './LockedBuildingPlot'

interface BuildingVisualProps {
  id: BuildingId
  level: BuildingLevel
  highlighted: boolean
}

export function BuildingVisual({
  id,
  level,
  highlighted,
}: BuildingVisualProps): JSX.Element {
  const definition = buildingCatalogById[id]
  const totalReputation = useGangStore((state) => state.totalReputation)
  const renderMode = getBuildingRenderMode(id, totalReputation)
  const renderedFootprint = [
    definition.footprint[0] * BUILDING_RENDER_SCALE,
    definition.footprint[1] * BUILDING_RENDER_SCALE,
  ] as const

  if (renderMode === 'locked') {
    return (
      <LockedBuildingPlot
        footprint={renderedFootprint}
        highlighted={highlighted}
      />
    )
  }

  return (
    <group scale={BUILDING_RENDER_SCALE}>
      <BuildingModel
        definition={definition}
        level={level}
        highlighted={highlighted}
      />
    </group>
  )
}
