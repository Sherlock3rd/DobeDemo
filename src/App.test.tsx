import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChestTick } from './game/chestTick'
import { getTotalReputationForLevel } from './game/gangProgression'
import { useAdventureStore } from './store/useAdventureStore'
import { useChapterStore } from './store/useChapterStore'
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
  CityScene: (p: { onBuildingClaimed?: (id: 'repair-shop') => void }) => (
    <div data-testid="city-scene-mock">
      <button
        type="button"
        onClick={() => {
          useCityStore.getState().claimBuilding('repair-shop', 1, BASE_TIME)
          p.onBuildingClaimed?.('repair-shop')
        }}
      >
        地图接管修车厂
      </button>
    </div>
  ),
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
    onOpenChapters: () => void
    onOpenAdventure: () => void
    onOpenRacing: () => void
    onOpenSettings: () => void
  }) => (
    <nav aria-label="主导航">
      <button type="button" onClick={p.onOpenHeroes}>
        英雄
      </button>
      <button type="button" onClick={p.onOpenGangTree}>
        帮派树
      </button>
      <button type="button" onClick={p.onOpenChapters}>
        章节
      </button>
      <button type="button" onClick={p.onOpenAdventure}>
        推关
      </button>
      <button type="button" onClick={p.onOpenRacing}>
        赛车
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
  BattleScreen: (p: { onExit: () => void; onDevelop: () => void }) => (
    <div role="dialog" aria-label="战斗">
      <button type="button" onClick={p.onExit}>
        退出战斗
      </button>
      <button type="button" onClick={p.onDevelop}>
        战斗失败养成
      </button>
    </div>
  ),
}))

vi.mock('./ui/HeroesPanel', () => ({
  HeroesPanel: (p: { initialTab?: string }) => (
    <div
      role="dialog"
      aria-label="英雄培养"
      data-initial-tab={p.initialTab ?? ''}
    >
      <h2 tabIndex={-1} ref={(element) => element?.focus()}>
        英雄培养
      </h2>
    </div>
  ),
}))

vi.mock('./ui/RacingPanel', () => ({
  RacingPanel: (p: {
    onClose: () => void
    onStart: (stage: number, heroId: 'foreman') => void
  }) => (
    <div role="dialog" aria-label="公路争霸大厅">
      <button type="button" onClick={() => p.onStart(1, 'foreman')}>
        发车
      </button>
      <button type="button" onClick={p.onClose}>
        关闭赛车
      </button>
    </div>
  ),
}))

vi.mock('./ui/RaceScreen', () => ({
  RaceScreen: (p: { onExit: () => void; onDevelop: () => void }) => (
    <div role="dialog" aria-label="公路争霸">
      <button type="button" onClick={p.onExit}>
        返回赛车
      </button>
      <button type="button" onClick={p.onDevelop}>
        赛车失败养成
      </button>
    </div>
  ),
}))

