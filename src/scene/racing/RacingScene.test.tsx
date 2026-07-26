import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createRaceState } from '../../game/racing/raceEngine'
import { RacingScene } from './RacingScene'

vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
}))

describe('RacingScene nitro effects', () => {
  it('always paints the player car green and marks it above the roof', () => {
    const state = createRaceState(1, {
      carId: 'black-throne',
      gunId: 'rivet-smg',
    })

    const { container } = render(
      <RacingScene state={state} carId="black-throne" gunId="rivet-smg" />,
    )

    expect(
      container.querySelector('meshStandardMaterial[name="player-body-green"]'),
    ).toHaveAttribute('color', '#22c55e')
    expect(
      container.querySelector('[name="player-marker"]'),
    ).toBeInTheDocument()
  })

  it('keeps a zero-durability vehicle visible in standard races', () => {
    const state = createRaceState(1, {
      carId: 'rust-fox',
      gunId: 'rivet-smg',
    })
    state.player = { ...state.player, durability: 0 }

    const { container } = render(
      <RacingScene state={state} carId="rust-fox" gunId="rivet-smg" />,
    )

    expect(
      container.querySelector('meshStandardMaterial[name="player-body-green"]'),
    ).toBeInTheDocument()
    expect(
      container.querySelector('[name="player-marker"]'),
    ).toBeInTheDocument()
  })

  it('renders a tall cyan jump ramp distinct from orange road obstacles', () => {
    const state = createRaceState(1, {
      carId: 'rust-fox',
      gunId: 'rivet-smg',
    })
    state.player = { ...state.player, distance: 100 }

    const { container } = render(
      <RacingScene state={state} carId="rust-fox" gunId="rivet-smg" />,
    )

    expect(container.querySelector('[name="jump-ramp"]')).toBeInTheDocument()
    expect(
      container.querySelector('[name="road-obstacle"]'),
    ).toBeInTheDocument()
    expect(
      container.querySelector('[name="jump-ramp"] pointLight'),
    ).toHaveAttribute('color', '#22d3ee')
  })

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

  it('models a checkered finish gantry as the player approaches a race finish', () => {
    const state = createRaceState(1, {
      carId: 'rust-fox',
      gunId: 'rivet-smg',
    })
    state.player = { ...state.player, distance: 3_400 }

    const { container } = render(
      <RacingScene state={state} carId="rust-fox" gunId="rivet-smg" />,
    )

    const finish = container.querySelector('[name="race-finish-line"]')
    expect(finish).toBeInTheDocument()
    expect(finish?.querySelectorAll('meshStandardMaterial')).toHaveLength(27)
  })
})
