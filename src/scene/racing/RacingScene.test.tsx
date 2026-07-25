import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createRaceState } from '../../game/racing/raceEngine'
import { RacingScene } from './RacingScene'

vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
}))

describe('RacingScene nitro effects', () => {
  it('renders a persistent super-nitro trail and shock rings', () => {
    const state = createRaceState(1, {
      carId: 'rust-fox',
      gunId: 'rivet-smg',
    })
    state.player = {
      ...state.player,
      boosting: true,
      superBoosting: true,
      boostRemainingMs: 3000,
      airborneHeight: 8,
    }

    const { container } = render(
      <RacingScene state={state} carId="rust-fox" gunId="rivet-smg" />,
    )

    expect(
      container.querySelector('[name="super-nitro-trail"]'),
    ).toBeInTheDocument()
    expect(
      container.querySelectorAll('[name="super-nitro-trail"] torusGeometry'),
    ).toHaveLength(3)
  })
})
