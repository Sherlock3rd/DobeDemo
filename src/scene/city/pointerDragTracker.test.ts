import { beforeEach, describe, expect, it } from 'vitest'
import {
  POINTER_DRAG_THRESHOLD_PX,
  cityPointerDragTracker,
  createPointerDragTracker,
} from './pointerDragTracker'

describe('POINTER_DRAG_THRESHOLD_PX', () => {
  it('is 6 pixels', () => {
    expect(POINTER_DRAG_THRESHOLD_PX).toBe(6)
  })
})

describe('createPointerDragTracker', () => {
  let tracker: ReturnType<typeof createPointerDragTracker>

  beforeEach(() => {
    tracker = createPointerDragTracker()
  })

  it('does not flag movement at or below the 6px threshold as a drag', () => {
    tracker.pointerDown(1, 100, 100)

    expect(tracker.pointerMove(1, 105, 100)).toBe(false)
    expect(tracker.pointerMove(1, 106, 100)).toBe(false)
    expect(tracker.isDragging()).toBe(false)
  })

  it('flags movement strictly greater than 6px as a drag', () => {
    tracker.pointerDown(1, 100, 100)

    expect(tracker.pointerMove(1, 107, 100)).toBe(true)
    expect(tracker.isDragging()).toBe(true)
  })

  it('uses euclidean distance across both axes', () => {
    tracker.pointerDown(1, 0, 0)

    // 5,5 -> distance ~7.07 > 6
    expect(tracker.pointerMove(1, 5, 5)).toBe(true)
  })

  it('does not flag a diagonal move whose euclidean distance is <= 6', () => {
    tracker.pointerDown(1, 0, 0)

    // 4,4 -> distance ~5.66 <= 6
    expect(tracker.pointerMove(1, 4, 4)).toBe(false)
  })

  it('returns false when moving an unknown pointer id', () => {
    expect(tracker.pointerMove(99, 500, 500)).toBe(false)
  })

  it('tracks each pointer independently', () => {
    tracker.pointerDown(1, 0, 0)
    tracker.pointerDown(2, 0, 0)

    expect(tracker.pointerMove(1, 100, 0)).toBe(true)
    expect(tracker.pointerMove(2, 1, 0)).toBe(false)
    expect(tracker.isDragging()).toBe(true)
  })

  it('reports dragging while any active pointer has dragged', () => {
    tracker.pointerDown(1, 0, 0)
    tracker.pointerDown(2, 0, 0)
    tracker.pointerMove(2, 100, 0)

    expect(tracker.isDragging()).toBe(true)
  })

  it('makes a dragged click consumable exactly once after pointer up', () => {
    tracker.pointerDown(1, 0, 0)
    tracker.pointerMove(1, 100, 0)
    tracker.pointerUp(1)

    expect(tracker.consumeDraggedClick(1)).toBe(true)
    expect(tracker.consumeDraggedClick(1)).toBe(false)
  })

  it('does not create a consumable click when the pointer did not drag', () => {
    tracker.pointerDown(1, 0, 0)
    tracker.pointerMove(1, 2, 0)
    tracker.pointerUp(1)

    expect(tracker.consumeDraggedClick(1)).toBe(false)
  })

  it('stops reporting dragging once the pointer is released', () => {
    tracker.pointerDown(1, 0, 0)
    tracker.pointerMove(1, 100, 0)
    tracker.pointerUp(1)

    expect(tracker.isDragging()).toBe(false)
  })

  it('clears stale completed state when the same pointer id is pressed again', () => {
    tracker.pointerDown(1, 0, 0)
    tracker.pointerMove(1, 100, 0)
    tracker.pointerUp(1)

    tracker.pointerDown(1, 0, 0)

    expect(tracker.consumeDraggedClick(1)).toBe(false)
  })

  it('clears active and completed state on cancel', () => {
    tracker.pointerDown(1, 0, 0)
    tracker.pointerMove(1, 100, 0)
    tracker.pointerCancel(1)

    expect(tracker.isDragging()).toBe(false)
    expect(tracker.consumeDraggedClick(1)).toBe(false)
  })

  it('clears everything on reset', () => {
    tracker.pointerDown(1, 0, 0)
    tracker.pointerMove(1, 100, 0)
    tracker.pointerUp(1)
    tracker.pointerDown(2, 0, 0)
    tracker.pointerMove(2, 100, 0)

    tracker.reset()

    expect(tracker.isDragging()).toBe(false)
    expect(tracker.consumeDraggedClick(1)).toBe(false)
    expect(tracker.consumeDraggedClick(2)).toBe(false)
  })
})

