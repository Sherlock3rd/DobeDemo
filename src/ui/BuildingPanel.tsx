import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
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
  getMainUpgradeDurationMs,
  getMainUpgradeDecision,
  getUnlockedChildCount,
  MAIN_UPGRADE_QUEUE_LIMIT,
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
import {
  CAR_PART_INVENTORY_LIMIT,
  CAR_PART_QUALITY_INFO,
  CAR_PART_SLOT_INFO,
  PART_IDLE_CAP_MS,
  getPartSalvagePreview,
} from '../game/equipmentProgression'
import type { CarPartInstance } from '../game/equipmentTypes'
import { getBuildingFragments } from '../scene/city/buildingFragmentCatalog'
import {
  useAdventureStore,
  type PartSalvageClaimResult,
} from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { useChestTick } from '../game/chestTick'
import {
  findDefaultChildIndex,
  findNextIncompleteChildIndex,
  formatNonZeroCost,
  mainUpgradeBlockerMessage,
  type BuildingPanelView,
  type MainUpgradeBlockReason,
  type RecyclingPanelTab,
} from './buildingPanelSession'
import { ResourceAmount } from './ResourceAmount'

const TITLE_ID = 'building-panel-title'
const CONFIRM_TITLE_ID = 'building-panel-confirm-title'
const CLAIM_RESULT_TITLE_ID = 'building-panel-claim-result-title'
const CANVAS_LABEL = '工业城市 3D 场景'

interface PanelSession {
  buildingId: BuildingId
  view: BuildingPanelView
  recyclingTab: RecyclingPanelTab
}

