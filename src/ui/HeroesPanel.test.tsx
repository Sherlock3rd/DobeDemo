import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChestTick } from '../game/chestTick'
import { getTotalReputationForLevel } from '../game/gangProgression'
import { useAdventureStore } from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { HeroesPanel } from './HeroesPanel'

const BASE_TIME = 1_700_000_000_000

describe('HeroesPanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useGangStore.getState().reset(BASE_TIME)
    useCityStore.getState().reset(BASE_TIME)
    useAdventureStore.getState().reset(BASE_TIME)
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
    expect(roster.getByText('Thomas Shelby')).toBeInTheDocument()
    expect(roster.getByText('Tommy · Lv.1')).toBeInTheDocument()
    expect(roster.getByText('Arthur Shelby')).toBeInTheDocument()
    expect(roster.getByText('Arthur · 帮派 Lv.12 解锁')).toBeInTheDocument()
  })

  it('upgrades foreman spending shared exp when cap allows', async () => {
    useGangStore.setState({ totalReputation: 60, lastUpdatedAt: BASE_TIME })
    useAdventureStore.setState({ sharedExp: 100 })
    render(<HeroesPanel onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /提升至 Lv\.2/ }))
    expect(useAdventureStore.getState().heroLevels.foreman).toBe(2)
    expect(screen.getByRole('status')).toHaveTextContent(
      '已升级 Thomas Shelby 至 Lv.2',
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

  it('installs, upgrades, unequips, and recycles car parts from the car tab', async () => {
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      lastUpdatedAt: BASE_TIME,
    })
    useAdventureStore.setState({
      spareParts: 100,
      carPartInventory: [
        {
          id: 'part-engine',
          slot: 'engine',
          quality: 'worn',
          level: 1,
        },
        {
          id: 'part-bumper',
          slot: 'bumper',
          quality: 'worn',
          level: 1,
        },
      ],
    })
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
    expect(within(engineCard as HTMLElement).getByText('旧件')).toBeVisible()
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
    expect(screen.getByText('强化 Lv.1/10')).toBeInTheDocument()
  })

  it('shows current loadout first and changes cars in a separate garage screen', async () => {
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
      lastUpdatedAt: BASE_TIME,
    })
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
    expect(screen.getByText('当前装备 · Thomas Shelby')).toBeInTheDocument()
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
