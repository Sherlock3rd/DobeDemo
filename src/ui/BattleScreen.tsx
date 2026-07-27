import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { getNextCampaignStage } from '../config/campaignConfig'
import { combatConfig } from '../config/combatConfig'
import {
  buildBattleInput,
  simulateBattle,
  type BattleResult,
  type UnitSnapshot,
} from '../game/combat/battleEngine'
import {
  CAR_PART_QUALITY_INFO,
  CAR_PART_SLOT_INFO,
} from '../game/equipmentProgression'
import { BattleScene } from '../scene/battle/BattleScene'
import { BATTLE_CAMERA_CONFIG } from '../scene/battle/battleCamera'
import type { BattlePresentationFrame } from '../scene/battle/BattleEffects'
import { usePrefersReducedMotion } from '../scene/city/usePrefersReducedMotion'
import { useAdventureStore } from '../store/useAdventureStore'
import { useGangStore } from '../store/useGangStore'
import { BattleErrorBoundary } from './BattleErrorBoundary'
import { BattleHud, type PlaybackSpeed } from './BattleHud'
import { ResourceAmount } from './ResourceAmount'

export interface BattleScreenProps {
  stage: number
  onExit: () => void
  onNext?: (stage: number) => void
  onDevelop?: () => void
}

type Phase = 'running' | 'paused' | 'resolved'

type BootState =
  { ok: true; result: BattleResult } | { ok: false; error: string }

function bootBattle(stage: number): BootState {
  try {
    const gangLevel = useGangStore.getState().currentLevel
    const adventure = useAdventureStore.getState()
    const input = buildBattleInput(
      stage,
      adventure.formation,
      adventure.heroLevels,
      gangLevel,
      adventure.equipmentByHero,
      adventure,
    )
    return { ok: true, result: simulateBattle(input) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '战斗初始化失败',
    }
  }
}

export function BattleScreen({
  stage,
  onExit,
  onNext,
  onDevelop = onExit,
}: BattleScreenProps): JSX.Element {
  return (
    <BattleErrorBoundary key={stage} onExit={onExit}>
      <BattleScreenSession
        stage={stage}
        onExit={onExit}
        onNext={onNext}
        onDevelop={onDevelop}
      />
    </BattleErrorBoundary>
  )
}

