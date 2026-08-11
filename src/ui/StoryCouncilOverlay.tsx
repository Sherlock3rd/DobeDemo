import { useMemo, useState, type JSX } from 'react'
import type { StoryStep } from '../game/storyPlanB'

const MEMBERS = ['Thomas Shelby', 'Bo Carter', 'Maeve Quinn', 'Merrill Gray']
const GRADES = ['A', 'B', 'C', 'D'] as const
const MEETING_STEPS = [10, 22, 27, 30, 35, 43] as const

function gradeFor(step: number, memberIndex: number): string {
  if (memberIndex === 0) return 'S'
  return GRADES[(step * 7 + memberIndex * 3) % GRADES.length]
}

function meetingProposal(step: StoryStep): string {
  if (step.number === 10) return 'Thomas Shelby 是否完成见习并获得正式背章？'
  if (step.number === 22) return '由谁承担执行者职责与废车回收厂管理责任？'
  if (step.number === 27) return '是否扩大 Thomas 对商业网络的管理权限？'
  if (step.number === 30) return '是否摘除叛徒 Billy 的背章并追回帮派财产？'
  if (step.number === 35) return '是否接受 Dale 辞任并由 Thomas 接管物资账？'
  if (step.number === 43) return '是否通过主席席位与全部管理责任的和平交接？'
  return '是否根据本轮行动结果提升 Thomas 的席位与职责？'
}

export function StoryCouncilOverlay({
  step,
  onComplete,
}: {
  step: StoryStep
  onComplete: () => void
}): JSX.Element {
  const [phase, setPhase] = useState<'review' | 'vote' | 'result'>(
    step.number === 10 ? 'vote' : 'review',
  )
  const ratings = useMemo(
    () =>
      MEMBERS.map((member, index) => ({
        member,
        grade: gradeFor(step.number, index),
      })),
    [step.number],
  )
  const meetingNumber = Math.max(
    1,
    MEETING_STEPS.findIndex((stepNumber) => stepNumber === step.number) + 1,
  )

  return (
    <section
      className="story-council"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-council-title"
    >
      <header>
        <span>CLUBHOUSE · ASSESSMENT</span>
        <strong>{`第 ${meetingNumber} 次评定会议`}</strong>
      </header>
      <div className="story-council__table" aria-hidden="true">
        <span>MC</span>
      </div>
      <article>
        {phase === 'review' ? (
          <>
            <p className="story-council__eyebrow">上一轮任务完成度</p>
            <h2 id="story-council-title">先评定，再讨论新的责任</h2>
            <div className="story-council__ratings">
              {ratings.map((rating) => (
                <div key={rating.member}>
                  <span>{rating.grade}</span>
                  <strong>{rating.member}</strong>
                  <small>
                    {rating.member === 'Thomas Shelby'
                      ? '玩家 · 固定 S'
                      : 'NPC · 本轮评定'}
                  </small>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setPhase('vote')}>
              公布本轮议题
            </button>
          </>
        ) : phase === 'vote' ? (
          <>
            <p className="story-council__eyebrow">本轮中性议题</p>
            <h2 id="story-council-title">{meetingProposal(step)}</h2>
            <p>
              桌边成员会依次亮出标记。表决结果由剧情固定，玩家的选择只代表
              Thomas 的态度。
            </p>
            <div className="story-council__vote-actions">
              <button type="button" onClick={() => setPhase('result')}>
                赞成
              </button>
              <button type="button" onClick={() => setPhase('result')}>
                保留意见
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="story-council__eyebrow">表决通过</p>
            <h2 id="story-council-title">锤音落下，新的职责开始生效</h2>
            <div className="story-council__votes" aria-label="表决结果">
              {MEMBERS.map((member, index) => (
                <span
                  key={member}
                  data-vote={
                    index === 3 && step.number === 30 ? 'abstain' : 'yes'
                  }
                >
                  {index === 3 && step.number === 30 ? '—' : '✓'}
                </span>
              ))}
            </div>
            <p>{step.objective}</p>
            <button type="button" onClick={onComplete}>
              确认会议决议
            </button>
          </>
        )}
      </article>
    </section>
  )
}
