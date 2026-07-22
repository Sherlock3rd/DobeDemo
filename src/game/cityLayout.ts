import type { BuildingId } from './cityTypes'

export interface CityPlacement {
  position: readonly [number, number, number]
  size: readonly [number, number]
  rotation?: number
}

export interface InteractiveBuildingPlacement {
  id: BuildingId
  position: readonly [number, number, number]
  rotation?: number
}

export const BUILDING_RENDER_SCALE = 0.4
export const BUILDING_HITBOX_HEIGHT = 5

export const CITY_BOUNDS = {
  minX: -18,
  maxX: 18,
  minZ: -14,
  maxZ: 14,
} as const

export const CAMERA_CONFIG = {
  position: [24, 28, 30] as const,
  target: [0, 0, 0] as const,
  initialZoom: 22,
  minZoom: 16,
  maxZoom: 34,
  panBounds: { minX: -8, maxX: 8, minZ: -6, maxZ: 6 },
} as const

export const interactiveBuildingPlacements = [
  { id: 'recycling-yard', position: [-11, 0, -8], rotation: 0 },
  { id: 'metalworking-plant', position: [-2, 0, -9], rotation: 0 },
  { id: 'clubhouse', position: [7, 0, -7], rotation: 0 },
  { id: 'repair-shop', position: [-11, 0, 0], rotation: 0 },
  { id: 'gas-station', position: [-5, 0, 8], rotation: 0 },
  { id: 'commercial-street', position: [8, 0, 4], rotation: 0 },
] as const satisfies readonly InteractiveBuildingPlacement[]

export const roadPlacements = [
  { position: [0, 0, 0], size: [36, 2] },
  { position: [0, 0, 0], size: [2, 28] },
  { position: [-9, 0, -4], size: [2, 8] },
  { position: [8, 0, 8], size: [14, 2] },
] as const satisfies readonly CityPlacement[]

export const lotPlacements = [
  { position: [-11, 0, -8], size: [7.3, 5.7] },
  { position: [-2, 0, -9], size: [9.7, 6.5] },
  { position: [7, 0, -7], size: [7, 6] },
  { position: [-11, 0, 0], size: [7, 5] },
  { position: [-5, 0, 8], size: [6, 6] },
  { position: [8, 0, 4], size: [11.3, 8.1] },
] as const satisfies readonly CityPlacement[]

export const riverPlacements = [
  { position: [13, -0.1, -12], size: [5, 4], rotation: -0.12 },
  { position: [15, -0.1, -8], size: [4, 5], rotation: -0.35 },
  { position: [16, -0.1, -4], size: [3, 5], rotation: -0.18 },
] as const satisfies readonly CityPlacement[]

export const environmentBuildingPlacements = [
  { position: [-9, 0, -12.5], size: [3, 3] },
  { position: [7, 0, -12.5], size: [3, 2] },
  { position: [7, 0, 12], size: [3, 3] },
  { position: [-15, 0, 5], size: [3, 4] },
  { position: [-16.5, 0, 12.5], size: [2.5, 2.5] },
  { position: [16, 0, 5], size: [3, 4] },
  { position: [-4, 0, 12], size: [4, 3] },
  { position: [11, 0, 12], size: [4, 4] },
] as const satisfies readonly CityPlacement[]

export const vehiclePlacements = [
  { position: [-14, 0, -1], size: [1.4, 0.7], rotation: 0 },
  { position: [-6, 0, 1], size: [1.4, 0.7], rotation: Math.PI },
  { position: [5, 0, -1], size: [1.4, 0.7], rotation: 0 },
  { position: [12, 0, 1], size: [1.4, 0.7], rotation: Math.PI },
  { position: [-1, 0, -6], size: [1.4, 0.7], rotation: Math.PI / 2 },
  { position: [1, 0, 5], size: [1.4, 0.7], rotation: -Math.PI / 2 },
  { position: [5, 0, 7], size: [1.4, 0.7], rotation: 0 },
  { position: [12, 0, 9], size: [1.4, 0.7], rotation: Math.PI },
] as const satisfies readonly CityPlacement[]

export const treePlacements = [
  { position: [-16, 0, -6], size: [1.2, 1.2] },
  { position: [-15, 0, 10], size: [1.2, 1.2] },
  { position: [-10, 0, 11], size: [1.2, 1.2] },
  { position: [-4, 0, -13], size: [1.2, 1.2] },
  { position: [4, 0, -12], size: [1.2, 1.2] },
  { position: [10, 0, -11], size: [1.2, 1.2] },
  { position: [4, 0, 1], size: [1.2, 1.2] },
  { position: [15, 0, 1], size: [1.2, 1.2] },
  { position: [4, 0, 12], size: [1.2, 1.2] },
  { position: [16, 0, 12], size: [1.2, 1.2] },
] as const satisfies readonly CityPlacement[]
