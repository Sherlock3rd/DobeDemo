import { equipmentConfig } from '../../config/equipmentConfig'
import {
  getRacingStage,
  type RacingStageConfig,
} from '../../config/racingConfig'
import type { CarId, GunId } from '../equipmentTypes'

export const RACE_TICK_MS = 100
export const RACE_LANES = [0, 1, 2] as const
export type RaceLane = (typeof RACE_LANES)[number]
export type RaceStatus = 'running' | 'victory' | 'defeat'
export type RaceEventType =
  'lane' | 'boost' | 'collision' | 'shot' | 'hit' | 'incoming' | 'finish'

export interface RaceEvent {
  id: number
  type: RaceEventType
}

export interface RaceState {
  stage: number
  mode: RacingStageConfig['mode']
  status: RaceStatus
  reason: 'running' | 'finished' | 'escaped' | 'destroyed' | 'timeout'
  elapsedMs: number
  lane: RaceLane
  laneCooldownMs: number
  speed: number
  distance: number
  durability: number
  maxDurability: number
  boost: number
  opponents: number[]
  targetDistance: number
  targetLane: RaceLane
  targetHp: number
  maxTargetHp: number
  fireCooldownMs: number
  nextObstacleIndex: number
  nextIncomingMs: number
  collisions: number
  shotsFired: number
  hits: number
  event: RaceEvent | null
}

export interface RaceInput {
  laneDelta?: -1 | 0 | 1
  boost?: boolean
  fire?: boolean
}

export interface RaceLoadout {
  carId: CarId
  gunId: GunId | null
}

function lane(value: number): RaceLane {
  return Math.min(2, Math.max(0, value)) as RaceLane
}

function obstacleLane(stage: number, obstacleIndex: number): RaceLane {
  return ((stage + obstacleIndex * 2) % 3) as RaceLane
}

function withEvent(state: RaceState, type: RaceEventType): RaceState {
  return {
    ...state,
    event: { id: (state.event?.id ?? 0) + 1, type },
  }
}

export function createRaceState(
  stageNumber: number,
  loadout: RaceLoadout,
): RaceState {
  const stage = getRacingStage(stageNumber)
  const car = equipmentConfig.cars[loadout.carId]
  if (stage.mode === 'pursuit' && loadout.gunId === null) {
    throw new Error('Pursuit stage requires a gun')
  }
  return {
    stage: stageNumber,
    mode: stage.mode,
    status: 'running',
    reason: 'running',
    elapsedMs: 0,
    lane: 1,
    laneCooldownMs: 0,
    speed: Math.min(14, car.racing.maxSpeed),
    distance: 0,
    durability: car.racing.durability,
    maxDurability: car.racing.durability,
    boost: 100,
    opponents:
      stage.mode === 'race'
        ? stage.opponentSpeeds.map((_, index) => 10 + index * 5)
        : [],
    targetDistance: stage.mode === 'pursuit' ? 28 : 0,
    targetLane:
      stage.mode === 'pursuit' ? (((stage.order - 1) % 3) as RaceLane) : 1,
    targetHp: stage.mode === 'pursuit' ? stage.targetHp : 0,
    maxTargetHp: stage.mode === 'pursuit' ? stage.targetHp : 0,
    fireCooldownMs: 0,
    nextObstacleIndex: 1,
    nextIncomingMs: 2600,
    collisions: 0,
    shotsFired: 0,
    hits: 0,
    event: null,
  }
}

function resolveFinish(state: RaceState, stage: RacingStageConfig): RaceState {
  if (state.durability <= 0) {
    return withEvent(
      { ...state, status: 'defeat', reason: 'destroyed', durability: 0 },
      'finish',
    )
  }
  if (stage.mode === 'race') {
    if (state.distance >= stage.distance) {
      const won = state.opponents.every(
        (opponentDistance) => state.distance >= opponentDistance,
      )
      return withEvent(
        {
          ...state,
          status: won ? 'victory' : 'defeat',
          reason: 'finished',
        },
        'finish',
      )
    }
    if (state.opponents.some((distance) => distance >= stage.distance)) {
      return withEvent(
        { ...state, status: 'defeat', reason: 'finished' },
        'finish',
      )
    }
  } else {
    if (state.targetHp <= 0) {
      return withEvent(
        { ...state, targetHp: 0, status: 'victory', reason: 'finished' },
        'finish',
      )
    }
    if (state.targetDistance >= stage.distance) {
      return withEvent(
        { ...state, status: 'defeat', reason: 'escaped' },
        'finish',
      )
    }
  }
  if (state.elapsedMs >= stage.durationMs) {
    return withEvent(
      { ...state, status: 'defeat', reason: 'timeout' },
      'finish',
    )
  }
  return state
}

