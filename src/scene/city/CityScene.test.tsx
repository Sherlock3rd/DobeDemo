import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCityStore } from '../../store/useCityStore'
import { markPointerEventHandled } from './pointerDragClick'
import { cityPointerDragTracker } from './pointerDragTracker'

vi.mock('./CityCameraControls', () => ({
  CityCameraControls: () => <div data-testid="camera-controls" />,
}))

vi.mock('./CityEnvironment', () => ({
  CityEnvironment: () => <div data-testid="city-environment" />,
}))

vi.mock('./CityGround', () => ({
  CityGround: () => <div data-testid="city-ground" />,
}))

vi.mock('./InteractiveBuilding', () => ({
  InteractiveBuilding: ({ id }: { id: string }) => (
    <div data-testid="interactive-building">{id}</div>
  ),
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

describe('CityScene', () => {
  beforeEach(() => {
    useCityStore.getState().reset()
    cityPointerDragTracker.reset()
  })

  it('mounts the pointer gesture listener component', () => {
    render(<CityScene />)

    expect(screen.getByTestId('city-pointer-gestures')).toBeInTheDocument()
  })

  it('clears the selection on a normal background click', () => {
    useCityStore.getState().selectBuilding('repair-shop')

    const { container } = render(<CityScene />)

    fireEvent.click(getBackgroundGroup(container))

    expect(useCityStore.getState().selectedBuildingId).toBeNull()
  })

  it('keeps the selection when the background click follows a drag', () => {
    useCityStore.getState().selectBuilding('repair-shop')
    cityPointerDragTracker.pointerDown(1, 0, 0)
    cityPointerDragTracker.pointerMove(1, 100, 0)
    cityPointerDragTracker.pointerUp(1)

    const { container } = render(<CityScene />)

    fireEvent.click(getBackgroundGroup(container))

    expect(useCityStore.getState().selectedBuildingId).toBe('repair-shop')
  })

  it('does not clear when the native click was already handled by a building', () => {
    useCityStore.getState().selectBuilding('repair-shop')

    const { container } = render(<CityScene />)
    const clickEvent = new MouseEvent('click', { bubbles: true })
    markPointerEventHandled(clickEvent)

    getBackgroundGroup(container).dispatchEvent(clickEvent)

    expect(useCityStore.getState().selectedBuildingId).toBe('repair-shop')
  })
})
