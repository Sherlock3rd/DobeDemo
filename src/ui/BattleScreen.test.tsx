import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getNextCampaignStage } from '../config/campaignConfig'
import { combatConfig } from '../config/combatConfig'
import { buildBattleInput, simulateBattle } from '../game/combat/battleEngine'
import { getGangLevel } from '../game/gangProgression'
import { useAdventureStore } from '../store/useAdventureStore'
import { useGangStore } from '../store/useGangStore'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({
    children,
    orthographic,
  }: {
    children?: ReactNode
    orthographic?: boolean
  }) => (
    <div
      data-testid="battle-canvas"
      data-camera-mode={orthographic ? 'orthographic' : 'perspective'}
    >
      {children}
    </div>
  ),
}))

vi.mock('../scene/battle/BattleScene', () => ({
  BattleScene: () => <div data-testid="battle-scene-mock" />,
}))

const motionState = vi.hoisted(() => ({ reduced: false }))

vi.mock('../scene/city/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => motionState.reduced,
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
      adventure.equipmentByHero,
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
    motionState.reduced = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses a perspective camera for the diagonal battlefield', () => {
    render(<BattleScreen stage={1} onExit={() => {}} />)
    expect(screen.getByTestId('battle-canvas')).toHaveAttribute(
      'data-camera-mode',
      'perspective',
    )
  })

  it('stops direct continuation after the final campaign stage', () => {
    expect(getNextCampaignStage(19)).toBe(20)
    expect(getNextCampaignStage(20)).toBeNull()
  })

  it('shows true initial rage before a tick-one action, then advances to 20', () => {
    expect(
      useAdventureStore
        .getState()
        .setFormation([{ heroId: 'foreman', row: 'front', index: 1 }], 1),
    ).toBe(true)
    render(<BattleScreen stage={1} onExit={() => {}} />)

    expect(
      screen.getByRole('progressbar', { name: '怒气 0/100' }),
    ).toBeInTheDocument()

    advanceTicks(1)

    expect(
      screen.getByRole('progressbar', { name: '怒气 20/100' }),
    ).toBeInTheDocument()
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
        adventure.equipmentByHero,
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

  it('shows resolved rewards in StrictMode with reduced motion', () => {
    motionState.reduced = true
    render(
      <StrictMode>
        <BattleScreen stage={1} onExit={() => {}} />
      </StrictMode>,
    )
    act(() => {
      vi.runAllTimers()
    })
    expect(useAdventureStore.getState().highestClearedStage).toBe(1)
    expect(screen.getByLabelText('首通奖励')).toBeInTheDocument()
    expect(screen.getByLabelText('英雄经验 500')).toBeInTheDocument()
  })

  it('offers exit and starts the next stage directly after victory', () => {
    const onExit = vi.fn()
    const onNext = vi.fn()
    motionState.reduced = true

    render(<BattleScreen stage={1} onExit={onExit} onNext={onNext} />)
    act(() => {
      vi.runAllTimers()
    })

    expect(screen.getByText('VICTORY · 胜利')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '退出' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '下一关' }))
    expect(onNext).toHaveBeenCalledWith(2)
    expect(onExit).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '退出' }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('uses a victory as a role challenge without changing campaign progress', () => {
    const onRoleChallengeVictory = vi.fn()
    motionState.reduced = true

    render(
      <BattleScreen
        stage={1}
        onExit={() => {}}
        roleChallengeTitle="技术骨干席位挑战"
        onRoleChallengeVictory={onRoleChallengeVictory}
      />,
    )
    act(() => {
      vi.runAllTimers()
    })

    expect(screen.getByText('CHALLENGE WON · 交接胜利')).toBeInTheDocument()
    expect(screen.getByText('技术骨干席位挑战')).toBeInTheDocument()
    expect(useAdventureStore.getState().highestClearedStage).toBe(0)
    expect(screen.queryByLabelText('首通奖励')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '完成战斗交接' }))
    expect(onRoleChallengeVictory).toHaveBeenCalledTimes(1)
  })

  it('guides a defeated player directly to development', () => {
    const onDevelop = vi.fn()
    motionState.reduced = true
    render(<BattleScreen stage={20} onExit={() => {}} onDevelop={onDevelop} />)

    expect(screen.getByText('DEFEAT · 失败')).toBeInTheDocument()
    expect(
      screen.getByText('前往养成提升英雄、车辆与装备后再来挑战。'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '退出' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '下一关' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '前往养成' }))

    expect(onDevelop).toHaveBeenCalledTimes(1)
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
