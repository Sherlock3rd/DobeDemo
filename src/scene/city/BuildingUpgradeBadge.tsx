import { Html } from '@react-three/drei'
import { useState, type JSX } from 'react'
import { buildingCatalogById } from '../../game/buildingCatalog'
import { getBuildingUpgradeDisplay } from '../../game/buildingUpgradeDisplay'
import { useChestTick } from '../../game/chestTick'
import type { BuildingId } from '../../game/cityTypes'
import { useCityStore } from '../../store/useCityStore'

interface BuildingUpgradeBadgeProps {
  buildingId: BuildingId
}

export function BuildingUpgradeBadge({
  buildingId,
}: BuildingUpgradeBadgeProps): JSX.Element | null {
  const task = useCityStore((state) =>
    state.pendingMainUpgrades.find(
      (pending) => pending.buildingId === buildingId,
    ),
  )
  const clockNow = useChestTick((state) => state.now)
  const [mountedAt] = useState(() => Date.now())

  if (!task) return null

  const display = getBuildingUpgradeDisplay(
    task,
    clockNow > 0 ? clockNow : mountedAt,
  )
  const buildingName = buildingCatalogById[buildingId].name

  return (
    <Html position={[0, 4.25, 0]} center zIndexRange={[2, 2]}>
      <div
        className="building-upgrade-badge"
        role="status"
        aria-label={`${buildingName}修建中，剩余${display.remainingLabel}，进度${display.progressPercent}%`}
      >
        <div className="building-upgrade-badge__headline">
          <span aria-hidden="true">🏗️</span>
          <strong>修建中</strong>
          <span>Lv.{task.targetLevel}</span>
        </div>
        <span className="building-upgrade-badge__time">
          剩余 {display.remainingLabel}
        </span>
        <div
          className="building-upgrade-badge__progress"
          role="progressbar"
          aria-label={`${buildingName}修建进度`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={display.progressPercent}
        >
          <span style={{ width: `${display.progressPercent}%` }} />
        </div>
      </div>
    </Html>
  )
}
