import { useEffect, type JSX } from 'react'
import type { UnitSnapshot } from '../game/combat/battleEngine'

export type PlaybackSpeed = 1 | 2

export interface BattleHudProps {
  phase: 'running' | 'paused' | 'resolved'
  speed: PlaybackSpeed
  exitPending: boolean
  onTogglePause: () => void
  onSetSpeed: (speed: PlaybackSpeed) => void
  onRequestExitPrompt: () => void
  onCancelExit: () => void
  onConfirmExit: () => void
  units: UnitSnapshot[]
}

export function BattleHud({
  phase,
  speed,
  exitPending,
  onTogglePause,
  onSetSpeed,
  onRequestExitPrompt,
  onCancelExit,
  onConfirmExit,
  units,
}: BattleHudProps): JSX.Element {
  const allies = units.filter((u) => u.side === 'ally')

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (exitPending) {
        onConfirmExit()
        return
      }
      onRequestExitPrompt()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exitPending, onConfirmExit, onRequestExitPrompt])

  return (
    <section className="battle-hud" aria-label="战斗控制">
      <div className="battle-hud__controls">
        <button
          type="button"
          className="battle-hud__pause"
          onClick={onTogglePause}
          disabled={phase === 'resolved' || exitPending}
        >
          {phase === 'paused' ? '继续' : '暂停'}
        </button>
        <div className="battle-hud__speed" role="group" aria-label="播放速度">
          <button
            type="button"
            aria-pressed={speed === 1}
            disabled={exitPending}
            onClick={() => onSetSpeed(1)}
          >
            1x
          </button>
          <button
            type="button"
            aria-pressed={speed === 2}
            disabled={exitPending}
            onClick={() => onSetSpeed(2)}
          >
            2x
          </button>
        </div>
        {!exitPending ? (
          <button
            type="button"
            className="battle-hud__exit"
            onClick={onRequestExitPrompt}
          >
            退出
          </button>
        ) : (
          <div className="battle-hud__exit-confirm">
            <button type="button" onClick={onConfirmExit}>
              确认退出
            </button>
            <button type="button" onClick={onCancelExit}>
              取消
            </button>
          </div>
        )}
      </div>

      <div className="battle-hud__portraits" aria-label="我方英雄状态">
        {allies.map((unit) => {
          const ready = unit.rage >= unit.maxRage && unit.alive
          const fill = unit.maxRage > 0 ? unit.rage / unit.maxRage : 0
          return (
            <div
              key={`${unit.side}-${unit.globalIndex}`}
              className={
                ready
                  ? 'battle-hud__portrait battle-hud__portrait--ready'
                  : 'battle-hud__portrait'
              }
              aria-label={`生命 ${unit.hp}/${unit.maxHp}，怒气 ${unit.rage}/${unit.maxRage}`}
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
                aria-label={`怒气 ${unit.rage}/${unit.maxRage}`}
                aria-valuemin={0}
                aria-valuemax={unit.maxRage}
                aria-valuenow={unit.rage}
              >
                <span style={{ width: `${fill * 100}%` }} />
              </div>
              <span className="battle-hud__cd-label">
                {unit.rage}/{unit.maxRage}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
