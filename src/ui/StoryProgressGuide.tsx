import type { JSX } from 'react'
import type { StoryStep } from '../game/storyPlanC'

export function StoryProgressGuide({
  step,
  onContinue,
  onOpenRoadmap,
}: {
  step: StoryStep | null
  onContinue: () => void
  onOpenRoadmap: () => void
}): JSX.Element {
  if (!step) {
    return (
      <aside
        className="story-guide story-guide--complete"
        aria-label="方案 C 进度"
      >
        <strong>一日渐进完成</strong>
        <span>Thomas Shelby · President</span>
      </aside>
    )
  }

  return (
    <aside className="story-guide" aria-label="方案 C 当前任务">
      <div>
        <span>{`ACT ${step.act} · L${String(step.number).padStart(2, '0')}`}</span>
        <strong>{step.title}</strong>
        <p>{step.objective}</p>
      </div>
      <div className="story-guide__actions">
        <button type="button" onClick={onOpenRoadmap}>
          当前幕
        </button>
        <button type="button" onClick={onContinue}>
          继续
        </button>
      </div>
    </aside>
  )
}
