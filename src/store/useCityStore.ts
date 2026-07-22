import { create } from 'zustand'
import { upgradeBuildingLevel } from '../game/buildingUpgrade'
import { isBuildingId } from '../game/buildingCatalog'
import {
  BUILDING_IDS,
  type BuildingId,
  type BuildingLevel,
} from '../game/cityTypes'

export type BuildingLevels = Record<BuildingId, BuildingLevel>

interface CityState {
  selectedBuildingId: BuildingId | null
  buildingLevels: BuildingLevels
  selectBuilding: (id: BuildingId) => void
  clearSelection: () => void
  upgradeBuilding: (id: string) => void
  reset: () => void
}

export const createInitialBuildingLevels = (): BuildingLevels =>
  Object.fromEntries(BUILDING_IDS.map((id) => [id, 1])) as BuildingLevels

export const useCityStore = create<CityState>((set) => ({
  selectedBuildingId: null,
  buildingLevels: createInitialBuildingLevels(),
  selectBuilding: (id) => set({ selectedBuildingId: id }),
  clearSelection: () => set({ selectedBuildingId: null }),
  upgradeBuilding: (id) =>
    set((state) => {
      if (!isBuildingId(id)) {
        return state
      }

      return {
        buildingLevels: {
          ...state.buildingLevels,
          [id]: upgradeBuildingLevel(state.buildingLevels[id]),
        },
      }
    }),
  reset: () =>
    set({
      selectedBuildingId: null,
      buildingLevels: createInitialBuildingLevels(),
    }),
}))
