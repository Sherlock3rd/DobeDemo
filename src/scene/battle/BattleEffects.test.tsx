import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HitEvent } from '../../game/combat/battleEngine'

const frameMock = vi.hoisted(() => vi.fn())
const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock('@react-three/fiber', () => ({
  useFrame: frameMock,
}))
vi.mock('../city/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => motion.reduced,
}))

const { BattleEffects } = await import('./BattleEffects')

const basic: HitEvent = {
  attackerSide: 'ally',
  attackerGlobalIndex: 2,
  targetSide: 'enemy',
  targetGlobalIndex: 0,
  amount: 42,
  kind: 'basic',
}

const skillMain: HitEvent = {
  ...basic,
  targetGlobalIndex: 1,
  amount: 90,
  kind: 'skill-main',
}

const skillSplash: HitEvent = {
  ...basic,
  targetGlobalIndex: 2,
  amount: 45,
  kind: 'skill-splash',
}

describe('BattleEffects', () => {
  beforeEach(() => {
    frameMock.mockClear()
    motion.reduced = false
  })

  it('renders short-lived muzzle and impact geometry for a basic hit', () => {
    const { container } = render(
      <BattleEffects
        events={[{ hit: basic, eventKey: 12, eventIndex: 0 }]}
        currentEventKey={12}
      />,
    )

    expect(
      container.querySelector('[name="basic-muzzle-flash"]'),
    ).toBeInTheDocument()
    expect(
      container.querySelector('[name="basic-impact-flash"]'),
    ).toBeInTheDocument()
    expect(frameMock).toHaveBeenCalledTimes(1)
  })

  it('renders distinct golden volley and splash geometry for skills', () => {
    const onPresented = vi.fn()
    const { container } = render(
      <BattleEffects
        events={[
          { hit: skillMain, eventKey: 13, eventIndex: 0 },
          { hit: skillSplash, eventKey: 13, eventIndex: 1 },
        ]}
        currentEventKey={13}
        onPresented={onPresented}
      />,
    )

    expect(
      container.querySelectorAll('[name="skill-main-golden-volley"] mesh'),
    ).toHaveLength(3)
    expect(
      container.querySelector('[name="skill-splash-golden-trail"]'),
    ).toBeInTheDocument()
    expect(container.querySelectorAll('[name^="skill-impact-"]')).toHaveLength(
      2,
    )
    expect(onPresented).toHaveBeenCalledWith({
      eventKey: 13,
      basicActive: false,
      skillActive: true,
      visibleEvents: 2,
    })
  })

  it('removes skill trails but keeps the impact under reduced motion', () => {
    motion.reduced = true

    const { container } = render(
      <BattleEffects
        events={[
          { hit: skillSplash, eventKey: 13, eventIndex: 0 },
          { hit: skillMain, eventKey: 14, eventIndex: 0 },
        ]}
        currentEventKey={14}
      />,
    )

    expect(
      container.querySelector('[name="skill-main-golden-volley"]'),
    ).toBeNull()
    expect(
      container.querySelector('[name="skill-impact-skill-main"]'),
    ).toBeInTheDocument()
    expect(
      container.querySelector('[name="skill-impact-skill-splash"]'),
    ).toBeNull()
  })
})
