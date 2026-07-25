import { equipmentConfig } from '../../config/equipmentConfig'
import {
  getRacingStage,
  type PursuitStageConfig,
  type RacingStageConfig,
} from '../../config/racingConfig'
import { CAR_IDS, type CarId, type GunId } from '../equipmentTypes'

export const RACE_TICK_MS = 50
export const RACE_LANES = [0, 1, 2] as const
export const RACE_LANE_X = [-3.25, 0, 3.25] as const
export type RaceLane = (typeof RACE_LANES)[number]
export type RaceStatus = 'running' | 'victory' | 'defeat'
export type VehicleRole = 'player' | 'racer' | 'target' | 'escort'
export type RaceEventType =
  | 'lane'
  | 'boost'
  | 'drift'
  | 'collision'
  | 'ramp'
  | 'stunt'
  | 'land'
  | 'shot'
  | 'hit'
  | 'incoming'
  | 'destroyed'
  | 'finish'

export interface RaceEvent {
  id: number
  type: RaceEventType
}

export interface VehicleState {
  id: string
  role: VehicleRole
  carId: CarId
  lane: RaceLane
  targetLane: RaceLane
  x: number
  lateralVelocity: number
  distance: number
  speed: number
  desiredSpeed: number
  durability: number
  maxDurability: number
  mass: number
  yaw: number
  yawVelocity: number
  airborneHeight: number
  verticalSpeed: number
  stuntAngle: number
  driftActive: boolean
  driftMs: number
  boost: number
  boosting: boolean
  collisionCooldownMs: number
  fireCooldownMs: number
  lastObstacleIndex: number
  lastRampIndex: number
}

export interface ProjectileState {
  id: number
  owner: 'player' | 'enemy'
  x: number
  lateralVelocity: number
  distance: number
  speed: number
  damage: number
  ttlMs: number
}

export type RaceEffectType =
  | 'muzzle'
  | 'spark'
  | 'smoke'
  | 'debris'
  | 'impact'
  | 'landing'
  | 'nitro'
  | 'explosion'

export interface RaceEffect {
  id: number
  type: RaceEffectType
  x: number
  distance: number
  ttlMs: number
  intensity: number
}

export interface RaceState {
  stage: number
  mode: RacingStageConfig['mode']
  status: RaceStatus
  reason: 'running' | 'finished' | 'escaped' | 'destroyed' | 'timeout'
  elapsedMs: number
  player: VehicleState
  vehicles: VehicleState[]
  projectiles: ProjectileState[]
  effects: RaceEffect[]
  targetHp: number
  maxTargetHp: number
  nextEnemyFireMs: number
  shotsFired: number
  hits: number
  collisions: number
  slipstream: boolean
  steerLatch: boolean
  steerHoldMs: number
  event: RaceEvent | null
  nextEntityId: number
}

export interface RaceInput {
  steer?: -1 | 0 | 1
  laneDelta?: -1 | 0 | 1
  boost?: boolean
  fire?: boolean
}

export interface RaceLoadout {
  carId: CarId
  gunId: GunId | null
}

