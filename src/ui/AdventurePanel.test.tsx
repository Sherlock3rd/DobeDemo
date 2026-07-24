import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChestTick } from '../game/chestTick'
import { ADVENTURE_STORAGE_KEY } from '../store/adventureMigration'
import { useAdventureStore } from '../store/useAdventureStore'
import { AdventurePanel } from './AdventurePanel'

const BASE_TIME = 1_700_000_000_000

describe('AdventurePanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAdventureStore.getState().reset(BASE_TIME)
    useChestTick.setState({ tick: 0, now: 0 })
  })

  it('moves focus to its programmatically focusable title when opened', () => {
    render(<AdventurePanel onClose={() => {}} onChallenge={() => {}} />)

    const title = screen.getByRole('heading', { name: '推关战役' })
    expect(title).toHaveAttribute('tabindex', '-1')
    expect(title).toHaveFocus()
  })

  it('shows only the single current challenge stage for a fresh account', () => {
    render(<AdventurePanel onClose={() => {}} onChallenge={() => {}} />)
    expect(screen.getByText('当前关卡 1-1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '挑战 1-1' })).toBeEnabled()
    expect(screen.queryByText(/1-2/)).toBeNull()
  })

  it('advances to the next uncleared stage and never renders cleared stages', async () => {
    const onChallenge = vi.fn()
    useAdventureStore.setState({ highestClearedStage: 2 })
    render(<AdventurePanel onClose={() => {}} onChallenge={onChallenge} />)
    expect(screen.queryByText(/1-1/)).toBeNull()
    expect(screen.queryByText(/1-2/)).toBeNull()
    expect(screen.getByText('当前关卡 1-3')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '挑战 1-3' }))
    expect(onChallenge).toHaveBeenCalledWith(3)
  })

  it('shows campaign completion without a challenge button after stage 20', () => {
    useAdventureStore.setState({ highestClearedStage: 20 })
    render(<AdventurePanel onClose={() => {}} onChallenge={() => {}} />)
    expect(screen.getByText('全部关卡已通关')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^挑战/ })).toBeNull()
  })

  it('claims the idle chest into the shared pool', async () => {
    useAdventureStore.setState({ highestClearedStage: 1, idleClock: 0 })
    vi.spyOn(Date, 'now').mockReturnValue(25_000)
    render(<AdventurePanel onClose={() => {}} onChallenge={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /领取宝箱/ }))
    expect(useAdventureStore.getState().sharedExp).toBe(4)
    vi.restoreAllMocks()
  })

  it('updates claimable display from useChestTick without writing adventure state', () => {
    useAdventureStore.setState({
      highestClearedStage: 1,
      idleClock: BASE_TIME,
    })
    const before = localStorage.getItem(ADVENTURE_STORAGE_KEY)
    render(<AdventurePanel onClose={() => {}} onChallenge={() => {}} />)
    expect(screen.getByText('当前可领取 0')).toBeInTheDocument()
    act(() => {
      useChestTick.setState({ tick: 1, now: BASE_TIME + 25_000 })
    })
    expect(screen.getByText('当前可领取 4')).toBeInTheDocument()
    expect(useAdventureStore.getState().idleClock).toBe(BASE_TIME)
    expect(localStorage.getItem(ADVENTURE_STORAGE_KEY)).toBe(before)
    expect(ADVENTURE_STORAGE_KEY).toBeTruthy()
  })
})
