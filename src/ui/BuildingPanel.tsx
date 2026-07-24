import {
  useEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  economyConfig,
  getBuildingPower,
  type ResourceCost,
  type ResourceWallet,
} from '../config/economyConfig'
import { buildingCatalogById } from '../game/buildingCatalog'
import {
  BUILDING_MAX_LEVEL,
  getBuildingStageProgress,
  getChildUpgradeDecision,
  getMainUpgradeDecision,
  getUnlockedChildCount,
  type ChildUpgradeDecision,
} from '../game/buildingUpgrade'
import type { BuildingId, BuildingLevel } from '../game/cityTypes'
import {
  getBuildingUnlock,
  getGangLevel,
  getGangRole,
  isBuildingUnlocked,
} from '../game/gangProgression'
import {
  EMPTY_WALLET,
  getBuildingProductionPerTick,
} from '../game/resourceEconomy'
import { getBuildingFragments } from '../scene/city/buildingFragmentCatalog'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import {
  findDefaultChildIndex,
  findNextIncompleteChildIndex,
  formatNonZeroCost,
  mainUpgradeBlockerMessage,
  type BuildingPanelView,
  type MainUpgradeBlockReason,
} from './buildingPanelSession'

const TITLE_ID = 'building-panel-title'
const CONFIRM_TITLE_ID = 'building-panel-confirm-title'
const CANVAS_LABEL = '工业城市 3D 场景'

interface PanelSession {
  buildingId: BuildingId
  view: BuildingPanelView
}

function formatProduction(production: ResourceWallet): string {
  if (production.money > 0) {
    return `本建筑产出 钱 +${production.money}/10秒`
  }
  if (production.oil > 0) {
    return `本建筑产出 油 +${production.oil}/10秒`
  }
  if (production.materials > 0) {
    return `本建筑产出 物资 +${production.materials}/10秒`
  }
  return '本建筑暂无产出'
}

function focusCanvas(): void {
  document.querySelector<HTMLElement>(`[aria-label="${CANVAS_LABEL}"]`)?.focus()
}

// Keeps the wall-clock read behind a module-level function so upgrade
// handlers can call it without the component body itself touching an impure
// API during render.
function readNow(): number {
  return Date.now()
}

function createDefaultSession(buildingId: BuildingId): PanelSession {
  const currentProgress = useCityStore.getState().buildingProgress[buildingId]
  const unlockedCount = getUnlockedChildCount(buildingId, currentProgress.level)
  return {
    buildingId,
    view: {
      kind: 'details',
      selectedChildIndex: findDefaultChildIndex(currentProgress, unlockedCount),
    },
  }
}

// The outer component only tracks which building (if any) is selected. Every
// selection identity is rendered by a `key`-ed inner instance: switching
// buildings, or closing then reopening the same building, always mounts a
// fresh `BuildingPanelSession` whose default slot is computed once via a
// lazy `useState` initializer. This keeps session identity resets out of
// render-phase setState calls and out of a `setState`-in-effect as well,
// while still giving every open exactly one session per the spec.
export function BuildingPanel(): JSX.Element | null {
  const selectedBuildingId = useCityStore((state) => state.selectedBuildingId)
  if (!selectedBuildingId) {
    return null
  }
  return (
    <BuildingPanelSession
      key={selectedBuildingId}
      buildingId={selectedBuildingId}
    />
  )
}

