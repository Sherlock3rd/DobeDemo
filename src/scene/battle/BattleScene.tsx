import type { JSX } from 'react'
import type { BattleResult } from '../../game/combat/battleEngine'
import { BattleEffects, type BattlePresentationFrame } from './BattleEffects'
import { BattleEnvironment } from './BattleEnvironment'
import { BattleUnit } from './BattleUnit'
import { DamageNumbers } from './DamageNumbers'
import { appearanceForUnit } from './battleUnitAppearance'
import { BATTLE_FORMATION_ROTATION } from './battleLayout'

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
  const displayedTick = Math.max(0, Math.min(currentTick, result.endedAtTick))
  const snapshot =
    displayedTick === 0
      ? {
          tick: 0,
          units: result.initialUnits,
          hits: [],
          deaths: [],
        }
      : (result.timeline[displayedTick - 1] ??
        result.timeline[result.timeline.length - 1] ??
        null)

  if (!snapshot) {
    return (
      <group>
        <BattleEnvironment />
      </group>
    )
  }

  const effectEvents =
    displayedTick === 0
      ? []
      : result.timeline
          .slice(
            Math.max(0, displayedTick - EFFECT_HISTORY_TICKS),
            displayedTick,
          )
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
      <group name="battle-formation-axis" rotation={BATTLE_FORMATION_ROTATION}>
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
    </group>
  )
}
