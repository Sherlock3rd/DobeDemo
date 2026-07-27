import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
} from 'react'
import { AdventureIdleClock } from './game/AdventureIdleClock'
import { BuildingUpgradeController } from './game/BuildingUpgradeController'
import { EconomyIdleController } from './game/EconomyIdleController'
import { PartSalvageController } from './game/PartSalvageController'
import type { ChapterTaskRequirement } from './game/chapterProgression'
import { getChapterForGangLevel } from './game/chapterProgression'
import type { BuildingId } from './game/cityTypes'
import {
  getNarrativeEvent,
  type NarrativeEvent,
  type NarrativeEventId,
} from './game/narrative'
import { CAMERA_CONFIG } from './game/cityLayout'
import { CityScene } from './scene/city/CityScene'
import { useAdventureStore } from './store/useAdventureStore'
import { useCityStore } from './store/useCityStore'
import { useChapterStore } from './store/useChapterStore'
import { useGangStore } from './store/useGangStore'
import { AdventurePanel } from './ui/AdventurePanel'
import { AppErrorBoundary } from './ui/AppErrorBoundary'
import { BattleScreen } from './ui/BattleScreen'
import { BuildingPanel } from './ui/BuildingPanel'
import { FormationPanel } from './ui/FormationPanel'
import { GangTreePanel } from './ui/GangTreePanel'
import { ChapterPanel } from './ui/ChapterPanel'
import { GlobalHud } from './ui/GlobalHud'
import { HeroesPanel, type DevelopmentTab } from './ui/HeroesPanel'
import { RacingPanel } from './ui/RacingPanel'
import { RaceScreen } from './ui/RaceScreen'
import type { HeroId } from './game/heroes'
import { SettingsPanel } from './ui/SettingsPanel'
import { NarrativeDialogueOverlay } from './ui/NarrativeDialogueOverlay'
import { ProgressionMilestoneOverlay } from './ui/ProgressionMilestoneOverlay'
import './App.css'

export type ActiveOverlay =
  | { kind: 'none' }
  | { kind: 'buildingDetail'; buildingId: BuildingId }
  | { kind: 'gangTree' }
  | { kind: 'chapters' }
  | { kind: 'settings' }
  | { kind: 'adventure' }
  | { kind: 'formation'; stage: number }
  | { kind: 'heroes'; initialTab?: DevelopmentTab }
  | { kind: 'battle'; stage: number }
  | { kind: 'racing' }
  | { kind: 'race'; stage: number; heroId: HeroId }
  | { kind: 'buildingUnlock'; buildingId: BuildingId }
  | { kind: 'chapterComplete'; chapterNumber: number }

type PlayOverlay = Exclude<ActiveOverlay, { kind: 'buildingDetail' }>

const FULLSCREEN_KINDS = new Set([
  'adventure',
  'formation',
  'heroes',
  'battle',
  'racing',
  'race',
  'chapters',
  'chapterComplete',
])
const MODAL_KINDS = new Set([
  'gangTree',
  'settings',
  'adventure',
  'formation',
  'heroes',
  'battle',
  'racing',
  'race',
  'chapters',
  'buildingUnlock',
  'chapterComplete',
])

interface QueuedNarrative {
  event: NarrativeEvent
  after?: 'gangTree'
}

function resolveActiveOverlay(
  playOverlay: PlayOverlay,
  selectedBuildingId: BuildingId | null,
): ActiveOverlay {
  if (playOverlay.kind !== 'none') return playOverlay
  if (selectedBuildingId) {
    return { kind: 'buildingDetail', buildingId: selectedBuildingId }
  }
  return { kind: 'none' }
}

