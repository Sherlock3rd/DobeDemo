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
    expect(screen.getByText('陈锤·工头')).toBeInTheDocument()
    expect(screen.getByText('岳峰·铁砧')).toBeInTheDocument()
    expect(screen.getByText(/帮派 Lv.12 解锁/)).toBeInTheDocument()
  })

  it('upgrades foreman spending shared exp when cap allows', async () => {
    useGangStore.setState({ totalReputation: 60, lastUpdatedAt: BASE_TIME })
    useAdventureStore.setState({ sharedExp: 100 })
    render(<HeroesPanel onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /提升至 Lv\.2/ }))
    expect(useAdventureStore.getState().heroLevels.foreman).toBe(2)
    expect(screen.getByRole('status')).toHaveTextContent('已升级 陈锤 至 Lv.2')
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
          id: 'part-armor',
          slot: 'armor',
          quality: 'worn',
          level: 1,
        },
      ],
    })
    render(<HeroesPanel onClose={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: '车辆' }))
    const engineCard = screen.getByText('旧件·动力核心').closest('article')
    expect(engineCard).not.toBeNull()
    await userEvent.click(
      within(engineCard as HTMLElement).getByRole('button', {
        name: '安装',
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

    const armorCard = screen.getByText('旧件·装甲组件').closest('article')
    expect(armorCard).not.toBeNull()
    await userEvent.click(
      within(armorCard as HTMLElement).getByRole('button', {
        name: '回收 +8',
      }),
    )
    expect(useAdventureStore.getState().carPartInventory).toHaveLength(1)
    expect(useAdventureStore.getState().spareParts).toBe(96)

    await userEvent.click(screen.getByRole('button', { name: '卸下' }))
    expect(
      useAdventureStore.getState().carPartSlotsByCar['rust-fox'].engine,
    ).toBeNull()
  })

  it('upgrades the equipped gun with recycled spare parts', async () => {
    useAdventureStore.setState({ spareParts: 100 })
    render(<HeroesPanel onClose={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: '枪械' }))
    await userEvent.click(
      screen.getByRole('button', {
        name: '升级至 Lv.1 · 40 零件',
      }),
    )

    expect(useAdventureStore.getState().gunLevels['rivet-smg']).toBe(1)
    expect(useAdventureStore.getState().spareParts).toBe(60)
    expect(screen.getByText('强化 Lv.1/10')).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(<HeroesPanel onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
