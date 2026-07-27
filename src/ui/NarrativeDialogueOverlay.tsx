import { useEffect, useState, type CSSProperties, type JSX } from 'react'
import gangPortraitAtlas from '../assets/peaky-blinders-hierarchy-atlas.png'
import type { NarrativeEvent } from '../game/narrative'
import { useInitialFocus } from './useInitialFocus'

interface NarrativeDialogueOverlayProps {
  event: NarrativeEvent
  onComplete: () => void
}

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
        className="narrative-dialogue"
        role="dialog"
        aria-modal="true"
        aria-label={`剧情对话：${event.title}`}
      >
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
              {isLastLine ? '开始行动' : '下一句'}
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
