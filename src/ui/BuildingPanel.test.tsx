import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { JSX } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getBuildingPower } from '../config/economyConfig'
import { buildingCatalogById } from '../game/buildingCatalog'
import type {
  BuildingDefinition,
  BuildingId,
  BuildingProgress,
} from '../game/cityTypes'
import {
  BUILDING_UNLOCKS,
  type BuildingUnlock,
  getTotalReputationForLevel,
} from '../game/gangProgression'
import { getBuildingFragments } from '../scene/city/buildingFragmentCatalog'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { BuildingPanel } from './BuildingPanel'
import {
  findDefaultChildIndex,
  findNextIncompleteChildIndex,
  mainUpgradeBlockerMessage,
} from './buildingPanelSession'

const BASE_TIME = 1_700_000_000_000

const repairFragments = getBuildingFragments('repair')
const commercialFragments = getBuildingFragments('commercial')

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

function renderWithScene(children: JSX.Element) {
  return render(
    <>
      <canvas tabIndex={0} aria-label="工业城市 3D 场景" />
      {children}
    </>,
  )
}

describe('BuildingPanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset(Date.now())
    setResources(0)
    useGangStore.getState().reset(BASE_TIME)
  })

  it('does not render without a selected building', () => {
    const { container } = render(<BuildingPanel />)

    expect(container).toBeEmptyDOMElement()
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

  it('shows a locked building with no selector and no upgrade controls', () => {
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
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  describe('session selection state machine', () => {
    it('defaults to the first unlocked slot and hides every other slot at repair Lv.1', () => {
      useCityStore.getState().selectBuilding('repair-shop')
      setResources(5)

      render(<BuildingPanel />)

      expect(screen.getByText('等级 1 / 10')).toBeInTheDocument()
      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(1)
      expect(radios[0]).toHaveAccessibleName(
        new RegExp(repairFragments[0].name),
      )
      expect(radios[0]).toHaveAttribute('aria-checked', 'true')
      expect(screen.queryByText('排气设施')).not.toBeInTheDocument()
    })

    it('keeps a manual selection through wallet updates and rerenders at repair Lv.3', async () => {
      const user = userEvent.setup()
      useCityStore.getState().selectBuilding('repair-shop')
      setProgress('repair-shop', 3, [0, 0, 0, 0, 0])
      setResources(0)

      render(<BuildingPanel />)

      expect(screen.getAllByRole('radio')).toHaveLength(3)
      await user.click(
        screen.getByRole('radio', {
          name: new RegExp(repairFragments[2].name),
        }),
      )
      expect(
        screen.getByRole('radio', {
          name: new RegExp(repairFragments[2].name),
        }),
      ).toHaveAttribute('aria-checked', 'true')

      act(() => {
        useCityStore.setState({
          resources: { money: 999, oil: 999, materials: 999 },
        })
      })

      expect(
        screen.getByRole('radio', {
          name: new RegExp(repairFragments[2].name),
        }),
      ).toHaveAttribute('aria-checked', 'true')
      expect(screen.queryByText('排气设施')).not.toBeInTheDocument()
    })

    it('starts a fresh session with the default slot when the panel is closed and reopened', async () => {
      const user = userEvent.setup()
      useCityStore.getState().selectBuilding('repair-shop')
      setProgress('repair-shop', 3, [0, 0, 0, 0, 0])

      render(<BuildingPanel />)

      await user.click(
        screen.getByRole('radio', {
          name: new RegExp(repairFragments[2].name),
        }),
      )
      act(() => {
        useCityStore.getState().clearSelection()
      })
      act(() => {
        useCityStore.getState().selectBuilding('repair-shop')
      })

      expect(
        screen.getByRole('radio', {
          name: new RegExp(repairFragments[0].name),
        }),
      ).toHaveAttribute('aria-checked', 'true')
    })

    it('starts a fresh default-selected session when switching to another building', () => {
      useGangStore.setState({ totalReputation: getTotalReputationForLevel(16) })
      useCityStore.getState().selectBuilding('repair-shop')
      setProgress('commercial-street', 2, [0, 1, 0, 0, 0, 0, 0, 0, 0, 0])

      const { rerender } = render(<BuildingPanel />)
      act(() => {
        useCityStore.getState().selectBuilding('commercial-street')
      })
      rerender(<BuildingPanel />)

      expect(
        screen.getByRole('radio', {
          name: new RegExp(commercialFragments[0].name),
        }),
      ).toHaveAttribute('aria-checked', 'true')
    })

    it('supports arrow-key navigation across the radio selector', async () => {
      const user = userEvent.setup()
      useCityStore.getState().selectBuilding('repair-shop')
      setProgress('repair-shop', 3, [0, 0, 0, 0, 0])

      render(<BuildingPanel />)

      screen
        .getByRole('radio', { name: new RegExp(repairFragments[0].name) })
        .focus()
      await user.keyboard('{ArrowRight}')

      expect(
        screen.getByRole('radio', {
          name: new RegExp(repairFragments[1].name),
        }),
      ).toHaveAttribute('aria-checked', 'true')
      expect(
        screen.getByRole('radio', {
          name: new RegExp(repairFragments[1].name),
        }),
      ).toHaveFocus()
    })
  })

  describe('shared upgrade button and exact progress', () => {
    it('shows the precise percentage, one shared button, and no per-card buttons at commercial Lv.3', () => {
      useGangStore.setState({ totalReputation: getTotalReputationForLevel(16) })
      useCityStore.getState().selectBuilding('commercial-street')
      setProgress('commercial-street', 3, [3, 2, 1, 0, 0, 0, 0, 0, 0, 0])
      setResources(1000)

      render(<BuildingPanel />)

      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute(
        'aria-valuenow',
        String((6 / 9) * 100),
      )
      expect(progressbar).toHaveAttribute('aria-valuemin', '0')
      expect(progressbar).toHaveAttribute('aria-valuemax', '100')
      expect(screen.getByText('66%')).toBeInTheDocument()

      const secondName = commercialFragments[1].name
      expect(
        screen.getByRole('button', {
          name: new RegExp(`升级「${secondName}」`),
        }),
      ).toBeInTheDocument()
      expect(screen.queryAllByRole('button', { name: /升级「/ })).toHaveLength(
        1,
      )
      expect(
        screen.queryByRole('button', { name: /升级主建筑/ }),
      ).not.toBeInTheDocument()
    })

    it('advances completed steps and cycles to the next incomplete slot after a successful upgrade', async () => {
      const user = userEvent.setup()
      useGangStore.setState({ totalReputation: getTotalReputationForLevel(16) })
      useCityStore.getState().selectBuilding('commercial-street')
      setProgress('commercial-street', 3, [3, 2, 1, 0, 0, 0, 0, 0, 0, 0])
      setResources(1000)

      render(<BuildingPanel />)

      await user.click(
        screen.getByRole('button', {
          name: new RegExp(`升级「${commercialFragments[1].name}」`),
        }),
      )

      expect(
        useCityStore.getState().buildingProgress['commercial-street']
          .childLevels[1],
      ).toBe(3)
      expect(
        screen.getByRole('radio', {
          name: new RegExp(commercialFragments[2].name),
        }),
      ).toHaveAttribute('aria-checked', 'true')
    })

    it('disables the shared button and shows the exact shortfall when funds are short', () => {
      useCityStore.getState().selectBuilding('repair-shop')
      setResources(0)

      render(<BuildingPanel />)

      const button = screen.getByRole('button', {
        name: new RegExp(`升级「${repairFragments[0].name}」`),
      })
      expect(button).toBeDisabled()
      expect(screen.getByText('资源不足，还需 钱 5')).toBeInTheDocument()
    })

    it('replaces the progress region with the main upgrade button once every visible slot is caught up', () => {
      useGangStore.setState({ totalReputation: getTotalReputationForLevel(40) })
      useCityStore.getState().selectBuilding('commercial-street')
      setProgress('commercial-street', 3, [3, 3, 3, 0, 0, 0, 0, 0, 0, 0])
      setProgress('repair-shop', 3, [3, 3, 3, 3, 3])
      setResources(1000)

      render(<BuildingPanel />)

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /升级「/ }),
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: '升级主建筑至 Lv.4' }),
      ).toBeInTheDocument()
    })

    it('shows only the maxed message at Lv.10', () => {
      useGangStore.setState({ totalReputation: getTotalReputationForLevel(40) })
      useCityStore.getState().selectBuilding('clubhouse')
      setProgress('clubhouse', 10, Array(10).fill(10))

      render(<BuildingPanel />)

      expect(screen.getByText('已达到最高等级 Lv.10')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /升级主建筑/ }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })
  })

  describe('main upgrade confirmation page', () => {
    function setUpReadyRepairShop(): void {
      useCityStore.getState().selectBuilding('repair-shop')
      setProgress('repair-shop', 1, [1, 0, 0, 0, 0])
      setResources(25)
    }

    it('opens an independent confirmation page without touching resources or level, and focuses its heading', async () => {
      const user = userEvent.setup()
      setUpReadyRepairShop()

      renderWithScene(<BuildingPanel />)

      await user.click(
        screen.getByRole('button', { name: '升级主建筑至 Lv.2' }),
      )

      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      const heading = screen.getByRole('heading', {
        name: '修车厂 · 目标等级 Lv.2',
      })
      expect(heading).toHaveFocus()
      expect(
        useCityStore.getState().buildingProgress['repair-shop'].level,
      ).toBe(1)
      expect(useCityStore.getState().resources.money).toBe(25)
    })

    it('shows the full three-resource cost including zero entries and the three power figures', async () => {
      const user = userEvent.setup()
      setUpReadyRepairShop()

      render(<BuildingPanel />)
      await user.click(
        screen.getByRole('button', { name: '升级主建筑至 Lv.2' }),
      )

      expect(screen.getByText('钱 25')).toBeInTheDocument()
      expect(screen.getByText('油 0')).toBeInTheDocument()
      expect(screen.getByText('物资 0')).toBeInTheDocument()

      const currentPower = getBuildingPower('repair-shop', 1)
      const nextPower = getBuildingPower('repair-shop', 2)
      expect(
        screen.getByText(`当前建筑战力 ${currentPower}`),
      ).toBeInTheDocument()
      expect(
        screen.getByText(`本次战力 +${nextPower - currentPower}`),
      ).toBeInTheDocument()
      expect(screen.getByText(`升级后战力 ${nextPower}`)).toBeInTheDocument()
    })

    it('returns to details unchanged and refocuses the main upgrade button', async () => {
      const user = userEvent.setup()
      setUpReadyRepairShop()

      render(<BuildingPanel />)
      const mainButton = screen.getByRole('button', {
        name: '升级主建筑至 Lv.2',
      })
      await user.click(mainButton)
      await user.click(screen.getByRole('button', { name: '返回' }))

      expect(
        screen.getByRole('button', { name: '升级主建筑至 Lv.2' }),
      ).toHaveFocus()
      expect(
        useCityStore.getState().buildingProgress['repair-shop'].level,
      ).toBe(1)
      expect(useCityStore.getState().resources.money).toBe(25)
    })

    it('recomputes and disables confirmation once resources become insufficient, then re-enables once funded', async () => {
      const user = userEvent.setup()
      setUpReadyRepairShop()

      render(<BuildingPanel />)
      await user.click(
        screen.getByRole('button', { name: '升级主建筑至 Lv.2' }),
      )

      act(() => {
        useCityStore.setState({ resources: { money: 0, oil: 0, materials: 0 } })
      })

      const confirmButton = screen.getByRole('button', { name: '确认升级' })
      expect(confirmButton).toBeDisabled()
      expect(screen.getByText(/资源不足，还需 钱 25/)).toBeInTheDocument()

      act(() => {
        useCityStore.setState({
          resources: { money: 25, oil: 0, materials: 0 },
        })
      })

      expect(screen.getByRole('button', { name: '确认升级' })).toBeEnabled()
    })

    it('charges exactly once, advances the level, and selects the newly unlocked slot on success', async () => {
      const user = userEvent.setup()
      setUpReadyRepairShop()

      render(<BuildingPanel />)
      await user.click(
        screen.getByRole('button', { name: '升级主建筑至 Lv.2' }),
      )
      await user.click(screen.getByRole('button', { name: '确认升级' }))

      expect(useCityStore.getState().buildingProgress['repair-shop']).toEqual({
        level: 2,
        childLevels: [1, 0, 0, 0, 0],
      })
      expect(useCityStore.getState().resources.money).toBe(0)
      expect(screen.getByText('等级 2 / 10')).toBeInTheDocument()
      expect(
        screen.getByRole('radio', {
          name: new RegExp(repairFragments[1].name),
        }),
      ).toHaveAttribute('aria-checked', 'true')
    })

    it('selects the first incomplete slot instead of a new slot for the repair shop Lv.5→6 upgrade', async () => {
      const user = userEvent.setup()
      useGangStore.setState({ totalReputation: getTotalReputationForLevel(40) })
      useCityStore.getState().selectBuilding('repair-shop')
      setProgress('repair-shop', 5, [5, 5, 5, 5, 5])
      setProgress('clubhouse', 6, Array(10).fill(6))
      setResources(1000)

      render(<BuildingPanel />)
      await user.click(
        screen.getByRole('button', { name: '升级主建筑至 Lv.6' }),
      )
      await user.click(screen.getByRole('button', { name: '确认升级' }))

      expect(
        useCityStore.getState().buildingProgress['repair-shop'].level,
      ).toBe(6)
      expect(
        screen.getByRole('radio', {
          name: new RegExp(repairFragments[0].name),
        }),
      ).toHaveAttribute('aria-checked', 'true')
    })

    it('shows the precise building-threshold blocker text on the confirmation page', async () => {
      const user = userEvent.setup()
      useGangStore.setState({ totalReputation: getTotalReputationForLevel(16) })
      useCityStore.getState().selectBuilding('commercial-street')
      setProgress('commercial-street', 1, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      setProgress('repair-shop', 1, [1, 0, 0, 0, 0])
      setResources(1000)

      render(<BuildingPanel />)
      await user.click(
        screen.getByRole('button', { name: '升级主建筑至 Lv.2' }),
      )

      expect(screen.getByText('需要先将修车厂提升至 Lv.2')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '确认升级' })).toBeDisabled()
    })
  })

  it('clears the selection and does not restore the old slot on reselect', async () => {
    const user = userEvent.setup()
    useCityStore.getState().selectBuilding('repair-shop')
    render(<BuildingPanel />)

    await user.click(screen.getByRole('button', { name: '关闭建筑面板' }))

    expect(useCityStore.getState().selectedBuildingId).toBeNull()
    expect(
      screen.queryByRole('heading', { name: '修车厂' }),
    ).not.toBeInTheDocument()
  })

  it('closes the panel on Escape', () => {
    useCityStore.getState().selectBuilding('repair-shop')
    render(<BuildingPanel />)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(useCityStore.getState().selectedBuildingId).toBeNull()
  })

  it('keeps child, main, and close interactions from reaching a parent scene', async () => {
    const user = userEvent.setup()
    const onParentPointerDown = vi.fn()
    const onParentClick = vi.fn()
    useCityStore.getState().selectBuilding('repair-shop')
    setProgress('repair-shop', 1, [1, 0, 0, 0, 0])
    setResources(25)
    render(
      <div onPointerDown={onParentPointerDown} onClick={onParentClick}>
        <BuildingPanel />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: '升级主建筑至 Lv.2' }))
    await user.click(screen.getByRole('button', { name: '返回' }))
    await user.click(screen.getByRole('button', { name: '关闭建筑面板' }))

    expect(onParentPointerDown).not.toHaveBeenCalled()
    expect(onParentClick).not.toHaveBeenCalled()
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
    expect(scoped.getByText(/本建筑产出 钱 \+1\/10秒/)).toBeInTheDocument()
  })
})

