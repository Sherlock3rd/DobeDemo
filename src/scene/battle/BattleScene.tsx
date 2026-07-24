import type { JSX } from 'react'
import type { BattleResult } from '../../game/combat/battleEngine'
import { BattleEnvironment } from './BattleEnvironment'
import { BattleUnit } from './BattleUnit'
import { DamageNumbers } from './DamageNumbers'
import { appearanceForUnit } from './battleUnitAppearance'

export interface BattleSceneProps {
  result: BattleResult
  currentTick: number
}

export function BattleScene({
  result,
  currentTick,
}: BattleSceneProps): JSX.Element {
  const tickIndex = Math.max(0, Math.min(currentTick, result.endedAtTick) - 1)
  const snapshot =
    result.timeline[tickIndex] ??
    result.timeline[result.timeline.length - 1] ??
    null

  if (!snapshot) {
    return (
      <group>
        <BattleEnvironment />
      </group>
    )
  }

  return (
    <group>
      <BattleEnvironment />
      {snapshot.units.map((unit) => {
        const acting = snapshot.hits.some(
          (hit) =>
            hit.attackerSide === unit.side &&
            hit.attackerGlobalIndex === unit.globalIndex,
        )
        return (
          <BattleUnit
            key={`${unit.side}-${unit.globalIndex}`}
            unit={unit}
            appearance={appearanceForUnit(unit)}
            acting={acting}
          />
        )
      })}
      <DamageNumbers hits={snapshot.hits} />
    </group>
  )
}
