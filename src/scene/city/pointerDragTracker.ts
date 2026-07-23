export const POINTER_DRAG_THRESHOLD_PX = 6

export interface PointerDragTracker {
  pointerDown(pointerId: number, x: number, y: number): void
  pointerMove(pointerId: number, x: number, y: number): boolean
  pointerUp(pointerId: number): void
  pointerLostCapture(pointerId: number): void
  pointerCancel(pointerId: number): void
  consumeDraggedClick(pointerId: number): boolean
  isDragging(): boolean
  reset(): void
}

interface ActivePointer {
  originX: number
  originY: number
  dragged: boolean
}

export function createPointerDragTracker(): PointerDragTracker {
  const active = new Map<number, ActivePointer>()
  const completedDrags = new Set<number>()

  // Ends the gesture for a pointer like a release: if it is still active and
  // had dragged, keep the completion; if it was already removed (e.g. by
  // pointerup or cancel) do nothing so an existing completion is never lost.
  const endActivePointer = (pointerId: number) => {
    const pointer = active.get(pointerId)

    if (!pointer) {
      return
    }

    active.delete(pointerId)

    if (pointer.dragged) {
      completedDrags.add(pointerId)
    }
  }

  return {
    pointerDown(pointerId, x, y) {
      // A fresh gesture begins only when nothing is currently pressed; its
      // start clears stale completions from the previous gesture. Additional
      // pointers pressed during an ongoing gesture keep the earlier
      // completions so a multi-finger drag is still consumable.
      if (active.size === 0) {
        completedDrags.clear()
      }

      active.set(pointerId, { originX: x, originY: y, dragged: false })
    },

    pointerMove(pointerId, x, y) {
      const pointer = active.get(pointerId)

      if (!pointer) {
        return false
      }

      const dx = x - pointer.originX
      const dy = y - pointer.originY

      if (Math.hypot(dx, dy) > POINTER_DRAG_THRESHOLD_PX) {
        pointer.dragged = true
      }

      return pointer.dragged
    },

    pointerUp(pointerId) {
      endActivePointer(pointerId)
    },

    pointerLostCapture(pointerId) {
      // Losing pointer capture ends the gesture but must not erase a drag that
      // already completed (the normal Chrome sequence is
      // pointerup -> lostpointercapture -> click).
      endActivePointer(pointerId)
    },

    pointerCancel(pointerId) {
      active.delete(pointerId)
      completedDrags.delete(pointerId)
    },

    consumeDraggedClick(pointerId) {
      // Exact match wins first (mouse and pointer-consistent devices).
      if (completedDrags.delete(pointerId)) {
        return true
      }

      // Touch synthesises the click with a different (or zero) pointerId than
      // the drag pointers, so fall back to consuming the current gesture's
      // completed drags. Stale completions were already cleared at gesture
      // start, so anything pending belongs to the just-finished gesture.
      if (completedDrags.size > 0) {
        completedDrags.clear()
        return true
      }

      return false
    },

    isDragging() {
      for (const pointer of active.values()) {
        if (pointer.dragged) {
          return true
        }
      }

      return false
    },

    reset() {
      active.clear()
      completedDrags.clear()
    },
  }
}

export const cityPointerDragTracker: PointerDragTracker =
  createPointerDragTracker()