describe('pure BuildingPanel helpers', () => {
  function progress(level: number, childLevels: number[]): BuildingProgress {
    return {
      level: level as BuildingProgress['level'],
      childLevels: childLevels as BuildingProgress['childLevels'],
    }
  }

  describe('findDefaultChildIndex', () => {
    it('returns the first incomplete unlocked slot', () => {
      expect(findDefaultChildIndex(progress(3, [3, 2, 1, 0, 0]), 3)).toBe(1)
    })

    it('returns null once every unlocked slot has caught up', () => {
      expect(findDefaultChildIndex(progress(3, [3, 3, 3, 0, 0]), 3)).toBeNull()
    })

    it('ignores slots beyond the unlocked prefix', () => {
      expect(findDefaultChildIndex(progress(3, [3, 3, 0, 0, 0]), 2)).toBeNull()
    })
  })

  describe('findNextIncompleteChildIndex', () => {
    it('cycles forward past the current index and wraps around', () => {
      expect(
        findNextIncompleteChildIndex(progress(3, [1, 3, 2, 3, 3]), 5, 1),
      ).toBe(2)
      expect(
        findNextIncompleteChildIndex(progress(3, [1, 3, 3, 3, 3]), 5, 1),
      ).toBe(0)
    })

    it('returns null when no unlocked slot is incomplete', () => {
      expect(
        findNextIncompleteChildIndex(progress(3, [3, 3, 3]), 3, 0),
      ).toBeNull()
    })
  })

  describe('mainUpgradeBlockerMessage', () => {
    it('renders the exact children-not-caught-up text using the current main level', () => {
      expect(
        mainUpgradeBlockerMessage(
          {
            reason: 'children-not-caught-up',
            targetLevel: null,
            cost: null,
            missingResources: { money: 0, oil: 0, materials: 0 },
            requiredBuildingId: null,
            requiredBuildingLevel: null,
          },
          3,
        ),
      ).toBe('请先将当前已解锁子建筑全部提升至 Lv.3')
    })

    it('renders exact text for every other blocking reason', () => {
      expect(
        mainUpgradeBlockerMessage(
          {
            reason: 'repair-shop-too-low',
            targetLevel: 2,
            cost: null,
            missingResources: { money: 0, oil: 0, materials: 0 },
            requiredBuildingId: 'repair-shop',
            requiredBuildingLevel: 2,
          },
          1,
        ),
      ).toBe('需要先将修车厂提升至 Lv.2')

      expect(
        mainUpgradeBlockerMessage(
          {
            reason: 'clubhouse-locked',
            targetLevel: 6,
            cost: null,
            missingResources: { money: 0, oil: 0, materials: 0 },
            requiredBuildingId: 'clubhouse',
            requiredBuildingLevel: null,
          },
          5,
        ),
      ).toBe('需要先将帮派树提升至 Lv.40 解锁 Clubhouse')

      expect(
        mainUpgradeBlockerMessage(
          {
            reason: 'clubhouse-too-low',
            targetLevel: 6,
            cost: null,
            missingResources: { money: 0, oil: 0, materials: 0 },
            requiredBuildingId: 'clubhouse',
            requiredBuildingLevel: 6,
          },
          5,
        ),
      ).toBe('需要先将 Clubhouse 提升至 Lv.6')

      expect(
        mainUpgradeBlockerMessage(
          {
            reason: 'building-maxed',
            targetLevel: null,
            cost: null,
            missingResources: { money: 0, oil: 0, materials: 0 },
            requiredBuildingId: null,
            requiredBuildingLevel: null,
          },
          10,
        ),
      ).toBe('已达到最高等级 Lv.10')

      expect(
        mainUpgradeBlockerMessage(
          {
            reason: 'insufficient-resources',
            targetLevel: 2,
            cost: { money: 25, oil: 0, materials: 0 },
            missingResources: { money: 10, oil: 0, materials: 0 },
            requiredBuildingId: null,
            requiredBuildingLevel: null,
          },
          1,
        ),
      ).toBe('资源不足，还需 钱 10')
    })

    it('returns null when ready', () => {
      expect(
        mainUpgradeBlockerMessage(
          {
            reason: 'ready',
            targetLevel: 2,
            cost: { money: 25, oil: 0, materials: 0 },
            missingResources: { money: 0, oil: 0, materials: 0 },
            requiredBuildingId: null,
            requiredBuildingLevel: null,
          },
          1,
        ),
      ).toBeNull()
    })
  })
})
