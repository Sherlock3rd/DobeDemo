import { Canvas } from '@react-three/fiber'
import {
  useEffect,
  useRef,
  useState,
  type JSX,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { equipmentConfig } from '../config/equipmentConfig'
import { getRacingStage } from '../config/racingConfig'
import type { HeroId } from '../game/heroes'
import {
  advanceRace,
  createRaceState,
  NITRO_CELL,
  raceProgress,
  raceRank,
  RACE_TICK_MS,
  targetVehicle,
  type RaceInput,
  type RaceLoadout,
  type RaceState,
} from '../game/racing/raceEngine'
import { RacingScene } from '../scene/racing/RacingScene'
import { useAdventureStore } from '../store/useAdventureStore'

export interface RaceScreenProps {
  stage: number
  heroId: HeroId
  onExit: () => void
}

interface RaceBoot {
  loadout: RaceLoadout
  state: RaceState
}

function boot(stage: number, heroId: HeroId): RaceBoot {
  const equipment = useAdventureStore.getState().equipmentByHero[heroId]
  if (!equipment.carId) throw new Error('当前英雄没有装备车辆')
  const loadout: RaceLoadout = {
    carId: equipment.carId,
    gunId: equipment.gunId,
  }
  return { loadout, state: createRaceState(stage, loadout) }
}

export function RaceScreen({
  stage,
  heroId,
  onExit,
}: RaceScreenProps): JSX.Element {
  const [bootResult] = useState<
    { ok: true; value: RaceBoot } | { ok: false; message: string }
  >(() => {
    try {
      return { ok: true, value: boot(stage, heroId) }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : '赛车初始化失败',
      }
    }
  })

  if (!bootResult.ok) {
    return (
      <div className="race-screen race-screen--error" role="dialog">
        <p role="alert">{bootResult.message}</p>
        <button type="button" onClick={onExit}>
          返回
        </button>
      </div>
    )
  }

  return (
    <RaceSession stage={stage} onExit={onExit} initial={bootResult.value} />
  )
}

