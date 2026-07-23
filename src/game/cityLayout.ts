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

export const LOT_ROAD_CLEARANCE = 0.35
export const LOT_CLEARANCE = 0.25
export const BUILDING_STATIC_CLEARANCE = 0.2

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
  { id: 'recycling-yard', position: [-6, 0, -4], rotation: 0 },
  { id: 'metalworking-plant', position: [-6, 0, -10.5], rotation: 0 },
  { id: 'clubhouse', position: [7, 0, -7], rotation: 0 },
  { id: 'repair-shop', position: [-8, 0, 4], rotation: 0 },
  { id: 'gas-station', position: [-12, 0, 10.5], rotation: 0 },
  { id: 'commercial-street', position: [6.8, 0, 6], rotation: 0 },
] as const satisfies readonly InteractiveBuildingPlacement[]

export const roadPlacements = [
  { position: [0, 0, 0], size: [36, 1.5] },
  { position: [0, 0, 0], size: [1.5, 28] },
  { position: [-15, 0, -3], size: [1.5, 6] },
  { position: [14, 0, 3], size: [1.5, 6] },
] as const satisfies readonly CityPlacement[]

export const lotPlacements = [
  { position: [-6, 0, -4], size: [7.3, 5.7] },
  { position: [-6, 0, -10.5], size: [9.7, 6.5] },
  { position: [7, 0, -7], size: [7, 6] },
  { position: [-8, 0, 4], size: [7, 5] },
  { position: [-12, 0, 10.5], size: [6, 6] },
  { position: [6.8, 0, 6], size: [11.3, 8.1] },
] as const satisfies readonly CityPlacement[]

export const riverPlacements = [
  { position: [13.7, -0.1, -12], size: [5, 4], rotation: -0.12 },
  { position: [15, -0.1, -8], size: [4, 5], rotation: -0.35 },
  { position: [16, -0.1, -4], size: [3, 5], rotation: -0.18 },
] as const satisfies readonly CityPlacement[]

export const environmentBuildingPlacements = [
  { position: [-14, 0, -12.5], size: [3, 3] },
  { position: [7, 0, -12.5], size: [3, 2] },
  { position: [7, 0, 12], size: [3, 3] },
  { position: [-15, 0, 5], size: [3, 4] },
  { position: [-17, 0, 13], size: [2, 2] },
  { position: [16.5, 0, 8], size: [2.5, 3] },
  { position: [-4, 0, 12], size: [4, 3] },
  { position: [15, 0, 12], size: [4, 4] },
] as const satisfies readonly CityPlacement[]

export const vehiclePlacements = [
  { position: [-14, 0, -1], size: [1.4, 0.7], rotation: 0 },
  { position: [-6, 0, 1], size: [1.4, 0.7], rotation: Math.PI },
  { position: [5, 0, -1], size: [1.4, 0.7], rotation: 0 },
  { position: [12, 0, 1], size: [1.4, 0.7], rotation: Math.PI },
  { position: [-1, 0, -6], size: [1.4, 0.7], rotation: Math.PI / 2 },
  { position: [14, 0, 2], size: [1.4, 0.7], rotation: Math.PI / 2 },
  { position: [-15, 0, -3], size: [1.4, 0.7], rotation: 0 },
  { position: [0, 0, -10], size: [1.4, 0.7], rotation: Math.PI / 2 },
] as const satisfies readonly CityPlacement[]

export const treePlacements = [
  { position: [-17, 0, -8], size: [1.2, 1.2] },
  { position: [-17, 0, 9], size: [1.2, 1.2] },
  { position: [-8, 0, 12], size: [1.2, 1.2] },
  { position: [12, 0, -13], size: [1.2, 1.2] },
  { position: [2, 0, -12], size: [1.2, 1.2] },
  { position: [10, 0, -11], size: [1.2, 1.2] },
  { position: [4, 0, 1], size: [1.2, 1.2] },
  { position: [17, 0, 2], size: [1.2, 1.2] },
  { position: [4, 0, 12], size: [1.2, 1.2] },
  { position: [12, 0, 12], size: [1.2, 1.2] },
] as const satisfies readonly CityPlacement[]
