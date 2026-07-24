import { equipmentConfig } from '../config/equipmentConfig'
import type { EquipmentByHero, HeroEquipment } from './equipmentTypes'
import { getHeroStats, type HeroId, type HeroStats } from './heroes'

export const EMPTY_HERO_EQUIPMENT: HeroEquipment = {
  carId: null,
  gunId: null,
}

export function getHeroCombatStats(
  heroId: HeroId,
  level: number,
  equipment: HeroEquipment | undefined,
): HeroStats {
  const base = getHeroStats(heroId, level)
  const car = equipment?.carId
    ? equipmentConfig.cars[equipment.carId]
    : undefined
  const gun = equipment?.gunId
    ? equipmentConfig.guns[equipment.gunId]
    : undefined
  return {
    hp: base.hp + (car?.heroBonus.hp ?? 0),
    atk: base.atk + (gun?.heroBonus.atk ?? 0),
    def: base.def + (car?.heroBonus.def ?? 0),
  }
}

export function getHeroEquipmentStats(
  heroId: HeroId,
  level: number,
  equipmentByHero: EquipmentByHero | undefined,
): HeroStats {
  return getHeroCombatStats(heroId, level, equipmentByHero?.[heroId])
}
