import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getRoleHandover } from '../game/roleHandover'
import { RoleHandoverOverlay } from './RoleHandoverOverlay'

describe('RoleHandoverOverlay', () => {
  it('finishes a peaceful handover only after both dialogue lines', () => {
    const onCompleteDialogue = vi.fn()
    const handover = getRoleHandover(8)
    if (!handover) throw new Error('missing handover')

    render(
      <RoleHandoverOverlay
        handover={handover}
        onCancel={() => {}}
        onCompleteDialogue={onCompleteDialogue}
        onStartChallenge={() => {}}
      />,
    )

    expect(
      screen.getByRole('dialog', {
        name: '正式成员职位交接：Maeve “Red” Quinn',
      }),
    ).toHaveAttribute('data-mode', 'dialogue')
    fireEvent.click(screen.getByRole('button', { name: '下一句' }))
    expect(onCompleteDialogue).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认和平交接' }))
    expect(onCompleteDialogue).toHaveBeenCalledTimes(1)
  })

  it('starts the configured gameplay challenge without promoting directly', () => {
    const onStartChallenge = vi.fn()
    const handover = getRoleHandover(32)
    if (!handover) throw new Error('missing handover')

    render(
      <RoleHandoverOverlay
        handover={handover}
        onCancel={() => {}}
        onCompleteDialogue={() => {}}
        onStartChallenge={onStartChallenge}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '开始 SUP 竞速挑战' }))
    expect(onStartChallenge).toHaveBeenCalledTimes(1)
  })
})
