import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdventureStore } from '../store/useAdventureStore'
import { useChapterStore } from '../store/useChapterStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { PROLOGUE_TUNED_PART } from '../game/prologue'
import { ChapterPanel } from './ChapterPanel'

const BASE_TIME = 1_700_000_000_000

describe('ChapterPanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useGangStore.getState().reset(BASE_TIME)
    useAdventureStore.getState().reset(BASE_TIME)
    useCityStore.getState().reset(BASE_TIME)
    useChapterStore.getState().reset()
  })

  it('shows the three prologue duties without a chapter-meeting action', () => {
    render(<ChapterPanel onClose={() => {}} onNavigateTask={() => {}} />)

    expect(
      screen.getByRole('heading', { name: '序章 · 逃亡者的补丁' }),
    ).toHaveFocus()
    expect(
      screen.getByRole('status', { name: '当前第 1 章' }),
    ).toBeInTheDocument()
    expect(screen.getByText('已完成 0/3')).toBeInTheDocument()
    expect(screen.queryByLabelText('七章总览')).not.toBeInTheDocument()
    expect(screen.queryByText('主席之路')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '进行中' })).toHaveLength(3)
    expect(screen.queryByRole('button', { name: '领取' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: '前往英雄升级' }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^前往/ })).toHaveLength(3)
    expect(screen.getByText('转正任务提交')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: '已领取 0/3 · 全部领取后自动推进',
      }),
    ).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: /评定会议/ }),
    ).not.toBeInTheDocument()
  })

  it('updates the compact current-chapter identity without previewing neighbors', () => {
    useGangStore.setState({ currentLevel: 24 })
    useChapterStore.setState({
      activeChapterNumber: 4,
      selectedTaskPackageIds: { 4: 'chapter-4-package-random-a' },
    })

    render(<ChapterPanel onClose={() => {}} onNavigateTask={() => {}} />)

    expect(
      screen.getByRole('status', { name: '当前第 4 章' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('扳手与账本')).not.toBeInTheDocument()
    expect(screen.queryByText('公路号令')).not.toBeInTheDocument()
  })

  it('claims a completed reward and switches the task to its claimed state', async () => {
    useCityStore.setState({ claimedBuildingIds: ['repair-shop'] })
    render(<ChapterPanel onClose={() => {}} onNavigateTask={() => {}} />)

    const heroTask = screen
      .getByRole('heading', { name: '接过修车厂' })
      .closest('article')
    expect(heroTask).not.toBeNull()
    await userEvent.click(
      within(heroTask as HTMLElement).getByRole('button', { name: '领取' }),
    )

    expect(screen.getByRole('button', { name: '已领取' })).toBeDisabled()
    expect(screen.getByText('接过修车厂奖励已领取')).toBeInTheDocument()
    expect(useGangStore.getState().totalReputation).toBe(30)
  })

  it('navigates a task to its relevant development surface', async () => {
    const onNavigateTask = vi.fn()
    render(<ChapterPanel onClose={() => {}} onNavigateTask={onNavigateTask} />)

    const upgradeTask = screen
      .getByRole('heading', { name: '重新点炉' })
      .closest('article')
    await userEvent.click(
      within(upgradeTask as HTMLElement).getByRole('button', {
        name: '前往对应建筑',
      }),
    )

    expect(onNavigateTask).toHaveBeenCalledWith({
      kind: 'building-level',
      buildingId: 'repair-shop',
      target: 2,
    })
  })

  it('requires all three prologue task rewards and never opens a meeting here', async () => {
    const adventure = useAdventureStore.getState()
    useAdventureStore.setState({
      carPartInventory: [...adventure.carPartInventory, PROLOGUE_TUNED_PART],
      carPartSlotsByCar: {
        ...adventure.carPartSlotsByCar,
        'rust-fox': {
          ...adventure.carPartSlotsByCar['rust-fox'],
          engine: PROLOGUE_TUNED_PART.id,
        },
      },
    })
    useCityStore.setState((state) => ({
      claimedBuildingIds: ['repair-shop'],
      buildingProgress: {
        ...state.buildingProgress,
        'repair-shop': {
          ...state.buildingProgress['repair-shop'],
          level: 2,
        },
      },
    }))
    render(<ChapterPanel onClose={() => {}} onNavigateTask={() => {}} />)

    for (const button of screen.getAllByRole('button', { name: '领取' })) {
      await userEvent.click(button)
    }

    expect(
      screen.getByRole('button', {
        name: '已领取 3/3 · 全部领取后自动推进',
      }),
    ).toBeDisabled()
    expect(useChapterStore.getState().claimedChapterNumbers).toEqual([])
    expect(useGangStore.getState().totalReputation).toBe(90)
    expect(useAdventureStore.getState()).toMatchObject({
      sharedExp: 420,
      spareParts: 42,
    })
    expect(screen.queryByRole('button', { name: /评定会议/ })).toBeNull()
  })
})
