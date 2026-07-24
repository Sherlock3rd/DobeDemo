import raw from './heroes.config.json'
import type { SkillConfig } from './combatConfig'
import type { HeroId, Row } from '../game/heroes'
import {
  PROGRESSION_UNLOCKS,
  heroUnlockLevel,
} from '../game/progressionUnlocks'

// Derived from PROGRESSION_UNLOCKS (not imported from ../game/heroes) so this
// module has no runtime dependency on heroes.ts, avoiding a heroes<->heroesConfig
// import cycle (heroes.ts imports the parsed heroesConfig value for stat lookups).
const HERO_IDS: readonly HeroId[] = PROGRESSION_UNLOCKS.filter(
  (unlock): unlock is (typeof PROGRESSION_UNLOCKS)[number] & { kind: 'hero' } =>
    unlock.kind === 'hero',
).map((unlock) => unlock.heroId)

export interface HeroSkillConfig extends SkillConfig {
  name: string
}

export interface HeroAppearance {
  primaryColor: string
  accentColor: string
  silhouette: 'capsule' | 'bulk' | 'slim'
  weapon: 'shotgun' | 'axe-shield' | 'rifle'
}

export interface HeroDefinition {
  name: string
  alias: string
  role: Row
  defaultSlot: { row: Row; index: number }
  unlockGangLevel: number
  baseHp: number
  baseAtk: number
  baseDef: number
  hpPerLevel: number
  atkPerLevel: number
  defPerLevel: number
  skill: HeroSkillConfig
  appearance: HeroAppearance
}

export interface HeroesConfig {
  version: 1
  heroes: Record<HeroId, HeroDefinition>
  expToLevel: Record<number, number>
}

function invalidConfig(path: string): never {
  throw new Error(`Invalid heroes config: ${path}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseNonNegSafeInt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    invalidConfig(path)
  }
  return value
}

function parsePositiveSafeInt(value: unknown, path: string): number {
  const n = parseNonNegSafeInt(value, path)
  if (n === 0) {
    invalidConfig(path)
  }
  return n
}

function parsePositiveNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    invalidConfig(path)
  }
  return value
}

function parseString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    invalidConfig(path)
  }
  return value
}

function parseRow(value: unknown, path: string): Row {
  if (value !== 'front' && value !== 'back') {
    invalidConfig(path)
  }
  return value
}

function parseSkill(value: unknown, path: string): HeroSkillConfig {
  if (!isRecord(value)) {
    invalidConfig(path)
  }
  return {
    name: parseString(value.name, `${path}.name`),
    targetMultiplier: parsePositiveNumber(
      value.targetMultiplier,
      `${path}.targetMultiplier`,
    ),
    splashMultiplier: parsePositiveNumber(
      value.splashMultiplier,
      `${path}.splashMultiplier`,
    ),
    initialCooldownTicks: parsePositiveSafeInt(
      value.initialCooldownTicks,
      `${path}.initialCooldownTicks`,
    ),
    cooldownTicks: parsePositiveSafeInt(
      value.cooldownTicks,
      `${path}.cooldownTicks`,
    ),
  }
}

function parseAppearance(value: unknown, path: string): HeroAppearance {
  if (!isRecord(value)) {
    invalidConfig(path)
  }
  if (
    value.silhouette !== 'capsule' &&
    value.silhouette !== 'bulk' &&
    value.silhouette !== 'slim'
  ) {
    invalidConfig(`${path}.silhouette`)
  }
  if (
    value.weapon !== 'shotgun' &&
    value.weapon !== 'axe-shield' &&
    value.weapon !== 'rifle'
  ) {
    invalidConfig(`${path}.weapon`)
  }
  return {
    primaryColor: parseString(value.primaryColor, `${path}.primaryColor`),
    accentColor: parseString(value.accentColor, `${path}.accentColor`),
    silhouette: value.silhouette,
    weapon: value.weapon,
  }
}

export function parseHeroesConfig(value: unknown): HeroesConfig {
  if (!isRecord(value) || value.version !== 1) {
    invalidConfig('version')
  }

  const expRaw = value.expToLevel
  if (!isRecord(expRaw)) {
    invalidConfig('expToLevel')
  }
  for (const key of Object.keys(expRaw)) {
    const L = Number(key)
    if (!Number.isInteger(L) || L < 1 || L > 49 || String(L) !== key) {
      invalidConfig(`expToLevel.${key}`)
    }
  }
  const exp: Record<number, number> = {}
  for (let L = 1; L <= 49; L += 1) {
    const cost = expRaw[String(L)]
    if (typeof cost !== 'number' || !Number.isInteger(cost) || cost <= 0) {
      invalidConfig(`expToLevel.${L}`)
    }
    exp[L] = cost
  }

  const heroesRaw = value.heroes
  if (!isRecord(heroesRaw)) {
    invalidConfig('heroes')
  }
  for (const key of Object.keys(heroesRaw)) {
    if (!HERO_IDS.some((id) => id === key)) {
      invalidConfig(`heroes.${key}`)
    }
  }

  const heroes = {} as Record<HeroId, HeroDefinition>
  for (const id of HERO_IDS) {
    const h = heroesRaw[id]
    if (!isRecord(h)) {
      invalidConfig(`heroes.${id}`)
    }
    const role = parseRow(h.role, `heroes.${id}.role`)
    const unlockGangLevel = parsePositiveSafeInt(
      h.unlockGangLevel,
      `heroes.${id}.unlockGangLevel`,
    )
    if (unlockGangLevel !== heroUnlockLevel(id)) {
      invalidConfig(`heroes.${id}.unlockGangLevel`)
    }
    const slot = h.defaultSlot
    if (!isRecord(slot)) {
      invalidConfig(`heroes.${id}.defaultSlot`)
    }
    heroes[id] = {
      name: parseString(h.name, `heroes.${id}.name`),
      alias: parseString(h.alias, `heroes.${id}.alias`),
      role,
      defaultSlot: {
        row: parseRow(slot.row, `heroes.${id}.defaultSlot.row`),
        index: parseNonNegSafeInt(slot.index, `heroes.${id}.defaultSlot.index`),
      },
      unlockGangLevel,
      baseHp: parseNonNegSafeInt(h.baseHp, `heroes.${id}.baseHp`),
      baseAtk: parseNonNegSafeInt(h.baseAtk, `heroes.${id}.baseAtk`),
      baseDef: parseNonNegSafeInt(h.baseDef, `heroes.${id}.baseDef`),
      hpPerLevel: parseNonNegSafeInt(h.hpPerLevel, `heroes.${id}.hpPerLevel`),
      atkPerLevel: parseNonNegSafeInt(
        h.atkPerLevel,
        `heroes.${id}.atkPerLevel`,
      ),
      defPerLevel: parseNonNegSafeInt(
        h.defPerLevel,
        `heroes.${id}.defPerLevel`,
      ),
      skill: parseSkill(h.skill, `heroes.${id}.skill`),
      appearance: parseAppearance(h.appearance, `heroes.${id}.appearance`),
    }
  }

  return { version: 1, heroes, expToLevel: exp }
}

export const heroesConfig = parseHeroesConfig(raw)

export function expToLevel(level: number): number {
  const cost = heroesConfig.expToLevel[level]
  if (!Number.isInteger(cost)) {
    throw new Error(`Invalid heroes config: expToLevel.${level}`)
  }
  return cost
}
