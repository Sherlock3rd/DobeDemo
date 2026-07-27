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
  type ChapterMeetingDecision,
  type ChapterMeetingVote,
} from '../game/chapterAssessment'
import { getChapterTasks } from '../game/chapterProgression'
import { getNarrativeEvent } from '../game/narrative'
import { NarrativeDialogueOverlay } from './NarrativeDialogueOverlay'

export interface ChapterMeetingSelection {
  completedChapterNumber: number
  nextChapterNumber: number
  selectedPackageId: string
  decision: ChapterMeetingDecision
}

interface ChapterAssessmentMeetingProps {
  completedChapterNumber: number
  onComplete: (selection: ChapterMeetingSelection) => void
}

type MeetingPhase =
  | 'special'
  | 'specialResult'
  | 'specialDialogue'
  | 'event'
  | 'vote'
  | 'result'
  | 'packages'

function portraitStyle(index: number): CSSProperties {
  const column = index % 4
  const row = Math.floor(index / 4)
  return {
    backgroundImage: `url(${gangPortraitAtlas})`,
    backgroundPosition: `${(column / 3) * 100}% ${row * 100}%`,
  }
}

export function ChapterAssessmentMeeting({
  completedChapterNumber,
  onComplete,
}: ChapterAssessmentMeetingProps): JSX.Element | null {
  const assessment = getChapterAssessment(completedChapterNumber)
  const [phase, setPhase] = useState<MeetingPhase>(() =>
    assessment?.specialVote ? 'special' : 'event',
  )
  const [meetingDecision, setMeetingDecision] =
    useState<ChapterMeetingDecision | null>(null)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null,
  )
  const phaseActionRef = useRef<HTMLButtonElement | null>(null)
  const agendaRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (agendaRef.current) agendaRef.current.scrollTop = 0
    phaseActionRef.current?.focus({ preventScroll: true })
  }, [phase])

  if (!assessment) return null

  const {
    completedChapter,
    nextChapter,
    chair,
    specialVote,
    eventVoteRequired,
    options,
    taskPackages,
  } = assessment
  const specialDialogue = specialVote
    ? getNarrativeEvent(specialVote.dialogueEventId)
    : null
  const selectedPackage =
    taskPackages.find((taskPackage) => taskPackage.id === selectedPackageId) ??
    null
  const fixedTasks = selectedPackage
    ? getChapterTasks(nextChapter.number, selectedPackage.id).filter((task) =>
        task.id.includes('-extra-'),
      )
    : []
  const optionLabel = (vote: ChapterMeetingVote): string =>
    options.find((option) => option.id === vote)?.label ?? ''
  const castVote = (vote: ChapterMeetingVote): void => {
    setMeetingDecision(vote)
    setPhase('result')
  }
  const flowSteps = !eventVoteRequired
    ? [
        ['01', '资格表决'],
        ['02', '任务包接取'],
      ]
    : specialVote
      ? [
          ['01', '资格表决'],
          ['02', '事件说明'],
          ['03', '中性表决'],
          ['04', '任务包接取'],
        ]
      : [
          ['01', '事件说明'],
          ['02', '中性表决'],
          ['03', '任务包接取'],
        ]
  const currentFlowStep = !eventVoteRequired
    ? phase === 'packages'
      ? 2
      : 1
    : specialVote
      ? phase === 'special' ||
        phase === 'specialResult' ||
        phase === 'specialDialogue'
        ? 1
        : phase === 'event'
          ? 2
          : phase === 'vote' || phase === 'result'
            ? 3
            : 4
      : phase === 'event'
        ? 1
        : phase === 'vote' || phase === 'result'
          ? 2
          : 3

  if (phase === 'specialDialogue' && specialDialogue) {
    return (
      <NarrativeDialogueOverlay
        event={specialDialogue}
        onComplete={() => {
          if (!eventVoteRequired && specialVote?.id === 'formal-member') {
            setMeetingDecision('formal-member-approved')
            setPhase('packages')
          } else {
            setPhase('event')
          }
        }}
      />
    )
  }

  return (
    <div className="chapter-assessment__overlay">
      <section
        className="chapter-assessment"
        role="dialog"
        aria-modal="true"
        aria-label={`${completedChapter.title}完成评定会议`}
        data-phase={phase}
      >
        <header className="chapter-assessment__header">
          <div>
            <span>THE RAZORS · ASSESSMENT COUNCIL</span>
            <h1>
              {phase === 'packages'
                ? '下一章任务接取'
                : phase === 'special' || phase === 'specialResult'
                  ? '关键席位资格表决'
                  : '帮派评定会议'}
            </h1>
          </div>
          <div className="chapter-assessment__chapter">
            <small>{`CHAPTER ${completedChapter.number} → ${nextChapter.number}`}</small>
            <strong>{`${completedChapter.title} · 已完成`}</strong>
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
            <span>会议主持</span>
            <strong>{chair.holder}</strong>
            <small>{chair.seatDescription}</small>
            <p>
              {phase === 'packages'
                ? `为${nextChapter.title}确定职责`
                : phase === 'special' || phase === 'specialResult'
                  ? '对关键席位资格进行表决'
                  : '对当前事件进行中性表决'}
            </p>
          </aside>

          <div ref={agendaRef} className="chapter-assessment__agenda">
            <ol
              className="chapter-assessment__flow"
              aria-label="章节会议流程"
              data-special={specialVote ? true : undefined}
            >
              {flowSteps.map(([number, label], index) => {
                return (
                  <li
                    key={number}
                    data-state={
                      index + 1 < currentFlowStep
                        ? 'complete'
                        : index + 1 === currentFlowStep
                          ? 'active'
                          : 'pending'
                    }
                  >
                    <span>{index + 1 < currentFlowStep ? '✓' : number}</span>
                    <strong>{label}</strong>
                  </li>
                )
              })}
            </ol>

            {phase === 'special' && specialVote ? (
              <section className="chapter-assessment__eligibility">
                <div className="chapter-assessment__proposal">
                  <span>KEY SEAT ELIGIBILITY</span>
                  <h2>{specialVote.title}</h2>
                  <p>{specialVote.description}</p>
                </div>
                <div className="chapter-assessment__eligibility-question">
                  <span>COUNCIL MOTION</span>
                  <strong>{specialVote.question}</strong>
                  <small>
                    此轮由核心席位投票，Thomas 不参与投票；结果为固定剧情演出。
                  </small>
                </div>
                <button
                  ref={phaseActionRef}
                  type="button"
                  className="chapter-assessment__primary"
                  onClick={() => setPhase('specialResult')}
                >
                  开始资格表决
                </button>
              </section>
            ) : null}

            {phase === 'specialResult' && specialVote ? (
              <section
                className="chapter-assessment__result chapter-assessment__eligibility-result"
                role="status"
                aria-label={`${specialVote.title}结果`}
              >
                <div className="chapter-assessment__result-heading">
                  <span>ELIGIBILITY PASSED</span>
                  <strong>{specialVote.resultTitle}</strong>
                  <p>{specialVote.resultDetail}</p>
                </div>
                <ul
                  className="chapter-assessment__members"
                  aria-label="资格表决席位票型"
                >
                  {specialVote.memberVotes.map((member, index) => (
                    <li
                      key={member.name}
                      className="chapter-assessment__member"
                      data-vote={member.vote}
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
                      <em>{member.vote === 'approve' ? '赞成' : '保留'}</em>
                    </li>
                  ))}
                </ul>
                <div className="chapter-assessment__player-vote">
                  <span>{`赞成 ${specialVote.approveCount} 席 · 保留 ${specialVote.abstainCount} 席 · 资格通过`}</span>
                  <button
                    ref={phaseActionRef}
                    type="button"
                    onClick={() => setPhase('specialDialogue')}
                  >
                    听取表决后的对话
                  </button>
                </div>
              </section>
            ) : null}

            {phase === 'event' ? (
              <section className="chapter-assessment__event">
                <div className="chapter-assessment__proposal">
                  <span>NEUTRAL EVENT</span>
                  <h2>{assessment.eventTitle}</h2>
                  <p>{assessment.eventDescription}</p>
                </div>
                <div className="chapter-assessment__dialogue">
                  <p>
                    <strong>{chair.holder}</strong>
                    这不是忠诚测试，也没有唯一正确答案。委员会只需要确定下一阶段先从哪里下手。
                  </p>
                  <p data-speaker="player">
                    <strong>Thomas Shelby</strong>
                    把两种处理方式都摆出来，我会投下自己的判断。
                  </p>
                </div>
                <button
                  ref={phaseActionRef}
                  type="button"
                  className="chapter-assessment__primary"
                  onClick={() => setPhase('vote')}
                >
                  进入事件表决
                </button>
              </section>
            ) : null}

            {phase === 'vote' ? (
              <section className="chapter-assessment__neutral-ballot">
                <span>YOUR POSITION</span>
                <h2>选择你支持的处理顺序</h2>
                <p>
                  两种选择都属于帮派内部的正常经营判断，不影响后续任务包开放。
                </p>
                <div>
                  {options.map((option, index) => (
                    <button
                      key={option.id}
                      ref={index === 0 ? phaseActionRef : undefined}
                      type="button"
                      onClick={() => castVote(option.id)}
                    >
                      <strong>{option.label}</strong>
                      <small>{option.detail}</small>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {phase === 'result' &&
            (meetingDecision === 'option-a' ||
              meetingDecision === 'option-b') ? (
              <section
                className="chapter-assessment__result"
                role="status"
                aria-label="事件表决结果"
              >
                <div className="chapter-assessment__result-heading">
                  <span>POSITION RECORDED</span>
                  <strong>事件意见已归档</strong>
                  <p>{`你的选择：${optionLabel(meetingDecision)}。委员会将把两种立场都转化为可执行任务。`}</p>
                </div>
                <ul
                  className="chapter-assessment__members"
                  aria-label="席位意见"
                >
                  {assessment.memberVotes.map((member, index) => (
                    <li
                      key={member.name}
                      className="chapter-assessment__member"
                      data-vote={member.vote}
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
                      <em>{optionLabel(member.vote)}</em>
                    </li>
                  ))}
                </ul>
                <div className="chapter-assessment__player-vote">
                  <span>{`${options[0].label} ${assessment.optionACount} 席 · ${options[1].label} ${assessment.optionBCount} 席`}</span>
                  <button
                    ref={phaseActionRef}
                    type="button"
                    onClick={() => setPhase('packages')}
                  >
                    查看三个任务包
                  </button>
                </div>
              </section>
            ) : null}

            {phase === 'packages' && meetingDecision ? (
              <section className="chapter-assessment__package-selection">
                <div className="chapter-assessment__proposal">
                  <span>NEXT CHAPTER ORDERS</span>
                  <h2>{`${nextChapter.title} · 选择任务包`}</h2>
                  <p>
                    {eventVoteRequired
                      ? '三个任务包均由刚才的事件延伸而来。只能接取一个；每包包含 1–3 项会议任务，并自动附加本章固定任务。'
                      : '转正表决已经通过。委员会现在给出下一阶段的三个任务包；只能接取一个，并自动附加本章固定任务。'}
                  </p>
                </div>

                <div
                  className="chapter-assessment__packages"
                  role="radiogroup"
                  aria-label={`${nextChapter.title}任务包`}
                >
                  {taskPackages.map((taskPackage, index) => {
                    const selected = taskPackage.id === selectedPackageId
                    return (
                      <button
                        key={taskPackage.id}
                        ref={index === 0 ? phaseActionRef : undefined}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        data-selected={selected || undefined}
                        onClick={() => setSelectedPackageId(taskPackage.id)}
                      >
                        <span>{`方案 ${String.fromCharCode(65 + index)} · ${taskPackage.tasks.length} 项`}</span>
                        <strong>{taskPackage.title}</strong>
                        <small>{taskPackage.summary}</small>
                        <ul>
                          {taskPackage.tasks.map((task) => (
                            <li key={task.id}>
                              <b>{task.name}</b>
                              <em>{task.description}</em>
                            </li>
                          ))}
                        </ul>
                      </button>
                    )
                  })}
                </div>

                <div
                  className="chapter-assessment__fixed-tasks"
                  aria-label="本章固定额外任务"
                >
                  <span>每个任务包都会附加</span>
                  {selectedPackage ? (
                    <ul>
                      {fixedTasks.map((task) => (
                        <li key={task.id}>
                          <strong>{task.name}</strong>
                          <small>{task.description}</small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>选择一个任务包后预览声望、推关与 SUP 固定任务。</p>
                  )}
                </div>

                <div className="chapter-assessment__assignment-confirm">
                  <p>
                    {selectedPackage
                      ? `将接取“${selectedPackage.title}”并正式开始${nextChapter.title}。`
                      : '请选择一个任务包。'}
                  </p>
                  <button
                    type="button"
                    disabled={!selectedPackage}
                    onClick={() => {
                      if (!selectedPackage) return
                      onComplete({
                        completedChapterNumber,
                        nextChapterNumber: nextChapter.number,
                        selectedPackageId: selectedPackage.id,
                        decision: meetingDecision,
                      })
                    }}
                  >
                    {`确认接取并开始第${nextChapter.number}章`}
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