export interface TrackFeature {
  kind: 'obstacle' | 'ramp'
  index: number
  lane: RaceLane
  distance: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function lane(value: number): RaceLane {
  return clamp(value, 0, 2) as RaceLane
}

function obstacleLane(stage: number, index: number): RaceLane {
  return ((stage + index * 2) % 3) as RaceLane
}

function rampDistance(stage: RacingStageConfig, index: number): number {
  return 220 + stage.order * 9 + (index - 1) * 330
}

function rampLane(stage: number, index: number): RaceLane {
  return ((stage * 2 + index) % 3) as RaceLane
}

function withEvent(state: RaceState, type: RaceEventType): RaceState {
  return {
    ...state,
    event: { id: (state.event?.id ?? 0) + 1, type },
  }
}

function vehicle(
  id: string,
  role: VehicleRole,
  carId: CarId,
  startLane: RaceLane,
  distance: number,
  speed: number,
  durabilityOverride?: number,
): VehicleState {
  const car = equipmentConfig.cars[carId].racing
  const durability = durabilityOverride ?? car.durability
  return {
    id,
    role,
    carId,
    lane: startLane,
    targetLane: startLane,
    x: RACE_LANE_X[startLane],
    lateralVelocity: 0,
    distance,
    speed,
    desiredSpeed: speed,
    durability,
    maxDurability: durability,
    mass: car.mass,
    yaw: 0,
    yawVelocity: 0,
    airborneHeight: 0,
    verticalSpeed: 0,
    stuntAngle: 0,
    driftActive: false,
    driftMs: 0,
    boost: 100,
    boosting: false,
    collisionCooldownMs: 0,
    fireCooldownMs: 0,
    lastObstacleIndex: 0,
    lastRampIndex: 0,
  }
}

function pursuitVehicles(stage: PursuitStageConfig): VehicleState[] {
  const targetCar = CAR_IDS[Math.min(4, Math.floor(stage.order / 2))]
  const firstEscortCar = CAR_IDS[Math.min(4, Math.floor(stage.order / 2) - 1)]
  const secondEscortCar = CAR_IDS[Math.min(4, Math.floor(stage.order / 2))]
  return [
    vehicle(
      'target',
      'target',
      targetCar,
      ((stage.order - 1) % 3) as RaceLane,
      38,
      stage.targetSpeed,
      stage.targetHp,
    ),
    vehicle(
      'escort-1',
      'escort',
      firstEscortCar,
      (stage.order % 3) as RaceLane,
      25,
      stage.targetSpeed - 0.8,
      Math.round(stage.targetHp * 0.12),
    ),
    vehicle(
      'escort-2',
      'escort',
      secondEscortCar,
      ((stage.order + 1) % 3) as RaceLane,
      31,
      stage.targetSpeed + 0.5,
      Math.round(stage.targetHp * 0.14),
    ),
  ]
}

export function createRaceState(
  stageNumber: number,
  loadout: RaceLoadout,
): RaceState {
  const stage = getRacingStage(stageNumber)
  const playerCar = equipmentConfig.cars[loadout.carId].racing
  if (stage.mode === 'pursuit' && loadout.gunId === null) {
    throw new Error('Pursuit stage requires a gun')
  }
  const player = vehicle(
    'player',
    'player',
    loadout.carId,
    1,
    0,
    Math.min(14, playerCar.maxSpeed),
  )
  const vehicles =
    stage.mode === 'race'
      ? stage.opponentSpeeds.map((speed, index) =>
          vehicle(
            `racer-${index + 1}`,
            'racer',
            CAR_IDS[(stage.order + index) % CAR_IDS.length],
            ((stage.order + index) % 3) as RaceLane,
            7 + index * 7,
            speed,
          ),
        )
      : pursuitVehicles(stage)
  const target =
    stage.mode === 'pursuit'
      ? vehicles.find((candidate) => candidate.role === 'target')
      : undefined
  return {
    stage: stageNumber,
    mode: stage.mode,
    status: 'running',
    reason: 'running',
    elapsedMs: 0,
    player,
    vehicles,
    projectiles: [],
    effects: [],
    targetHp: target?.durability ?? 0,
    maxTargetHp: target?.maxDurability ?? 0,
    nextEnemyFireMs: 1800,
    shotsFired: 0,
    hits: 0,
    collisions: 0,
    slipstream: false,
    steerLatch: false,
    steerHoldMs: 0,
    event: null,
    nextEntityId: 1,
  }
}

function addEffect(
  state: RaceState,
  type: RaceEffectType,
  x: number,
  distance: number,
  intensity = 1,
  ttlMs = 500,
): RaceState {
  return {
    ...state,
    nextEntityId: state.nextEntityId + 1,
    effects: [
      ...state.effects,
      {
        id: state.nextEntityId,
        type,
        x,
        distance,
        intensity,
        ttlMs,
      },
    ],
  }
}

function updatePlayerControl(
  state: RaceState,
  input: RaceInput,
  carId: CarId,
  dtMs: number,
): RaceState {
  const player = { ...state.player }
  const car = equipmentConfig.cars[carId].racing
  const steer = input.steer ?? input.laneDelta ?? 0
  let next = { ...state, player }

  if (steer !== 0) {
    if (player.airborneHeight > 0) {
      player.stuntAngle += steer * 4.9 * (dtMs / 1000)
    } else if (!state.steerLatch) {
      player.targetLane = lane(player.targetLane + steer)
      next.steerLatch = true
      next = withEvent(next, 'lane')
    }
    next.steerHoldMs = state.steerHoldMs + dtMs
    player.driftActive =
      player.airborneHeight <= 0 &&
      next.steerHoldMs >= 220 &&
      player.speed >= 16
    if (player.driftActive) {
      player.driftMs += dtMs
      player.boost = Math.min(
        100,
        player.boost + car.driftNitroRate * (dtMs / 1000),
      )
      if (!state.player.driftActive) next = withEvent(next, 'drift')
    }
  } else {
    next.steerLatch = false
    next.steerHoldMs = 0
    player.driftActive = false
  }

  player.boosting = Boolean(input.boost && player.boost > 0)
  if (player.boosting) {
    player.boost = Math.max(0, player.boost - 25 * (dtMs / 1000))
    if (!state.player.boosting) next = withEvent(next, 'boost')
  } else if (!player.driftActive) {
    player.boost = Math.min(100, player.boost + 7 * (dtMs / 1000))
  }
  player.desiredSpeed =
    car.maxSpeed * (player.boosting ? 1.24 : player.driftActive ? 0.94 : 1)
  return next
}

function updateAi(
  state: RaceState,
  stage: RacingStageConfig,
  dtMs: number,
): RaceState {
  const vehicles = state.vehicles.map((candidate, index) => {
    const vehicleState = { ...candidate }
    const car = equipmentConfig.cars[vehicleState.carId].racing
    const phase = Math.floor(
      (state.elapsedMs + index * 870) / (2300 + index * 420),
    )
    if (stage.mode === 'race') {
      const gap = state.player.distance - vehicleState.distance
      const configured = stage.opponentSpeeds[index] ?? car.maxSpeed * 0.82
      const packSpeed = Math.max(configured, car.maxSpeed * 0.82)
      vehicleState.desiredSpeed = packSpeed + clamp(gap * 0.075, -3.5, 4.5)
      vehicleState.boosting = phase % 5 === 3 && vehicleState.boost > 12
      if (vehicleState.boosting) {
        vehicleState.desiredSpeed *= 1.16
        vehicleState.boost = Math.max(
          0,
          vehicleState.boost - 19 * (dtMs / 1000),
        )
      } else {
        vehicleState.boost = Math.min(
          100,
          vehicleState.boost + 8 * (dtMs / 1000),
        )
      }
      const closeBehind =
        gap > 0 && gap < 18 && Math.abs(vehicleState.x - state.player.x) < 3.8
      vehicleState.targetLane = closeBehind
        ? state.player.targetLane
        : (((phase + index + stage.order) % 3) as RaceLane)
    } else {
      const target = state.vehicles.find(
        (candidateVehicle) => candidateVehicle.role === 'target',
      )
      const baseSpeed = stage.targetSpeed
      if (vehicleState.role === 'target') {
        vehicleState.desiredSpeed =
          baseSpeed +
          clamp(
            (state.player.distance - vehicleState.distance + 25) * 0.06,
            0,
            3,
          )
        vehicleState.targetLane = ((phase + stage.order) % 3) as RaceLane
      } else if (target) {
        const escortIndex = vehicleState.id === 'escort-1' ? 0 : 1
        const wantedDistance = target.distance - 8 - escortIndex * 7
        vehicleState.desiredSpeed =
          baseSpeed +
          clamp((wantedDistance - vehicleState.distance) * 0.3, -4, 4)
        const blockPlayer =
          state.player.distance < target.distance &&
          target.distance - state.player.distance < 34
        vehicleState.targetLane = blockPlayer
          ? state.player.targetLane
          : lane(target.targetLane + (escortIndex === 0 ? -1 : 1))
      }
    }
    vehicleState.driftActive =
      vehicleState.airborneHeight <= 0 &&
      Math.abs(RACE_LANE_X[vehicleState.targetLane] - vehicleState.x) > 1.1 &&
      vehicleState.speed > 19
    return vehicleState
  })
  return { ...state, vehicles }
}

function integrateVehicle(source: VehicleState, dtMs: number): VehicleState {
  const next = { ...source }
  const dt = dtMs / 1000
  const car = equipmentConfig.cars[next.carId].racing
  const acceleration = car.acceleration * (next.boosting ? 1.35 : 1)
  if (next.speed < next.desiredSpeed) {
    next.speed = Math.min(next.desiredSpeed, next.speed + acceleration * dt)
  } else {
    next.speed = Math.max(
      next.desiredSpeed,
      next.speed - acceleration * 0.72 * dt,
    )
  }
  const targetX = RACE_LANE_X[next.targetLane]
  const spring = next.driftActive ? 5.2 : 12.5 * car.grip
  const damping = next.driftActive ? 2.1 : 6.4
  next.lateralVelocity +=
    ((targetX - next.x) * spring - next.lateralVelocity * damping) * dt
  next.x += next.lateralVelocity * dt
  if (Math.abs(next.x) > 4.65) {
    next.x = clamp(next.x, -4.65, 4.65)
    next.lateralVelocity *= -0.32
    next.speed *= 0.88
  }
  next.distance += Math.max(0, next.speed) * dt
  next.yawVelocity +=
    (-next.lateralVelocity * 0.065 - next.yaw - next.yawVelocity * 2.8) * dt
  next.yaw += next.yawVelocity * dt
  if (next.driftActive) {
    next.yaw = clamp(
      next.yaw - Math.sign(next.lateralVelocity || 1) * 0.015,
      -0.42,
      0.42,
    )
  }
  if (next.airborneHeight > 0 || next.verticalSpeed > 0) {
    next.verticalSpeed -= 18.5 * dt
    next.airborneHeight = Math.max(
      0,
      next.airborneHeight + next.verticalSpeed * dt,
    )
    if (next.airborneHeight <= 0 && next.verticalSpeed < 0) {
      next.airborneHeight = 0
      next.verticalSpeed = 0
    }
  }
  next.collisionCooldownMs = Math.max(0, next.collisionCooldownMs - dtMs)
  next.fireCooldownMs = Math.max(0, next.fireCooldownMs - dtMs)
  return next
}

function processTrackForVehicle(
  state: RaceState,
  source: VehicleState,
  previous: VehicleState,
  stage: RacingStageConfig,
): { state: RaceState; vehicle: VehicleState } {
  const vehicleState = { ...source }
  let nextState = state
  const obstacleIndex = Math.floor(vehicleState.distance / stage.obstacleEvery)
  if (obstacleIndex > vehicleState.lastObstacleIndex) {
    for (
      let index = vehicleState.lastObstacleIndex + 1;
      index <= obstacleIndex;
      index += 1
    ) {
      const distance = index * stage.obstacleEvery
      if (
        distance > previous.distance &&
        obstacleLane(stage.order, index) === vehicleState.targetLane &&
        vehicleState.airborneHeight < 0.45
      ) {
        vehicleState.speed = Math.max(7, vehicleState.speed * 0.58)
        vehicleState.durability = Math.max(
          0,
          vehicleState.durability - (vehicleState.role === 'player' ? 13 : 8),
        )
        vehicleState.yawVelocity += index % 2 === 0 ? 0.9 : -0.9
        nextState = addEffect(
          nextState,
          'debris',
          vehicleState.x,
          vehicleState.distance,
          1.2,
          650,
        )
        if (vehicleState.role === 'player') {
          nextState = withEvent(
            { ...nextState, collisions: nextState.collisions + 1 },
            'collision',
          )
        }
      }
    }
    vehicleState.lastObstacleIndex = obstacleIndex
  }

  const currentRampIndex =
    Math.floor(
      Math.max(0, vehicleState.distance - (220 + stage.order * 9)) / 330,
    ) + 1
  const nextRampAt = rampDistance(stage, currentRampIndex)
  if (
    currentRampIndex > vehicleState.lastRampIndex &&
    previous.distance < nextRampAt &&
    vehicleState.distance >= nextRampAt
  ) {
    if (
      rampLane(stage.order, currentRampIndex) === vehicleState.targetLane &&
      vehicleState.speed >= 15
    ) {
      vehicleState.airborneHeight = 0.06
      vehicleState.verticalSpeed = 7.2 + vehicleState.speed * 0.105
      nextState = addEffect(
        nextState,
        'smoke',
        vehicleState.x,
        vehicleState.distance,
        1.3,
        700,
      )
      if (vehicleState.role === 'player') {
        nextState = withEvent(nextState, 'ramp')
      }
    }
    vehicleState.lastRampIndex = currentRampIndex
  }
  return { state: nextState, vehicle: vehicleState }
}

function processLanding(
  state: RaceState,
  previous: VehicleState,
  current: VehicleState,
): { state: RaceState; player: VehicleState } {
  if (previous.airborneHeight <= 0 || current.airborneHeight > 0) {
    return { state, player: current }
  }
  const player = { ...current }
  const rotations = player.stuntAngle / (Math.PI * 2)
  const landingError = Math.abs(rotations - Math.round(rotations))
  let next = addEffect(
    state,
    'landing',
    player.x,
    player.distance,
    landingError < 0.18 ? 1.4 : 2,
    750,
  )
  if (landingError < 0.18 && Math.abs(rotations) >= 0.65) {
    player.boost = Math.min(100, player.boost + 28)
    player.speed *= 1.08
    next = withEvent(next, 'stunt')
  } else if (landingError >= 0.18) {
    player.speed *= 0.68
    player.durability = Math.max(0, player.durability - 14)
    player.yawVelocity += rotations >= 0 ? 1.2 : -1.2
    next = withEvent(next, 'collision')
  } else {
    next = withEvent(next, 'land')
  }
  player.stuntAngle = 0
  return { state: next, player }
}

function resolveVehicleCollisions(state: RaceState): RaceState {
  const all = [state.player, ...state.vehicles].map((candidate) => ({
    ...candidate,
  }))
  let next = state
  for (let leftIndex = 0; leftIndex < all.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < all.length;
      rightIndex += 1
    ) {
      const a = all[leftIndex]
      const b = all[rightIndex]
      if (
        a.durability <= 0 ||
        b.durability <= 0 ||
        a.airborneHeight > 0.7 ||
        b.airborneHeight > 0.7 ||
        a.collisionCooldownMs > 0 ||
        b.collisionCooldownMs > 0 ||
        Math.abs(a.x - b.x) >= 1.9 ||
        Math.abs(a.distance - b.distance) >= 3.25
      ) {
        continue
      }
      const rear = a.distance <= b.distance ? a : b
      const front = rear === a ? b : a
      const relativeSpeed = Math.max(0, rear.speed - front.speed)
      const restitution = 0.22
      if (relativeSpeed > 0.35) {
        const rearSpeed =
          (rear.mass * rear.speed +
            front.mass * front.speed -
            front.mass * restitution * (rear.speed - front.speed)) /
          (rear.mass + front.mass)
        const frontSpeed =
          (rear.mass * rear.speed +
            front.mass * front.speed +
            rear.mass * restitution * (rear.speed - front.speed)) /
          (rear.mass + front.mass)
        rear.speed = Math.max(5, rearSpeed)
        front.speed = Math.max(front.speed, frontSpeed)
        rear.distance = Math.min(rear.distance, front.distance - 3.2)
      } else {
        const separation = (3.25 - Math.abs(a.distance - b.distance)) * 0.5
        rear.distance -= separation
        front.distance += separation
      }
      const side = Math.sign(a.x - b.x) || (leftIndex % 2 === 0 ? 1 : -1)
      const sideImpulse = 2.4 + relativeSpeed * 0.13
      a.lateralVelocity += side * sideImpulse
      b.lateralVelocity -= side * sideImpulse
      a.yawVelocity += side * 0.75
      b.yawVelocity -= side * 0.75
      const smashBonus = rear.boosting ? 4 : 0
      const damage = Math.max(1, Math.round(relativeSpeed * 0.35 + smashBonus))
      const rearDamage = rear.boosting
        ? Math.max(1, Math.ceil(damage * 0.35))
        : damage
      rear.durability = Math.max(0, rear.durability - rearDamage)
      front.durability = Math.max(0, front.durability - damage)
      a.collisionCooldownMs = 260
      b.collisionCooldownMs = 260
      next = addEffect(
        next,
        'spark',
        (a.x + b.x) * 0.5,
        (a.distance + b.distance) * 0.5,
        1 + relativeSpeed * 0.08,
        500,
      )
      if (a.role === 'player' || b.role === 'player') {
        next = withEvent(
          { ...next, collisions: next.collisions + 1 },
          'collision',
        )
      }
    }
  }
  return {
    ...next,
    player: all[0],
    vehicles: all.slice(1),
  }
}

