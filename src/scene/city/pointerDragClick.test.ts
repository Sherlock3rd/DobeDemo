import { beforeEach, describe, expect, it } from 'vitest'
import {
  FALLBACK_MOUSE_POINTER_ID,
  consumePointerDrag,
  getPointerId,
  isPointerEventHandled,
  markPointerEventHandled,
} from './pointerDragClick'
import { cityPointerDragTracker } from './pointerDragTracker'

describe('getPointerId', () => {
  it('reads a finite pointerId from the native event', () => {
    expect(getPointerId({ pointerId: 7 })).toBe(7)
  })

  it('falls back to the mouse pointer id when pointerId is missing', () => {
    expect(getPointerId({})).toBe(FALLBACK_MOUSE_POINTER_ID)
    expect(FALLBACK_MOUSE_POINTER_ID).toBe(1)
  })

  it('falls back when pointerId is not a finite number', () => {
    expect(getPointerId({ pointerId: Number.NaN })).toBe(
      FALLBACK_MOUSE_POINTER_ID,
    )
    expect(getPointerId({ pointerId: 'a' })).toBe(FALLBACK_MOUSE_POINTER_ID)
  })

  it('falls back for null or non-object native events', () => {
    expect(getPointerId(null)).toBe(FALLBACK_MOUSE_POINTER_ID)
    expect(getPointerId(undefined)).toBe(FALLBACK_MOUSE_POINTER_ID)
    expect(getPointerId(42)).toBe(FALLBACK_MOUSE_POINTER_ID)
  })
})

describe('consumePointerDrag', () => {
  beforeEach(() => {
    cityPointerDragTracker.reset()
  })

  it('consumes a completed drag for the event pointer id', () => {
    cityPointerDragTracker.pointerDown(7, 0, 0)
    cityPointerDragTracker.pointerMove(7, 100, 0)
    cityPointerDragTracker.pointerUp(7)

    expect(consumePointerDrag({ pointerId: 7 })).toBe(true)
    expect(consumePointerDrag({ pointerId: 7 })).toBe(false)
  })

  it('uses the fallback pointer id when the native event lacks one', () => {
    cityPointerDragTracker.pointerDown(1, 0, 0)
    cityPointerDragTracker.pointerMove(1, 100, 0)
    cityPointerDragTracker.pointerUp(1)

    expect(consumePointerDrag({})).toBe(true)
  })

  it('returns false when there is no completed drag', () => {
    expect(consumePointerDrag({ pointerId: 3 })).toBe(false)
  })
})

describe('native-event handled marker', () => {
  it('reports an unmarked event as not handled', () => {
    expect(isPointerEventHandled(new MouseEvent('click'))).toBe(false)
  })

  it('marks an event as handled and reports it afterwards', () => {
    const event = new MouseEvent('click')

    markPointerEventHandled(event)

    expect(isPointerEventHandled(event)).toBe(true)
  })

  it('keeps distinct events independent', () => {
    const handled = new MouseEvent('click')
    const other = new MouseEvent('click')

    markPointerEventHandled(handled)

    expect(isPointerEventHandled(handled)).toBe(true)
    expect(isPointerEventHandled(other)).toBe(false)
  })

  it('ignores non-object native events without throwing', () => {
    expect(() => markPointerEventHandled(null)).not.toThrow()
    expect(() => markPointerEventHandled(undefined)).not.toThrow()
    expect(() => markPointerEventHandled(42)).not.toThrow()
    expect(isPointerEventHandled(null)).toBe(false)
    expect(isPointerEventHandled(7)).toBe(false)
  })
})
