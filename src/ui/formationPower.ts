import { getEnemyCount, getStage } from '../config/campaignConfig'
import { teamPower, type FormationAssignment } from '../game/combat/power'
import type {
  EquipmentByHero,
  EquipmentProgressionSnapshot,
} from '../game/equipmentTypes'
import { getHeroEquipmentStats } from '../game/heroEquipment'
import type { HeroId, Row } from '../game/heroes'

const ENEMY_ROWS: ReadonlyArray<Row> = [
  'front',
  'front',
  'back',
  'back',
  'back',
]

export function computeTeamPowerForFormation(
  formation: FormationAssignment,
  heroLevels: Record<HeroId, number>,
  equipmentByHero?: EquipmentByHero,
  progression?: EquipmentProgressionSnapshot,
): number {
  return teamPower(
    formation.map((s) => ({
      row: s.row,
      ...getHeroEquipmentStats(
        s.heroId,
        heroLevels[s.heroId] ?? 1,
        equipmentByHero,
        progression,
      ),
    })),
  )
}

export function computeEnemyPowerForStage(stage: number): number {
  const { enemy } = getStage(stage)
  const count = getEnemyCount(stage)
  return teamPower(
    ENEMY_ROWS.slice(0, count).map((row) => ({
      row,
      hp: enemy.hp,
      atk: enemy.atk,
      def: enemy.def,
    })),
  )
}
