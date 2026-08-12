import { useMemo, useState, type JSX } from 'react'
import type { StoryStep } from '../game/storyPlanC'

const MEMBERS = ['Thomas Shelby', 'Maeve Quinn', 'Hugo Vale', 'Walter Vale']
const GRADES = ['A', 'B', 'C', 'D'] as const
const MEETING_STEPS = [10, 20, 26, 29, 30, 34, 37, 38, 40, 42] as const

function gradeFor(step: number, memberIndex: number): string {
  if (memberIndex === 0) return 'S'
  return GRADES[(step * 7 + memberIndex * 3) % GRADES.length]
}

function meetingProposal(step: StoryStep): string {
  if (step.number === 10) return 'Thomas Shelby 是否通过终考，获得 Full Patch？'
  if (step.number === 20) return '复仇行动结束后，是否授予 Thomas 打手职责？'
  if (step.number === 26) return '内鬼线索成立后，是否扩大 Thomas 的道路权限？'
  if (step.number === 29) return '证据指向 Billy，是否解除其路线队长权限？'
  if (step.number === 30) return '追回叛徒与帮派资产后，是否授予路线队长背章？'
  if (step.number === 34) return '救援完成后，是否由 Thomas 统筹全城产业账？'
  if (step.number === 37) return '是否通过友好枪战结果，授予武装队长职责？'
  if (step.number === 38)
    return '核心据点清理完成，是否接纳 Thomas 为资深成员？'
  if (step.number === 40) return '传统竞速通过后，是否授予副会长席位？'
  if (step.number === 42)
    return '是否通过会长席位、木槌与全部管理责任的和平交接？'
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
        <span>PLAN C · CLUBHOUSE ASSESSMENT</span>
        <strong>{`第 ${meetingNumber} 次评定会议`}</strong>
      </header>
      <div className="story-council__table" aria-hidden="true">
        <span>MC</span>
      </div>
      <article>
        {phase === 'review' ? (
          <>
            <p className="story-council__eyebrow">上一轮任务完成度</p>
            <h2 id="story-council-title">先评定所有成员，再讨论下一项责任</h2>
            <div className="story-council__ratings">
              {ratings.map((rating) => (
                <div key={rating.member}>
                  <span>{rating.grade}</span>
                  <strong>{rating.member}</strong>
                  <small>
                    {rating.member === 'Thomas Shelby'
                      ? '玩家 · 固定 S'
                      : 'NPC · 伪随机评定'}
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
            <p className="story-council__eyebrow">本轮帮派议题</p>
            <h2 id="story-council-title">{meetingProposal(step)}</h2>
            <p>
              桌边成员会依次亮出标记。结果由方案 C 剧情固定，玩家的选择只代表
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
                    index === 3 && step.number === 29 ? 'abstain' : 'yes'
                  }
                >
                  {index === 3 && step.number === 29 ? '—' : '✓'}
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
