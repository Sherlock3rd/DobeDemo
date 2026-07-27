import { useEffect, useState, type JSX } from 'react'
import { equipmentConfig } from '../config/equipmentConfig'
import { CAR_PART_QUALITY_INFO } from '../game/equipmentProgression'
import {
  getChapterByNumber,
  getChapterTasks,
  getTaskProgress,
  type ChapterPartReward,
  type ChapterTaskRequirement,
} from '../game/chapterProgression'
import { useAdventureStore } from '../store/useAdventureStore'
import {
  getChapterProgressSnapshot,
  useChapterStore,
} from '../store/useChapterStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { useInitialFocus } from './useInitialFocus'

export interface ChapterPanelProps {
  onClose: () => void
  onNavigateTask: (requirement: ChapterTaskRequirement) => void
  onChapterCompleted?: (chapterNumber: number) => void
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

function requireChapter(chapterNumber: number) {
  const chapter = getChapterByNumber(chapterNumber)
  if (!chapter) throw new Error(`Unknown active chapter ${chapterNumber}`)
  return chapter
}

function taskDestinationLabel(requirement: ChapterTaskRequirement): string {
  switch (requirement.kind) {
    case 'hero-level':
      return '英雄升级'
    case 'part-level':
    case 'part-upgrades':
      return '配件强化'
    case 'gun-level':
      return '枪械强化'
    case 'building-level':
      return '对应建筑'
    case 'campaign-clears':
      return '推关'
    case 'racing-clears':
      return 'SUP'
    case 'gang-level':
      return '帮派树'
    case 'resource-money':
    case 'resource-oil':
    case 'resource-materials':
      return '城市产业'
    case 'spare-parts':
      return '零件养成'
    case 'total-power':
    case 'car-power':
      return '英雄装备'
  }
}

export function ChapterPanel({
  onClose,
  onNavigateTask,
  onChapterCompleted,
}: ChapterPanelProps): JSX.Element {
  useAdventureStore()
  useCityStore()
  useGangStore()
  const activeChapterNumber = useChapterStore(
    (state) => state.activeChapterNumber,
  )
  const selectedTaskPackageIds = useChapterStore(
    (state) => state.selectedTaskPackageIds,
  )
  const claimedTaskIds = useChapterStore((state) => state.claimedTaskIds)
  const claimedChapterNumbers = useChapterStore(
    (state) => state.claimedChapterNumbers,
  )
  const claimTask = useChapterStore((state) => state.claimTask)
  const claimChapterReward = useChapterStore(
    (state) => state.claimChapterReward,
  )
  const [feedback, setFeedback] = useState('')
  const titleRef = useInitialFocus<HTMLHeadingElement>()
  const chapter = requireChapter(activeChapterNumber)
  const tasks = getChapterTasks(
    chapter.number,
    selectedTaskPackageIds[chapter.number],
  )
  const snapshot = getChapterProgressSnapshot()
  const taskProgress = tasks.map((task) => getTaskProgress(task, snapshot))
  const completedCount = taskProgress.filter(
    (progress) => progress.complete,
  ).length
  const allTasksComplete = tasks.length > 0 && completedCount === tasks.length
  const chapterRewardClaimed = claimedChapterNumbers.includes(chapter.number)
  const completionParts = chapter.completionReward.carParts.map(partRewardLabel)
  const completionUnlocks = [
    ...chapter.completionReward.unlockCarIds.map(
      (carId) => `载具·${equipmentConfig.cars[carId].name}`,
    ),
    ...chapter.completionReward.unlockGunIds.map(
      (gunId) => `枪械·${equipmentConfig.guns[gunId].name}`,
    ),
  ]

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

      <div
        className="chapter-panel__current"
        role="status"
        aria-label={`当前第 ${chapter.number} 章`}
      >
        <span>CURRENT CHAPTER</span>
        <strong>{`当前第 ${chapter.number} 章`}</strong>
      </div>

      <div className="chapter-panel__story">
        <p>{chapter.story}</p>
        <strong>{`已完成 ${completedCount}/${tasks.length}`}</strong>
      </div>

      <div className="chapter-panel__tasks">
        {tasks.map((task, index) => {
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
                {!progress.complete && (
                  <button
                    type="button"
                    className="chapter-panel__task-go"
                    onClick={() => onNavigateTask(task.requirement)}
                  >
                    {`前往${taskDestinationLabel(task.requirement)}`}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <section
        className="chapter-panel__completion"
        data-state={
          chapterRewardClaimed
            ? 'claimed'
            : allTasksComplete
              ? 'claimable'
              : 'locked'
        }
        aria-label="章节完成奖励"
      >
        <div>
          <span>CHAPTER CLEAR</span>
          <h3>章节完成奖励</h3>
          <p>
            {`帮派经验 +${chapter.completionReward.gangReputation} · 英雄经验 +${chapter.completionReward.heroExperience} · 零件 +${chapter.completionReward.spareParts}`}
          </p>
          <p>
            {`钱 +${chapter.completionReward.resources.money} · 油 +${chapter.completionReward.resources.oil} · 物资 +${chapter.completionReward.resources.materials}`}
          </p>
          {[...completionParts, ...completionUnlocks].length > 0 ? (
            <strong>
              {[...completionParts, ...completionUnlocks].join(' · ')}
            </strong>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!allTasksComplete || chapterRewardClaimed}
          onClick={() => {
            if (claimChapterReward(chapter.number)) {
              setFeedback(`${chapter.title}完成奖励已领取`)
              onChapterCompleted?.(chapter.number)
            }
          }}
        >
          {chapterRewardClaimed
            ? '章节已完成'
            : allTasksComplete
              ? chapter.number < 7
                ? '完成章节并参加评定会议'
                : '完成最终章节'
              : '完成全部任务后继续'}
        </button>
      </section>

      <p className="chapter-panel__feedback" aria-live="polite">
        {feedback ||
          (allTasksComplete
            ? chapterRewardClaimed
              ? chapter.nextRoleLevel
                ? '章节已完成，即将进入评定会议。'
                : '全部章节已经完成，PRESIDENT 的传奇仍在继续。'
              : chapter.number < 7
                ? '任务已全部完成，可以参加评定会议。'
                : '任务已全部完成，可以完成最终章节。'
            : '完成任务后在此领取奖励。')}
      </p>
    </section>
  )
}