function RaceSession({
  stage,
  onExit,
  initial,
}: {
  stage: number
  onExit: () => void
  initial: RaceBoot
}): JSX.Element {
  const definition = getRacingStage(stage)
  const recordVictory = useAdventureStore((state) => state.recordRacingVictory)
  const [state, setState] = useState(initial.state)
  const [exitPending, setExitPending] = useState(false)
  const inputRef = useRef<RaceInput>({})
  const committedRef = useRef(false)
  const [reward, setReward] = useState(0)

  useEffect(() => {
    if (state.status !== 'running' || exitPending) return
    const timer = window.setInterval(() => {
      const input = inputRef.current
      setState((current) =>
        advanceRace(current, input, initial.loadout, RACE_TICK_MS),
      )
      inputRef.current = {
        ...inputRef.current,
        boost: false,
        boostTaps: 0,
        laneDelta: 0,
        fire: false,
      }
    }, RACE_TICK_MS)
    return () => window.clearInterval(timer)
  }, [exitPending, initial.loadout, state.status])

  useEffect(() => {
    const down = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase()
      if (
        event.repeat &&
        ['arrowleft', 'arrowright', 'a', 'd', 'f', ' '].includes(key)
      ) {
        return
      }
      if (event.key === 'ArrowLeft' || key === 'a') {
        inputRef.current.steer = -1
        inputRef.current.laneDelta = -1
        event.preventDefault()
      }
      if (event.key === 'ArrowRight' || key === 'd') {
        inputRef.current.steer = 1
        inputRef.current.laneDelta = 1
        event.preventDefault()
      }
      if (event.code === 'Space' && definition.mode === 'race') {
        inputRef.current.boostTaps = Math.min(
          2,
          (inputRef.current.boostTaps ?? 0) + 1,
        )
        event.preventDefault()
      }
      if (key === 'f') {
        inputRef.current.fire = true
      }
      if (event.key === 'Escape') setExitPending(true)
    }
    const up = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase()
      if (
        (event.key === 'ArrowLeft' || key === 'a') &&
        inputRef.current.steer === -1
      ) {
        inputRef.current.steer = 0
      }
      if (
        (event.key === 'ArrowRight' || key === 'd') &&
        inputRef.current.steer === 1
      ) {
        inputRef.current.steer = 0
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [definition.mode])

  useEffect(() => {
    if (state.status !== 'victory' || committedRef.current) return
    committedRef.current = true
    setReward(recordVictory(stage).rewardExp)
  }, [recordVictory, stage, state.status])

  const triggerBoost = (): void => {
    inputRef.current.boostTaps = Math.min(
      2,
      (inputRef.current.boostTaps ?? 0) + 1,
    )
  }
  const triggerFireBoost = (): void => {
    inputRef.current.fire = true
  }
  const pressSteerLeft = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    event.preventDefault()
    inputRef.current.steer = -1
    inputRef.current.laneDelta = -1
  }
  const releaseSteerLeft = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    event.preventDefault()
    if (inputRef.current.steer === -1) inputRef.current.steer = 0
  }
  const pressSteerRight = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    event.preventDefault()
    inputRef.current.steer = 1
    inputRef.current.laneDelta = 1
  }
  const releaseSteerRight = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    event.preventDefault()
    if (inputRef.current.steer === 1) inputRef.current.steer = 0
  }

  const retry = (): void => {
    committedRef.current = false
    setReward(0)
    setExitPending(false)
    inputRef.current = {}
    setState(createRaceState(stage, initial.loadout))
  }

  const remainingSeconds = Math.max(
    0,
    Math.ceil((definition.durationMs - state.elapsedMs) / 1000),
  )
  const carName = equipmentConfig.cars[initial.loadout.carId].name
  const gunName = initial.loadout.gunId
    ? equipmentConfig.guns[initial.loadout.gunId].name
    : null
  const target = targetVehicle(state)
  const gun = initial.loadout.gunId
    ? equipmentConfig.guns[initial.loadout.gunId].pursuit
    : null
  const alignedVehicles = state.vehicles
    .filter(
      (vehicle) =>
        vehicle.durability > 0 &&
        vehicle.distance >= state.player.distance - 2 &&
        Math.abs(vehicle.x - state.player.x) < 1.65 &&
        (!gun || vehicle.distance - state.player.distance <= gun.range),
    )
    .sort((left, right) => left.distance - right.distance)
  const sightStatus =
    definition.mode !== 'pursuit'
      ? ''
      : alignedVehicles[0]?.role === 'target'
        ? '目标锁定'
        : alignedVehicles[0]?.role === 'escort'
          ? '护卫车阻挡射界'
          : '换道并接近目标'
  const escortCount = state.vehicles.filter(
    (vehicle) => vehicle.role === 'escort' && vehicle.durability > 0,
  ).length
  const fireBoostStatus =
    state.fireBoostRemainingMs > 0
      ? `强化中 ${Math.ceil(state.fireBoostRemainingMs / 1000)}秒`
      : state.fireBoostCooldownMs > 0
        ? `冷却 ${Math.ceil(state.fireBoostCooldownMs / 1000)}秒`
        : '强化就绪'

  return (
    <div
      className="race-screen"
      role="dialog"
      aria-label="公路争霸"
      data-status={state.status}
      data-event={state.event?.type ?? ''}
      data-player-lane={state.player.targetLane}
      data-fire-boost={state.fireBoostRemainingMs}
      data-fire-cooldown={state.fireBoostCooldownMs}
      data-shots={state.shotsFired}
      data-boost={state.player.boost}
      data-boost-remaining={state.player.boostRemainingMs}
      data-super-boost={state.player.superBoosting}
      data-opponents={state.vehicles.length}
    >
      <Canvas
        className="race-screen__canvas"
        shadows
        camera={{ position: [0, 17, 29], fov: 48, near: 0.1, far: 260 }}
        dpr={[1, 1.5]}
      >
        <RacingScene
          state={state}
          carId={initial.loadout.carId}
          gunId={initial.loadout.gunId}
        />
      </Canvas>

      <header className="race-hud__top">
        <div>
          <span>{`第 ${stage} 关 · ${definition.title}`}</span>
          <strong>{definition.mode === 'race' ? '竞速' : '追击'}</strong>
          <span>
            {definition.mode === 'race'
              ? '七车对抗 · 落后补氮 · 满格双击超级飞跃'
              : '纯追击枪战 · 突破护卫 · 摧毁目标车'}
          </span>
        </div>
        <div className="race-hud__timer">{remainingSeconds}</div>
        <button type="button" onClick={() => setExitPending(true)}>
          退出
        </button>
      </header>

      <aside className="race-hud__status">
        <p>{`${carName}${gunName ? ` · ${gunName}` : ''}`}</p>
        <p>{`${Math.round(state.player.speed * 7.2)} km/h${
          state.player.driftActive
            ? ' · 漂移'
            : state.player.airborneHeight > 0
              ? ' · 空中特技'
              : state.slipstream
                ? ' · 尾流加速'
                : ''
        }`}</p>
        <label>
          耐久
          <progress
            value={state.player.durability}
            max={state.player.maxDurability}
          />
        </label>
        {definition.mode === 'race' ? (
          <label className="race-hud__nitro-label">
            氮气 · 落后自动加速补充 · 满三格双击超级加速
            <span
              className="race-hud__nitro"
              role="group"
              aria-label="三格氮气"
            >
              {[0, 1, 2].map((index) => (
                <progress
                  key={index}
                  value={Math.min(
                    NITRO_CELL,
                    Math.max(0, state.player.boost - index * NITRO_CELL),
                  )}
                  max={NITRO_CELL}
                  aria-label={`氮气第 ${index + 1} 格`}
                />
              ))}
            </span>
          </label>
        ) : null}
        {definition.mode === 'race' ? (
          <p>{`当前排名 ${raceRank(state)}/7`}</p>
        ) : (
          <>
            <label>
              目标
              <progress value={state.targetHp} max={state.maxTargetHp} />
            </label>
            <p className="race-hud__sight">{`${sightStatus} · 护卫 ${escortCount}/5${
              target
                ? ` · 距离 ${Math.max(
                    0,
                    Math.round(target.distance - state.player.distance),
                  )}m`
                : ''
            }`}</p>
            <p>{`普通攻击 自动开火 · 敌方持续反击 · ${fireBoostStatus}`}</p>
          </>
        )}
        <progress
          className="race-hud__progress"
          value={raceProgress(state)}
          max={1}
          aria-label="关卡进度"
        />
      </aside>

      <div className="race-controls" aria-label="赛车控制">
        <div>
          <button
            type="button"
            aria-label="向左切换车道"
            onPointerDown={pressSteerLeft}
            onPointerUp={releaseSteerLeft}
            onPointerCancel={releaseSteerLeft}
            onPointerLeave={releaseSteerLeft}
          >
            ←<span>按住漂移</span>
          </button>
          <button
            type="button"
            aria-label="向右切换车道"
            onPointerDown={pressSteerRight}
            onPointerUp={releaseSteerRight}
            onPointerCancel={releaseSteerRight}
            onPointerLeave={releaseSteerRight}
          >
            →<span>按住漂移</span>
          </button>
        </div>
        <div>
          {definition.mode === 'race' ? (
            <button
              type="button"
              className="race-controls__boost"
              onClick={triggerBoost}
            >
              氮气
              <span>单击冲刺 · 满格双击飞跃</span>
            </button>
          ) : (
            <button
              type="button"
              className="race-controls__fire"
              onClick={triggerFireBoost}
              disabled={state.fireBoostCooldownMs > 0}
            >
              {state.fireBoostCooldownMs > 0
                ? `强化 ${Math.ceil(state.fireBoostCooldownMs / 1000)}s`
                : '火力强化'}
            </button>
          )}
        </div>
      </div>

      {exitPending ? (
        <div className="race-screen__modal" role="alertdialog">
          <strong>退出本次比赛？</strong>
          <p>退出不会获得首通奖励。</p>
          <div>
            <button type="button" onClick={() => setExitPending(false)}>
              继续比赛
            </button>
            <button type="button" onClick={onExit}>
              确认退出
            </button>
          </div>
        </div>
      ) : null}

      {state.status !== 'running' ? (
        <div className="race-screen__result" role="status">
          <strong>{state.status === 'victory' ? '胜利' : '失败'}</strong>
          <p>
            {state.status === 'victory'
              ? `首通英雄经验 +${reward}`
              : state.reason === 'escaped'
                ? '目标已经逃脱'
                : state.reason === 'destroyed'
                  ? '车辆耐久耗尽'
                  : state.reason === 'timeout'
                    ? '时间耗尽'
                    : '未能率先冲线'}
          </p>
          <div>
            {state.status === 'defeat' ? (
              <button type="button" onClick={retry}>
                重新挑战
              </button>
            ) : null}
            <button type="button" onClick={onExit}>
              返回关卡
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
