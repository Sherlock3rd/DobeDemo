import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  completeNextBuildingFragment,
  confirmBuildingLevelUp as confirmBuildingProgressLevelUp,
  upgradeBuildingLevel,
} from '../game/buildingUpgrade'
import { isBuildingId } from '../game/buildingCatalog'
import {
  BUILDING_IDS,
  type BuildingId,
  type BuildingLevel,
} from '../game/cityTypes'
import { createSafeStorage } from './safeStorage'
import {
  CITY_STORAGE_KEY,
  type BuildingProgressById,
  createInitialBuildingProgress,
  normalizeBuildingProgressById,
} from './cityProgressMigration'

export { CITY_STORAGE_KEY }
export type { BuildingProgressById }

/**
 * Legacy compat type: a flat id -> level map. The fragment progression store
 * keeps a `buildingLevels` view derived from `buildingProgress` so pre-Task-5
 * consumers (BuildingPanel, InteractiveBuilding) and their tests keep working
 * until they migrate to `buildingProgress`.
 */
export type BuildingLevels = Record<BuildingId, BuildingLevel>

interface CityState {
  selectedBuildingId: BuildingId | null
  buildingProgress: BuildingProgressById
  /**
   * Derived compatibility view of {@link buildingProgress}. NOT a second source
   * of truth: it is recomputed from `buildingProgress` on every mutation and on
   * rehydrate/merge. Remove once Task 4/5 consumers read `buildingProgress`.
   */
  buildingLevels: BuildingLevels
  selectBuilding: (id: BuildingId) => void
  clearSelection: () => void
  completeNextFragment: (id: string) => void
  confirmBuildingLevelUp: (id: string) => void
  /**
   * Legacy compat action for the pre-fragment BuildingPanel. Only bumps the
   * whole level (capped at the old Lv.3 ceiling) when the target building has
   * NO fragment progress in flight (completedFragments === 0). If a fragment
   * upgrade is partway or already ready to confirm, it is a strict no-op that
   * returns the same state so it can never discard/overwrite fragment progress.
   * Remove once Task 5 rewrites the panel around fragment completion.
   */
  upgradeBuilding: (id: string) => void
  reset: () => void
}

const deriveBuildingLevels = (progress: BuildingProgressById): BuildingLevels =>
  Object.fromEntries(
    BUILDING_IDS.map((id) => [id, progress[id].level]),
  ) as BuildingLevels

const createDefaults = (): Pick<
  CityState,
  'buildingProgress' | 'buildingLevels'
> => {
  const buildingProgress = createInitialBuildingProgress()
  return {
    buildingProgress,
    buildingLevels: deriveBuildingLevels(buildingProgress),
  }
}

export const useCityStore = create<CityState>()(
  persist(
    (set) => ({
      selectedBuildingId: null,
      ...createDefaults(),
      selectBuilding: (id) => set({ selectedBuildingId: id }),
      clearSelection: () => set({ selectedBuildingId: null }),
      completeNextFragment: (id) =>
        set((state) => {
          if (!isBuildingId(id)) {
            return state
          }

          const current = state.buildingProgress[id]
          const next = completeNextBuildingFragment(current)
          if (next === current) {
            return state
          }

          const buildingProgress = { ...state.buildingProgress, [id]: next }
          return {
            buildingProgress,
            buildingLevels: deriveBuildingLevels(buildingProgress),
          }
        }),
      confirmBuildingLevelUp: (id) =>
        set((state) => {
          if (!isBuildingId(id)) {
            return state
          }

          const current = state.buildingProgress[id]
          const next = confirmBuildingProgressLevelUp(current)
          if (next === current) {
            return state
          }

          const buildingProgress = { ...state.buildingProgress, [id]: next }
          return {
            buildingProgress,
            buildingLevels: deriveBuildingLevels(buildingProgress),
          }
        }),
      upgradeBuilding: (id) =>
        set((state) => {
          if (!isBuildingId(id)) {
            return state
          }

          const current = state.buildingProgress[id]
          // Never clobber fragment progress: the legacy whole-level bump is only
          // safe when no fragment is in flight. Mid-upgrade or ready-to-confirm
          // buildings are left untouched (strict no-op). Task 5 removes this
          // temporary entry point along with the old BuildingPanel.
          if (current.completedFragments > 0) {
            return state
          }

          const nextLevel = upgradeBuildingLevel(current.level)
          if (nextLevel === current.level) {
            return state
          }

          const buildingProgress = {
            ...state.buildingProgress,
            [id]: { level: nextLevel, completedFragments: 0 },
          }
          return {
            buildingProgress,
            buildingLevels: deriveBuildingLevels(buildingProgress),
          }
        }),
      reset: () =>
        set({
          selectedBuildingId: null,
          ...createDefaults(),
        }),
    }),
    {
      name: CITY_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => createSafeStorage()),
      // Only building progress is durable. Selection and the derived
      // buildingLevels view are intentionally excluded.
      partialize: (state) => ({ buildingProgress: state.buildingProgress }),
      // Normalize/migrate untrusted persisted data and keep the derived compat
      // view in sync so there is never a dual source of truth after rehydrate.
      merge: (persistedState, currentState) => {
        const buildingProgress = normalizeBuildingProgressById(
          (persistedState as { buildingProgress?: unknown } | undefined)
            ?.buildingProgress,
        )
        return {
          ...currentState,
          buildingProgress,
          buildingLevels: deriveBuildingLevels(buildingProgress),
        }
      },
    },
  ),
)
