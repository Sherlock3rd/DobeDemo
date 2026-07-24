import raw from './campaign.config.json'

export interface EnemyStats {
  level: number
  hp: number
  atk: number
  def: number
}

export interface StageConfig {
  id: string
  global: number
  enemyCount: number
  enemy: EnemyStats
  firstClearReward: { sharedExp: number }
}

export interface CampaignConfig {
  version: 1
  chapters: 2
  stagesPerChapter: 10
  stages: readonly StageConfig[]
}

function invalidConfig(path: string): never {
  throw new Error(`Invalid campaign config: ${path}`)
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

const CAMPAIGN_TOP_LEVEL_KEYS = [
  'version',
  'chapters',
  'stagesPerChapter',
  'stages',
] as const
const STAGE_KEYS = [
  'id',
  'global',
  'enemyCount',
  'enemy',
  'firstClearReward',
] as const
const ENEMY_KEYS = ['level', 'hp', 'atk', 'def'] as const
const FIRST_CLEAR_REWARD_KEYS = ['sharedExp'] as const

export function getEnemyCount(g: number): number {
  if (!Number.isInteger(g) || g < 1 || g > 20) {
    invalidConfig(`getEnemyCount.${g}`)
  }
  if (g <= 3) return 1
  if (g <= 7) return 2
  if (g <= 11) return 3
  if (g <= 15) return 4
  return 5
}

function parseSafeInt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    invalidConfig(path)
  }
  return value
}

export function parseCampaignConfig(value: unknown): CampaignConfig {
  if (!isRecord(value) || value.version !== 1) {
    invalidConfig('version')
  }
  if (value.chapters !== 2) {
    invalidConfig('chapters')
  }
  if (value.stagesPerChapter !== 10) {
    invalidConfig('stagesPerChapter')
  }
  assertKnownKeys(value, CAMPAIGN_TOP_LEVEL_KEYS, '')

  const stages = value.stages
  if (!Array.isArray(stages) || stages.length !== 20) {
    invalidConfig('stages')
  }

  const parsed: StageConfig[] = stages.map((entry, index) => {
    if (!isRecord(entry)) {
      invalidConfig(`stages.${index}`)
    }
    assertKnownKeys(entry, STAGE_KEYS, `stages.${index}`)
    const global = entry.global
    if (global !== index + 1) {
      invalidConfig(`stages.${index}.global`)
    }
    const chapter = global <= 10 ? 1 : 2
    const stageInChapter = global <= 10 ? global : global - 10
    if (entry.id !== `${chapter}-${stageInChapter}`) {
      invalidConfig(`stages.${index}.id`)
    }
    const expectedEnemyCount = getEnemyCount(global)
    if (entry.enemyCount !== expectedEnemyCount) {
      invalidConfig(`stages.${index}.enemyCount`)
    }
    const enemy = entry.enemy
    if (!isRecord(enemy)) {
      invalidConfig(`stages.${index}.enemy`)
    }
    assertKnownKeys(enemy, ENEMY_KEYS, `stages.${index}.enemy`)
    const reward = entry.firstClearReward
    if (!isRecord(reward)) {
      invalidConfig(`stages.${index}.firstClearReward`)
    }
    assertKnownKeys(
      reward,
      FIRST_CLEAR_REWARD_KEYS,
      `stages.${index}.firstClearReward`,
    )

    return {
      id: entry.id as string,
      global,
      enemyCount: expectedEnemyCount,
      enemy: {
        level: parseSafeInt(enemy.level, `stages.${index}.enemy.level`),
        hp: parseSafeInt(enemy.hp, `stages.${index}.enemy.hp`),
        atk: parseSafeInt(enemy.atk, `stages.${index}.enemy.atk`),
        def: parseSafeInt(enemy.def, `stages.${index}.enemy.def`),
      },
      firstClearReward: {
        sharedExp: parseSafeInt(
          reward.sharedExp,
          `stages.${index}.firstClearReward.sharedExp`,
        ),
      },
    }
  })

  return { version: 1, chapters: 2, stagesPerChapter: 10, stages: parsed }
}

export const campaignConfig = parseCampaignConfig(raw)

export function getStage(g: number): StageConfig {
  const stage = campaignConfig.stages.find((s) => s.global === g)
  if (!stage) {
    invalidConfig(`getStage.${g}`)
  }
  return stage
}

export function getFirstClearReward(g: number): number {
  return getStage(g).firstClearReward.sharedExp
}

export function isStageUnlocked(
  g: number,
  highestClearedStage: number,
): boolean {
  if (!Number.isInteger(g) || g < 1 || g > 20) {
    return false
  }
  return g === 1 || g <= highestClearedStage + 1
}
