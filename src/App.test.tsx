import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdventureStore } from './store/useAdventureStore'
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
  GangIdleController: () => <div data-testid="gang-idle-controller" />,
}))

vi.mock('./game/EconomyIdleController', () => ({
  EconomyIdleController: () => <div data-testid="economy-idle-controller" />,
}))

vi.mock('./game/AdventureIdleClock', () => ({
  AdventureIdleClock: () => <div data-testid="adventure-idle-clock" />,
}))

vi.mock('./ui/GlobalHud', () => ({
  GlobalHud: (p: {
    onOpenHeroes: () => void
    onOpenGangTree: () => void
    onOpenAdventure: () => void
    onOpenSettings: () => void
  }) => (
    <nav aria-label="主导航">
      <button type="button" onClick={p.onOpenHeroes}>
        英雄
      </button>
      <button type="button" onClick={p.onOpenGangTree}>
        帮派树
      </button>
      <button type="button" onClick={p.onOpenAdventure}>
        推关
      </button>
      <button type="button" onClick={p.onOpenSettings}>
        设置
      </button>
    </nav>
  ),
}))

vi.mock('./ui/AdventurePanel', () => ({
  AdventurePanel: (p: {
    onClose: () => void
    onChallenge: (stage: number) => void
  }) => (
    <div role="dialog" aria-label="推关地图">
      <h2 tabIndex={-1} ref={(element) => element?.focus()}>
        推关战役
      </h2>
      <button type="button" onClick={p.onClose}>
        关闭推关
      </button>
      <button type="button" onClick={() => p.onChallenge(1)}>
        挑战 1-1
      </button>
    </div>
  ),
}))

vi.mock('./ui/FormationPanel', () => ({
  FormationPanel: (p: {
    onCancel: () => void
    onStart: (stage: number) => void
    stage: number
  }) => (
    <div role="dialog" aria-label="编队">
      <h2 tabIndex={-1} ref={(element) => element?.focus()}>
        {`编队 · 关卡 ${p.stage}`}
      </h2>
      <button type="button" onClick={p.onCancel}>
        取消
      </button>
      <button type="button" onClick={() => p.onStart(p.stage)}>
        开始
      </button>
    </div>
  ),
}))

vi.mock('./ui/BattleScreen', () => ({
  BattleScreen: (p: { onExit: () => void }) => (
    <div role="dialog" aria-label="战斗">
      <button type="button" onClick={p.onExit}>
        退出战斗
      </button>
    </div>
  ),
}))

vi.mock('./ui/HeroesPanel', () => ({
  HeroesPanel: () => (
    <div role="dialog" aria-label="英雄培养">
      <h2 tabIndex={-1} ref={(element) => element?.focus()}>
        英雄培养
      </h2>
    </div>
  ),
}))

