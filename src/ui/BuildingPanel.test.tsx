import { act, render, screen, within } from '@testing-library/react'
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

const repairFragments = getBuildingFragments('repair')

function setResources(money: number, oil = 0, materials = 0): void {
  useCityStore.setState({ resources: { money, oil, materials } })
}

function setProgress(
  id: BuildingId,
  level: number,
  childLevels: number[],
): void {
  useCityStore.setState((state) => ({
    buildingProgress: {
      ...state.buildingProgress,
      [id]: {
        level: level as (typeof state.buildingProgress)[BuildingId]['level'],
        childLevels:
          childLevels as (typeof state.buildingProgress)[BuildingId]['childLevels'],
      },
    },
  }))
}

describe('BuildingPanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    // Anchor production to "now" so a click's settlement earns zero ticks and
    // resource assertions reflect only the upgrade charge.
    useCityStore.getState().reset(Date.now())
    setResources(0)
    useGangStore.getState().reset(BASE_TIME)
  })

  it('does not render without a selected building', () => {
    const { container } = render(<BuildingPanel />)

    expect(container).toBeEmptyDOMElement()
  })

  // Step 1: the repair shop free-choice workbench with five child cards.
  it('shows five free-choice child cards for the repair shop', () => {
    useCityStore.getState().selectBuilding('repair-shop')
    setResources(5)

    const { container } = render(<BuildingPanel />)

    const title = screen.getByRole('heading', { name: '修车厂' })
    const panel = title.closest('section')
    expect(panel).toHaveClass('building-panel')
    expect(panel).toHaveAttribute('aria-labelledby', title.id)

    expect(screen.getByText('等级 1 / 5')).toBeInTheDocument()

    const cards = container.querySelectorAll('.building-panel__child-card')
    expect(cards).toHaveLength(5)
    expect(screen.getAllByText('未建设 · Lv.0 / 1')).toHaveLength(5)
    expect(screen.getAllByText('钱 5').length).toBeGreaterThanOrEqual(5)

    // Legacy fixed-order UI must be gone.
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /升级子建筑/ }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/completedFragments/)).not.toBeInTheDocument()
  })

  // Step 2: the legacy panel can still upgrade a currently unlocked child.
  it('upgrades the first child and charges its cost atomically', async () => {
    const user = userEvent.setup()
    useCityStore.getState().selectBuilding('repair-shop')
    setResources(5)

    render(<BuildingPanel />)

    const firstName = repairFragments[0].name
    await user.click(
      screen.getByRole('button', { name: `升级 ${firstName} 至 Lv.1` }),
    )

    expect(useCityStore.getState().buildingProgress['repair-shop']).toEqual({
      level: 1,
      childLevels: [1, 0, 0, 0, 0],
    })
    expect(useCityStore.getState().resources.money).toBe(0)
  })

  it('disables an unaffordable child with a shortfall hint, then enables it once funded', async () => {
    const user = userEvent.setup()
    useCityStore.getState().selectBuilding('repair-shop')
    // Wallet is empty right after reset, so every child is unaffordable.

    render(<BuildingPanel />)

    const firstName = repairFragments[0].name
    expect(
      screen.getAllByText('资源不足，还需 钱 5').length,
    ).toBeGreaterThanOrEqual(1)
    // Full next-level cost stays visible on every card.
    expect(screen.getAllByText('钱 5').length).toBeGreaterThanOrEqual(5)

    const blockedButton = screen.getByRole('button', {
      name: `资源不足，无法升级 ${firstName} 至 Lv.1`,
    })
    expect(blockedButton).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: `升级 ${firstName} 至 Lv.1` }),
    ).not.toBeInTheDocument()

    act(() => {
      useCityStore.setState({ resources: { money: 5, oil: 0, materials: 0 } })
    })

    const enabledButton = screen.getByRole('button', {
      name: `升级 ${firstName} 至 Lv.1`,
    })
    expect(enabledButton).toBeEnabled()
    await user.click(enabledButton)

    expect(
      useCityStore.getState().buildingProgress['repair-shop'].childLevels[0],
    ).toBe(1)
    expect(useCityStore.getState().resources.money).toBe(0)
  })

  it('disables a child that has caught up to the main building', () => {
    useCityStore.getState().selectBuilding('repair-shop')
    setProgress('repair-shop', 1, [1, 0, 0, 0, 0])

    render(<BuildingPanel />)

    const firstName = repairFragments[0].name
    expect(
      screen.queryByRole('button', { name: `升级 ${firstName} 至 Lv.1` }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('已追平主建筑')).toBeInTheDocument()
  })

  it('shows the current building output and the three resource balances', () => {
    useCityStore.getState().selectBuilding('repair-shop')
    setResources(12, 3, 7)

    render(<BuildingPanel />)

    const summary = document.querySelector('.building-panel__economy-summary')
    expect(summary).not.toBeNull()
    const scoped = within(summary as HTMLElement)
    expect(scoped.getByText('钱 12')).toBeInTheDocument()
    expect(scoped.getByText('油 3')).toBeInTheDocument()
    expect(scoped.getByText('物资 7')).toBeInTheDocument()
    // Repair shop produces money even with all child buildings at Lv.0.
    expect(scoped.getByText(/本建筑产出 钱 \+1\/10秒/)).toBeInTheDocument()
  })

  // Step 3: main-building decision UI.
  it('tells how many children still need to catch up', () => {
    useCityStore.getState().selectBuilding('repair-shop')
    setProgress('repair-shop', 1, [1, 1, 1, 0, 0])

    render(<BuildingPanel />)

    expect(screen.getByText('还有 2 个子建筑未达到 Lv.1')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /升级主建筑/ }),
    ).not.toBeInTheDocument()
  })

  it('shows the precise clubhouse-locked hint when the gang tree is too low', () => {
    useCityStore.getState().selectBuilding('repair-shop')
    setProgress('repair-shop', 1, [1, 1, 1, 1, 1])

    render(<BuildingPanel />)

    expect(
      screen.getByText('需要先将帮派树提升至 Lv.40 解锁 Clubhouse'),
    ).toBeInTheDocument()
  })

  it('shows the clubhouse-too-low hint once the clubhouse is unlocked', () => {
    useGangStore.setState({ totalReputation: getTotalReputationForLevel(40) })
    useCityStore.getState().selectBuilding('repair-shop')
    setProgress('repair-shop', 1, [1, 1, 1, 1, 1])
    setProgress('clubhouse', 1, Array(10).fill(0))

    render(<BuildingPanel />)

    expect(
      screen.getByText('需要先将 Clubhouse 提升至 Lv.2'),
    ).toBeInTheDocument()
  })

  it('shows the missing money when the clubhouse threshold is met but funds are short', () => {
    useGangStore.setState({ totalReputation: getTotalReputationForLevel(40) })
    useCityStore.getState().selectBuilding('repair-shop')
    setProgress('repair-shop', 1, [1, 1, 1, 1, 1])
    setProgress('clubhouse', 2, Array(10).fill(0))
    setResources(0)

    render(<BuildingPanel />)

    expect(screen.getByText(/资源不足/)).toBeInTheDocument()
    expect(screen.getByText(/还需.*钱 25/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '升级主建筑至 Lv.2' }),
    ).not.toBeInTheDocument()
  })

  it('enables the main upgrade button and levels up when every gate is satisfied', async () => {
    const user = userEvent.setup()
    useGangStore.setState({ totalReputation: getTotalReputationForLevel(40) })
    useCityStore.getState().selectBuilding('repair-shop')
    setProgress('repair-shop', 1, [1, 1, 1, 1, 1])
    setProgress('clubhouse', 2, Array(10).fill(0))
    setResources(25)

    render(<BuildingPanel />)

    await user.click(screen.getByRole('button', { name: '升级主建筑至 Lv.2' }))

    expect(useCityStore.getState().buildingProgress['repair-shop'].level).toBe(
      2,
    )
    expect(useCityStore.getState().resources.money).toBe(0)
    expect(screen.getByText('等级 2 / 5')).toBeInTheDocument()
  })

  it('shows the maxed state for a level 5 repair shop', () => {
    useCityStore.getState().selectBuilding('repair-shop')
    setProgress('repair-shop', 5, Array(5).fill(5))

    render(<BuildingPanel />)

    expect(screen.getByText('等级 5 / 5')).toBeInTheDocument()
    expect(screen.getByText('已达到最高等级 Lv.5')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /升级主建筑/ }),
    ).not.toBeInTheDocument()
  })

  it('shows the maxed state for a level 10 clubhouse', () => {
    useGangStore.setState({ totalReputation: getTotalReputationForLevel(40) })
    useCityStore.getState().selectBuilding('clubhouse')
    setProgress('clubhouse', 10, Array(10).fill(10))

    render(<BuildingPanel />)

    expect(screen.getByText('等级 10 / 10')).toBeInTheDocument()
    expect(screen.getByText('已达到最高等级 Lv.10')).toBeInTheDocument()
  })

  it('shows the recycling yard as locked with no upgrade controls below level 8', () => {
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
    expect(document.querySelector('.building-panel__child-card')).toBeNull()
  })

  it('reveals ten free-choice cards for the recycling yard once level 8 is reached', () => {
    useGangStore.setState({ totalReputation: getTotalReputationForLevel(8) })
    useCityStore.getState().selectBuilding('recycling-yard')
    setResources(5)

    const { container } = render(<BuildingPanel />)

    expect(screen.queryByText('尚未解锁')).not.toBeInTheDocument()
    expect(screen.getByText('等级 1 / 5')).toBeInTheDocument()
    expect(
      container.querySelectorAll('.building-panel__child-card'),
    ).toHaveLength(10)
    const firstName = getBuildingFragments('recycling')[0].name
    expect(
      screen.getByRole('button', { name: `升级 ${firstName} 至 Lv.1` }),
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

  it('keeps child and close interactions from reaching a parent scene', async () => {
    const user = userEvent.setup()
    const onParentPointerDown = vi.fn()
    const onParentClick = vi.fn()
    useCityStore.getState().selectBuilding('repair-shop')
    setResources(5)
    render(
      <div onPointerDown={onParentPointerDown} onClick={onParentClick}>
        <BuildingPanel />
      </div>,
    )

    await user.click(
      screen.getByRole('button', {
        name: `升级 ${repairFragments[0].name} 至 Lv.1`,
      }),
    )
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
