import { useEffect, useRef, type JSX } from 'react'
import { STORY_RANKS, getStoryRank } from '../game/storyPlanB'

export function StoryGangTreePanel({
  currentStepNumber,
  canContinue,
  onContinue,
  onClose,
}: {
  currentStepNumber: number
  canContinue: boolean
  onContinue: () => void
  onClose: () => void
}): JSX.Element {
  const currentRank = getStoryRank(currentStepNumber)
  const currentRankRef = useRef<HTMLLIElement | null>(null)

  useEffect(() => {
    currentRankRef.current?.scrollIntoView({ block: 'center' })
  }, [currentRank.tier])

  return (
    <div className="story-gang__overlay">
      <section
        className="story-gang"
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-gang-title"
      >
        <header>
          <div>
            <span>STEPS OF POWER</span>
            <h2 id="story-gang-title">帮派权力树</h2>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="story-gang__summary">
          <span>当前职级</span>
          <strong>{`${currentRank.title} · ${currentRank.chineseTitle}`}</strong>
          <p>{currentRank.duty}</p>
        </div>
        <div className="story-gang__scroll">
          <ol className="story-gang__ranks">
            {[...STORY_RANKS].reverse().map((rank) => {
              const state =
                rank.tier < currentRank.tier
                  ? 'complete'
                  : rank.tier === currentRank.tier
                    ? 'current'
                    : 'locked'
              return (
                <li
                  key={rank.tier}
                  ref={state === 'current' ? currentRankRef : undefined}
                  data-state={state}
                >
                  <span>{`T${rank.tier}`}</span>
                  <div>
                    <strong>{rank.title}</strong>
                    <small>{rank.chineseTitle}</small>
                  </div>
                  <p>
                    {state === 'locked' ? '完成前一职级职责后公开' : rank.duty}
                  </p>
                  <em>
                    {state === 'current'
                      ? '你在这里'
                      : state === 'complete'
                        ? '已完成交接'
                        : '未解锁'}
                  </em>
                </li>
              )
            })}
          </ol>
        </div>
        <footer>
          <span>所有建筑始终属于帮派；职位决定你的管理权限。</span>
          {canContinue ? (
            <button type="button" onClick={onContinue}>
              了解职位结构
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  )
}
