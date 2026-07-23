import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { cityCursorController } from './cityCursorController'
import { cityPointerDragTracker } from './pointerDragTracker'

export function CityPointerGestures(): null {
  const canvas = useThree((state) => state.gl.domElement)

  useEffect(() => {
    const unregisterCursor = cityCursorController.registerCanvas(canvas)

    const syncDraggingCursor = () => {
      cityCursorController.setCameraDragging(
        cityPointerDragTracker.isDragging(),
      )
    }

    const handlePointerDown = (event: PointerEvent) => {
      cityPointerDragTracker.pointerDown(
        event.pointerId,
        event.clientX,
        event.clientY,
      )
    }

    const handlePointerMove = (event: PointerEvent) => {
      cityPointerDragTracker.pointerMove(
        event.pointerId,
        event.clientX,
        event.clientY,
      )
      syncDraggingCursor()
    }

    const handlePointerUp = (event: PointerEvent) => {
      cityPointerDragTracker.pointerUp(event.pointerId)
      syncDraggingCursor()
    }

    const handlePointerCancel = (event: PointerEvent) => {
      cityPointerDragTracker.pointerCancel(event.pointerId)
      syncDraggingCursor()
    }

    // Losing pointer capture ends the gesture like a release. It must NOT drop
    // an already-completed drag, because Chrome/OrbitControls fire the sequence
    // pointerup -> lostpointercapture -> click, and the trailing click still
    // needs to be suppressed.
    const handleLostPointerCapture = (event: PointerEvent) => {
      cityPointerDragTracker.pointerLostCapture(event.pointerId)
      syncDraggingCursor()
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointercancel', handlePointerCancel)
    canvas.addEventListener('lostpointercapture', handleLostPointerCapture)

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerCancel)
      canvas.removeEventListener('lostpointercapture', handleLostPointerCapture)
      cityPointerDragTracker.reset()
      unregisterCursor()
      cityCursorController.reset()
    }
  }, [canvas])

  return null
}
