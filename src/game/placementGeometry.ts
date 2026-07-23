import { buildingCatalogById } from './buildingCatalog'
import {
  BUILDING_RENDER_SCALE,
  CITY_BOUNDS,
  type CityPlacement,
  type InteractiveBuildingPlacement,
} from './cityLayout'

export interface PlacementAabb {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export function getPlacementAabb(placement: CityPlacement): PlacementAabb {
  const rotation = placement.rotation ?? 0
  const cosine = Math.abs(Math.cos(rotation))
  const sine = Math.abs(Math.sin(rotation))
  const width = placement.size[0] * cosine + placement.size[1] * sine
  const depth = placement.size[0] * sine + placement.size[1] * cosine

  return {
    minX: placement.position[0] - width / 2,
    maxX: placement.position[0] + width / 2,
    minZ: placement.position[2] - depth / 2,
    maxZ: placement.position[2] + depth / 2,
  }
}

export function getInteractiveBuildingPlacement(
  building: InteractiveBuildingPlacement,
): CityPlacement {
  const footprint = buildingCatalogById[building.id].footprint

  return {
    position: building.position,
    size: [
      footprint[0] * BUILDING_RENDER_SCALE,
      footprint[1] * BUILDING_RENDER_SCALE,
    ],
    rotation: building.rotation,
  }
}

export function aabbsOverlapWithClearance(
  first: PlacementAabb,
  second: PlacementAabb,
  clearance: number,
): boolean {
  const normalizedClearance =
    Number.isNaN(clearance) || clearance < 0 ? 0 : clearance

  return (
    first.minX < second.maxX + normalizedClearance &&
    first.maxX > second.minX - normalizedClearance &&
    first.minZ < second.maxZ + normalizedClearance &&
    first.maxZ > second.minZ - normalizedClearance
  )
}

export function aabbContains(
  container: PlacementAabb,
  contained: PlacementAabb,
): boolean {
  return (
    container.minX <= contained.minX &&
    container.maxX >= contained.maxX &&
    container.minZ <= contained.minZ &&
    container.maxZ >= contained.maxZ
  )
}

export function isAabbInsideBounds(
  aabb: PlacementAabb,
  bounds: typeof CITY_BOUNDS,
): boolean {
  return (
    aabb.minX >= bounds.minX &&
    aabb.maxX <= bounds.maxX &&
    aabb.minZ >= bounds.minZ &&
    aabb.maxZ <= bounds.maxZ
  )
}
