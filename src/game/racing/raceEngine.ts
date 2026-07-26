import { equipmentConfig } from '../../config/equipmentConfig'
import {
  getRacingStage,
  type PursuitStageConfig,
  type RacingStageConfig,
} from '../../config/racingConfig'
import { CAR_IDS, type CarId, type GunId } from '../equipmentTypes'
import {
  getGunPursuitDamage,
  type CarRacingUpgradeBonus,
} from '../equipmentProgression'

export const RACE_TICK_MS = 50
export const RACE_FINISH_GRACE_DISTANCE = 4
export const AIR_GRAVITY = 12.4
export const NATURAL_NITRO_PER_SECOND = 3.5
export const NITRO_MAX = 100
export const NITRO_CELL = NITRO_MAX / 3
export const NITRO_BOOST_DURATION_MS = 1800
export const NITRO_SUPER_DURATION_MS = 3200
export const NITRO_DOUBLE_TAP_WINDOW_MS = 280
export const NITRO_SUPER_LAUNCH_SPEED = 18
export const CATCHUP_NITRO_GAP_START = 4
export const CATCHUP_NITRO_BASE_PER_SECOND = 8
export const CATCHUP_NITRO_MAX_PER_SECOND = 30
export const AI_CATCHUP_NITRO_MULTIPLIER = 1.4
export const BAD_LANDING_ANGLE_THRESHOLD = 0.2
export const BAD_LANDING_SPEED_MULTIPLIER = 0.62
export const FIRE_BOOST_DURATION_MS = 2400
export const FIRE_BOOST_COOLDOWN_MS = 8000
export const PURSUIT_STUNT_FIRE_COOLDOWN_REDUCTION_MS = 2500
export const RACE_LANES = [0, 1, 2] as const
export const RACE_LANE_X = [-3.25, 0, 3.25] as const
export type RaceLane = (typeof RACE_LANES)[number]
export type RaceStatus = 'running' | 'victory' | 'defeat'
export type VehicleRole = 'player' | 'racer' | 'target' | 'escort'
export type RaceEventType =
  | 'lane'
  | 'boost'
  | 'super-boost'
  | 'drift'
  | 'collision'
  | 'ramp'
  | 'stunt'
  | 'land'
  | 'shot'
  | 'fire-boost'
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
  boostRemainingMs: number
  superBoosting: boolean
  collisionCooldownMs: number
  fireCooldownMs: number
  lastObstacleIndex: number
  lastRampIndex: number
  maxSpeedBonus: number
  accelerationBonus: number
  gripBonus: number
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
  | 'super-nitro'
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
  fireBoostRemainingMs: number
  fireBoostCooldownMs: number
  fireBoostLatch: boolean
  boostLatch: boolean
  boostTapPendingMs: number
  steerLatch: boolean
  steerHoldMs: number
  event: RaceEvent | null
  nextEntityId: number
}

export interface RaceInput {
  steer?: -1 | 0 | 1
  laneDelta?: -1 | 0 | 1
  boost?: boolean
  boostTaps?: number
  fire?: boolean
}

export interface RaceLoadout {
  carId: CarId
  gunId: GunId | null
  gunLevel?: number
  carUpgrade?: CarRacingUpgradeBonus
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
  carUpgrade?: CarRacingUpgradeBonus,
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
    boost: 0,
    boosting: false,
    boostRemainingMs: 0,
    superBoosting: false,
    collisionCooldownMs: 0,
    fireCooldownMs: 0,
    lastObstacleIndex: 0,
    lastRampIndex: 0,
    maxSpeedBonus: carUpgrade?.maxSpeed ?? 0,
    accelerationBonus: carUpgrade?.acceleration ?? 0,
    gripBonus: carUpgrade?.grip ?? 0,
  }
}

