import { getEnemyCount, getStage } from '../../config/campaignConfig'
import { combatConfig, type SkillConfig } from '../../config/combatConfig'
import { heroesConfig } from '../../config/heroesConfig'
import {
  getHeroLevelCap,
  getHeroStats,
  isHeroId,
  isHeroUnlocked,
  type HeroId,
  type Row,
} from '../heroes'
import {
  effectiveStats,
  globalIndexOf,
  type FormationAssignment,
} from './power'
import { basicAttackDamage, skillMainDamage, skillSplashDamage } from './damage'
import { selectTarget, type CombatUnitState, type Side } from './targeting'

export interface BattleUnitInput {
  side: Side
  heroId?: HeroId
  level: number
  row: Row
  index: number
  hp: number
  atk: number
  def: number
  skill: SkillConfig
}

export interface BattleInput {
  stage: number
  allies: BattleUnitInput[]
  enemies: BattleUnitInput[]
  seed: string
}

export interface UnitSnapshot {
  side: Side
  globalIndex: number
  row: Row
  index: number
  heroId?: HeroId
  hp: number
  maxHp: number
  cooldownRemaining: number
  cooldownTotal: number
  alive: boolean
}

export interface HitEvent {
  attackerSide: Side
  attackerGlobalIndex: number
  targetSide: Side
  targetGlobalIndex: number
  amount: number
  kind: 'basic' | 'skill-main' | 'skill-splash'
}

export interface DeathEvent {
  side: Side
  globalIndex: number
}

export interface TickSnapshot {
  tick: number
  units: UnitSnapshot[]
  hits: HitEvent[]
  deaths: DeathEvent[]
}

export interface BattleResult {
  outcome: 'victory' | 'defeat'
  endedAtTick: number
  reason: 'enemies-cleared' | 'allies-defeated' | 'timeout'
  timeline: TickSnapshot[]
  alliesSurvived: number
}

interface RuntimeUnit {
  input: BattleUnitInput
  globalIndex: number
  effAtk: number
  effDef: number
  maxHp: number
  hp: number
  alive: boolean
  cooldown: number
  cooldownTotal: number
}

export function createBattleSeed(input: Omit<BattleInput, 'seed'>): string {
  // Encode every field that can change combat outcomes so two different
  // BattleInputs never collide on the same seed string.
  const part = (u: BattleUnitInput) =>
    [
      u.side,
      u.heroId ?? 'enemy',
      u.level,
      `${u.row}${u.index}`,
      `hp${u.hp}`,
      `atk${u.atk}`,
      `def${u.def}`,
      `tm${u.skill.targetMultiplier}`,
      `sm${u.skill.splashMultiplier}`,
      `ic${u.skill.initialCooldownTicks}`,
      `cd${u.skill.cooldownTicks}`,
    ].join(':')
  return `stage${input.stage}|${input.allies.map(part).join(',')}|${input.enemies
    .map(part)
    .join(',')}`
}

const ENEMY_APPEARANCE_ROWS: ReadonlyArray<{ row: Row; index: number }> = [
  { row: 'front', index: 0 },
  { row: 'front', index: 1 },
  { row: 'back', index: 0 },
  { row: 'back', index: 1 },
  { row: 'back', index: 2 },
]

function invalidInput(reason: string): never {
  throw new Error(`Invalid battle input: ${reason}`)
}

const MAX_FORMATION_SIZE = 5
const SLOT_LIMITS: Record<Row, number> = { front: 2, back: 3 }

