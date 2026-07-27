import type { JSX } from 'react'
import { buildingCatalogById } from '../game/buildingCatalog'
import { CHAPTERS } from '../game/chapterProgression'
import type { BuildingId } from '../game/cityTypes'
import { getGangRole } from '../game/gangProgression'
import { useInitialFocus } from './useInitialFocus'

type ProgressionMilestone =
  | { kind: 'building'; buildingId: BuildingId }
  | { kind: 'chapter'; chapterNumber: number }

interface ProgressionMilestoneOverlayProps {
  milestone: ProgressionMilestone
  onContinue: () => void
}

function TakeoverHammer(): JSX.Element {
  return (
    <div className="takeover-hammer" aria-hidden="true">
      <svg viewBox="0 0 260 180">
        <defs>
          <linearGradient id="hammer-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff3bf" />
            <stop offset="0.22" stopColor="#a16207" />
            <stop offset="0.48" stopColor="#fde68a" />
            <stop offset="0.72" stopColor="#713f12" />
            <stop offset="1" stopColor="#fbbf24" />
          </linearGradient>
          <linearGradient id="hammer-leather" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1c1917" />
            <stop offset="0.5" stopColor="#78350f" />
            <stop offset="1" stopColor="#292524" />
          </linearGradient>
          <filter id="hammer-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="takeover-hammer__tool">
          <rect
            x="104"
            y="74"
            width="124"
            height="18"
            rx="7"
            fill="url(#hammer-leather)"
            stroke="#d6a85f"
            strokeWidth="3"
          />
          <path
            d="M126 74v18m18-18v18m18-18v18m18-18v18m18-18v18"
            stroke="#d6a85f"
            strokeWidth="2"
            opacity="0.72"
          />
          <rect
            x="52"
            y="47"
            width="76"
            height="52"
            rx="12"
            fill="url(#hammer-metal)"
            stroke="#fff1b5"
            strokeWidth="3"
          />
          <path
            d="M62 60h56M62 87h56"
            stroke="#4a2b12"
            strokeWidth="4"
            opacity="0.72"
          />
          <path
            d="M83 68h14l7 9-7 10H83l-7-10z"
            fill="#17120e"
            stroke="#f7d38a"
            strokeWidth="2"
          />
          <path d="M84 78h12M90 72v12" stroke="#f7d38a" strokeWidth="2" />
        </g>

        <g className="takeover-hammer__base">
          <ellipse
            cx="82"
            cy="142"
            rx="58"
            ry="18"
            fill="#21170f"
            stroke="#d6a85f"
            strokeWidth="4"
          />
          <ellipse
            cx="82"
            cy="134"
            rx="46"
            ry="13"
            fill="url(#hammer-metal)"
            stroke="#fff1b5"
            strokeWidth="3"
          />
          <ellipse cx="82" cy="132" rx="31" ry="7" fill="#1c1917" />
        </g>

        <g
          className="takeover-hammer__sparks"
          stroke="#fff1a8"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#hammer-glow)"
        >
          <path d="M75 118l-13-18" />
          <path d="M91 117l12-18" />
          <path d="M58 125l-22-4" />
          <path d="M106 125l22-5" />
          <path d="M53 110l-12-11" />
          <path d="M111 110l12-12" />
        </g>
        <ellipse
          className="takeover-hammer__impact"
          cx="82"
          cy="126"
          rx="42"
          ry="15"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="4"
        />
      </svg>
    </div>
  )
}

export function ProgressionMilestoneOverlay({
  milestone,
  onContinue,
}: ProgressionMilestoneOverlayProps): JSX.Element | null {
  const actionRef = useInitialFocus<HTMLButtonElement>()

  if (milestone.kind === 'building') {
    const building = buildingCatalogById[milestone.buildingId]
    return (
      <div className="progression-milestone__overlay">
        <section
          className="progression-milestone progression-milestone--building"
          role="status"
          aria-label={`${building.name}管理权已交接`}
        >
          <div className="progression-milestone__rays" aria-hidden="true" />
          <TakeoverHammer />
          <p>TAKEOVER CONFIRMED</p>
          <h2>接管生效</h2>
          <strong>{`${building.name} · 管理权已交接`}</strong>
          <small>落槌确认：剃刀党已授权你调度这处产业的生产、建设与任务</small>
          <button ref={actionRef} type="button" onClick={onContinue}>
            听取管理简报
          </button>
        </section>
      </div>
    )
  }

  const chapter = CHAPTERS.find(
    (candidate) => candidate.number === milestone.chapterNumber,
  )
  if (!chapter) return null
  const nextRole = chapter.nextRoleLevel
    ? getGangRole(chapter.nextRoleLevel)
    : null

  return (
    <div className="progression-milestone__overlay">
      <section
        className="progression-milestone progression-milestone--chapter"
        role="status"
        aria-label={`${chapter.title}完成`}
      >
        <div className="progression-milestone__rays" aria-hidden="true" />
        <span className="progression-milestone__icon" aria-hidden="true">
          Ⅶ
        </span>
        <p>CHAPTER COMPLETE</p>
        <h2>{chapter.title}</h2>
        <strong>
          {nextRole
            ? `晋升目标：${nextRole.title} · ${nextRole.chineseTitle}`
            : '剃刀党的最高权力已经稳固'}
        </strong>
        <small>
          {nextRole
            ? '完成收尾汇报后，将直接前往帮派权力树接掌新席位'
            : '完成收尾汇报，确认最后的城市秩序'}
        </small>
        <button ref={actionRef} type="button" onClick={onContinue}>
          继续
        </button>
      </section>
    </div>
  )
}
