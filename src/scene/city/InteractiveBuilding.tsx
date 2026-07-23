import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useState, type JSX } from 'react'
import { buildingCatalogById } from '../../game/buildingCatalog'
import {
  BUILDING_HITBOX_HEIGHT,
  BUILDING_RENDER_SCALE,
} from '../../game/cityLayout'
import type { BuildingId } from '../../game/cityTypes'
import { useCityStore } from '../../store/useCityStore'
import { BuildingVisual } from './BuildingVisual'
import { cityCursorController } from './cityCursorController'
import { consumePointerDrag, markPointerEventHandled } from './pointerDragClick'

interface InteractiveBuildingProps {
  id: BuildingId
  position: readonly [number, number, number]
  rotation?: number
}

export function InteractiveBuilding({
  id,
  position,
  rotation = 0,
}: InteractiveBuildingProps): JSX.Element {
  const definition = buildingCatalogById[id]
  const selected = useCityStore((state) => state.selectedBuildingId === id)
  const selectBuilding = useCityStore((state) => state.selectBuilding)
  const [hovered, setHovered] = useState(false)
  const highlighted = hovered || selected
  const renderedFootprint = [
    definition.footprint[0] * BUILDING_RENDER_SCALE,
    definition.footprint[1] * BUILDING_RENDER_SCALE,
  ] as const

  useEffect(
    () => () => {
      cityCursorController.setBuildingHovered(id, false)
    },
    [id],
  )

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    // Claim the native event so the background handler bails out even if
    // pointer-event propagation is not stopped for some reason.
    markPointerEventHandled(event.nativeEvent)

    if (consumePointerDrag(event.nativeEvent)) {
      return
    }

    selectBuilding(id)
  }

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    cityCursorController.setBuildingHovered(id, true)
    setHovered(true)
  }

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    cityCursorController.setBuildingHovered(id, false)
    setHovered(false)
  }

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <BuildingVisual id={id} highlighted={highlighted} />

      {highlighted && (
        <mesh position={[0, 0.07, 0]} receiveShadow>
          <boxGeometry
            args={[renderedFootprint[0], 0.12, renderedFootprint[1]]}
          />
          <meshStandardMaterial
            color="#ffc857"
            transparent
            opacity={0.28}
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh
        position={[0, BUILDING_HITBOX_HEIGHT / 2, 0]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry
          args={[
            renderedFootprint[0],
            BUILDING_HITBOX_HEIGHT,
            renderedFootprint[1],
          ]}
        />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
