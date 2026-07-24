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
  raceProgress,
  raceRank,
  RACE_TICK_MS,
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
      inputRef.current = { ...inputRef.current, laneDelta: 0 }
    }, RACE_TICK_MS)
    return () => window.clearInterval(timer)
  }, [exitPending, initial.loadout, state.status])

  useEffect(() => {
    const down = (event: KeyboardEvent): void => {
      if (
        event.repeat &&
        ['ArrowUp', 'ArrowDown', 'w', 's'].includes(event.key)
      ) {
        return
      }
      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
        inputRef.current.laneDelta = -1
        event.preventDefault()
      }
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
        inputRef.current.laneDelta = 1
        event.preventDefault()
      }
      if (event.code === 'Space') {
        inputRef.current.boost = true
        event.preventDefault()
      }
      if (event.key.toLowerCase() === 'f') {
        inputRef.current.fire = true
      }
      if (event.key === 'Escape') setExitPending(true)
    }
    const up = (event: KeyboardEvent): void => {
      if (event.code === 'Space') inputRef.current.boost = false
      if (event.key.toLowerCase() === 'f') inputRef.current.fire = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    if (state.status !== 'victory' || committedRef.current) return
    committedRef.current = true
    setReward(recordVictory(stage).rewardExp)
  }, [recordVictory, stage, state.status])

  const pressBoost = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    inputRef.current.boost = true
  }
  const releaseBoost = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    inputRef.current.boost = false
  }
  const pressFire = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    inputRef.current.fire = true
  }
  const releaseFire = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    inputRef.current.fire = false
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

  return (
    <div
      className="race-screen"
      role="dialog"
      aria-label="公路争霸"
      data-status={state.status}
      data-event={state.event?.type ?? ''}
    >
      <Canvas
        className="race-screen__canvas"
        shadows
        camera={{ position: [0, 7.5, 13], fov: 48, near: 0.1, far: 120 }}
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
        </div>
        <div className="race-hud__timer">{remainingSeconds}</div>
        <button type="button" onClick={() => setExitPending(true)}>
          退出
        </button>
      </header>

      <aside className="race-hud__status">
        <p>{`${carName}${gunName ? ` · ${gunName}` : ''}`}</p>
        <label>
          耐久
          <progress value={state.durability} max={state.maxDurability} />
        </label>
        <label>
          氮气
          <progress value={state.boost} max={100} />
        </label>
        {definition.mode === 'race' ? (
          <p>{`当前排名 ${raceRank(state)}/${state.opponents.length + 1}`}</p>
        ) : (
          <label>
            目标
            <progress value={state.targetHp} max={state.maxTargetHp} />
          </label>
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
            aria-label="向上切换车道"
            onClick={() => {
              inputRef.current.laneDelta = -1
            }}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="向下切换车道"
            onClick={() => {
              inputRef.current.laneDelta = 1
            }}
          >
            ↓
          </button>
        </div>
        <div>
          <button
            type="button"
            className="race-controls__boost"
            onPointerDown={pressBoost}
            onPointerUp={releaseBoost}
            onPointerCancel={releaseBoost}
            onPointerLeave={releaseBoost}
          >
            加速
          </button>
          {definition.mode === 'pursuit' ? (
            <button
              type="button"
              className="race-controls__fire"
              onPointerDown={pressFire}
              onPointerUp={releaseFire}
              onPointerCancel={releaseFire}
              onPointerLeave={releaseFire}
            >
              开火
            </button>
          ) : null}
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
