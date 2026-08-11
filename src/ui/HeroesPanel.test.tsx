// @ts-expect-error Vitest runs in Node; the app tsconfig intentionally omits Node types.
import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { heroesConfig } from '../config/heroesConfig'
import { useChestTick } from '../game/chestTick'
import { getTotalReputationForLevel } from '../game/gangProgression'
import { useAdventureStore } from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { useChapterStore } from '../store/useChapterStore'
import { HeroesPanel } from './HeroesPanel'

const BASE_TIME = 1_700_000_000_000
const appStyles = readFileSync('src/App.css', 'utf8')
const styleElement = document.createElement('style')

describe('HeroesPanel', () => {
  beforeAll(() => {
    styleElement.textContent = appStyles
    document.head.append(styleElement)
  })

  afterAll(() => {
    styleElement.remove()
  })

  beforeEach(() => {
    window.localStorage.clear()
    useGangStore.getState().reset(BASE_TIME)
    useCityStore.getState().reset(BASE_TIME)
    useAdventureStore.getState().reset(BASE_TIME)
    useAdventureStore.getState().grantPrologueGun()
    useChapterStore.getState().reset()
    useChapterStore.setState({ prologueStep: 'complete' })
    useChestTick.setState({ now: BASE_TIME, tick: 0 })
  })

  it('moves focus to its programmatically focusable title when opened', () => {
    render(<HeroesPanel onClose={() => {}} />)

    const title = screen.getByRole('heading', { name: '英雄培养' })
    expect(title).toHaveAttribute('tabindex', '-1')
    expect(title).toHaveFocus()
  })

  it('lists all three heroes, locking those above gang level', () => {
    render(<HeroesPanel onClose={() => {}} />)
    const roster = within(screen.getByRole('navigation', { name: '英雄列表' }))
    expect(roster.getByText('Maeve “Red” Quinn')).toBeInTheDocument()
    expect(roster.getByText('主席派来的调查员 · Lv.1')).toBeInTheDocument()
    expect(roster.getByText('Arthur Shelby')).toBeInTheDocument()
    expect(
      roster.getByText('技术骨干席位 · 帮派 Lv.16 接掌后加入'),
    ).toBeInTheDocument()
    expect(roster.getByText('Polly Gray')).toBeInTheDocument()
    expect(
      roster.getByText('酒吧联络人席位 · 帮派 Lv.24 接掌后加入'),
    ).toBeInTheDocument()
  })

  it('keeps name, level, and hero power as aligned siblings in one wrapping identity row', () => {
    render(<HeroesPanel onClose={() => {}} />)

    const showcase = document.querySelector('.heroes-panel__showcase')
    const identity = showcase?.querySelector('.heroes-panel__identity')
    const identityCopy = identity?.querySelector('.heroes-panel__identity-copy')
    expect(showcase).not.toBeNull()
    expect(identity).not.toBeNull()
    expect(identityCopy).not.toBeNull()
    const name = within(identityCopy as HTMLElement).getByRole('heading', {
      name: 'Maeve “Red” Quinn',
    })
    const level = within(identityCopy as HTMLElement).getByText('Lv.1')
    const power = within(identityCopy as HTMLElement).getByLabelText(
      /英雄战力 \d+/,
    )
    expect([...((identityCopy as HTMLElement).children ?? [])]).toEqual([
      name,
      level,
      power,
    ])
    const identityCopyStyle = getComputedStyle(identityCopy as HTMLElement)
    expect(identityCopyStyle.display).toBe('flex')
    expect(identityCopyStyle.flexWrap).toBe('wrap')
    expect(identityCopyStyle.alignItems).toBe('baseline')
    expect(showcase?.querySelector('.heroes-panel__power')).toBeNull()
  })

  it('shows a concise accessible skill card without damage estimates', () => {
    const skill = heroesConfig.heroes.foreman.skill

    render(<HeroesPanel onClose={() => {}} />)

    const skillCard = screen.getByRole('region', { name: /主动技能/ })
    expect(
      within(skillCard).getByRole('heading', { name: skill.name }),
    ).toBeInTheDocument()
    expect(skillCard).toHaveTextContent(skill.description)
    expect(skillCard).toHaveTextContent('满怒自动释放')
    expect(skillCard).not.toHaveTextContent('ATK ×')
    expect(skillCard).not.toHaveTextContent('理论裸防伤害')
    expect(skillCard).not.toHaveTextContent('预估伤害')
  })

  it('uses the shared gang portrait atlas without legacy geometric portrait pieces', () => {
    render(<HeroesPanel onClose={() => {}} />)

    const portrait = document.querySelector(
      '.heroes-panel__showcase > .heroes-panel__portrait',
    ) as HTMLElement
    const identity = document.querySelector(
      '.heroes-panel__identity',
    ) as HTMLElement
    const power = identity.querySelector('.resource-amount') as HTMLElement
    const portraitStyle = getComputedStyle(portrait)
    const identityStyle = getComputedStyle(identity)
    const powerStyle = getComputedStyle(power)

    expect(portraitStyle.overflow).toBe('hidden')
    expect(portraitStyle.isolation).toBe('isolate')
    expect(portrait.style.backgroundImage).toContain(
      'peaky-blinders-hierarchy-atlas',
    )
    expect(
      document.querySelectorAll('.heroes-panel__portrait--compact'),
    ).toHaveLength(3)
    expect(
      portrait.querySelector('.heroes-panel__portrait-head'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('剃刀党 · 正式成员席位 · 后排火力'),
    ).toBeInTheDocument()
    expect(identityStyle.zIndex).toBe('2')
    expect(powerStyle.position).toBe('relative')
    expect(powerStyle.zIndex).toBe('1')
  })

  it('upgrades the first combat hero spending shared exp when cap allows', async () => {
    useGangStore.setState({
      totalReputation: 60,
      currentLevel: 3,
      lastUpdatedAt: BASE_TIME,
    })
    useAdventureStore.setState({ sharedExp: 100 })
    render(<HeroesPanel onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /提升至 Lv\.2/ }))
    expect(useAdventureStore.getState().heroLevels.foreman).toBe(2)
    expect(screen.getByRole('status')).toHaveTextContent(
      '已升级 Maeve “Red” Quinn 至 Lv.2',
    )
  })

  it('blocks and explains gang cap', async () => {
    useAdventureStore.setState({ sharedExp: 100 })
    render(<HeroesPanel onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /提升至 Lv\.2/ }))
    expect(screen.getByRole('status')).toHaveTextContent(
      '英雄等级不能超过帮派等级',
    )
  })

  it('removes the salvage countdown while keeping storage and five-quality recycling', async () => {
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      currentLevel: 8,
      lastUpdatedAt: BASE_TIME,
    })
    render(<HeroesPanel onClose={() => {}} />)

    expect(screen.queryByText('废车回收厂')).not.toBeInTheDocument()
    expect(screen.queryByText(/下批约/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^车辆/ }))
    expect(screen.getByText('配件仓库 1/40')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^一键回收/ })).toHaveLength(5)
    await userEvent.click(screen.getByRole('button', { name: '选择轮胎' }))
    expect(
      screen.getByText('仓库暂无轮胎配件，请前往废车回收厂生产页领取。'),
    ).toBeInTheDocument()
  })

  it('installs, upgrades, unequips, and recycles car parts from the car tab', async () => {
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      currentLevel: 8,
      lastUpdatedAt: BASE_TIME,
    })
    useAdventureStore.setState((state) => ({
      spareParts: 100,
      heroLevels: { ...state.heroLevels, foreman: 2 },
      carPartInventory: [
        {
          id: 'part-engine',
          slot: 'engine',
          quality: 'common',
          level: 1,
        },
        {
          id: 'part-bumper',
          slot: 'bumper',
          quality: 'common',
          level: 1,
        },
      ],
    }))
    render(<HeroesPanel onClose={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: /^车辆/ }))
    await userEvent.click(screen.getByRole('button', { name: '选择引擎' }))
    expect(
      screen.getByRole('heading', { name: '选择引擎' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('防撞保险杠')).not.toBeInTheDocument()
    const engineCard = screen.getByText('强化引擎').closest('article')
    expect(engineCard).not.toBeNull()
    expect(within(engineCard as HTMLElement).getByText('引擎')).toBeVisible()
    expect(within(engineCard as HTMLElement).getByText('普通')).toBeVisible()
    expect(within(engineCard as HTMLElement).getByText('Lv.1')).toBeVisible()
    await userEvent.click(
      within(engineCard as HTMLElement).getByRole('button', {
        name: '安装到引擎',
      }),
    )
    expect(
      useAdventureStore.getState().carPartSlotsByCar['rust-fox'].engine,
    ).toBe('part-engine')

    await userEvent.click(
      screen.getByRole('button', { name: '升级 · 12 零件' }),
    )
    expect(useAdventureStore.getState().carPartInventory[0].level).toBe(2)
    expect(useAdventureStore.getState().spareParts).toBe(88)

    await userEvent.click(screen.getByRole('button', { name: '选择保险杠' }))
    const bumperCard = screen.getByText('防撞保险杠').closest('article')
    expect(bumperCard).not.toBeNull()
    await userEvent.click(
      within(bumperCard as HTMLElement).getByRole('button', {
        name: '回收 +8',
      }),
    )
    expect(useAdventureStore.getState().carPartInventory).toHaveLength(1)
    expect(useAdventureStore.getState().spareParts).toBe(96)

    await userEvent.click(
      screen.getByRole('button', { name: '← 返回当前车辆' }),
    )
    await userEvent.click(screen.getByRole('button', { name: '卸下' }))
    expect(
      useAdventureStore.getState().carPartSlotsByCar['rust-fox'].engine,
    ).toBeNull()
  })

  it('upgrades the equipped gun with recycled spare parts', async () => {
    useAdventureStore.setState({ spareParts: 100 })
    render(<HeroesPanel onClose={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: /^枪械/ }))
    await userEvent.click(
      screen.getByRole('button', {
        name: '升级至 Lv.1 · 40 零件',
      }),
    )

    expect(useAdventureStore.getState().gunLevels['rivet-smg']).toBe(1)
    expect(useAdventureStore.getState().spareParts).toBe(60)
    expect(screen.getByText('强化 Lv.1/1')).toBeInTheDocument()
  })

  it('shows current loadout first and changes cars in a separate garage screen', async () => {
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      currentLevel: 8,
      lastUpdatedAt: BASE_TIME,
    })
    useAdventureStore.setState({ chapterUnlockedCarIds: ['iron-fang'] })
    render(<HeroesPanel onClose={() => {}} />)

    expect(
      screen.getByRole('button', { name: '车辆 · 灰狐旧改车' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '枪械 · 铆钉冲锋枪' }),
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: '车辆 · 灰狐旧改车' }),
    )
    expect(screen.getByText('当前装备 · Maeve “Red” Quinn')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '更换车辆' }))
    expect(
      screen.getByRole('heading', { name: '选择车辆' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '当前已装备' })).toBeDisabled()
    const ironFangCard = screen
      .getByRole('heading', { name: '铁獠装甲车' })
      .closest('article')
    expect(ironFangCard).not.toBeNull()
    await userEvent.click(
      within(ironFangCard as HTMLElement).getByRole('button', {
        name: '装备此车辆',
      }),
    )

    expect(useAdventureStore.getState().equipmentByHero.foreman.carId).toBe(
      'iron-fang',
    )
    expect(
      screen.getByRole('button', { name: '车辆 · 铁獠装甲车' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '更换车辆' })).toBeInTheDocument()
  })

  it('changes guns in a separate weapon screen and Escape returns first', async () => {
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(12),
      currentLevel: 12,
      lastUpdatedAt: BASE_TIME,
    })
    const onClose = vi.fn()
    render(<HeroesPanel onClose={onClose} />)

    await userEvent.click(
      screen.getByRole('button', { name: '枪械 · 铆钉冲锋枪' }),
    )
    await userEvent.click(screen.getByRole('button', { name: '更换枪械' }))
    expect(
      screen.getByRole('heading', { name: '选择枪械' }),
    ).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '更换枪械' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '更换枪械' }))
    const doubleBarrelCard = screen
      .getByRole('heading', { name: '双管短喷' })
      .closest('article')
    expect(doubleBarrelCard).not.toBeNull()
    await userEvent.click(
      within(doubleBarrelCard as HTMLElement).getByRole('button', {
        name: '装备此枪械',
      }),
    )

    expect(useAdventureStore.getState().equipmentByHero.foreman.gunId).toBe(
      'double-barrel',
    )
    expect(
      screen.getByRole('button', { name: '枪械 · 双管短喷' }),
    ).toBeInTheDocument()
  })

  it('treats a fixed-slot part picker as a deeper Escape layer', async () => {
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      currentLevel: 8,
      lastUpdatedAt: BASE_TIME,
    })
    const onClose = vi.fn()
    render(<HeroesPanel onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: /^车辆/ }))
    await userEvent.click(screen.getByRole('button', { name: '选择轮胎' }))
    expect(
      screen.getByRole('heading', { name: '选择轮胎' }),
    ).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '选择轮胎' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(<HeroesPanel onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
