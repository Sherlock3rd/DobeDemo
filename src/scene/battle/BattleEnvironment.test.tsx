import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
}))

const { BattleEnvironment } = await import('./BattleEnvironment')

describe('BattleEnvironment', () => {
  it('renders ground and slot markers as mesh primitives', () => {
    const { container } = render(<BattleEnvironment />)
    expect(container.querySelectorAll('mesh').length).toBeGreaterThan(0)
  })
})
