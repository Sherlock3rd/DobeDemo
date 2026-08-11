import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@react-three/fiber', () => ({
  Canvas: () => <div data-testid="workshop-canvas" />,
  useFrame: vi.fn(),
}))

const { CarDismantleOverlay, CarModificationOverlay } =
  await import('./VehicleWorkshopOverlay')

describe('VehicleWorkshopOverlay', () => {
  it('walks through all modification operations before completing', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<CarModificationOverlay onComplete={onComplete} />)

    for (const action of [
      '抬起引擎盖',
      '拆下损坏引擎',
      '装入博赠送的调校引擎',
      '点火测试',
    ]) {
      await user.click(screen.getByRole('button', { name: action }))
      expect(onComplete).not.toHaveBeenCalled()
    }

    expect(screen.getByText('转速稳定，调校引擎安装完成。')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认改装完成' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('dismantles two vehicles before exposing the salvage reward', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<CarDismantleOverlay onComplete={onComplete} />)

    for (const action of [
      '拆下 1 号车轮组',
      '切出 1 号车引擎',
      '压缩 1 号车车壳',
      '拆下 2 号车轮组',
      '切出 2 号车引擎',
      '压缩 2 号车车壳',
    ]) {
      await user.click(screen.getByRole('button', { name: action }))
      expect(onComplete).not.toHaveBeenCalled()
    }

    expect(screen.getByLabelText('拆车奖励')).toHaveTextContent('零件 +25')
    await user.click(screen.getByRole('button', { name: '收取拆解物' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
