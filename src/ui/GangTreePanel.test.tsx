import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GANG_MAX_LEVEL,
  MAX_REPUTATION,
  getTotalReputationForLevel,
} from '../game/gangProgression'
import { useGangStore } from '../store/useGangStore'
import { useAdventureStore } from '../store/useAdventureStore'
import { useChapterStore } from '../store/useChapterStore'
import { useCityStore } from '../store/useCityStore'
import { GangTreePanel } from './GangTreePanel'

const BASE_TIME = 1_700_000_000_000

const ROLE_TEXTS = [
  'Prospect · 见习',
  'Full Patch · 正式成员',
  'Wrench · 技术骨干',
  'Bar Liaison · 酒吧联络人',
  'Road Captain · 路线队长',
  'V. PRESIDENT · 副主席',
  'PRESIDENT · 主席',
]

describe('GangTreePanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useGangStore.getState().reset(BASE_TIME)
    useAdventureStore.getState().reset(BASE_TIME)
    useChapterStore.getState().reset()
    useCityStore.getState().reset(BASE_TIME)
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <GangTreePanel open={false} onClose={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('moves focus to the hierarchy title and names the gang', () => {
    render(<GangTreePanel open onClose={vi.fn()} />)

    const title = screen.getByRole('heading', { name: '帮派权力树' })
    expect(title).toHaveAttribute('tabindex', '-1')
    expect(title).toHaveFocus()
    expect(screen.getByText('帮派名称')).toBeInTheDocument()
    expect(screen.getByText('剃刀党')).toBeInTheDocument()
  })

  it('renders seven core seats, named holders, support positions and management links', () => {
    render(<GangTreePanel open onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: '帮派权力树' })
    expect(dialog).not.toHaveAttribute('aria-modal')
    expect(
      screen.getByRole('list', { name: '剃刀党管辖关系' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(7)

    for (const roleText of ROLE_TEXTS) {
      expect(screen.getByText(roleText)).toBeInTheDocument()
    }

    expect(screen.getByText('Winston Cole')).toBeInTheDocument()
    expect(screen.getByText('Solomon Price')).toBeInTheDocument()
    expect(screen.getAllByText('管辖')).toHaveLength(7)
  })

  it('replaces the current seat holder with Thomas and moves the former holder under command', () => {
    render(<GangTreePanel open onClose={vi.fn()} />)

    const currentSeat = document.querySelector(
      '.gang-tree-panel__tier[data-state="current"]',
    )
    expect(currentSeat).toHaveAttribute('data-threshold', '1')
    expect(currentSeat).toHaveTextContent('Thomas Shelby')
    expect(currentSeat).toHaveTextContent('Eddie “Pins” Doyle')
    expect(currentSeat).toHaveTextContent('前任 见习 · 现直属下属')
    expect(currentSeat).toHaveTextContent('你在这里')
  })

  it('shows higher seats as superiors and completed core seats as subordinates', () => {
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(16),
      currentLevel: 16,
    })

    render(<GangTreePanel open onClose={vi.fn()} />)

    const prospect = document.querySelector(
      '.gang-tree-panel__tier[data-threshold="1"]',
    )
    const fullPatch = document.querySelector(
      '.gang-tree-panel__tier[data-threshold="8"]',
    )
    const wrench = document.querySelector(
      '.gang-tree-panel__tier[data-threshold="16"]',
    )
    const liaison = document.querySelector(
      '.gang-tree-panel__tier[data-threshold="24"]',
    )

    expect(prospect).toHaveAttribute('data-state', 'subordinate')
    expect(fullPatch).toHaveAttribute('data-state', 'subordinate')
    expect(wrench).toHaveAttribute('data-state', 'current')
    expect(wrench).toHaveTextContent('Thomas Shelby')
    expect(liaison).toHaveAttribute('data-state', 'superior')
    expect(screen.getByText('管辖 3 个核心席位')).toBeInTheDocument()
  })

  it('shows the next level rewards and exact unlock rewards in the lower dock', () => {
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(11),
      currentLevel: 11,
    })

    render(<GangTreePanel open onClose={vi.fn()} />)

    expect(screen.getByText('晋升奖励')).toBeInTheDocument()
    expect(screen.getByText('帮派等级 Lv.12')).toBeInTheDocument()
    expect(screen.getByText('Arthur Shelby·Arthur')).toBeInTheDocument()
    expect(screen.getByText('枪械·双管短喷')).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: '帮派晋升进度' }),
    ).toBeInTheDocument()
  })

  it('promotes one level and blocks a role promotion until the chapter is complete', async () => {
    const user = userEvent.setup()
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(2),
      currentLevel: 1,
    })
    const { rerender } = render(<GangTreePanel open onClose={() => {}} />)

    expect(
      screen.getByRole('status', { name: '帮派等级可晋升' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '晋升一级' }))
    expect(useGangStore.getState().currentLevel).toBe(2)
    expect(screen.queryByRole('status', { name: '帮派等级可晋升' })).toBeNull()

    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      currentLevel: 7,
    })
    rerender(<GangTreePanel open onClose={() => {}} />)
    expect(screen.getByRole('button', { name: '接掌席位' })).toBeDisabled()
    expect(
      screen.getByText('需完成并领取第一章 · 冷炉初燃奖励'),
    ).toBeInTheDocument()
  })

  it('plays a special ceremony when a core role promotion succeeds', async () => {
    const user = userEvent.setup()
    const adventure = useAdventureStore.getState()
    const city = useCityStore.getState()
    useAdventureStore.setState({
      heroLevels: { ...adventure.heroLevels, foreman: 1 },
      highestClearedStage: 2,
      highestClearedRacingStage: 1,
    })
    useCityStore.setState({
      buildingProgress: {
        ...city.buildingProgress,
        'repair-shop': {
          ...city.buildingProgress['repair-shop'],
          level: 2,
        },
      },
    })
    useChapterStore.setState({ claimedChapterNumbers: [1] })
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      currentLevel: 7,
    })

    render(<GangTreePanel open onClose={() => {}} />)
    await user.click(screen.getByRole('button', { name: '接掌席位' }))

    expect(useGangStore.getState().currentLevel).toBe(8)
    expect(
      screen.getByRole('status', { name: '职级晋升：正式成员' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Full Patch · 正式成员')).toHaveLength(2)
    expect(screen.getAllByText(/Maeve “Red” Quinn 已交出席位/)).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: '跳过晋升演出' }))
    expect(
      screen.queryByRole('status', { name: '职级晋升：正式成员' }),
    ).toBeNull()
  })

  it('closes when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<GangTreePanel open onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: '关闭帮派树' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape while open and stops listening after close', () => {
    const onClose = vi.fn()
    const { rerender } = render(<GangTreePanel open onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(<GangTreePanel open={false} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps overlay, panel and close interactions from reaching a parent scene', async () => {
    const user = userEvent.setup()
    const onParentPointerDown = vi.fn()
    const onParentClick = vi.fn()

    render(
      <div onPointerDown={onParentPointerDown} onClick={onParentClick}>
        <GangTreePanel open onClose={vi.fn()} />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: '关闭帮派树' }))
    await user.click(screen.getByRole('dialog', { name: '帮派权力树' }))

    expect(onParentPointerDown).not.toHaveBeenCalled()
    expect(onParentClick).not.toHaveBeenCalled()
  })

  it('shows the highest role and completed reward state at level 50', () => {
    useGangStore.setState({
      totalReputation: MAX_REPUTATION,
      currentLevel: 50,
    })

    render(<GangTreePanel open onClose={vi.fn()} />)

    expect(screen.getByText('剃刀党最高权力已经归你')).toBeInTheDocument()
    expect(screen.getByText('最高权力')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '已满级' })).toBeDisabled()
    expect(screen.getByText('管辖 7 个核心席位')).toBeInTheDocument()

    const president = document.querySelector(
      '.gang-tree-panel__tier[data-threshold="50"]',
    )
    expect(president).toHaveAttribute('data-state', 'current')
    expect(president).toHaveAttribute('aria-current', 'step')
  })

  it('keeps the configured maximum level stable', () => {
    expect(GANG_MAX_LEVEL).toBe(50)
  })
})
