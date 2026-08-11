import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStoryStore } from '../store/useStoryStore'
import { StoryGangTreePanel } from './StoryGangTreePanel'

describe('StoryGangTreePanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useStoryStore.getState().reset()
  })

  it('renders a ten-layer photo wall with Thomas on his current tier', () => {
    render(
      <StoryGangTreePanel
        currentStepNumber={5}
        canContinue
        onContinue={vi.fn()}
        onRewardClaimed={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('dialog', { name: '剃刀党照片墙' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    expect(
      screen.getByLabelText('你在这里：Thomas Shelby，见习'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('英雄解锁').length).toBeGreaterThan(0)
    expect(screen.getAllByText('建筑管理者').length).toBeGreaterThan(0)
    expect(screen.getAllByText('经营者').length).toBeGreaterThan(0)
  })

  it('requires an explicit N-1 photo click before reporting the handover', async () => {
    const onRewardClaimed = vi.fn()
    useStoryStore.setState({ currentStepNumber: 11 })
    render(
      <StoryGangTreePanel
        currentStepNumber={11}
        canContinue={false}
        requiredRewardId="repair-shop-vacancy"
        onContinue={vi.fn()}
        onRewardClaimed={onRewardClaimed}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('管理席位空置')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: '接管修车厂管理权' }),
    )

    expect(onRewardClaimed).toHaveBeenCalledWith('repair-shop-vacancy')
    expect(useStoryStore.getState().claimedGangWallRewardIds).toContain(
      'repair-shop-vacancy',
    )
  })
})
