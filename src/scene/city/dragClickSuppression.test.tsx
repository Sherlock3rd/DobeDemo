import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCityStore } from '../../store/useCityStore'
import { cityCursorController } from './cityCursorController'
import { cityPointerDragTracker } from './pointerDragTracker'

vi.mock('./BuildingVisual', () => ({
  BuildingVisual: ({ id }: { id: string }) => (
    <div data-testid="building-visual">{id}</div>
  ),
}))

vi.mock('./CityCameraControls', () => ({
  CityCameraControls: () => <div data-testid="camera-controls" />,
}))

vi.mock('./CityEnvironment', () => ({
  CityEnvironment: () => <div data-testid="city-environment" />,
}))

vi.mock('./CityGround', () => ({
  CityGround: () => <div data-testid="city-ground" />,
}))

vi.mock('./CityPointerGestures', () => ({
  CityPointerGestures: () => <div data-testid="city-pointer-gestures" />,
}))

const { CityScene } = await import('./CityScene')

function getBackgroundGroup(container: HTMLElement): Element {
  const group = container.querySelector('group')

  if (!group) {
    throw new Error('background group not found')
  }

  return group
}

function getFirstBuildingHitbox(container: HTMLElement): Element {
  const hitbox = container.querySelector('mesh')

  if (!hitbox) {
    throw new Error('building hitbox not found')
  }

  return hitbox
}

describe('drag/click suppression across building and background', () => {
  beforeEach(() => {
    useCityStore.getState().reset()
    cityPointerDragTracker.reset()
    cityCursorController.reset()
  })

  it('does not let the background clear a normal building selection using the same native event', () => {
    const { container } = render(<CityScene />)
    const clickEvent = new MouseEvent('click', { bubbles: true })

    getFirstBuildingHitbox(container).dispatchEvent(clickEvent)
    const selectedAfterBuilding = useCityStore.getState().selectedBuildingId
    expect(selectedAfterBuilding).not.toBeNull()

    getBackgroundGroup(container).dispatchEvent(clickEvent)

    expect(useCityStore.getState().selectedBuildingId).toBe(
      selectedAfterBuilding,
    )
  })

  it('does not let the background clear when the same native event was a drag', () => {
    useCityStore.getState().selectBuilding('repair-shop')
    cityPointerDragTracker.pointerDown(1, 0, 0)
    cityPointerDragTracker.pointerMove(1, 100, 0)
    cityPointerDragTracker.pointerUp(1)

    const { container } = render(<CityScene />)
    const clickEvent = new MouseEvent('click', { bubbles: true })

    getFirstBuildingHitbox(container).dispatchEvent(clickEvent)
    getBackgroundGroup(container).dispatchEvent(clickEvent)

    expect(useCityStore.getState().selectedBuildingId).toBe('repair-shop')
  })
})
