import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from 'react'
import gangPortraitAtlas from '../assets/peaky-blinders-hierarchy-atlas.png'
import { getChapterAssessment } from '../game/chapterAssessment'

interface ChapterAssessmentMeetingProps {
  chapterNumber: number
  onComplete: (chapterNumber: number) => void
}

type MeetingPhase = 'briefing' | 'vote' | 'result'
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
  const [phase, setPhase] = useState<MeetingPhase>('briefing')
  const [playerVote, setPlayerVote] = useState<PlayerVote | null>(null)
  const phaseActionRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    phaseActionRef.current?.focus()
  }, [phase])

  if (!assessment) return null

  const { chapter, chair } = assessment
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

  return (
    <div className="chapter-assessment__overlay">
      <section
        className="chapter-assessment"
        role="dialog"
        aria-modal="true"
        aria-label={`${chapter.title}评定会议`}
        data-phase={phase}
      >
        <header className="chapter-assessment__header">
          <div>
            <span>THE RAZORS · ASSESSMENT COUNCIL</span>
            <h1>帮派评定会议</h1>
          </div>
          <div className="chapter-assessment__chapter">
            <small>{`CHAPTER ${chapter.number} / 7`}</small>
            <strong>{chapter.title}</strong>
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
              {assessment.playerCanVote
                ? `${chapter.role.chineseTitle}席位 · 有投票权`
                : '旁听席 · 无投票权'}
            </p>
          </aside>

          <div className="chapter-assessment__agenda">
            <div className="chapter-assessment__proposal">
              <span>MANDATE PLAN</span>
              <h2>{chapter.title}</h2>
              <p>{chapter.story}</p>
            </div>

            <ol className="chapter-assessment__tasks" aria-label="本章评定任务">
              {chapter.tasks.map((task, index) => (
                <li key={task.id}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{task.name}</strong>
                    <small>{task.description}</small>
                  </div>
                </li>
              ))}
            </ol>

            {phase === 'briefing' ? (
              <div className="chapter-assessment__briefing">
                <p>
                  {assessment.playerCanVote
                    ? '任务宣讲完毕。你的席位可以对本章行动议案表态。'
                    : '见习成员只旁听本次评定；委员会决议通过后，任务将直接下达。'}
                </p>
                <button
                  ref={phaseActionRef}
                  type="button"
                  onClick={meetingAction}
                >
                  {assessment.playerCanVote ? '进入表决' : '听取会议决议'}
                </button>
              </div>
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
                aria-label={`第${CHAPTER_NUMERALS[chapter.number - 1]}章评定结果`}
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
                    onClick={() => onComplete(chapter.number)}
                  >
                    {assessment.playerCanVote ? '执行会议决议' : '接受本章任务'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