const { default: App } = await import('./App')

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset(BASE_TIME)
    useGangStore.getState().reset(BASE_TIME)
    useAdventureStore.getState().reset(BASE_TIME)
    canvasPropsSpy.mockClear()
  })

  it('renders the canvas with an orthographic projection', () => {
    render(<App />)
    expect(canvasPropsSpy).toHaveBeenCalled()
    const props = canvasPropsSpy.mock.calls[0][0] as { orthographic?: boolean }
    expect(props.orthographic).toBe(true)
  })

  it('opens at most one overlay and closes building detail when opening a full-screen play', async () => {
    useCityStore.getState().selectBuilding('repair-shop')
    render(<App />)
    expect(screen.getByRole('heading', { name: '修车厂' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '推关' }))
    expect(screen.getByRole('dialog', { name: '推关地图' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '修车厂' })).toBeNull()
    expect(useCityStore.getState().selectedBuildingId).toBeNull()
  })

  it('keeps the global HUD available while isolating the city canvas', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: '推关' }))

    const visibleTrigger = screen.getByRole('button', { name: '推关' })
    const hudBackground = visibleTrigger.closest('nav')?.parentElement
    const canvasBackground = screen.getByTestId('canvas-mock').parentElement
    expect(hudBackground).not.toHaveAttribute('aria-hidden')
    expect(hudBackground).not.toHaveAttribute('inert')
    expect(canvasBackground).toHaveAttribute('aria-hidden', 'true')
    expect(canvasBackground).toHaveAttribute('inert')
    expect(screen.getByRole('heading', { name: '推关战役' })).toHaveFocus()
  })

  it('switches from adventure to heroes through the visible global HUD', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: '推关' }))
    expect(screen.getByRole('dialog', { name: '推关地图' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '英雄' }))

    expect(screen.queryByRole('dialog', { name: '推关地图' })).toBeNull()
    expect(screen.getByRole('dialog', { name: '英雄培养' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '英雄培养' })).toHaveFocus()
  })

  it('restores focus to the city trigger after closing an overlay', async () => {
    render(<App />)
    const trigger = screen.getByRole('button', { name: '推关' })

    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('button', { name: '关闭推关' }))

    expect(trigger).toHaveFocus()
  })

  it('formation can only be entered from adventure, battle only from formation, and exit returns to adventure', async () => {
    render(<App />)
    expect(screen.queryByRole('dialog', { name: '编队' })).toBeNull()
    expect(screen.queryByRole('dialog', { name: '战斗' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '推关' }))
    await userEvent.click(screen.getByRole('button', { name: '挑战 1-1' }))
    expect(screen.getByRole('dialog', { name: '编队' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '开始' }))
    expect(screen.getByRole('dialog', { name: '战斗' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '推关' })).toBeNull()
    expect(screen.queryByRole('button', { name: '设置' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '退出战斗' }))
    expect(screen.getByRole('dialog', { name: '推关地图' })).toBeInTheDocument()
  })

  it('keeps focus inside the adventure, formation, and battle transition chain', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: '推关' }))
    expect(screen.getByRole('heading', { name: '推关战役' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: '挑战 1-1' }))
    expect(screen.getByRole('heading', { name: '编队 · 关卡 1' })).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('heading', { name: '推关战役' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: '挑战 1-1' }))
    await userEvent.click(screen.getByRole('button', { name: '开始' }))
    expect(screen.getByRole('button', { name: '退出战斗' })).toHaveFocus()
    expect(document.body).not.toHaveFocus()
  })

  it('Escape closes the current non-none overlay', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: '设置' }))
    expect(screen.getByRole('dialog', { name: /设置/ })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /设置/ })).toBeNull()
  })

  it('idle controllers (gang/economy/adventure) mount regardless of overlay', async () => {
    render(<App />)
    expect(screen.getByTestId('gang-idle-controller')).toBeInTheDocument()
    expect(screen.getByTestId('economy-idle-controller')).toBeInTheDocument()
    expect(screen.getByTestId('adventure-idle-clock')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '推关' }))
    expect(screen.getByTestId('gang-idle-controller')).toBeInTheDocument()
    expect(screen.getByTestId('economy-idle-controller')).toBeInTheDocument()
    expect(screen.getByTestId('adventure-idle-clock')).toBeInTheDocument()
  })

  it('does not clamp adventure hero levels until both stores have hydrated', () => {
    const adventureHydrated = vi.spyOn(useAdventureStore.persist, 'hasHydrated')
    const gangHydrated = vi.spyOn(useGangStore.persist, 'hasHydrated')
    adventureHydrated.mockReturnValue(true)
    gangHydrated.mockReturnValue(false)

    useAdventureStore.setState({
      heroLevels: { foreman: 20, anvil: 1, skyline: 1 },
    })

    render(<App />)
    expect(useAdventureStore.getState().heroLevels.foreman).toBe(20)

    gangHydrated.mockReturnValue(true)
    useGangStore.setState({
      totalReputation: 30 * 19,
      lastUpdatedAt: BASE_TIME,
    })
    act(() => {
      useAdventureStore.getState().reconcileWithGang(20)
    })
    expect(useAdventureStore.getState().heroLevels.foreman).toBe(20)

    adventureHydrated.mockRestore()
    gangHydrated.mockRestore()
  })

  it('clamps oversized hero levels after both stores hydrate at gang Lv12', () => {
    useGangStore.setState({
      totalReputation: 30 * 11,
      lastUpdatedAt: BASE_TIME,
    })
    useAdventureStore.setState({
      heroLevels: { foreman: 40, anvil: 1, skyline: 1 },
      formation: [
        { heroId: 'foreman', row: 'back', index: 1 },
        { heroId: 'skyline', row: 'back', index: 0 },
      ],
    })

    render(<App />)
    expect(useAdventureStore.getState().heroLevels.foreman).toBe(12)
    expect(
      useAdventureStore
        .getState()
        .formation.some((s) => s.heroId === 'skyline'),
    ).toBe(false)
  })
})
