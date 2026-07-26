import { useEffect, useMemo, useState, type JSX } from 'react'
import { CAR_PART_QUALITY_INFO } from '../game/equipmentProgression'
import {
  CHAPTERS,
  getChapterForGangLevel,
  getTaskProgress,
  type ChapterPartReward,
} from '../game/chapterProgression'
import { useAdventureStore } from '../store/useAdventureStore'
import { useChapterStore } from '../store/useChapterStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { useInitialFocus } from './useInitialFocus'

export interface ChapterPanelProps {
  onClose: () => void
}

const TITLE_ID = 'chapter-panel-title'

const SLOT_NAMES = {
  tires: '轮胎',
  engine: '引擎',
  bumper: '保险杠',
  suspension: '悬挂',
}

function partRewardLabel(part: ChapterPartReward): string {
  return `${CAR_PART_QUALITY_INFO[part.quality].name}${SLOT_NAMES[part.slot]}`
}

export function ChapterPanel({ onClose }: ChapterPanelProps): JSX.Element {
  const currentLevel = useGangStore((state) => state.currentLevel)
  const heroLevels = useAdventureStore((state) => state.heroLevels)
  const gunLevels = useAdventureStore((state) => state.gunLevels)
  const carPartInventory = useAdventureStore((state) => state.carPartInventory)
  const highestClearedStage = useAdventureStore(
    (state) => state.highestClearedStage,
  )
  const highestClearedRacingStage = useAdventureStore(
    (state) => state.highestClearedRacingStage,
  )
  const buildingProgress = useCityStore((state) => state.buildingProgress)
  const claimedTaskIds = useChapterStore((state) => state.claimedTaskIds)
  const claimTask = useChapterStore((state) => state.claimTask)
  const [feedback, setFeedback] = useState('')
  const titleRef = useInitialFocus<HTMLHeadingElement>()
  const chapter = getChapterForGangLevel(currentLevel)
  const snapshot = useMemo(
    () => ({
      heroLevels,
      gunLevels,
      carPartInventory,
      highestClearedStage,
      highestClearedRacingStage,
      buildingProgress,
    }),
    [
      buildingProgress,
      carPartInventory,
      gunLevels,
      heroLevels,
      highestClearedRacingStage,
      highestClearedStage,
    ],
  )
  const taskProgress = chapter.tasks.map((task) =>
    getTaskProgress(task, snapshot),
  )
  const completedCount = taskProgress.filter(
    (progress) => progress.complete,
  ).length

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <section className="chapter-panel" role="dialog" aria-labelledby={TITLE_ID}>
      <header className="chapter-panel__header">
        <div>
          <p className="chapter-panel__eyebrow">
            {`${chapter.role.title} · ${chapter.role.chineseTitle}`}
          </p>
          <h2
            ref={titleRef}
            id={TITLE_ID}
            className="chapter-panel__title"
            tabIndex={-1}
          >
            {chapter.title}
          </h2>
        </div>
        <button
          type="button"
          className="chapter-panel__close"
          aria-label="关闭章节任务"
          onClick={onClose}
        >
          返回城市
        </button>
      </header>

      <nav className="chapter-panel__rail" aria-label="章节进度">
        {CHAPTERS.map((candidate) => {
          const state =
            candidate.number < chapter.number
              ? 'completed'
              : candidate.number === chapter.number
                ? 'current'
                : 'locked'
          return (
            <span
              key={candidate.number}
              className="chapter-panel__rail-item"
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {candidate.number}
            </span>
          )
        })}
      </nav>

      <div className="chapter-panel__story">
        <p>{chapter.story}</p>
        <strong>{`已完成 ${completedCount}/${chapter.tasks.length}`}</strong>
      </div>

      <div className="chapter-panel__tasks">
        {chapter.tasks.map((task, index) => {
          const progress = taskProgress[index]
          const claimed = claimedTaskIds.includes(task.id)
          const parts = task.reward.carParts.map(partRewardLabel)
          return (
            <article
              key={task.id}
              className="chapter-panel__task"
              data-state={
                claimed ? 'claimed' : progress.complete ? 'complete' : 'active'
              }
            >
              <div className="chapter-panel__task-copy">
                <span className="chapter-panel__task-index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3>{task.name}</h3>
                  <p>{task.description}</p>
                  <small>
                    {`奖励：帮派经验 +${task.reward.gangReputation} · 英雄经验 +${task.reward.heroExperience} · 零件 +${task.reward.spareParts}`}
                    {parts.length > 0 ? ` · ${parts.join('、')}` : ''}
                  </small>
                </div>
              </div>
              <div className="chapter-panel__task-action">
                <span
                  className="chapter-panel__task-progress"
                  aria-label={`${task.name}进度`}
                >
                  {`${progress.current}/${progress.target}`}
                </span>
                <button
                  type="button"
                  disabled={!progress.complete || claimed}
                  onClick={() => {
                    if (claimTask(task.id)) {
                      setFeedback(`${task.name}奖励已领取`)
                    }
                  }}
                >
                  {claimed ? '已领取' : progress.complete ? '领取' : '进行中'}
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <p className="chapter-panel__feedback" aria-live="polite">
        {feedback ||
          (completedCount === chapter.tasks.length
            ? chapter.nextRoleLevel
              ? '本章任务已完成，可前往帮派树晋升职级。'
              : '全部章节任务已完成，PRESIDENT 的传奇仍在继续。'
            : '完成任务后在此领取奖励。')}
      </p>
    </section>
  )
}