function pursuitVehicles(stage: PursuitStageConfig): VehicleState[] {
  const targetCar = CAR_IDS[Math.min(4, Math.floor(stage.order / 2))]
  const target = vehicle(
    'target',
    'target',
    targetCar,
    ((stage.order - 1) % 3) as RaceLane,
    38,
    stage.targetSpeed,
    stage.targetHp,
  )
  const escorts = Array.from({ length: stage.escortCount }, (_, index) => {
    const escortNumber = index + 1
    const carIndex = clamp(
      Math.floor(stage.order / 2) - 1 + (index % 3),
      0,
      CAR_IDS.length - 1,
    )
    return vehicle(
      `escort-${escortNumber}`,
      'escort',
      CAR_IDS[carIndex],
      ((stage.order + index) % 3) as RaceLane,
      18 + index * 5,
      stage.targetSpeed - 1.2 + (index % 3) * 0.7,
      Math.round(stage.targetHp * (0.045 + index * 0.005)),
    )
  })
  return [target, ...escorts]
}

export function createRaceState(
  stageNumber: number,
  loadout: RaceLoadout,
): RaceState {
  const stage = getRacingStage(stageNumber)
  const playerCar = equipmentConfig.cars[loadout.carId].racing
  const carUpgrade = loadout.carUpgrade ?? {
    maxSpeed: 0,
    acceleration: 0,
    durability: 0,
    grip: 0,
  }
  if (stage.mode === 'pursuit' && loadout.gunId === null) {
    throw new Error('Pursuit stage requires a gun')
  }
  const player = vehicle(
    'player',
    'player',
    loadout.carId,
    1,
    0,
    Math.min(22, playerCar.maxSpeed),
    playerCar.durability + carUpgrade.durability,
    carUpgrade,
  )
  const vehicles =
    stage.mode === 'race'
      ? Array.from({ length: stage.opponentSpeeds.length * 2 }, (_, index) =>
          vehicle(
            `racer-${index + 1}`,
            'racer',
            CAR_IDS[(stage.order + index) % CAR_IDS.length],
            ((stage.order + index) % 3) as RaceLane,
            6 + index * 5.5,
            stage.opponentSpeeds[index % stage.opponentSpeeds.length],
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
    nextEnemyFireMs: 900,
    shotsFired: 0,
    hits: 0,
    collisions: 0,
    slipstream: false,
    fireBoostRemainingMs: 0,
    fireBoostCooldownMs: 0,
    fireBoostLatch: false,
    boostLatch: false,
    boostTapPendingMs: 0,
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

function activateNitro(
  state: RaceState,
  source: VehicleState,
  superBoost: boolean,
): { state: RaceState; vehicle: VehicleState } {
  const vehicleState = {
    ...source,
    boost: superBoost ? 0 : Math.max(0, source.boost - NITRO_CELL),
    boosting: true,
    boostRemainingMs: superBoost
      ? NITRO_SUPER_DURATION_MS
      : NITRO_BOOST_DURATION_MS,
    superBoosting: superBoost,
    airborneHeight: superBoost
      ? Math.max(0.08, source.airborneHeight)
      : source.airborneHeight,
    verticalSpeed: superBoost
      ? Math.max(NITRO_SUPER_LAUNCH_SPEED, source.verticalSpeed)
      : source.verticalSpeed,
  }
  let next = addEffect(
    state,
    superBoost ? 'super-nitro' : 'nitro',
    source.x,
    source.distance,
    superBoost ? 3.2 : 1.8,
    superBoost ? 1200 : 700,
  )
  if (source.role === 'player') {
    next = withEvent(next, superBoost ? 'super-boost' : 'boost')
  }
  return { state: next, vehicle: vehicleState }
}

function updatePlayerControl(
  state: RaceState,
  input: RaceInput,
  carId: CarId,
  nitroEnabled: boolean,
  dtMs: number,
): RaceState {
  let player = {
    ...state.player,
    boostRemainingMs: Math.max(0, state.player.boostRemainingMs - dtMs),
  }
  if (player.boostRemainingMs <= 0) {
    player.boosting = false
    player.superBoosting = false
  }
  const car = equipmentConfig.cars[carId].racing
  const heldSteer = input.steer ?? 0
  const steer = heldSteer !== 0 ? heldSteer : (input.laneDelta ?? 0)
  const pendingBefore = state.boostTapPendingMs
  const pendingAfter = Math.max(0, pendingBefore - dtMs)
  const explicitTaps = clamp(Math.trunc(input.boostTaps ?? 0), 0, 2)
  const legacyTap = input.boost && !state.boostLatch ? 1 : 0
  const tapCount = Math.min(2, explicitTaps + legacyTap)
  let next = {
    ...state,
    player,
    boostLatch: nitroEnabled && Boolean(input.boost),
    boostTapPendingMs: nitroEnabled ? pendingAfter : 0,
  }

  if (!nitroEnabled) {
    player.boost = 0
    player.boosting = false
    player.boostRemainingMs = 0
    player.superBoosting = false
  }

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
      if (nitroEnabled && !player.boosting) {
        player.boost = Math.min(
          NITRO_MAX,
          player.boost + car.driftNitroRate * (dtMs / 1000),
        )
      }
      if (!state.player.driftActive) next = withEvent(next, 'drift')
    }
  } else {
    next.steerLatch = false
    next.steerHoldMs = 0
    player.driftActive = false
  }

  if (nitroEnabled && !player.boosting && !player.driftActive) {
    player.boost = Math.min(
      NITRO_MAX,
      player.boost + NATURAL_NITRO_PER_SECOND * (dtMs / 1000),
    )
  }

  if (nitroEnabled && !player.boosting) {
    const fullCharge = player.boost >= NITRO_MAX - 0.001
    const doubleTap =
      fullCharge && (tapCount >= 2 || (pendingBefore > 0 && tapCount >= 1))
    if (doubleTap) {
      const activated = activateNitro(next, player, true)
      next = { ...activated.state, boostTapPendingMs: 0 }
      player = activated.vehicle
    } else if (tapCount >= 1) {
      if (fullCharge) {
        next.boostTapPendingMs = NITRO_DOUBLE_TAP_WINDOW_MS
      } else if (player.boost >= NITRO_CELL) {
        const activated = activateNitro(next, player, false)
        next = { ...activated.state, boostTapPendingMs: 0 }
        player = activated.vehicle
      }
    } else if (pendingBefore > 0 && pendingAfter <= 0) {
      const activated = activateNitro(next, player, false)
      next = { ...activated.state, boostTapPendingMs: 0 }
      player = activated.vehicle
    }
  } else {
    next.boostTapPendingMs = 0
  }

  player.desiredSpeed =
    (car.maxSpeed + player.maxSpeedBonus) *
    (player.superBoosting
      ? 1.72
      : player.boosting
        ? 1.38
        : player.driftActive
          ? 0.94
          : 1)
  return { ...next, player }
}

function updateAi(
  state: RaceState,
  stage: RacingStageConfig,
  dtMs: number,
): RaceState {
  let next = state
  const vehicles: VehicleState[] = []
  const target =
    stage.mode === 'pursuit'
      ? state.vehicles.find(
          (candidateVehicle) => candidateVehicle.role === 'target',
        )
      : undefined
  const raceLeaderDistance =
    stage.mode === 'race'
      ? Math.max(
          state.player.distance,
          ...state.vehicles
            .filter((candidate) => candidate.role === 'racer')
            .map((candidate) => candidate.distance),
        )
      : 0

  for (const [index, candidate] of state.vehicles.entries()) {
    let vehicleState = {
      ...candidate,
      boostRemainingMs: Math.max(0, candidate.boostRemainingMs - dtMs),
    }
    if (vehicleState.boostRemainingMs <= 0) {
      vehicleState.boosting = false
      vehicleState.superBoosting = false
    }
    const car = equipmentConfig.cars[vehicleState.carId].racing
    const phase = Math.floor(
      (state.elapsedMs + index * 870) / (2300 + index * 420),
    )
    if (stage.mode === 'race') {
      const gap = raceLeaderDistance - vehicleState.distance
      const configured =
        stage.opponentSpeeds[index % stage.opponentSpeeds.length] ??
        car.maxSpeed * 0.82
      const packSpeed = configured * (1.1 + stage.order * 0.008)
      vehicleState.desiredSpeed = packSpeed + clamp(gap * 0.18, -2, 12)
      const closeBehind =
        state.player.distance - vehicleState.distance > 0 &&
        state.player.distance - vehicleState.distance < 18 &&
        Math.abs(vehicleState.x - state.player.x) < 3.8
      vehicleState.targetLane = closeBehind
        ? state.player.targetLane === 1
          ? index % 2 === 0
            ? 0
            : 2
          : 1
        : (((phase + index + stage.order) % 3) as RaceLane)
    } else {
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
        const escortIndex = Math.max(
          0,
          Number.parseInt(vehicleState.id.split('-')[1] ?? '1', 10) - 1,
        )
        const wantedDistance =
          target.distance - 8 - (escortIndex % 3) * 6 - escortIndex * 1.5
        vehicleState.desiredSpeed =
          baseSpeed +
          clamp((wantedDistance - vehicleState.distance) * 0.3, -4, 4)
        const blockPlayer =
          state.player.distance < target.distance &&
          target.distance - state.player.distance < 34
        vehicleState.targetLane = blockPlayer
          ? lane(state.player.targetLane + ((escortIndex % 3) - 1))
          : lane(target.targetLane + ((escortIndex % 3) - 1))
      }
    }
    vehicleState.driftActive =
      vehicleState.airborneHeight <= 0 &&
      Math.abs(RACE_LANE_X[vehicleState.targetLane] - vehicleState.x) > 1.1 &&
      vehicleState.speed > 19
    if (vehicleState.airborneHeight > 0) {
      const stuntDirection = (index + stage.order) % 2 === 0 ? 1 : -1
      vehicleState.stuntAngle += stuntDirection * 3.7 * (dtMs / 1000)
      vehicleState.driftActive = false
    } else {
      const nextRampIndex = Math.max(1, vehicleState.lastRampIndex + 1)
      const distanceToRamp =
        rampDistance(stage, nextRampIndex) - vehicleState.distance
      if (distanceToRamp > -4 && distanceToRamp < 82) {
        vehicleState.targetLane = rampLane(stage.order, nextRampIndex)
      } else {
        const nextObstacleIndex =
          Math.floor(vehicleState.distance / stage.obstacleEvery) + 1
        const distanceToObstacle =
          nextObstacleIndex * stage.obstacleEvery - vehicleState.distance
        const blockedLane = obstacleLane(stage.order, nextObstacleIndex)
        if (
          distanceToObstacle > 0 &&
          distanceToObstacle < 68 &&
          blockedLane === vehicleState.targetLane
        ) {
          vehicleState.targetLane =
            blockedLane === 0
              ? 1
              : blockedLane === 2
                ? 1
                : index % 2 === 0
                  ? 0
                  : 2
        }
      }
    }

    if (stage.mode === 'race' && !vehicleState.boosting) {
      const nitroRate = vehicleState.driftActive
        ? car.driftNitroRate
        : NATURAL_NITRO_PER_SECOND
      vehicleState.boost = Math.min(
        NITRO_MAX,
        vehicleState.boost + nitroRate * (dtMs / 1000),
      )
      const savesForSuper = index % 3 === 0
      const canSuper = vehicleState.boost >= NITRO_MAX - 0.001
      const canBoost = vehicleState.boost >= NITRO_CELL
      const trailingLeader = raceLeaderDistance - vehicleState.distance > 4
      if (savesForSuper && canSuper) {
        const activated = activateNitro(next, vehicleState, true)
        next = activated.state
        vehicleState = activated.vehicle
      } else if (
        !savesForSuper &&
        canBoost &&
        (trailingLeader || phase % 5 === 3)
      ) {
        const activated = activateNitro(next, vehicleState, false)
        next = activated.state
        vehicleState = activated.vehicle
      }
    }

    if (stage.mode === 'pursuit') {
      vehicleState.boost = 0
      vehicleState.boosting = false
      vehicleState.boostRemainingMs = 0
      vehicleState.superBoosting = false
    } else if (vehicleState.superBoosting) {
      vehicleState.desiredSpeed *= 1.65
    } else if (vehicleState.boosting) {
      vehicleState.desiredSpeed *= 1.3
    }
    vehicles.push(vehicleState)
  }
  return { ...next, vehicles }
}

