import { useEffect, useState, type JSX } from 'react'
import { buildingCatalogById } from '../../game/buildingCatalog'
import { BUILDING_RENDER_SCALE } from '../../game/cityLayout'
import type { BuildingId, BuildingProgress } from '../../game/cityTypes'
import { getUnlockedChildCount } from '../../game/buildingUpgrade'
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

interface FragmentAnimationRun {
  fragmentId?: string
  run: number
}

interface HydrationStatus {
  active: boolean
  progress: BuildingProgress | null
}

// Restored progress is the initial snapshot, so only a later, single child +1
// transition can opt a fragment into the entrance animation.
function getSessionCompletedFragmentId(
  id: BuildingId,
  previous: BuildingProgress,
  progress: BuildingProgress,
): string | undefined {
  if (
    previous === progress ||
    previous.level !== progress.level ||
    previous.childLevels.length !== progress.childLevels.length
  ) {
    return undefined
  }

  const unlocked = getUnlockedChildCount(id, progress.level)
  let upgradedIndex = -1
  for (let index = 0; index < progress.childLevels.length; index += 1) {
    const delta = progress.childLevels[index] - previous.childLevels[index]
    if (index >= unlocked) {
      if (delta !== 0) {
        return undefined
      }
      continue
    }
    if (delta === 0) {
      continue
    }
    if (delta !== 1 || upgradedIndex !== -1) {
      return undefined
    }
    upgradedIndex = index
  }

  return upgradedIndex === -1
    ? undefined
    : getBuildingFragments(buildingCatalogById[id].kind)[upgradedIndex]?.id
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
  const [animation, setAnimation] = useState<FragmentAnimationRun>({
    run: 0,
  })
  const [hydration, setHydration] = useState<HydrationStatus>({
    active: !useCityStore.persist.hasHydrated(),
    progress: null,
  })

  useEffect(() => {
    const unsubscribeHydrate = useCityStore.persist.onHydrate(() => {
      setHydration({ active: true, progress: null })
    })
    const unsubscribeFinish = useCityStore.persist.onFinishHydration(
      (state) => {
        setHydration({
          active: false,
          progress: state.buildingProgress[id],
        })
      },
    )
    return () => {
      unsubscribeHydrate()
      unsubscribeFinish()
    }
  }, [id])

  if (previousProgress !== progress) {
    const suppressAnimation =
      hydration.active || hydration.progress === progress
    setPreviousProgress(progress)
    const fragmentId = suppressAnimation
      ? undefined
      : getSessionCompletedFragmentId(id, previousProgress, progress)
    if (fragmentId === undefined) {
      setAnimation((current) => ({ run: current.run }))
    } else {
      setAnimation((current) => ({
        fragmentId,
        run: current.run + 1,
      }))
    }
  }

  useEffect(() => {
    if (animation.fragmentId === undefined) {
      return
    }

    const timer = setTimeout(
      () => setAnimation((current) => ({ run: current.run })),
      BUILDING_FRAGMENT_ANIMATION_MS,
    )
    return () => clearTimeout(timer)
  }, [animation])

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
        animatedFragmentId={animation.fragmentId}
        animationRun={animation.run}
      />
    </group>
  )
}
