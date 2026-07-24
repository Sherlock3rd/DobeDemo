import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState, type JSX } from 'react'
import { AdventureIdleClock } from './game/AdventureIdleClock'
import { EconomyIdleController } from './game/EconomyIdleController'
import { GangIdleController } from './game/GangIdleController'
import type { BuildingId } from './game/cityTypes'
import { CAMERA_CONFIG } from './game/cityLayout'
import { getGangLevel } from './game/gangProgression'
import { CityScene } from './scene/city/CityScene'
import { useAdventureStore } from './store/useAdventureStore'
import { useCityStore } from './store/useCityStore'
import { useGangStore } from './store/useGangStore'
import { AdventurePanel } from './ui/AdventurePanel'
import { AppErrorBoundary } from './ui/AppErrorBoundary'
import { BattleScreen } from './ui/BattleScreen'
import { BuildingPanel } from './ui/BuildingPanel'
import { FormationPanel } from './ui/FormationPanel'
import { GangTreePanel } from './ui/GangTreePanel'
import { GlobalHud } from './ui/GlobalHud'
import { HeroesPanel } from './ui/HeroesPanel'
import { SettingsPanel } from './ui/SettingsPanel'
import './App.css'

export type ActiveOverlay =
  | { kind: 'none' }
  | { kind: 'buildingDetail'; buildingId: BuildingId }
  | { kind: 'gangTree' }
  | { kind: 'settings' }
  | { kind: 'adventure' }
  | { kind: 'formation'; stage: number }
  | { kind: 'heroes' }
  | { kind: 'battle'; stage: number }

type PlayOverlay = Exclude<ActiveOverlay, { kind: 'buildingDetail' }>

const FULLSCREEN_KINDS = new Set(['adventure', 'formation', 'heroes', 'battle'])
const MODAL_KINDS = new Set([
  'gangTree',
  'settings',
  'adventure',
  'formation',
  'heroes',
  'battle',
])

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
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const pendingFocusRestoreRef = useRef(false)
  const selectedBuildingId = useCityStore((s) => s.selectedBuildingId)
  const clearSelection = useCityStore((s) => s.clearSelection)
  const totalReputation = useGangStore((s) => s.totalReputation)
  const gangLevel = getGangLevel(totalReputation)
  const reconcileWithGang = useAdventureStore((s) => s.reconcileWithGang)
  const activeOverlay = resolveActiveOverlay(playOverlay, selectedBuildingId)

  useEffect(() => {
    const reconcileWhenBothHydrated = (): void => {
      if (
        !useAdventureStore.persist.hasHydrated() ||
        !useGangStore.persist.hasHydrated()
      ) {
        return
      }
      const level = getGangLevel(useGangStore.getState().totalReputation)
      useAdventureStore.getState().reconcileWithGang(level)
    }

    const unsubAdventure = useAdventureStore.persist.onFinishHydration(
      reconcileWhenBothHydrated,
    )
    const unsubGang = useGangStore.persist.onFinishHydration(
      reconcileWhenBothHydrated,
    )
    reconcileWhenBothHydrated()

    return () => {
      unsubAdventure()
      unsubGang()
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
    if (activeOverlay.kind !== 'battle') {
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

    document
      .querySelector<HTMLElement>(
        '[role="dialog"][aria-label="战斗"] button:not(:disabled)',
      )
      ?.focus()
  }, [activeOverlay.kind])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (activeOverlay.kind === 'none' || activeOverlay.kind === 'battle') {
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
  }, [activeOverlay.kind, clearSelection])

  const hideCityCanvas = FULLSCREEN_KINDS.has(activeOverlay.kind)
  const isolateCityBackground = MODAL_KINDS.has(activeOverlay.kind)
  const isolateHud = activeOverlay.kind === 'battle'

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
              <CityScene />
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
        <GangIdleController />
        <EconomyIdleController />
        <AdventureIdleClock />
        <div
          aria-hidden={isolateHud || undefined}
          inert={isolateHud ? true : undefined}
          hidden={isolateHud}
        >
          <GlobalHud
            onOpenHeroes={() => openOverlay({ kind: 'heroes' })}
            onOpenGangTree={() => openOverlay({ kind: 'gangTree' })}
            onOpenAdventure={() => openOverlay({ kind: 'adventure' })}
            onOpenSettings={() => openOverlay({ kind: 'settings' })}
          />
        </div>
        {activeOverlay.kind === 'buildingDetail' ? <BuildingPanel /> : null}
        <GangTreePanel
          open={activeOverlay.kind === 'gangTree'}
          onClose={closeOverlay}
        />
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
          <HeroesPanel onClose={closeOverlay} />
        ) : null}
        {activeOverlay.kind === 'battle' ? (
          <BattleScreen
            stage={activeOverlay.stage}
            onExit={() => setPlayOverlay({ kind: 'adventure' })}
          />
        ) : null}
      </main>
    </AppErrorBoundary>
  )
}
