import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BattleErrorBoundary } from './BattleErrorBoundary'

function BrokenScene(): never {
  throw new Error('scene render failed')
}

describe('BattleErrorBoundary', () => {
  it('contains scene failures and offers a return to the adventure map', async () => {
    const onExit = vi.fn()
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    render(
      <BattleErrorBoundary onExit={onExit}>
        <BrokenScene />
      </BattleErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('战斗初始化失败')
    await userEvent.click(screen.getByRole('button', { name: '返回推关地图' }))
    expect(onExit).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })
})
