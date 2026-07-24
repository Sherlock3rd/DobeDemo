import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdventureStore } from '../store/useAdventureStore'
import { useGangStore } from '../store/useGangStore'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: ReactNode }) => (
    <div data-testid="battle-canvas">{children}</div>
  ),
}))

vi.mock('../scene/battle/BattleScene', () => ({
  BattleScene: () => <div data-testid="battle-scene-mock" />,
}))

vi.mock('../scene/city/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))

const { BattleScreen } = await import('./BattleScreen')

describe('BattleScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAdventureStore.getState().reset(0)
    useGangStore.getState().reset(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('plays to victory and commits the first clear exactly once at resolve', () => {
    const onExit = vi.fn()
    render(<BattleScreen stage={1} onExit={onExit} />)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(useAdventureStore.getState().highestClearedStage).toBe(1)
    expect(useAdventureStore.getState().sharedExp).toBe(500)
    expect(screen.getByText(/VICTORY|胜利/)).toBeInTheDocument()
  })

  it('exit before resolve commits nothing', () => {
    const onExit = vi.fn()
    render(<BattleScreen stage={1} onExit={onExit} />)
    fireEvent.click(screen.getByRole('button', { name: /退出/ }))
    fireEvent.click(screen.getByRole('button', { name: /确认退出/ }))
    expect(onExit).toHaveBeenCalled()
    expect(useAdventureStore.getState().highestClearedStage).toBe(0)
    expect(useAdventureStore.getState().sharedExp).toBe(0)
  })
})
