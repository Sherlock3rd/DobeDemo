import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  completeNextBuildingFragment,
  confirmBuildingLevelUp as confirmBuildingProgressLevelUp,
} from '../game/buildingUpgrade'
import { isBuildingId } from '../game/buildingCatalog'
import type { BuildingId } from '../game/cityTypes'
import { createSafeStorage } from './safeStorage'
import {
  CITY_STORAGE_KEY,
  type BuildingProgressById,
  createInitialBuildingProgress,
  normalizeBuildingProgressById,
} from './cityProgressMigration'

export { CITY_STORAGE_KEY }
export type { BuildingProgressById }

interface CityState {
  selectedBuildingId: BuildingId | null
  buildingProgress: BuildingProgressById
  selectBuilding: (id: BuildingId) => void
  clearSelection: () => void
  completeNextFragment: (id: string) => void
  confirmBuildingLevelUp: (id: string) => void
  reset: () => void
}

export const useCityStore = create<CityState>()(
  persist(
    (set) => ({
      selectedBuildingId: null,
      buildingProgress: createInitialBuildingProgress(),
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

          return {
            buildingProgress: { ...state.buildingProgress, [id]: next },
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

          return {
            buildingProgress: { ...state.buildingProgress, [id]: next },
          }
        }),
      reset: () =>
        set({
          selectedBuildingId: null,
          buildingProgress: createInitialBuildingProgress(),
        }),
    }),
    {
      name: CITY_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => createSafeStorage()),
      // Only building progress is durable. Selection is transient UI state.
      partialize: (state) => ({ buildingProgress: state.buildingProgress }),
      // Normalize/migrate untrusted persisted data into the single source of
      // truth so a corrupt or legacy save can never desync the store.
      merge: (persistedState, currentState) => ({
        ...currentState,
        buildingProgress: normalizeBuildingProgressById(
          (persistedState as { buildingProgress?: unknown } | undefined)
            ?.buildingProgress,
        ),
      }),
    },
  ),
)
