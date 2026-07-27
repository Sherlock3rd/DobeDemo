import { useState, type CSSProperties, type JSX } from 'react'
import gangPortraitAtlas from '../assets/peaky-blinders-hierarchy-atlas.png'
import { getGangCoreSeat } from '../game/gangHierarchy'
import { getGangRole } from '../game/gangProgression'
import {
  getRoleHandoverAccessibleName,
  type RoleHandoverDefinition,
} from '../game/roleHandover'
import { useInitialFocus } from './useInitialFocus'

export interface RoleHandoverOverlayProps {
  handover: RoleHandoverDefinition
  onCancel: () => void
  onCompleteDialogue: () => void
  onStartChallenge: () => void
}

function portraitStyle(index: number): CSSProperties {
  const column = index % 4
  const row = Math.floor(index / 4)
  return {
    backgroundImage: `url(${gangPortraitAtlas})`,
    backgroundPosition: `${(column / 3) * 100}% ${row * 100}%`,
  }
}

export function RoleHandoverOverlay({
  handover,
  onCancel,
  onCompleteDialogue,
  onStartChallenge,
}: RoleHandoverOverlayProps): JSX.Element {
  const [lineIndex, setLineIndex] = useState(0)
  const titleRef = useInitialFocus<HTMLHeadingElement>()
  const seat = getGangCoreSeat(handover.targetLevel)
  const role = getGangRole(handover.targetLevel)
  const line = handover.lines[lineIndex]
  const isLastLine = lineIndex === handover.lines.length - 1

  return (
    <div className="role-handover__overlay">
      <section
        className="role-handover"
        role="dialog"
        aria-label={getRoleHandoverAccessibleName(handover.targetLevel)}
        data-mode={handover.mode}
      >
        <header>
          <span>CHAIN OF COMMAND · HANDOVER</span>
          <strong>{handover.modeLabel}</strong>
          <button type="button" onClick={onCancel}>
            暂不交接
          </button>
        </header>

        <div className="role-handover__portraits" aria-hidden="true">
          <div style={portraitStyle(seat.portraitIndex)} />
          <span>→</span>
          <div style={portraitStyle(0)} />
        </div>

        <div className="role-handover__content">
          <span>{`Lv.${handover.targetLevel} · ${role.title}`}</span>
          <h2 ref={titleRef} tabIndex={-1}>
            {handover.title}
          </h2>
          <p>{handover.summary}</p>
          <article>
            <strong>{line.speaker}</strong>
            <p>{line.text}</p>
          </article>
          <footer>
            <small>{`${seat.holder} → Thomas Shelby · ${role.chineseTitle}席位`}</small>
            {handover.mode === 'dialogue' ? (
              <button
                type="button"
                onClick={() => {
                  if (isLastLine) {
                    onCompleteDialogue()
                  } else {
                    setLineIndex((current) => current + 1)
                  }
                }}
              >
                {isLastLine ? '确认和平交接' : '下一句'}
              </button>
            ) : (
              <button type="button" onClick={onStartChallenge}>
                {handover.mode === 'battle'
                  ? '开始推关挑战'
                  : '开始 SUP 竞速挑战'}
              </button>
            )}
          </footer>
        </div>
      </section>
    </div>
  )
}
