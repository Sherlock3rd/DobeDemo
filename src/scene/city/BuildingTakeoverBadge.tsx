import { Html } from '@react-three/drei'
import {
  useEffect,
  useRef,
  type MouseEvent,
  type PointerEvent,
  type JSX,
} from 'react'
import { buildingCatalogById } from '../../game/buildingCatalog'
import type { BuildingId } from '../../game/cityTypes'
import { useCityStore } from '../../store/useCityStore'
import { useGangStore } from '../../store/useGangStore'
import { getBuildingAccessState } from './buildingAccess'

interface BuildingTakeoverBadgeProps {
  buildingId: BuildingId
  guided?: boolean
  onClaimed?: (buildingId: BuildingId) => void
}

export function BuildingTakeoverBadge({
  buildingId,
  guided = false,
  onClaimed,
}: BuildingTakeoverBadgeProps): JSX.Element | null {
  const gangLevel = useGangStore((state) => state.currentLevel)
  const claimedBuildingIds = useCityStore((state) => state.claimedBuildingIds)
  const claimBuilding = useCityStore((state) => state.claimBuilding)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const accessState = getBuildingAccessState(
    buildingId,
    gangLevel,
    claimedBuildingIds,
  )

  useEffect(() => {
    if (guided) buttonRef.current?.focus()
  }, [guided])

  if (accessState !== 'claimable') return null

  const buildingName = buildingCatalogById[buildingId].name

  const stopPropagation = (
    event: MouseEvent<HTMLButtonElement> | PointerEvent<HTMLButtonElement>,
  ): void => {
    event.stopPropagation()
  }

  return (
    <Html position={[0, guided ? 3.45 : 4.65, 0]} center zIndexRange={[8, 8]}>
      <button
        ref={buttonRef}
        type="button"
        className="building-takeover-badge"
        data-guided={guided || undefined}
        aria-label={`接管${buildingName}管理权`}
        onPointerDown={stopPropagation}
        onClick={(event) => {
          stopPropagation(event)
          if (claimBuilding(buildingId, gangLevel, Date.now())) {
            onClaimed?.(buildingId)
          }
        }}
      >
        <span className="building-takeover-badge__icon" aria-hidden="true">
          ↗
        </span>
        <span>
          <strong>可接管</strong>
          <small>{buildingName}管理权</small>
        </span>
      </button>
    </Html>
  )
}
