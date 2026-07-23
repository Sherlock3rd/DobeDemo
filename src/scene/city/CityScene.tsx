import type { ThreeEvent } from '@react-three/fiber'
import type { JSX } from 'react'
import { interactiveBuildingPlacements } from '../../game/cityLayout'
import { useCityStore } from '../../store/useCityStore'
import { CityCameraControls } from './CityCameraControls'
import { CityEnvironment } from './CityEnvironment'
import { CityGround } from './CityGround'
import { CityPointerGestures } from './CityPointerGestures'
import { InteractiveBuilding } from './InteractiveBuilding'
import { consumePointerDrag, isPointerEventHandled } from './pointerDragClick'

export function CityScene(): JSX.Element {
  const clearSelection = useCityStore((state) => state.clearSelection)

  const handleBackgroundClick = (event: ThreeEvent<MouseEvent>) => {
    // A building already claimed this click; do not clear the selection.
    if (isPointerEventHandled(event.nativeEvent)) {
      return
    }

    if (consumePointerDrag(event.nativeEvent)) {
      return
    }

    clearSelection()
  }

  return (
    <>
      <color attach="background" args={['#6f7c7b']} />
      <fog attach="fog" args={['#6f7c7b', 38, 76]} />
      <CityPointerGestures />

      <group onClick={handleBackgroundClick}>
        <hemisphereLight args={['#d6e1dc', '#38413c', 1.7]} />
        <directionalLight
          position={[18, 30, 20]}
          intensity={2.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-24}
          shadow-camera-right={24}
          shadow-camera-top={22}
          shadow-camera-bottom={-22}
          shadow-camera-near={1}
          shadow-camera-far={80}
        />

        <CityGround />
        <CityEnvironment />
        {interactiveBuildingPlacements.map((placement) => (
          <InteractiveBuilding key={placement.id} {...placement} />
        ))}
        <CityCameraControls />
      </group>
    </>
  )
}
