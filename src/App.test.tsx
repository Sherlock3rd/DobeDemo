import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChestTick } from './game/chestTick'
import { getChapterForGangLevel } from './game/chapterProgression'
import { getTotalReputationForLevel } from './game/gangProgression'
import { useAdventureStore } from './store/useAdventureStore'
import { useChapterStore } from './store/useChapterStore'
import { useCityStore } from './store/useCityStore'
import { useGangStore } from './store/useGangStore'
import { useStoryStore } from './store/useStoryStore'

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
  CityScene: (p: {
    guidedBuildingId?: 'repair-shop' | 'recycling-yard' | null
    onBuildingClaimed?: (id: 'repair-shop' | 'recycling-yard') => void
  }) => (
    <div
      data-testid="city-scene-mock"
      data-guided-building={p.guidedBuildingId ?? ''}
    >
      <button
        type="button"
        onClick={() => {
          useCityStore.getState().claimBuilding('repair-shop', 1, BASE_TIME)
          p.onBuildingClaimed?.('repair-shop')
        }}
      >
        地图接管修车厂
      </button>
      <button
        type="button"
        onClick={() => {
          useCityStore
            .getState()
            .claimBuilding(
              'recycling-yard',
              useGangStore.getState().currentLevel,
              BASE_TIME,
            )
          p.onBuildingClaimed?.('recycling-yard')
        }}
      >
        地图交接废车回收厂
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
  BattleScreen: (p: {
    stage: number
    onExit: () => void
    onNext?: (stage: number) => void
    onDevelop: () => void
    roleChallengeTitle?: string
    onRoleChallengeVictory?: () => void
  }) => (
    <div role="dialog" aria-label="战斗" data-stage={p.stage}>
      <p>{`战斗关卡 ${p.stage}`}</p>
      <button type="button" onClick={p.onExit}>
        退出战斗
      </button>
      {p.onNext ? (
        <button type="button" onClick={() => p.onNext?.(p.stage + 1)}>
          下一关战斗
        </button>
      ) : null}
      <button type="button" onClick={p.onDevelop}>
        战斗失败养成
      </button>
      {p.onRoleChallengeVictory ? (
        <button type="button" onClick={p.onRoleChallengeVictory}>
          模拟赢得推关交接
        </button>
      ) : null}
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
  RaceScreen: (p: {
    onExit: () => void
    onDevelop: () => void
    roleChallengeTitle?: string
    onRoleChallengeVictory?: () => void
  }) => (
    <div role="dialog" aria-label="公路争霸">
      <button type="button" onClick={p.onExit}>
        返回赛车
      </button>
      <button type="button" onClick={p.onDevelop}>
        赛车失败养成
      </button>
      {p.onRoleChallengeVictory ? (
        <button type="button" onClick={p.onRoleChallengeVictory}>
          模拟赢得竞速交接
        </button>
      ) : null}
    </div>
  ),
}))

