import { describe, expect, it } from 'vitest'
import {
  advanceRace,
  createRaceState,
  RACE_LANE_X,
  RACE_TICK_MS,
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
}

function botInput(state: RaceState): RaceInput {
  const nearbyFeature = upcomingTrackFeatures(state).find(
    (feature) =>
      feature.distance > state.player.distance &&
      feature.distance - state.player.distance < 13 &&
      feature.lane === state.player.targetLane,
  )
  if (!state.steerLatch && nearbyFeature) {
    return {
      laneDelta: state.player.targetLane === 0 ? 1 : -1,
      boost: true,
      fire: state.mode === 'pursuit',
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
        boost: target.distance - state.player.distance > 20,
        fire: true,
      }
    }
  }
  return {
    laneDelta: 0,
    boost:
      state.mode === 'race' ||
      (targetVehicle(state)?.distance ?? 0) - state.player.distance > 18,
    fire: state.mode === 'pursuit',
  }
}

function finish(stage: number, loadout: RaceLoadout): RaceState {
  let state = createRaceState(stage, loadout)
  for (let tick = 0; tick < 1500 && state.status === 'running'; tick += 1) {
    state = advanceRace(state, botInput(state), loadout)
  }
  return state
}

describe('raceEngine V2', () => {
  it('creates a four-car race and a three-car enemy convoy', () => {
    const race = createRaceState(1, STARTER)
    expect(
      race.vehicles.filter((vehicle) => vehicle.role === 'racer'),
    ).toHaveLength(3)
    const pursuit = createRaceState(2, STARTER)
    expect(pursuit.vehicles.map((vehicle) => vehicle.role).sort()).toEqual([
      'escort',
      'escort',
      'target',
    ])
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
    const next = advanceRace(initial, {}, ENDGAME, RACE_TICK_MS)
    expect(next.collisions).toBeGreaterThan(0)
    expect(next.player.speed).toBeLessThan(38)
    expect(next.vehicles[0].speed).toBeGreaterThan(14)
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
    state = advanceRace(state, { fire: true }, STARTER)
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

  it('requires a gun for pursuit stages', () => {
    expect(() =>
      createRaceState(2, { carId: 'rust-fox', gunId: null }),
    ).toThrow(/requires a gun/)
  })

  it('keeps the first stage and all endgame stages completable', () => {
    expect(finish(1, STARTER).status).toBe('victory')
    for (let stage = 1; stage <= 10; stage += 1) {
      const result = finish(stage, ENDGAME)
      expect(
        result.status,
        `stage ${stage} ended ${result.reason}; shots=${result.shotsFired}; hits=${result.hits}; target=${result.targetHp}; player=${Math.round(result.player.distance)}; targetDistance=${Math.round(targetVehicle(result)?.distance ?? 0)}`,
      ).toBe('victory')
    }
  })
})
