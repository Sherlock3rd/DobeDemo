import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cityCursorController } from './cityCursorController'
import { cityPointerDragTracker } from './pointerDragTracker'

const canvasRef = vi.hoisted(() => ({
  current: null as HTMLElement | null,
}))

vi.mock('@react-three/fiber', () => ({
  useThree: (
    selector: (state: { gl: { domElement: HTMLElement } }) => unknown,
  ) => selector({ gl: { domElement: canvasRef.current as HTMLElement } }),
}))

const { CityPointerGestures } = await import('./CityPointerGestures')

const POINTER_EVENT_TYPES = [
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'lostpointercapture',
] as const

function dispatchPointerEvent(
  target: HTMLElement,
  type: string,
  detail: { pointerId: number; clientX: number; clientY: number },
): void {
  const event = new Event(type, { bubbles: true })
  Object.assign(event, detail)
  target.dispatchEvent(event)
}

describe('CityPointerGestures', () => {
  let canvas: HTMLElement

  beforeEach(() => {
    canvas = document.createElement('div')
    document.body.appendChild(canvas)
    canvasRef.current = canvas
    cityPointerDragTracker.reset()
    cityCursorController.reset()
  })

  it('renders nothing and registers the canvas with the grab cursor', () => {
    const { container } = render(<CityPointerGestures />)

    expect(container).toBeEmptyDOMElement()
    expect(canvas.style.cursor).toBe('grab')
  })

  it('turns a 7px move into a drag and shows the grabbing cursor', () => {
    render(<CityPointerGestures />)

    dispatchPointerEvent(canvas, 'pointerdown', {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    })
    dispatchPointerEvent(canvas, 'pointermove', {
      pointerId: 1,
      clientX: 107,
      clientY: 100,
    })

    expect(cityPointerDragTracker.isDragging()).toBe(true)
    expect(canvas.style.cursor).toBe('grabbing')
  })

  it('stops dragging on pointer up but leaves a consumable dragged click', () => {
    render(<CityPointerGestures />)

    dispatchPointerEvent(canvas, 'pointerdown', {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    })
    dispatchPointerEvent(canvas, 'pointermove', {
      pointerId: 1,
      clientX: 120,
      clientY: 100,
    })
    dispatchPointerEvent(canvas, 'pointerup', {
      pointerId: 1,
      clientX: 120,
      clientY: 100,
    })

    expect(cityPointerDragTracker.isDragging()).toBe(false)
    expect(canvas.style.cursor).toBe('grab')
    expect(cityPointerDragTracker.consumeDraggedClick(1)).toBe(true)
  })

  it('clears the drag state on pointer cancel', () => {
    render(<CityPointerGestures />)

    dispatchPointerEvent(canvas, 'pointerdown', {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    })
    dispatchPointerEvent(canvas, 'pointermove', {
      pointerId: 1,
      clientX: 120,
      clientY: 100,
    })
    dispatchPointerEvent(canvas, 'pointercancel', {
      pointerId: 1,
      clientX: 120,
      clientY: 100,
    })

    expect(cityPointerDragTracker.isDragging()).toBe(false)
    expect(canvas.style.cursor).toBe('grab')
    expect(cityPointerDragTracker.consumeDraggedClick(1)).toBe(false)
  })

  it('keeps a consumable dragged click through the up -> lostpointercapture sequence', () => {
    render(<CityPointerGestures />)

    // The real Chrome/OrbitControls order: pointerup, then lostpointercapture.
    dispatchPointerEvent(canvas, 'pointerdown', {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    })
    dispatchPointerEvent(canvas, 'pointermove', {
      pointerId: 1,
      clientX: 120,
      clientY: 100,
    })
    dispatchPointerEvent(canvas, 'pointerup', {
      pointerId: 1,
      clientX: 120,
      clientY: 100,
    })
    dispatchPointerEvent(canvas, 'lostpointercapture', {
      pointerId: 1,
      clientX: 120,
      clientY: 100,
    })

    expect(cityPointerDragTracker.isDragging()).toBe(false)
    expect(canvas.style.cursor).toBe('grab')
    expect(cityPointerDragTracker.consumeDraggedClick(1)).toBe(true)
  })

  it('does not suppress the click when a non-dragged pointer loses capture', () => {
    render(<CityPointerGestures />)

    dispatchPointerEvent(canvas, 'pointerdown', {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    })
    dispatchPointerEvent(canvas, 'pointerup', {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    })
    dispatchPointerEvent(canvas, 'lostpointercapture', {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    })

    expect(cityPointerDragTracker.isDragging()).toBe(false)
    expect(canvas.style.cursor).toBe('grab')
    expect(cityPointerDragTracker.consumeDraggedClick(1)).toBe(false)
  })

  it('removes every listener it added and resets shared state on unmount', () => {
    const addSpy = vi.spyOn(canvas, 'addEventListener')
    const removeSpy = vi.spyOn(canvas, 'removeEventListener')

    const { unmount } = render(<CityPointerGestures />)

    const added = new Map<string, EventListenerOrEventListenerObject>()
    for (const [type, handler] of addSpy.mock.calls) {
      if (
        POINTER_EVENT_TYPES.includes(
          type as (typeof POINTER_EVENT_TYPES)[number],
        )
      ) {
        added.set(type, handler as EventListenerOrEventListenerObject)
      }
    }

    expect(added.size).toBe(POINTER_EVENT_TYPES.length)

    dispatchPointerEvent(canvas, 'pointerdown', {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    })
    dispatchPointerEvent(canvas, 'pointermove', {
      pointerId: 1,
      clientX: 130,
      clientY: 100,
    })

    unmount()

    for (const type of POINTER_EVENT_TYPES) {
      expect(removeSpy).toHaveBeenCalledWith(type, added.get(type))
    }

    expect(cityPointerDragTracker.isDragging()).toBe(false)
    expect(cityPointerDragTracker.consumeDraggedClick(1)).toBe(false)
    expect(canvas.style.cursor).toBe('')
  })
})