function integrateVehicle(source: VehicleState, dtMs: number): VehicleState {
  const next = { ...source }
  const dt = dtMs / 1000
  const car = equipmentConfig.cars[next.carId].racing
  const acceleration =
    (car.acceleration + next.accelerationBonus) *
    (next.superBoosting ? 2.25 : next.boosting ? 1.65 : 1)
  if (next.speed < next.desiredSpeed) {
    next.speed = Math.min(next.desiredSpeed, next.speed + acceleration * dt)
  } else {
    next.speed = Math.max(
      next.desiredSpeed,
      next.speed - acceleration * 0.72 * dt,
    )
  }
  const targetX = RACE_LANE_X[next.targetLane]
  const spring = next.driftActive ? 5.2 : 12.5 * (car.grip + next.gripBonus)
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
    next.verticalSpeed -= AIR_GRAVITY * dt
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
): { state: RaceState; vehicle: VehicleState } {
  if (previous.airborneHeight <= 0 || current.airborneHeight > 0) {
    return { state, vehicle: current }
  }
  const landedVehicle = { ...current }
  const rotations = landedVehicle.stuntAngle / (Math.PI * 2)
  const landingError = Math.abs(rotations - Math.round(rotations))
  const cleanStunt =
    Math.abs(rotations) >= 0.65 && landingError < BAD_LANDING_ANGLE_THRESHOLD
  const badLanding = landingError >= BAD_LANDING_ANGLE_THRESHOLD
  let next = addEffect(
    state,
    'landing',
    landedVehicle.x,
    landedVehicle.distance,
    cleanStunt || !badLanding ? 1.4 : 2,
    750,
  )
  if (cleanStunt) {
    if (state.mode === 'race') {
      landedVehicle.boost = Math.min(NITRO_MAX, landedVehicle.boost + 45)
      landedVehicle.speed *= 1.1
    } else if (landedVehicle.role === 'player') {
      next = {
        ...next,
        fireBoostCooldownMs: Math.max(
          0,
          next.fireBoostCooldownMs - PURSUIT_STUNT_FIRE_COOLDOWN_REDUCTION_MS,
        ),
      }
    }
    if (landedVehicle.role === 'player') next = withEvent(next, 'stunt')
  } else if (badLanding) {
    landedVehicle.speed *= BAD_LANDING_SPEED_MULTIPLIER
    landedVehicle.yawVelocity += rotations >= 0 ? 1.2 : -1.2
    if (landedVehicle.role === 'player') {
      landedVehicle.durability = Math.max(0, landedVehicle.durability - 14)
      next = withEvent(next, 'collision')
    }
  } else if (landedVehicle.role === 'player') {
    next = withEvent(next, 'land')
  }
  landedVehicle.stuntAngle = 0
  return { state: next, vehicle: landedVehicle }
}

