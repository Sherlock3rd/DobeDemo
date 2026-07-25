import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdventureStore } from '../store/useAdventureStore'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: ReactNode }) => (
    <div data-testid="race-canvas">{children}</div>
  ),
}))

vi.mock('../scene/racing/RacingScene', () => ({
  RacingScene: () => <div data-testid="racing-scene-mock" />,
}))

const { RaceScreen } = await import('./RaceScreen')

describe('RaceScreen V2', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAdventureStore.getState().reset(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('explains the pursuit objective, convoy state, and weapon controls', () => {
    render(<RaceScreen stage={2} heroId="foreman" onExit={() => {}} />)

    expect(screen.getByText('突破护卫 · 摧毁装甲目标车')).toBeInTheDocument()
    expect(screen.getByText(/护卫 2\/2/)).toBeInTheDocument()
    expect(screen.getByText(/普通攻击 自动开火/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '火力强化' })).toBeInTheDocument()
  })

  it('shows the four-car race and hold-to-drift controls', () => {
    render(<RaceScreen stage={1} heroId="foreman" onExit={() => {}} />)

    expect(
      screen.getByText('四车对抗 · 漂移与特技补充氮气'),
    ).toBeInTheDocument()
    expect(screen.getByText('当前排名 4/4')).toBeInTheDocument()
    expect(screen.getAllByText('按住漂移')).toHaveLength(2)
  })

  it('uses A/D and left/right arrows for desktop lane changes', () => {
    render(<RaceScreen stage={1} heroId="foreman" onExit={() => {}} />)
    const screenRoot = screen.getByRole('dialog', { name: '公路争霸' })

    fireEvent.keyDown(window, { key: 'a' })
    fireEvent.keyUp(window, { key: 'a' })
    act(() => vi.advanceTimersByTime(50))
    expect(screenRoot).toHaveAttribute('data-player-lane', '0')
    act(() => vi.advanceTimersByTime(50))

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyUp(window, { key: 'ArrowRight' })
    act(() => vi.advanceTimersByTime(50))
    expect(screenRoot).toHaveAttribute('data-player-lane', '1')
  })

  it('auto-fires and turns F or the button into a cooldown fire boost', () => {
    render(<RaceScreen stage={2} heroId="foreman" onExit={() => {}} />)
    const screenRoot = screen.getByRole('dialog', { name: '公路争霸' })

    act(() => vi.advanceTimersByTime(50))
    expect(Number(screenRoot.getAttribute('data-shots'))).toBeGreaterThan(0)

    fireEvent.keyDown(window, { key: 'f' })
    act(() => vi.advanceTimersByTime(50))
    expect(Number(screenRoot.getAttribute('data-fire-boost'))).toBeGreaterThan(
      0,
    )
    expect(
      Number(screenRoot.getAttribute('data-fire-cooldown')),
    ).toBeGreaterThan(0)
  })
})
