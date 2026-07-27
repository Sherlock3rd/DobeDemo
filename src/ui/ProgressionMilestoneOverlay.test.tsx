import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProgressionMilestoneOverlay } from './ProgressionMilestoneOverlay'

describe('ProgressionMilestoneOverlay', () => {
  it('announces an internal management handover before its briefing', async () => {
    const onContinue = vi.fn()
    render(
      <ProgressionMilestoneOverlay
        milestone={{ kind: 'building', buildingId: 'repair-shop' }}
        onContinue={onContinue}
      />,
    )

    expect(
      screen.getByRole('status', { name: '修车厂管理权已交接' }),
    ).toBeInTheDocument()
    expect(screen.getByText('接管生效')).toBeInTheDocument()
    expect(screen.getByText('修车厂 · 管理权已交接')).toBeInTheDocument()
    expect(document.querySelector('.takeover-hammer__tool')).toBeInTheDocument()
    expect(
      document.querySelector('.takeover-hammer__sparks'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '听取管理简报' }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('announces chapter completion and the next gang role', () => {
    render(
      <ProgressionMilestoneOverlay
        milestone={{ kind: 'chapter', chapterNumber: 1 }}
        onContinue={() => {}}
      />,
    )

    expect(
      screen.getByRole('status', { name: '序章 · 逃亡者的补丁完成' }),
    ).toHaveTextContent('Full Patch · 正式成员')
  })
})
