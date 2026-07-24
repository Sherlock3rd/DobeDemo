import { describe, expect, it } from 'vitest'
import {
  advanceRace,
  createRaceState,
  nextObstacle,
  RACE_TICK_MS,
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

function botStep(state: RaceState, loadout: RaceLoadout): RaceState {
  const obstacle = nextObstacle(state)
  const gap = obstacle.distance - state.distance
  let laneDelta: -1 | 0 | 1 = 0
  if (
    gap > 0 &&
    gap < 9 &&
    obstacle.lane === state.lane &&
    state.laneCooldownMs <= 0
  ) {
    laneDelta = state.lane === 0 ? 1 : -1
  } else if (
    state.mode === 'pursuit' &&
    state.lane !== state.targetLane &&
    state.laneCooldownMs <= 0
  ) {
    laneDelta = state.lane < state.targetLane ? 1 : -1
  }
  return advanceRace(
    state,
    {
      laneDelta,
      boost:
        state.mode === 'race' || state.targetDistance - state.distance > 18,
      fire: state.mode === 'pursuit',
    },
    loadout,
    RACE_TICK_MS,
  )
}

function finish(stage: number, loadout: RaceLoadout): RaceState {
  let state = createRaceState(stage, loadout)
  for (let tick = 0; tick < 800 && state.status === 'running'; tick += 1) {
    state = botStep(state, loadout)
  }
  return state
}

describe('raceEngine', () => {
  it('is deterministic for identical input streams', () => {
    const run = (): RaceState => {
      let state = createRaceState(1, STARTER)
      for (let tick = 0; tick < 50; tick += 1) {
        state = advanceRace(
          state,
          { boost: true, laneDelta: tick === 5 ? -1 : 0 },
          STARTER,
        )
      }
      return state
    }
    expect(run()).toEqual(run())
  })

  it('requires a gun for pursuit stages', () => {
    expect(() =>
      createRaceState(2, { carId: 'rust-fox', gunId: null }),
    ).toThrow(/requires a gun/)
  })

  it('allows the starter loadout to clear the first stage', () => {
    expect(finish(1, STARTER).status).toBe('victory')
  })

  it('keeps all ten configured stages winnable with endgame gear', () => {
    for (let stage = 1; stage <= 10; stage += 1) {
      const result = finish(stage, ENDGAME)
      expect(result.status, `stage ${stage} ended ${result.reason}`).toBe(
        'victory',
      )
      expect(result.elapsedMs).toBeLessThanOrEqual(65_000)
    }
  })

  it('fires only when aligned and inside gun range', () => {
    let state = createRaceState(2, STARTER)
    state = advanceRace(state, { fire: true }, STARTER)
    expect(state.shotsFired).toBe(1)
    expect(state.hits).toBe(1)
    state = { ...state, lane: 0, fireCooldownMs: 0 }
    state = advanceRace(state, { fire: true }, STARTER)
    expect(state.shotsFired).toBe(2)
    expect(state.hits).toBe(1)
  })
})
