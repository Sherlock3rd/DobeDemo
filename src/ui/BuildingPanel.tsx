import { useState, type JSX } from 'react'
import { buildingCatalogById } from '../game/buildingCatalog'
import {
  getBuildingMaxLevel,
  getCaughtUpChildCount,
} from '../game/buildingUpgrade'
import {
  getBuildingUnlock,
  getGangLevel,
  getGangRole,
  isBuildingUnlocked,
} from '../game/gangProgression'
import { getBuildingFragments } from '../scene/city/buildingFragmentCatalog'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'

const TITLE_ID = 'building-panel-title'

type FragmentCellState = 'done' | 'current' | 'pending'

export function BuildingPanel(): JSX.Element | null {
  const selectedBuildingId = useCityStore((state) => state.selectedBuildingId)
  const progress = useCityStore((state) =>
    selectedBuildingId ? state.buildingProgress[selectedBuildingId] : null,
  )
  const clearSelection = useCityStore((state) => state.clearSelection)
  const completeNextFragment = useCityStore(
    (state) => state.completeNextFragment,
  )
  const confirmBuildingLevelUp = useCityStore(
    (state) => state.confirmBuildingLevelUp,
  )
  const totalReputation = useGangStore((state) => state.totalReputation)

  // Re-mounting a keyed sweep element restarts its CSS animation on every
  // fragment completion; the key is reset during render whenever the selected
  // building changes so switching panels never replays a stale sweep (React's
  // "adjust state while rendering" pattern, no effect needed).
  const [sweepKey, setSweepKey] = useState(0)
  const [sweepBuildingId, setSweepBuildingId] = useState(selectedBuildingId)
  if (sweepBuildingId !== selectedBuildingId) {
    setSweepBuildingId(selectedBuildingId)
    setSweepKey(0)
  }

  if (!selectedBuildingId || !progress) {
    return null
  }

  const building = buildingCatalogById[selectedBuildingId]
  if (!building) {
    return null
  }

  const unlock = getBuildingUnlock(selectedBuildingId)
  if (!unlock) {
    return null
  }

  const gangLevel = getGangLevel(totalReputation)
  const unlocked = isBuildingUnlocked(selectedBuildingId, gangLevel)

  const closeButton = (
    <button
      type="button"
      className="building-panel__close"
      aria-label="关闭建筑面板"
      onClick={clearSelection}
    >
      关闭
    </button>
  )

  if (!unlocked) {
    const requiredRole = getGangRole(unlock.requiredLevel)

    return (
      <section
        className="building-panel"
        aria-labelledby={TITLE_ID}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {closeButton}
        <h2 id={TITLE_ID} className="building-panel__title">
          {building.name}
        </h2>
        <p className="building-panel__lock-status">尚未解锁</p>
        <p className="building-panel__lock-requirement">
          {`需要 Lv. ${unlock.requiredLevel} · ${requiredRole.title}（${requiredRole.chineseTitle}）`}
        </p>
        <p className="building-panel__lock-current">
          {`当前 Lv. ${gangLevel} / ${unlock.requiredLevel}`}
        </p>
      </section>
    )
  }

  const level = progress.level
  const maxLevel = getBuildingMaxLevel(selectedBuildingId)
  const isMaxLevel = level === maxLevel
  const targetLevel = Math.min(level + 1, maxLevel)
  const requiredFragments = progress.childLevels.length
  const completed = getCaughtUpChildCount(progress)
  const ready = !isMaxLevel && completed === requiredFragments
  const percent = (completed / requiredFragments) * 100
  const fragments = getBuildingFragments(building.kind)
  const cellCount = requiredFragments
  const currentFragment = fragments[completed]

  const cellState = (index: number): FragmentCellState => {
    if (isMaxLevel || index < completed) {
      return 'done'
    }
    if (!ready && index === completed) {
      return 'current'
    }
    return 'pending'
  }

  const handleComplete = () => {
    completeNextFragment(selectedBuildingId)
    setSweepKey((key) => key + 1)
  }

  const fragmentGrid = (
    <ul className="building-panel__fragments" aria-hidden="true">
      {Array.from({ length: cellCount }, (_, index) => {
        const state = cellState(index)
        // Only the single most-recently completed slot replays the one-shot pop;
        // moving the class between cells as k grows restarts the CSS keyframes.
        const isLatest = !isMaxLevel && completed > 0 && index === completed - 1
        return (
          <li
            key={fragments[index].id}
            className={
              isLatest
                ? 'building-panel__fragment building-panel__fragment--latest'
                : 'building-panel__fragment'
            }
            data-state={state}
          >
            {index + 1}
          </li>
        )
      })}
    </ul>
  )

  return (
    <section
      className="building-panel"
      aria-labelledby={TITLE_ID}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {closeButton}
      <h2 id={TITLE_ID} className="building-panel__title">
        {building.name}
      </h2>
      <p className="building-panel__level">{`等级 ${level} / ${maxLevel}`}</p>

      {isMaxLevel ? (
        <>
          <p className="building-panel__maxed-note">
            六类工业设施与地标全部建成，已抵达最高等级。
          </p>
          {fragmentGrid}
          <button
            type="button"
            className="building-panel__upgrade"
            aria-label={`已满级 · ${requiredFragments} 个子建筑`}
            disabled
          >
            {`已满级 · ${requiredFragments} 个子建筑`}
          </button>
        </>
      ) : (
        <>
          <p className="building-panel__goal">{`升级至 Lv.${targetLevel}`}</p>
          <div
            className="building-panel__progress"
            role="progressbar"
            aria-label={`${building.name}升级进度`}
            aria-valuemin={0}
            aria-valuemax={requiredFragments}
            aria-valuenow={completed}
            aria-valuetext={`${completed} / ${requiredFragments} 个子建筑`}
          >
            <span
              className="building-panel__progress-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="building-panel__progress-count">
            {`${completed} / ${requiredFragments} 个子建筑`}
          </p>

          {ready ? (
            <div className="building-panel__confirm">
              <p className="building-panel__confirm-title">升级确认</p>
              <p className="building-panel__confirm-transition">
                {`Lv.${level} → Lv.${targetLevel}`}
              </p>
              <ul className="building-panel__confirm-list">
                {fragments.slice(0, requiredFragments).map((fragment) => (
                  <li
                    key={fragment.id}
                    className="building-panel__confirm-item"
                  >
                    {fragment.name}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="building-panel__upgrade building-panel__upgrade--confirm"
                aria-label={`完成 Lv.${targetLevel} 升级`}
                onClick={() => confirmBuildingLevelUp(selectedBuildingId)}
              >
                {`完成 Lv.${targetLevel} 升级`}
              </button>
            </div>
          ) : (
            <div className="building-panel__facility">
              <p className="building-panel__facility-index">
                {`子建筑 ${completed + 1} / ${requiredFragments}`}
              </p>
              <h3 className="building-panel__facility-name">
                {currentFragment.name}
              </h3>
              <p className="building-panel__facility-desc">
                {currentFragment.description}
              </p>
              <button
                type="button"
                className="building-panel__upgrade"
                aria-label={`升级子建筑 ${completed + 1}/${requiredFragments}`}
                onClick={handleComplete}
              >
                {`升级子建筑 ${completed + 1}/${requiredFragments}`}
              </button>
            </div>
          )}

          {fragmentGrid}
        </>
      )}

      {sweepKey > 0 && (
        <span
          key={sweepKey}
          className="building-panel__sweep"
          aria-hidden="true"
        />
      )}
    </section>
  )
}
