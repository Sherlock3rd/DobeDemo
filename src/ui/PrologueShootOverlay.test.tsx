import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PrologueShootOverlay } from './PrologueShootOverlay'

describe('PrologueShootOverlay', () => {
  it('requires three visible hits before completing the borrowed-gun scene', async () => {
    const onComplete = vi.fn()
    render(<PrologueShootOverlay onComplete={onComplete} />)

    const target = screen.getByRole('button', { name: /射击敌方摩托/ })
    expect(
      screen.getByRole('dialog', { name: '借枪射击敌方摩托' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('准星已经压住车尾')

    await userEvent.click(target)
    await userEvent.click(target)
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('还差 1 枪')

    await userEvent.click(target)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
