import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdventureStore } from '../store/useAdventureStore'
import { useGangStore } from '../store/useGangStore'
import { FormationPanel } from './FormationPanel'
import {
  computeEnemyPowerForStage,
  computeTeamPowerForFormation,
} from './formationPower'

const BASE_TIME = 1_700_000_000_000

describe('FormationPanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useGangStore.getState().reset(BASE_TIME)
    useAdventureStore.getState().reset(BASE_TIME)
  })

  it('moves focus to its programmatically focusable title when opened', () => {
    render(<FormationPanel stage={1} onCancel={() => {}} onStart={() => {}} />)

    const title = screen.getByRole('heading', { name: '编队 · 关卡 1' })
    expect(title).toHaveAttribute('tabindex', '-1')
    expect(title).toHaveFocus()
  })

  it('renders five slots labeled front[0..1] and back[0..2]', () => {
    render(<FormationPanel stage={1} onCancel={() => {}} onStart={() => {}} />)
    expect(screen.getAllByRole('button', { name: /阵位/ })).toHaveLength(5)
  })

  it('shows both team powers using position-modified stats', () => {
    render(<FormationPanel stage={1} onCancel={() => {}} onStart={() => {}} />)
    const ourPower = computeTeamPowerForFormation(
      [{ heroId: 'foreman', row: 'back', index: 1 }],
      { foreman: 1, anvil: 1, skyline: 1 },
    )
    expect(
      screen.getByLabelText(new RegExp(`我方战力 ${ourPower}`)),
    ).toBeInTheDocument()
    expect(computeEnemyPowerForStage(1)).toBeGreaterThan(0)
  })

  it('deploys a hero into a slot via keyboard swap and starts', async () => {
    const onStart = vi.fn()
    render(<FormationPanel stage={1} onCancel={() => {}} onStart={onStart} />)
    await userEvent.click(screen.getByRole('button', { name: /^快速部署/ }))
    await userEvent.click(screen.getByRole('button', { name: /^开始$/ }))
    expect(onStart).toHaveBeenCalledWith(1)
  })

  it('cannot deploy a locked hero', () => {
    render(<FormationPanel stage={1} onCancel={() => {}} onStart={() => {}} />)
    expect(screen.getByText(/岳峰.*帮派 Lv.12/)).toBeInTheDocument()
  })
})
