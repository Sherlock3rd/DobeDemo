import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCityStore } from '../../store/useCityStore'
import { cityCursorController } from './cityCursorController'
import { isPointerEventHandled } from './pointerDragClick'
import { cityPointerDragTracker } from './pointerDragTracker'

vi.mock('./BuildingVisual', () => ({
  BuildingVisual: ({ id }: { id: string }) => (
    <div data-testid="building-visual">{id}</div>
  ),
}))

const { InteractiveBuilding } = await import('./InteractiveBuilding')

function renderBuilding() {
  return render(<InteractiveBuilding id="repair-shop" position={[0, 0, 0]} />)
}

function getHitbox(container: HTMLElement): Element {
  const meshes = container.querySelectorAll('mesh')
  const hitbox = meshes[meshes.length - 1]

  if (!hitbox) {
    throw new Error('hitbox mesh not found')
  }

  return hitbox
}

describe('InteractiveBuilding', () => {
  beforeEach(() => {
    useCityStore.getState().reset()
    cityPointerDragTracker.reset()
    cityCursorController.reset()
    vi.restoreAllMocks()
  })

  it('selects the building on a normal click', () => {
    const { container } = renderBuilding()

    fireEvent.click(getHitbox(container))

    expect(useCityStore.getState().selectedBuildingId).toBe('repair-shop')
  })

  it('suppresses selection when the click follows a drag for that pointer', () => {
    cityPointerDragTracker.pointerDown(1, 0, 0)
    cityPointerDragTracker.pointerMove(1, 100, 0)
    cityPointerDragTracker.pointerUp(1)

    const { container } = renderBuilding()

    fireEvent.click(getHitbox(container))

    expect(useCityStore.getState().selectedBuildingId).toBeNull()
  })

  it('stops click propagation to avoid triggering background clears', () => {
    const { container } = renderBuilding()
    const clickEvent = new MouseEvent('click', { bubbles: true })
    const stopSpy = vi.spyOn(clickEvent, 'stopPropagation')

    getHitbox(container).dispatchEvent(clickEvent)

    expect(stopSpy).toHaveBeenCalled()
  })

  it('marks the native event as handled on a normal click', () => {
    const { container } = renderBuilding()
    const clickEvent = new MouseEvent('click', { bubbles: true })

    getHitbox(container).dispatchEvent(clickEvent)

    expect(isPointerEventHandled(clickEvent)).toBe(true)
    expect(useCityStore.getState().selectedBuildingId).toBe('repair-shop')
  })

  it('marks the native event as handled even when suppressed as a drag', () => {
    cityPointerDragTracker.pointerDown(1, 0, 0)
    cityPointerDragTracker.pointerMove(1, 100, 0)
    cityPointerDragTracker.pointerUp(1)

    const { container } = renderBuilding()
    const clickEvent = new MouseEvent('click', { bubbles: true })

    getHitbox(container).dispatchEvent(clickEvent)

    expect(isPointerEventHandled(clickEvent)).toBe(true)
    expect(useCityStore.getState().selectedBuildingId).toBeNull()
  })

  it('drives the cursor controller hover state on pointer over and out', () => {
    const hoverSpy = vi.spyOn(cityCursorController, 'setBuildingHovered')
    const { container } = renderBuilding()
    const hitbox = getHitbox(container)

    fireEvent.pointerOver(hitbox)
    expect(hoverSpy).toHaveBeenCalledWith('repair-shop', true)

    fireEvent.pointerOut(hitbox)
    expect(hoverSpy).toHaveBeenCalledWith('repair-shop', false)
  })

  it('releases hover ownership when unmounted', () => {
    const hoverSpy = vi.spyOn(cityCursorController, 'setBuildingHovered')
    const { container, unmount } = renderBuilding()

    fireEvent.pointerOver(getHitbox(container))
    hoverSpy.mockClear()

    unmount()

    expect(hoverSpy).toHaveBeenCalledWith('repair-shop', false)
  })
})
