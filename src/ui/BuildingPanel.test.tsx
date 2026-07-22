import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { buildingCatalogById } from '../game/buildingCatalog'
import type { BuildingDefinition, BuildingId } from '../game/cityTypes'
import {
  BUILDING_UNLOCKS,
  type BuildingUnlock,
  getTotalReputationForLevel,
} from '../game/gangProgression'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { BuildingPanel } from './BuildingPanel'

const BASE_TIME = 1_700_000_000_000

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

  it('shows the selected repair shop at level 1 and stays upgradable by default', async () => {
    const user = userEvent.setup()
    useCityStore.getState().selectBuilding('repair-shop')

    render(<BuildingPanel />)

    const title = screen.getByRole('heading', { name: '修车厂' })
    const panel = title.closest('section')
    expect(panel).toHaveClass('building-panel')
    expect(panel).toHaveAttribute('aria-labelledby', title.id)
    expect(screen.getByText('等级 1 / 3')).toBeInTheDocument()
    expect(screen.getByText('单跨维修棚和室外零件架')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '升级到 2 级' }))
    expect(screen.getByText('等级 2 / 3')).toBeInTheDocument()
  })

  it('shows the recycling yard as locked with no upgrade button below level 8', () => {
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
    expect(
      screen.queryByRole('button', { name: /升级到|已满级/ }),
    ).not.toBeInTheDocument()
  })

  it('shows the upgrade button for the recycling yard once level 8 is reached', async () => {
    const user = userEvent.setup()
    useGangStore.setState({ totalReputation: getTotalReputationForLevel(8) })
    useCityStore.getState().selectBuilding('recycling-yard')

    render(<BuildingPanel />)

    expect(screen.queryByText('尚未解锁')).not.toBeInTheDocument()
    expect(screen.getByText('等级 1 / 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '升级到 2 级' }))
    expect(screen.getByText('等级 2 / 3')).toBeInTheDocument()
  })

  it('updates to level 2 immediately after upgrading the unlocked gas station', async () => {
    const user = userEvent.setup()
    useGangStore.setState({ totalReputation: getTotalReputationForLevel(32) })
    useCityStore.getState().selectBuilding('gas-station')
    render(<BuildingPanel />)

    await user.click(screen.getByRole('button', { name: '升级到 2 级' }))

    expect(screen.getByText('等级 2 / 3')).toBeInTheDocument()
    expect(screen.getByText('四泵岛配便利店和价格立柱')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '升级到 3 级' }),
    ).toHaveTextContent('升级到 3 级')
  })

  it('disables the upgrade button at level 3 for the unlocked gas station', async () => {
    const user = userEvent.setup()
    useGangStore.setState({ totalReputation: getTotalReputationForLevel(32) })
    useCityStore.getState().selectBuilding('gas-station')
    render(<BuildingPanel />)

    await user.click(screen.getByRole('button', { name: '升级到 2 级' }))
    await user.click(screen.getByRole('button', { name: '升级到 3 级' }))

    expect(screen.getByText('等级 3 / 3')).toBeInTheDocument()
    expect(screen.getByText('重型车辆加注区配高耸储油标识')).toBeInTheDocument()
    const maxLevelButton = screen.getByRole('button', { name: '已满级' })
    expect(maxLevelButton).toHaveTextContent('已满级')
    expect(maxLevelButton).toBeDisabled()
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

  it('keeps upgrade and close interactions from reaching a parent scene', async () => {
    const user = userEvent.setup()
    const onParentPointerDown = vi.fn()
    const onParentClick = vi.fn()
    useCityStore.getState().selectBuilding('repair-shop')
    render(
      <div onPointerDown={onParentPointerDown} onClick={onParentClick}>
        <BuildingPanel />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: '升级到 2 级' }))
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
