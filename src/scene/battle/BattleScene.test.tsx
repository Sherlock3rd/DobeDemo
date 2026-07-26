import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  buildBattleInput,
  createBattleSeed,
  simulateBattle,
  type UnitSnapshot,
} from '../../game/combat/battleEngine'
import { BattleScene } from './BattleScene'

const frameMock = vi.hoisted(() => vi.fn())

vi.mock('@react-three/fiber', () => ({
  useFrame: frameMock,
}))
vi.mock('../city/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))
vi.mock('./BattleUnit', () => ({
  BattleUnit: ({
    unit,
    acting,
    actionKey,
  }: {
    unit: UnitSnapshot
    acting: boolean
    actionKey: number | null
  }) => (
    <div
      data-testid="battle-unit"
      data-side={unit.side}
      data-dead={String(!unit.alive)}
      data-acting={String(acting)}
      data-action-key={actionKey ?? ''}
      data-silhouette={unit.heroId ? 'hero' : 'enemy'}
      data-rage={unit.rage}
      data-hp={unit.hp}
    />
  ),
}))
vi.mock('./BattleEnvironment', () => ({
  BattleEnvironment: () => <div data-testid="battle-environment" />,
}))

describe('BattleScene', () => {
  it('renders no tick-one state or presentation until playback advances', () => {
    const input = buildBattleInput(
      1,
      [{ heroId: 'foreman', row: 'front', index: 1 }],
      { foreman: 1, anvil: 1, skyline: 1 },
      1,
    )
    input.allies[0] = { ...input.allies[0], atk: 100_000 }
    input.enemies[0] = { ...input.enemies[0], hp: 1 }
    input.seed = createBattleSeed(input)
    const result = simulateBattle(input)
    const firstTick = result.timeline[0]
    const firstHit = firstTick.hits[0]
    const onPresented = vi.fn()
    const { container, rerender } = render(
      <BattleScene
        result={result}
        currentTick={0}
        onEffectsPresented={onPresented}
      />,
    )
    const ally = screen
      .getAllByTestId('battle-unit')
      .find((unit) => unit.dataset.side === 'ally')

    expect(firstHit).toMatchObject({ attackerSide: 'ally', kind: 'basic' })
    expect(firstTick.deaths).toHaveLength(1)
    expect(ally).toHaveAttribute('data-rage', '0')
    expect(ally).toHaveAttribute('data-acting', 'false')
    expect(
      screen
        .getAllByTestId('battle-unit')
        .every((unit) => unit.dataset.dead === 'false'),
    ).toBe(true)
    expect(container.querySelector('[name^="damage-"]')).toBeNull()
    expect(container.querySelector('[name="basic-muzzle-flash"]')).toBeNull()
    expect(onPresented).toHaveBeenLastCalledWith({
      eventKey: 0,
      basicActive: false,
      skillActive: false,
      visibleEvents: 0,
    })

    rerender(
      <BattleScene
        result={result}
        currentTick={1}
        onEffectsPresented={onPresented}
      />,
    )
    const advancedAlly = screen
      .getAllByTestId('battle-unit')
      .find((unit) => unit.dataset.side === 'ally')

    expect(advancedAlly).toHaveAttribute('data-rage', '20')
    expect(advancedAlly).toHaveAttribute('data-acting', 'true')
    expect(
      screen
        .getAllByTestId('battle-unit')
        .some((unit) => unit.dataset.dead === 'true'),
    ).toBe(true)
    expect(
      container.querySelector(`[name="damage-${firstHit.amount}"]`),
    ).toBeInTheDocument()
    expect(
      container.querySelector('[name="basic-muzzle-flash"]'),
    ).toBeInTheDocument()
    expect(onPresented).toHaveBeenLastCalledWith({
      eventKey: 1,
      basicActive: true,
      skillActive: false,
      visibleEvents: 1,
    })
  })

  it('renders the exact snapshot units and hit count for the selected tick', () => {
    const result = simulateBattle(
      buildBattleInput(
        1,
        [{ heroId: 'foreman', row: 'back', index: 1 }],
        { foreman: 1, anvil: 1, skyline: 1 },
        1,
      ),
    )
    const hitIndex = result.timeline.findIndex((tick) => tick.hits.length > 0)
    const hitTick = result.timeline[hitIndex]
    const firstHit = hitTick.hits[0]
    const onPresented = vi.fn()
    const { container, rerender } = render(
      <BattleScene
        result={result}
        currentTick={1}
        onEffectsPresented={onPresented}
      />,
    )
    expect(screen.getAllByTestId('battle-unit')).toHaveLength(
      result.timeline[0].units.length,
    )
    expect(screen.getByTestId('battle-environment')).toBeInTheDocument()
    expect(
      container.querySelector('[name="battle-formation-axis"]'),
    ).toHaveAttribute('rotation', `0,${-Math.PI / 4},0`)
    rerender(
      <BattleScene
        result={result}
        currentTick={hitIndex + 1}
        onEffectsPresented={onPresented}
      />,
    )
    expect(
      container.querySelector(`[name="damage-${firstHit.amount}"]`),
    ).toBeInTheDocument()
    expect(onPresented).toHaveBeenLastCalledWith({
      eventKey: hitTick.tick,
      basicActive: hitTick.hits.some((hit) => hit.kind === 'basic'),
      skillActive: hitTick.hits.some((hit) => hit.kind !== 'basic'),
      visibleEvents: hitTick.hits.length,
    })
    const actingUnit = screen
      .getAllByTestId('battle-unit')
      .find(
        (node) =>
          node.dataset.side === firstHit.attackerSide &&
          node.dataset.acting === 'true',
      )
    expect(actingUnit).toBeDefined()
    expect(actingUnit).toHaveAttribute(
      'data-action-key',
      String(result.timeline[hitIndex].tick),
    )

    rerender(
      <BattleScene
        result={result}
        currentTick={hitIndex + 2}
        onEffectsPresented={onPresented}
      />,
    )
    expect(
      container.querySelector('[name="basic-muzzle-flash"]'),
    ).toBeInTheDocument()
  })

  it('keeps dead units in the final snapshot for the death animation', () => {
    const result = simulateBattle(
      buildBattleInput(
        1,
        [{ heroId: 'foreman', row: 'back', index: 1 }],
        { foreman: 1, anvil: 1, skyline: 1 },
        1,
      ),
    )
    render(<BattleScene result={result} currentTick={result.endedAtTick} />)
    expect(
      screen
        .getAllByTestId('battle-unit')
        .some((node) => node.dataset.dead === 'true'),
    ).toBe(true)
  })
})
