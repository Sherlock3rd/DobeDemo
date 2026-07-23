import { useEffect, useState, type JSX } from 'react'
import { buildingCatalogById } from '../../game/buildingCatalog'
import { getCaughtUpChildCount } from '../../game/buildingUpgrade'
import { BUILDING_RENDER_SCALE } from '../../game/cityLayout'
import type {
  BuildingId,
  BuildingKind,
  BuildingProgress,
} from '../../game/cityTypes'
import { useCityStore } from '../../store/useCityStore'
import { useGangStore } from '../../store/useGangStore'
import { BUILDING_FRAGMENT_ANIMATION_MS } from './buildingFragmentAnimation'
import { BuildingModel } from './BuildingModel'
import { getBuildingRenderMode } from './buildingAccess'
import { getBuildingFragments } from './buildingFragmentCatalog'
import { LockedBuildingPlot } from './LockedBuildingPlot'

interface BuildingVisualProps {
  id: BuildingId
  highlighted: boolean
}

// Detects a fragment that was completed during THIS session (a p -> p+1 step at
// the same level) and returns its blueprint id. Restored/rehydrated progress on
// mount keeps `previous === progress`, so a refresh never replays an entrance.
function getSessionCompletedFragmentId(
  kind: BuildingKind,
  previous: BuildingProgress,
  progress: BuildingProgress,
): string | undefined {
  if (
    previous === progress ||
    progress.level !== previous.level ||
    getCaughtUpChildCount(progress) !== getCaughtUpChildCount(previous) + 1
  ) {
    return undefined
  }

  const completedIndex = getCaughtUpChildCount(progress) - 1
  return getBuildingFragments(kind)[completedIndex]?.id
}

export function BuildingVisual({
  id,
  highlighted,
}: BuildingVisualProps): JSX.Element {
  const definition = buildingCatalogById[id]
  const progress = useCityStore((state) => state.buildingProgress[id])
  const totalReputation = useGangStore((state) => state.totalReputation)
  const renderMode = getBuildingRenderMode(id, totalReputation)

  // "Store info from previous renders" pattern: comparing progress during render
  // is StrictMode-safe (idempotent) and, unlike an effect-diff, never drops the
  // entrance under double invocation.
  const [previousProgress, setPreviousProgress] = useState(progress)
  const [animatedFragmentId, setAnimatedFragmentId] = useState<
    string | undefined
  >(undefined)

  if (previousProgress !== progress) {
    setPreviousProgress(progress)
    setAnimatedFragmentId(
      getSessionCompletedFragmentId(
        definition.kind,
        previousProgress,
        progress,
      ),
    )
  }

  useEffect(() => {
    if (animatedFragmentId === undefined) {
      return
    }

    const timer = setTimeout(
      () => setAnimatedFragmentId(undefined),
      BUILDING_FRAGMENT_ANIMATION_MS,
    )
    return () => clearTimeout(timer)
  }, [animatedFragmentId])

  const renderedFootprint = [
    definition.footprint[0] * BUILDING_RENDER_SCALE,
    definition.footprint[1] * BUILDING_RENDER_SCALE,
  ] as const

  if (renderMode === 'locked') {
    return (
      <LockedBuildingPlot
        footprint={renderedFootprint}
        highlighted={highlighted}
      />
    )
  }

  return (
    <group scale={BUILDING_RENDER_SCALE}>
      <BuildingModel
        definition={definition}
        progress={progress}
        highlighted={highlighted}
        animatedFragmentId={animatedFragmentId}
      />
    </group>
  )
}