vi.mock('./ui/VehicleWorkshopOverlay', () => ({
  CarModificationOverlay: (p: { onComplete: () => void }) => (
    <div role="dialog" aria-label="3D 改车工位">
      <button type="button" onClick={p.onComplete}>
        完成 3D 改车
      </button>
    </div>
  ),
  CarDismantleOverlay: (p: { onComplete: () => void }) => (
    <div role="dialog" aria-label="3D 拆车工位">
      <button type="button" onClick={p.onComplete}>
        完成 3D 拆车
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
    useStoryStore.getState().reset()
    useStoryStore.setState({ enabled: false })
    useChapterStore.setState({
      prologueStep: 'complete',
      seenNarrativeIds: ['first-entry', 'chapter-start:1'],
    })
    useChestTick.setState({ now: BASE_TIME, tick: 0 })
    canvasPropsSpy.mockClear()
  })

  it('starts Plan C with the illustrated police pursuit and enters SUP', async () => {
    const user = userEvent.setup()
    useStoryStore.setState({
      enabled: true,
      currentStepNumber: 1,
      briefedStepNumbers: [],
    })

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '警匪追逐' }),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: '进入 SUP · 甩开警方' }),
    )
    expect(screen.getByRole('dialog', { name: '公路争霸' })).toBeInTheDocument()
  })

  it('opens the Plan C photo wall from the main gang-tree entry', async () => {
    const user = userEvent.setup()
    useStoryStore.setState({
      enabled: true,
      currentStepNumber: 5,
      briefedStepNumbers: [5],
    })

    render(<App />)
    await user.click(screen.getByRole('button', { name: '帮派树' }))

    expect(
      screen.getByRole('dialog', { name: '帮派照片墙' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    expect(screen.getByText('声望 60')).toBeInTheDocument()
  })

  it('requires the first 3D dismantle before advancing from L06', async () => {
    const user = userEvent.setup()
    const initialSpareParts = useAdventureStore.getState().spareParts
    useStoryStore.setState({
      enabled: true,
      currentStepNumber: 6,
      briefedStepNumbers: [],
    })

    render(<App />)

    await user.click(
      await screen.findByRole('button', { name: '进入 3D 首次拆车工位' }),
    )
    expect(
      screen.getByRole('dialog', { name: '3D 拆车工位' }),
    ).toBeInTheDocument()
    expect(useStoryStore.getState().currentStepNumber).toBe(6)

    await user.click(screen.getByRole('button', { name: '完成 3D 拆车' }))

    expect(useStoryStore.getState().currentStepNumber).toBe(7)
    expect(useAdventureStore.getState().spareParts).toBe(initialSpareParts + 15)
  })

  it('requires the 3D nitrous workshop before advancing from L07', async () => {
    const user = userEvent.setup()
    useStoryStore.setState({
      enabled: true,
      currentStepNumber: 7,
      briefedStepNumbers: [],
    })

    render(<App />)

    await user.click(
      await screen.findByRole('button', { name: '进入 3D 氮气安装工位' }),
    )
    expect(
      screen.getByRole('dialog', { name: '3D 改车工位' }),
    ).toBeInTheDocument()
    expect(useStoryStore.getState().currentStepNumber).toBe(7)

    await user.click(screen.getByRole('button', { name: '完成 3D 改车' }))

    expect(useStoryStore.getState().currentStepNumber).toBe(8)
  })

  it('requires the 3D dismantling workshop and grants its salvage reward', async () => {
    const user = userEvent.setup()
    const initialSpareParts = useAdventureStore.getState().spareParts
    useStoryStore.setState({
      enabled: true,
      currentStepNumber: 15,
      briefedStepNumbers: [],
    })

    render(<App />)

    await user.click(
      await screen.findByRole('button', { name: '进入 3D 废车拆解台' }),
    )
    expect(
      screen.getByRole('dialog', { name: '3D 拆车工位' }),
    ).toBeInTheDocument()
    expect(useStoryStore.getState().currentStepNumber).toBe(15)

    await user.click(screen.getByRole('button', { name: '完成 3D 拆车' }))

    expect(useStoryStore.getState().currentStepNumber).toBe(16)
    expect(useAdventureStore.getState().spareParts).toBe(initialSpareParts + 25)
    expect(
      useAdventureStore
        .getState()
        .carPartInventory.some(
          (part) => part.slot === 'suspension' && part.quality === 'common',
        ),
    ).toBe(true)
  })

  it('uses the 3D race-prep workshop and equips the recovered suspension at L16', async () => {
    const user = userEvent.setup()
    useAdventureStore.getState().grantChapterReward({
      gangReputation: 0,
      heroExperience: 0,
      spareParts: 0,
      carParts: [{ slot: 'suspension', quality: 'common' }],
      resources: { money: 0, oil: 0, materials: 0 },
      unlockCarIds: [],
      unlockGunIds: [],
    })
    const suspension = useAdventureStore
      .getState()
      .carPartInventory.find((part) => part.slot === 'suspension')
    useStoryStore.setState({
      enabled: true,
      currentStepNumber: 16,
      briefedStepNumbers: [],
    })

    render(<App />)

    await user.click(
      await screen.findByRole('button', { name: '进入 3D 配件安装工位' }),
    )
    await user.click(screen.getByRole('button', { name: '完成 3D 改车' }))

    expect(useStoryStore.getState().currentStepNumber).toBe(17)
    expect(
      useAdventureStore.getState().carPartSlotsByCar['rust-fox'].suspension,
    ).toBe(suspension?.id)
  })

  it('renders the canvas with an orthographic projection', () => {
    render(<App />)
    expect(canvasPropsSpy).toHaveBeenCalled()
    const props = canvasPropsSpy.mock.calls[0][0] as { orthographic?: boolean }
    expect(props.orthographic).toBe(true)
  })

  it('opens with the illustrated police chase and launches the first SUP race', async () => {
    const user = userEvent.setup()
    useCityStore.getState().reset(BASE_TIME)
    useChapterStore.setState({
      prologueStep: 'opening-dialogue',
      seenNarrativeIds: [],
      completedAssessmentChapterNumbers: [],
    })

    render(<App />)

    expect(
      await screen.findByRole('dialog', { name: '剧情对话：警灯咬住后轮' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Thomas 骑摩托逃离警察追击' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '跳过剧情对话' }))
    expect(screen.getByRole('dialog', { name: '公路争霸' })).toBeInTheDocument()
    expect(useChapterStore.getState().prologueStep).toBe('police-race')
  })

  it('keeps a migrated save on its explicit active chapter without auto-opening a meeting', async () => {
    const user = userEvent.setup()
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      currentLevel: 8,
      lastUpdatedAt: BASE_TIME,
    })
    useChapterStore.setState({
      activeChapterNumber: 2,
      selectedTaskPackageIds: { 2: 'chapter-2-package-random-b' },
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
      screen.queryByRole('dialog', { name: /评定会议/ }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '章节' }))
    expect(
      screen.getByRole('status', { name: '当前第 2 章' }),
    ).toBeInTheDocument()
  })

  it('does not open a meeting from the gang tree after a role promotion', async () => {
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
    })

    render(<App />)
    await user.click(screen.getByRole('button', { name: '帮派树' }))
    await user.click(screen.getByRole('button', { name: '和平交接' }))
    expect(
      screen.getByRole('dialog', {
        name: '正式成员职位交接：Maeve “Red” Quinn',
      }),
    ).toBeInTheDocument()
    expect(useGangStore.getState().currentLevel).toBe(7)
    await user.click(screen.getByRole('button', { name: '下一句' }))
    await user.click(screen.getByRole('button', { name: '确认和平交接' }))
    expect(useGangStore.getState().currentLevel).toBe(8)
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
      screen.queryByRole('dialog', { name: /评定会议/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('dialog', {
        name: '帮派权力树',
      }),
    ).toBeInTheDocument()
  })

  it('requires a push-stage victory before the technical role changes hands', async () => {
    const user = userEvent.setup()
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(16),
      currentLevel: 15,
      lastUpdatedAt: BASE_TIME,
    })
    useChapterStore.setState({
      claimedChapterNumbers: [getChapterForGangLevel(15).number],
    })

    render(<App />)
    await user.click(screen.getByRole('button', { name: '帮派树' }))
    await user.click(screen.getByRole('button', { name: '推关挑战' }))

    expect(
      screen.getByRole('dialog', {
        name: '技术骨干职位交接：Arthur Shelby',
      }),
    ).toBeInTheDocument()
    expect(useGangStore.getState().currentLevel).toBe(15)
    await user.click(screen.getByRole('button', { name: '开始推关挑战' }))
    expect(screen.getByRole('dialog', { name: '战斗' })).toHaveAttribute(
      'data-stage',
      '3',
    )

    await user.click(screen.getByRole('button', { name: '模拟赢得推关交接' }))
    expect(useGangStore.getState().currentLevel).toBe(16)
    expect(
      screen.getByRole('status', { name: '职级晋升：技术骨干' }),
    ).toBeInTheDocument()
  })

  it('requires a SUP race victory before the road captain role changes hands', async () => {
    const user = userEvent.setup()
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(32),
      currentLevel: 31,
      lastUpdatedAt: BASE_TIME,
    })
    useChapterStore.setState({
      claimedChapterNumbers: [getChapterForGangLevel(31).number],
    })

    render(<App />)
    await user.click(screen.getByRole('button', { name: '帮派树' }))
    await user.click(screen.getByRole('button', { name: 'SUP 竞速挑战' }))

    expect(
      screen.getByRole('dialog', {
        name: '路线队长职位交接：Charlie Strong',
      }),
    ).toBeInTheDocument()
    expect(useGangStore.getState().currentLevel).toBe(31)
    await user.click(screen.getByRole('button', { name: '开始 SUP 竞速挑战' }))
    expect(screen.getByRole('dialog', { name: '公路争霸' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '模拟赢得竞速交接' }))
    expect(useGangStore.getState().currentLevel).toBe(32)
    expect(
      screen.getByRole('status', { name: '职级晋升：路线队长' }),
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
    expect(screen.getByText('战斗关卡 1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '推关' })).toBeNull()
    expect(screen.queryByRole('button', { name: '设置' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '下一关战斗' }))
    expect(screen.getByText('战斗关卡 2')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '推关地图' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '退出战斗' }))
    expect(screen.getByRole('dialog', { name: '推关地图' })).toBeInTheDocument()
  })

  it('opens SUP from settings debug and returns to its lobby after a race', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: '设置' }))
    await userEvent.click(
      screen.getByRole('button', { name: '打开 SUP 调试入口' }),
    )
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
    await userEvent.click(screen.getByRole('button', { name: '设置' }))
    await userEvent.click(
      screen.getByRole('button', { name: '打开 SUP 调试入口' }),
    )
    await userEvent.click(screen.getByRole('button', { name: '发车' }))
    await userEvent.click(screen.getByRole('button', { name: '赛车失败养成' }))
    expect(screen.getByRole('dialog', { name: '英雄培养' })).toHaveAttribute(
      'data-initial-tab',
      'car',
    )
  })

  it('opens vehicle development from the prologue part task guide', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: '章节' }))
    await userEvent.click(screen.getByRole('button', { name: '前往车辆配件' }))

    expect(screen.getByRole('dialog', { name: '英雄培养' })).toHaveAttribute(
      'data-initial-tab',
      'car',
    )
  })

  it('selects the relevant city building from a chapter task guide', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: '章节' }))
    await userEvent.click(screen.getByRole('button', { name: '前往对应建筑' }))

    expect(useCityStore.getState().selectedBuildingId).toBe('repair-shop')
    expect(screen.getByRole('heading', { name: '修车厂' })).toBeInTheDocument()
  })

  it('routes the approved first meeting through manual promotion and the recycling-yard task', async () => {
    const user = userEvent.setup()
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      currentLevel: 7,
    })
    useChapterStore.setState({
      prologueStep: 'gang-training',
      claimedChapterNumbers: [1],
      seenNarrativeIds: ['prologue:gang-training'],
    })
    render(<App />)

    await user.click(screen.getByRole('button', { name: '帮派树' }))
    await user.click(screen.getByRole('button', { name: '参加转正会议' }))
    expect(
      screen.getByRole('dialog', {
        name: '序章 · 逃亡者的补丁完成评定会议',
      }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '开始资格表决' }))
    expect(
      screen.getByRole('status', { name: '正式成员资格表决结果' }),
    ).toHaveTextContent('赞成 5 席 · 保留 1 席 · 资格通过')
    await user.click(screen.getByRole('button', { name: '听取表决后的对话' }))
    await user.click(screen.getByRole('button', { name: '下一句' }))
    await user.click(screen.getByRole('button', { name: '查看下一章任务包' }))
    expect(
      screen.queryByRole('button', { name: '进入事件表决' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getAllByRole('radio')[1])
    await user.click(
      screen.getByRole('button', { name: '确认接取并开始第2章' }),
    )

    expect(
      screen.getByRole('dialog', { name: '帮派权力树' }),
    ).toBeInTheDocument()
    expect(useGangStore.getState().currentLevel).toBe(7)
    expect(useChapterStore.getState().prologueStep).toBe('formal-promotion')

    await user.click(screen.getByRole('button', { name: '晋升正式成员' }))
    expect(useGangStore.getState().currentLevel).toBe(8)
    expect(
      screen.getByRole('status', { name: '职级晋升：正式成员' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '跳过晋升演出' }))

    expect(
      screen.getByRole('dialog', {
        name: '剧情对话：第二章 · 废铁生意',
      }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '跳过剧情对话' }))

    expect(
      screen.getByRole('status', {
        name: '强制引导：交接废车回收厂',
      }),
    ).toBeInTheDocument()
    const takeoverTask = screen.getByRole('button', {
      name: '立即交接废车回收厂',
    })
    expect(takeoverTask).toHaveFocus()
    await user.click(takeoverTask)

    expect(screen.getByTestId('city-scene-mock')).toHaveAttribute(
      'data-guided-building',
      'recycling-yard',
    )
    expect(useChapterStore.getState().prologueStep).toBe('recycling-takeover')
    await user.click(screen.getByRole('button', { name: '地图交接废车回收厂' }))
    expect(
      screen.getByRole('status', { name: '废车回收厂管理权已交接' }),
    ).toBeInTheDocument()
    expect(useChapterStore.getState().prologueStep).toBe('complete')
    await user.click(screen.getByRole('button', { name: '听取管理简报' }))
    await user.click(screen.getByRole('button', { name: '跳过剧情对话' }))

    expect(
      screen.getByRole('heading', { name: '交接废车回收厂' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('交接废车回收厂进度')).toHaveTextContent('1/1')
    expect(useChapterStore.getState()).toMatchObject({
      activeChapterNumber: 2,
      selectedTaskPackageIds: { 2: 'chapter-2-package-random-b' },
      meetingVotes: { 1: 'formal-member-approved' },
      completedAssessmentChapterNumbers: [1],
      prologueStep: 'complete',
    })
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
