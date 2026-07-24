import type { JSX } from 'react'
import type { BattleResult } from '../../game/combat/battleEngine'
import { BattleEffects, type BattlePresentationFrame } from './BattleEffects'
import { BattleEnvironment } from './BattleEnvironment'
import { BattleUnit } from './BattleUnit'
import { DamageNumbers } from './DamageNumbers'
import { appearanceForUnit } from './battleUnitAppearance'

const EFFECT_HISTORY_TICKS = 5

export interface BattleSceneProps {
  result: BattleResult
  currentTick: number
  onEffectsPresented?: (frame: BattlePresentationFrame) => void
}

export function BattleScene({
  result,
  currentTick,
  onEffectsPresented,
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

  const effectEvents = result.timeline
    .slice(Math.max(0, tickIndex - EFFECT_HISTORY_TICKS + 1), tickIndex + 1)
    .flatMap((effectSnapshot) =>
      effectSnapshot.hits.map((hit, eventIndex) => ({
        hit,
        eventKey: effectSnapshot.tick,
        eventIndex,
      })),
    )

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
            actionKey={acting ? snapshot.tick : null}
          />
        )
      })}
      <BattleEffects
        events={effectEvents}
        currentEventKey={snapshot.tick}
        onPresented={onEffectsPresented}
      />
      <DamageNumbers hits={snapshot.hits} />
    </group>
  )
}
