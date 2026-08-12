import { useMemo, type JSX } from 'react'
import { STORY_STEPS, getStoryStep } from '../game/storyPlanC'

const ACT_NAMES = [
  '亡命入城',
  '正式转正',
  '全员反击',
  '双线试炼',
  '营救与制裁',
  '产业恢复',
  '核心席位',
] as const

export function StoryRoadmapPanel({
  currentStepNumber,
  completedStepNumbers,
  onClose,
  onContinue,
}: {
  currentStepNumber: number
  completedStepNumbers: readonly number[]
  onClose: () => void
  onContinue: () => void
}): JSX.Element {
  const current = getStoryStep(currentStepNumber)
  const activeAct = current?.act ?? 5
  const actSteps = useMemo(
    () => STORY_STEPS.filter((step) => step.act === activeAct),
    [activeAct],
  )

  return (
    <div className="story-roadmap__overlay">
      <section
        className="story-roadmap"
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-roadmap-title"
      >
        <header>
          <div>
            <span>PLAN C · 90 MINUTES</span>
            <h2 id="story-roadmap-title">{`ACT ${activeAct} · ${ACT_NAMES[activeAct]}`}</h2>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="story-roadmap__acts" aria-label="幕进度">
          {ACT_NAMES.map((name, act) => (
            <span
              key={name}
              data-state={
                act < activeAct
                  ? 'complete'
                  : act === activeAct
                    ? 'current'
                    : 'locked'
              }
            >
              {`ACT ${act}`}
            </span>
          ))}
        </div>
        <ol className="story-roadmap__steps">
          {actSteps.map((step) => {
            const state = completedStepNumbers.includes(step.number)
              ? 'complete'
              : step.number === currentStepNumber
                ? 'current'
                : 'locked'
            return (
              <li key={step.number} data-state={state}>
                <span>{`L${String(step.number).padStart(2, '0')}`}</span>
                <div>
                  <strong>
                    {state === 'locked' ? '尚未公开' : step.title}
                  </strong>
                  <small>
                    {state === 'complete'
                      ? '已完成'
                      : state === 'current'
                        ? step.objective
                        : '完成前置节点后公开'}
                  </small>
                </div>
              </li>
            )
          })}
        </ol>
        <footer>
          <span>{`总进度 ${Math.min(STORY_STEPS.length, completedStepNumbers.length)} / ${STORY_STEPS.length}`}</span>
          {current ? (
            <button type="button" onClick={onContinue}>
              返回当前任务
            </button>
          ) : (
            <strong>方案 C 全流程已完成</strong>
          )}
        </footer>
      </section>
    </div>
  )
}
