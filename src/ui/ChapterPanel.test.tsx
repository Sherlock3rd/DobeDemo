import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
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
    render(<ChapterPanel onClose={() => {}} />)

    expect(
      screen.getByRole('heading', { name: '第一章 · 冷炉初燃' }),
    ).toHaveFocus()
    expect(screen.getByText('已完成 1/4')).toBeInTheDocument()
    expect(screen.getByLabelText('章节进度').children).toHaveLength(7)
    expect(screen.getAllByRole('button', { name: '进行中' })).toHaveLength(3)
    expect(screen.getByRole('button', { name: '领取' })).toBeEnabled()
    expect(screen.getByText(/史诗轮胎/)).toBeInTheDocument()
  })

  it('claims a completed reward and switches the task to its claimed state', async () => {
    render(<ChapterPanel onClose={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: '领取' }))

    expect(screen.getByRole('button', { name: '已领取' })).toBeDisabled()
    expect(screen.getByText('领头人就位奖励已领取')).toBeInTheDocument()
    expect(useGangStore.getState().totalReputation).toBe(53)
  })
})