// Enforces the §14.3 pre-battle contract: non-empty formation, no duplicate
// hero/slot, unlocked heroes and levels within the gang cap. Illegal input is
// rejected outright — never silently clamped — so callers must gate the UI.
export function buildBattleInput(
  stage: number,
  formation: FormationAssignment,
  heroLevels: Record<HeroId, number>,
  gangLevel: number,
): BattleInput {
  if (!Number.isInteger(stage) || stage < 1 || stage > 20) {
    invalidInput('stage')
  }
  if (!Number.isInteger(gangLevel) || gangLevel < 1 || gangLevel > 50) {
    invalidInput('gangLevel')
  }

  const stageConfig = getStage(stage)

  if (!Array.isArray(formation) || formation.length === 0) {
    invalidInput('formation is empty')
  }
  if (formation.length > MAX_FORMATION_SIZE) {
    invalidInput(
      `formation size ${formation.length} exceeds ${MAX_FORMATION_SIZE}`,
    )
  }

  const cap = getHeroLevelCap(gangLevel)
  const seenHeroes = new Set<HeroId>()
  const seenSlots = new Set<string>()

  const allies: BattleUnitInput[] = formation.map((slot) => {
    if (!isHeroId(slot.heroId)) {
      invalidInput(`unknown hero ${String(slot.heroId)}`)
    }
    if (seenHeroes.has(slot.heroId)) {
      invalidInput(`duplicate hero ${slot.heroId}`)
    }
    seenHeroes.add(slot.heroId)

    if (
      (slot.row !== 'front' && slot.row !== 'back') ||
      !Number.isInteger(slot.index) ||
      slot.index < 0 ||
      slot.index >= SLOT_LIMITS[slot.row]
    ) {
      invalidInput(`invalid slot ${slot.row}:${slot.index}`)
    }
    const slotKey = `${slot.row}:${slot.index}`
    if (seenSlots.has(slotKey)) {
      invalidInput(`duplicate slot ${slotKey}`)
    }
    seenSlots.add(slotKey)

    if (!isHeroUnlocked(slot.heroId, gangLevel)) {
      invalidInput(`locked hero ${slot.heroId}`)
    }

    const level = heroLevels[slot.heroId]
    if (!Number.isInteger(level) || level < 1 || level > cap) {
      invalidInput(
        `level ${String(level)} out of range for ${slot.heroId} (cap ${cap})`,
      )
    }

    const stats = getHeroStats(slot.heroId, level)
    return {
      side: 'ally',
      heroId: slot.heroId,
      level,
      row: slot.row,
      index: slot.index,
      hp: stats.hp,
      atk: stats.atk,
      def: stats.def,
      skill: heroesConfig.heroes[slot.heroId].skill,
    }
  })

  const count = getEnemyCount(stage)
  const enemySkill: SkillConfig = {
    ...combatConfig.skillDefaults,
    cooldownTicks: combatConfig.enemySkillCooldownTicks,
  }
  const enemies: BattleUnitInput[] = ENEMY_APPEARANCE_ROWS.slice(0, count).map(
    (slot) => ({
      side: 'enemy',
      level: stageConfig.enemy.level,
      row: slot.row,
      index: slot.index,
      hp: stageConfig.enemy.hp,
      atk: stageConfig.enemy.atk,
      def: stageConfig.enemy.def,
      skill: enemySkill,
    }),
  )

  const seed = createBattleSeed({ stage, allies, enemies })
  return { stage, allies, enemies, seed }
}

