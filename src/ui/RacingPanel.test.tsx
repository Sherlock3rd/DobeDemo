import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRacingStage } from '../config/racingConfig'
import { useAdventureStore } from '../store/useAdventureStore'
import { useGangStore } from '../store/useGangStore'
import { RacingPanel } from './RacingPanel'

describe('RacingPanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAdventureStore.getState().reset(1_700_000_000_000)
    useGangStore.getState().reset(1_700_000_000_000)
  })

  it('shows only the exact next playable stage and starts with equipped hero', async () => {
    const onStart = vi.fn()
    render(<RacingPanel onClose={() => {}} onStart={onStart} />)
    expect(screen.getByText('第 1 关')).toBeInTheDocument()
    expect(screen.queryByText('第 2 关')).toBeNull()
    expect(screen.getByText(/满三格双击超级飞跃/)).toBeInTheDocument()
    expect(screen.getByText(/七车同场/)).toBeInTheDocument()
    expect(screen.getByText(/冲进前三名即可通关/)).toBeInTheDocument()
    expect(screen.queryByText('限时')).not.toBeInTheDocument()
    expect(
      screen.getByText(`${getRacingStage(1).distance} m`),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '发车' }))
    expect(onStart).toHaveBeenCalledWith(1, 'foreman')
  })

  it('hides cleared stages and advances to the next stage', () => {
    useAdventureStore.setState({ highestClearedRacingStage: 1 })
    render(<RacingPanel onClose={() => {}} onStart={() => {}} />)
    expect(screen.getByText('第 2 关')).toBeInTheDocument()
    expect(screen.queryByText('第 1 关')).toBeNull()
    expect(screen.getByText('竞速关卡')).toBeInTheDocument()
    expect(screen.queryByText('限时')).not.toBeInTheDocument()
    expect(screen.getByText(/冲进前三名即可通关/)).toBeInTheDocument()
    expect(screen.getByText(/空格释放氮气/)).toBeInTheDocument()
  })

  it('shows completion without replay buttons after stage ten', () => {
    useAdventureStore.setState({ highestClearedRacingStage: 10 })
    render(<RacingPanel onClose={() => {}} onStart={() => {}} />)
    expect(screen.getByText('十关全部完成')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '发车' })).toBeNull()
  })

  it('requires upgraded installed vehicle parts from stage six onward', () => {
    useAdventureStore.getState().grantPrologueGun()
    const current = useAdventureStore.getState()
    useAdventureStore.setState({
      highestClearedRacingStage: 5,
      carPartInventory: [
        {
          id: 'gate-engine',
          slot: 'engine',
          quality: 'rare',
          level: 1,
        },
      ],
      carPartSlotsByCar: {
        ...current.carPartSlotsByCar,
        'rust-fox': {
          ...current.carPartSlotsByCar['rust-fox'],
          engine: 'gate-engine',
        },
      },
    })

    const { rerender } = render(
      <RacingPanel onClose={() => {}} onStart={() => {}} />,
    )

    expect(screen.getByText('第 6 关')).toBeInTheDocument()
    expect(screen.getByText('任意已安装配件 Lv.2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发车' })).toBeDisabled()
    expect(
      screen.getByText('升级并安装车辆配件至 Lv.2 后才能发车'),
    ).toBeInTheDocument()

    useAdventureStore.setState({
      carPartInventory: [
        {
          id: 'gate-engine',
          slot: 'engine',
          quality: 'rare',
          level: 2,
        },
      ],
    })
    rerender(<RacingPanel onClose={() => {}} onStart={() => {}} />)

    expect(screen.getByRole('button', { name: '发车' })).toBeEnabled()
    expect(screen.getByText(/养成极速/)).toBeInTheDocument()
    expect(screen.getByText(/配件最高 Lv.2/)).toBeInTheDocument()
  })
})
