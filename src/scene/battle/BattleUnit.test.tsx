import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { UnitSnapshot } from '../../game/combat/battleEngine'
import { appearanceForUnit } from './battleUnitAppearance'

const frameMock = vi.hoisted(() => vi.fn())

vi.mock('@react-three/fiber', () => ({
  useFrame: frameMock,
}))
vi.mock('../city/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))

const { BattleUnit } = await import('./BattleUnit')

const ally: UnitSnapshot = {
  side: 'ally',
  globalIndex: 3,
  row: 'back',
  index: 1,
  heroId: 'foreman',
  hp: 800,
  maxHp: 800,
  cooldownRemaining: 30,
  cooldownTotal: 90,
  alive: true,
}

describe('BattleUnit', () => {
  it('registers a frame writer for real transform animation', () => {
    render(<BattleUnit unit={ally} acting actionKey={9} />)

    expect(frameMock).toHaveBeenCalledTimes(1)
    expect(frameMock.mock.calls[0]?.[0]).toBeTypeOf('function')
  })

  it('maps foreman appearance to capsule shotgun', () => {
    const appearance = appearanceForUnit(ally)
    expect(appearance.silhouette).toBe('capsule')
    expect(appearance.weapon).toBe('shotgun')
    const { container } = render(
      <BattleUnit unit={ally} appearance={appearance} />,
    )
    expect(container.querySelectorAll('mesh').length).toBeGreaterThan(0)
  })

  it('still renders when the unit is dead', () => {
    const { container } = render(
      <BattleUnit unit={{ ...ally, alive: false, hp: 0 }} />,
    )
    expect(container.querySelectorAll('group').length).toBeGreaterThan(0)
  })
})
