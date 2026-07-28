import { OrbitControls } from '@react-three/drei'
import { useEffect, useRef, type ElementRef, type JSX } from 'react'
import {
  CAMERA_CONFIG,
  interactiveBuildingPlacements,
} from '../../game/cityLayout'
import type { BuildingId } from '../../game/cityTypes'
import {
  CAMERA_CONTROL_FLAGS,
  CAMERA_MOUSE_BUTTONS,
  CAMERA_TOUCHES,
  clampPanTarget,
} from './cameraConstraints'

interface CityCameraControlsProps {
  focusBuildingId?: BuildingId | null
}

export function CityCameraControls({
  focusBuildingId = null,
}: CityCameraControlsProps): JSX.Element {
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null)

  useEffect(() => {
    if (!focusBuildingId || !controlsRef.current) return
    const placement = interactiveBuildingPlacements.find(
      (candidate) => candidate.id === focusBuildingId,
    )
    if (!placement) return
    const controls = controlsRef.current
    const clamped = clampPanTarget({
      x: placement.position[0],
      z: placement.position[2],
    })
    const deltaX = clamped.x - controls.target.x
    const deltaZ = clamped.z - controls.target.z
    controls.target.x = clamped.x
    controls.target.z = clamped.z
    controls.object.position.x += deltaX
    controls.object.position.z += deltaZ
    controls.update()
  }, [focusBuildingId])

  const handleChange = () => {
    const controls = controlsRef.current

    if (!controls) {
      return
    }

    const clamped = clampPanTarget(controls.target)
    const deltaX = clamped.x - controls.target.x
    const deltaZ = clamped.z - controls.target.z

    if (deltaX === 0 && deltaZ === 0) {
      return
    }

    controls.target.x = clamped.x
    controls.target.z = clamped.z
    controls.object.position.x += deltaX
    controls.object.position.z += deltaZ
    controls.update()
  }

  return (
    <OrbitControls
      ref={controlsRef}
      target={[...CAMERA_CONFIG.target]}
      {...CAMERA_CONTROL_FLAGS}
      mouseButtons={CAMERA_MOUSE_BUTTONS}
      touches={CAMERA_TOUCHES}
      minZoom={CAMERA_CONFIG.minZoom}
      maxZoom={CAMERA_CONFIG.maxZoom}
      onChange={handleChange}
    />
  )
}
