import { useState, type JSX } from 'react'
import { useInitialFocus } from './useInitialFocus'

export interface PrologueShootOverlayProps {
  onComplete: () => void
}

const REQUIRED_HITS = 3

export function PrologueShootOverlay({
  onComplete,
}: PrologueShootOverlayProps): JSX.Element {
  const [hits, setHits] = useState(0)
  const targetRef = useInitialFocus<HTMLButtonElement>()

  const fire = (): void => {
    const nextHits = Math.min(REQUIRED_HITS, hits + 1)
    setHits(nextHits)
    if (nextHits >= REQUIRED_HITS) onComplete()
  }

  return (
    <section
      className="prologue-shoot"
      role="dialog"
      aria-modal="true"
      aria-label="借枪射击敌方摩托"
      data-hits={hits}
    >
      <header>
        <span>BORROWED GUN · LIVE TARGET</span>
        <h2>打掉追兵的摩托</h2>
        <p>博把枪借给了你。点击敌方摩托三次，别让他跟回修车厂。</p>
      </header>
      <div className="prologue-shoot__road" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <button
        ref={targetRef}
        type="button"
        className="prologue-shoot__target"
        onClick={fire}
        aria-label={`射击敌方摩托，命中 ${hits}/${REQUIRED_HITS}`}
      >
        <span className="prologue-shoot__rider" aria-hidden="true">
          <i />
          <b />
          <em />
        </span>
        <strong>{hits > 0 ? '继续射击' : '点击开火'}</strong>
        <small>{`${hits}/${REQUIRED_HITS}`}</small>
      </button>
      <div className="prologue-shoot__weapon" aria-hidden="true">
        <span />
        <b />
      </div>
      <p className="prologue-shoot__status" role="status">
        {hits === 0
          ? '准星已经压住车尾'
          : hits < REQUIRED_HITS
            ? `命中！还差 ${REQUIRED_HITS - hits} 枪`
            : '敌方摩托失控'}
      </p>
    </section>
  )
}