function spawnProjectile(
  state: RaceState,
  owner: ProjectileState['owner'],
  origin: VehicleState,
  target: VehicleState | undefined,
  speed: number,
  damage: number,
): RaceState {
  const gap = target ? Math.abs(target.distance - origin.distance) : 30
  const travelTime = Math.max(0.2, gap / Math.max(1, Math.abs(speed)))
  const lateralVelocity = target ? (target.x - origin.x) / travelTime : 0
  return {
    ...state,
    nextEntityId: state.nextEntityId + 1,
    projectiles: [
      ...state.projectiles,
      {
        id: state.nextEntityId,
        owner,
        x: origin.x,
        lateralVelocity,
        distance: origin.distance + (owner === 'player' ? 2.1 : -2.1),
        speed: owner === 'player' ? Math.abs(speed) : -Math.abs(speed),
        damage,
        ttlMs: 1800,
      },
    ],
  }
}

function processPlayerFire(
  state: RaceState,
  input: RaceInput,
  loadout: RaceLoadout,
): RaceState {
  if (state.mode !== 'pursuit' || !input.fire || !loadout.gunId) return state
  if (state.player.fireCooldownMs > 0) return state
  const gun = equipmentConfig.guns[loadout.gunId].pursuit
  const candidates = state.vehicles
    .filter(
      (candidate) =>
        candidate.durability > 0 &&
        candidate.distance > state.player.distance - 2 &&
        candidate.distance - state.player.distance <= gun.range &&
        Math.abs(candidate.x - state.player.x) < 1.65,
    )
    .sort((a, b) => a.distance - b.distance)
  const player = {
    ...state.player,
    fireCooldownMs: gun.cooldownMs,
    speed: Math.max(5, state.player.speed - gun.damage / 420),
  }
  let next = spawnProjectile(
    { ...state, player, shotsFired: state.shotsFired + 1 },
    'player',
    player,
    candidates[0],
    gun.projectileSpeed + player.speed * 0.3,
    gun.damage,
  )
  next = addEffect(next, 'muzzle', player.x, player.distance + 2, 1.2, 180)
  return withEvent(next, 'shot')
}