function formatProduction(production: ResourceWallet): JSX.Element | string {
  if (production.money > 0) {
    return (
      <ResourceAmount
        kind="money"
        label="本建筑产出 钱"
        amount={`+${production.money}/10秒`}
      />
    )
  }
  if (production.oil > 0) {
    return (
      <ResourceAmount
        kind="oil"
        label="本建筑产出 油"
        amount={`+${production.oil}/10秒`}
      />
    )
  }
  if (production.materials > 0) {
    return (
      <ResourceAmount
        kind="materials"
        label="本建筑产出 物资"
        amount={`+${production.materials}/10秒`}
      />
    )
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

function formatRemainingTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0
    ? `${minutes}分${seconds.toString().padStart(2, '0')}秒`
    : `${seconds}秒`
}

function formatSalvageDuration(milliseconds: number, roundUp = false): string {
  const totalSeconds = Math.max(
    0,
    roundUp ? Math.ceil(milliseconds / 1000) : Math.floor(milliseconds / 1000),
  )
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0) parts.push(`${minutes}分`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}秒`)
  return parts.join('')
}

function SalvageResultPart({ part }: { part: CarPartInstance }): JSX.Element {
  const quality = CAR_PART_QUALITY_INFO[part.quality]
  return (
    <span
      className="heroes-panel__part-card"
      style={{ '--part-quality': quality.color } as CSSProperties}
    >
      <span className="heroes-panel__part-icon">
        {CAR_PART_SLOT_INFO[part.slot].shortName.slice(0, 1)}
      </span>
      <span>
        <strong>{CAR_PART_SLOT_INFO[part.slot].name}</strong>
        <span className="heroes-panel__part-tags">
          <em>{CAR_PART_SLOT_INFO[part.slot].shortName}</em>
          <em>{quality.name}</em>
          <em>{`Lv.${part.level}`}</em>
        </span>
      </span>
    </span>
  )
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
    recyclingTab: 'building',
  }
}

// The outer component only tracks which building (if any) is selected. Every
// selection identity is rendered by a `key`-ed inner instance: switching
// buildings, or closing then reopening the same building, always mounts a
// fresh `BuildingPanelSession`. Ordinary buildings also remount on level
// changes so their default child slot is recomputed. The recycling yard keeps
// one session across background level completions so production/result UI is
// not discarded while the panel remains open.
export function BuildingPanel(): JSX.Element | null {
  const selectedBuildingId = useCityStore((state) => state.selectedBuildingId)
  const selectedBuildingLevel = useCityStore((state) =>
    selectedBuildingId
      ? state.buildingProgress[selectedBuildingId].level
      : null,
  )
  if (!selectedBuildingId) {
    return null
  }
  const sessionKey =
    selectedBuildingId === 'recycling-yard'
      ? selectedBuildingId
      : `${selectedBuildingId}:${selectedBuildingLevel}`
  return (
    <BuildingPanelSession key={sessionKey} buildingId={selectedBuildingId} />
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
  const pendingMainUpgrades = useCityStore((state) => state.pendingMainUpgrades)
  const clearSelection = useCityStore((state) => state.clearSelection)
  const upgradeChildBuilding = useCityStore(
    (state) => state.upgradeChildBuilding,
  )
  const upgradeMainBuilding = useCityStore((state) => state.upgradeMainBuilding)
  const totalReputation = useGangStore((state) => state.totalReputation)
  const partIdleClock = useAdventureStore((state) => state.partIdleClock)
  const carPartInventory = useAdventureStore((state) => state.carPartInventory)
  const claimPartSalvage = useAdventureStore((state) => state.claimPartSalvage)
  const clockNow = useChestTick((state) => state.now)
  const [fallbackNow] = useState(readNow)
  const gangLevel = getGangLevel(totalReputation)
  const visibleNow = clockNow > 0 ? clockNow : fallbackNow
  const pendingTask = pendingMainUpgrades.find(
    (task) => task.buildingId === selectedBuildingId,
  )
  const queueFull =
    pendingMainUpgrades.length >= MAIN_UPGRADE_QUEUE_LIMIT && !pendingTask

  const [session, setSession] = useState<PanelSession>(() =>
    createDefaultSession(selectedBuildingId),
  )
  const confirmTitleRef = useRef<HTMLHeadingElement | null>(null)
  const claimResultTitleRef = useRef<HTMLHeadingElement | null>(null)
  const claimDialogRef = useRef<HTMLElement | null>(null)
  const mainButtonRef = useRef<HTMLButtonElement | null>(null)
  const productionTabRef = useRef<HTMLButtonElement | null>(null)
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([])
  const pendingReturnFocusRef = useRef(false)
  const pendingClaimReturnFocusRef = useRef(false)
  const claimInFlightRef = useRef(false)

  const handleCloseClaimResult = useCallback((): void => {
    claimInFlightRef.current = false
    pendingClaimReturnFocusRef.current = true
    setSession((current) =>
      current.view.kind === 'part-claim-result'
        ? {
            ...current,
            recyclingTab: 'production',
            view: {
              kind: 'details',
              selectedChildIndex: current.view.selectedChildIndex,
            },
          }
        : current,
    )
  }, [])

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
    } else if (session.view.kind === 'part-claim-result') {
      claimResultTitleRef.current?.focus()
    }
  }, [session.view.kind])

  useEffect(() => {
    if (session.view.kind === 'details' && pendingReturnFocusRef.current) {
      pendingReturnFocusRef.current = false
      mainButtonRef.current?.focus()
    }
  }, [session.view.kind])

  useEffect(() => {
    if (
      session.view.kind === 'details' &&
      session.recyclingTab === 'production' &&
      pendingClaimReturnFocusRef.current
    ) {
      pendingClaimReturnFocusRef.current = false
      productionTabRef.current?.focus()
    }
  }, [session.recyclingTab, session.view.kind])

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
  const sessionSelectedChildIndex = session.view.selectedChildIndex
  const sessionSelectionInvalid =
    sessionSelectedChildIndex === null ||
    sessionSelectedChildIndex < 0 ||
    sessionSelectedChildIndex >= unlockedChildCount ||
    (progress.childLevels[sessionSelectedChildIndex] ?? 0) >= level
  const selectedChildIndex =
    selectedBuildingId === 'recycling-yard' &&
    session.recyclingTab === 'building' &&
    session.view.kind === 'details' &&
    sessionSelectionInvalid
      ? findDefaultChildIndex(progress, unlockedChildCount)
      : sessionSelectedChildIndex
  const visibleBlueprints = getBuildingFragments(building.kind).slice(
    0,
    unlockedChildCount,
  )
  const production = getBuildingProductionPerTick(
    selectedBuildingId,
    progress.childLevels,
  )
  const upgradeProgress = getBuildingStageProgress(selectedBuildingId, progress)
  const queueStatus = (
    <section className="building-panel__upgrade-queue" aria-label="施工队列">
      <strong>{`施工队列 ${pendingMainUpgrades.length}/${MAIN_UPGRADE_QUEUE_LIMIT}`}</strong>
      {pendingTask ? (
        <span>{`升级至 Lv.${pendingTask.targetLevel} · 剩余 ${formatRemainingTime(
          pendingTask.completesAt - visibleNow,
        )}`}</span>
      ) : (
        <span>{queueFull ? '施工队列已满' : '可开始主建筑升级'}</span>
      )}
    </section>
  )
  const isRecyclingYard = selectedBuildingId === 'recycling-yard'
  const salvagePreview = getPartSalvagePreview({
    lastUpdatedAt: partIdleClock,
    now: visibleNow,
    recyclingYardLevel: level,
  })
  const salvageProgressPercent =
    salvagePreview.intervalMs > 0
      ? (salvagePreview.progressInBatchMs / salvagePreview.intervalMs) * 100
      : 0

  const selectRecyclingTab = (tab: RecyclingPanelTab): void => {
    claimInFlightRef.current = false
    setSession((current) => ({
      ...current,
      recyclingTab: tab,
      view: {
        kind: 'details',
        selectedChildIndex:
          tab === 'building'
            ? selectedChildIndex
            : current.view.selectedChildIndex,
      },
    }))
  }

  const recyclingTabs = isRecyclingYard ? (
    <nav className="building-panel__tabs" aria-label="废车回收厂面板分类">
      <button
        type="button"
        aria-pressed={session.recyclingTab === 'building'}
        onClick={() => selectRecyclingTab('building')}
      >
        建筑
      </button>
      <button
        ref={productionTabRef}
        type="button"
        aria-pressed={session.recyclingTab === 'production'}
        aria-label={
          salvagePreview.canClaim
            ? `生产 · 可领取 ${salvagePreview.batchCount} 批`
            : '生产'
        }
        onClick={() => selectRecyclingTab('production')}
      >
        生产
        {salvagePreview.canClaim ? (
          <>
            <span className="building-panel__tab-dot" aria-hidden="true" />
            <span className="building-panel__tab-badge" aria-hidden="true">
              {salvagePreview.batchCount}
            </span>
          </>
        ) : null}
      </button>
    </nav>
  ) : null

  const handleClaimPartSalvage = (): void => {
    if (claimInFlightRef.current || !salvagePreview.canClaim) return
    claimInFlightRef.current = true
    const result: PartSalvageClaimResult = claimPartSalvage(
      visibleNow,
      level,
      gangLevel,
    )
    if (!result.applied) {
      claimInFlightRef.current = false
      return
    }
    setSession((current) => ({
      ...current,
      recyclingTab: 'production',
      view: {
        kind: 'part-claim-result',
        selectedChildIndex: current.view.selectedChildIndex,
        result,
      },
    }))
  }

  const handleClaimDialogKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
  ): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      event.nativeEvent.stopImmediatePropagation()
      handleCloseClaimResult()
      return
    }
    if (event.key !== 'Tab') return
    const dialog = claimDialogRef.current
    if (!dialog) return
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ),
    )
    if (focusable.length === 0) {
      event.preventDefault()
      claimResultTitleRef.current?.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (!dialog.contains(active)) {
      event.preventDefault()
      const target = event.shiftKey ? last : first
      target.focus()
    } else if (!focusable.includes(active as HTMLElement)) {
      event.preventDefault()
      const target = event.shiftKey ? last : first
      target.focus()
    } else if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

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
      recyclingTab: current.recyclingTab,
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
      recyclingTab: current.recyclingTab,
      view: {
        kind: 'details',
        selectedChildIndex: current.view.selectedChildIndex,
      },
    }))
  }

  const handleChildUpgrade = (): void => {
    if (session.view.kind !== 'details' || selectedChildIndex === null) {
      return
    }
    const index = selectedChildIndex
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
      recyclingTab: session.recyclingTab,
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
      recyclingTab: session.recyclingTab,
      view: { kind: 'details', selectedChildIndex },
    })
  }

  if (session.view.kind === 'part-claim-result') {
    const result = session.view.result
    return (
      <section
        ref={claimDialogRef}
        className="building-panel building-panel--claim-result"
        role="dialog"
        aria-modal="true"
        aria-labelledby={CLAIM_RESULT_TITLE_ID}
        onKeyDownCapture={handleClaimDialogKeyDown}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="building-panel__close"
          aria-label="关闭领取结果"
          onClick={handleCloseClaimResult}
        >
          关闭
        </button>
        <p className="building-panel__claim-kicker">SALVAGE RECEIVED</p>
        <h2
          id={CLAIM_RESULT_TITLE_ID}
          ref={claimResultTitleRef}
          tabIndex={-1}
          className="building-panel__title"
        >
          领取结果
        </h2>
        <p className="building-panel__claim-summary">
          {`已结算 ${result.batchCount} 批 · 入库 ${result.receivedParts.length} 件`}
        </p>
        {result.receivedParts.length > 0 ? (
          <div
            className="building-panel__claim-parts"
            aria-label="本次入库配件"
          >
            {result.receivedParts.map((part) => (
              <SalvageResultPart key={part.id} part={part} />
            ))}
          </div>
        ) : (
          <p className="building-panel__claim-empty">本次配件已全部自动回收</p>
        )}
        <p className="building-panel__claim-recycled">
          {`自动回收 ${result.autoRecycled} 件 · 零件 +${result.sparePartsGained}`}
        </p>
        <button
          type="button"
          className="building-panel__claim-button"
          onClick={handleCloseClaimResult}
        >
          返回生产
        </button>
      </section>
    )
  }

  if (isRecyclingYard && session.recyclingTab === 'production') {
    return (
      <section
        className="building-panel building-panel--production"
        aria-labelledby={TITLE_ID}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {closeButton}
        <h2 id={TITLE_ID} className="building-panel__title">
          {building.name}
        </h2>
        {recyclingTabs}
        <p className="building-panel__level">{`等级 ${level} / ${BUILDING_MAX_LEVEL}`}</p>
        <section
          className="building-panel__salvage-production"
          aria-label="配件生产"
        >
          <div className="building-panel__salvage-stats">
            <p>{`累计时间 ${formatSalvageDuration(salvagePreview.accumulatedMs)}`}</p>
            <p>{`已完成批次 ${salvagePreview.batchCount}`}</p>
            <p>{`仓库 ${carPartInventory.length}/${CAR_PART_INVENTORY_LIMIT}`}</p>
            <p>{`挂机上限 ${formatSalvageDuration(PART_IDLE_CAP_MS)}`}</p>
          </div>
          <div className="building-panel__salvage-progress">
            <p>{`当前批进度 ${formatSalvageDuration(
              salvagePreview.progressInBatchMs,
            )} / ${formatSalvageDuration(salvagePreview.intervalMs)}`}</p>
            <div
              className="building-panel__progress-bar"
              role="progressbar"
              aria-label="当前生产批次进度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.floor(salvageProgressPercent)}
            >
              <span
                className="building-panel__progress-fill"
                style={{ width: `${salvageProgressPercent}%` }}
              />
            </div>
            {!salvagePreview.capped ? (
              <p>{`下一批 ${formatSalvageDuration(
                salvagePreview.nextBatchInMs,
                true,
              )}`}</p>
            ) : null}
          </div>
          <p
            className={
              salvagePreview.capped
                ? 'building-panel__salvage-cap building-panel__salvage-cap--reached'
                : 'building-panel__salvage-cap'
            }
          >
            {salvagePreview.capped
              ? '已达8小时上限，领取后继续累计'
              : '离线累计最多保留 8小时'}
          </p>
          <button
            type="button"
            className="building-panel__claim-button"
            disabled={!salvagePreview.canClaim}
            onClick={handleClaimPartSalvage}
          >
            {salvagePreview.canClaim
              ? `领取 ${salvagePreview.batchCount} 批`
              : '暂无可领取批次'}
          </button>
        </section>
      </section>
    )
  }

  if (selectedBuildingId === 'clubhouse') {
    const directDecision = getMainUpgradeDecision({
      buildingId: selectedBuildingId,
      progress,
      repairShopProgress,
      clubhouseProgress,
      wallet: resources,
      gangLevel,
    })
    const targetLevel = directDecision.targetLevel
    const cost = directDecision.cost ?? EMPTY_WALLET
    const currentPower = getBuildingPower(selectedBuildingId, level)
    const nextPower = targetLevel
      ? getBuildingPower(selectedBuildingId, targetLevel)
      : currentPower
    const blockerText = pendingTask
      ? `主建筑正在升级至 Lv.${pendingTask.targetLevel}`
      : queueFull
        ? '施工队列已满，最多同时升级两座主建筑'
        : mainUpgradeBlockerMessage(directDecision, level)
    const canUpgrade =
      directDecision.reason === 'ready' && !pendingTask && !queueFull
    const costText = formatNonZeroCost(cost)
    const directButtonLabel = targetLevel
      ? pendingTask
        ? `升级中 · 剩余 ${formatRemainingTime(
            pendingTask.completesAt - visibleNow,
          )}`
        : costText === '免费'
          ? `直接升级 Clubhouse 至 Lv.${targetLevel}`
          : `直接升级 Clubhouse 至 Lv.${targetLevel} · ${costText}`
      : null

    const handleDirectClubhouseUpgrade = (): void => {
      upgradeMainBuilding('clubhouse', gangLevel, readNow())
    }

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
        {queueStatus}

        <section
          className="building-panel__economy-summary"
          aria-label="资源概览"
        >
          <p className="building-panel__production">
            {formatProduction(production)}
          </p>
          <ul className="building-panel__wallet">
            <li>
              <ResourceAmount
                kind="money"
                amount={Math.trunc(resources.money)}
              />
            </li>
            <li>
              <ResourceAmount kind="oil" amount={Math.trunc(resources.oil)} />
            </li>
            <li>
              <ResourceAmount
                kind="materials"
                amount={Math.trunc(resources.materials)}
              />
            </li>
          </ul>
        </section>

        <p className="building-panel__confirm-power">
          <ResourceAmount
            kind="power"
            label="当前建筑战力"
            amount={currentPower}
          />
        </p>
        {targetLevel ? (
          <>
            <p className="building-panel__confirm-power">
              <ResourceAmount
                kind="power"
                label="本次战力"
                amount={`+${nextPower - currentPower}`}
              />
            </p>
            <p className="building-panel__confirm-power">
              <ResourceAmount
                kind="power"
                label="升级后战力"
                amount={nextPower}
              />
            </p>
            <ul className="building-panel__confirm-cost" aria-label="升级成本">
              <li>
                <ResourceAmount kind="money" amount={cost.money} />
              </li>
              <li>
                <ResourceAmount kind="oil" amount={cost.oil} />
              </li>
              <li>
                <ResourceAmount kind="materials" amount={cost.materials} />
              </li>
            </ul>
            <p className="building-panel__confirm-power">{`预计用时 ${formatRemainingTime(
              getMainUpgradeDurationMs(targetLevel),
            )}`}</p>
            <button
              type="button"
              className="building-panel__main-button"
              disabled={!canUpgrade}
              onClick={handleDirectClubhouseUpgrade}
            >
              {directButtonLabel}
            </button>
          </>
        ) : null}
        {blockerText ? (
          <p
            className={
              directDecision.reason === 'building-maxed'
                ? 'building-panel__main-status'
                : 'building-panel__main-blocker'
            }
            role={
              directDecision.reason === 'building-maxed' ? undefined : 'alert'
            }
          >
            {blockerText}
          </p>
        ) : null}
      </section>
    )
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
    const blockerText = pendingTask
      ? `主建筑正在升级至 Lv.${pendingTask.targetLevel}`
      : queueFull
        ? '施工队列已满，最多同时升级两座主建筑'
        : confirmDecision
          ? mainUpgradeBlockerMessage(confirmDecision, level)
          : '已达到最高等级 Lv.10'
    const canConfirm =
      confirmDecision?.reason === 'ready' && !pendingTask && !queueFull

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
        {recyclingTabs}
        {queueStatus}
        <ul className="building-panel__confirm-cost" aria-label="升级成本">
          <li>
            <ResourceAmount kind="money" amount={cost.money} />
          </li>
          <li>
            <ResourceAmount kind="oil" amount={cost.oil} />
          </li>
          <li>
            <ResourceAmount kind="materials" amount={cost.materials} />
          </li>
        </ul>
        <p className="building-panel__confirm-power">
          <ResourceAmount
            kind="power"
            label="当前建筑战力"
            amount={currentPower}
          />
        </p>
        <p className="building-panel__confirm-power">
          <ResourceAmount
            kind="power"
            label="本次战力"
            amount={`+${powerDelta}`}
          />
        </p>
        <p className="building-panel__confirm-power">
          <ResourceAmount kind="power" label="升级后战力" amount={nextPower} />
        </p>
        {targetLevel ? (
          <p className="building-panel__confirm-power">{`预计用时 ${formatRemainingTime(
            getMainUpgradeDurationMs(targetLevel),
          )}`}</p>
        ) : null}
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
      {recyclingTabs}
      <p className="building-panel__level">{`等级 ${level} / ${BUILDING_MAX_LEVEL}`}</p>
      {queueStatus}

      <section
        className="building-panel__economy-summary"
        aria-label="资源概览"
      >
        <p className="building-panel__production">
          {formatProduction(production)}
        </p>
        <ul className="building-panel__wallet">
          <li>
            <ResourceAmount kind="money" amount={Math.trunc(resources.money)} />
          </li>
          <li>
            <ResourceAmount kind="oil" amount={Math.trunc(resources.oil)} />
          </li>
          <li>
            <ResourceAmount
              kind="materials"
              amount={Math.trunc(resources.materials)}
            />
          </li>
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
            disabled={Boolean(pendingTask) || queueFull}
            onClick={handleOpenMainConfirm}
          >
            {pendingTask
              ? `升级中 · 剩余 ${formatRemainingTime(
                  pendingTask.completesAt - visibleNow,
                )}`
              : queueFull
                ? '施工队列已满'
                : `升级主建筑至 Lv.${level + 1}`}
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
