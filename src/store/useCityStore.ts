import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { economyConfig, type ResourceWallet } from '../config/economyConfig'
import {
  getBuildingChildCount,
  getChildUpgradeDecision,
  getMainUpgradeDurationMs,
  getMainUpgradeDecision,
  isDirectUpgradeBuilding,
  MAIN_UPGRADE_QUEUE_LIMIT,
  settleDueMainUpgrades,
  type ChildUpgradeBlockReason,
  type MainUpgradeBlockReason,
} from '../game/buildingUpgrade'
import { isBuildingId } from '../game/buildingCatalog'
import {
  BUILDING_IDS,
  type BuildingId,
  type BuildingLevel,
  type ChildBuildingLevel,
} from '../game/cityTypes'
import { isBuildingUnlocked } from '../game/gangProgression'
import {
  addWalletSaturated,
  settleResourceProduction,
  subtractCost,
} from '../game/resourceEconomy'
import { createSafeStorage } from './safeStorage'
import {
  CITY_STORAGE_KEY,
  type BuildingProgressById,
  type CityDurableState,
  createInitialBuildingProgress,
  migrateCityState,
  normalizeCityDurableState,
} from './cityProgressMigration'

export { CITY_STORAGE_KEY }
export type { BuildingProgressById, CityDurableState }

export const INITIAL_RESOURCES: Readonly<ResourceWallet> = {
  money: 10_000,
  oil: 0,
  materials: 0,
}

export interface UpgradeActionResult {
  applied: boolean
  reason:
    | ChildUpgradeBlockReason
    | MainUpgradeBlockReason
    | 'invalid-request'
    | 'upgrade-already-pending'
    | 'upgrade-queue-full'
}

interface CityState extends CityDurableState {
  selectedBuildingId: BuildingId | null
  selectBuilding: (id: BuildingId) => void
  clearSelection: () => void
  claimBuilding: (id: string, gangLevel: number, now: number) => boolean
  syncResourceProduction: (now: number, gangLevel: number) => void
  syncMainUpgrades: (now: number) => void
  upgradeChildBuilding: (
    id: string,
    childIndex: number,
    gangLevel: number,
    now: number,
  ) => UpgradeActionResult
  upgradeMainBuilding: (
    id: string,
    gangLevel: number,
    now: number,
  ) => UpgradeActionResult
  grantRewardMoney: (rewardId: string, amount: number) => boolean
  grantRewardResources: (rewardId: string, reward: ResourceWallet) => boolean
  grantDebugResources: (now: number) => void
  reset: (now?: number) => void
}

const initialResources = (): ResourceWallet => ({ ...INITIAL_RESOURCES })

function getUnlockedProducerIds(
  gangLevel: number,
  claimedBuildingIds: readonly BuildingId[],
): BuildingId[] {
  return BUILDING_IDS.filter(
    (id) =>
      economyConfig.production[id] !== undefined &&
      isBuildingUnlocked(id, gangLevel) &&
      claimedBuildingIds.includes(id),
  )
}

function sameIds(left: readonly BuildingId[], right: readonly BuildingId[]) {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  )
}

