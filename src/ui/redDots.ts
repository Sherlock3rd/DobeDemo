import { isStageUnlocked } from '../config/campaignConfig'
import { expToLevel } from '../config/heroesConfig'
import {
  HERO_IDS,
  getHeroLevelCap,
  isHeroUnlocked,
  type HeroId,
} from '../game/heroes'

export type BottomNavEntry = 'adventure' | 'heroes' | 'settings'

export function hasAdventureRedDot(
  highestClearedStage: number,
  claimableChestExp: number,
): boolean {
  const nextStage = highestClearedStage + 1
  const newStage =
    highestClearedStage < 20 && isStageUnlocked(nextStage, highestClearedStage)
  return newStage || claimableChestExp > 0
}

export function hasHeroesRedDot(
  heroLevels: Record<HeroId, number>,
  sharedExp: number,
  gangLevel: number,
): boolean {
  const cap = getHeroLevelCap(gangLevel)
  return HERO_IDS.some((id) => {
    if (!isHeroUnlocked(id, gangLevel)) return false
    const level = heroLevels[id] ?? 1
    return level < cap && level < 50 && sharedExp >= expToLevel(level)
  })
}

export function hasRedDot(
  entry: BottomNavEntry,
  input: {
    highestClearedStage: number
    claimableChestExp: number
    heroLevels: Record<HeroId, number>
    sharedExp: number
    gangLevel: number
  },
): boolean {
  if (entry === 'adventure') {
    return hasAdventureRedDot(
      input.highestClearedStage,
      input.claimableChestExp,
    )
  }
  if (entry === 'heroes') {
    return hasHeroesRedDot(input.heroLevels, input.sharedExp, input.gangLevel)
  }
  return false
}
