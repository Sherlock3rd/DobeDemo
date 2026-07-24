import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdventureStore } from '../store/useAdventureStore'
import { AdventurePanel } from './AdventurePanel'

const BASE_TIME = 1_700_000_000_000

describe('AdventurePanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAdventureStore.getState().reset(BASE_TIME)
  })

  it('renders 20 stage nodes across two chapters', () => {
    render(<AdventurePanel onClose={() => {}} onChallenge={() => {}} />)
    expect(screen.getByRole('button', { name: /^1-1 ·/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^2-10 ·/ })).toBeDisabled()
  })

  it('only allows challenging unlocked stages', async () => {
    const onChallenge = vi.fn()
    useAdventureStore.setState({ highestClearedStage: 2 })
    render(<AdventurePanel onClose={() => {}} onChallenge={onChallenge} />)
    await userEvent.click(screen.getByRole('button', { name: /^1-3 ·/ }))
    await userEvent.click(screen.getByRole('button', { name: /^挑战/ }))
    expect(onChallenge).toHaveBeenCalledWith(3)
  })

  it('claims the idle chest into the shared pool', async () => {
    useAdventureStore.setState({ highestClearedStage: 1, idleClock: 0 })
    vi.spyOn(Date, 'now').mockReturnValue(25_000)
    render(<AdventurePanel onClose={() => {}} onChallenge={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /领取宝箱/ }))
    expect(useAdventureStore.getState().sharedExp).toBe(4)
    vi.restoreAllMocks()
  })
})
