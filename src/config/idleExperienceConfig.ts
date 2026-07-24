import raw from './idle-experience.config.json'

function invalidConfig(path: string): never {
  throw new Error(`Invalid idle-experience config: ${path}`)
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

const IDLE_TOP_LEVEL_KEYS = [
  'version',
  'tickSeconds',
  'maxOfflineSeconds',
  'ratePerTickByHighestStage',
] as const

export interface IdleExperienceConfig {
  version: 1
  tickSeconds: 10
  maxOfflineSeconds: 28800
  ratePerTickByHighestStage: Record<number, number>
}

export function parseIdleExperienceConfig(
  value: unknown,
): IdleExperienceConfig {
  if (!isRecord(value) || value.version !== 1) {
    invalidConfig('version')
  }
  assertKnownKeys(value, IDLE_TOP_LEVEL_KEYS, '')
  if (value.tickSeconds !== 10) {
    invalidConfig('tickSeconds')
  }
  if (value.maxOfflineSeconds !== 28800) {
    invalidConfig('maxOfflineSeconds')
  }

  const rates = value.ratePerTickByHighestStage
  if (!isRecord(rates)) {
    invalidConfig('ratePerTickByHighestStage')
  }

  for (const key of Object.keys(rates)) {
    const g = Number(key)
    if (!Number.isInteger(g) || g < 1 || g > 20 || String(g) !== key) {
      invalidConfig(`ratePerTickByHighestStage.${key}`)
    }
  }

  const parsed: Record<number, number> = {}
  for (let g = 1; g <= 20; g += 1) {
    const rate = rates[String(g)]
    if (typeof rate !== 'number' || !Number.isInteger(rate) || rate <= 0) {
      invalidConfig(`ratePerTickByHighestStage.${g}`)
    }
    parsed[g] = rate
  }

  return {
    version: 1,
    tickSeconds: 10,
    maxOfflineSeconds: 28800,
    ratePerTickByHighestStage: parsed,
  }
}

export const idleExperienceConfig = parseIdleExperienceConfig(raw)

export function ratePerTick(highestClearedStage: number): number {
  if (!Number.isFinite(highestClearedStage) || highestClearedStage < 1) {
    return 0
  }
  const g = Math.min(20, Math.floor(highestClearedStage))
  return idleExperienceConfig.ratePerTickByHighestStage[g] ?? 0
}

export interface IdleSettlementInput {
  lastUpdatedAt: number
  now: number
  highestClearedStage: number
}

export interface IdleSettlement {
  earnedExp: number
  nextUpdatedAt: number
}

export function settleIdleExperience({
  lastUpdatedAt,
  now,
  highestClearedStage,
}: IdleSettlementInput): IdleSettlement {
  if (
    !Number.isFinite(lastUpdatedAt) ||
    !Number.isFinite(now) ||
    now < lastUpdatedAt
  ) {
    return { earnedExp: 0, nextUpdatedAt: lastUpdatedAt }
  }
  if (!Number.isFinite(highestClearedStage) || highestClearedStage < 1) {
    return { earnedExp: 0, nextUpdatedAt: lastUpdatedAt }
  }

  const tickMs = idleExperienceConfig.tickSeconds * 1000
  const maxOffMs = idleExperienceConfig.maxOfflineSeconds * 1000
  const elapsedMs = now - lastUpdatedAt
  const capped = elapsedMs > maxOffMs
  const effElapsed = Math.min(elapsedMs, maxOffMs)
  const ticks = Math.floor(effElapsed / tickMs)

  if (ticks === 0) {
    return { earnedExp: 0, nextUpdatedAt: lastUpdatedAt }
  }

  const earnedExp = ratePerTick(highestClearedStage) * ticks
  return {
    earnedExp,
    nextUpdatedAt: capped ? now : lastUpdatedAt + ticks * tickMs,
  }
}
