import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCityStore } from './store/useCityStore'
import { useGangStore } from './store/useGangStore'

const BASE_TIME = 1_700_000_000_000

const canvasPropsSpy = vi.fn()

vi.mock('@react-three/fiber', () => ({
  Canvas: (props: { children?: ReactNode; orthographic?: boolean }) => {
    canvasPropsSpy(props)
    return <div data-testid="canvas-mock">{props.children}</div>
  },
}))

vi.mock('@react-three/drei', () => ({
  Loader: () => <div data-testid="loader-mock" />,
}))

vi.mock('./scene/city/CityScene', () => ({
  CityScene: () => <div data-testid="city-scene-mock" />,
}))

vi.mock('./game/GangIdleController', () => ({
  GangIdleController: () => <div data-testid="gang-idle-controller-mock" />,
}))

vi.mock('./game/EconomyIdleController', () => ({
  EconomyIdleController: () => (
    <div data-testid="economy-idle-controller-mock" />
  ),
}))

const { default: App } = await import('./App')

describe('App', () => {
  beforeEach(() => {
    useCityStore.getState().reset()
    window.localStorage.clear()
    useGangStore.getState().reset(BASE_TIME)
    canvasPropsSpy.mockClear()
  })

  it('shows the city HUD title instead of the old demo title', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: '工业城改造计划' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Web 3D Demo Workspace')).not.toBeInTheDocument()
  })

  it('renders the canvas with an orthographic projection', () => {
    render(<App />)

    expect(canvasPropsSpy).toHaveBeenCalled()
    const props = canvasPropsSpy.mock.calls[0][0] as { orthographic?: boolean }
    expect(props.orthographic).toBe(true)
  })

  it('shows the building panel for a preselected building', () => {
    useCityStore.getState().selectBuilding('repair-shop')

    render(<App />)

    expect(screen.getByRole('heading', { name: '修车厂' })).toBeInTheDocument()
    expect(screen.getByText('等级 1 / 5')).toBeInTheDocument()
  })

  it('mounts the gang idle controller placeholder without starting real timers', () => {
    render(<App />)

    expect(screen.getByTestId('gang-idle-controller-mock')).toBeInTheDocument()
  })

  it('mounts the economy idle controller after the gang controller', () => {
    render(<App />)

    const gangController = screen.getByTestId('gang-idle-controller-mock')
    const economyController = screen.getByTestId('economy-idle-controller-mock')
    expect(
      gangController.compareDocumentPosition(economyController) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('does not show the gang tree dialog until the HUD button is clicked', () => {
    render(<App />)

    expect(
      screen.queryByRole('dialog', { name: '帮派树' }),
    ).not.toBeInTheDocument()
  })

  it('opens the gang tree dialog with 50 level nodes when the HUD button is clicked, and closes it via the close button', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '打开帮派树' }))

    const dialog = screen.getByRole('dialog', { name: '帮派树' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(50)

    await user.click(screen.getByRole('button', { name: '关闭帮派树' }))

    expect(
      screen.queryByRole('dialog', { name: '帮派树' }),
    ).not.toBeInTheDocument()
  })

  it('does not show the debug settings dialog by default', () => {
    render(<App />)

    expect(
      screen.queryByRole('dialog', { name: '调试设置' }),
    ).not.toBeInTheDocument()
  })

  it('opens and closes debug settings from named buttons, resetting confirmation state', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '打开调试设置' }))
    expect(screen.getByRole('dialog', { name: '调试设置' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '重置账号' }))
    expect(
      screen.getByRole('button', { name: '确认重置账号' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '关闭调试设置' }))
    expect(
      screen.queryByRole('dialog', { name: '调试设置' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '打开调试设置' }))
    expect(
      screen.queryByRole('button', { name: '确认重置账号' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重置账号' })).toBeInTheDocument()
  })

  it('closes the gang tree when debug settings opens', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '打开帮派树' }))
    expect(screen.getByRole('dialog', { name: '帮派树' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '打开调试设置' }))

    expect(screen.getByRole('dialog', { name: '调试设置' })).toBeInTheDocument()
    expect(
      screen.queryByRole('dialog', { name: '帮派树' }),
    ).not.toBeInTheDocument()
  })

  it('opens only the gang tree after debug settings closes', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '打开调试设置' }))
    await user.click(screen.getByRole('button', { name: '关闭调试设置' }))
    await user.click(screen.getByRole('button', { name: '打开帮派树' }))

    expect(screen.getByRole('dialog', { name: '帮派树' })).toBeInTheDocument()
    expect(
      screen.queryByRole('dialog', { name: '调试设置' }),
    ).not.toBeInTheDocument()
  })
})
