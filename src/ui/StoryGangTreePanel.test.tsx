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
        onPromotionRequested={vi.fn()}
        onRewardClaimed={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('dialog', { name: '帮派照片墙' }),
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
    useStoryStore.setState({ currentStepNumber: 13 })
    render(
      <StoryGangTreePanel
        currentStepNumber={13}
        canContinue={false}
        requiredRewardId="hugo-garage-manager"
        onContinue={vi.fn()}
        onPromotionRequested={vi.fn()}
        onRewardClaimed={onRewardClaimed}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('修车厂看守人')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: '收复 Hugo 与修车厂管理线' }),
    )

    expect(onRewardClaimed).toHaveBeenCalledWith('hugo-garage-manager')
    expect(useStoryStore.getState().claimedGangWallRewardIds).toContain(
      'hugo-garage-manager',
    )
  })

  it('shows the exact reputation threshold before a promotion meeting', async () => {
    const onPromotionRequested = vi.fn()
    render(
      <StoryGangTreePanel
        currentStepNumber={10}
        canContinue={false}
        promotionTargetTier={2}
        onContinue={vi.fn()}
        onPromotionRequested={onPromotionRequested}
        onRewardClaimed={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('声望 100')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: '晋升 Full Patch' }),
    )
    expect(onPromotionRequested).toHaveBeenCalledTimes(1)
  })
})
