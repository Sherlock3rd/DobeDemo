import { useEffect, useState, type CSSProperties, type JSX } from 'react'
import gangPortraitAtlas from '../assets/peaky-blinders-hierarchy-atlas.png'
import boInvitationArtwork from '../assets/prologue-bo-invitation.png'
import policeChaseArtwork from '../assets/prologue-police-chase.png'
import type { NarrativeEvent } from '../game/narrative'
import { useInitialFocus } from './useInitialFocus'

interface NarrativeDialogueOverlayProps {
  event: NarrativeEvent
  onComplete: () => void
}

const ARTWORK_BY_ID = {
  'police-chase': policeChaseArtwork,
  'bo-invitation': boInvitationArtwork,
} as const

function portraitStyle(index: number): CSSProperties {
  const column = index % 4
  const row = Math.floor(index / 4)
  return {
    backgroundImage: `url(${gangPortraitAtlas})`,
    backgroundPosition: `${(column / 3) * 100}% ${row * 100}%`,
  }
}

export function NarrativeDialogueOverlay({
  event,
  onComplete,
}: NarrativeDialogueOverlayProps): JSX.Element {
  const [lineIndex, setLineIndex] = useState(0)
  const actionRef = useInitialFocus<HTMLButtonElement>()
  const line = event.lines[lineIndex]
  const isLastLine = lineIndex === event.lines.length - 1
  const startsChapter = event.id.startsWith('chapter-start:')
  const opensTaskPackages = event.id === 'special-vote:formal-member'
  const returnsToAssessment = event.id.startsWith('special-vote:')
  const startsPoliceRace = event.id === 'prologue:police-chase'

  useEffect(() => {
    const onKeyDown = (keyboardEvent: KeyboardEvent): void => {
      if (keyboardEvent.key === 'Escape') {
        onComplete()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onComplete])

  return (
    <div className="narrative-dialogue__overlay">
      <section
        className={
          event.artwork
            ? 'narrative-dialogue narrative-dialogue--cinematic'
            : 'narrative-dialogue'
        }
        role="dialog"
        aria-modal="true"
        aria-label={`剧情对话：${event.title}`}
      >
        {event.artwork ? (
          <img
            className="narrative-dialogue__artwork"
            src={ARTWORK_BY_ID[event.artwork]}
            alt={
              event.artwork === 'police-chase'
                ? 'Thomas 骑摩托逃离警察追击'
                : '金发骑手博指向小镇修车厂'
            }
          />
        ) : null}
        <div
          className="narrative-dialogue__portrait"
          style={portraitStyle(line.portraitIndex)}
          aria-label={line.speaker}
          role="img"
        />
        <div className="narrative-dialogue__content">
          <span className="narrative-dialogue__kicker">{event.kicker}</span>
          <h2>{event.title}</h2>
          <div className="narrative-dialogue__speaker">
            <strong>{line.speaker}</strong>
            <small>{line.speakerRole}</small>
          </div>
          <p key={`${event.id}-${lineIndex}`}>{line.text}</p>
          <div className="narrative-dialogue__footer">
            <span>{`${lineIndex + 1} / ${event.lines.length}`}</span>
            <button
              ref={actionRef}
              type="button"
              onClick={() => {
                if (isLastLine) {
                  onComplete()
                } else {
                  setLineIndex((current) => current + 1)
                }
              }}
            >
              {isLastLine
                ? opensTaskPackages
                  ? '查看下一章任务包'
                  : returnsToAssessment
                    ? '继续评定会议'
                    : startsPoliceRace
                      ? '冲出包围'
                      : startsChapter
                        ? '开始章节行动'
                        : '开始行动'
                : '下一句'}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="narrative-dialogue__skip"
          aria-label="跳过剧情对话"
          onClick={onComplete}
        >
          跳过
        </button>
      </section>
    </div>
  )
}
