import { describe, expect, it } from 'vitest'
import { getRacingStage } from '../../config/racingConfig'
import {
  AI_CATCHUP_NITRO_MULTIPLIER,
  AIR_GRAVITY,
  advanceRace,
  BAD_LANDING_SPEED_MULTIPLIER,
  CATCHUP_NITRO_MAX_PER_SECOND,
  createRaceState,
  FIRE_BOOST_COOLDOWN_MS,
  FIRE_BOOST_DURATION_MS,
  NATURAL_NITRO_PER_SECOND,
  NITRO_BOOST_DURATION_MS,
  NITRO_CELL,
  NITRO_DOUBLE_TAP_WINDOW_MS,
  NITRO_MAX,
  NITRO_SUPER_DURATION_MS,
  NITRO_SUPER_LAUNCH_SPEED,
  PURSUIT_SETTLEMENT_DELAY_MS,
  PURSUIT_STUNT_FIRE_COOLDOWN_REDUCTION_MS,
  RACE_CLEAR_MAX_RANK,
  RACE_LANE_X,
  RACE_SETTLEMENT_DELAY_MS,
  RACE_TICK_MS,
  raceRank,
  targetVehicle,
  upcomingTrackFeatures,
  type RaceInput,
  type RaceLoadout,
  type RaceState,
} from './raceEngine'

const STARTER: RaceLoadout = {
  carId: 'rust-fox',
  gunId: 'rivet-smg',
}
const ENDGAME: RaceLoadout = {
  carId: 'black-throne',
  gunId: 'president-cannon',
  carUpgrade: {
    maxSpeed: 3,
    acceleration: 2,
    durability: 10,
    grip: 0.04,
  },
}

function botInput(state: RaceState): RaceInput {
  const triggerFireBoost =
    state.mode === 'pursuit' &&
    state.fireBoostCooldownMs <= 0 &&
    !state.fireBoostLatch
  const nearbyObstacle = upcomingTrackFeatures(state).find(
    (feature) =>
      feature.kind === 'obstacle' &&
      feature.distance > state.player.distance &&
      feature.distance - state.player.distance < 13 &&
      feature.lane === state.player.targetLane,
  )
  const boostTaps =
    state.player.boosting || state.boostTapPendingMs > 0
      ? 0
      : state.player.boost >= NITRO_MAX - 0.001
        ? 2
        : state.player.boost >= NITRO_CELL
          ? 1
          : 0
  if (!state.steerLatch && nearbyObstacle) {
    return {
      laneDelta: state.player.targetLane === 0 ? 1 : -1,
      boostTaps,
      fire: triggerFireBoost,
    }
  }
  if (state.mode === 'pursuit' && !state.steerLatch) {
    const target = state.vehicles
      .filter(
        (vehicle) =>
          vehicle.durability > 0 &&
          vehicle.distance >= state.player.distance - 2,
      )
      .sort((left, right) => left.distance - right.distance)[0]
    if (target && Math.abs(target.x - state.player.x) > 1.1) {
      return {
        laneDelta: target.x < state.player.x ? -1 : 1,
        boostTaps,
        fire: triggerFireBoost,
      }
    }
  }
  return {
    laneDelta: 0,
    boostTaps,
    fire: triggerFireBoost,
  }
}

function finish(stage: number, loadout: RaceLoadout): RaceState {
  let state = createRaceState(stage, loadout)
  for (let tick = 0; tick < 2200 && state.status === 'running'; tick += 1) {
    state = advanceRace(state, botInput(state), loadout)
  }
  return state
}

