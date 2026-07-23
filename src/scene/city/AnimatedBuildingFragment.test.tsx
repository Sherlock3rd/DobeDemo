import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const useFrameMock = vi.fn()

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: unknown) => useFrameMock(callback),
}))

const { BUILDING_FRAGMENT_ANIMATION_MS, getFragmentAnimationTransform } =
  await import('./buildingFragmentAnimation')
const { AnimatedBuildingFragment } = await import('./AnimatedBuildingFragment')

afterEach(() => {
  useFrameMock.mockClear()
})

describe('getFragmentAnimationTransform', () => {
  it('starts small, low and fully glowing at 0ms', () => {
    const t = getFragmentAnimationTransform(0, false)

    expect(t.scale).toBeCloseTo(0.78, 5)
    expect(t.yOffset).toBeCloseTo(-0.35, 5)
    expect(t.glow).toBeCloseTo(1, 5)
  })

  it('interpolates linearly to the midpoint at 200ms', () => {
    const t = getFragmentAnimationTransform(200, false)

    expect(t.scale).toBeCloseTo(0.89, 5)
    expect(t.yOffset).toBeCloseTo(-0.175, 5)
    expect(t.glow).toBeCloseTo(0.5, 5)
  })

  it('settles to the resting transform at 400ms', () => {
    const t = getFragmentAnimationTransform(
      BUILDING_FRAGMENT_ANIMATION_MS,
      false,
    )

    expect(t.scale).toBeCloseTo(1, 5)
    expect(t.yOffset).toBeCloseTo(0, 5)
    expect(t.glow).toBeCloseTo(0, 5)
  })

  it('clamps past the animation window to the resting transform', () => {
    const t = getFragmentAnimationTransform(5_000, false)

    expect(t.scale).toBeCloseTo(1, 5)
    expect(t.yOffset).toBeCloseTo(0, 5)
    expect(t.glow).toBeCloseTo(0, 5)
  })

  it('clamps negative elapsed time to the entrance start', () => {
    const t = getFragmentAnimationTransform(-100, false)

    expect(t.scale).toBeCloseTo(0.78, 5)
    expect(t.yOffset).toBeCloseTo(-0.35, 5)
    expect(t.glow).toBeCloseTo(1, 5)
  })

  it('lands immediately when reduced motion is requested', () => {
    const t = getFragmentAnimationTransform(0, true)

    expect(t).toEqual({ scale: 1, yOffset: 0, glow: 0 })
  })
})

describe('AnimatedBuildingFragment', () => {
  it('renders children inside a group and mounts a feedback light while animating', () => {
    const { container } = render(
      <AnimatedBuildingFragment animate>
        <mesh data-testid="fragment-child" />
      </AnimatedBuildingFragment>,
    )

    expect(container.querySelector('group')).not.toBeNull()
    expect(container.querySelector('mesh')).not.toBeNull()
    // The green cue is an independent light, not a mutation of business material.
    expect(container.querySelector('pointLight')).not.toBeNull()
    expect(useFrameMock).toHaveBeenCalledTimes(1)
  })

  it('omits the feedback light when idle and never touches child materials', () => {
    const { container } = render(
      <AnimatedBuildingFragment animate={false}>
        <mesh>
          <meshStandardMaterial data-testid="child-material" />
        </mesh>
      </AnimatedBuildingFragment>,
    )

    expect(container.querySelector('pointLight')).toBeNull()
    expect(container.querySelector('meshStandardMaterial')).not.toBeNull()
  })

  it('subscribes exactly one frame callback', () => {
    render(
      <AnimatedBuildingFragment animate={false}>
        <mesh />
      </AnimatedBuildingFragment>,
    )

    expect(useFrameMock).toHaveBeenCalledTimes(1)
    expect(useFrameMock.mock.calls[0]?.[0]).toBeTypeOf('function')
  })
})
