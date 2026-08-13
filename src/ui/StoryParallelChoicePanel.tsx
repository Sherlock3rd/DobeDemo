import type { JSX } from 'react'
import type { ParallelStoryOrder } from '../game/storyPlanC'

const OPTIONS: readonly {
  order: ParallelStoryOrder
  eyebrow: string
  title: string
  detail: string
}[] = [
  {
    order: 'industry-first',
    eyebrow: 'L19–L21',
    title: '先做产业管理线',
    detail: '确认两名管理者，任意顺序接管改装厂与废车厂，再完成废车厂自动化。',
  },
  {
    order: 'investigation-first',
    eyebrow: 'L22–L24',
    title: '先做内奸调查线',
    detail: '获得 Maeve 协助，连续推关寻找线索，再完成挡风玻璃逼问。',
  },
]

export function StoryParallelChoicePanel({
  onChoose,
}: {
  onChoose: (order: ParallelStoryOrder) => void
}): JSX.Element {
  return (
    <div className="story-roadmap__overlay">
      <section
        className="story-roadmap story-parallel-choice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-parallel-title"
      >
        <header>
          <div>
            <span>PLAN C · PARALLEL WINDOW</span>
            <h2 id="story-parallel-title">选择先执行的任务线</h2>
          </div>
        </header>
        <p>
          两条线都必须完成，选择只决定先后顺序。第一条结束后会自动切换到另一条，
          两线完成才开放 L25。
        </p>
        <ol className="story-roadmap__steps">
          {OPTIONS.map((option) => (
            <li key={option.order} data-state="current">
              <span>{option.eyebrow}</span>
              <div>
                <strong>{option.title}</strong>
                <small>{option.detail}</small>
                <button type="button" onClick={() => onChoose(option.order)}>
                  {option.title}
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
