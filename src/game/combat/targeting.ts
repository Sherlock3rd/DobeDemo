import type { Row } from '../heroes'

export type Side = 'ally' | 'enemy'

export interface CombatUnitState {
  globalIndex: number
  row: Row
  side: Side
  hp: number
  alive: boolean
}

export function selectTarget(
  defenders: readonly CombatUnitState[],
): CombatUnitState | null {
  const alive = defenders.filter((d) => d.alive)
  if (alive.length === 0) return null
  const front = alive.filter((d) => d.row === 'front')
  const pool = front.length > 0 ? front : alive
  return pool.reduce((best, d) => (d.globalIndex < best.globalIndex ? d : best))
}
