import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BattleHud } from './BattleHud'

const units = [
  {
    side: 'ally' as const,
    globalIndex: 2,
    row: 'back' as const,
    index: 0,
    hp: 800,
    maxHp: 800,
    cooldownRemaining: 30,
    cooldownTotal: 90,
    alive: true,
  },
]

describe('BattleHud', () => {
  it('has no manual-cast or Auto controls', () => {
    render(
      <BattleHud
        phase="running"
        speed={1}
        exitPending={false}
        onTogglePause={() => {}}
        onSetSpeed={() => {}}
        onRequestExitPrompt={() => {}}
        onCancelExit={() => {}}
        onConfirmExit={() => {}}
        units={units}
      />,
    )
    expect(
      screen.queryByRole('button', { name: /Auto|自动战斗|释放技能|施法/ }),
    ).toBeNull()
  })

  it('toggles pause and switches speed', async () => {
    const onTogglePause = vi.fn()
    const onSetSpeed = vi.fn()
    render(
      <BattleHud
        phase="running"
        speed={1}
        exitPending={false}
        onTogglePause={onTogglePause}
        onSetSpeed={onSetSpeed}
        onRequestExitPrompt={() => {}}
        onCancelExit={() => {}}
        onConfirmExit={() => {}}
        units={units}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /暂停/ }))
    expect(onTogglePause).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /2x/ }))
    expect(onSetSpeed).toHaveBeenCalledWith(2)
  })

  it('renders controlled exit confirmation and delegates its actions', async () => {
    const onRequestExitPrompt = vi.fn()
    const onCancelExit = vi.fn()
    const onConfirmExit = vi.fn()
    const view = render(
      <BattleHud
        phase="running"
        speed={1}
        exitPending={false}
        onTogglePause={() => {}}
        onSetSpeed={() => {}}
        onRequestExitPrompt={onRequestExitPrompt}
        onCancelExit={onCancelExit}
        onConfirmExit={onConfirmExit}
        units={units}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /退出/ }))
    expect(onRequestExitPrompt).toHaveBeenCalledTimes(1)

    view.rerender(
      <BattleHud
        phase="paused"
        speed={1}
        exitPending
        onTogglePause={() => {}}
        onSetSpeed={() => {}}
        onRequestExitPrompt={onRequestExitPrompt}
        onCancelExit={onCancelExit}
        onConfirmExit={onConfirmExit}
        units={units}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /取消/ }))
    await userEvent.click(screen.getByRole('button', { name: /确认退出/ }))
    expect(onCancelExit).toHaveBeenCalledTimes(1)
    expect(onConfirmExit).toHaveBeenCalledTimes(1)
  })

  it('renders read-only portraits with cooldown seconds', () => {
    render(
      <BattleHud
        phase="running"
        speed={1}
        exitPending={false}
        onTogglePause={() => {}}
        onSetSpeed={() => {}}
        onRequestExitPrompt={() => {}}
        onCancelExit={() => {}}
        onConfirmExit={() => {}}
        units={units}
      />,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /生命/ })).toBeNull()
  })
})
