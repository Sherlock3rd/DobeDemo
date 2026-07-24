import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  buildBattleInput,
  simulateBattle,
  type HitEvent,
  type UnitSnapshot,
} from '../../game/combat/battleEngine'
import { BattleScene } from './BattleScene'

vi.mock('./BattleUnit', () => ({
  BattleUnit: ({ unit, acting }: { unit: UnitSnapshot; acting: boolean }) => (
    <div
      data-testid="battle-unit"
      data-side={unit.side}
      data-dead={String(!unit.alive)}
      data-acting={String(acting)}
      data-silhouette={unit.heroId ? 'hero' : 'enemy'}
    />
  ),
}))
vi.mock('./DamageNumbers', () => ({
  DamageNumbers: ({ hits }: { hits: HitEvent[] }) => (
    <div data-testid="damage-numbers">{hits.length}</div>
  ),
}))
vi.mock('./BattleEnvironment', () => ({
  BattleEnvironment: () => <div data-testid="battle-environment" />,
}))

describe('BattleScene', () => {
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
    const { rerender } = render(<BattleScene result={result} currentTick={1} />)
    expect(screen.getAllByTestId('battle-unit')).toHaveLength(
      result.timeline[0].units.length,
    )
    expect(screen.getByTestId('battle-environment')).toBeInTheDocument()
    rerender(<BattleScene result={result} currentTick={hitIndex + 1} />)
    expect(screen.getByTestId('damage-numbers')).toHaveTextContent(
      String(result.timeline[hitIndex].hits.length),
    )
    const actingHit = result.timeline[hitIndex].hits[0]
    expect(
      screen
        .getAllByTestId('battle-unit')
        .find(
          (node) =>
            node.dataset.side === actingHit.attackerSide &&
            node.dataset.acting === 'true',
        ),
    ).toBeDefined()
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