function BuildingPanelSession({
  buildingId: selectedBuildingId,
}: {
  buildingId: BuildingId
}): JSX.Element | null {
  const progress = useCityStore(
    (state) => state.buildingProgress[selectedBuildingId],
  )
  const repairShopProgress = useCityStore(
    (state) => state.buildingProgress['repair-shop'],
  )
  const clubhouseProgress = useCityStore(
    (state) => state.buildingProgress.clubhouse,
  )
  const resources = useCityStore((state) => state.resources)
  const clearSelection = useCityStore((state) => state.clearSelection)
  const upgradeChildBuilding = useCityStore(
    (state) => state.upgradeChildBuilding,
  )
  const upgradeMainBuilding = useCityStore((state) => state.upgradeMainBuilding)
  const totalReputation = useGangStore((state) => state.totalReputation)
  const gangLevel = getGangLevel(totalReputation)

  const [session, setSession] = useState<PanelSession>(() =>
    createDefaultSession(selectedBuildingId),
  )
  const confirmTitleRef = useRef<HTMLHeadingElement | null>(null)
  const mainButtonRef = useRef<HTMLButtonElement | null>(null)
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([])
  const pendingReturnFocusRef = useRef(false)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        clearSelection()
        focusCanvas()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearSelection])

  useEffect(() => {
    if (session.view.kind === 'main-upgrade-confirm') {
      confirmTitleRef.current?.focus()
    }
  }, [session.view.kind])

  useEffect(() => {
    if (session.view.kind === 'details' && pendingReturnFocusRef.current) {
      pendingReturnFocusRef.current = false
      mainButtonRef.current?.focus()
    }
  }, [session.view.kind])

  const building = buildingCatalogById[selectedBuildingId]
  if (!building) {
    return null
  }

  const unlock = getBuildingUnlock(selectedBuildingId)
  if (!unlock) {
    return null
  }

  const unlocked = isBuildingUnlocked(selectedBuildingId, gangLevel)

  const handleClose = (): void => {
    clearSelection()
    focusCanvas()
  }

  const closeButton = (
    <button
      type="button"
      className="building-panel__close"
      aria-label="关闭建筑面板"
      onClick={handleClose}
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
  const unlockedChildCount = getUnlockedChildCount(selectedBuildingId, level)
  const visibleBlueprints = getBuildingFragments(building.kind).slice(
    0,
    unlockedChildCount,
  )
  const production = getBuildingProductionPerTick(
    selectedBuildingId,
    progress.childLevels,
  )
  const upgradeProgress = getBuildingStageProgress(selectedBuildingId, progress)

  const selectChild = (index: number): void => {
    setSession((current) =>
      current.view.kind === 'details'
        ? { ...current, view: { ...current.view, selectedChildIndex: index } }
        : current,
    )
  }

  const handleRadioKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void => {
    let nextIndex: number
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % unlockedChildCount
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + unlockedChildCount) % unlockedChildCount
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = unlockedChildCount - 1
        break
      default:
        return
    }
    event.preventDefault()
    selectChild(nextIndex)
    radioRefs.current[nextIndex]?.focus()
  }

  const handleOpenMainConfirm = (): void => {
    // Only ever a pure state transition: never reads the clock or the store.
    setSession((current) => ({
      buildingId: current.buildingId,
      view: {
        kind: 'main-upgrade-confirm',
        selectedChildIndex: current.view.selectedChildIndex,
        actionReason: null,
      },
    }))
  }

  const handleBack = (): void => {
    pendingReturnFocusRef.current = true
    setSession((current) => ({
      buildingId: current.buildingId,
      view: {
        kind: 'details',
        selectedChildIndex: current.view.selectedChildIndex,
      },
    }))
  }

  const handleChildUpgrade = (): void => {
    if (
      session.view.kind !== 'details' ||
      session.view.selectedChildIndex === null
    ) {
      return
    }
    const index = session.view.selectedChildIndex
    const result = upgradeChildBuilding(
      selectedBuildingId,
      index,
      gangLevel,
      readNow(),
    )
    if (!result.applied) {
      return
    }
    const latest = useCityStore.getState().buildingProgress[selectedBuildingId]
    const latestUnlockedCount = getUnlockedChildCount(
      selectedBuildingId,
      latest.level,
    )
    const nextIndex =
      (latest.childLevels[index] ?? 0) < latest.level
        ? index
        : findNextIncompleteChildIndex(latest, latestUnlockedCount, index)
    setSession({
      buildingId: selectedBuildingId,
      view: { kind: 'details', selectedChildIndex: nextIndex },
    })
  }

  const handleConfirmMainUpgrade = (): void => {
    const id = selectedBuildingId
    const priorProgress = useCityStore.getState().buildingProgress[id]
    const previousUnlocked = getUnlockedChildCount(id, priorProgress.level)
    const result = upgradeMainBuilding(id, gangLevel, readNow())
    if (!result.applied) {
      setSession((current) =>
        current.view.kind === 'main-upgrade-confirm'
          ? {
              ...current,
              view: {
                ...current.view,
                actionReason: result.reason as MainUpgradeBlockReason,
              },
            }
          : current,
      )
      return
    }
    const latest = useCityStore.getState().buildingProgress[id]
    const nextUnlocked = getUnlockedChildCount(id, latest.level)
    const selectedChildIndex =
      nextUnlocked > previousUnlocked
        ? previousUnlocked
        : findDefaultChildIndex(latest, nextUnlocked)
    setSession({
      buildingId: id,
      view: { kind: 'details', selectedChildIndex },
    })
  }

  if (session.view.kind === 'main-upgrade-confirm') {
    const isMaxed = level >= BUILDING_MAX_LEVEL
    const targetLevel = isMaxed ? null : ((level + 1) as BuildingLevel)
    const confirmDecision = targetLevel
      ? getMainUpgradeDecision({
          buildingId: selectedBuildingId,
          progress,
          repairShopProgress,
          clubhouseProgress,
          wallet: resources,
          gangLevel,
        })
      : null
    const cost: ResourceCost = targetLevel
      ? (economyConfig.buildingUpgradeCostByTargetLevel[targetLevel] ??
        EMPTY_WALLET)
      : EMPTY_WALLET
    const currentPower = getBuildingPower(selectedBuildingId, level)
    const nextPower = targetLevel
      ? getBuildingPower(selectedBuildingId, targetLevel)
      : currentPower
    const powerDelta = nextPower - currentPower
    const blockerText = confirmDecision
      ? mainUpgradeBlockerMessage(confirmDecision, level)
      : '已达到最高等级 Lv.10'
    const canConfirm = confirmDecision?.reason === 'ready'

    return (
      <section
        className="building-panel"
        aria-labelledby={CONFIRM_TITLE_ID}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {closeButton}
        <h2
          id={CONFIRM_TITLE_ID}
          ref={confirmTitleRef}
          tabIndex={-1}
          className="building-panel__title"
        >
          {`${building.name} · 目标等级 Lv.${targetLevel ?? BUILDING_MAX_LEVEL}`}
        </h2>
        <ul className="building-panel__confirm-cost" aria-label="升级成本">
          <li>{`钱 ${cost.money}`}</li>
          <li>{`油 ${cost.oil}`}</li>
          <li>{`物资 ${cost.materials}`}</li>
        </ul>
        <p className="building-panel__confirm-power">{`当前建筑战力 ${currentPower}`}</p>
        <p className="building-panel__confirm-power">{`本次战力 +${powerDelta}`}</p>
        <p className="building-panel__confirm-power">{`升级后战力 ${nextPower}`}</p>
        {!canConfirm ? (
          <p className="building-panel__main-blocker" role="alert">
            {blockerText}
          </p>
        ) : null}
        <div className="building-panel__confirm-actions">
          <button
            type="button"
            className="building-panel__confirm-back"
            onClick={handleBack}
          >
            返回
          </button>
          <button
            type="button"
            className="building-panel__confirm-submit"
            disabled={!canConfirm}
            onClick={handleConfirmMainUpgrade}
          >
            确认升级
          </button>
        </div>
      </section>
    )
  }

  const selectedChildIndex = session.view.selectedChildIndex
  const childDecision: ChildUpgradeDecision =
    selectedChildIndex === null
      ? {
          reason: 'child-locked',
          targetLevel: null,
          cost: null,
          missingResources: EMPTY_WALLET,
        }
      : getChildUpgradeDecision({
          buildingId: selectedBuildingId,
          childIndex: selectedChildIndex,
          progress,
          wallet: resources,
          gangLevel,
        })
  const selectedFragment =
    selectedChildIndex === null ? null : visibleBlueprints[selectedChildIndex]

  const childButtonLabel =
    !selectedFragment ||
    childDecision.targetLevel === null ||
    childDecision.cost === null
      ? '请选择要升级的子建筑'
      : (() => {
          const costText = formatNonZeroCost(childDecision.cost)
          return costText === '免费'
            ? `升级「${selectedFragment.name}」至 Lv.${childDecision.targetLevel}`
            : `升级「${selectedFragment.name}」至 Lv.${childDecision.targetLevel} · ${costText}`
        })()

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
      <p className="building-panel__level">{`等级 ${level} / ${BUILDING_MAX_LEVEL}`}</p>

      <section
        className="building-panel__economy-summary"
        aria-label="资源概览"
      >
        <p className="building-panel__production">
          {formatProduction(production)}
        </p>
        <ul className="building-panel__wallet">
          <li>{`钱 ${Math.trunc(resources.money)}`}</li>
          <li>{`油 ${Math.trunc(resources.oil)}`}</li>
          <li>{`物资 ${Math.trunc(resources.materials)}`}</li>
        </ul>
      </section>

      <div
        role="radiogroup"
        aria-label="选择子建筑"
        className="building-panel__selector"
      >
        {visibleBlueprints.map((fragment, index) => {
          const childLevel = progress.childLevels[index] ?? 0
          const checked = selectedChildIndex === index
          return (
            <button
              key={fragment.id}
              ref={(node) => {
                radioRefs.current[index] = node
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              className={
                checked
                  ? 'building-panel__child-option building-panel__child-option--checked'
                  : 'building-panel__child-option'
              }
              onClick={() => selectChild(index)}
              onKeyDown={(event) => handleRadioKeyDown(event, index)}
            >
              <span className="building-panel__child-check" aria-hidden="true">
                {checked ? '●' : '○'}
              </span>
              <span className="building-panel__child-name">
                {fragment.name}
              </span>
              <span className="building-panel__child-desc">
                {fragment.description}
              </span>
              <span className="building-panel__child-status">
                {`Lv.${childLevel} / Lv.${level}`}
              </span>
            </button>
          )
        })}
      </div>

      <section className="building-panel__progress" aria-label="子建筑升级进度">
        <div
          className="building-panel__progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={upgradeProgress.percent}
        >
          <span
            className="building-panel__progress-fill"
            style={{ width: `${upgradeProgress.percent}%` }}
          />
        </div>
        <span className="building-panel__progress-label">
          {upgradeProgress.complete
            ? '100%'
            : `${Math.floor(upgradeProgress.percent)}%`}
        </span>
        {!upgradeProgress.complete ? (
          <>
            <button
              type="button"
              className="building-panel__shared-upgrade"
              disabled={childDecision.reason !== 'ready'}
              onClick={handleChildUpgrade}
            >
              {childButtonLabel}
            </button>
            {childDecision.reason === 'insufficient-resources' ? (
              <p className="building-panel__child-shortfall" role="alert">
                {`资源不足，还需 ${formatNonZeroCost(childDecision.missingResources)}`}
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      {upgradeProgress.complete ? (
        level < BUILDING_MAX_LEVEL ? (
          <button
            ref={mainButtonRef}
            type="button"
            className="building-panel__main-button"
            onClick={handleOpenMainConfirm}
          >
            {`升级主建筑至 Lv.${level + 1}`}
          </button>
        ) : (
          <p className="building-panel__main-status">
            {`已达到最高等级 Lv.${BUILDING_MAX_LEVEL}`}
          </p>
        )
      ) : null}
    </section>
  )
}
