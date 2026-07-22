import type { JSX } from 'react'
import { buildingCatalogById } from '../game/buildingCatalog'
import {
  getBuildingUnlock,
  getGangLevel,
  getGangRole,
  isBuildingUnlocked,
} from '../game/gangProgression'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'

const TITLE_ID = 'building-panel-title'

export function BuildingPanel(): JSX.Element | null {
  const selectedBuildingId = useCityStore((state) => state.selectedBuildingId)
  const level = useCityStore((state) =>
    selectedBuildingId ? state.buildingLevels[selectedBuildingId] : null,
  )
  const clearSelection = useCityStore((state) => state.clearSelection)
  const upgradeBuilding = useCityStore((state) => state.upgradeBuilding)
  const totalReputation = useGangStore((state) => state.totalReputation)

  if (!selectedBuildingId) {
    return null
  }

  const building = buildingCatalogById[selectedBuildingId]
  if (!building || !level) {
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

  const isMaxLevel = level === 3
  const upgradeLabel = isMaxLevel ? '已满级' : `升级到 ${level + 1} 级`

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
      <p className="building-panel__level">等级 {level} / 3</p>
      <p className="building-panel__description">
        {building.levelSummary[level - 1]}
      </p>
      <button
        type="button"
        className="building-panel__upgrade"
        aria-label={upgradeLabel}
        disabled={isMaxLevel}
        onClick={() => upgradeBuilding(selectedBuildingId)}
      >
        {upgradeLabel}
      </button>
    </section>
  )
}