describe('raceEngine V2', () => {
  it('spawns six racers, configured pursuit escorts, and zero starting nitro', () => {
    const race = createRaceState(1, STARTER)
    expect(
      race.vehicles.filter((vehicle) => vehicle.role === 'racer'),
    ).toHaveLength(6)
    const pursuit = createRaceState(2, STARTER)
    expect(
      [2, 4, 6, 8, 10].map(
        (stage) =>
          createRaceState(stage, STARTER).vehicles.filter(
            (vehicle) => vehicle.role === 'escort',
          ).length,
      ),
    ).toEqual([0, 1, 1, 2, 2])
    expect(
      [
        race.player,
        ...race.vehicles,
        pursuit.player,
        ...pursuit.vehicles,
      ].every((vehicle) => vehicle.boost === 0),
    ).toBe(true)
  })

  it('is deterministic for identical input streams', () => {
    const run = (): RaceState => {
      let state = createRaceState(1, STARTER)
      for (let tick = 0; tick < 120; tick += 1) {
        state = advanceRace(
          state,
          {
            boost: tick % 40 < 20,
            steer: tick >= 10 && tick < 18 ? -1 : 0,
          },
          STARTER,
        )
      }
      return state
    }
    expect(run()).toEqual(run())
  })

  it('transfers longitudinal speed during a rear-end collision', () => {
    const initial = createRaceState(1, ENDGAME)
    initial.player = {
      ...initial.player,
      x: 0,
      lane: 1,
      targetLane: 1,
      distance: 20,
      speed: 38,
      desiredSpeed: 38,
    }
    initial.vehicles[0] = {
      ...initial.vehicles[0],
      x: 0,
      lane: 1,
      targetLane: 1,
      distance: 22.7,
      speed: 14,
      desiredSpeed: 14,
    }
    initial.vehicles = initial.vehicles.map((vehicle, index) =>
      index === 0 ? vehicle : { ...vehicle, distance: 80 + index * 10 },
    )
    const playerDurability = initial.player.durability
    const opponentDurability = initial.vehicles[0].durability
    const next = advanceRace(initial, {}, ENDGAME, RACE_TICK_MS)
    expect(next.collisions).toBeGreaterThan(0)
    expect(next.player.speed).toBeLessThan(38)
    expect(next.vehicles[0].speed).toBeGreaterThan(14)
    expect(next.player.durability).toBe(playerDurability)
    expect(next.vehicles[0].durability).toBe(opponentDurability)
  })

  it('enters a physical drift after holding a lane direction', () => {
    let state = createRaceState(1, STARTER)
    state.player = { ...state.player, speed: 24, desiredSpeed: 24, boost: 30 }
    for (let tick = 0; tick < 7; tick += 1) {
      state = advanceRace(state, { steer: 1 }, STARTER)
    }
    expect(state.player.driftActive).toBe(true)
    expect(Math.abs(state.player.lateralVelocity)).toBeGreaterThan(0)
    expect(Math.abs(state.player.yaw)).toBeGreaterThan(0)
    expect(state.player.boost).toBeGreaterThan(30)
  })

  it('gains speed and nitro while drafting behind another car', () => {
    const initial = createRaceState(1, STARTER)
    initial.player = {
      ...initial.player,
      x: 0,
      lane: 1,
      targetLane: 1,
      speed: 20,
      boost: 20,
    }
    initial.vehicles[0] = {
      ...initial.vehicles[0],
      x: 0,
      lane: 1,
      targetLane: 1,
      distance: initial.player.distance + 12,
    }
    initial.vehicles = initial.vehicles.map((vehicle, index) =>
      index === 0 ? vehicle : { ...vehicle, distance: 80 + index * 10 },
    )
    const next = advanceRace(initial, {}, STARTER)
    expect(next.slipstream).toBe(true)
    expect(next.player.boost).toBeGreaterThan(20)
  })

  it('halves passive nitro income so stunts are the main refill', () => {
    const initial = createRaceState(1, STARTER)
    initial.player = { ...initial.player, boost: 0, distance: 100 }
    initial.vehicles = initial.vehicles.map((vehicle, index) => ({
      ...vehicle,
      x: index === 0 ? -3.25 : 3.25,
      distance: 20 + index * 10,
    }))
    const next = advanceRace(initial, {}, STARTER)
    expect(next.player.boost).toBeCloseTo(
      NATURAL_NITRO_PER_SECOND * (RACE_TICK_MS / 1000),
      5,
    )
  })

  it('gives increasingly strong nitro income to racers behind the leader', () => {
    const initial = createRaceState(1, STARTER)
    initial.player = { ...initial.player, distance: 100, boost: 0 }
    initial.vehicles = initial.vehicles.map((vehicle, index) => ({
      ...vehicle,
      distance: index === 1 ? 40 : 95,
      boost: 0,
    }))

    const next = advanceRace(initial, {}, STARTER, 250)
    expect(next.vehicles[1].boost).toBeGreaterThan(next.vehicles[0].boost)
    expect(next.vehicles[1].boost).toBeGreaterThanOrEqual(
      (NATURAL_NITRO_PER_SECOND +
        CATCHUP_NITRO_MAX_PER_SECOND * AI_CATCHUP_NITRO_MULTIPLIER -
        0.5) *
        0.25,
    )
    expect(next.vehicles[1].desiredSpeed).toBeGreaterThan(40)
  })

  it('requires one full cell and converts it into a timed boost', () => {
    const belowCell = createRaceState(1, STARTER)
    belowCell.player = {
      ...belowCell.player,
      boost: NITRO_CELL - 1,
    }
    const blocked = advanceRace(belowCell, { boostTaps: 1 }, STARTER)
    expect(blocked.player.boosting).toBe(false)

    const charged = createRaceState(1, STARTER)
    charged.player = {
      ...charged.player,
      boost: NITRO_CELL,
    }
    const boosted = advanceRace(charged, { boostTaps: 1 }, STARTER)
    expect(boosted.player.boosting).toBe(true)
    expect(boosted.player.superBoosting).toBe(false)
    expect(boosted.player.boostRemainingMs).toBe(NITRO_BOOST_DURATION_MS)
    expect(boosted.player.boost).toBeLessThan(1)
    expect(boosted.event?.type).toBe('boost')
    expect(boosted.effects.some((effect) => effect.type === 'nitro')).toBe(true)
  })

  it('waits for a possible second tap before spending a full tank normally', () => {
    let state = createRaceState(1, STARTER)
    state.player = { ...state.player, boost: NITRO_MAX }
    state = advanceRace(state, { boostTaps: 1 }, STARTER)
    expect(state.player.boosting).toBe(false)
    expect(state.boostTapPendingMs).toBe(NITRO_DOUBLE_TAP_WINDOW_MS)

    while (state.boostTapPendingMs > 0) {
      state = advanceRace(state, {}, STARTER)
    }
    expect(state.player.boosting).toBe(true)
    expect(state.player.superBoosting).toBe(false)
    expect(state.player.boost).toBeGreaterThan(NITRO_CELL)
    expect(state.player.boost).toBeLessThan(NITRO_CELL * 2 + 1)
  })

  it('turns a full-tank double tap into a super boost and very high leap', () => {
    let state = createRaceState(1, STARTER)
    state.player = { ...state.player, boost: NITRO_MAX }
    state = advanceRace(state, { boostTaps: 2 }, STARTER)

    expect(state.player.boost).toBe(0)
    expect(state.player.boosting).toBe(true)
    expect(state.player.superBoosting).toBe(true)
    expect(state.player.boostRemainingMs).toBe(NITRO_SUPER_DURATION_MS)
    expect(state.player.verticalSpeed).toBeLessThan(NITRO_SUPER_LAUNCH_SPEED)
    expect(state.player.verticalSpeed).toBeGreaterThan(
      NITRO_SUPER_LAUNCH_SPEED - 1,
    )
    expect(state.event?.type).toBe('super-boost')
    expect(state.effects.some((effect) => effect.type === 'super-nitro')).toBe(
      true,
    )

    let peakHeight = state.player.airborneHeight
    for (let tick = 0; tick < 60; tick += 1) {
      state = advanceRace(state, {}, STARTER)
      peakHeight = Math.max(peakHeight, state.player.airborneHeight)
    }
    expect(peakHeight).toBeGreaterThan(10)
  })

  it('lets AI racers spend cells and save full tanks for super boosts', () => {
    let state = createRaceState(1, STARTER)
    state = {
      ...state,
      elapsedMs: 7290,
      vehicles: state.vehicles.map((vehicle, index) => ({
        ...vehicle,
        boost: index < 2 ? NITRO_MAX : 0,
      })),
    }
    state = advanceRace(state, {}, STARTER)
    expect(state.vehicles[0].superBoosting).toBe(true)
    expect(state.vehicles[0].airborneHeight).toBeGreaterThan(0)
    expect(state.vehicles[1].boosting).toBe(true)
    expect(state.vehicles[1].superBoosting).toBe(false)
  })

  it('launches a vehicle from a visible lane ramp', () => {
    let state = createRaceState(1, STARTER)
    const ramp = upcomingTrackFeatures(state, 400).find(
      (feature) => feature.kind === 'ramp',
    )
    expect(ramp).toBeDefined()
    if (!ramp) return
    state.player = {
      ...state.player,
      lane: ramp.lane,
      targetLane: ramp.lane,
      x: RACE_LANE_X[ramp.lane],
      distance: ramp.distance - 1,
      speed: 30,
      desiredSpeed: 30,
    }
    state = advanceRace(state, {}, STARTER)
    expect(state.player.airborneHeight).toBeGreaterThan(0)
    expect(state.player.verticalSpeed).toBeGreaterThan(0)
    expect(state.event?.type).toBe('ramp')
  })

  it('halves the previous long airborne duration', () => {
    let state = createRaceState(1, STARTER)
    const ramp = upcomingTrackFeatures(state, 400).find(
      (feature) => feature.kind === 'ramp',
    )
    expect(ramp).toBeDefined()
    if (!ramp) return
    state.player = {
      ...state.player,
      lane: ramp.lane,
      targetLane: ramp.lane,
      x: RACE_LANE_X[ramp.lane],
      distance: ramp.distance - 1,
      speed: 30,
      desiredSpeed: 30,
    }
    state = advanceRace(state, {}, STARTER)
    let airborneTicks = 0
    while (
      state.status === 'running' &&
      state.player.airborneHeight > 0 &&
      airborneTicks < 120
    ) {
      state = advanceRace(state, {}, STARTER)
      airborneTicks += 1
    }
    expect(AIR_GRAVITY).toBeCloseTo(12.4)
    expect(airborneTicks * RACE_TICK_MS).toBeGreaterThanOrEqual(1500)
    expect(airborneTicks * RACE_TICK_MS).toBeLessThanOrEqual(2300)
  })

  it('lets AI cars seek ramps and perform airborne stunts', () => {
    let state = createRaceState(1, STARTER)
    const ramp = upcomingTrackFeatures(state, 400).find(
      (feature) => feature.kind === 'ramp',
    )
    expect(ramp).toBeDefined()
    if (!ramp) return
    state.vehicles[0] = {
      ...state.vehicles[0],
      lane: ramp.lane,
      targetLane: ramp.lane,
      x: RACE_LANE_X[ramp.lane],
      distance: ramp.distance - 20,
      speed: 30,
      desiredSpeed: 30,
    }
    for (
      let tick = 0;
      tick < 24 && state.vehicles[0].airborneHeight <= 0;
      tick += 1
    ) {
      state = advanceRace(state, {}, STARTER)
    }
    state = advanceRace(state, {}, STARTER)
    expect(state.vehicles[0].airborneHeight).toBeGreaterThan(0)
    expect(Math.abs(state.vehicles[0].stuntAngle)).toBeGreaterThan(0)
  })

  it('instantly slows any vehicle that lands at an extreme angle', () => {
    const playerLanding = createRaceState(1, STARTER)
    playerLanding.player = {
      ...playerLanding.player,
      airborneHeight: 0.05,
      verticalSpeed: -8,
      stuntAngle: Math.PI,
      speed: 30,
      desiredSpeed: 30,
    }
    playerLanding.vehicles = playerLanding.vehicles.map((vehicle, index) => ({
      ...vehicle,
      distance: 80 + index * 10,
      x: index % 2 === 0 ? -3.25 : 3.25,
    }))
    const playerResult = advanceRace(playerLanding, {}, STARTER)
    expect(playerResult.player.speed).toBeLessThan(30 * 0.7)
    expect(playerResult.player.speed).toBeCloseTo(
      30 * BAD_LANDING_SPEED_MULTIPLIER,
      0,
    )
    expect(playerResult.event?.type).toBe('collision')
    expect(playerResult.player.durability).toBe(playerLanding.player.durability)

    const aiLanding = createRaceState(1, STARTER)
    aiLanding.player = { ...aiLanding.player, distance: 100 }
    aiLanding.vehicles = aiLanding.vehicles.map((vehicle, index) => ({
      ...vehicle,
      distance: index === 0 ? 45 : 120 + index * 10,
      x: index === 0 ? 0 : index % 2 === 0 ? -3.25 : 3.25,
      airborneHeight: index === 0 ? 0.05 : 0,
      verticalSpeed: index === 0 ? -8 : 0,
      stuntAngle: index === 0 ? Math.PI : 0,
      speed: index === 0 ? 30 : vehicle.speed,
      desiredSpeed: index === 0 ? 30 : vehicle.desiredSpeed,
    }))
    const aiResult = advanceRace(aiLanding, {}, STARTER)
    expect(aiResult.vehicles[0].speed).toBeLessThan(30 * 0.7)
  })

  it('uses visible projectile travel and hit effects in pursuit', () => {
    let state = createRaceState(2, STARTER)
    state.player = {
      ...state.player,
      x: 0,
      lane: 1,
      targetLane: 1,
      distance: 10,
      speed: 24,
      desiredSpeed: 24,
    }
    state.vehicles = state.vehicles.map((vehicle, index) => ({
      ...vehicle,
      x: index === 0 ? 0 : index === 1 ? -3.25 : 3.25,
      lane: index === 0 ? 1 : index === 1 ? 0 : 2,
      targetLane: index === 0 ? 1 : index === 1 ? 0 : 2,
      distance: 28 + index * 8,
      speed: 20,
      desiredSpeed: 20,
    }))
    const beforeHp = state.targetHp
    state = advanceRace(state, {}, STARTER)
    expect(state.projectiles).toHaveLength(1)
    for (let tick = 0; tick < 18 && state.hits === 0; tick += 1) {
      state = advanceRace(state, { fire: false }, STARTER)
    }
    expect(state.hits).toBeGreaterThan(0)
    expect(state.targetHp).toBeLessThan(beforeHp)
    expect(
      state.effects.some(
        (effect) => effect.type === 'impact' || effect.type === 'explosion',
      ),
    ).toBe(true)
  })

  it('uses equipment durability, auto-fires, and makes input a fire boost', () => {
    let state = createRaceState(2, STARTER)
    expect(state.player.maxDurability).toBe(100)
    state = advanceRace(state, { fire: true }, STARTER)
    expect(state.shotsFired).toBe(1)
    expect(state.fireBoostRemainingMs).toBe(FIRE_BOOST_DURATION_MS)
    expect(state.fireBoostCooldownMs).toBe(FIRE_BOOST_COOLDOWN_MS)
    const playerProjectile = state.projectiles.find(
      (projectile) => projectile.owner === 'player',
    )
    expect(playerProjectile?.damage).toBeGreaterThan(13)
  })

  it('reduces pursuit fire-boost cooldown after a clean airborne stunt', () => {
    const state = createRaceState(2, STARTER)
    state.fireBoostCooldownMs = 6000
    state.player = {
      ...state.player,
      airborneHeight: 0.05,
      verticalSpeed: -8,
      stuntAngle: Math.PI * 2,
      speed: 30,
      desiredSpeed: 30,
      fireCooldownMs: 1000,
    }
    state.vehicles = state.vehicles.map((vehicle, index) => ({
      ...vehicle,
      distance: 90 + index * 12,
      x: index % 2 === 0 ? -3.25 : 3.25,
    }))

    const landed = advanceRace(state, {}, STARTER)
    expect(landed.event?.type).toBe('stunt')
    expect(landed.fireBoostCooldownMs).toBe(
      6000 - RACE_TICK_MS - PURSUIT_STUNT_FIRE_COOLDOWN_REDUCTION_MS,
    )
  })

  it('disables all nitro charging and speed boosts in pursuit stages', () => {
    const initial = createRaceState(2, STARTER)
    initial.player = {
      ...initial.player,
      boost: NITRO_MAX,
      boosting: true,
      boostRemainingMs: NITRO_SUPER_DURATION_MS,
      superBoosting: true,
    }
    initial.vehicles = initial.vehicles.map((vehicle) => ({
      ...vehicle,
      boost: NITRO_MAX,
      boosting: true,
      boostRemainingMs: NITRO_SUPER_DURATION_MS,
      superBoosting: true,
    }))

    const next = advanceRace(initial, { boostTaps: 2 }, STARTER, 250)
    expect(next.player.boost).toBe(0)
    expect(next.player.boosting).toBe(false)
    expect(next.player.superBoosting).toBe(false)
    expect(next.slipstream).toBe(false)
    expect(
      next.vehicles.every(
        (vehicle) =>
          vehicle.boost === 0 && !vehicle.boosting && !vehicle.superBoosting,
      ),
    ).toBe(true)
  })

  it('lets the enemy convoy automatically return fire', () => {
    let state = createRaceState(2, STARTER)
    state = {
      ...state,
      nextEnemyFireMs: 0,
      vehicles: state.vehicles.map((vehicle, index) => ({
        ...vehicle,
        x: index === 0 ? state.player.x : vehicle.x,
        distance: index === 0 ? state.player.distance + 20 : vehicle.distance,
      })),
    }
    state = advanceRace(state, {}, STARTER)
    expect(
      state.projectiles.some((projectile) => projectile.owner === 'enemy'),
    ).toBe(true)
  })

  it('requires a gun for pursuit stages', () => {
    expect(() =>
      createRaceState(2, { carId: 'rust-fox', gunId: null }),
    ).toThrow(/requires a gun/)
  })

  it('never times out a race stage even after its legacy duration', () => {
    const state = createRaceState(1, STARTER)
    state.elapsedMs = 120_000
    state.player = { ...state.player, distance: 100 }
    state.vehicles = state.vehicles.map((vehicle, index) => ({
      ...vehicle,
      distance: 120 + index * 10,
    }))

    const next = advanceRace(state, {}, STARTER)

    expect(next.status).toBe('running')
    expect(next.reason).toBe('running')
  })

  it('ignores player durability in races but still checks it in pursuits', () => {
    const race = createRaceState(1, STARTER)
    race.player = { ...race.player, durability: 0 }
    const raceNext = advanceRace(race, {}, STARTER)

    expect(raceNext.status).toBe('running')
    expect(raceNext.reason).toBe('running')

    const pursuit = createRaceState(2, STARTER)
    pursuit.player = { ...pursuit.player, durability: 0 }
    const pursuitNext = advanceRace(pursuit, {}, STARTER)

    expect(pursuitNext.status).toBe('defeat')
    expect(pursuitNext.reason).toBe('destroyed')
  })

  it('keeps race durability unchanged after road hazards', () => {
    const race = createRaceState(1, STARTER)
    race.player = {
      ...race.player,
      lane: 0,
      targetLane: 0,
      x: RACE_LANE_X[0],
      distance: 184.9,
      speed: 42,
      desiredSpeed: 42,
      durability: 1,
    }
    race.vehicles = race.vehicles.map((vehicle, index) => ({
      ...vehicle,
      distance: 80 + index * 10,
    }))

    const next = advanceRace(race, {}, STARTER)

    expect(next.collisions).toBeGreaterThan(0)
    expect(next.player.durability).toBe(1)
  })

  it('does not let an idle starter car finish in the top three', () => {
    let state = createRaceState(1, STARTER)
    for (let tick = 0; tick < 2_200 && state.status === 'running'; tick += 1) {
      state = advanceRace(state, {}, STARTER)
    }

    expect(state.status).toBe('defeat')
    expect(state.pendingResult?.rank).toBeGreaterThan(RACE_CLEAR_MAX_RANK)
  })

  it.each([
    [2, 'victory'],
    [3, 'victory'],
    [4, 'defeat'],
  ] as const)('settles a rank %i finish as %s', (rank, expectedStatus) => {
    let state = createRaceState(1, STARTER)
    const finishDistance = getRacingStage(1).distance
    state.player = {
      ...state.player,
      distance: finishDistance - 1,
      speed: 42,
      desiredSpeed: 42,
    }
    state.vehicles = state.vehicles.map((vehicle, index) => ({
      ...vehicle,
      distance:
        index < rank - 1
          ? finishDistance + 100 + index * 10
          : finishDistance - 500 - index * 10,
      speed: 1,
      desiredSpeed: 1,
    }))

    state = advanceRace(state, {}, STARTER)

    expect(state.pendingResult).toMatchObject({
      status: expectedStatus,
      rank,
    })
  })

  it('keeps driving for two seconds after crossing before settling the race', () => {
    let state = createRaceState(1, STARTER)
    const finishDistance = getRacingStage(1).distance
    state.player = {
      ...state.player,
      distance: finishDistance - 1,
      speed: 42,
      desiredSpeed: 42,
    }
    state.vehicles = state.vehicles.map((vehicle) => ({
      ...vehicle,
      distance: finishDistance - 500,
      speed: 1,
      desiredSpeed: 1,
    }))

    state = advanceRace(state, {}, STARTER)
    const crossedAtDistance = state.player.distance

    expect(state.status).toBe('running')
    expect(state.pendingResult).toMatchObject({
      status: 'victory',
      triggeredAtMs: RACE_TICK_MS,
      settleAtMs: RACE_TICK_MS + RACE_SETTLEMENT_DELAY_MS,
      rank: 1,
    })

    for (
      let elapsed = RACE_TICK_MS;
      elapsed < RACE_SETTLEMENT_DELAY_MS;
      elapsed += RACE_TICK_MS
    ) {
      state = advanceRace(state, {}, STARTER)
    }
    expect(state.status).toBe('running')

    state = advanceRace(state, {}, STARTER)
    expect(state.status).toBe('victory')
    expect(state.player.distance).toBeGreaterThan(crossedAtDistance)
  })

  it('waits one second after destroying the pursuit target and preserves kill time', () => {
    let state = createRaceState(2, STARTER)
    state.vehicles = state.vehicles.map((vehicle) =>
      vehicle.role === 'target' ? { ...vehicle, durability: 0 } : vehicle,
    )

    state = advanceRace(state, {}, STARTER)

    expect(state.status).toBe('running')
    expect(state.pendingResult).toMatchObject({
      status: 'victory',
      triggeredAtMs: RACE_TICK_MS,
      settleAtMs: RACE_TICK_MS + PURSUIT_SETTLEMENT_DELAY_MS,
      rank: null,
    })

    for (
      let elapsed = RACE_TICK_MS;
      elapsed < PURSUIT_SETTLEMENT_DELAY_MS;
      elapsed += RACE_TICK_MS
    ) {
      state = advanceRace(state, {}, STARTER)
    }
    expect(state.status).toBe('running')

    state = advanceRace(state, {}, STARTER)
    expect(state.status).toBe('victory')
    expect(state.pendingResult?.triggeredAtMs).toBe(RACE_TICK_MS)
  })

  it('keeps the first stage and all endgame stages completable', () => {
    const starterResult = finish(1, STARTER)
    expect(
      starterResult.status,
      `starter ended ${starterResult.reason}; rank=${raceRank(starterResult)}; player=${Math.round(starterResult.player.distance)}`,
    ).toBe('victory')
    for (let stage = 1; stage <= 10; stage += 1) {
      const result = finish(stage, ENDGAME)
      expect(
        result.status,
        `stage ${stage} ended ${result.reason}; shots=${result.shotsFired}; hits=${result.hits}; target=${result.targetHp}; player=${Math.round(result.player.distance)}; targetDistance=${Math.round(targetVehicle(result)?.distance ?? 0)}`,
      ).toBe('victory')
    }
  })
})
