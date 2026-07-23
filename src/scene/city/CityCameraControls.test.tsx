import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CAMERA_CONFIG } from '../../game/cityLayout'
import { CAMERA_MOUSE_BUTTONS, CAMERA_TOUCHES } from './cameraConstraints'

const capturedProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}))

vi.mock('@react-three/drei', () => ({
  OrbitControls: (props: Record<string, unknown>) => {
    capturedProps.current = props
    return <div data-testid="orbit-controls" />
  },
}))

const { CityCameraControls } = await import('./CityCameraControls')

describe('CityCameraControls', () => {
  beforeEach(() => {
    capturedProps.current = null
  })

  it('passes the explicit pan mappings and camera limits to OrbitControls', () => {
    render(<CityCameraControls />)

    expect(capturedProps.current).toMatchObject({
      mouseButtons: CAMERA_MOUSE_BUTTONS,
      touches: CAMERA_TOUCHES,
      enableRotate: false,
      minZoom: CAMERA_CONFIG.minZoom,
      maxZoom: CAMERA_CONFIG.maxZoom,
    })
  })
})
