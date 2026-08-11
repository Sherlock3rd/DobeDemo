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
    await user.click(screen.getByRole('button', { name: '确认工位完成' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('uses three distinct 3D repair jobs for the first workshop sequence', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(
      <CarModificationOverlay scenario="repair-trio" onComplete={onComplete} />,
    )

    expect(screen.getByText('Thomas · 灰狐')).toBeInTheDocument()
    for (const action of [
      '打开灰狐引擎舱',
      '更换灰狐散热器',
      '完成灰狐压力测试',
    ]) {
      await user.click(screen.getByRole('button', { name: action }))
    }
    expect(screen.getByText('Eddie · 通勤车')).toBeInTheDocument()
    for (const action of [
      '举升 Eddie 的通勤车',
      '拆下变形轮组',
      '安装备用轮组并落车',
    ]) {
      await user.click(screen.getByRole('button', { name: action }))
    }
    expect(screen.getByText('Bo · 接应车')).toBeInTheDocument()
    for (const action of [
      '拆除 Bo 的破损护杠',
      '固定强化护杠',
      '检查灯光与车身间隙',
    ]) {
      await user.click(screen.getByRole('button', { name: action }))
    }

    expect(
      screen.getByText('三辆车全部交付，第二份见习证明完成。'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认工位完成' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('uses a dedicated suspension sequence for race preparation', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(
      <CarModificationOverlay scenario="race-prep" onComplete={onComplete} />,
    )

    for (const action of [
      '举升灰狐',
      '拆下弯曲悬挂',
      '安装回收悬挂',
      '完成四轮定位',
    ]) {
      await user.click(screen.getByRole('button', { name: action }))
    }

    expect(
      screen.getByText('定位数据归零，灰狐已经完成赛前准备。'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认工位完成' }))
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

  it('uses a single-vehicle evidence sequence for the pursuit wreck', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(
      <CarDismantleOverlay scenario="pursuit-wreck" onComplete={onComplete} />,
    )

    for (const action of ['拆下追杀车轮组', '切出引擎与车架编号', '压缩残骸']) {
      await user.click(screen.getByRole('button', { name: action }))
    }

    expect(screen.getByLabelText('拆车奖励')).toHaveTextContent(
      '袭击车架编号 ×1',
    )
    await user.click(screen.getByRole('button', { name: '收取拆解物' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
