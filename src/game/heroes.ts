import { heroesConfig } from '../config/heroesConfig'
import {
  heroUnlockLevel,
  isHeroUnlocked,
  normalizeGangLevel,
} from './progressionUnlocks'

export const HERO_IDS = ['foreman', 'anvil', 'skyline'] as const
export type HeroId = (typeof HERO_IDS)[number]
export type Row = 'front' | 'back'

export interface HeroStats {
  hp: number
  atk: number
  def: number
}

export function isHeroId(value: string): value is HeroId {
  return HERO_IDS.some((id) => id === value)
}

export function getHeroStats(heroId: HeroId, level: number): HeroStats {
  const clampedLevel = Math.min(Math.max(Math.floor(level), 1), 50)
  const definition = heroesConfig.heroes[heroId]
  return {
    hp: definition.baseHp + definition.hpPerLevel * (clampedLevel - 1),
    atk: definition.baseAtk + definition.atkPerLevel * (clampedLevel - 1),
    def: definition.baseDef + definition.defPerLevel * (clampedLevel - 1),
  }
}

export function getHeroLevelCap(gangLevel: number): number {
  return Math.min(50, normalizeGangLevel(gangLevel))
}

export { heroUnlockLevel, isHeroUnlocked }
