import { useEffect, useState, type JSX } from 'react'
import type { UnitSnapshot } from '../game/combat/battleEngine'

export type PlaybackSpeed = 1 | 2

export interface BattleHudProps {
  phase: 'running' | 'paused' | 'resolved'
  speed: PlaybackSpeed
  onTogglePause: () => void
  onSetSpeed: (speed: PlaybackSpeed) => void
  onRequestExit: () => void
  units: UnitSnapshot[]
}

function cooldownSeconds(unit: UnitSnapshot): number {
  if (unit.cooldownRemaining <= 0) return 0
  return Math.ceil(unit.cooldownRemaining / 10)
}

export function BattleHud({
  phase,
  speed,
  onTogglePause,
  onSetSpeed,
  onRequestExit,
  units,
}: BattleHudProps): JSX.Element {
  const [confirmExit, setConfirmExit] = useState(false)
  const allies = units.filter((u) => u.side === 'ally')

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (confirmExit) {
        onRequestExit()
        return
      }
      setConfirmExit(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmExit, onRequestExit])

  return (
    <section className="battle-hud" aria-label="战斗控制">
      <div className="battle-hud__controls">
        <button
          type="button"
          className="battle-hud__pause"
          onClick={onTogglePause}
          disabled={phase === 'resolved'}
        >
          {phase === 'paused' ? '继续' : '暂停'}
        </button>
        <div className="battle-hud__speed" role="group" aria-label="播放速度">
          <button
            type="button"
            aria-pressed={speed === 1}
            onClick={() => onSetSpeed(1)}
          >
            1x
          </button>
          <button
            type="button"
            aria-pressed={speed === 2}
            onClick={() => onSetSpeed(2)}
          >
            2x
          </button>
        </div>
        {!confirmExit ? (
          <button
            type="button"
            className="battle-hud__exit"
            onClick={() => setConfirmExit(true)}
          >
            退出
          </button>
        ) : (
          <div className="battle-hud__exit-confirm">
            <button type="button" onClick={onRequestExit}>
              确认退出
            </button>
            <button type="button" onClick={() => setConfirmExit(false)}>
              取消
            </button>
          </div>
        )}
      </div>

      <div className="battle-hud__portraits" aria-label="我方英雄状态">
        {allies.map((unit) => {
          const ready = unit.cooldownRemaining <= 0 && unit.alive
          const seconds = cooldownSeconds(unit)
          const fill =
            unit.cooldownTotal > 0
              ? 1 - unit.cooldownRemaining / unit.cooldownTotal
              : 1
          return (
            <div
              key={`${unit.side}-${unit.globalIndex}`}
              className={
                ready
                  ? 'battle-hud__portrait battle-hud__portrait--ready'
                  : 'battle-hud__portrait'
              }
              aria-label={`生命 ${unit.hp}/${unit.maxHp}，技能冷却 ${seconds} 秒`}
            >
              <div
                className="battle-hud__hp"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={unit.maxHp}
                aria-valuenow={unit.hp}
              >
                <span style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }} />
              </div>
              <div
                className="battle-hud__cd"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(fill * 100)}
              >
                <span style={{ width: `${fill * 100}%` }} />
              </div>
              <span className="battle-hud__cd-label">
                {ready ? '就绪' : String(seconds)}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
