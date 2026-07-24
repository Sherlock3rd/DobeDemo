import raw from './racing.config.json'

interface RacingStageBase {
  order: number
  id: string
  title: string
  durationMs: number
  distance: number
  obstacleEvery: number
  firstClearExp: number
}

export interface RaceStageConfig extends RacingStageBase {
  mode: 'race'
  opponentSpeeds: number[]
}

export interface PursuitStageConfig extends RacingStageBase {
  mode: 'pursuit'
  targetSpeed: number
  targetHp: number
  incomingDamage: number
}

export type RacingStageConfig = RaceStageConfig | PursuitStageConfig

export interface RacingConfig {
  version: 1
  stages: RacingStageConfig[]
}

function invalid(path: string): never {
  throw new Error(`Invalid racing config: ${path}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positiveNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    invalid(path)
  }
  return value
}

function positiveInt(value: unknown, path: string): number {
  const result = positiveNumber(value, path)
  if (!Number.isSafeInteger(result)) invalid(path)
  return result
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') invalid(path)
  return value
}

export function parseRacingConfig(value: unknown): RacingConfig {
  if (!isRecord(value) || value.version !== 1) invalid('version')
  if (!Array.isArray(value.stages) || value.stages.length !== 10) {
    invalid('stages')
  }
  const stages = value.stages.map((candidate, index): RacingStageConfig => {
    const path = `stages.${index}`
    if (!isRecord(candidate)) invalid(path)
    const order = positiveInt(candidate.order, `${path}.order`)
    if (order !== index + 1) invalid(`${path}.order`)
    const base = {
      order,
      id: string(candidate.id, `${path}.id`),
      title: string(candidate.title, `${path}.title`),
      durationMs: positiveInt(candidate.durationMs, `${path}.durationMs`),
      distance: positiveNumber(candidate.distance, `${path}.distance`),
      obstacleEvery: positiveNumber(
        candidate.obstacleEvery,
        `${path}.obstacleEvery`,
      ),
      firstClearExp: positiveInt(
        candidate.firstClearExp,
        `${path}.firstClearExp`,
      ),
    }
    if (candidate.mode === 'race') {
      if (
        !Array.isArray(candidate.opponentSpeeds) ||
        candidate.opponentSpeeds.length < 1
      ) {
        invalid(`${path}.opponentSpeeds`)
      }
      return {
        ...base,
        mode: 'race',
        opponentSpeeds: candidate.opponentSpeeds.map((speed, opponentIndex) =>
          positiveNumber(speed, `${path}.opponentSpeeds.${opponentIndex}`),
        ),
      }
    }
    if (candidate.mode === 'pursuit') {
      return {
        ...base,
        mode: 'pursuit',
        targetSpeed: positiveNumber(
          candidate.targetSpeed,
          `${path}.targetSpeed`,
        ),
        targetHp: positiveInt(candidate.targetHp, `${path}.targetHp`),
        incomingDamage: positiveInt(
          candidate.incomingDamage,
          `${path}.incomingDamage`,
        ),
      }
    }
    return invalid(`${path}.mode`)
  })
  if (new Set(stages.map((stage) => stage.id)).size !== stages.length) {
    invalid('stages.id')
  }
  return { version: 1, stages }
}

export const racingConfig = parseRacingConfig(raw)

export function getRacingStage(stage: number): RacingStageConfig {
  const definition = racingConfig.stages[stage - 1]
  if (!definition) throw new Error(`Unknown racing stage: ${stage}`)
  return definition
}

export function isRacingStageUnlocked(
  stage: number,
  highestClearedStage: number,
): boolean {
  return stage >= 1 && stage <= 10 && stage === highestClearedStage + 1
}
