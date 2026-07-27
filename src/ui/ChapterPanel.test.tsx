import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdventureStore } from '../store/useAdventureStore'
import { useChapterStore } from '../store/useChapterStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
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

  it('shows the current chapter story, seven-step rail, and four task states', () => {
    render(<ChapterPanel onClose={() => {}} onNavigateTask={() => {}} />)

    expect(
      screen.getByRole('heading', { name: '第一章 · 冷炉初燃' }),
    ).toHaveFocus()
    expect(screen.getByText('已完成 1/4')).toBeInTheDocument()
    expect(screen.getByLabelText('章节进度').children).toHaveLength(7)
    expect(screen.getAllByRole('button', { name: '进行中' })).toHaveLength(3)
    expect(screen.getByRole('button', { name: '领取' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: '前往英雄升级' }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^前往/ })).toHaveLength(3)
    expect(screen.getByText(/史诗轮胎/)).toBeInTheDocument()
  })

  it('claims a completed reward and switches the task to its claimed state', async () => {
    render(<ChapterPanel onClose={() => {}} onNavigateTask={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: '领取' }))

    expect(screen.getByRole('button', { name: '已领取' })).toBeDisabled()
    expect(screen.getByText('领头人就位奖励已领取')).toBeInTheDocument()
    expect(useGangStore.getState().totalReputation).toBe(20)
  })

  it('navigates a task to its relevant development surface', async () => {
    const onNavigateTask = vi.fn()
    render(<ChapterPanel onClose={() => {}} onNavigateTask={onNavigateTask} />)

    await userEvent.click(screen.getByRole('button', { name: '前往对应建筑' }))

    expect(onNavigateTask).toHaveBeenCalledWith({
      kind: 'building-level',
      buildingId: 'repair-shop',
      target: 2,
    })
  })

  it('claims the separate chapter reward once after every task is complete', async () => {
    const onChapterCompleted = vi.fn()
    useAdventureStore.setState((state) => ({
      heroLevels: { ...state.heroLevels, foreman: 3 },
      highestClearedStage: 2,
      highestClearedRacingStage: 1,
    }))
    useCityStore.setState((state) => ({
      buildingProgress: {
        ...state.buildingProgress,
        'repair-shop': {
          ...state.buildingProgress['repair-shop'],
          level: 2,
        },
      },
    }))
    render(
      <ChapterPanel
        onClose={() => {}}
        onNavigateTask={() => {}}
        onChapterCompleted={onChapterCompleted}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '领取章节奖励' }))

    expect(
      screen.getByRole('button', { name: '章节奖励已领取' }),
    ).toBeDisabled()
    expect(useChapterStore.getState().claimedChapterNumbers).toEqual([1])
    expect(useGangStore.getState().totalReputation).toBe(132)
    expect(useAdventureStore.getState()).toMatchObject({
      sharedExp: 600,
      spareParts: 80,
      chapterUnlockedCarIds: ['iron-fang'],
    })
    expect(useCityStore.getState().resources.money).toBe(10_500)
    expect(onChapterCompleted).toHaveBeenCalledWith(1)
  })
})
