import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChestTick } from '../game/chestTick'
import { getTotalReputationForLevel } from '../game/gangProgression'
import { ADVENTURE_STORAGE_KEY } from '../store/adventureMigration'
import { useAdventureStore } from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { useChapterStore } from '../store/useChapterStore'
import { GlobalHud } from './GlobalHud'

const BASE_TIME = 1_700_000_000_000

describe('GlobalHud', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset(BASE_TIME)
    useGangStore.getState().reset(BASE_TIME)
    useAdventureStore.getState().reset(BASE_TIME)
    useChapterStore.getState().reset()
    useChestTick.setState({ tick: 0, now: 0 })
  })

  it('renders only money, oil, and materials in the main resource HUD', () => {
    render(
      <GlobalHud
        onOpenHeroes={() => {}}
        onOpenGangTree={() => {}}
        onOpenAdventure={() => {}}
        onOpenRacing={() => {}}
        onOpenSettings={() => {}}
      />,
    )
    const resources = screen.getByLabelText('资源')
    expect(resources.querySelectorAll('.resource-amount')).toHaveLength(3)
    expect(screen.getByLabelText('钱 10000')).toBeInTheDocument()
    expect(screen.getByLabelText('油 0')).toBeInTheDocument()
    expect(screen.getByLabelText('物资 0')).toBeInTheDocument()
    expect(screen.queryByText(/10秒/)).toBeNull()
    expect(screen.queryByText(/英雄经验/)).toBeNull()
    expect(screen.getByText('Thomas Shelby')).toBeInTheDocument()
    const top = screen
      .getByLabelText('主界面 HUD')
      .querySelector('.global-hud__top')
    const gangButton = screen.getByRole('button', {
      name: /Prospect.*战力 \d+/,
    })
    expect(top).not.toBeNull()
    expect(gangButton).toContainElement(screen.getByLabelText(/战力 \d+/))
    expect(
      top?.querySelector(':scope > .resource-amount'),
    ).not.toBeInTheDocument()
  })

  it('shows gang level, role, and account power in one accessible gang entry', () => {
    useGangStore.setState({
      totalReputation: 330,
      currentLevel: 12,
      lastUpdatedAt: BASE_TIME,
    })
    render(
      <GlobalHud
        onOpenHeroes={() => {}}
        onOpenGangTree={() => {}}
        onOpenAdventure={() => {}}
        onOpenRacing={() => {}}
        onOpenSettings={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', {
        name: /Lv\.\d+ Full Patch.*战力 \d+/,
      }),
    ).toBeInTheDocument()
  })

  it('shows and clears a gang promotion prompt as readiness changes', () => {
    useGangStore.setState({
      totalReputation: 30,
      currentLevel: 1,
    })
    render(
      <GlobalHud
        onOpenHeroes={() => {}}
        onOpenGangTree={() => {}}
        onOpenAdventure={() => {}}
        onOpenRacing={() => {}}
        onOpenSettings={() => {}}
      />,
    )

    expect(screen.getByLabelText('帮派等级可晋升')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Lv\.1.*可晋升/ }),
    ).toHaveAttribute('data-promotion-ready', 'true')

    act(() => {
      useGangStore.setState({ currentLevel: 2 })
    })

    expect(screen.queryByLabelText('帮派等级可晋升')).toBeNull()
  })

  it('does not show a promotion prompt at a role boundary before chapter completion', () => {
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      currentLevel: 7,
    })
    render(
      <GlobalHud
        onOpenHeroes={() => {}}
        onOpenGangTree={() => {}}
        onOpenAdventure={() => {}}
        onOpenRacing={() => {}}
        onOpenSettings={() => {}}
      />,
    )

    expect(screen.queryByLabelText('帮派等级可晋升')).toBeNull()
  })

  it('uses current formation rows when aggregating account power', () => {
    render(
      <GlobalHud
        onOpenHeroes={() => {}}
        onOpenGangTree={() => {}}
        onOpenAdventure={() => {}}
        onOpenRacing={() => {}}
        onOpenSettings={() => {}}
      />,
    )
    const before = screen.getByLabelText(/战力 \d+/).getAttribute('aria-label')
    act(() => {
      useAdventureStore.setState({
        formation: [{ heroId: 'foreman', row: 'front', index: 0 }],
      })
    })
    const after = screen.getByLabelText(/战力 \d+/).getAttribute('aria-label')
    expect(after).not.toBe(before)
  })

  it('routes bottom nav callbacks', async () => {
    const onOpenAdventure = vi.fn()
    const onOpenRacing = vi.fn()
    const onOpenChapters = vi.fn()
    render(
      <GlobalHud
        onOpenHeroes={() => {}}
        onOpenGangTree={() => {}}
        onOpenChapters={onOpenChapters}
        onOpenAdventure={onOpenAdventure}
        onOpenRacing={onOpenRacing}
        onOpenSettings={() => {}}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /推关/ }))
    expect(onOpenAdventure).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '赛车' }))
    expect(onOpenRacing).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /章节 1/ }))
    expect(onOpenChapters).toHaveBeenCalled()
  })

  it('shows the adventure red dot for a fresh account', () => {
    render(
      <GlobalHud
        onOpenHeroes={() => {}}
        onOpenGangTree={() => {}}
        onOpenAdventure={() => {}}
        onOpenRacing={() => {}}
        onOpenSettings={() => {}}
      />,
    )
    expect(
      screen.getByLabelText('有可挑战关卡或可领取宝箱'),
    ).toBeInTheDocument()
  })

  it('refreshes claimable chest state without exposing exp in the resource HUD', () => {
    useAdventureStore.setState({
      highestClearedStage: 1,
      idleClock: BASE_TIME,
      sharedExp: 0,
    })
    const before = localStorage.getItem(ADVENTURE_STORAGE_KEY)
    render(
      <GlobalHud
        onOpenHeroes={() => {}}
        onOpenGangTree={() => {}}
        onOpenAdventure={() => {}}
        onOpenRacing={() => {}}
        onOpenSettings={() => {}}
      />,
    )
    expect(screen.queryByText(/可领/)).toBeNull()
    act(() => {
      useChestTick.setState({ tick: 1, now: BASE_TIME + 25_000 })
    })
    expect(screen.queryByText(/可领/)).toBeNull()
    expect(useAdventureStore.getState().idleClock).toBe(BASE_TIME)
    expect(useAdventureStore.getState().sharedExp).toBe(0)
    expect(localStorage.getItem(ADVENTURE_STORAGE_KEY)).toBe(before)
    expect(ADVENTURE_STORAGE_KEY).toBeTruthy()
  })
})
