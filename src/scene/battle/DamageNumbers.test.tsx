import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { HitEvent } from '../../game/combat/battleEngine'

vi.mock('../city/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))

const { DamageNumbers } = await import('./DamageNumbers')

const hits: HitEvent[] = [
  {
    attackerSide: 'ally',
    attackerGlobalIndex: 2,
    targetSide: 'enemy',
    targetGlobalIndex: 0,
    amount: 42,
    kind: 'basic',
  },
  {
    attackerSide: 'ally',
    attackerGlobalIndex: 2,
    targetSide: 'enemy',
    targetGlobalIndex: 0,
    amount: 90,
    kind: 'skill-main',
  },
]

describe('DamageNumbers', () => {
  it('renders each integer amount as visible seven-segment geometry', () => {
    const { container } = render(<DamageNumbers hits={hits} />)
    expect(container.querySelector('[name="damage-42"]')).toBeInTheDocument()
    expect(container.querySelector('[name="damage-90"]')).toBeInTheDocument()
    expect(container.querySelector('[name="damage-42"]')).toHaveAttribute(
      'rotation',
      `${-Math.PI / 2},0,0`,
    )
    expect(
      container.querySelectorAll('[name="damage-42"] mesh').length,
    ).toBeGreaterThan(2)
    expect(
      container.querySelectorAll('[name="damage-90"] mesh').length,
    ).toBeGreaterThan(2)
  })
})
