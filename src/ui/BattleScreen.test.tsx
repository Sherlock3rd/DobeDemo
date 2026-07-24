import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { combatConfig } from '../config/combatConfig'
import { buildBattleInput, simulateBattle } from '../game/combat/battleEngine'
import { getGangLevel } from '../game/gangProgression'
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

function endedAtTick(stage: number): number {
  const adventure = useAdventureStore.getState()
  const gangLevel = getGangLevel(useGangStore.getState().totalReputation)
  return simulateBattle(
    buildBattleInput(
      stage,
      adventure.formation,
      adventure.heroLevels,
      gangLevel,
    ),
  ).endedAtTick
}

function advanceTicks(ticks: number): void {
  act(() => {
    vi.advanceTimersByTime(ticks * combatConfig.tickMs)
  })
}

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
    const adventure = useAdventureStore.getState()
    const expected = simulateBattle(
      buildBattleInput(
        1,
        adventure.formation,
        adventure.heroLevels,
        getGangLevel(useGangStore.getState().totalReputation),
      ),
    )
    const expectedMetrics = expected.timeline.reduce(
      (metrics, tick) => {
        metrics.basic += tick.hits.filter((hit) => hit.kind === 'basic').length
        metrics.skillMain += tick.hits.filter(
          (hit) => hit.kind === 'skill-main',
        ).length
        metrics.damage += tick.hits.length
        metrics.deaths += tick.deaths.length
        return metrics
      },
      { basic: 0, skillMain: 0, damage: 0, deaths: 0 },
    )
    render(<BattleScreen stage={1} onExit={onExit} />)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(useAdventureStore.getState().highestClearedStage).toBe(1)
    expect(useAdventureStore.getState().sharedExp).toBe(500)
    expect(screen.getByText(/VICTORY|胜利/)).toBeInTheDocument()
    const battle = screen.getByRole('dialog', { name: '战斗' })
    expect(Number(battle.dataset.basicHits)).toBe(expectedMetrics.basic)
    expect(Number(battle.dataset.skillMainHits)).toBe(expectedMetrics.skillMain)
    expect(Number(battle.dataset.damageEvents)).toBe(expectedMetrics.damage)
    expect(Number(battle.dataset.deaths)).toBe(expectedMetrics.deaths)
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

  it('freezes before resolution while exit confirmation is pending, then resumes after cancel', () => {
    render(<BattleScreen stage={1} onExit={() => {}} />)
    advanceTicks(endedAtTick(1) - 1)

    fireEvent.click(screen.getByRole('button', { name: /^退出$/ }))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(screen.queryByText(/VICTORY|胜利/)).toBeNull()
    expect(useAdventureStore.getState().highestClearedStage).toBe(0)
    expect(useAdventureStore.getState().sharedExp).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: /取消/ }))
    advanceTicks(1)

    expect(screen.getByText(/VICTORY|胜利/)).toBeInTheDocument()
    expect(useAdventureStore.getState().highestClearedStage).toBe(1)
    expect(useAdventureStore.getState().sharedExp).toBe(500)
  })

  it('Escape confirmation freezes before resolution and confirming only exits', () => {
    const onExit = vi.fn()
    render(<BattleScreen stage={1} onExit={onExit} />)
    advanceTicks(endedAtTick(1) - 1)

    fireEvent.keyDown(window, { key: 'Escape' })
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onExit).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/VICTORY|胜利/)).toBeNull()
    expect(useAdventureStore.getState().highestClearedStage).toBe(0)
    expect(useAdventureStore.getState().sharedExp).toBe(0)
  })

  it('canceling exit confirmation preserves a manual pause', () => {
    render(<BattleScreen stage={1} onExit={() => {}} />)
    advanceTicks(endedAtTick(1) - 1)
    fireEvent.click(screen.getByRole('button', { name: /暂停/ }))
    fireEvent.click(screen.getByRole('button', { name: /^退出$/ }))
    fireEvent.click(screen.getByRole('button', { name: /取消/ }))

    advanceTicks(10)
    expect(screen.queryByText(/VICTORY|胜利/)).toBeNull()
    expect(useAdventureStore.getState().highestClearedStage).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: /继续/ }))
    advanceTicks(1)
    expect(screen.getByText(/VICTORY|胜利/)).toBeInTheDocument()
  })
})
