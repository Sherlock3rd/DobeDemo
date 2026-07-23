import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { economyConfig, type ResourceWallet } from '../config/economyConfig'
import {
  getBuildingMaxLevel,
  getChildUpgradeDecision,
  getMainUpgradeDecision,
} from '../game/buildingUpgrade'
import { isBuildingId } from '../game/buildingCatalog'
import {
  BUILDING_IDS,
  type BuildingId,
  type BuildingLevel,
  type ChildBuildingLevel,
} from '../game/cityTypes'
import { isBuildingUnlocked } from '../game/gangProgression'
import { settleResourceProduction, subtractCost } from '../game/resourceEconomy'
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
  ) => void
  upgradeMainBuilding: (id: string, gangLevel: number, now: number) => void
  completeNextFragment: (id: string) => void
  confirmBuildingLevelUp: (id: string) => void
  reset: (now?: number) => void
}

const emptyResources = (): ResourceWallet => ({
  money: 0,
  oil: 0,
  materials: 0,
})

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
      resources: emptyResources(),
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
            ? now
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
          childIndex >= stateChildCount(id) ||
          !Number.isFinite(now)
        ) {
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
          const current = state.buildingProgress[id]
          const decision = getChildUpgradeDecision({
            buildingId: id,
            childIndex,
            progress: current,
            wallet: settlement.wallet,
            gangLevel,
          })
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
      },
      upgradeMainBuilding: (id, gangLevel, now) => {
        if (!isBuildingId(id) || !Number.isFinite(now)) {
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
          const current = state.buildingProgress[id]
          const decision = getMainUpgradeDecision({
            buildingId: id,
            progress: current,
            clubhouseProgress: state.buildingProgress.clubhouse,
            wallet: settlement.wallet,
            gangLevel,
          })
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
      },
      completeNextFragment: (id) =>
        set((state) => {
          if (!isBuildingId(id)) {
            return state
          }

          const current = state.buildingProgress[id]
          const childIndex = current.childLevels.findIndex(
            (level) => level < current.level,
          )
          if (childIndex < 0) {
            return state
          }
          const childLevels = [...current.childLevels]
          childLevels[childIndex] = (childLevels[childIndex] +
            1) as ChildBuildingLevel

          return {
            buildingProgress: {
              ...state.buildingProgress,
              [id]: { ...current, childLevels },
            },
          }
        }),
      confirmBuildingLevelUp: (id) =>
        set((state) => {
          if (!isBuildingId(id)) {
            return state
          }

          const current = state.buildingProgress[id]
          if (
            current.level >= getBuildingMaxLevel(id) ||
            current.childLevels.some((level) => level !== current.level)
          ) {
            return state
          }

          return {
            buildingProgress: {
              ...state.buildingProgress,
              [id]: {
                ...current,
                level: (current.level + 1) as BuildingLevel,
              },
            },
          }
        }),
      reset: (now = Date.now()) =>
        set({
          selectedBuildingId: null,
          buildingProgress: createInitialBuildingProgress(),
          resources: emptyResources(),
          lastResourceUpdatedAt: Number.isFinite(now) ? now : Date.now(),
          activeProducerIds: ['repair-shop'],
        }),
    }),
    {
      name: CITY_STORAGE_KEY,
      version: 2,
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
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizeCityDurableState(persistedState, Date.now()),
      }),
    },
  ),
)

function stateChildCount(id: BuildingId): number {
  return id === 'repair-shop' ? 5 : 10
}