describe('createPointerDragTracker gesture-safe consumption', () => {
  let tracker: ReturnType<typeof createPointerDragTracker>

  beforeEach(() => {
    tracker = createPointerDragTracker()
  })

  it('consumes a completed drag even when the click pointer id differs (touch)', () => {
    tracker.pointerDown(2, 0, 0)
    tracker.pointerMove(2, 100, 0)
    tracker.pointerUp(2)

    // A touch "click" often arrives with a different pointer id (e.g. 0).
    expect(tracker.consumeDraggedClick(0)).toBe(true)
    expect(tracker.consumeDraggedClick(0)).toBe(false)
  })

  it('prefers an exact pointer id match before falling back to the gesture', () => {
    tracker.pointerDown(2, 0, 0)
    tracker.pointerDown(3, 0, 0)
    tracker.pointerMove(2, 100, 0)
    tracker.pointerMove(3, 100, 0)
    tracker.pointerUp(2)
    tracker.pointerUp(3)

    // Exact id 3 is removed without touching id 2.
    expect(tracker.consumeDraggedClick(3)).toBe(true)
    // Fallback then consumes the remaining gesture completion (id 2).
    expect(tracker.consumeDraggedClick(99)).toBe(true)
    expect(tracker.consumeDraggedClick(99)).toBe(false)
  })

  it('starts a new gesture and clears stale completions when active is empty', () => {
    tracker.pointerDown(2, 0, 0)
    tracker.pointerMove(2, 100, 0)
    tracker.pointerUp(2)

    // A brand new gesture begins because no pointer is active.
    tracker.pointerDown(3, 0, 0)

    expect(tracker.consumeDraggedClick(2)).toBe(false)
    expect(tracker.consumeDraggedClick(99)).toBe(false)
  })

  it('keeps earlier completions when a later pointer joins the same gesture', () => {
    tracker.pointerDown(2, 0, 0)
    tracker.pointerDown(3, 0, 0)
    tracker.pointerMove(2, 100, 0)
    tracker.pointerUp(2)

    // A third finger joins while pointer 3 is still active: same gesture.
    tracker.pointerDown(4, 0, 0)

    expect(tracker.consumeDraggedClick(2)).toBe(true)
  })

  it('does not fall back to consume when the gesture never dragged', () => {
    tracker.pointerDown(2, 0, 0)
    tracker.pointerMove(2, 3, 0)
    tracker.pointerUp(2)

    expect(tracker.consumeDraggedClick(0)).toBe(false)
  })
})

describe('createPointerDragTracker pointerLostCapture', () => {
  let tracker: ReturnType<typeof createPointerDragTracker>

  beforeEach(() => {
    tracker = createPointerDragTracker()
  })

  it('keeps the completed drag through the real up -> lostpointercapture sequence', () => {
    // Chrome/OrbitControls fire pointerup, then lostpointercapture, then click.
    tracker.pointerDown(1, 100, 100)
    tracker.pointerMove(1, 110, 100)
    tracker.pointerUp(1)
    tracker.pointerLostCapture(1)

    expect(tracker.isDragging()).toBe(false)
    expect(tracker.consumeDraggedClick(1)).toBe(true)
  })

  it('generates a completed drag when capture is lost mid-drag without pointerup', () => {
    tracker.pointerDown(1, 0, 0)
    tracker.pointerMove(1, 100, 0)
    tracker.pointerLostCapture(1)

    expect(tracker.isDragging()).toBe(false)
    expect(tracker.consumeDraggedClick(1)).toBe(true)
  })

  it('does not suppress the click for a non-dragged up -> lostpointercapture', () => {
    tracker.pointerDown(1, 0, 0)
    tracker.pointerMove(1, 2, 0)
    tracker.pointerUp(1)
    tracker.pointerLostCapture(1)

    expect(tracker.consumeDraggedClick(1)).toBe(false)
  })

  it('does not resurrect a completion after cancel -> lostpointercapture', () => {
    tracker.pointerDown(1, 0, 0)
    tracker.pointerMove(1, 100, 0)
    tracker.pointerCancel(1)
    tracker.pointerLostCapture(1)

    expect(tracker.isDragging()).toBe(false)
    expect(tracker.consumeDraggedClick(1)).toBe(false)
  })

  it('is a no-op for an unknown pointer id', () => {
    tracker.pointerLostCapture(99)

    expect(tracker.consumeDraggedClick(99)).toBe(false)
  })
})

describe('cityPointerDragTracker', () => {
  it('is a shared tracker instance implementing the interface', () => {
    cityPointerDragTracker.reset()
    cityPointerDragTracker.pointerDown(1, 0, 0)
    cityPointerDragTracker.pointerMove(1, 100, 0)
    cityPointerDragTracker.pointerUp(1)

    expect(cityPointerDragTracker.consumeDraggedClick(1)).toBe(true)
    cityPointerDragTracker.reset()
  })
})
