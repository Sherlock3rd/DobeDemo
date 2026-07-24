import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { CityHud } from './CityHud'

const BASE_TIME = 1_700_000_000_000

describe('CityHud', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useGangStore.getState().reset(BASE_TIME)
    useCityStore.getState().reset(BASE_TIME)
  })

  it('shows the city title and interaction guidance', () => {
    render(<CityHud />)

    const title = screen.getByRole('heading', { name: '工业城改造计划' })
    expect(title.closest('section')).toHaveClass('city-hud')
    expect(
      screen.getByText('拖拽平移 · 滚轮缩放 · 点击建筑升级'),
    ).toBeInTheDocument()
  })

  it('shows level 1 Prospect progress and the idle rate at zero reputation', () => {
    render(<CityHud />)

    expect(screen.getByText('Lv. 1')).toBeInTheDocument()
    expect(screen.getByText('Prospect（见习）')).toBeInTheDocument()
    expect(screen.getByText('0 / 30')).toBeInTheDocument()
    expect(screen.getByText('+1 声望/10秒')).toBeInTheDocument()
    expect(screen.getByText('钱 10000')).toBeInTheDocument()
    expect(screen.getByText('油 0')).toBeInTheDocument()
    expect(screen.getByText('物资 0')).toBeInTheDocument()
    expect(screen.getByText('钱 +1/10秒')).toBeInTheDocument()
    expect(screen.getByText('油 +0/10秒')).toBeInTheDocument()
    expect(screen.getByText('物资 +0/10秒')).toBeInTheDocument()

    const progress = document.querySelector('progress')
    expect(progress).not.toBeNull()
    expect(progress).toHaveAttribute('max', '30')
    expect(progress).toHaveAttribute('value', '0')
  })

  it('shows level 8 Full Patch with the remainder progress at 220 reputation', () => {
    useGangStore.setState({ totalReputation: 220 })

    render(<CityHud />)

    expect(screen.getByText('Lv. 8')).toBeInTheDocument()
    expect(screen.getByText('Full Patch（正式成员）')).toBeInTheDocument()
    expect(screen.getByText('10 / 30')).toBeInTheDocument()

    const progress = document.querySelector('progress')
    expect(progress).toHaveAttribute('value', '10')
  })

  it('shows current balances and production from all active producers', () => {
    const buildingProgress = useCityStore.getState().buildingProgress
    useCityStore.setState({
      resources: { money: 120, oil: 30, materials: 45 },
      activeProducerIds: [
        'repair-shop',
        'commercial-street',
        'gas-station',
        'metalworking-plant',
      ],
      buildingProgress: {
        ...buildingProgress,
        'repair-shop': {
          ...buildingProgress['repair-shop'],
          childLevels: [1, 1, 1, 1, 1],
        },
        'commercial-street': {
          ...buildingProgress['commercial-street'],
          childLevels: Array(10).fill(1),
        },
        'gas-station': {
          ...buildingProgress['gas-station'],
          childLevels: [1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
        },
        'metalworking-plant': {
          ...buildingProgress['metalworking-plant'],
          childLevels: Array(10).fill(1),
        },
      },
    })

    render(<CityHud />)

    expect(screen.getByText('钱 120')).toBeInTheDocument()
    expect(screen.getByText('油 30')).toBeInTheDocument()
    expect(screen.getByText('物资 45')).toBeInTheDocument()
    expect(screen.getByText('钱 +6/10秒')).toBeInTheDocument()
    expect(screen.getByText('油 +2/10秒')).toBeInTheDocument()
    expect(screen.getByText('物资 +3/10秒')).toBeInTheDocument()
  })

  it('calls onOpenGangTree when the open button is clicked', async () => {
    const user = userEvent.setup()
    const onOpenGangTree = vi.fn()

    render(<CityHud onOpenGangTree={onOpenGangTree} />)

    await user.click(screen.getByRole('button', { name: '打开帮派树' }))

    expect(onOpenGangTree).toHaveBeenCalledTimes(1)
  })

  it('calls onOpenSettings from the debug settings button', async () => {
    const onOpenSettings = vi.fn()
    render(<CityHud onOpenSettings={onOpenSettings} />)

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: '打开调试设置' }))

    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })
})
