import type { JSX } from 'react'
import {
  economyConfig,
  type ResourceCost,
  type ResourceWallet,
} from '../config/economyConfig'
import { buildingCatalogById } from '../game/buildingCatalog'
import {
  getBuildingMaxLevel,
  getCaughtUpChildCount,
  getChildUpgradeDecision,
  getMainUpgradeDecision,
  type UpgradeDecision,
} from '../game/buildingUpgrade'
import type { BuildingLevel } from '../game/cityTypes'
import {
  getBuildingUnlock,
  getGangLevel,
  getGangRole,
  isBuildingUnlocked,
} from '../game/gangProgression'
import { getBuildingProductionPerTick } from '../game/resourceEconomy'
import { getBuildingFragments } from '../scene/city/buildingFragmentCatalog'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'

const TITLE_ID = 'building-panel-title'

const CLUBHOUSE_REQUIRED_GANG_LEVEL =
  getBuildingUnlock('clubhouse')?.requiredLevel ?? 40

// Read the wall clock outside component scope: the upgrade actions settle
// production up to "now", and doing this in a plain module helper keeps the
// call out of the render path.
function readNow(): number {
  return Date.now()
}

// Fixed order 钱 → 油 → 物资; zero entries are hidden and an all-zero cost is
// free.
function formatCost(cost: ResourceCost): string {
  const parts: string[] = []
  if (cost.money > 0) {
    parts.push(`钱 ${cost.money}`)
  }
  if (cost.oil > 0) {
    parts.push(`油 ${cost.oil}`)
  }
  if (cost.materials > 0) {
    parts.push(`物资 ${cost.materials}`)
  }
  return parts.length === 0 ? '免费' : parts.join(' · ')
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

// Strict priority mirrors the pure decision function: maxed → children not
// caught up → clubhouse locked → clubhouse too low → insufficient resources.
function mainBlockerMessage(
  decision: UpgradeDecision,
  mainLevel: number,
  targetLevel: number,
  notCaughtUp: number,
): string {
  switch (decision.reason) {
    case 'children-not-caught-up':
      return `还有 ${notCaughtUp} 个子建筑未达到 Lv.${mainLevel}`
    case 'clubhouse-locked':
      return `需要先将帮派树提升至 Lv.${CLUBHOUSE_REQUIRED_GANG_LEVEL} 解锁 Clubhouse`
    case 'clubhouse-too-low':
      return `需要先将 Clubhouse 提升至 Lv.${targetLevel}`
    case 'insufficient-resources':
      return `资源不足，还需 ${formatCost(decision.missingResources)}`
    default:
      return ''
  }
}

export function BuildingPanel(): JSX.Element | null {
  const selectedBuildingId = useCityStore((state) => state.selectedBuildingId)
  const progress = useCityStore((state) =>
    selectedBuildingId ? state.buildingProgress[selectedBuildingId] : null,
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
  const isMaxed = level >= maxLevel
  const targetLevel = level + 1
  const fragments = getBuildingFragments(building.kind)
  const production = getBuildingProductionPerTick(
    selectedBuildingId,
    progress.childLevels,
  )

  const mainDecision = getMainUpgradeDecision({
    buildingId: selectedBuildingId,
    progress,
    clubhouseProgress,
    wallet: resources,
    gangLevel,
  })
  const mainCost = isMaxed
    ? undefined
    : economyConfig.buildingUpgradeCostByTargetLevel[
        targetLevel as BuildingLevel
      ]
  const notCaughtUp =
    progress.childLevels.length - getCaughtUpChildCount(progress)

  const handleMainUpgrade = (): void => {
    upgradeMainBuilding(selectedBuildingId, gangLevel, readNow())
  }

  const handleChildUpgrade = (childIndex: number): void => {
    upgradeChildBuilding(selectedBuildingId, childIndex, gangLevel, readNow())
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
      <p className="building-panel__level">{`等级 ${level} / ${maxLevel}`}</p>

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

      <section className="building-panel__main-upgrade" aria-label="主建筑升级">
        {isMaxed ? (
          <p className="building-panel__main-status">
            {`已达到最高等级 Lv.${maxLevel}`}
          </p>
        ) : (
          <>
            <p className="building-panel__main-goal">{`目标 Lv.${targetLevel}`}</p>
            {mainCost ? (
              <p className="building-panel__main-cost">
                {`成本 ${formatCost(mainCost)}`}
              </p>
            ) : null}
            {mainDecision.reason === 'ready' ? (
              <button
                type="button"
                className="building-panel__main-button"
                aria-label={`升级主建筑至 Lv.${targetLevel}`}
                onClick={handleMainUpgrade}
              >
                {`升级主建筑至 Lv.${targetLevel}`}
              </button>
            ) : (
              <p className="building-panel__main-blocker">
                {mainBlockerMessage(
                  mainDecision,
                  level,
                  targetLevel,
                  notCaughtUp,
                )}
              </p>
            )}
          </>
        )}
      </section>

      <ul className="building-panel__child-grid">
        {fragments.map((fragment, index) => {
          const childLevel = progress.childLevels[index] ?? 0
          const decision = getChildUpgradeDecision({
            buildingId: selectedBuildingId,
            childIndex: index,
            progress,
            wallet: resources,
            gangLevel,
          })
          const caughtUp = decision.reason === 'child-at-main-level'
          const ratio = `Lv.${childLevel} / ${level}`
          const statusText = childLevel === 0 ? `未建设 · ${ratio}` : ratio

          return (
            <li key={fragment.id} className="building-panel__child-card">
              <h3 className="building-panel__child-name">{fragment.name}</h3>
              <p className="building-panel__child-desc">
                {fragment.description}
              </p>
              <p className="building-panel__child-status">{statusText}</p>
              {caughtUp || decision.cost === null ? (
                <button
                  type="button"
                  className="building-panel__child-upgrade"
                  aria-label="已追平主建筑"
                  disabled
                >
                  已追平主建筑
                </button>
              ) : (
                <>
                  <p className="building-panel__child-cost">
                    {formatCost(decision.cost)}
                  </p>
                  <button
                    type="button"
                    className="building-panel__child-upgrade"
                    aria-label={`升级 ${fragment.name} 至 Lv.${decision.targetLevel}`}
                    onClick={() => handleChildUpgrade(index)}
                  >
                    {`升级至 Lv.${decision.targetLevel}`}
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
