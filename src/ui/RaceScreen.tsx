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
import {
  CAR_PART_QUALITY_INFO,
  CAR_PART_SLOT_INFO,
  getInstalledPartRacingBonus,
} from '../game/equipmentProgression'
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
import { ResourceAmount } from './ResourceAmount'

export interface RaceScreenProps {
  stage: number
  heroId: HeroId
  onExit: () => void
  onDevelop?: () => void
  roleChallengeTitle?: string
  onRoleChallengeVictory?: () => void
  prologueTitle?: string
}

interface RaceBoot {
  loadout: RaceLoadout
  state: RaceState
}

function formatResultTime(elapsedMs: number): string {
  const totalHundredths = Math.max(0, Math.floor(elapsedMs / 10))
  const minutes = Math.floor(totalHundredths / 6000)
  const seconds = Math.floor((totalHundredths % 6000) / 100)
  const hundredths = totalHundredths % 100
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}.${String(hundredths).padStart(2, '0')}`
}

function boot(stage: number, heroId: HeroId): RaceBoot {
  const adventure = useAdventureStore.getState()
  const equipment = adventure.equipmentByHero[heroId]
  if (!equipment.carId) throw new Error('当前英雄没有装备车辆')
  const loadout: RaceLoadout = {
    carId: equipment.carId,
    gunId: equipment.gunId,
    gunLevel: equipment.gunId ? adventure.gunLevels[equipment.gunId] : 0,
    carUpgrade: getInstalledPartRacingBonus(equipment.carId, adventure),
  }
  return { loadout, state: createRaceState(stage, loadout) }
}

export function RaceScreen({
  stage,
  heroId,
  onExit,
  onDevelop = onExit,
  roleChallengeTitle,
  onRoleChallengeVictory,
  prologueTitle,
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
    <RaceSession
      stage={stage}
      onExit={onExit}
      onDevelop={onDevelop}
      initial={bootResult.value}
      roleChallengeTitle={roleChallengeTitle}
      onRoleChallengeVictory={onRoleChallengeVictory}
      prologueTitle={prologueTitle}
    />
  )
}

function RaceSession({
  stage,
  onExit,
  onDevelop,
  initial,
  roleChallengeTitle,
  onRoleChallengeVictory,
  prologueTitle,
}: {
  stage: number
  onExit: () => void
  onDevelop: () => void
  initial: RaceBoot
  roleChallengeTitle?: string
  onRoleChallengeVictory?: () => void
  prologueTitle?: string
}): JSX.Element {
  const isRoleChallenge = Boolean(roleChallengeTitle && onRoleChallengeVictory)
  const isPrologue = Boolean(prologueTitle)
  const definition = getRacingStage(stage)
  const recordVictory = useAdventureStore((state) => state.recordRacingVictory)
  const lastVictoryReward = useAdventureStore(
    (state) => state.lastVictoryReward,
  )
  const [state, setState] = useState(initial.state)
  const [exitPending, setExitPending] = useState(false)
  const [skipPending, setSkipPending] = useState(false)
  const inputRef = useRef<RaceInput>({})
  const committedRef = useRef(false)
  const reward =
    !isRoleChallenge &&
    lastVictoryReward?.mode === 'racing' &&
    lastVictoryReward.stage === stage
      ? lastVictoryReward.reward
      : null

  useEffect(() => {
    if (state.status !== 'running' || exitPending || skipPending) return
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
  }, [exitPending, initial.loadout, skipPending, state.status])

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
    if (!isRoleChallenge) recordVictory(stage)
  }, [isRoleChallenge, recordVictory, stage, state.status])

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
    setExitPending(false)
    setSkipPending(false)
    inputRef.current = {}
    setState(createRaceState(stage, initial.loadout))
  }

  const skipStage = (): void => {
    setSkipPending(false)
    inputRef.current = {}
    setState((current) => {
      if (current.status !== 'running') return current
      return {
        ...current,
        status: 'victory',
        reason: 'skipped',
        pendingResult: null,
        event: {
          id: current.nextEntityId,
          type: 'finish',
        },
        nextEntityId: current.nextEntityId + 1,
      }
    })
  }

  const remainingSeconds = Math.max(
    0,
    Math.ceil((definition.durationMs - state.elapsedMs) / 1000),
  )
  const carName = equipmentConfig.cars[initial.loadout.carId].name
  const gunName = initial.loadout.gunId
    ? `${equipmentConfig.guns[initial.loadout.gunId].name} Lv.${
        initial.loadout.gunLevel ?? 0
      }`
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
  const finishProgress = raceProgress(state)
  const finishPercent = Math.round(finishProgress * 100)
  const raceVehicleCount = state.vehicles.length + 1

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
      data-role-challenge={isRoleChallenge || undefined}
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
          <span>
            {isRoleChallenge
              ? '职位交接 · SUP 竞速挑战'
              : isPrologue
                ? `序章 · ${prologueTitle}`
                : `第 ${stage} 关 · ${definition.title}`}
          </span>
          <strong>{definition.mode === 'race' ? '竞速' : '追击'}</strong>
          <span>
            {isRoleChallenge
              ? roleChallengeTitle
              : definition.mode === 'race'
                ? definition.opponentCount === 1
                  ? '双车对决 · 第一通关 · 主动使用氮气'
                  : definition.opponentCount === 6 &&
                      definition.clearMaxRank === 3
                    ? '七车对抗 · 前三通关 · 落后补氮'
                    : `${definition.opponentCount + 1}车对抗 · 前${definition.clearMaxRank}通关 · 落后补氮`
                : '纯追击枪战 · 空中特技缩短强化冷却 · 摧毁目标车'}
          </span>
        </div>
        {definition.mode === 'race' ? (
          <label className="race-hud__finish-progress">
            <span>{`终点 ${finishPercent}%`}</span>
            <progress value={finishProgress} max={1} aria-label="距离终点" />
          </label>
        ) : (
          <div className="race-hud__timer" aria-label="剩余时间">
            {remainingSeconds}
          </div>
        )}
        <div className="race-hud__actions">
          {!isRoleChallenge ? (
            <button
              type="button"
              className="race-hud__skip"
              onClick={() => {
                setExitPending(false)
                setSkipPending(true)
              }}
            >
              跳过本关
            </button>
          ) : null}
          {!isPrologue ? (
            <button
              type="button"
              onClick={() => {
                setSkipPending(false)
                setExitPending(true)
              }}
            >
              退出
            </button>
          ) : null}
        </div>
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
        {definition.mode === 'pursuit' ? (
          <label>
            耐久
            <progress
              value={state.player.durability}
              max={state.player.maxDurability}
            />
          </label>
        ) : null}
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
          <p>{`当前排名 ${raceRank(state)}/${raceVehicleCount}`}</p>
        ) : (
          <>
            <label>
              目标
              <progress value={state.targetHp} max={state.maxTargetHp} />
            </label>
            <p className="race-hud__sight">{`${sightStatus} · 护卫 ${escortCount}/${definition.escortCount}${
              target
                ? ` · 距离 ${Math.max(
                    0,
                    Math.round(target.distance - state.player.distance),
                  )}m`
                : ''
            }`}</p>
            <p>{`普通攻击 自动开火 · 空中特技 -2.5秒强化冷却 · ${fireBoostStatus}`}</p>
          </>
        )}
        {definition.mode === 'pursuit' ? (
          <progress
            className="race-hud__progress"
            value={finishProgress}
            max={1}
            aria-label="追击进度"
          />
        ) : null}
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

      {state.status === 'running' && state.pendingResult ? (
        <p className="race-screen__finish-banner" role="status">
          {definition.mode === 'race' ? '冲线！' : '目标击破！'}
        </p>
      ) : null}

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

      {skipPending ? (
        <div
          className="race-screen__modal race-screen__modal--skip"
          role="alertdialog"
          aria-label="确认跳过当前 SUP 关卡"
        >
          <strong>直接完成当前关卡？</strong>
          <p>确认后将按通关结算，发放正常首通奖励并解锁下一关。</p>
          <div>
            <button type="button" onClick={() => setSkipPending(false)}>
              继续挑战
            </button>
            <button type="button" onClick={skipStage}>
              确认跳过
            </button>
          </div>
        </div>
      ) : null}

      {state.status !== 'running' ? (
        <div className="race-screen__result" role="status">
          <strong>
            {state.status === 'victory'
              ? isRoleChallenge
                ? '竞速交接胜利'
                : state.reason === 'skipped'
                  ? '跳过通关'
                  : definition.mode === 'race'
                    ? '通关'
                    : '目标击破'
              : '失败'}
          </strong>
          {state.status === 'victory' && state.reason === 'skipped' ? (
            <p>当前关卡已直接完成，首通奖励与下一关已经解锁。</p>
          ) : null}
          {state.status === 'victory' && isRoleChallenge ? (
            <p>公路试炼已经完成，返回帮派树正式接掌路线队长席位。</p>
          ) : null}
          {definition.mode === 'race' && state.pendingResult ? (
            <div className="race-screen__result-meta" aria-label="竞速成绩">
              <p>{`冲线时长 ${formatResultTime(
                state.pendingResult.triggeredAtMs,
              )}`}</p>
              <p>{`最终排名 第 ${state.pendingResult.rank ?? raceRank(state)}/${raceVehicleCount}`}</p>
            </div>
          ) : null}
          {definition.mode === 'pursuit' &&
          state.status === 'victory' &&
          state.pendingResult ? (
            <div className="race-screen__result-meta" aria-label="追击成绩">
              <p>{`击杀耗时 ${formatResultTime(
                state.pendingResult.triggeredAtMs,
              )}`}</p>
            </div>
          ) : null}
          {state.status === 'victory' && !isRoleChallenge ? (
            reward ? (
              <div className="race-screen__rewards" aria-label="首通奖励">
                <ResourceAmount kind="experience" amount={reward.rewardExp} />
                <ResourceAmount kind="money" amount={reward.rewardMoney} />
                {reward.rewardPart ? (
                  <ResourceAmount
                    kind="part"
                    label={`${CAR_PART_QUALITY_INFO[reward.rewardPart.quality].name}${CAR_PART_SLOT_INFO[reward.rewardPart.slot].shortName}`}
                    amount={reward.rewardSpareParts > 0 ? '已自动回收' : 1}
                  />
                ) : null}
                {reward.rewardSpareParts > 0 ? (
                  <ResourceAmount
                    kind="spare-parts"
                    amount={`+${reward.rewardSpareParts}`}
                  />
                ) : null}
              </div>
            ) : (
              <p>奖励结算中…</p>
            )
          ) : state.status === 'defeat' ? (
            <>
              <p>
                {state.reason === 'escaped'
                  ? '目标已经逃脱'
                  : state.reason === 'destroyed'
                    ? '车辆耐久耗尽'
                    : state.reason === 'timeout'
                      ? '时间耗尽'
                      : `最终排名未进入前${definition.mode === 'race' ? definition.clearMaxRank : 3}`}
              </p>
              <p>前往养成提升车辆与配件后再来挑战。</p>
            </>
          ) : null}
          <div>
            {state.status === 'defeat' ? (
              <>
                {!isPrologue ? (
                  <button type="button" onClick={onDevelop}>
                    前往养成
                  </button>
                ) : null}
                <button type="button" onClick={retry}>
                  重新挑战
                </button>
              </>
            ) : null}
            <button type="button" onClick={onExit}>
              {isRoleChallenge ? '退出挑战' : isPrologue ? '继续剧情' : '离开'}
            </button>
            {state.status === 'victory' && isRoleChallenge ? (
              <button type="button" onClick={onRoleChallengeVictory}>
                完成竞速交接
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