export function advanceRace(
  current: RaceState,
  input: RaceInput,
  loadout: RaceLoadout,
  deltaMs = RACE_TICK_MS,
): RaceState {
  if (current.status !== 'running') return current
  const stage = getRacingStage(current.stage)
  const car = equipmentConfig.cars[loadout.carId]
  const dtMs = Math.min(500, Math.max(1, deltaMs))
  const dt = dtMs / 1000
  let next: RaceState = {
    ...current,
    elapsedMs: current.elapsedMs + dtMs,
    laneCooldownMs: Math.max(0, current.laneCooldownMs - dtMs),
    fireCooldownMs: Math.max(0, current.fireCooldownMs - dtMs),
    event: current.event,
  }

  if (
    input.laneDelta &&
    next.laneCooldownMs <= 0 &&
    lane(next.lane + input.laneDelta) !== next.lane
  ) {
    next = withEvent(
      {
        ...next,
        lane: lane(next.lane + input.laneDelta),
        laneCooldownMs: car.racing.handlingMs,
      },
      'lane',
    )
  }

  const boosting = Boolean(input.boost && next.boost > 0)
  const desiredSpeed = car.racing.maxSpeed * (boosting ? 1.22 : 1)
  const acceleration = car.racing.acceleration * (boosting ? 1.35 : 1)
  next.speed = Math.min(desiredSpeed, next.speed + acceleration * dt)
  if (!boosting && next.speed > car.racing.maxSpeed) {
    next.speed = Math.max(car.racing.maxSpeed, next.speed - acceleration * dt)
  }
  next.boost = Math.min(
    100,
    Math.max(0, next.boost + (boosting ? -25 : 11) * dt),
  )
  if (boosting && current.event?.type !== 'boost') {
    next = withEvent(next, 'boost')
  }

  const previousDistance = next.distance
  next.distance += next.speed * dt
  if (stage.mode === 'race') {
    next.opponents = next.opponents.map(
      (distance, index) => distance + stage.opponentSpeeds[index] * dt,
    )
  } else {
    next.targetDistance += stage.targetSpeed * dt
    if (next.distance > next.targetDistance + 6) {
      next.distance = next.targetDistance + 6
      next.speed = Math.min(next.speed, stage.targetSpeed)
    }
    const targetLanePhase = Math.floor(next.elapsedMs / 5000)
    next.targetLane = ((stage.order + targetLanePhase - 1) % 3) as RaceLane
  }

  let obstacleIndex = next.nextObstacleIndex
  while (stage.obstacleEvery * obstacleIndex <= next.distance) {
    const obstacleDistance = stage.obstacleEvery * obstacleIndex
    if (
      obstacleDistance > previousDistance &&
      obstacleLane(stage.order, obstacleIndex) === next.lane
    ) {
      next = withEvent(
        {
          ...next,
          durability: Math.max(0, next.durability - 18),
          speed: Math.max(8, next.speed * 0.58),
          collisions: next.collisions + 1,
        },
        'collision',
      )
    }
    obstacleIndex += 1
  }
  next.nextObstacleIndex = obstacleIndex

  if (stage.mode === 'pursuit') {
    const gun = loadout.gunId ? equipmentConfig.guns[loadout.gunId] : null
    const gap = next.targetDistance - next.distance
    if (
      input.fire &&
      gun &&
      next.fireCooldownMs <= 0 &&
      next.lane === next.targetLane &&
      gap <= gun.pursuit.range &&
      gap >= -8
    ) {
      next = withEvent(
        {
          ...next,
          targetHp: Math.max(0, next.targetHp - gun.pursuit.damage),
          fireCooldownMs: gun.pursuit.cooldownMs,
          shotsFired: next.shotsFired + 1,
          hits: next.hits + 1,
        },
        'hit',
      )
    } else if (input.fire && gun && next.fireCooldownMs <= 0) {
      next = withEvent(
        {
          ...next,
          fireCooldownMs: gun.pursuit.cooldownMs,
          shotsFired: next.shotsFired + 1,
        },
        'shot',
      )
    }

    while (next.elapsedMs >= next.nextIncomingMs) {
      if (
        next.lane === next.targetLane &&
        Math.abs(next.targetDistance - next.distance) <= 46
      ) {
        next = withEvent(
          {
            ...next,
            durability: Math.max(0, next.durability - stage.incomingDamage),
          },
          'incoming',
        )
      }
      next.nextIncomingMs += 2600
    }
  }

  return resolveFinish(next, stage)
}

export function nextObstacle(state: RaceState): {
  distance: number
  lane: RaceLane
} {
  const stage = getRacingStage(state.stage)
  return {
    distance: stage.obstacleEvery * state.nextObstacleIndex,
    lane: obstacleLane(stage.order, state.nextObstacleIndex),
  }
}

export function raceProgress(state: RaceState): number {
  const stage = getRacingStage(state.stage)
  return Math.min(1, Math.max(0, state.distance / stage.distance))
}

export function raceRank(state: RaceState): number {
  if (state.mode !== 'race') return 1
  return (
    1 + state.opponents.filter((distance) => distance > state.distance).length
  )
}
