import { combatConfig } from '../../config/combatConfig'
import type { HeroId, Row } from '../heroes'

export interface FormationSlot {
  row: Row
  index: number
}

export type FormationAssignment = Array<{
  heroId: HeroId
  row: Row
  index: number
}>

export function globalIndexOf(row: Row, index: number): number {
  return row === 'front' ? index : 2 + index
}

export interface EffStats {
  effAtk: number
  effDef: number
  effHp: number
}

export function effectiveStats(
  row: Row,
  stats: { hp: number; atk: number; def: number },
): EffStats {
  const mod = combatConfig.positionModifiers[row]
  return {
    effAtk: Math.round(stats.atk * mod.atkMul),
    effDef: Math.round(stats.def * mod.defMul),
    effHp: stats.hp,
  }
}

export function unitPower(
  row: Row,
  stats: { hp: number; atk: number; def: number },
): number {
  const eff = effectiveStats(row, stats)
  const w = combatConfig.powerWeights
  return Math.round(eff.effHp * w.hp + eff.effAtk * w.atk + eff.effDef * w.def)
}

export function teamPower(
  units: ReadonlyArray<{ row: Row; hp: number; atk: number; def: number }>,
): number {
  return Math.min(
    Number.MAX_SAFE_INTEGER,
    units.reduce((sum, u) => sum + unitPower(u.row, u), 0),
  )
}
