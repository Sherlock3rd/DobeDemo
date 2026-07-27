import { fireEvent, render, screen, within } from '@testing-library/react'
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
    useChapterStore.setState({ prologueStep: 'complete' })
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

  it('renders seven seats on a top-to-bottom power line with Thomas at his current rank', () => {
    render(<GangTreePanel open onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: '帮派权力树' })
    expect(dialog).not.toHaveAttribute('aria-modal')
    expect(
      screen.getByRole('list', { name: '剃刀党上下职级关系' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(7)

    for (const roleText of ROLE_TEXTS) {
      expect(screen.getAllByText(new RegExp(roleText)).length).toBeGreaterThan(
        0,
      )
    }

    expect(screen.getByText('Winston Cole')).toBeInTheDocument()
    expect(
      screen.getByLabelText('自己：Thomas Shelby，见习'),
    ).toBeInTheDocument()
    expect(
      document.querySelectorAll('.gang-tree-panel__network-lines line'),
    ).toHaveLength(8)
    expect(
      document.querySelector('.gang-tree-panel__network-spine'),
    ).toBeInTheDocument()
    expect(
      (
        document.querySelector(
          '.gang-tree-panel__network-node[data-threshold="50"]',
        ) as HTMLElement
      ).style.getPropertyValue('--node-y'),
    ).toBe('10%')
    expect(
      (
        document.querySelector(
          '.gang-tree-panel__network-node[data-threshold="1"]',
        ) as HTMLElement
      ).style.getPropertyValue('--node-y'),
    ).toBe('88%')
    expect(
      screen
        .getByLabelText('自己：Thomas Shelby，见习')
        .style.getPropertyValue('--player-y'),
    ).toBe('88%')
  })

  it('selects a holder on the vertical line to reveal their role and direct reports', async () => {
    const user = userEvent.setup()
    render(<GangTreePanel open onClose={vi.fn()} />)

    const currentSeat = document.querySelector(
      '.gang-tree-panel__network-node[data-state="current"]',
    )
    expect(currentSeat).toHaveAttribute('data-threshold', '1')
    expect(currentSeat).toHaveTextContent('Eddie “Pins” Doyle')
    expect(currentSeat).toHaveTextContent('前任 · 直属')
    expect(
      screen.getByLabelText('Eddie “Pins” Doyle的职位详情'),
    ).toHaveTextContent('完成席位交接后转入 Thomas 的直属管辖')

    await user.click(
      screen.getByRole('button', {
        name: '查看Winston Cole · 主席 Lv.50',
      }),
    )
    expect(screen.getByLabelText('Winston Cole的职位详情')).toHaveTextContent(
      'Solomon Price（会所总管）',
    )
  })

  it('lets portrait nodes select one role detail', async () => {
    const user = userEvent.setup()
    render(<GangTreePanel open onClose={vi.fn()} />)

    const list = screen.getByRole('list', { name: '剃刀党上下职级关系' })
    const prospect = within(list).getByRole('button', {
      name: '查看Eddie “Pins” Doyle · 见习 Lv.1',
    })
    const president = within(list).getByRole('button', {
      name: '查看Winston Cole · 主席 Lv.50',
    })
    expect(prospect).toHaveAttribute('aria-pressed', 'true')

    await user.click(president)

    expect(president).toHaveAttribute('aria-pressed', 'true')
    expect(prospect).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Winston Cole的职位详情')).toBeInTheDocument()
  })

  it('returns selection to the current role when account progress changes', async () => {
    const user = userEvent.setup()
    useGangStore.setState({
      totalReputation: MAX_REPUTATION,
      currentLevel: 50,
    })
    const { rerender } = render(<GangTreePanel open onClose={vi.fn()} />)
    await user.click(
      screen.getByRole('button', {
        name: '查看Maeve “Red” Quinn · 正式成员 Lv.8',
      }),
    )
    expect(
      screen.getByLabelText('Maeve “Red” Quinn的职位详情'),
    ).toBeInTheDocument()

    useGangStore.getState().reset(BASE_TIME)
    rerender(<GangTreePanel open onClose={vi.fn()} />)

    expect(
      screen.getByLabelText('Eddie “Pins” Doyle的职位详情'),
    ).toBeInTheDocument()
  })

  it('shows higher seats as superiors and completed core seats as subordinates', () => {
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(16),
      currentLevel: 16,
    })

    render(<GangTreePanel open onClose={vi.fn()} />)

    const prospect = document.querySelector(
      '.gang-tree-panel__network-node[data-threshold="1"]',
    )
    const fullPatch = document.querySelector(
      '.gang-tree-panel__network-node[data-threshold="8"]',
    )
    const wrench = document.querySelector(
      '.gang-tree-panel__network-node[data-threshold="16"]',
    )
    const liaison = document.querySelector(
      '.gang-tree-panel__network-node[data-threshold="24"]',
    )

    expect(prospect).toHaveAttribute('data-state', 'subordinate')
    expect(fullPatch).toHaveAttribute('data-state', 'subordinate')
    expect(wrench).toHaveAttribute('data-state', 'current')
    expect(wrench).toHaveTextContent('Arthur Shelby')
    expect(liaison).toHaveAttribute('data-state', 'superior')
    expect(screen.getByText('管辖 3 个核心席位')).toBeInTheDocument()
  })

  it('shows the next level rewards and exact unlock rewards in the lower dock', () => {
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(15),
      currentLevel: 15,
    })

    render(<GangTreePanel open onClose={vi.fn()} />)

    expect(screen.getByText('晋升奖励')).toBeInTheDocument()
    expect(screen.getByText('帮派等级 Lv.16')).toBeInTheDocument()
    expect(screen.getByText('Arthur Shelby·Arthur')).toBeInTheDocument()
    expect(screen.getByText('商业街')).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: '和平交接' })).toBeDisabled()
    expect(
      screen.getByText('需完成并领取序章 · 逃亡者的补丁奖励'),
    ).toBeInTheDocument()
  })

  it('plays a special ceremony when a core role promotion succeeds', async () => {
    const user = userEvent.setup()
    const onRolePromoted = vi.fn()
    const onStartRoleHandover = vi.fn()
    const onPromotionCeremonyComplete = vi.fn()
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

    const { rerender } = render(
      <GangTreePanel
        open
        onClose={() => {}}
        onRolePromoted={onRolePromoted}
        onStartRoleHandover={onStartRoleHandover}
        onPromotionCeremonyComplete={onPromotionCeremonyComplete}
      />,
    )
    await user.click(screen.getByRole('button', { name: '和平交接' }))

    expect(useGangStore.getState().currentLevel).toBe(7)
    expect(onStartRoleHandover).toHaveBeenCalledWith(
      expect.objectContaining({
        targetLevel: 8,
        mode: 'dialogue',
      }),
    )

    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      currentLevel: 8,
    })
    rerender(
      <GangTreePanel
        open
        onClose={() => {}}
        onRolePromoted={onRolePromoted}
        onStartRoleHandover={onStartRoleHandover}
        promotionCeremonyLevel={8}
        onPromotionCeremonyComplete={onPromotionCeremonyComplete}
      />,
    )
    expect(
      screen.getByRole('status', { name: '职级晋升：正式成员' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/Full Patch · 正式成员/).length).toBeGreaterThan(
      0,
    )
    expect(screen.getByText(/Maeve “Red” Quinn 已交出席位/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '跳过晋升演出' }))
    rerender(
      <GangTreePanel
        open
        onClose={() => {}}
        onRolePromoted={onRolePromoted}
        onStartRoleHandover={onStartRoleHandover}
        promotionCeremonyLevel={null}
        onPromotionCeremonyComplete={onPromotionCeremonyComplete}
      />,
    )
    expect(
      screen.queryByRole('status', { name: '职级晋升：正式成员' }),
    ).toBeNull()
    expect(onPromotionCeremonyComplete).toHaveBeenCalledTimes(1)
    expect(onRolePromoted).toHaveBeenCalledWith(8)
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
      '.gang-tree-panel__network-node[data-threshold="50"]',
    )
    expect(president).toHaveAttribute('data-state', 'current')
    expect(
      within(president as HTMLElement).getByRole('button'),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the configured maximum level stable', () => {
    expect(GANG_MAX_LEVEL).toBe(50)
  })
})
