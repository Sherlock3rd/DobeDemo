import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChestTick } from '../../game/chestTick'
import { BUILDING_IDS } from '../../game/cityTypes'
import { CITY_STORAGE_KEY, useCityStore } from '../../store/useCityStore'
import { cityCursorController } from './cityCursorController'
import { isPointerEventHandled } from './pointerDragClick'
import { cityPointerDragTracker } from './pointerDragTracker'

vi.mock('./BuildingVisual', () => ({
  BuildingVisual: ({ id }: { id: string }) => (
    <div data-testid="building-visual">{id}</div>
  ),
}))

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="html-overlay">{children}</div>
  ),
}))

const { InteractiveBuilding } = await import('./InteractiveBuilding')
const BASE_TIME = 1_700_000_000_000

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
    useCityStore.getState().reset(BASE_TIME)
    useCityStore.getState().claimBuilding('repair-shop', 1, BASE_TIME)
    useChestTick.setState({ now: BASE_TIME, tick: 0 })
    cityPointerDragTracker.reset()
    cityCursorController.reset()
    vi.restoreAllMocks()
  })

  it('selects the building on a normal click', () => {
    const { container } = renderBuilding()

    fireEvent.click(getHitbox(container))

    expect(useCityStore.getState().selectedBuildingId).toBe('repair-shop')
  })

  it('shows a takeover action for the initial repair shop before it can be selected', () => {
    useCityStore.getState().reset(BASE_TIME)
    const { container } = renderBuilding()

    fireEvent.click(getHitbox(container))
    expect(useCityStore.getState().selectedBuildingId).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '接管修车厂管理权' }))
    expect(useCityStore.getState().claimedBuildingIds).toEqual(['repair-shop'])
    expect(useCityStore.getState().selectedBuildingId).toBeNull()
  })

  it('shows the repair-shop handover after rehydrating a v6 legacy save', async () => {
    const city = useCityStore.getState()
    window.localStorage.setItem(
      CITY_STORAGE_KEY,
      JSON.stringify({
        version: 6,
        state: {
          buildingProgress: city.buildingProgress,
          resources: city.resources,
          lastResourceUpdatedAt: BASE_TIME,
          activeProducerIds: ['repair-shop'],
          claimedBuildingIds: BUILDING_IDS,
          pendingMainUpgrades: [],
          appliedStageRewardIds: [],
        },
      }),
    )

    await act(async () => {
      await useCityStore.persist.rehydrate()
    })

    expect(useCityStore.getState().claimedBuildingIds).toEqual([])
    renderBuilding()
    expect(
      screen.getByRole('button', { name: '接管修车厂管理权' }),
    ).toBeInTheDocument()
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

  it('shows the live main-building construction status above the building', () => {
    useCityStore.setState({
      pendingMainUpgrades: [
        {
          buildingId: 'repair-shop',
          targetLevel: 2,
          completesAt: BASE_TIME + 10_000,
        },
      ],
    })
    useChestTick.setState({ now: BASE_TIME + 5_000, tick: 1 })

    renderBuilding()

    const status = document.querySelector('[role="status"]')
    const progress = document.querySelector('[role="progressbar"]')
    expect(status).toHaveAttribute(
      'aria-label',
      '修车厂修建中，剩余5秒，进度50%',
    )
    expect(progress).toHaveAttribute('aria-valuenow', '50')
  })

  it('does not show a construction badge for an idle building', () => {
    renderBuilding()

    expect(document.querySelector('[role="status"]')).not.toBeInTheDocument()
  })
})
