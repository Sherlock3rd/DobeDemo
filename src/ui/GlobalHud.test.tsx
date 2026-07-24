import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdventureStore } from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { GlobalHud } from './GlobalHud'

const BASE_TIME = 1_700_000_000_000

describe('GlobalHud', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset(BASE_TIME)
    useGangStore.getState().reset(BASE_TIME)
    useAdventureStore.getState().reset(BASE_TIME)
  })

  it('renders four resource readouts including shared hero exp', () => {
    render(
      <GlobalHud
        onOpenHeroes={() => {}}
        onOpenGangTree={() => {}}
        onOpenAdventure={() => {}}
        onOpenSettings={() => {}}
      />,
    )
    expect(screen.getByLabelText('资源')).toBeInTheDocument()
    expect(screen.getByText(/英雄经验/)).toBeInTheDocument()
  })

  it('shows gang level and role in the gang entry', () => {
    useGangStore.setState({ totalReputation: 330, lastUpdatedAt: BASE_TIME })
    render(
      <GlobalHud
        onOpenHeroes={() => {}}
        onOpenGangTree={() => {}}
        onOpenAdventure={() => {}}
        onOpenSettings={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', { name: /Full Patch/ }),
    ).toBeInTheDocument()
  })

  it('routes bottom nav callbacks', async () => {
    const onOpenAdventure = vi.fn()
    render(
      <GlobalHud
        onOpenHeroes={() => {}}
        onOpenGangTree={() => {}}
        onOpenAdventure={onOpenAdventure}
        onOpenSettings={() => {}}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /推关/ }))
    expect(onOpenAdventure).toHaveBeenCalled()
  })

  it('shows the adventure red dot for a fresh account', () => {
    render(
      <GlobalHud
        onOpenHeroes={() => {}}
        onOpenGangTree={() => {}}
        onOpenAdventure={() => {}}
        onOpenSettings={() => {}}
      />,
    )
    expect(
      screen.getByLabelText('有可挑战关卡或可领取宝箱'),
    ).toBeInTheDocument()
  })
})
