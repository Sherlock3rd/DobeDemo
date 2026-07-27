import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getNarrativeEvent } from '../game/narrative'
import { NarrativeDialogueOverlay } from './NarrativeDialogueOverlay'

describe('NarrativeDialogueOverlay', () => {
  it('steps through the briefing and completes on the final line', async () => {
    const event = getNarrativeEvent('first-entry')
    if (!event) throw new Error('Missing first-entry narrative')
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<NarrativeDialogueOverlay event={event} onComplete={onComplete} />)

    expect(
      screen.getByRole('dialog', { name: '剧情对话：第一把钥匙' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Eddie “Pins” Doyle' }),
    ).toBeVisible()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '下一句' }))
    await user.click(screen.getByRole('button', { name: '下一句' }))
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '开始行动' }))

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('offers an explicit skip action', async () => {
    const event = getNarrativeEvent('chapter-start:1')
    if (!event) throw new Error('Missing chapter narrative')
    const onComplete = vi.fn()
    render(<NarrativeDialogueOverlay event={event} onComplete={onComplete} />)

    await userEvent.click(screen.getByRole('button', { name: '跳过剧情对话' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('labels a chapter opening as the start of chapter action', async () => {
    const event = getNarrativeEvent('chapter-start:2')
    if (!event) throw new Error('Missing chapter narrative')
    const onComplete = vi.fn()
    render(<NarrativeDialogueOverlay event={event} onComplete={onComplete} />)

    await userEvent.click(screen.getByRole('button', { name: '下一句' }))
    await userEvent.click(screen.getByRole('button', { name: '开始章节行动' }))

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('sends the formal-member verdict directly to task packages', async () => {
    const event = getNarrativeEvent('special-vote:formal-member')
    if (!event) throw new Error('Missing eligibility narrative')
    const onComplete = vi.fn()
    render(<NarrativeDialogueOverlay event={event} onComplete={onComplete} />)

    await userEvent.click(screen.getByRole('button', { name: '下一句' }))
    await userEvent.click(
      screen.getByRole('button', { name: '查看下一章任务包' }),
    )

    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
