import raw from './combat.config.json'

export interface SkillConfig {
  targetMultiplier: number
  splashMultiplier: number
  initialCooldownTicks: number
  cooldownTicks: number
}

export interface PositionModifier {
  atkMul: number
  defMul: number
  aggro: boolean
}

function invalidConfig(path: string): never {
  throw new Error(`Invalid combat config: ${path}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertKnownKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      invalidConfig(path === '' ? key : `${path}.${key}`)
    }
  }
}

const COMBAT_TOP_LEVEL_KEYS = [
  'version',
  'tickMs',
  'maxBattleTicks',
  'attackIntervalTicks',
  'defenseConstant',
  'positionModifiers',
  'powerWeights',
  'skillDefaults',
  'enemySkillCooldownTicks',
] as const
const SKILL_KEYS = [
  'targetMultiplier',
  'splashMultiplier',
  'initialCooldownTicks',
  'cooldownTicks',
] as const
const POSITION_MODIFIERS_CONTAINER_KEYS = ['front', 'back'] as const
const POSITION_MODIFIER_KEYS = ['atkMul', 'defMul', 'aggro'] as const
const POWER_WEIGHTS_KEYS = ['hp', 'atk', 'def'] as const

function parsePositiveMultiplier(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    invalidConfig(path)
  }
  return value
}

function parsePositiveSafeInt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    invalidConfig(path)
  }
  return value
}

function parseLiteralSafeInt<const T extends number>(
  value: unknown,
  expected: T,
  path: string,
): T {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value !== expected
  ) {
    invalidConfig(path)
  }
  return expected
}

function parseSkill(value: unknown, path: string): SkillConfig {
  if (!isRecord(value)) {
    invalidConfig(path)
  }
  assertKnownKeys(value, SKILL_KEYS, path)
  return {
    targetMultiplier: parsePositiveMultiplier(
      value.targetMultiplier,
      `${path}.targetMultiplier`,
    ),
    splashMultiplier: parsePositiveMultiplier(
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

function parsePositionModifier(value: unknown, path: string): PositionModifier {
  if (!isRecord(value)) {
    invalidConfig(path)
  }
  assertKnownKeys(value, POSITION_MODIFIER_KEYS, path)
  if (typeof value.aggro !== 'boolean') {
    invalidConfig(`${path}.aggro`)
  }
  return {
    atkMul: parsePositiveMultiplier(value.atkMul, `${path}.atkMul`),
    defMul: parsePositiveMultiplier(value.defMul, `${path}.defMul`),
    aggro: value.aggro,
  }
}

function parseWeight(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    invalidConfig(path)
  }
  return value
}

export interface CombatConfig {
  version: 1
  tickMs: 100
  maxBattleTicks: 600
  attackIntervalTicks: number
  defenseConstant: number
  positionModifiers: { front: PositionModifier; back: PositionModifier }
  powerWeights: { hp: number; atk: number; def: number }
  skillDefaults: SkillConfig
  enemySkillCooldownTicks: number
}

export function parseCombatConfig(value: unknown): CombatConfig {
  if (!isRecord(value)) {
    invalidConfig('version')
  }
  const version = parseLiteralSafeInt(value.version, 1, 'version')
  assertKnownKeys(value, COMBAT_TOP_LEVEL_KEYS, '')
  const tickMs = parseLiteralSafeInt(value.tickMs, 100, 'tickMs')
  const maxBattleTicks = parseLiteralSafeInt(
    value.maxBattleTicks,
    600,
    'maxBattleTicks',
  )

  const defenseConstant = value.defenseConstant
  if (
    typeof defenseConstant !== 'number' ||
    !Number.isFinite(defenseConstant) ||
    defenseConstant <= 0
  ) {
    invalidConfig('defenseConstant')
  }

  const modifiers = value.positionModifiers
  if (!isRecord(modifiers)) {
    invalidConfig('positionModifiers')
  }
  assertKnownKeys(
    modifiers,
    POSITION_MODIFIERS_CONTAINER_KEYS,
    'positionModifiers',
  )
  const weights = value.powerWeights
  if (!isRecord(weights)) {
    invalidConfig('powerWeights')
  }
  assertKnownKeys(weights, POWER_WEIGHTS_KEYS, 'powerWeights')

  return {
    version,
    tickMs,
    maxBattleTicks,
    attackIntervalTicks: parsePositiveSafeInt(
      value.attackIntervalTicks,
      'attackIntervalTicks',
    ),
    defenseConstant,
    positionModifiers: {
      front: parsePositionModifier(modifiers.front, 'positionModifiers.front'),
      back: parsePositionModifier(modifiers.back, 'positionModifiers.back'),
    },
    powerWeights: {
      hp: parseWeight(weights.hp, 'powerWeights.hp'),
      atk: parseWeight(weights.atk, 'powerWeights.atk'),
      def: parseWeight(weights.def, 'powerWeights.def'),
    },
    skillDefaults: parseSkill(value.skillDefaults, 'skillDefaults'),
    enemySkillCooldownTicks: parsePositiveSafeInt(
      value.enemySkillCooldownTicks,
      'enemySkillCooldownTicks',
    ),
  }
}

export const combatConfig = parseCombatConfig(raw)
