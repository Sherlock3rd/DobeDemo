import type { HeroAppearance } from '../../config/heroesConfig'
import { heroesConfig } from '../../config/heroesConfig'
import type { UnitSnapshot } from '../../game/combat/battleEngine'
import type { HeroId } from '../../game/heroes'

export const ENEMY_APPEARANCE: HeroAppearance = {
  primaryColor: '#8b4513',
  accentColor: '#c0392b',
  silhouette: 'bulk',
  weapon: 'axe-shield',
}

export function appearanceForUnit(unit: UnitSnapshot): HeroAppearance {
  if (unit.side === 'ally' && unit.heroId) {
    return heroesConfig.heroes[unit.heroId as HeroId].appearance
  }
  return ENEMY_APPEARANCE
}

export function slotWorldPosition(
  unit: UnitSnapshot,
): [number, number, number] {
  const xByIndex =
    unit.row === 'front'
      ? unit.index === 0
        ? -1.5
        : 1.5
      : unit.index === 0
        ? -2.4
        : unit.index === 1
          ? 0
          : 2.4
  const z =
    unit.side === 'ally'
      ? unit.row === 'front'
        ? 2.2
        : 3.8
      : unit.row === 'front'
        ? -2.2
        : -3.8
  return [xByIndex, unit.alive ? 0.7 : 0.15, z]
}
