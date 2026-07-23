import { describe, expect, it } from 'vitest'
import { BUILDING_FRAGMENT_ANIMATION_MS } from './buildingFragmentAnimation'
import {
  applyFragmentFrame,
  FRAGMENT_GLOW_MAX_INTENSITY,
  FragmentAnimationController,
} from './fragmentAnimationController'

function makeGroup() {
  const scale = {
    value: -1,
    setScalar(next: number) {
      this.value = next
    },
  }
  return { scale, position: { y: -99 } }
}

function makeLight() {
  return { intensity: -1 }
}

describe('FragmentAnimationController', () => {
  it('starts from the entrance pose on the first animating frame', () => {
    const controller = new FragmentAnimationController()

    const first = controller.sample(10, true, false)

    expect(first.scale).toBeCloseTo(0.78, 5)
    expect(first.yOffset).toBeCloseTo(-0.35, 5)
    expect(first.glow).toBeCloseTo(1, 5)
  })

  it('measures elapsed time from the first frame, not from clock zero', () => {
    const controller = new FragmentAnimationController()

    controller.sample(100, true, false)
    const mid = controller.sample(100.2, true, false)

    expect(mid.scale).toBeCloseTo(0.89, 5)
    expect(mid.glow).toBeCloseTo(0.5, 5)
  })

  it('snaps to the final resting pose once the window elapses', () => {
    const controller = new FragmentAnimationController()

    controller.sample(5, true, false)
    const done = controller.sample(
      5 + BUILDING_FRAGMENT_ANIMATION_MS / 1000,
      true,
      false,
    )

    expect(done).toEqual({ scale: 1, yOffset: 0, glow: 0 })
  })

  it('resets and rests immediately when not animating', () => {
    const controller = new FragmentAnimationController()

    controller.sample(3, true, false)
    const rest = controller.sample(3.2, false, false)

    expect(rest).toEqual({ scale: 1, yOffset: 0, glow: 0 })
  })

  it('replays from zero after an interruption on the same instance', () => {
    const controller = new FragmentAnimationController()

    controller.sample(10, true, false)
    controller.sample(10.2, true, false)
    controller.sample(10.25, false, false)

    const replay = controller.sample(10.4, true, false)

    expect(replay.scale).toBeCloseTo(0.78, 5)
    expect(replay.glow).toBeCloseTo(1, 5)
  })

  it('lands immediately under reduced motion', () => {
    const controller = new FragmentAnimationController()

    const output = controller.sample(1, true, true)

    expect(output).toEqual({ scale: 1, yOffset: 0, glow: 0 })
  })

  it('reset forces the next animating frame to restart', () => {
    const controller = new FragmentAnimationController()

    controller.sample(10, true, false)
    controller.sample(10.2, true, false)
    controller.reset()

    const restarted = controller.sample(10.3, true, false)

    expect(restarted.glow).toBeCloseTo(1, 5)
    expect(restarted.scale).toBeCloseTo(0.78, 5)
  })
})

describe('applyFragmentFrame', () => {
  it('writes the transform to the group and the glow to the feedback ref', () => {
    const controller = new FragmentAnimationController()
    const group = makeGroup()
    const light = makeLight()

    applyFragmentFrame(group, light, controller, 10, true, false)

    expect(group.scale.value).toBeCloseTo(0.78, 5)
    expect(group.position.y).toBeCloseTo(-0.35, 5)
    expect(light.intensity).toBeCloseTo(FRAGMENT_GLOW_MAX_INTENSITY, 5)
  })

  it('rests the group and clears the glow when not animating', () => {
    const controller = new FragmentAnimationController()
    const group = makeGroup()
    const light = makeLight()

    applyFragmentFrame(group, light, controller, 10, false, false)

    expect(group.scale.value).toBe(1)
    expect(group.position.y).toBe(0)
    expect(light.intensity).toBe(0)
  })

  it('takes the empty-ref branch without throwing while animating', () => {
    const controller = new FragmentAnimationController()

    expect(() =>
      applyFragmentFrame(null, null, controller, 10, true, false),
    ).not.toThrow()

    // The controller still advanced, so a later frame keeps easing forward.
    const later = controller.sample(10.2, true, false)
    expect(later.glow).toBeCloseTo(0.5, 5)
  })
})