const { default: App } = await import('./App')

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset(BASE_TIME)
    useCityStore.getState().claimBuilding('repair-shop', 1, BASE_TIME)
    useGangStore.getState().reset(BASE_TIME)
    useAdventureStore.getState().reset(BASE_TIME)
    useChapterStore.getState().reset()
    useChapterStore.setState({
      seenNarrativeIds: ['first-entry', 'chapter-start:1'],
      completedAssessmentChapterNumbers: [1],
    })
    useChestTick.setState({ now: BASE_TIME, tick: 0 })
    canvasPropsSpy.mockClear()
  })

  it('renders the canvas with an orthographic projection', () => {
    render(<App />)
    expect(canvasPropsSpy).toHaveBeenCalled()
    const props = canvasPropsSpy.mock.calls[0][0] as { orthographic?: boolean }
    expect(props.orthographic).toBe(true)
  })

  it('plays first-entry and first chapter briefings before offering the initial repair-shop takeover', async () => {
    const user = userEvent.setup()
    useCityStore.getState().reset(BASE_TIME)
    useChapterStore.setState({
      seenNarrativeIds: [],
      completedAssessmentChapterNumbers: [],
    })

    render(<App />)

    expect(
      await screen.findByRole('dialog', { name: '剧情对话：第一把钥匙' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '跳过剧情对话' }))
    expect(
      screen.getByRole('dialog', {
        name: '剧情对话：第一章 · 冷炉初燃',
      }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '跳过剧情对话' }))

    expect(
      screen.getByRole('dialog', {
        name: '第一章 · 冷炉初燃评定会议',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '地图接管修车厂' })).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(
      screen.getByRole('dialog', {
        name: '第一章 · 冷炉初燃评定会议',
      }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '听取会议决议' }))
    await user.click(screen.getByRole('button', { name: '接受本章任务' }))

    await user.click(screen.getByRole('button', { name: '地图接管修车厂' }))
    expect(
      screen.getByRole('status', { name: '修车厂管理权已交接' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '听取管理简报' }))
    expect(
      screen.getByRole('dialog', {
        name: '剧情对话：修车厂管理权交接',
      }),
    ).toBeInTheDocument()
  })

  it('opens the current assessment for an older save without replaying earlier meetings', async () => {
    const user = userEvent.setup()
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      currentLevel: 8,
      lastUpdatedAt: BASE_TIME,
    })
    useChapterStore.setState({
      seenNarrativeIds: [
        'first-entry',
        'chapter-start:1',
        'chapter-end:1',
        'promotion:8',
        'chapter-start:2',
      ],
      completedAssessmentChapterNumbers: [1],
    })

    render(<App />)

    expect(
      await screen.findByRole('dialog', {
        name: '第二章 · 废铁生意评定会议',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('第一章 · 冷炉初燃成员完成度'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '宣读评定结论' }))
    await user.click(screen.getByRole('button', { name: '进入本章任务评定' }))
    expect(screen.getByText('正式成员席位 · 有投票权')).toBeInTheDocument()
  })

  it('runs the next chapter assessment after a core-role promotion ceremony and briefing', async () => {
    const user = userEvent.setup()
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      currentLevel: 7,
      lastUpdatedAt: BASE_TIME,
    })
    useAdventureStore.setState((state) => ({
      heroLevels: { ...state.heroLevels, foreman: 3 },
      highestClearedStage: 2,
      highestClearedRacingStage: 1,
    }))
    useCityStore.setState((state) => ({
      buildingProgress: {
        ...state.buildingProgress,
        'repair-shop': {
          ...state.buildingProgress['repair-shop'],
          level: 2,
        },
      },
    }))
    useChapterStore.setState({
      claimedChapterNumbers: [1],
      completedAssessmentChapterNumbers: [1],
    })

    render(<App />)
    await user.click(screen.getByRole('button', { name: '帮派树' }))
    await user.click(screen.getByRole('button', { name: '接掌席位' }))
    expect(
      screen.getByRole('status', { name: '职级晋升：正式成员' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '跳过晋升演出' }))
    expect(
      screen.getByRole('dialog', {
        name: '剧情对话：正式成员席位交接',
      }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '跳过剧情对话' }))
    expect(
      screen.getByRole('dialog', {
        name: '剧情对话：第二章 · 废铁生意',
      }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '跳过剧情对话' }))

    expect(
      await screen.findByRole('dialog', {
        name: '第二章 · 废铁生意评定会议',
      }),
    ).toBeInTheDocument()
  })

  it('hides the global HUD for building detail and restores it after closing', async () => {
    useCityStore.getState().selectBuilding('repair-shop')
    render(<App />)
    expect(screen.getByRole('heading', { name: '修车厂' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '推关' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: '关闭建筑面板' }))

    expect(useCityStore.getState().selectedBuildingId).toBeNull()
    expect(screen.getByRole('button', { name: '推关' })).toBeInTheDocument()
  })

  it('Escape closes only the claim result and keeps the recycling yard production open', async () => {
    const user = userEvent.setup()
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      currentLevel: 8,
      lastUpdatedAt: BASE_TIME,
    })
    useAdventureStore.setState({ partIdleClock: BASE_TIME })
    useChestTick.setState({ now: BASE_TIME + 30_000, tick: 1 })
    useCityStore.setState((state) => ({
      buildingProgress: {
        ...state.buildingProgress,
        'recycling-yard': {
          level: 1,
          childLevels: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        },
      },
    }))
    useCityStore.getState().selectBuilding('recycling-yard')

    render(<App />)
    await user.click(screen.getByRole('button', { name: /生产/ }))
    await user.click(screen.getByRole('button', { name: '领取 1 批' }))
    expect(screen.getByRole('dialog', { name: '领取结果' })).toBeInTheDocument()
    expect(useCityStore.getState().selectedBuildingId).toBe('recycling-yard')

    await user.keyboard('{Escape}')

    expect(
      screen.queryByRole('dialog', { name: '领取结果' }),
    ).not.toBeInTheDocument()
    expect(useCityStore.getState().selectedBuildingId).toBe('recycling-yard')
    expect(screen.getByRole('region', { name: '配件生产' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '生产' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('hides the global HUD while an overlay is open and isolates the city canvas', async () => {
    render(<App />)

    const trigger = screen.getByRole('button', { name: '推关' })
    const hudBackground = trigger.closest('nav')?.parentElement
    await userEvent.click(trigger)

    const canvasBackground = screen.getByTestId('canvas-mock').parentElement
    expect(hudBackground).toHaveAttribute('aria-hidden', 'true')
    expect(hudBackground).toHaveAttribute('inert')
    expect(hudBackground).toHaveAttribute('hidden')
    expect(screen.queryByRole('button', { name: '推关' })).toBeNull()
    expect(screen.queryByRole('button', { name: '英雄' })).toBeNull()
    expect(canvasBackground).toHaveAttribute('aria-hidden', 'true')
    expect(canvasBackground).toHaveAttribute('inert')
    expect(screen.getByRole('heading', { name: '推关战役' })).toHaveFocus()
  })

  it('restores the global HUD after closing an overlay', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: '推关' }))
    expect(screen.getByRole('dialog', { name: '推关地图' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '英雄' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '关闭推关' }))
    expect(screen.getByRole('button', { name: '英雄' })).toBeInTheDocument()
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

  it('opens racing from the HUD and returns to its lobby after a race', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: '赛车' }))
    expect(
      screen.getByRole('dialog', { name: '公路争霸大厅' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '推关' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '发车' }))
    expect(screen.getByRole('dialog', { name: '公路争霸' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '返回赛车' }))
    expect(
      screen.getByRole('dialog', { name: '公路争霸大厅' }),
    ).toBeInTheDocument()
  })

  it('routes campaign and racing defeats to the relevant development tab', async () => {
    const campaignApp = render(<App />)

    await userEvent.click(screen.getByRole('button', { name: '推关' }))
    await userEvent.click(screen.getByRole('button', { name: '挑战 1-1' }))
    await userEvent.click(screen.getByRole('button', { name: '开始' }))
    await userEvent.click(screen.getByRole('button', { name: '战斗失败养成' }))
    expect(screen.getByRole('dialog', { name: '英雄培养' })).toHaveAttribute(
      'data-initial-tab',
      'level',
    )

    campaignApp.unmount()
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: '赛车' }))
    await userEvent.click(screen.getByRole('button', { name: '发车' }))
    await userEvent.click(screen.getByRole('button', { name: '赛车失败养成' }))
    expect(screen.getByRole('dialog', { name: '英雄培养' })).toHaveAttribute(
      'data-initial-tab',
      'car',
    )
  })

  it('opens the relevant gameplay surface from an unfinished chapter task guide', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: '章节' }))
    expect(
      screen.queryByRole('button', { name: '前往英雄升级' }),
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '前往推关' }))

    expect(screen.getByRole('dialog', { name: '推关地图' })).toBeInTheDocument()
  })

  it('selects the relevant city building from a chapter task guide', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: '章节' }))
    await userEvent.click(screen.getByRole('button', { name: '前往对应建筑' }))

    expect(useCityStore.getState().selectedBuildingId).toBe('repair-shop')
    expect(screen.getByRole('heading', { name: '修车厂' })).toBeInTheDocument()
  })

  it('shows chapter completion feedback, plays the closing report, then opens the gang tree', async () => {
    const user = userEvent.setup()
    useAdventureStore.setState((state) => ({
      heroLevels: { ...state.heroLevels, foreman: 3 },
      highestClearedStage: 2,
      highestClearedRacingStage: 1,
    }))
    useCityStore.setState((state) => ({
      buildingProgress: {
        ...state.buildingProgress,
        'repair-shop': {
          ...state.buildingProgress['repair-shop'],
          level: 2,
        },
      },
    }))
    render(<App />)

    await user.click(screen.getByRole('button', { name: '章节' }))
    await user.click(screen.getByRole('button', { name: '领取章节奖励' }))
    expect(
      screen.getByRole('status', { name: '第一章 · 冷炉初燃完成' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '继续' }))
    expect(
      screen.getByRole('dialog', {
        name: '剧情对话：第一章 · 冷炉初燃 · 收尾',
      }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '跳过剧情对话' }))

    expect(
      screen.getByRole('dialog', { name: '帮派权力树' }),
    ).toBeInTheDocument()
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

  it('economy and adventure idle controllers mount regardless of overlay', async () => {
    render(<App />)
    expect(screen.getByTestId('economy-idle-controller')).toBeInTheDocument()
    expect(screen.getByTestId('adventure-idle-clock')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '推关' }))
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
      currentLevel: 20,
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
      currentLevel: 12,
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
