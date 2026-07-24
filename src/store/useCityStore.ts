import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { economyConfig, type ResourceWallet } from '../config/economyConfig'
import {
  getBuildingChildCount,
  getChildUpgradeDecision,
  getMainUpgradeDecision,
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
  reason: ChildUpgradeBlockReason | MainUpgradeBlockReason | 'invalid-request'
}

interface CityState extends CityDurableState {
  selectedBuildingId: BuildingId | null
  selectBuilding: (id: BuildingId) => void
  clearSelection: () => void
  syncResourceProduction: (now: number, gangLevel: number) => void
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
  grantDebugResources: (now: number) => void
  reset: (now?: number) => void
}

const initialResources = (): ResourceWallet => ({ ...INITIAL_RESOURCES })

function getUnlockedProducerIds(gangLevel: number): BuildingId[] {
  return BUILDING_IDS.filter(
    (id) =>
      economyConfig.production[id] !== undefined &&
      isBuildingUnlocked(id, gangLevel),
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
    (set) => ({
      selectedBuildingId: null,
      buildingProgress: createInitialBuildingProgress(),
      resources: initialResources(),
      lastResourceUpdatedAt: Date.now(),
      activeProducerIds: ['repair-shop'],
      selectBuilding: (id) => set({ selectedBuildingId: id }),
      clearSelection: () => set({ selectedBuildingId: null }),
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
          const activeProducerIds = getUnlockedProducerIds(gangLevel)
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
      upgradeChildBuilding: (id, childIndex, gangLevel, now) => {
        if (
          !isBuildingId(id) ||
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
          const settlement = settleResourceProduction({
            wallet: state.resources,
            buildingProgress: state.buildingProgress,
            activeProducerIds: state.activeProducerIds,
            lastUpdatedAt: state.lastResourceUpdatedAt,
            now,
          })
          const current = state.buildingProgress[id]
          const decision = getMainUpgradeDecision({
            buildingId: id,
            progress: current,
            repairShopProgress: state.buildingProgress['repair-shop'],
            clubhouseProgress: state.buildingProgress.clubhouse,
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
          return {
            resources: subtractCost(settlement.wallet, decision.cost),
            lastResourceUpdatedAt: settlement.nextUpdatedAt,
            buildingProgress: {
              ...state.buildingProgress,
              [id]: {
                ...current,
                level: decision.targetLevel as BuildingLevel,
              },
            },
          }
        })
        return result
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
          activeProducerIds: ['repair-shop'],
        }),
    }),
    {
      name: CITY_STORAGE_KEY,
      version: 3,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted, version) =>
        migrateCityState(persisted, version, Date.now()),
      partialize: ({
        buildingProgress,
        resources,
        lastResourceUpdatedAt,
        activeProducerIds,
      }) => ({
        buildingProgress,
        resources,
        lastResourceUpdatedAt,
        activeProducerIds,
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