function BattleScreenSession({
  stage,
  onExit,
  onNext,
  onDevelop = onExit,
}: BattleScreenProps): JSX.Element {
  const recordVictory = useAdventureStore((s) => s.recordVictory)
  const lastVictoryReward = useAdventureStore((s) => s.lastVictoryReward)
  const highestClearedStage = useAdventureStore((s) => s.highestClearedStage)
  const reducedMotion = usePrefersReducedMotion()
  const [boot] = useState(() => bootBattle(stage))
  const [highestBefore] = useState(
    () => useAdventureStore.getState().highestClearedStage,
  )
  const [currentTick, setCurrentTick] = useState(() =>
    boot.ok && reducedMotion ? boot.result.endedAtTick : 0,
  )
  const [paused, setPaused] = useState(false)
  const [exitPending, setExitPending] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [showStart, setShowStart] = useState(() => !(boot.ok && reducedMotion))
  const [presentedEffects, setPresentedEffects] = useState({
    basicSeen: false,
    skillSeen: false,
    currentBasic: false,
    currentSkill: false,
    eventKey: 0,
  })
  const committedRef = useRef(false)

  const handleEffectsPresented = useCallback(
    (frame: BattlePresentationFrame): void => {
      setPresentedEffects((current) => ({
        basicSeen: current.basicSeen || frame.basicActive,
        skillSeen: current.skillSeen || frame.skillActive,
        currentBasic: frame.basicActive,
        currentSkill: frame.skillActive,
        eventKey: frame.eventKey,
      }))
    },
    [],
  )

  const result = boot.ok ? boot.result : null
  const phase: Phase =
    exitPending || paused
      ? 'paused'
      : result && currentTick >= result.endedAtTick
        ? 'resolved'
        : 'running'

  useEffect(() => {
    if (!result) return
    if (exitPending) return
    if (currentTick < result.endedAtTick || committedRef.current) return
    committedRef.current = true
    if (result.outcome === 'victory') {
      recordVictory(stage, Date.now())
    }
  }, [currentTick, exitPending, recordVictory, result, stage])

  useEffect(() => {
    if (!result || phase !== 'running') return

    const id = window.setInterval(() => {
      setCurrentTick((tick) => {
        if (tick >= result.endedAtTick) return tick
        return Math.min(result.endedAtTick, tick + speed)
      })
    }, combatConfig.tickMs)

    return () => window.clearInterval(id)
  }, [phase, result, speed])

  useEffect(() => {
    if (!showStart || reducedMotion || !boot.ok) return
    const id = window.setTimeout(() => setShowStart(false), 600)
    return () => window.clearTimeout(id)
  }, [boot.ok, reducedMotion, showStart])

  const units: UnitSnapshot[] =
    result && currentTick > 0
      ? (result.timeline[Math.min(currentTick, result.endedAtTick) - 1]
          ?.units ?? [])
      : (result?.initialUnits ?? [])
  const replayedTimeline = result
    ? result.timeline.slice(0, Math.min(currentTick, result.endedAtTick))
    : []
  const replayMetrics = replayedTimeline.reduce(
    (metrics, tick) => {
      for (const hit of tick.hits) {
        metrics.damageEvents += 1
        if (hit.kind === 'basic') metrics.basicHits += 1
        if (hit.kind === 'skill-main') metrics.skillMainHits += 1
        if (hit.kind === 'skill-splash') metrics.skillSplashHits += 1
      }
      metrics.deaths += tick.deaths.length
      return metrics
    },
    {
      basicHits: 0,
      skillMainHits: 0,
      skillSplashHits: 0,
      damageEvents: 0,
      deaths: 0,
    },
  )

  const reward =
    lastVictoryReward?.mode === 'campaign' && lastVictoryReward.stage === stage
      ? lastVictoryReward.reward
      : null
  const firstClear =
    reward?.firstClear ??
    (boot.ok &&
      boot.result.outcome === 'victory' &&
      phase === 'resolved' &&
      highestClearedStage >= stage &&
      highestBefore < stage)
  const nextStage = getNextCampaignStage(stage)

  if (!boot.ok) {
    return (
      <div className="battle-screen" role="dialog" aria-label="战斗">
        <p role="alert">战斗初始化失败</p>
        <p>{boot.error}</p>
        <button type="button" onClick={onExit}>
          退出
        </button>
      </div>
    )
  }

  return (
    <div
      className="battle-screen"
      role="dialog"
      aria-label="战斗"
      data-stage={stage}
      data-current-tick={currentTick}
      data-ended-tick={boot.result.endedAtTick}
      data-basic-hits={replayMetrics.basicHits}
      data-skill-main-hits={replayMetrics.skillMainHits}
      data-skill-splash-hits={replayMetrics.skillSplashHits}
      data-damage-events={replayMetrics.damageEvents}
      data-deaths={replayMetrics.deaths}
      data-presented-basic={presentedEffects.basicSeen}
      data-presented-skill={presentedEffects.skillSeen}
      data-current-presented-basic={presentedEffects.currentBasic}
      data-current-presented-skill={presentedEffects.currentSkill}
      data-presented-event-key={presentedEffects.eventKey}
    >
      <div className="battle-screen__canvas-wrap">
        <Canvas className="battle-screen__canvas" camera={BATTLE_CAMERA_CONFIG}>
          <BattleScene
            result={boot.result}
            currentTick={currentTick}
            onEffectsPresented={handleEffectsPresented}
          />
        </Canvas>
      </div>

      {showStart && phase !== 'resolved' ? (
        <p className="battle-screen__banner" aria-live="polite">
          START
        </p>
      ) : null}

      {phase === 'resolved' ? (
        <div className="battle-screen__result" role="status">
          <p>
            {boot.result.outcome === 'victory'
              ? 'VICTORY · 胜利'
              : 'DEFEAT · 失败'}
          </p>
          {firstClear && reward ? (
            <div className="battle-screen__rewards" aria-label="首通奖励">
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
          ) : null}
          {boot.result.outcome === 'defeat' ? (
            <p>前往养成提升英雄、车辆与装备后再来挑战。</p>
          ) : null}
          <div>
            {boot.result.outcome === 'defeat' ? (
              <button type="button" onClick={onDevelop}>
                前往养成
              </button>
            ) : null}
            <button
              type="button"
              className="battle-screen__result-exit"
              onClick={onExit}
            >
              退出
            </button>
            {boot.result.outcome === 'victory' &&
            nextStage !== null &&
            onNext ? (
              <button
                type="button"
                className="battle-screen__result-next"
                onClick={() => onNext(nextStage)}
              >
                下一关
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase !== 'resolved' ? (
        <BattleHud
          phase={phase}
          speed={speed}
          exitPending={exitPending}
          onTogglePause={() => setPaused((value) => !value)}
          onSetSpeed={setSpeed}
          onRequestExitPrompt={() => setExitPending(true)}
          onCancelExit={() => setExitPending(false)}
          onConfirmExit={onExit}
          units={units}
        />
      ) : null}
    </div>
  )
}
