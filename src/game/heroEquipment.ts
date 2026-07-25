import { equipmentConfig } from '../config/equipmentConfig'
import type {
  EquipmentByHero,
  EquipmentProgressionSnapshot,
  HeroEquipment,
} from './equipmentTypes'
import {
  getGunHeroAtk,
  getInstalledPartHeroBonus,
} from './equipmentProgression'
import { getHeroStats, type HeroId, type HeroStats } from './heroes'

export const EMPTY_HERO_EQUIPMENT: HeroEquipment = {
  carId: null,
  gunId: null,
}

export function getHeroCombatStats(
  heroId: HeroId,
  level: number,
  equipment: HeroEquipment | undefined,
  progression?: EquipmentProgressionSnapshot,
): HeroStats {
  const base = getHeroStats(heroId, level)
  const car = equipment?.carId
    ? equipmentConfig.cars[equipment.carId]
    : undefined
  const gun = equipment?.gunId
    ? equipmentConfig.guns[equipment.gunId]
    : undefined
  const partBonus =
    equipment?.carId && car
      ? getInstalledPartHeroBonus(equipment.carId, progression)
      : { hp: 0, atk: 0, def: 0 }
  return {
    hp: base.hp + (car?.heroBonus.hp ?? 0) + partBonus.hp,
    atk:
      base.atk +
      (equipment?.gunId && gun
        ? getGunHeroAtk(equipment.gunId, progression)
        : 0) +
      partBonus.atk,
    def: base.def + (car?.heroBonus.def ?? 0) + partBonus.def,
  }
}

export function getHeroEquipmentStats(
  heroId: HeroId,
  level: number,
  equipmentByHero: EquipmentByHero | undefined,
  progression?: EquipmentProgressionSnapshot,
): HeroStats {
  return getHeroCombatStats(
    heroId,
    level,
    equipmentByHero?.[heroId],
    progression,
  )
}