export function simulateBattle(input: BattleInput): BattleResult {
  const build = (u: BattleUnitInput): RuntimeUnit => {
    const eff = effectiveStats(u.row, { hp: u.hp, atk: u.atk, def: u.def })
    return {
      input: u,
      globalIndex: globalIndexOf(u.row, u.index),
      effAtk: eff.effAtk,
      effDef: eff.effDef,
      maxHp: eff.effHp,
      hp: eff.effHp,
      alive: true,
      cooldown: u.skill.initialCooldownTicks,
      cooldownTotal: u.skill.cooldownTicks,
    }
  }
  const allies = input.allies.map(build)
  const enemies = input.enemies.map(build)
  const timeline: TickSnapshot[] = []
  const interval = combatConfig.attackIntervalTicks
  let outcome: BattleResult['outcome'] = 'defeat'
  let reason: BattleResult['reason'] = 'timeout'
  let endedAtTick = 0

  const defenderStates = (defenders: RuntimeUnit[]): CombatUnitState[] =>
    defenders.map((d) => ({
      globalIndex: d.globalIndex,
      row: d.input.row,
      side: d.input.side,
      hp: d.hp,
      alive: d.alive,
    }))

  for (let tick = 1; tick <= combatConfig.maxBattleTicks; tick += 1) {
    const hits: HitEvent[] = []
    const deaths: DeathEvent[] = []

    // 1. decrement cooldowns for living units
    for (const unit of [...allies, ...enemies]) {
      if (unit.alive && unit.cooldown > 0) unit.cooldown -= 1
    }

    // 2-3. resolve actions: allies (globalIndex asc) then enemies
    const actIn = (
      attackers: RuntimeUnit[],
      defenders: RuntimeUnit[],
      attackerSide: Side,
      defenderSide: Side,
    ) => {
      for (const attacker of [...attackers].sort(
        (a, b) => a.globalIndex - b.globalIndex,
      )) {
        if (!attacker.alive) continue
        const phase =
          attackerSide === 'ally'
            ? attacker.globalIndex % interval
            : (5 + attacker.globalIndex) % interval
        if (tick % interval !== phase) continue
        const target = selectTarget(defenderStates(defenders))
        if (!target) continue
        const targetUnit = defenders.find(
          (d) => d.globalIndex === target.globalIndex && d.alive,
        )
        if (!targetUnit) continue
        if (attacker.cooldown <= 0) {
          const main = skillMainDamage(
            attacker.effAtk,
            targetUnit.effDef,
            attacker.input.skill.targetMultiplier,
          )
          targetUnit.hp -= main
          hits.push({
            attackerSide,
            attackerGlobalIndex: attacker.globalIndex,
            targetSide: defenderSide,
            targetGlobalIndex: targetUnit.globalIndex,
            amount: main,
            kind: 'skill-main',
          })
          for (const other of defenders) {
            if (other === targetUnit || !other.alive) continue
            const splash = skillSplashDamage(
              attacker.effAtk,
              other.effDef,
              attacker.input.skill.splashMultiplier,
            )
            other.hp -= splash
            hits.push({
              attackerSide,
              attackerGlobalIndex: attacker.globalIndex,
              targetSide: defenderSide,
              targetGlobalIndex: other.globalIndex,
              amount: splash,
              kind: 'skill-splash',
            })
          }
          attacker.cooldown = attacker.cooldownTotal
        } else {
          const dmg = basicAttackDamage(attacker.effAtk, targetUnit.effDef)
          targetUnit.hp -= dmg
          hits.push({
            attackerSide,
            attackerGlobalIndex: attacker.globalIndex,
            targetSide: defenderSide,
            targetGlobalIndex: targetUnit.globalIndex,
            amount: dmg,
            kind: 'basic',
          })
        }
      }
    }
    actIn(allies, enemies, 'ally', 'enemy')
    actIn(enemies, allies, 'enemy', 'ally')

    // 4. resolve deaths at tick end
    for (const unit of [...allies, ...enemies]) {
      if (unit.alive && unit.hp <= 0) {
        unit.alive = false
        unit.hp = 0
        deaths.push({ side: unit.input.side, globalIndex: unit.globalIndex })
      }
    }

    // 5. snapshot
    const snapshot = (u: RuntimeUnit): UnitSnapshot => ({
      side: u.input.side,
      globalIndex: u.globalIndex,
      row: u.input.row,
      index: u.input.index,
      heroId: u.input.heroId,
      hp: u.hp,
      maxHp: u.maxHp,
      cooldownRemaining: Math.max(0, u.cooldown),
      cooldownTotal: u.cooldownTotal,
      alive: u.alive,
    })
    timeline.push({
      tick,
      units: [...allies, ...enemies].map(snapshot),
      hits,
      deaths,
    })

    // 6. outcome
    const alliesAlive = allies.some((u) => u.alive)
    const enemiesAlive = enemies.some((u) => u.alive)
    endedAtTick = tick
    if (!enemiesAlive && alliesAlive) {
      outcome = 'victory'
      reason = 'enemies-cleared'
      break
    }
    if (!alliesAlive) {
      outcome = 'defeat'
      reason = 'allies-defeated'
      break
    }
    if (tick >= combatConfig.maxBattleTicks) {
      outcome = 'defeat'
      reason = 'timeout'
      break
    }
  }

  return {
    outcome,
    endedAtTick,
    reason,
    timeline,
    alliesSurvived: allies.filter((u) => u.alive).length,
  }
}