export default function App(): JSX.Element {
  const [playOverlay, setPlayOverlay] = useState<PlayOverlay>({ kind: 'none' })
  const [narrativeQueue, setNarrativeQueue] = useState<QueuedNarrative[]>([])
  const queuedNarrativeIdsRef = useRef(new Set<NarrativeEventId>())
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const pendingFocusRestoreRef = useRef(false)
  const selectedBuildingId = useCityStore((s) => s.selectedBuildingId)
  const selectBuilding = useCityStore((s) => s.selectBuilding)
  const clearSelection = useCityStore((s) => s.clearSelection)
  const gangLevel = useGangStore((s) => s.currentLevel)
  const claimedBuildingIds = useCityStore((s) => s.claimedBuildingIds)
  const seenNarrativeIds = useChapterStore((s) => s.seenNarrativeIds)
  const markNarrativeSeen = useChapterStore((s) => s.markNarrativeSeen)
  const reconcileWithGang = useAdventureStore((s) => s.reconcileWithGang)
  const activeOverlay = resolveActiveOverlay(playOverlay, selectedBuildingId)
  const activeNarrative = narrativeQueue[0] ?? null

  const enqueueNarrative = useCallback(
    (eventId: NarrativeEventId, after?: 'gangTree'): void => {
      if (
        seenNarrativeIds.includes(eventId) ||
        queuedNarrativeIdsRef.current.has(eventId)
      ) {
        return
      }
      const event = getNarrativeEvent(eventId)
      if (!event) return
      queuedNarrativeIdsRef.current.add(eventId)
      setNarrativeQueue((current) => [...current, { event, after }])
    },
    [seenNarrativeIds],
  )

  useEffect(() => {
    const reconcileWhenBothHydrated = (): void => {
      if (
        !useAdventureStore.persist.hasHydrated() ||
        !useGangStore.persist.hasHydrated() ||
        !useCityStore.persist.hasHydrated()
      ) {
        return
      }
      const level = useGangStore.getState().currentLevel
      useAdventureStore.getState().reconcileWithGang(level)
      useAdventureStore.getState().syncCityRewardMoney()
    }

    const unsubAdventure = useAdventureStore.persist.onFinishHydration(
      reconcileWhenBothHydrated,
    )
    const unsubGang = useGangStore.persist.onFinishHydration(
      reconcileWhenBothHydrated,
    )
    const unsubCity = useCityStore.persist.onFinishHydration(
      reconcileWhenBothHydrated,
    )
    reconcileWhenBothHydrated()

    return () => {
      unsubAdventure()
      unsubGang()
      unsubCity()
    }
  }, [])

  useEffect(() => {
    if (
      !useAdventureStore.persist.hasHydrated() ||
      !useGangStore.persist.hasHydrated()
    ) {
      return
    }
    reconcileWithGang(gangLevel)
  }, [gangLevel, reconcileWithGang])

  useEffect(() => {
    if (
      playOverlay.kind !== 'none' ||
      !useGangStore.persist.hasHydrated() ||
      !useChapterStore.persist.hasHydrated()
    ) {
      return
    }
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      enqueueNarrative('first-entry')
      enqueueNarrative(
        `chapter-start:${getChapterForGangLevel(gangLevel).number}`,
      )
    })
    return () => {
      cancelled = true
    }
  }, [enqueueNarrative, gangLevel, playOverlay.kind])

  const openOverlay = (overlay: PlayOverlay): void => {
    if (document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement
    }
    clearSelection()
    setPlayOverlay(overlay)
  }

  const closeOverlay = (): void => {
    if (activeOverlay.kind === 'buildingDetail') {
      clearSelection()
    } else if (activeOverlay.kind !== 'none') {
      pendingFocusRestoreRef.current = true
    }
    setPlayOverlay({ kind: 'none' })
  }

  const navigateFromChapter = (requirement: ChapterTaskRequirement): void => {
    switch (requirement.kind) {
      case 'building-level':
        setPlayOverlay({ kind: 'none' })
        if (claimedBuildingIds.includes(requirement.buildingId)) {
          selectBuilding(requirement.buildingId)
        }
        return
      case 'hero-level':
        setPlayOverlay({ kind: 'heroes', initialTab: 'level' })
        return
      case 'part-level':
        setPlayOverlay({ kind: 'heroes', initialTab: 'car' })
        return
      case 'gun-level':
        setPlayOverlay({ kind: 'heroes', initialTab: 'gun' })
        return
      case 'campaign-clears':
        setPlayOverlay({ kind: 'adventure' })
        return
      case 'racing-clears':
        setPlayOverlay({ kind: 'racing' })
    }
  }

  useEffect(() => {
    if (activeOverlay.kind !== 'none' || !pendingFocusRestoreRef.current) {
      return
    }

    pendingFocusRestoreRef.current = false
    const target = returnFocusRef.current
    returnFocusRef.current = null
    if (target?.isConnected) {
      target.focus()
    }
  }, [activeOverlay.kind])

  useEffect(() => {
    if (activeOverlay.kind !== 'battle' && activeOverlay.kind !== 'race') {
      return
    }

    const currentFocus = document.activeElement
    if (
      currentFocus instanceof HTMLElement &&
      currentFocus !== document.body &&
      currentFocus.isConnected
    ) {
      return
    }

    const label = activeOverlay.kind === 'battle' ? '战斗' : '公路争霸'
    document
      .querySelector<HTMLElement>(
        `[role="dialog"][aria-label="${label}"] button:not(:disabled)`,
      )
      ?.focus()
  }, [activeOverlay.kind])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (
        activeNarrative ||
        activeOverlay.kind === 'none' ||
        activeOverlay.kind === 'battle' ||
        activeOverlay.kind === 'race' ||
        activeOverlay.kind === 'buildingUnlock' ||
        activeOverlay.kind === 'chapterComplete'
      ) {
        return
      }
      if (activeOverlay.kind === 'buildingDetail') {
        clearSelection()
        return
      }
      if (activeOverlay.kind === 'formation') {
        setPlayOverlay({ kind: 'adventure' })
        return
      }
      pendingFocusRestoreRef.current = true
      setPlayOverlay({ kind: 'none' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeNarrative, activeOverlay.kind, clearSelection])

  const hideCityCanvas = FULLSCREEN_KINDS.has(activeOverlay.kind)
  const isolateCityBackground =
    MODAL_KINDS.has(activeOverlay.kind) || activeNarrative !== null
  const isolateHud = activeOverlay.kind !== 'none' || activeNarrative !== null

  const finishActiveNarrative = (): void => {
    if (!activeNarrative) return
    markNarrativeSeen(activeNarrative.event.id)
    queuedNarrativeIdsRef.current.delete(activeNarrative.event.id)
    setNarrativeQueue((current) => current.slice(1))
    if (activeNarrative.after === 'gangTree') {
      setPlayOverlay({ kind: 'gangTree' })
    }
  }

  return (
    <AppErrorBoundary>
      <main className="city-app">
        <div
          className={
            hideCityCanvas
              ? 'city-app__canvas-wrap city-app__canvas-wrap--hidden'
              : 'city-app__canvas-wrap'
          }
          aria-hidden={isolateCityBackground || undefined}
          inert={isolateCityBackground ? true : undefined}
        >
          <Canvas
            className="city-app__canvas"
            tabIndex={0}
            aria-label="工业城市 3D 场景"
            shadows
            orthographic
            camera={{
              position: CAMERA_CONFIG.position,
              zoom: CAMERA_CONFIG.initialZoom,
              near: 0.1,
              far: 200,
            }}
            dpr={[1, 1.75]}
          >
            <Suspense fallback={null}>
              <CityScene
                onBuildingClaimed={(buildingId) =>
                  setPlayOverlay({ kind: 'buildingUnlock', buildingId })
                }
              />
            </Suspense>
          </Canvas>
        </div>
        <Loader
          containerStyles={{ background: 'rgba(4, 10, 24, 0.92)' }}
          innerStyles={{ width: 'min(18rem, 72vw)' }}
          barStyles={{ background: '#ffd43b' }}
          dataStyles={{ color: '#f8fafc', fontSize: '0.875rem' }}
          dataInterpolation={(progress) =>
            `正在加载城市场景… ${progress.toFixed(0)}%`
          }
        />
        <EconomyIdleController />
        <BuildingUpgradeController />
        <PartSalvageController />
        <AdventureIdleClock />
        <div
          aria-hidden={isolateHud || undefined}
          inert={isolateHud ? true : undefined}
          hidden={isolateHud}
        >
          <GlobalHud
            onOpenHeroes={() => openOverlay({ kind: 'heroes' })}
            onOpenGangTree={() => openOverlay({ kind: 'gangTree' })}
            onOpenChapters={() => openOverlay({ kind: 'chapters' })}
            onOpenAdventure={() => openOverlay({ kind: 'adventure' })}
            onOpenRacing={() => openOverlay({ kind: 'racing' })}
            onOpenSettings={() => openOverlay({ kind: 'settings' })}
          />
        </div>
        {activeOverlay.kind === 'buildingDetail' ? <BuildingPanel /> : null}
        <GangTreePanel
          open={activeOverlay.kind === 'gangTree'}
          onClose={closeOverlay}
          onRolePromoted={(level) => {
            enqueueNarrative(`promotion:${level}`)
            enqueueNarrative(
              `chapter-start:${getChapterForGangLevel(level).number}`,
            )
          }}
        />
        {activeOverlay.kind === 'chapters' ? (
          <ChapterPanel
            onClose={closeOverlay}
            onNavigateTask={navigateFromChapter}
            onChapterCompleted={(chapterNumber) =>
              setPlayOverlay({ kind: 'chapterComplete', chapterNumber })
            }
          />
        ) : null}
        {activeOverlay.kind === 'settings' ? (
          <SettingsPanel onClose={closeOverlay} />
        ) : null}
        {activeOverlay.kind === 'adventure' ? (
          <AdventurePanel
            onClose={closeOverlay}
            onChallenge={(stage) =>
              setPlayOverlay({ kind: 'formation', stage })
            }
          />
        ) : null}
        {activeOverlay.kind === 'formation' ? (
          <FormationPanel
            stage={activeOverlay.stage}
            onCancel={() => setPlayOverlay({ kind: 'adventure' })}
            onStart={(stage) => setPlayOverlay({ kind: 'battle', stage })}
          />
        ) : null}
        {activeOverlay.kind === 'heroes' ? (
          <HeroesPanel
            onClose={closeOverlay}
            initialTab={activeOverlay.initialTab}
          />
        ) : null}
        {activeOverlay.kind === 'battle' ? (
          <BattleScreen
            stage={activeOverlay.stage}
            onExit={() => setPlayOverlay({ kind: 'adventure' })}
            onDevelop={() =>
              setPlayOverlay({ kind: 'heroes', initialTab: 'level' })
            }
          />
        ) : null}
        {activeOverlay.kind === 'racing' ? (
          <RacingPanel
            onClose={closeOverlay}
            onStart={(stage, heroId) =>
              setPlayOverlay({ kind: 'race', stage, heroId })
            }
          />
        ) : null}
        {activeOverlay.kind === 'race' ? (
          <RaceScreen
            stage={activeOverlay.stage}
            heroId={activeOverlay.heroId}
            onExit={() => setPlayOverlay({ kind: 'racing' })}
            onDevelop={() =>
              setPlayOverlay({ kind: 'heroes', initialTab: 'car' })
            }
          />
        ) : null}
        {activeOverlay.kind === 'buildingUnlock' ? (
          <ProgressionMilestoneOverlay
            milestone={{
              kind: 'building',
              buildingId: activeOverlay.buildingId,
            }}
            onContinue={() => {
              const buildingId = activeOverlay.buildingId
              setPlayOverlay({ kind: 'none' })
              enqueueNarrative(`building-claimed:${buildingId}`)
            }}
          />
        ) : null}
        {activeOverlay.kind === 'chapterComplete' ? (
          <ProgressionMilestoneOverlay
            milestone={{
              kind: 'chapter',
              chapterNumber: activeOverlay.chapterNumber,
            }}
            onContinue={() => {
              const chapterNumber = activeOverlay.chapterNumber
              setPlayOverlay({ kind: 'none' })
              enqueueNarrative(`chapter-end:${chapterNumber}`, 'gangTree')
            }}
          />
        ) : null}
        {activeNarrative ? (
          <NarrativeDialogueOverlay
            key={activeNarrative.event.id}
            event={activeNarrative.event}
            onComplete={finishActiveNarrative}
          />
        ) : null}
      </main>
    </AppErrorBoundary>
  )
}
