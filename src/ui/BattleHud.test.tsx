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
        onTogglePause={() => {}}
        onSetSpeed={() => {}}
        onRequestExit={() => {}}
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
        onTogglePause={onTogglePause}
        onSetSpeed={onSetSpeed}
        onRequestExit={() => {}}
        units={units}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /暂停/ }))
    expect(onTogglePause).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /2x/ }))
    expect(onSetSpeed).toHaveBeenCalledWith(2)
  })

  it('requires exit confirmation', async () => {
    const onRequestExit = vi.fn()
    render(
      <BattleHud
        phase="running"
        speed={1}
        onTogglePause={() => {}}
        onSetSpeed={() => {}}
        onRequestExit={onRequestExit}
        units={units}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /退出/ }))
    await userEvent.click(screen.getByRole('button', { name: /确认退出/ }))
    expect(onRequestExit).toHaveBeenCalled()
  })

  it('renders read-only portraits with cooldown seconds', () => {
    render(
      <BattleHud
        phase="running"
        speed={1}
        onTogglePause={() => {}}
        onSetSpeed={() => {}}
        onRequestExit={() => {}}
        units={units}
      />,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /生命/ })).toBeNull()
  })
})
