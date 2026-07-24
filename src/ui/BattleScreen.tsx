import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState, type JSX } from 'react'
import { getFirstClearReward } from '../config/campaignConfig'
import { combatConfig } from '../config/combatConfig'
import {
  buildBattleInput,
  simulateBattle,
  type BattleResult,
  type UnitSnapshot,
} from '../game/combat/battleEngine'
import { getGangLevel } from '../game/gangProgression'
import { BattleScene } from '../scene/battle/BattleScene'
import { usePrefersReducedMotion } from '../scene/city/usePrefersReducedMotion'
import { useAdventureStore } from '../store/useAdventureStore'
import { useGangStore } from '../store/useGangStore'
import { BattleErrorBoundary } from './BattleErrorBoundary'
import { BattleHud, type PlaybackSpeed } from './BattleHud'

export interface BattleScreenProps {
  stage: number
  onExit: () => void
}

type Phase = 'running' | 'paused' | 'resolved'

type BootState =
  { ok: true; result: BattleResult } | { ok: false; error: string }

function bootBattle(stage: number): BootState {
  try {
    const gangLevel = getGangLevel(useGangStore.getState().totalReputation)
    const adventure = useAdventureStore.getState()
    const input = buildBattleInput(
      stage,
      adventure.formation,
      adventure.heroLevels,
      gangLevel,
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
}: BattleScreenProps): JSX.Element {
  return (
    <BattleErrorBoundary key={stage} onExit={onExit}>
      <BattleScreenSession stage={stage} onExit={onExit} />
    </BattleErrorBoundary>
  )
}

function BattleScreenSession({
  stage,
  onExit,
}: BattleScreenProps): JSX.Element {
  const recordVictory = useAdventureStore((s) => s.recordVictory)
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
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [showStart, setShowStart] = useState(() => !(boot.ok && reducedMotion))
  const committedRef = useRef(false)

  const result = boot.ok ? boot.result : null
  const phase: Phase =
    result && currentTick >= result.endedAtTick
      ? 'resolved'
      : paused
        ? 'paused'
        : 'running'

  useEffect(() => {
    if (!result) return
    if (currentTick < result.endedAtTick || committedRef.current) return
    committedRef.current = true
    if (result.outcome === 'victory') {
      recordVictory(stage, Date.now())
    }
  }, [currentTick, recordVictory, result, stage])

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
      : (result?.timeline[0]?.units ?? [])

  const firstClear =
    boot.ok &&
    boot.result.outcome === 'victory' &&
    phase === 'resolved' &&
    highestClearedStage >= stage &&
    highestBefore < stage
  const rewardExp = firstClear ? getFirstClearReward(stage) : 0

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
    <div className="battle-screen" role="dialog" aria-label="战斗">
      <div className="battle-screen__canvas-wrap">
        <Canvas
          className="battle-screen__canvas"
          orthographic
          camera={{ position: [0, 12, 0], zoom: 40, near: 0.1, far: 80 }}
        >
          <BattleScene result={boot.result} currentTick={currentTick} />
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
          {firstClear ? <p>{`首通奖励 英雄经验 ${rewardExp}`}</p> : null}
          <button type="button" onClick={onExit}>
            继续
          </button>
        </div>
      ) : null}

      <BattleHud
        phase={phase}
        speed={speed}
        onTogglePause={() => setPaused((value) => !value)}
        onSetSpeed={setSpeed}
        onRequestExit={onExit}
        units={units}
      />
    </div>
  )
}
