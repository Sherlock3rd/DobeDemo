import { OrbitControls } from '@react-three/drei'
import { useRef, type ElementRef, type JSX } from 'react'
import { CAMERA_CONFIG } from '../../game/cityLayout'
import { CAMERA_CONTROL_FLAGS, clampPanTarget } from './cameraConstraints'

export function CityCameraControls(): JSX.Element {
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null)

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
      minZoom={CAMERA_CONFIG.minZoom}
      maxZoom={CAMERA_CONFIG.maxZoom}
      onChange={handleChange}
    />
  )
}
