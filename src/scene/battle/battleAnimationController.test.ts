import { describe, expect, it } from 'vitest'
import type { HitEvent } from '../../game/combat/battleEngine'
import {
  applyBattleUnitFrame,
  BattleEffectAnimationController,
  BattleUnitAnimationController,
} from './battleAnimationController'

function unitInput(
  overrides: Partial<{
    actionKey: number | null
    alive: boolean
    side: 'ally' | 'enemy'
    reducedMotion: boolean
  }> = {},
) {
  return {
    actionKey: null,
    alive: true,
    side: 'ally' as const,
    reducedMotion: false,
    ...overrides,
  }
}

function makeGroup() {
  return {
    position: { x: -99, y: -99, z: -99 },
    rotation: { x: -99, y: 0, z: 0 },
  }
}

describe('BattleUnitAnimationController', () => {
  it('interpolates the opening approach into the formation slot', () => {
    const controller = new BattleUnitAnimationController()

    const start = controller.step(10, unitInput())
    const middle = controller.step(10.225, unitInput())
    const end = controller.step(10.45, unitInput())

    expect(start.zOffset).toBeCloseTo(0.75, 5)
    expect(middle.zOffset).toBeGreaterThan(0)
    expect(middle.zOffset).toBeLessThan(start.zOffset)
    expect(end.zOffset).toBeCloseTo(0, 5)
  })

  it('lunges toward the opposing side and returns to rest', () => {
    const controller = new BattleUnitAnimationController()

    controller.step(20, unitInput({ actionKey: 7 }))
    const allyPeak = controller.step(20.14, unitInput({ actionKey: 7 }))
    const rested = controller.step(20.34, unitInput({ actionKey: null }))

    expect(allyPeak.zOffset).toBeLessThan(-0.4)
    expect(rested.zOffset).toBeCloseTo(0, 5)

    const enemy = new BattleUnitAnimationController()
    enemy.step(30, unitInput({ actionKey: 8, side: 'enemy' }))
    expect(
      enemy.step(30.14, unitInput({ actionKey: 8, side: 'enemy' })).zOffset,
    ).toBeGreaterThan(0.4)
  })

  it('tweens a dead unit into a fallen and sunken pose', () => {
    const controller = new BattleUnitAnimationController()

    controller.step(4, unitInput())
    const start = controller.step(5, unitInput({ alive: false }))
    const middle = controller.step(5.25, unitInput({ alive: false }))
    const end = controller.step(5.5, unitInput({ alive: false }))

    expect(start.rotationX).toBeCloseTo(0, 5)
    expect(middle.rotationX).toBeGreaterThan(0)
    expect(middle.yOffset).toBeLessThan(0)
    expect(end.rotationX).toBeCloseTo(Math.PI / 2, 5)
    expect(end.yOffset).toBeCloseTo(-0.55, 5)
  })

  it('snaps directly to action and death targets under reduced motion', () => {
    const action = new BattleUnitAnimationController().step(
      1,
      unitInput({ actionKey: 1, reducedMotion: true }),
    )
    const death = new BattleUnitAnimationController().step(
      1,
      unitInput({ alive: false, reducedMotion: true }),
    )

    expect(action.zOffset).toBeCloseTo(-0.45, 5)
    expect(death).toMatchObject({
      zOffset: 0,
      yOffset: -0.55,
      rotationX: Math.PI / 2,
    })
  })
})

describe('applyBattleUnitFrame', () => {
  it('writes sampled transforms to a plain structural target', () => {
    const group = makeGroup()
    const controller = new BattleUnitAnimationController()

    applyBattleUnitFrame(
      group,
      controller,
      2,
      unitInput({ reducedMotion: true }),
      [1, 0.7, 3.8],
    )

    expect(group.position).toEqual({ x: 1, y: 0.7, z: 3.8 })
    expect(group.rotation.x).toBe(0)
  })

  it('accepts an unattached ref without throwing', () => {
    expect(() =>
      applyBattleUnitFrame(
        null,
        new BattleUnitAnimationController(),
        2,
        unitInput(),
        [0, 0, 0],
      ),
    ).not.toThrow()
  })
})

describe('BattleEffectAnimationController', () => {
  const basic: HitEvent['kind'] = 'basic'
  const skill: HitEvent['kind'] = 'skill-main'

  it('makes a basic muzzle flash and impact expire quickly', () => {
    const controller = new BattleEffectAnimationController()

    const start = controller.step(10, basic, false)
    const impact = controller.step(10.09, basic, false)
    const end = controller.step(10.2, basic, false)

    expect(start.muzzleScale).toBeGreaterThan(0)
    expect(impact.impactScale).toBeGreaterThan(start.impactScale)
    expect(end.visible).toBe(false)
  })

  it('animates a longer golden skill trail', () => {
    const controller = new BattleEffectAnimationController()

    const start = controller.step(3, skill, false)
    const middle = controller.step(3.2, skill, false)

    expect(start.trailProgress).toBe(0)
    expect(middle.trailProgress).toBeGreaterThan(0)
    expect(middle.trailProgress).toBeLessThan(1)
    expect(middle.visible).toBe(true)
  })

  it('shows the final impact immediately without a trail in reduced motion', () => {
    const frame = new BattleEffectAnimationController().step(
      8,
      'skill-splash',
      true,
    )

    expect(frame).toEqual({
      visible: true,
      muzzleScale: 0,
      impactScale: 1,
      trailProgress: 0,
      opacity: 1,
    })
  })
})