export const useCityStore = create<CityState>()(
  persist(
    (set, get) => ({
      selectedBuildingId: null,
      buildingProgress: createInitialBuildingProgress(),
      resources: initialResources(),
      lastResourceUpdatedAt: Date.now(),
      activeProducerIds: [],
      claimedBuildingIds: [],
      pendingMainUpgrades: [],
      appliedStageRewardIds: [],
      selectBuilding: (id) => set({ selectedBuildingId: id }),
      clearSelection: () => set({ selectedBuildingId: null }),
      claimBuilding: (id, gangLevel, now) => {
        if (
          !isBuildingId(id) ||
          !Number.isFinite(now) ||
          !isBuildingUnlocked(id, gangLevel)
        ) {
          return false
        }
        let applied = false
        set((state) => {
          if (state.claimedBuildingIds.includes(id)) return state
          const settlement = settleResourceProduction({
            wallet: state.resources,
            buildingProgress: state.buildingProgress,
            activeProducerIds: state.activeProducerIds,
            lastUpdatedAt: state.lastResourceUpdatedAt,
            now,
          })
          const claimedBuildingIds = [...state.claimedBuildingIds, id]
          applied = true
          return {
            resources: settlement.wallet,
            lastResourceUpdatedAt: Math.max(now, settlement.nextUpdatedAt),
            claimedBuildingIds,
            activeProducerIds: getUnlockedProducerIds(
              gangLevel,
              claimedBuildingIds,
            ),
          }
        })
        return applied
      },
      syncResourceProduction: (now, gangLevel) => {
        if (!Number.isFinite(now)) {
          return
        }
        set((state) => {
          const settlement = settleResourceProduction({
            wallet: state.resources,
            buildingProgress: state.buildingProgress,
            activeProducerIds: state.activeProducerIds,
            lastUpdatedAt: state.lastResourceUpdatedAt,
            now,
          })
          const activeProducerIds = getUnlockedProducerIds(
            gangLevel,
            state.claimedBuildingIds,
          )
          const producersChanged = !sameIds(
            state.activeProducerIds,
            activeProducerIds,
          )
          const lastResourceUpdatedAt = producersChanged
            ? Math.max(now, settlement.nextUpdatedAt)
            : settlement.nextUpdatedAt
          if (
            settlement.wallet === state.resources &&
            lastResourceUpdatedAt === state.lastResourceUpdatedAt &&
            !producersChanged
          ) {
            return state
          }
          return {
            resources: settlement.wallet,
            lastResourceUpdatedAt,
            activeProducerIds,
          }
        })
      },
      syncMainUpgrades: (now) => {
        if (!Number.isFinite(now)) return
        set((state) => {
          const settlement = settleDueMainUpgrades(
            state.buildingProgress,
            state.pendingMainUpgrades,
            now,
          )
          if (settlement.completed.length === 0) return state
          return {
            buildingProgress: settlement.buildingProgress,
            pendingMainUpgrades: settlement.pendingMainUpgrades,
          }
        })
      },
      upgradeChildBuilding: (id, childIndex, gangLevel, now) => {
        if (!isBuildingId(id)) {
          return { applied: false, reason: 'invalid-request' }
        }
        if (isDirectUpgradeBuilding(id)) {
          return { applied: false, reason: 'direct-main-upgrade-only' }
        }
        if (
          !Number.isInteger(childIndex) ||
          childIndex < 0 ||
          childIndex >= getBuildingChildCount(id) ||
          !Number.isFinite(now)
        ) {
          return { applied: false, reason: 'invalid-request' }
        }
        let result: UpgradeActionResult = {
          applied: false,
          reason: 'invalid-request',
        }
        set((state) => {
          const settlement = settleResourceProduction({
            wallet: state.resources,
            buildingProgress: state.buildingProgress,
            activeProducerIds: state.activeProducerIds,
            lastUpdatedAt: state.lastResourceUpdatedAt,
            now,
          })
          const current = state.buildingProgress[id]
          const decision = getChildUpgradeDecision({
            buildingId: id,
            childIndex,
            progress: current,
            wallet: settlement.wallet,
            gangLevel,
          })
          result = {
            applied: decision.reason === 'ready',
            reason: decision.reason,
          }
          if (decision.reason !== 'ready' || !decision.cost) {
            if (
              settlement.wallet === state.resources &&
              settlement.nextUpdatedAt === state.lastResourceUpdatedAt
            ) {
              return state
            }
            return {
              resources: settlement.wallet,
              lastResourceUpdatedAt: settlement.nextUpdatedAt,
            }
          }
          const childLevels = [...current.childLevels]
          childLevels[childIndex] = decision.targetLevel as ChildBuildingLevel
          return {
            resources: subtractCost(settlement.wallet, decision.cost),
            lastResourceUpdatedAt: settlement.nextUpdatedAt,
            buildingProgress: {
              ...state.buildingProgress,
              [id]: { ...current, childLevels },
            },
          }
        })
        return result
      },
      upgradeMainBuilding: (id, gangLevel, now) => {
        if (!isBuildingId(id) || !Number.isFinite(now)) {
          return { applied: false, reason: 'invalid-request' }
        }
        let result: UpgradeActionResult = {
          applied: false,
          reason: 'invalid-request',
        }
        set((state) => {
          const upgradeSettlement = settleDueMainUpgrades(
            state.buildingProgress,
            state.pendingMainUpgrades,
            now,
          )
          const settlement = settleResourceProduction({
            wallet: state.resources,
            buildingProgress: upgradeSettlement.buildingProgress,
            activeProducerIds: state.activeProducerIds,
            lastUpdatedAt: state.lastResourceUpdatedAt,
            now,
          })
          const current = upgradeSettlement.buildingProgress[id]
          if (
            upgradeSettlement.pendingMainUpgrades.some(
              (task) => task.buildingId === id,
            )
          ) {
            result = { applied: false, reason: 'upgrade-already-pending' }
            return {
              resources: settlement.wallet,
              lastResourceUpdatedAt: settlement.nextUpdatedAt,
              buildingProgress: upgradeSettlement.buildingProgress,
              pendingMainUpgrades: upgradeSettlement.pendingMainUpgrades,
            }
          }
          if (
            upgradeSettlement.pendingMainUpgrades.length >=
            MAIN_UPGRADE_QUEUE_LIMIT
          ) {
            result = { applied: false, reason: 'upgrade-queue-full' }
            return {
              resources: settlement.wallet,
              lastResourceUpdatedAt: settlement.nextUpdatedAt,
              buildingProgress: upgradeSettlement.buildingProgress,
              pendingMainUpgrades: upgradeSettlement.pendingMainUpgrades,
            }
          }
          const decision = getMainUpgradeDecision({
            buildingId: id,
            progress: current,
            repairShopProgress:
              upgradeSettlement.buildingProgress['repair-shop'],
            clubhouseProgress: upgradeSettlement.buildingProgress.clubhouse,
            wallet: settlement.wallet,
            gangLevel,
          })
          result = {
            applied: decision.reason === 'ready',
            reason: decision.reason,
          }
          if (decision.reason !== 'ready' || !decision.cost) {
            if (
              settlement.wallet === state.resources &&
              settlement.nextUpdatedAt === state.lastResourceUpdatedAt
            ) {
              return state
            }
            return {
              resources: settlement.wallet,
              lastResourceUpdatedAt: settlement.nextUpdatedAt,
              buildingProgress: upgradeSettlement.buildingProgress,
              pendingMainUpgrades: upgradeSettlement.pendingMainUpgrades,
            }
          }
          return {
            resources: subtractCost(settlement.wallet, decision.cost),
            lastResourceUpdatedAt: settlement.nextUpdatedAt,
            buildingProgress: upgradeSettlement.buildingProgress,
            pendingMainUpgrades: [
              ...upgradeSettlement.pendingMainUpgrades,
              {
                buildingId: id,
                targetLevel: decision.targetLevel as BuildingLevel,
                completesAt:
                  now +
                  getMainUpgradeDurationMs(
                    decision.targetLevel as BuildingLevel,
                  ),
              },
            ],
          }
        })
        return result
      },
      grantRewardMoney: (rewardId, amount) =>
        get().grantRewardResources(rewardId, {
          money: amount,
          oil: 0,
          materials: 0,
        }),
      grantRewardResources: (rewardId, reward) => {
        if (
          typeof rewardId !== 'string' ||
          rewardId.trim() === '' ||
          !Number.isSafeInteger(reward.money) ||
          reward.money < 0 ||
          !Number.isSafeInteger(reward.oil) ||
          reward.oil < 0 ||
          !Number.isSafeInteger(reward.materials) ||
          reward.materials < 0 ||
          reward.money + reward.oil + reward.materials <= 0
        ) {
          return false
        }
        let applied = false
        set((state) => {
          if (state.appliedStageRewardIds.includes(rewardId)) return state
          applied = true
          return {
            resources: addWalletSaturated(state.resources, reward),
            appliedStageRewardIds: [
              ...state.appliedStageRewardIds,
              rewardId,
            ].slice(-30),
          }
        })
        return applied
      },
      grantDebugResources: (now) => {
        if (!Number.isFinite(now)) {
          return
        }
        set((state) => {
          const settlement = settleResourceProduction({
            wallet: state.resources,
            buildingProgress: state.buildingProgress,
            activeProducerIds: state.activeProducerIds,
            lastUpdatedAt: state.lastResourceUpdatedAt,
            now,
          })
          return {
            resources: addWalletSaturated(settlement.wallet, {
              money: 10_000,
              oil: 10_000,
              materials: 10_000,
            }),
            lastResourceUpdatedAt: settlement.nextUpdatedAt,
          }
        })
      },
      reset: (now = Date.now()) =>
        set({
          selectedBuildingId: null,
          buildingProgress: createInitialBuildingProgress(),
          resources: initialResources(),
          lastResourceUpdatedAt: Number.isFinite(now) ? now : Date.now(),
          activeProducerIds: [],
          claimedBuildingIds: [],
          pendingMainUpgrades: [],
          appliedStageRewardIds: [],
        }),
    }),
    {
      name: CITY_STORAGE_KEY,
      version: 7,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted, version) =>
        migrateCityState(persisted, version, Date.now()),
      partialize: ({
        buildingProgress,
        resources,
        lastResourceUpdatedAt,
        activeProducerIds,
        claimedBuildingIds,
        pendingMainUpgrades,
        appliedStageRewardIds,
      }) => ({
        buildingProgress,
        resources,
        lastResourceUpdatedAt,
        activeProducerIds,
        claimedBuildingIds,
        pendingMainUpgrades,
        appliedStageRewardIds,
      }),
      // Zustand calls merge even when nothing is stored, passing `undefined`.
      // Normalizing that would zero the canonical 10000-money initial state for
      // a brand-new visitor, so only normalize an actual persisted payload.
      merge: (persistedState, currentState) =>
        persistedState == null
          ? currentState
          : {
              ...currentState,
              ...normalizeCityDurableState(persistedState, Date.now()),
            },
    },
  ),
)