function processEnemyFire(
  state: RaceState,
  stage: PursuitStageConfig,
): RaceState {
  if (state.elapsedMs < state.nextEnemyFireMs) return state
  const shooters = state.vehicles
    .filter(
      (candidate) =>
        candidate.durability > 0 &&
        candidate.distance > state.player.distance &&
        candidate.distance - state.player.distance < 52 &&
        Math.abs(candidate.x - state.player.x) < 1.75,
    )
    .sort((a, b) => a.distance - b.distance)
  let next = {
    ...state,
    nextEnemyFireMs: state.nextEnemyFireMs + 1350 + ((state.stage * 137) % 550),
  }
  if (shooters.length === 0) return next
  const shooter = shooters[0]
  next = spawnProjectile(
    next,
    'enemy',
    shooter,
    state.player,
    38 + shooter.speed * 0.25,
    stage.incomingDamage,
  )
  return addEffect(next, 'muzzle', shooter.x, shooter.distance - 2, 1, 180)
}

function processProjectiles(state: RaceState, dtMs: number): RaceState {
  const dt = dtMs / 1000
  const vehicles = state.vehicles.map((candidate) => ({ ...candidate }))
  const player = { ...state.player }
  let next = state
  const remaining: ProjectileState[] = []
  for (const source of state.projectiles) {
    const projectile = {
      ...source,
      x: source.x + source.lateralVelocity * dt,
      distance: source.distance + source.speed * dt,
      ttlMs: source.ttlMs - dtMs,
    }
    let hit = false
    if (projectile.owner === 'player') {
      const target = vehicles
        .filter((candidate) => candidate.durability > 0)
        .sort((a, b) => a.distance - b.distance)
        .find(
          (candidate) =>
            Math.abs(candidate.distance - projectile.distance) < 2.7 &&
            Math.abs(candidate.x - projectile.x) < 1.7,
        )
      if (target) {
        target.durability = Math.max(0, target.durability - projectile.damage)
        target.speed += (projectile.damage / target.mass) * 28
        target.lateralVelocity +=
          Math.sign(target.x - player.x || 1) *
          (projectile.damage / target.mass) *
          18
        target.yawVelocity +=
          Math.sign(target.x - player.x || 1) * projectile.damage * 0.003
        next = addEffect(
          next,
          target.durability <= 0 ? 'explosion' : 'impact',
          target.x,
          target.distance,
          clamp(projectile.damage / 24, 0.8, 3),
          target.durability <= 0 ? 1100 : 450,
        )
        next = withEvent(
          { ...next, hits: next.hits + 1 },
          target.durability <= 0 ? 'destroyed' : 'hit',
        )
        hit = true
      }
    } else if (
      Math.abs(player.distance - projectile.distance) < 2.2 &&
      Math.abs(player.x - projectile.x) < 1.35
    ) {
      player.durability = Math.max(0, player.durability - projectile.damage)
      player.speed = Math.max(5, player.speed - projectile.damage * 0.08)
      player.yawVelocity +=
        Math.sign(player.x - projectile.x || 1) * projectile.damage * 0.02
      next = addEffect(next, 'impact', player.x, player.distance, 1.1, 420)
      next = withEvent(next, 'incoming')
      hit = true
    }
    if (!hit && projectile.ttlMs > 0) remaining.push(projectile)
  }
  const target = vehicles.find((candidate) => candidate.role === 'target')
  return {
    ...next,
    player,
    vehicles,
    projectiles: remaining,
    targetHp: target?.durability ?? 0,
  }
}

