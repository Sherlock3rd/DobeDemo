import { combatConfig } from '../../config/combatConfig'

export function mitigation(effDef: number): number {
  const k = combatConfig.defenseConstant
  return k / (k + Math.max(0, effDef))
}

export function basicAttackDamage(effAtk: number, effDef: number): number {
  return Math.max(1, Math.floor(effAtk * mitigation(effDef)))
}

export function skillMainDamage(
  effAtk: number,
  effDef: number,
  targetMultiplier: number,
): number {
  return Math.max(1, Math.floor(effAtk * targetMultiplier * mitigation(effDef)))
}

export function skillSplashDamage(
  effAtk: number,
  effDef: number,
  splashMultiplier: number,
): number {
  return Math.max(1, Math.floor(effAtk * splashMultiplier * mitigation(effDef)))
}
