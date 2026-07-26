import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { JSX } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { economyConfig, getBuildingPower } from '../config/economyConfig'
import { buildingCatalogById } from '../game/buildingCatalog'
import { useChestTick } from '../game/chestTick'
import { PART_IDLE_CAP_MS } from '../game/equipmentProgression'
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
import {
  useAdventureStore,
  type PartSalvageClaimResult,
} from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { BuildingPanel } from './BuildingPanel'
import {
  findDefaultChildIndex,
  findNextIncompleteChildIndex,
  formatNonZeroCost,
  mainUpgradeBlockerMessage,
} from './buildingPanelSession'

const BASE_TIME = 1_700_000_000_000
const originalClaimPartSalvage = useAdventureStore.getState().claimPartSalvage

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

function completeMainUpgrade(buildingId: BuildingId): void {
  const task = useCityStore
    .getState()
    .pendingMainUpgrades.find(
      (candidate) => candidate.buildingId === buildingId,
    )
  if (!task) throw new Error(`Missing pending upgrade for ${buildingId}`)
  act(() => {
    useCityStore.getState().syncMainUpgrades(task.completesAt)
  })
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
    useAdventureStore.getState().reset(BASE_TIME)
    useAdventureStore.setState({
      claimPartSalvage: originalClaimPartSalvage,
    })
    useChestTick.setState({ now: BASE_TIME, tick: 0 })
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

  describe('recycling-yard production tabs', () => {
    function openUnlockedYard(level = 1): void {
      useGangStore.setState({
        totalReputation: getTotalReputationForLevel(8),
      })
      setProgress('recycling-yard', level, Array(10).fill(0))
      useCityStore.getState().selectBuilding('recycling-yard')
    }

    it('shows tabs only for the recycling yard and defaults every open to building', async () => {
      const user = userEvent.setup()
      openUnlockedYard()

      render(<BuildingPanel />)

      const tabs = screen.getByRole('navigation', {
        name: '废车回收厂面板分类',
      })
      expect(
        within(tabs).getByRole('button', { name: '建筑' }),
      ).toHaveAttribute('aria-pressed', 'true')
      await user.click(within(tabs).getByRole('button', { name: /生产/ }))
      expect(
        within(tabs).getByRole('button', { name: /生产/ }),
      ).toHaveAttribute('aria-pressed', 'true')

      act(() => {
        useCityStore.getState().clearSelection()
      })
      act(() => {
        useCityStore.getState().selectBuilding('recycling-yard')
      })
      expect(screen.getByRole('button', { name: '建筑' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )

      act(() => {
        useCityStore.getState().selectBuilding('repair-shop')
      })
      expect(
        screen.queryByRole('navigation', {
          name: '废车回收厂面板分类',
        }),
      ).not.toBeInTheDocument()
      expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    })

    it('renders a read-only tick-driven preview with badge, progress, storage, and cap', async () => {
      openUnlockedYard()
      useAdventureStore.setState({ partIdleClock: BASE_TIME })
      useChestTick.setState({ now: BASE_TIME + 35_000, tick: 1 })
      const before = {
        inventory: useAdventureStore.getState().carPartInventory,
        clock: useAdventureStore.getState().partIdleClock,
        serial: useAdventureStore.getState().nextPartSerial,
      }

      render(<BuildingPanel />)
      await userEvent.click(screen.getByRole('button', { name: /生产/ }))

      const productionTab = screen.getByRole('button', {
        name: '生产 · 可领取 1 批',
      })
      expect(
        productionTab.querySelector('.building-panel__tab-dot'),
      ).toBeInTheDocument()
      const production = screen.getByRole('region', { name: '配件生产' })
      expect(within(production).getByText('累计时间 35秒')).toBeInTheDocument()
      expect(within(production).getByText('已完成批次 1')).toBeInTheDocument()
      expect(
        within(production).getByText('当前批进度 5秒 / 30秒'),
      ).toBeInTheDocument()
      expect(within(production).getByText('下一批 25秒')).toBeInTheDocument()
      expect(within(production).getByText('仓库 0/40')).toBeInTheDocument()
      expect(within(production).getByText('挂机上限 8小时')).toBeInTheDocument()
      expect(
        within(production).getByRole('button', { name: '领取 1 批' }),
      ).toBeEnabled()
      expect({
        inventory: useAdventureStore.getState().carPartInventory,
        clock: useAdventureStore.getState().partIdleClock,
        serial: useAdventureStore.getState().nextPartSerial,
      }).toEqual(before)
    })

    it('replaces the next-batch countdown with capped guidance at eight hours', async () => {
      openUnlockedYard()
      useAdventureStore.setState({ partIdleClock: BASE_TIME })
      useChestTick.setState({
        now: BASE_TIME + PART_IDLE_CAP_MS + 5_000,
        tick: 1,
      })

      render(<BuildingPanel />)
      await userEvent.click(screen.getByRole('button', { name: /生产/ }))

      const production = screen.getByRole('region', { name: '配件生产' })
      expect(within(production).queryByText(/下一批/)).not.toBeInTheDocument()
      expect(
        within(production).getByText('已达8小时上限，领取后继续累计'),
      ).toBeInTheDocument()
    })

    it('keeps claim disabled before one batch and enables it on the next UI tick', async () => {
      openUnlockedYard()
      useAdventureStore.setState({ partIdleClock: BASE_TIME })
      useChestTick.setState({ now: BASE_TIME + 29_000, tick: 1 })

      render(<BuildingPanel />)
      await userEvent.click(screen.getByRole('button', { name: '生产' }))

      expect(
        screen.getByRole('button', { name: '暂无可领取批次' }),
      ).toBeDisabled()
      act(() => {
        useChestTick.setState({ now: BASE_TIME + 30_000, tick: 2 })
      })
      expect(screen.getByRole('button', { name: '领取 1 批' })).toBeEnabled()
    })

    it('keeps the production tab open when a background yard upgrade completes', async () => {
      openUnlockedYard()

      render(<BuildingPanel />)
      await userEvent.click(screen.getByRole('button', { name: '生产' }))
      act(() => {
        setProgress('recycling-yard', 2, Array(10).fill(0))
      })

      expect(screen.getByText('等级 2 / 10')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '生产' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(
        screen.getByRole('region', { name: '配件生产' }),
      ).toBeInTheDocument()
    })

    it('selects exactly one default child when returning to building after a yard level completes', async () => {
      openUnlockedYard()
      setProgress('recycling-yard', 1, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0])

      render(<BuildingPanel />)
      expect(
        screen.getAllByRole('radio').filter((radio) => radio.tabIndex === 0),
      ).toHaveLength(0)
      await userEvent.click(screen.getByRole('button', { name: '生产' }))
      act(() => {
        setProgress('recycling-yard', 2, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      })
      await userEvent.click(screen.getByRole('button', { name: '建筑' }))

      const radios = screen.getAllByRole('radio')
      expect(radios.filter((radio) => radio.tabIndex === 0)).toHaveLength(1)
      expect(
        radios.filter((radio) => radio.getAttribute('aria-checked') === 'true'),
      ).toHaveLength(1)
      expect(radios[0]).toHaveAttribute('tabindex', '0')
      expect(radios[0]).toHaveAttribute('aria-checked', 'true')
    })

    it('keeps the claim result open when a background yard upgrade completes', async () => {
      openUnlockedYard()
      useAdventureStore.setState({
        partIdleClock: BASE_TIME,
        claimPartSalvage: vi.fn((): PartSalvageClaimResult => ({
          applied: true,
          receivedParts: [],
          autoRecycled: 1,
          sparePartsGained: 8,
          batchCount: 1,
        })),
      })
      useChestTick.setState({ now: BASE_TIME + 30_000, tick: 1 })

      render(<BuildingPanel />)
      await userEvent.click(screen.getByRole('button', { name: /生产/ }))
      await userEvent.click(screen.getByRole('button', { name: '领取 1 批' }))
      act(() => {
        setProgress('recycling-yard', 2, Array(10).fill(0))
      })

      expect(
        screen.getByRole('dialog', { name: '领取结果' }),
      ).toBeInTheDocument()
      expect(screen.getByText('已结算 1 批 · 入库 0 件')).toBeInTheDocument()
    })

    it('claims once, lists five-quality result parts, reports recycling, and closes to production', async () => {
      const user = userEvent.setup()
      openUnlockedYard(10)
      useAdventureStore.setState({ partIdleClock: BASE_TIME })
      useChestTick.setState({ now: BASE_TIME + 12_000, tick: 1 })
      const claimPartSalvage = vi.fn((): PartSalvageClaimResult => ({
        applied: true,
        receivedParts: [
          { id: 'result-1', slot: 'tires', quality: 'common', level: 1 },
          { id: 'result-2', slot: 'engine', quality: 'uncommon', level: 1 },
          { id: 'result-3', slot: 'bumper', quality: 'rare', level: 1 },
          { id: 'result-4', slot: 'suspension', quality: 'epic', level: 1 },
          { id: 'result-5', slot: 'tires', quality: 'legendary', level: 1 },
        ],
        autoRecycled: 2,
        sparePartsGained: 98,
        batchCount: 1,
      }))
      useAdventureStore.setState({ claimPartSalvage })

      render(<BuildingPanel />)
      await user.click(screen.getByRole('button', { name: /生产/ }))
      const claimButton = screen.getByRole('button', { name: '领取 1 批' })
      fireEvent.click(claimButton)
      fireEvent.click(claimButton)

      expect(claimPartSalvage).toHaveBeenCalledTimes(1)
      expect(claimPartSalvage).toHaveBeenCalledWith(BASE_TIME + 12_000, 10, 8)
      const result = screen.getByRole('dialog', { name: '领取结果' })
      expect(within(result).getAllByText('高抓地轮胎')).toHaveLength(2)
      expect(within(result).getByText('强化引擎')).toBeInTheDocument()
      expect(within(result).getByText('防撞保险杠')).toBeInTheDocument()
      expect(within(result).getByText('运动悬挂')).toBeInTheDocument()
      for (const quality of ['普通', '优秀', '精良', '史诗', '传说']) {
        expect(within(result).getByText(quality)).toBeInTheDocument()
      }
      expect(within(result).getAllByText('Lv.1')).toHaveLength(5)
      expect(
        within(result).getByText('自动回收 2 件 · 零件 +98'),
      ).toBeInTheDocument()

      const resultTitle = within(result).getByRole('heading', {
        name: '领取结果',
      })
      expect(resultTitle).toHaveAttribute('tabindex', '-1')
      expect(resultTitle).toHaveFocus()
      const closeResult = within(result).getByRole('button', {
        name: '关闭领取结果',
      })
      expect(closeResult).toHaveClass('building-panel__close')
      const returnToProduction = within(result).getByRole('button', {
        name: '返回生产',
      })
      await user.tab()
      expect(closeResult).toHaveFocus()
      expect(result).toContainElement(document.activeElement as HTMLElement)
      await user.tab()
      expect(returnToProduction).toHaveFocus()
      expect(result).toContainElement(document.activeElement as HTMLElement)
      await user.tab()
      expect(closeResult).toHaveFocus()
      await user.tab({ shift: true })
      expect(returnToProduction).toHaveFocus()
      expect(result).toContainElement(document.activeElement as HTMLElement)
      await user.tab({ shift: true })
      expect(closeResult).toHaveFocus()
      expect(result).toContainElement(document.activeElement as HTMLElement)
      await user.keyboard('{Escape}')
      const productionTab = screen.getByRole('button', { name: /生产/ })
      expect(productionTab).toHaveAttribute('aria-pressed', 'true')
      expect(productionTab).toHaveFocus()
      expect(
        screen.queryByRole('dialog', { name: '领取结果' }),
      ).not.toBeInTheDocument()
    })
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

    it('resets another building to its default slot when its level changes', async () => {
      const user = userEvent.setup()
      useCityStore.getState().selectBuilding('repair-shop')
      setProgress('repair-shop', 3, [3, 3, 0, 0, 0])

      render(<BuildingPanel />)
      await user.click(
        screen.getByRole('radio', {
          name: new RegExp(repairFragments[1].name),
        }),
      )
      act(() => {
        setProgress('repair-shop', 4, [3, 3, 0, 0, 0])
      })

      expect(
        screen.getByRole('radio', {
          name: new RegExp(repairFragments[0].name),
        }),
      ).toHaveAttribute('aria-checked', 'true')
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

      // Stage progress at M=3 with [3,2,1]: 2/5 → 40%
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '40')
      expect(progressbar).toHaveAttribute('aria-valuemin', '0')
      expect(progressbar).toHaveAttribute('aria-valuemax', '100')
      expect(screen.getByText('40%')).toBeInTheDocument()

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

    it('keeps the completed 100% progress beside the main upgrade button', () => {
      useGangStore.setState({ totalReputation: getTotalReputationForLevel(40) })
      useCityStore.getState().selectBuilding('commercial-street')
      setProgress('commercial-street', 3, [3, 3, 3, 0, 0, 0, 0, 0, 0, 0])
      setProgress('repair-shop', 3, [3, 3, 3, 3, 3])
      setResources(1000)

      render(<BuildingPanel />)

      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '100',
      )
      expect(screen.getByText('100%')).toBeInTheDocument()
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
      expect(screen.queryByText('100%')).not.toBeInTheDocument()
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

    it('charges once, completes later, and selects the first incomplete slot', async () => {
      const user = userEvent.setup()
      setUpReadyRepairShop()

      render(<BuildingPanel />)
      await user.click(
        screen.getByRole('button', { name: '升级主建筑至 Lv.2' }),
      )
      await user.click(screen.getByRole('button', { name: '确认升级' }))
      completeMainUpgrade('repair-shop')

      expect(useCityStore.getState().buildingProgress['repair-shop']).toEqual({
        level: 2,
        childLevels: [1, 0, 0, 0, 0],
      })
      expect(useCityStore.getState().resources.money).toBe(0)
      expect(screen.getByText('等级 2 / 10')).toBeInTheDocument()
      expect(
        screen.getByRole('radio', {
          name: new RegExp(repairFragments[0].name),
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
      completeMainUpgrade('repair-shop')

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

  describe('Clubhouse direct main upgrade', () => {
    function setUpClubhouse(
      level = 1,
      childLevels: number[] = Array(10).fill(0),
    ): void {
      useGangStore.setState({
        totalReputation: getTotalReputationForLevel(40),
      })
      useCityStore.getState().selectBuilding('clubhouse')
      setProgress('clubhouse', level, childLevels)
    }

    it('renders no child, progress, or confirmation controls at Lv.1', () => {
      setUpClubhouse()

      render(<BuildingPanel />)

      expect(
        screen.getByRole('heading', { name: 'Clubhouse' }),
      ).toBeInTheDocument()
      expect(screen.getByText('等级 1 / 10')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: '关闭建筑面板' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /升级「/ }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /升级主建筑至/ }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: '确认升级' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: '返回' }),
      ).not.toBeInTheDocument()
    })

    it('shows the full next-level cost and all three power figures', () => {
      setUpClubhouse()
      setResources(10_000, 10_000, 10_000)
      const cost = economyConfig.buildingUpgradeCostByTargetLevel[2]
      if (!cost) {
        throw new Error('Missing main building target-level 2 cost')
      }

      render(<BuildingPanel />)

      const costList = screen.getByRole('list', { name: '升级成本' })
      const scopedCost = within(costList)
      expect(scopedCost.getByText(`钱 ${cost.money}`)).toBeInTheDocument()
      expect(scopedCost.getByText(`油 ${cost.oil}`)).toBeInTheDocument()
      expect(scopedCost.getByText(`物资 ${cost.materials}`)).toBeInTheDocument()

      const currentPower = getBuildingPower('clubhouse', 1)
      const nextPower = getBuildingPower('clubhouse', 2)
      expect(
        screen.getByText(`当前建筑战力 ${currentPower}`),
      ).toBeInTheDocument()
      expect(
        screen.getByText(`本次战力 +${nextPower - currentPower}`),
      ).toBeInTheDocument()
      expect(screen.getByText(`升级后战力 ${nextPower}`)).toBeInTheDocument()
    })

    it('upgrades Lv.1→2 and atomically charges the exact cost in one click', async () => {
      const user = userEvent.setup()
      setUpClubhouse()
      const cost = economyConfig.buildingUpgradeCostByTargetLevel[2]
      if (!cost) {
        throw new Error('Missing main building target-level 2 cost')
      }
      setResources(cost.money + 17, cost.oil + 13, cost.materials + 11)

      render(<BuildingPanel />)

      const costText = formatNonZeroCost(cost)
      await user.click(
        screen.getByRole('button', {
          name: `直接升级 Clubhouse 至 Lv.2 · ${costText}`,
        }),
      )
      completeMainUpgrade('clubhouse')

      expect(useCityStore.getState().buildingProgress.clubhouse).toEqual({
        level: 2,
        childLevels: Array(10).fill(0),
      })
      expect(useCityStore.getState().resources).toEqual({
        money: 17,
        oil: 13,
        materials: 11,
      })
      expect(screen.getByText('等级 2 / 10')).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: 'Clubhouse' }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: '确认升级' }),
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /直接升级 Clubhouse 至 Lv\.3/ }),
      ).toBeInTheDocument()
    })

    it('charges each target-level cost across consecutive direct clicks', async () => {
      const user = userEvent.setup()
      setUpClubhouse()
      const cost2 = economyConfig.buildingUpgradeCostByTargetLevel[2]
      const cost3 = economyConfig.buildingUpgradeCostByTargetLevel[3]
      if (!cost2 || !cost3) {
        throw new Error('Missing consecutive main building costs')
      }
      const startingWallet = {
        money: cost2.money + cost3.money + 101,
        oil: cost2.oil + cost3.oil + 102,
        materials: cost2.materials + cost3.materials + 103,
      }
      setResources(
        startingWallet.money,
        startingWallet.oil,
        startingWallet.materials,
      )

      render(<BuildingPanel />)

      await user.click(
        screen.getByRole('button', {
          name: /直接升级 Clubhouse 至 Lv\.2/,
        }),
      )
      completeMainUpgrade('clubhouse')
      await user.click(
        screen.getByRole('button', {
          name: /直接升级 Clubhouse 至 Lv\.3/,
        }),
      )
      completeMainUpgrade('clubhouse')

      expect(useCityStore.getState().buildingProgress.clubhouse.level).toBe(3)
      expect(useCityStore.getState().resources).toEqual({
        money: 101,
        oil: 102,
        materials: 103,
      })
      expect(
        screen.getByRole('button', { name: /直接升级 Clubhouse 至 Lv\.4/ }),
      ).toBeInTheDocument()
    })

    it('disables direct upgrade, shows the exact shortfall, and leaves state unchanged', async () => {
      const user = userEvent.setup()
      setUpClubhouse()
      setResources(0, 0, 0)
      const cost = economyConfig.buildingUpgradeCostByTargetLevel[2]
      if (!cost) {
        throw new Error('Missing main building target-level 2 cost')
      }
      const beforeProgress = useCityStore.getState().buildingProgress.clubhouse
      const beforeResources = useCityStore.getState().resources

      render(<BuildingPanel />)

      const button = screen.getByRole('button', {
        name: `直接升级 Clubhouse 至 Lv.2 · ${formatNonZeroCost(cost)}`,
      })
      expect(button).toBeDisabled()
      expect(
        screen.getByText(
          `资源不足，还需 ${formatNonZeroCost({
            money: cost.money,
            oil: cost.oil,
            materials: cost.materials,
          })}`,
        ),
      ).toBeInTheDocument()
      await user.click(button)
      expect(useCityStore.getState().buildingProgress.clubhouse).toEqual(
        beforeProgress,
      )
      expect(useCityStore.getState().resources).toEqual(beforeResources)
    })

    it('shows only the max-level message at Lv.10', () => {
      setUpClubhouse(10, Array(10).fill(10))

      render(<BuildingPanel />)

      expect(screen.getByText('已达到最高等级 Lv.10')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /直接升级 Clubhouse/ }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('keeps gang Lv.39 on the locked page with no direct action', () => {
      useGangStore.setState({
        totalReputation: getTotalReputationForLevel(39),
      })
      useCityStore.getState().selectBuilding('clubhouse')

      render(<BuildingPanel />)

      expect(screen.getByText('尚未解锁')).toBeInTheDocument()
      expect(screen.getByText(/需要 Lv\. 40/)).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /直接升级 Clubhouse/ }),
      ).not.toBeInTheDocument()
    })

    it('leaves the repair-shop fragment progress and confirmation flow unchanged', async () => {
      const user = userEvent.setup()
      useCityStore.getState().selectBuilding('repair-shop')
      setProgress('repair-shop', 1, [1, 0, 0, 0, 0])
      setResources(25)

      render(<BuildingPanel />)

      expect(screen.getByRole('radiogroup')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '100',
      )
      await user.click(
        screen.getByRole('button', { name: '升级主建筑至 Lv.2' }),
      )
      expect(
        screen.getByRole('button', { name: '确认升级' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument()
    })

    it('cannot retain another building confirmation session when Clubhouse opens', async () => {
      const user = userEvent.setup()
      useGangStore.setState({
        totalReputation: getTotalReputationForLevel(40),
      })
      useCityStore.getState().selectBuilding('repair-shop')
      setProgress('repair-shop', 1, [1, 0, 0, 0, 0])
      setResources(10_000, 10_000, 10_000)

      render(<BuildingPanel />)
      await user.click(
        screen.getByRole('button', { name: '升级主建筑至 Lv.2' }),
      )
      expect(
        screen.getByRole('button', { name: '确认升级' }),
      ).toBeInTheDocument()

      act(() => {
        useCityStore.getState().selectBuilding('clubhouse')
      })

      expect(
        screen.getByRole('heading', { name: 'Clubhouse' }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: '确认升级' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: '返回' }),
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', {
          name: /直接升级 Clubhouse 至 Lv\.2/,
        }),
      ).toBeInTheDocument()
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

  describe('stage progress display', () => {
    it('shows 0% → 33% → 66% → 100% for commercial Lv2 [1,0] stage steps', () => {
      useGangStore.setState({ totalReputation: getTotalReputationForLevel(16) })
      useCityStore.getState().selectBuilding('commercial-street')
      setProgress('commercial-street', 2, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      setResources(1000)
      const { rerender } = render(<BuildingPanel />)
      expect(screen.getByText('0%')).toBeInTheDocument()

      setProgress('commercial-street', 2, [2, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      rerender(<BuildingPanel />)
      expect(screen.getByText('33%')).toBeInTheDocument()

      setProgress('commercial-street', 2, [2, 1, 0, 0, 0, 0, 0, 0, 0, 0])
      rerender(<BuildingPanel />)
      expect(screen.getByText('66%')).toBeInTheDocument()

      setProgress('commercial-street', 2, [2, 2, 0, 0, 0, 0, 0, 0, 0, 0])
      setProgress('repair-shop', 2, [2, 2, 2, 2, 2])
      rerender(<BuildingPanel />)
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '100',
      )
      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: '升级主建筑至 Lv.3' }),
      ).toBeInTheDocument()
    })

    it('shows 20% steps for repair-shop Lv5→6 stage', () => {
      useGangStore.setState({ totalReputation: getTotalReputationForLevel(40) })
      useCityStore.getState().selectBuilding('repair-shop')
      setProgress('repair-shop', 6, [5, 5, 5, 5, 5])
      setProgress('clubhouse', 6, [6, 6, 6, 6, 6, 6, 6, 6, 6, 6])
      setResources(10_000)
      const { rerender } = render(<BuildingPanel />)
      expect(screen.getByText('0%')).toBeInTheDocument()

      setProgress('repair-shop', 6, [6, 5, 5, 5, 5])
      rerender(<BuildingPanel />)
      expect(screen.getByText('20%')).toBeInTheDocument()
    })
  })
})
