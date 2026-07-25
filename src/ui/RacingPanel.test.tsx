import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdventureStore } from '../store/useAdventureStore'
import { useGangStore } from '../store/useGangStore'
import { RacingPanel } from './RacingPanel'

describe('RacingPanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAdventureStore.getState().reset(1_700_000_000_000)
    useGangStore.getState().reset(1_700_000_000_000)
  })

  it('shows only the exact next playable stage and starts with equipped hero', async () => {
    const onStart = vi.fn()
    render(<RacingPanel onClose={() => {}} onStart={onStart} />)
    expect(screen.getByText('第 1 关')).toBeInTheDocument()
    expect(screen.queryByText('第 2 关')).toBeNull()
    expect(screen.getByText(/满三格双击超级飞跃/)).toBeInTheDocument()
    expect(screen.getByText(/七车同场/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '发车' }))
    expect(onStart).toHaveBeenCalledWith(1, 'foreman')
  })

  it('hides cleared stages and advances to the next stage', () => {
    useAdventureStore.setState({ highestClearedRacingStage: 1 })
    render(<RacingPanel onClose={() => {}} onStart={() => {}} />)
    expect(screen.getByText('第 2 关')).toBeInTheDocument()
    expect(screen.queryByText('第 1 关')).toBeNull()
    expect(screen.getByText('追击枪战')).toBeInTheDocument()
  })

  it('shows completion without replay buttons after stage ten', () => {
    useAdventureStore.setState({ highestClearedRacingStage: 10 })
    render(<RacingPanel onClose={() => {}} onStart={() => {}} />)
    expect(screen.getByText('十关全部完成')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '发车' })).toBeNull()
  })
})
