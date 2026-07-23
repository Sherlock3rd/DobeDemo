import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildingCatalogById } from '../game/buildingCatalog'
import type { BuildingDefinition, BuildingId } from '../game/cityTypes'
import {
  BUILDING_UNLOCKS,
  type BuildingUnlock,
  getTotalReputationForLevel,
} from '../game/gangProgression'
import { getBuildingFragments } from '../scene/city/buildingFragmentCatalog'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { BuildingPanel } from './BuildingPanel'

const BASE_TIME = 1_700_000_000_000

function setBuildingProgress(
  id: BuildingId,
  level: number,
  completedFragments = 0,
): void {
  useCityStore.setState((state) => ({
    buildingProgress: {
      ...state.buildingProgress,
      [id]: {
        level: level as (typeof state.buildingProgress)[BuildingId]['level'],
        completedFragments,
      },
    },
  }))
}

describe('BuildingPanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset()
    useGangStore.getState().reset(BASE_TIME)
  })

  it('does not render without a selected building', () => {
    const { container } = render(<BuildingPanel />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows the repair shop Setup workbench at level 1 with a 0/2 progress bar', () => {
    useCityStore.getState().selectBuilding('repair-shop')

    render(<BuildingPanel />)

    const title = screen.getByRole('heading', { name: '修车厂' })
    const panel = title.closest('section')
    expect(panel).toHaveClass('building-panel')
    expect(panel).toHaveAttribute('aria-labelledby', title.id)

    expect(screen.getByText('等级 1 / 10')).toBeInTheDocument()
    expect(screen.getByText('升级至 Lv.2')).toBeInTheDocument()

    const progressbar = screen.getByRole('progressbar', {
      name: '修车厂升级进度',
    })
    expect(progressbar).toHaveAttribute('aria-valuenow', '0')
    expect(progressbar).toHaveAttribute('aria-valuemin', '0')
    expect(progressbar).toHaveAttribute('aria-valuemax', '2')
    expect(screen.getByText('0 / 2 个子建筑')).toBeInTheDocument()

    const fragments = getBuildingFragments('repair')
    expect(screen.getByText(fragments[0].name)).toBeInTheDocument()
    expect(screen.getByText(fragments[0].description)).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: '升级子建筑 1/2' }),
    ).toBeInTheDocument()
  })

  it('marks fragment cells as done, current and pending', async () => {
    const user = userEvent.setup()
    useCityStore.getState().selectBuilding('repair-shop')

    const { container } = render(<BuildingPanel />)

    const cellsBefore = container.querySelectorAll('.building-panel__fragment')
    expect(cellsBefore).toHaveLength(2)
    expect(cellsBefore[0]).toHaveAttribute('data-state', 'current')
    expect(cellsBefore[1]).toHaveAttribute('data-state', 'pending')

    await user.click(screen.getByRole('button', { name: '升级子建筑 1/2' }))

    const cellsAfter = container.querySelectorAll('.building-panel__fragment')
    expect(cellsAfter[0]).toHaveAttribute('data-state', 'done')
    expect(cellsAfter[1]).toHaveAttribute('data-state', 'current')
  })

  it('flags only the most recently completed fragment cell as latest', async () => {
    const user = userEvent.setup()
    useCityStore.getState().selectBuilding('repair-shop')

    const { container } = render(<BuildingPanel />)

    // No fragment completed yet: nothing is the latest.
    expect(
      container.querySelectorAll('.building-panel__fragment--latest'),
    ).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: '升级子建筑 1/2' }))
    const afterFirst = container.querySelectorAll(
      '.building-panel__fragment--latest',
    )
    expect(afterFirst).toHaveLength(1)
    const cellsAfterFirst = container.querySelectorAll(
      '.building-panel__fragment',
    )
    expect(cellsAfterFirst[0]).toHaveClass('building-panel__fragment--latest')
    expect(cellsAfterFirst[1]).not.toHaveClass(
      'building-panel__fragment--latest',
    )

    await user.click(screen.getByRole('button', { name: '升级子建筑 2/2' }))
    const afterSecond = container.querySelectorAll(
      '.building-panel__fragment--latest',
    )
    expect(afterSecond).toHaveLength(1)
    const cellsAfterSecond = container.querySelectorAll(
      '.building-panel__fragment',
    )
    expect(cellsAfterSecond[1]).toHaveClass('building-panel__fragment--latest')
    expect(cellsAfterSecond[0]).not.toHaveClass(
      'building-panel__fragment--latest',
    )
  })

  it('only completes one fragment per press and reaches confirmation without leveling up', async () => {
    const user = userEvent.setup()
    useCityStore.getState().selectBuilding('repair-shop')

    render(<BuildingPanel />)

    await user.click(screen.getByRole('button', { name: '升级子建筑 1/2' }))
    expect(screen.getByText('1 / 2 个子建筑')).toBeInTheDocument()
    expect(screen.getByText('等级 1 / 10')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '升级子建筑 2/2' }))

    // Ready to confirm, but the main level has not advanced yet.
    expect(screen.getByText('等级 1 / 10')).toBeInTheDocument()
    expect(screen.getByText('2 / 2 个子建筑')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '完成 Lv.2 升级' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /升级子建筑/ }),
    ).not.toBeInTheDocument()
    expect(useCityStore.getState().buildingProgress['repair-shop']).toEqual({
      level: 1,
      completedFragments: 2,
    })
  })

  it('confirms the level up and resets the fragment progress to 0/3', async () => {
    const user = userEvent.setup()
    useCityStore.getState().selectBuilding('repair-shop')

    render(<BuildingPanel />)

    await user.click(screen.getByRole('button', { name: '升级子建筑 1/2' }))
    await user.click(screen.getByRole('button', { name: '升级子建筑 2/2' }))
    await user.click(screen.getByRole('button', { name: '完成 Lv.2 升级' }))

    expect(screen.getByText('等级 2 / 10')).toBeInTheDocument()
    expect(screen.getByText('升级至 Lv.3')).toBeInTheDocument()
    expect(screen.getByText('0 / 3 个子建筑')).toBeInTheDocument()
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuemax', '3')
    expect(useCityStore.getState().buildingProgress['repair-shop']).toEqual({
      level: 2,
      completedFragments: 0,
    })
  })

  it('shows the level 9 to 10 upgrade needing ten fragment presses then confirmation', async () => {
    const user = userEvent.setup()
    setBuildingProgress('repair-shop', 9, 0)
    useCityStore.getState().selectBuilding('repair-shop')

    render(<BuildingPanel />)

    expect(screen.getByText('等级 9 / 10')).toBeInTheDocument()
    expect(screen.getByText('升级至 Lv.10')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuemax',
      '10',
    )

    for (let pressed = 1; pressed <= 10; pressed += 1) {
      await user.click(
        screen.getByRole('button', { name: `升级子建筑 ${pressed}/10` }),
      )
    }

    expect(screen.getByText('10 / 10 个子建筑')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '完成 Lv.10 升级' }))

    expect(screen.getByText('等级 10 / 10')).toBeInTheDocument()
    const maxedButton = screen.getByRole('button', {
      name: '已满级 · 10 个子建筑',
    })
    expect(maxedButton).toBeDisabled()
    expect(useCityStore.getState().buildingProgress['repair-shop']).toEqual({
      level: 10,
      completedFragments: 0,
    })
  })

  it('shows a disabled maxed state for a level 10 building', () => {
    setBuildingProgress('repair-shop', 10, 0)
    useCityStore.getState().selectBuilding('repair-shop')

    render(<BuildingPanel />)

    expect(screen.getByText('等级 10 / 10')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /升级子建筑|完成 Lv/ }),
    ).not.toBeInTheDocument()
    const maxedButton = screen.getByRole('button', {
      name: '已满级 · 10 个子建筑',
    })
    expect(maxedButton).toBeDisabled()
  })

  it('shows the recycling yard as locked with no fragment controls below level 8', () => {
    useCityStore.getState().selectBuilding('recycling-yard')

    render(<BuildingPanel />)

    expect(
      screen.getByRole('heading', { name: '废车回收厂' }),
    ).toBeInTheDocument()
    expect(screen.getByText('尚未解锁')).toBeInTheDocument()
    expect(
      screen.getByText('需要 Lv. 8 · Full Patch（正式成员）'),
    ).toBeInTheDocument()
    expect(screen.getByText('当前 Lv. 1 / 8')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /升级子建筑|完成 Lv|已满级/ }),
    ).not.toBeInTheDocument()
  })

  it('reveals the Setup workbench for the recycling yard once level 8 is reached', () => {
    useGangStore.setState({ totalReputation: getTotalReputationForLevel(8) })
    useCityStore.getState().selectBuilding('recycling-yard')

    render(<BuildingPanel />)

    expect(screen.queryByText('尚未解锁')).not.toBeInTheDocument()
    expect(screen.getByText('等级 1 / 10')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '升级子建筑 1/2' }),
    ).toBeInTheDocument()
  })

  it('clears the selection from the close button', async () => {
    const user = userEvent.setup()
    useCityStore.getState().selectBuilding('repair-shop')
    render(<BuildingPanel />)

    await user.click(screen.getByRole('button', { name: '关闭建筑面板' }))

    expect(useCityStore.getState().selectedBuildingId).toBeNull()
    expect(
      screen.queryByRole('heading', { name: '修车厂' }),
    ).not.toBeInTheDocument()
  })

  it('keeps fragment and close interactions from reaching a parent scene', async () => {
    const user = userEvent.setup()
    const onParentPointerDown = vi.fn()
    const onParentClick = vi.fn()
    useCityStore.getState().selectBuilding('repair-shop')
    render(
      <div onPointerDown={onParentPointerDown} onClick={onParentClick}>
        <BuildingPanel />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: '升级子建筑 1/2' }))
    await user.click(screen.getByRole('button', { name: '关闭建筑面板' }))

    expect(onParentPointerDown).not.toHaveBeenCalled()
    expect(onParentClick).not.toHaveBeenCalled()
  })

  it('keeps a locked panel from reaching a parent scene either', async () => {
    const user = userEvent.setup()
    const onParentPointerDown = vi.fn()
    const onParentClick = vi.fn()
    useCityStore.getState().selectBuilding('recycling-yard')
    render(
      <div onPointerDown={onParentPointerDown} onClick={onParentClick}>
        <BuildingPanel />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: '关闭建筑面板' }))

    expect(onParentPointerDown).not.toHaveBeenCalled()
    expect(onParentClick).not.toHaveBeenCalled()
  })

  it('lists the target sub-buildings inside the confirmation card', async () => {
    const user = userEvent.setup()
    useCityStore.getState().selectBuilding('repair-shop')

    render(<BuildingPanel />)

    await user.click(screen.getByRole('button', { name: '升级子建筑 1/2' }))
    await user.click(screen.getByRole('button', { name: '升级子建筑 2/2' }))

    const confirmCard = screen
      .getByRole('button', { name: '完成 Lv.2 升级' })
      .closest('.building-panel__confirm')
    expect(confirmCard).not.toBeNull()
    const fragments = getBuildingFragments('repair')
    const scoped = within(confirmCard as HTMLElement)
    expect(scoped.getByText('Lv.1 → Lv.2')).toBeInTheDocument()
    expect(scoped.getByText(fragments[0].name)).toBeInTheDocument()
    expect(scoped.getByText(fragments[1].name)).toBeInTheDocument()
  })

  it('renders nothing when the selected building is missing from the catalog', () => {
    const mutableCatalog = buildingCatalogById as Partial<
      Record<BuildingId, BuildingDefinition>
    >
    const gasStation = mutableCatalog['gas-station']
    delete mutableCatalog['gas-station']
    useCityStore.getState().selectBuilding('gas-station')

    try {
      const { container } = render(<BuildingPanel />)
      expect(container).toBeEmptyDOMElement()
    } finally {
      mutableCatalog['gas-station'] = gasStation
    }
  })

  it('renders nothing when a building has no unlock configuration', () => {
    const mutableUnlocks = BUILDING_UNLOCKS as BuildingUnlock[]
    const removed = mutableUnlocks.splice(0, 1)
    useCityStore.getState().selectBuilding('repair-shop')

    try {
      const { container } = render(<BuildingPanel />)
      expect(container).toBeEmptyDOMElement()
    } finally {
      mutableUnlocks.splice(0, 0, ...removed)
    }
  })
})