function resolveFinish(state: RaceState, stage: RacingStageConfig): RaceState {
  if (state.player.durability <= 0) {
    return withEvent(
      {
        ...state,
        status: 'defeat',
        reason: 'destroyed',
        player: { ...state.player, durability: 0 },
      },
      'finish',
    )
  }
  if (stage.mode === 'race') {
    if (state.player.distance >= stage.distance) {
      return withEvent(
        {
          ...state,
          status: raceRank(state) === 1 ? 'victory' : 'defeat',
          reason: 'finished',
        },
        'finish',
      )
    }
    if (
      state.vehicles.some(
        (candidate) =>
          candidate.role === 'racer' && candidate.distance >= stage.distance,
      )
    ) {
      return withEvent(
        { ...state, status: 'defeat', reason: 'finished' },
        'finish',
      )
    }
  } else {
    const target = state.vehicles.find(
      (candidate) => candidate.role === 'target',
    )
    if (!target || target.durability <= 0) {
      return withEvent(
        { ...state, targetHp: 0, status: 'victory', reason: 'finished' },
        'finish',
      )
    }
    if (target.distance >= stage.distance) {
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
  const dtMs = clamp(deltaMs, 1, 250)
  let next: RaceState = {
    ...current,
    elapsedMs: current.elapsedMs + dtMs,
    effects: current.effects
      .map((effect) => ({ ...effect, ttlMs: effect.ttlMs - dtMs }))
      .filter((effect) => effect.ttlMs > 0),
  }
  next = updatePlayerControl(next, input, loadout.carId, dtMs)
  next = updateAi(next, stage, dtMs)
  const slipstream = next.vehicles.some((candidate) => {
    const gap = candidate.distance - next.player.distance
    return (
      candidate.durability > 0 &&
      gap >= 4 &&
      gap <= 19 &&
      Math.abs(candidate.x - next.player.x) <= 1.45
    )
  })
  if (slipstream) {
    next = {
      ...next,
      slipstream: true,
      player: {
        ...next.player,
        desiredSpeed: next.player.desiredSpeed + 2.6,
        boost: Math.min(100, next.player.boost + 4 * (dtMs / 1000)),
      },
    }
  } else if (next.slipstream) {
    next = { ...next, slipstream: false }
  }
  if (stage.mode === 'pursuit') {
    const target = next.vehicles.find(
      (candidate) => candidate.role === 'target',
    )
    if (target) {
      const gap = target.distance - next.player.distance
      if (gap < 30) {
        next = {
          ...next,
          player: {
            ...next.player,
            desiredSpeed: Math.min(
              next.player.desiredSpeed,
              Math.max(8, target.speed + clamp((gap - 12) * 0.42, -6, 5)),
            ),
          },
        }
      }
    }
  }

  const previousPlayer = next.player
  const integratedPlayer = integrateVehicle(next.player, dtMs)
  let trackResult = processTrackForVehicle(
    next,
    integratedPlayer,
    previousPlayer,
    stage,
  )
  next = trackResult.state
  const player = trackResult.vehicle
  const vehicles: VehicleState[] = []
  for (const candidate of next.vehicles) {
    const previous = candidate
    const integrated = integrateVehicle(candidate, dtMs)
    trackResult = processTrackForVehicle(next, integrated, previous, stage)
    next = trackResult.state
    vehicles.push(trackResult.vehicle)
  }
  next = { ...next, player, vehicles }
  const landing = processLanding(next, previousPlayer, player)
  next = { ...landing.state, player: landing.player }
  next = resolveVehicleCollisions(next)
  next = processPlayerFire(next, input, loadout)
  if (stage.mode === 'pursuit') {
    next = processEnemyFire(next, stage)
  }
  next = processProjectiles(next, dtMs)
  return resolveFinish(next, stage)
}

export function upcomingTrackFeatures(
  state: RaceState,
  aheadDistance = 135,
): TrackFeature[] {
  const stage = getRacingStage(state.stage)
  const from = state.player.distance - 5
  const to = state.player.distance + aheadDistance
  const features: TrackFeature[] = []
  const firstObstacle = Math.max(1, Math.floor(from / stage.obstacleEvery))
  for (let index = firstObstacle; index <= firstObstacle + 3; index += 1) {
    const distance = index * stage.obstacleEvery
    if (distance >= from && distance <= to) {
      features.push({
        kind: 'obstacle',
        index,
        lane: obstacleLane(stage.order, index),
        distance,
      })
    }
  }
  const firstRamp = Math.max(
    1,
    Math.floor((from - (220 + stage.order * 9)) / 330) + 1,
  )
  for (let index = firstRamp; index <= firstRamp + 2; index += 1) {
    const distance = rampDistance(stage, index)
    if (distance >= from && distance <= to) {
      features.push({
        kind: 'ramp',
        index,
        lane: rampLane(stage.order, index),
        distance,
      })
    }
  }
  return features.sort((a, b) => a.distance - b.distance)
}

export function nextObstacle(state: RaceState): {
  distance: number
  lane: RaceLane
} {
  const stage = getRacingStage(state.stage)
  const index = Math.floor(state.player.distance / stage.obstacleEvery) + 1
  return {
    distance: index * stage.obstacleEvery,
    lane: obstacleLane(stage.order, index),
  }
}

export function raceProgress(state: RaceState): number {
  const stage = getRacingStage(state.stage)
  return clamp(state.player.distance / stage.distance, 0, 1)
}

export function raceRank(state: RaceState): number {
  if (state.mode !== 'race') return 1
  return (
    1 +
    state.vehicles.filter(
      (candidate) =>
        candidate.role === 'racer' &&
        candidate.distance > state.player.distance,
    ).length
  )
}

export function targetVehicle(state: RaceState): VehicleState | undefined {
  return state.vehicles.find((candidate) => candidate.role === 'target')
}
