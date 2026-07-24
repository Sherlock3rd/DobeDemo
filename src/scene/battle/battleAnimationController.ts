import type { HitEvent } from '../../game/combat/battleEngine'
import type { Side } from '../../game/combat/targeting'

const APPROACH_DURATION_MS = 450
const APPROACH_DISTANCE = 0.75
const LUNGE_PEAK_MS = 140
const LUNGE_DURATION_MS = 320
const LUNGE_DISTANCE = 0.45
const DEATH_DURATION_MS = 500
const DEATH_SINK_DISTANCE = 0.55
const BASIC_EFFECT_DURATION_MS = 180
const SKILL_EFFECT_DURATION_MS = 420

export interface BattleUnitAnimationInput {
  actionKey: number | null
  alive: boolean
  side: Side
  reducedMotion: boolean
}

export interface BattleUnitAnimationPose {
  zOffset: number
  yOffset: number
  rotationX: number
}

export interface BattleEffectAnimationFrame {
  visible: boolean
  muzzleScale: number
  impactScale: number
  trailProgress: number
  opacity: number
}

export interface BattleUnitTransformTarget {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function easeInOut(value: number): number {
  const clamped = clamp01(value)
  return clamped * clamped * (3 - 2 * clamped)
}

function directionForSide(side: Side): number {
  return side === 'ally' ? -1 : 1
}

export class BattleUnitAnimationController {
  private entryStartSeconds: number | null = null
  private actionStartSeconds: number | null = null
  private lastActionKey: number | null = null
  private deathStartSeconds: number | null = null
  private wasAlive = true

  step(
    nowSeconds: number,
    input: BattleUnitAnimationInput,
  ): BattleUnitAnimationPose {
    if (this.entryStartSeconds === null) {
      this.entryStartSeconds = nowSeconds
    }

    if (input.actionKey !== null && input.actionKey !== this.lastActionKey) {
      this.actionStartSeconds = nowSeconds
      this.lastActionKey = input.actionKey
      this.entryStartSeconds = nowSeconds - APPROACH_DURATION_MS / 1000
    }

    if (this.wasAlive && !input.alive) {
      this.deathStartSeconds = nowSeconds
    } else if (input.alive) {
      this.deathStartSeconds = null
    }
    this.wasAlive = input.alive

    if (input.reducedMotion) {
      if (!input.alive) {
        return {
          zOffset: 0,
          yOffset: -DEATH_SINK_DISTANCE,
          rotationX: Math.PI / 2,
        }
      }
      return {
        zOffset:
          input.actionKey === null
            ? 0
            : directionForSide(input.side) * LUNGE_DISTANCE,
        yOffset: 0,
        rotationX: 0,
      }
    }

    if (!input.alive) {
      const deathElapsedMs =
        (nowSeconds - (this.deathStartSeconds ?? nowSeconds)) * 1000
      const progress = easeInOut(deathElapsedMs / DEATH_DURATION_MS)
      return {
        zOffset: 0,
        yOffset: -DEATH_SINK_DISTANCE * progress,
        rotationX: (Math.PI / 2) * progress,
      }
    }

    let approachOffset = 0
    if (input.actionKey === null) {
      const entryElapsedMs = (nowSeconds - this.entryStartSeconds) * 1000
      const approachProgress = easeInOut(entryElapsedMs / APPROACH_DURATION_MS)
      approachOffset =
        -directionForSide(input.side) *
        APPROACH_DISTANCE *
        (1 - approachProgress)
    }

    let lungeOffset = 0
    if (this.actionStartSeconds !== null) {
      const actionElapsedMs = (nowSeconds - this.actionStartSeconds) * 1000
      if (actionElapsedMs >= 0 && actionElapsedMs < LUNGE_DURATION_MS) {
        const amount =
          actionElapsedMs <= LUNGE_PEAK_MS
            ? actionElapsedMs / LUNGE_PEAK_MS
            : 1 -
              (actionElapsedMs - LUNGE_PEAK_MS) /
                (LUNGE_DURATION_MS - LUNGE_PEAK_MS)
        lungeOffset =
          directionForSide(input.side) * LUNGE_DISTANCE * easeInOut(amount)
      }
    }

    return {
      zOffset: approachOffset + lungeOffset,
      yOffset: 0,
      rotationX: 0,
    }
  }
}

export function applyBattleUnitFrame(
  group: BattleUnitTransformTarget | null,
  controller: BattleUnitAnimationController,
  nowSeconds: number,
  input: BattleUnitAnimationInput,
  basePosition: readonly [number, number, number],
): void {
  const pose = controller.step(nowSeconds, input)
  if (!group) {
    return
  }

  group.position.x = basePosition[0]
  group.position.y = basePosition[1] + pose.yOffset
  group.position.z = basePosition[2] + pose.zOffset
  group.rotation.x = pose.rotationX
  group.rotation.y = 0
  group.rotation.z = 0
}

export class BattleEffectAnimationController {
  private startSeconds: number | null = null

  step(
    nowSeconds: number,
    kind: HitEvent['kind'],
    reducedMotion: boolean,
  ): BattleEffectAnimationFrame {
    if (this.startSeconds === null) {
      this.startSeconds = nowSeconds
    }

    if (reducedMotion) {
      return {
        visible: true,
        muzzleScale: 0,
        impactScale: 1,
        trailProgress: 0,
        opacity: 1,
      }
    }

    const elapsedMs = (nowSeconds - this.startSeconds) * 1000
    if (kind === 'basic') {
      const progress = clamp01(elapsedMs / BASIC_EFFECT_DURATION_MS)
      return {
        visible: elapsedMs < BASIC_EFFECT_DURATION_MS,
        muzzleScale: 1 - progress,
        impactScale: easeInOut(elapsedMs / 90),
        trailProgress: 0,
        opacity: 1 - progress,
      }
    }

    const progress = clamp01(elapsedMs / SKILL_EFFECT_DURATION_MS)
    return {
      visible: elapsedMs < SKILL_EFFECT_DURATION_MS,
      muzzleScale: 1 - clamp01(elapsedMs / 120),
      impactScale: easeInOut((elapsedMs - 120) / 160),
      trailProgress: easeInOut(elapsedMs / 300),
      opacity: 1 - progress,
    }
  }
}
