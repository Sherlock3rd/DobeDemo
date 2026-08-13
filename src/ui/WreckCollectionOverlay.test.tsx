import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WreckCollectionOverlay } from './WreckCollectionOverlay'

describe('WreckCollectionOverlay', () => {
  it('requires all three recovery markers before dispatching the tow crew', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<WreckCollectionOverlay onComplete={onComplete} />)

    const confirm = screen.getByRole('button', { name: '还需标记 3 处' })
    expect(confirm).toBeDisabled()

    for (const name of ['运河桥下废车', '旧货站残车', '纺织厂后巷废车']) {
      await user.click(screen.getByRole('button', { name: new RegExp(name) }))
    }

    await user.click(screen.getByRole('button', { name: '派出拖车队' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
