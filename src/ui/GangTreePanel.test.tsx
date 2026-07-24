import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GANG_MAX_LEVEL,
  MAX_REPUTATION,
  getTotalReputationForLevel,
} from '../game/gangProgression'
import { useGangStore } from '../store/useGangStore'
import { GangTreePanel } from './GangTreePanel'

const BASE_TIME = 1_700_000_000_000

const ROLE_TEXTS = [
  'Prospect（见习）',
  'Full Patch（正式成员）',
  'Wrench（技术骨干）',
  'Bar Liaison（酒吧联络人）',
  'Road Captain（路线队长）',
  'V. PRESIDENT（副主席）',
  'PRESIDENT（主席）',
]

const BUILDING_NAMES = [
  '修车厂',
  '废车回收厂',
  '商业街',
  '金属加工厂',
  '加油站',
  'Clubhouse',
]

describe('GangTreePanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useGangStore.getState().reset(BASE_TIME)
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <GangTreePanel open={false} onClose={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders a dialog with 50 level nodes, 7 role texts and 6 building names when open', () => {
    render(<GangTreePanel open onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: '帮派树' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    expect(screen.getAllByRole('listitem')).toHaveLength(GANG_MAX_LEVEL)

    for (const roleText of ROLE_TEXTS) {
      expect(screen.getByText(roleText)).toBeInTheDocument()
    }

    for (const buildingName of BUILDING_NAMES) {
      expect(
        screen.getByText(buildingName, { exact: false }),
      ).toBeInTheDocument()
    }
  })

  it('shows level 1 as current, level 2 as locked, and the repair shop unlocked while the recycling yard is locked at zero reputation', () => {
    render(<GangTreePanel open onClose={vi.fn()} />)

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveAttribute('data-state', 'current')
    expect(items[0]).toHaveAttribute('aria-current', 'step')
    expect(items[1]).toHaveAttribute('data-state', 'locked')
    expect(items[1]).not.toHaveAttribute('aria-current')

    expect(screen.getByText('修车厂 已解锁')).toBeInTheDocument()
    expect(screen.getByText('废车回收厂 待解锁')).toBeInTheDocument()

    expect(
      screen.getByText('Full Patch（正式成员） · 需要 Lv. 8', { exact: false }),
    ).toBeInTheDocument()
  })

  it('marks levels below the current level as completed and unlocks buildings up to level 16', () => {
    useGangStore.setState({ totalReputation: getTotalReputationForLevel(16) })

    render(<GangTreePanel open onClose={vi.fn()} />)

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveAttribute('data-state', 'completed')
    expect(items[14]).toHaveAttribute('data-state', 'completed')
    expect(items[15]).toHaveAttribute('data-state', 'current')
    expect(items[15]).toHaveAttribute('aria-current', 'step')
    expect(items[16]).toHaveAttribute('data-state', 'locked')

    expect(screen.getByText('修车厂 已解锁')).toBeInTheDocument()
    expect(screen.getByText('废车回收厂 已解锁')).toBeInTheDocument()
    expect(screen.getByText('商业街 已解锁')).toBeInTheDocument()
    expect(screen.getByText('金属加工厂 待解锁')).toBeInTheDocument()
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
    await user.click(screen.getByRole('dialog', { name: '帮派树' }))

    expect(onParentPointerDown).not.toHaveBeenCalled()
    expect(onParentClick).not.toHaveBeenCalled()
  })

  it('shows the highest role copy at level 50', () => {
    useGangStore.setState({ totalReputation: MAX_REPUTATION })

    render(<GangTreePanel open onClose={vi.fn()} />)

    expect(screen.getByText('已达到最高职位')).toBeInTheDocument()

    const items = screen.getAllByRole('listitem')
    expect(items[GANG_MAX_LEVEL - 1]).toHaveAttribute('data-state', 'current')
    expect(items[GANG_MAX_LEVEL - 1]).toHaveAttribute('aria-current', 'step')
  })

  it('renders multiple unlocks on a single level node', () => {
    useGangStore.setState({
      totalReputation: MAX_REPUTATION,
      lastUpdatedAt: BASE_TIME,
    })
    render(<GangTreePanel open onClose={() => {}} />)
    const lv1 = screen.getByText('等级 1').closest('li') as HTMLElement
    expect(lv1).toHaveTextContent('修车厂')
    expect(lv1).toHaveTextContent('战役')
    expect(lv1).toHaveTextContent('英雄')
    expect(lv1).toHaveTextContent('陈锤')
    const lv12 = screen.getByText('等级 12').closest('li') as HTMLElement
    expect(lv12).toHaveTextContent('岳峰')
  })
})
