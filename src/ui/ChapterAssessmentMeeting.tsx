import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from 'react'
import gangPortraitAtlas from '../assets/peaky-blinders-hierarchy-atlas.png'
import {
  getChapterAssessment,
  getChapterPerformanceReview,
} from '../game/chapterAssessment'

interface ChapterAssessmentMeetingProps {
  chapterNumber: number
  onComplete: (chapterNumber: number) => void
}

type MeetingPhase =
  | 'review'
  | 'review-result'
  | 'briefing'
  | 'vote'
  | 'result'
  | 'task-reveal'
  | 'assignment'
type PlayerVote = 'support' | 'oppose'
const CHAPTER_NUMERALS = ['一', '二', '三', '四', '五', '六', '七'] as const

function portraitStyle(index: number): CSSProperties {
  const column = index % 4
  const row = Math.floor(index / 4)
  return {
    backgroundImage: `url(${gangPortraitAtlas})`,
    backgroundPosition: `${(column / 3) * 100}% ${row * 100}%`,
  }
}

export function ChapterAssessmentMeeting({
  chapterNumber,
  onComplete,
}: ChapterAssessmentMeetingProps): JSX.Element | null {
  const assessment = getChapterAssessment(chapterNumber)
  const review =
    chapterNumber > 1 ? getChapterPerformanceReview(chapterNumber - 1) : null
  const [phase, setPhase] = useState<MeetingPhase>(
    review ? 'review' : 'briefing',
  )
  const [playerVote, setPlayerVote] = useState<PlayerVote | null>(null)
  const phaseActionRef = useRef<HTMLButtonElement | null>(null)
  const agendaRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (agendaRef.current) {
      agendaRef.current.scrollTop = 0
    }
    phaseActionRef.current?.focus({ preventScroll: true })
  }, [phase])

  if (!assessment) return null

  const { chapter, chair } = assessment
  const dialogLabel = `${chapter.title}评定会议`
  const isReviewPhase = phase.startsWith('review')
  const planStep =
    phase === 'task-reveal'
      ? 2
      : phase === 'assignment'
        ? 3
        : isReviewPhase
          ? 0
          : 1
  const taskPool = [
    ...chapter.tasks.map((task) => ({
      key: `player-${task.id}`,
      name: task.name,
      description: task.description,
    })),
    ...assessment.crewAssignments.map((assignment) => ({
      key: `crew-${assignment.memberName}`,
      name: assignment.taskName,
      description: assignment.description,
    })),
  ]
  const meetingAction = (): void => {
    if (assessment.playerCanVote) {
      setPhase('vote')
    } else {
      setPhase('result')
    }
  }
  const castVote = (vote: PlayerVote): void => {
    setPlayerVote(vote)
    setPhase('result')
  }
  const finishMeeting = (): void => {
    onComplete(chapter.number)
  }

  return (
    <div className="chapter-assessment__overlay">
      <section
        className="chapter-assessment"
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
        data-phase={phase}
      >
        <header className="chapter-assessment__header">
          <div>
            <span>THE RAZORS · ASSESSMENT COUNCIL</span>
            <h1>
              {isReviewPhase
                ? '上章任务评定'
                : phase === 'task-reveal'
                  ? '行动任务确认'
                  : phase === 'assignment'
                    ? '成员任务分配'
                    : '帮派评定会议'}
            </h1>
          </div>
          <div className="chapter-assessment__chapter">
            <small>
              {isReviewPhase && review
                ? `REVIEW CHAPTER ${review.chapter.number} → CHAPTER ${chapter.number}`
                : `CHAPTER ${chapter.number} / 7`}
            </small>
            <strong>
              {isReviewPhase ? review?.chapter.title : chapter.title}
            </strong>
          </div>
        </header>

        <div className="chapter-assessment__body">
          <aside className="chapter-assessment__chair">
            <div
              className="chapter-assessment__chair-portrait"
              style={portraitStyle(chair.portraitIndex)}
              role="img"
              aria-label={chair.holder}
            />
            <span>{isReviewPhase ? '评定主持' : '会议主持'}</span>
            <strong>{chair.holder}</strong>
            <small>{chair.seatDescription}</small>
            <p>
              {isReviewPhase
                ? '逐项核对上次会议任务'
                : phase === 'task-reveal'
                  ? '决议已通过 · 正在拆解任务'
                  : phase === 'assignment'
                    ? '任务池已确认 · 正在分配'
                    : assessment.playerCanVote
                      ? `${chapter.role.chineseTitle}席位 · 有投票权`
                      : '旁听席 · 无投票权'}
            </p>
          </aside>

          <div ref={agendaRef} className="chapter-assessment__agenda">
            {planStep > 0 ? (
              <ol
                className="chapter-assessment__flow"
                aria-label="本章会议发布流程"
              >
                {[
                  ['01', '议案评定'],
                  ['02', '任务确认'],
                  ['03', '成员分配'],
                ].map(([number, label], index) => {
                  const step = index + 1
                  return (
                    <li
                      key={number}
                      data-state={
                        step < planStep
                          ? 'complete'
                          : step === planStep
                            ? 'active'
                            : 'pending'
                      }
                    >
                      <span>{step < planStep ? '✓' : number}</span>
                      <strong>{label}</strong>
                    </li>
                  )
                })}
              </ol>
            ) : null}

            {phase === 'review' && review ? (
              <section className="chapter-assessment__performance">
                <div className="chapter-assessment__proposal">
                  <span>LAST MANDATE REVIEW</span>
                  <h2>{`${review.chapter.title} · 完成度评定`}</h2>
                  <p>
                    {chair.holder}
                    ：上次会议分下去的职责，今天按结果逐项结账。
                  </p>
                </div>
                <div className="chapter-assessment__dialogue">
                  <p>
                    <strong>{chair.holder}</strong>
                    产业、路口、车队和账本都摆在桌上。每个人只凭结果拿等级。
                  </p>
                  <p data-speaker="player">
                    <strong>Thomas Shelby</strong>
                    我的任务已经完成。该交的账，一项不少。
                  </p>
                </div>
                <ol
                  className="chapter-assessment__grades"
                  aria-label={`${review.chapter.title}成员完成度`}
                >
                  {review.entries.map((entry) => (
                    <li
                      key={entry.name}
                      data-grade={entry.grade}
                      data-player={entry.isPlayer || undefined}
                    >
                      {entry.portraitIndex === null ? (
                        <span
                          className="chapter-assessment__grade-initial"
                          aria-hidden="true"
                        >
                          {entry.name.slice(0, 1)}
                        </span>
                      ) : (
                        <span
                          className="chapter-assessment__grade-portrait"
                          style={portraitStyle(entry.portraitIndex)}
                          aria-hidden="true"
                        />
                      )}
                      <span className="chapter-assessment__grade-copy">
                        <strong>{entry.name}</strong>
                        <small>{entry.position}</small>
                        <em>{entry.taskName}</em>
                      </span>
                      <b aria-label={`${entry.name}评级 ${entry.grade}`}>
                        {entry.grade}
                      </b>
                    </li>
                  ))}
                </ol>
                <button
                  ref={phaseActionRef}
                  type="button"
                  className="chapter-assessment__primary"
                  onClick={() => setPhase('review-result')}
                >
                  宣读评定结论
                </button>
              </section>
            ) : null}

            {phase === 'review-result' && review ? (
              <section
                className="chapter-assessment__review-result"
                role="status"
                aria-label={`${review.chapter.title}评定完成`}
              >
                <span>PERFORMANCE VERDICT</span>
                <div>
                  <b>S</b>
                  <p>
                    <strong>Thomas Shelby · 本章最佳</strong>
                    {review.verdict}
                  </p>
                </div>
                <div className="chapter-assessment__dialogue">
                  <p>
                    <strong>{chair.holder}</strong>S
                    级不是奖章，是你把分内工作全部做完的凭据。上章账目到此归档。
                  </p>
                  <p data-speaker="player">
                    <strong>Thomas Shelby</strong>
                    那就把这次会议的新任务摆上桌。
                  </p>
                </div>
                <button
                  ref={phaseActionRef}
                  type="button"
                  className="chapter-assessment__primary"
                  onClick={() => {
                    setPhase('briefing')
                  }}
                >
                  进入本章任务评定
                </button>
              </section>
            ) : null}

            {phase === 'briefing' ? (
              <>
                <div className="chapter-assessment__proposal">
                  <span>MANDATE PROPOSAL</span>
                  <h2>{chapter.title}</h2>
                  <p>{chapter.story}</p>
                </div>

                <div className="chapter-assessment__proposal-rule">
                  <span aria-hidden="true">?</span>
                  <p>
                    <strong>此刻只评定行动方向</strong>
                    具体任务将在议案通过后由委员会拆解，负责人也会在任务池确认后另行分配。
                  </p>
                </div>

                <div className="chapter-assessment__briefing">
                  <p>
                    {assessment.playerCanVote
                      ? '行动方向宣讲完毕。你的席位可以对本章议案表态。'
                      : '见习成员只旁听本次评定；委员会决议通过后，才会形成具体行动任务。'}
                  </p>
                  <button
                    ref={phaseActionRef}
                    type="button"
                    onClick={meetingAction}
                  >
                    {assessment.playerCanVote ? '进入表决' : '听取会议决议'}
                  </button>
                </div>
              </>
            ) : null}

            {phase === 'vote' ? (
              <div className="chapter-assessment__ballot">
                <p>Thomas Shelby，请对本章行动议案投票。</p>
                <div>
                  <button
                    ref={phaseActionRef}
                    type="button"
                    onClick={() => castVote('support')}
                  >
                    投赞成票
                  </button>
                  <button
                    type="button"
                    className="chapter-assessment__oppose"
                    onClick={() => castVote('oppose')}
                  >
                    投反对票
                  </button>
                </div>
              </div>
            ) : null}

            {phase === 'result' ? (
              <div
                className="chapter-assessment__result"
                role="status"
                aria-label={`第${CHAPTER_NUMERALS[assessment.chapter.number - 1]}章评定结果`}
              >
                <div className="chapter-assessment__result-heading">
                  <span>COUNCIL RESOLUTION</span>
                  <strong>议案通过</strong>
                  <p>{`核心席位支持 ${assessment.supportCount}/${assessment.memberVotes.length} · 支持率 ${assessment.supportRate}%`}</p>
                </div>
                <ul
                  className="chapter-assessment__members"
                  aria-label="席位表决"
                >
                  {assessment.memberVotes.map((member, index) => (
                    <li
                      key={member.name}
                      className="chapter-assessment__member"
                      data-vote={member.support ? 'support' : 'oppose'}
                      aria-label={`${member.name}：${member.support ? '赞成' : '反对'}`}
                      style={
                        {
                          '--vote-index': index,
                        } as CSSProperties
                      }
                    >
                      <div style={portraitStyle(member.portraitIndex)} />
                      <span>
                        <strong>{member.name}</strong>
                        <small>{member.role}</small>
                      </span>
                      <em>{member.support ? '赞成' : '反对'}</em>
                    </li>
                  ))}
                </ul>
                <div className="chapter-assessment__player-vote">
                  {assessment.playerCanVote ? (
                    <span>{`你的票：${playerVote === 'support' ? '赞成' : '反对'} · 已记录`}</span>
                  ) : (
                    <span>本章只记录委员会决议</span>
                  )}
                  <button
                    ref={phaseActionRef}
                    type="button"
                    onClick={() => setPhase('task-reveal')}
                  >
                    根据决议形成任务
                  </button>
                </div>
              </div>
            ) : null}

            {phase === 'task-reveal' ? (
              <section className="chapter-assessment__task-reveal">
                <div className="chapter-assessment__proposal">
                  <span>MANDATE TASKS CONFIRMED</span>
                  <h2>本章行动任务已形成</h2>
                  <p>
                    委员会依据刚刚通过的议案拆解出八项任务；当前只确认任务内容，尚未指定负责人。
                  </p>
                </div>
                <ol
                  className="chapter-assessment__task-pool"
                  aria-label="本章行动任务池"
                >
                  {taskPool.map((task, index) => (
                    <li
                      key={task.key}
                      style={
                        {
                          '--task-index': index,
                        } as CSSProperties
                      }
                    >
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{task.name}</strong>
                        <small>{task.description}</small>
                      </div>
                      <em>待分配</em>
                    </li>
                  ))}
                </ol>
                <div className="chapter-assessment__assignment-confirm">
                  <p>
                    八项任务已经写入行动清单。下一步由主持人确定 Thomas
                    与其他成员各自负责的部分。
                  </p>
                  <button
                    ref={phaseActionRef}
                    type="button"
                    onClick={() => setPhase('assignment')}
                  >
                    进入成员分配
                  </button>
                </div>
              </section>
            ) : null}

            {phase === 'assignment' ? (
              <section className="chapter-assessment__assignment">
                <div className="chapter-assessment__assignment-intro">
                  <strong>职责分配完成</strong>
                  <span>
                    Thomas
                    接取其中四项作为玩家章节任务；其余任务由具名成员独立执行，并在下次会议评级。
                  </span>
                </div>

                <section className="chapter-assessment__assignment-group">
                  <header>
                    <span>THOMAS · PLAYER ORDERS</span>
                    <strong>你的章节任务</strong>
                    <small>以下四项同步进入玩家章节体</small>
                  </header>
                  <ol
                    className="chapter-assessment__tasks"
                    aria-label="Thomas的章节任务"
                  >
                    {chapter.tasks.map((task, index) => (
                      <li key={task.id}>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <div>
                          <strong>{task.name}</strong>
                          <small>{task.description}</small>
                        </div>
                        <em>Thomas</em>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="chapter-assessment__assignment-group chapter-assessment__assignment-group--crew">
                  <header>
                    <span>CREW ORDERS</span>
                    <strong>其他成员任务</strong>
                    <small>由小弟独立执行，下次会议按完成度评级</small>
                  </header>
                  <ul
                    className="chapter-assessment__crew-tasks"
                    aria-label="其他成员分派任务"
                  >
                    {assessment.crewAssignments.map((assignment) => (
                      <li key={assignment.memberName}>
                        <span aria-hidden="true">
                          {assignment.memberName.slice(0, 1)}
                        </span>
                        <div>
                          <strong>{assignment.taskName}</strong>
                          <small>{assignment.description}</small>
                          <em>{`${assignment.memberName} · ${assignment.memberPosition}`}</em>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                <div className="chapter-assessment__assignment-confirm">
                  <p>
                    你接取的四项任务将在离开会议后进入章节体，其他成员的任务不会占用玩家进度。
                  </p>
                  <button
                    ref={phaseActionRef}
                    type="button"
                    onClick={finishMeeting}
                  >
                    接取四项章节任务
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