function catchupNitroRate(gap: number): number {
  if (gap <= CATCHUP_NITRO_GAP_START) return 0
  return clamp(
    CATCHUP_NITRO_BASE_PER_SECOND + (gap - CATCHUP_NITRO_GAP_START) * 0.65,
    0,
    CATCHUP_NITRO_MAX_PER_SECOND,
  )
}

function applyCatchupNitro(state: RaceState, dtMs: number): RaceState {
  if (state.mode !== 'race') return state
  const activeVehicles = [state.player, ...state.vehicles].filter(
    (vehicleState) => vehicleState.durability > 0,
  )
  const leaderDistance = Math.max(
    state.player.distance,
    ...activeVehicles.map((vehicleState) => vehicleState.distance),
  )
  const refill = (vehicleState: VehicleState): VehicleState => {
    if (vehicleState.boosting || vehicleState.durability <= 0) {
      return vehicleState
    }
    const rate =
      catchupNitroRate(leaderDistance - vehicleState.distance) *
      (vehicleState.role === 'racer' ? AI_CATCHUP_NITRO_MULTIPLIER : 0.65)
    if (rate <= 0) return vehicleState
    return {
      ...vehicleState,
      boost: Math.min(NITRO_MAX, vehicleState.boost + rate * (dtMs / 1000)),
    }
  }
  return {
    ...state,
    player: refill(state.player),
    vehicles: state.vehicles.map(refill),
  }
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

function updateFireBoost(
  state: RaceState,
  input: RaceInput,
  dtMs: number,
): RaceState {
  const released = !input.fire
  let next: RaceState = {
    ...state,
    fireBoostRemainingMs: Math.max(0, state.fireBoostRemainingMs - dtMs),
    fireBoostCooldownMs: Math.max(0, state.fireBoostCooldownMs - dtMs),
    fireBoostLatch: released ? false : state.fireBoostLatch,
  }
  if (
    state.mode !== 'pursuit' ||
    !input.fire ||
    state.fireBoostLatch ||
    state.fireBoostCooldownMs > 0
  ) {
    return next
  }
  next = {
    ...next,
    fireBoostRemainingMs: FIRE_BOOST_DURATION_MS,
    fireBoostCooldownMs: FIRE_BOOST_COOLDOWN_MS,
    fireBoostLatch: true,
  }
  next = addEffect(
    next,
    'nitro',
    state.player.x,
    state.player.distance,
    1.8,
    650,
  )
  return withEvent(next, 'fire-boost')
}

function processPlayerAutoFire(
  state: RaceState,
  loadout: RaceLoadout,
): RaceState {
  if (state.mode !== 'pursuit' || !loadout.gunId) return state
  if (state.player.fireCooldownMs > 0) return state
  const gun = equipmentConfig.guns[loadout.gunId].pursuit
  const upgradedDamage = getGunPursuitDamage(
    loadout.gunId,
    loadout.gunLevel ?? 0,
  )
  const fireBoosted = state.fireBoostRemainingMs > 0
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
    fireCooldownMs: Math.round(gun.cooldownMs * (fireBoosted ? 0.48 : 1)),
    speed: Math.max(
      5,
      state.player.speed - (upgradedDamage * (fireBoosted ? 1.25 : 1)) / 420,
    ),
  }
  const damage = Math.round(upgradedDamage * (fireBoosted ? 1.25 : 1))
  let next = spawnProjectile(
    { ...state, player, shotsFired: state.shotsFired + 1 },
    'player',
    player,
    candidates[0],
    gun.projectileSpeed + player.speed * 0.3,
    damage,
  )
  next = addEffect(
    next,
    'muzzle',
    player.x,
    player.distance + 2,
    fireBoosted ? 1.8 : 1.2,
    180,
  )
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
    nextEnemyFireMs: state.nextEnemyFireMs + 950 + ((state.stage * 97) % 360),
  }
  if (shooters.length === 0) return next
  const shooter = shooters[0]
  next = spawnProjectile(
    next,
    'enemy',
    shooter,
    state.player,
    38 + shooter.speed * 0.25,
    Math.max(1, Math.round(stage.incomingDamage * 0.36)),
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
          candidate.role === 'racer' &&
          candidate.distance >= stage.distance &&
          candidate.distance - state.player.distance >
            RACE_FINISH_GRACE_DISTANCE,
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
  if (stage.mode === 'pursuit' && state.elapsedMs >= stage.durationMs) {
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
  next = updateFireBoost(next, input, dtMs)
  next = updatePlayerControl(
    next,
    input,
    loadout.carId,
    stage.mode === 'race',
    dtMs,
  )
  next = updateAi(next, stage, dtMs)
  next = applyCatchupNitro(next, dtMs)
  const slipstream = next.vehicles.some((candidate) => {
    const gap = candidate.distance - next.player.distance
    return (
      candidate.durability > 0 &&
      gap >= 4 &&
      gap <= 19 &&
      Math.abs(candidate.x - next.player.x) <= 1.45
    )
  })
  if (stage.mode === 'race' && slipstream) {
    next = {
      ...next,
      slipstream: true,
      player: {
        ...next.player,
        desiredSpeed: next.player.desiredSpeed + 2.6,
        boost: next.player.boosting
          ? next.player.boost
          : Math.min(NITRO_MAX, next.player.boost + 2 * (dtMs / 1000)),
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
  let player = trackResult.vehicle
  let landing = processLanding(next, previousPlayer, player)
  next = landing.state
  player = landing.vehicle
  const vehicles: VehicleState[] = []
  for (const candidate of next.vehicles) {
    const previous = candidate
    const integrated = integrateVehicle(candidate, dtMs)
    trackResult = processTrackForVehicle(next, integrated, previous, stage)
    next = trackResult.state
    landing = processLanding(next, previous, trackResult.vehicle)
    next = landing.state
    vehicles.push(landing.vehicle)
  }
  next = { ...next, player, vehicles }
  next = resolveVehicleCollisions(next)
  next = processPlayerAutoFire(next, loadout)
  if (stage.mode === 'pursuit') {
    next = processEnemyFire(next, stage)
  }
  next = processProjectiles(next, dtMs)
  return resolveFinish(next, stage)
}

export function upcomingTrackFeatures(
  state: RaceState,
  aheadDistance = 175,
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
