import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdventureStore } from '../store/useAdventureStore'
import { useGangStore } from '../store/useGangStore'
import { HeroesPanel } from './HeroesPanel'

const BASE_TIME = 1_700_000_000_000

describe('HeroesPanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useGangStore.getState().reset(BASE_TIME)
    useAdventureStore.getState().reset(BASE_TIME)
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
    await userEvent.click(screen.getByRole('button', { name: /升级 陈锤/ }))
    expect(useAdventureStore.getState().heroLevels.foreman).toBe(2)
    expect(screen.getByRole('status')).toHaveTextContent(/升级|经验/)
  })

  it('blocks and explains gang cap', async () => {
    useAdventureStore.setState({ sharedExp: 100 })
    render(<HeroesPanel onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /升级 陈锤/ }))
    expect(screen.getByRole('status')).toHaveTextContent(/不能超过帮派等级/)
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(<HeroesPanel onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
