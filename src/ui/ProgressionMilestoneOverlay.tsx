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
          className="progression-milestone"
          role="status"
          aria-label={`${building.name}管理权已交接`}
        >
          <div className="progression-milestone__rays" aria-hidden="true" />
          <span className="progression-milestone__icon" aria-hidden="true">
            ◆
          </span>
          <p>AUTHORITY TRANSFERRED</p>
          <h2>{building.name}</h2>
          <strong>管理权已交接</strong>
          <small>剃刀党已授权你调度这处产业的生产、建设与任务</small>
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
