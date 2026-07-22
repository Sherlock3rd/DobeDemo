import { describe, expect, it } from 'vitest'
import { buildingCatalogById } from './buildingCatalog'
import { BUILDING_IDS } from './cityTypes'
import {
  BUILDING_RENDER_SCALE,
  CAMERA_CONFIG,
  CITY_BOUNDS,
  environmentBuildingPlacements,
  interactiveBuildingPlacements,
  lotPlacements,
  riverPlacements,
  roadPlacements,
  treePlacements,
  type CityPlacement,
  vehiclePlacements,
} from './cityLayout'

const EXPECTED_INTERACTIVE_BUILDINGS = [
  { id: 'recycling-yard', position: [-11, 0, -8], rotation: 0 },
  { id: 'metalworking-plant', position: [-2, 0, -9], rotation: 0 },
  { id: 'clubhouse', position: [7, 0, -7], rotation: 0 },
  { id: 'repair-shop', position: [-11, 0, 0], rotation: 0 },
  { id: 'gas-station', position: [-5, 0, 8], rotation: 0 },
  { id: 'commercial-street', position: [8, 0, 4], rotation: 0 },
] as const

function crossesCityCenter({ position, size }: CityPlacement) {
  return (
    Math.abs(position[0]) <= size[0] / 2 && Math.abs(position[2]) <= size[1] / 2
  )
}

function placementsIntersectOrTouch(
  first: CityPlacement,
  second: CityPlacement,
) {
  const firstMinX = first.position[0] - first.size[0] / 2
  const firstMaxX = first.position[0] + first.size[0] / 2
  const firstMinZ = first.position[2] - first.size[1] / 2
  const firstMaxZ = first.position[2] + first.size[1] / 2
  const secondMinX = second.position[0] - second.size[0] / 2
  const secondMaxX = second.position[0] + second.size[0] / 2
  const secondMinZ = second.position[2] - second.size[1] / 2
  const secondMaxZ = second.position[2] + second.size[1] / 2

  return (
    firstMinX <= secondMaxX &&
    firstMaxX >= secondMinX &&
    firstMinZ <= secondMaxZ &&
    firstMaxZ >= secondMinZ
  )
}

function footprintsOverlap(
  first: (typeof interactiveBuildingPlacements)[number],
  second: (typeof interactiveBuildingPlacements)[number],
) {
  const firstFootprint = buildingCatalogById[first.id].footprint
  const secondFootprint = buildingCatalogById[second.id].footprint
  const firstHalfX = (firstFootprint[0] * BUILDING_RENDER_SCALE) / 2
  const firstHalfZ = (firstFootprint[1] * BUILDING_RENDER_SCALE) / 2
  const secondHalfX = (secondFootprint[0] * BUILDING_RENDER_SCALE) / 2
  const secondHalfZ = (secondFootprint[1] * BUILDING_RENDER_SCALE) / 2

  return (
    Math.abs(first.position[0] - second.position[0]) <
      firstHalfX + secondHalfX &&
    Math.abs(first.position[2] - second.position[2]) < firstHalfZ + secondHalfZ
  )
}

function getPlacementAabb(placement: CityPlacement) {
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

function aabbsHavePositiveOverlap(first: CityPlacement, second: CityPlacement) {
  const firstAabb = getPlacementAabb(first)
  const secondAabb = getPlacementAabb(second)

  return (
    firstAabb.minX < secondAabb.maxX &&
    firstAabb.maxX > secondAabb.minX &&
    firstAabb.minZ < secondAabb.maxZ &&
    firstAabb.maxZ > secondAabb.minZ
  )
}

describe('cityLayout', () => {
  it('places every building ID exactly once', () => {
    const ids = interactiveBuildingPlacements.map(({ id }) => id)

    expect(new Set(ids)).toEqual(new Set(BUILDING_IDS))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('uses the required interactive building positions', () => {
    expect(interactiveBuildingPlacements).toEqual(
      EXPECTED_INTERACTIVE_BUILDINGS,
    )
  })

  it('fits every scaled interactive building on a lot at the same center', () => {
    expect(BUILDING_RENDER_SCALE).toBe(0.4)

    for (const building of interactiveBuildingPlacements) {
      const lot = lotPlacements.find(
        ({ position }) =>
          position[0] === building.position[0] &&
          position[2] === building.position[2],
      )
      const footprint = buildingCatalogById[building.id].footprint

      expect(lot, `${building.id} lot`).toBeDefined()
      expect(lot?.size[0]).toBeGreaterThanOrEqual(
        footprint[0] * BUILDING_RENDER_SCALE,
      )
      expect(lot?.size[1]).toBeGreaterThanOrEqual(
        footprint[1] * BUILDING_RENDER_SCALE,
      )
    }
  })

  it('keeps scaled interactive building footprints from overlapping', () => {
    for (
      let firstIndex = 0;
      firstIndex < interactiveBuildingPlacements.length;
      firstIndex += 1
    ) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < interactiveBuildingPlacements.length;
        secondIndex += 1
      ) {
        const first = interactiveBuildingPlacements[firstIndex]
        const second = interactiveBuildingPlacements[secondIndex]

        expect(
          footprintsOverlap(first, second),
          `${first.id} overlaps ${second.id}`,
        ).toBe(false)
      }
    }
  })

  it('keeps interactive buildings inside the city bounds', () => {
    for (const { position } of interactiveBuildingPlacements) {
      expect(position[0]).toBeGreaterThanOrEqual(CITY_BOUNDS.minX)
      expect(position[0]).toBeLessThanOrEqual(CITY_BOUNDS.maxX)
      expect(position[2]).toBeGreaterThanOrEqual(CITY_BOUNDS.minZ)
      expect(position[2]).toBeLessThanOrEqual(CITY_BOUNDS.maxZ)
    }
  })

  it('provides every static placement category', () => {
    expect(roadPlacements.length).toBeGreaterThan(0)
    expect(lotPlacements.length).toBeGreaterThan(0)
    expect(riverPlacements.length).toBeGreaterThan(0)
    expect(environmentBuildingPlacements.length).toBeGreaterThan(0)
    expect(vehiclePlacements.length).toBeGreaterThan(0)
    expect(treePlacements.length).toBeGreaterThan(0)
  })

  it('forms crossing main roads with at least two connected branches', () => {
    const horizontalMainRoad = roadPlacements.find(
      (road) => road.size[0] >= road.size[1] * 2 && crossesCityCenter(road),
    )
    const verticalMainRoad = roadPlacements.find(
      (road) => road.size[1] >= road.size[0] * 2 && crossesCityCenter(road),
    )

    expect(horizontalMainRoad).toBeDefined()
    expect(verticalMainRoad).toBeDefined()

    if (!horizontalMainRoad || !verticalMainRoad) {
      throw new Error(
        'The city must provide horizontal and vertical main roads',
      )
    }

    const branchRoads = roadPlacements.filter(
      (road) => road !== horizontalMainRoad && road !== verticalMainRoad,
    )

    expect(branchRoads.length).toBeGreaterThanOrEqual(2)
    for (const branch of branchRoads) {
      expect(
        placementsIntersectOrTouch(branch, horizontalMainRoad) ||
          placementsIntersectOrTouch(branch, verticalMainRoad),
      ).toBe(true)
    }
  })

  it('provides enough vehicles and trees', () => {
    expect(vehiclePlacements.length).toBeGreaterThanOrEqual(6)
    expect(treePlacements.length).toBeGreaterThanOrEqual(6)
  })

  it('uses the required initial camera framing', () => {
    expect(CAMERA_CONFIG.position).toEqual([24, 28, 30])
    expect(CAMERA_CONFIG.target).toEqual([0, 0, 0])
    expect(CAMERA_CONFIG.initialZoom).toBe(22)
  })

  it('keeps camera zoom limits ordered', () => {
    expect(CAMERA_CONFIG.minZoom).toBeLessThan(CAMERA_CONFIG.initialZoom)
    expect(CAMERA_CONFIG.initialZoom).toBeLessThan(CAMERA_CONFIG.maxZoom)
  })

  it('keeps ordered camera pan bounds inside the city', () => {
    expect(CAMERA_CONFIG.panBounds.minX).toBeLessThanOrEqual(
      CAMERA_CONFIG.panBounds.maxX,
    )
    expect(CAMERA_CONFIG.panBounds.minZ).toBeLessThanOrEqual(
      CAMERA_CONFIG.panBounds.maxZ,
    )
    expect(CAMERA_CONFIG.panBounds.minX).toBeGreaterThanOrEqual(
      CITY_BOUNDS.minX,
    )
    expect(CAMERA_CONFIG.panBounds.maxX).toBeLessThanOrEqual(CITY_BOUNDS.maxX)
    expect(CAMERA_CONFIG.panBounds.minZ).toBeGreaterThanOrEqual(
      CITY_BOUNDS.minZ,
    )
    expect(CAMERA_CONFIG.panBounds.maxZ).toBeLessThanOrEqual(CITY_BOUNDS.maxZ)
  })

  it('places the river in the upper-right area', () => {
    for (const { position } of riverPlacements) {
      expect(position[0]).toBeGreaterThan(0)
      expect(position[2]).toBeLessThan(0)
    }
  })

  it('does not place environment buildings on interactive building centers', () => {
    const interactiveCenters = new Set(
      interactiveBuildingPlacements.map(
        ({ position }) => `${position[0]},${position[2]}`,
      ),
    )

    for (const { position } of environmentBuildingPlacements) {
      expect(interactiveCenters.has(`${position[0]},${position[2]}`)).toBe(
        false,
      )
    }
  })

  it('keeps environment building AABBs clear of every static object', () => {
    const overlaps: string[] = []
    const staticObstacles: readonly {
      label: string
      placement: CityPlacement
    }[] = [
      ...interactiveBuildingPlacements.map((building) => ({
        label: building.id,
        placement: {
          position: building.position,
          size: buildingCatalogById[building.id].footprint.map(
            (dimension) => dimension * BUILDING_RENDER_SCALE,
          ) as [number, number],
          rotation: building.rotation,
        },
      })),
      ...roadPlacements.map((placement, index) => ({
        label: `road ${index}`,
        placement,
      })),
      ...riverPlacements.map((placement, index) => ({
        label: `river ${index}`,
        placement,
      })),
      ...vehiclePlacements.map((placement, index) => ({
        label: `vehicle ${index}`,
        placement,
      })),
      ...treePlacements.map((placement, index) => ({
        label: `tree ${index}`,
        placement,
      })),
    ]

    environmentBuildingPlacements.forEach((environment, environmentIndex) => {
      staticObstacles.forEach(({ label, placement }) => {
        if (aabbsHavePositiveOverlap(environment, placement)) {
          overlaps.push(`environment ${environmentIndex} overlaps ${label}`)
        }
      })

      environmentBuildingPlacements
        .slice(environmentIndex + 1)
        .forEach((otherEnvironment, otherOffset) => {
          if (aabbsHavePositiveOverlap(environment, otherEnvironment)) {
            overlaps.push(
              `environment ${environmentIndex} overlaps environment ${
                environmentIndex + otherOffset + 1
              }`,
            )
          }
        })
    })

    expect(overlaps).toEqual([])
  })

  it('keeps all eight environment building AABBs inside the city bounds', () => {
    expect(environmentBuildingPlacements).toHaveLength(8)

    for (const { position, size } of environmentBuildingPlacements) {
      expect(position[0] - size[0] / 2).toBeGreaterThanOrEqual(CITY_BOUNDS.minX)
      expect(position[0] + size[0] / 2).toBeLessThanOrEqual(CITY_BOUNDS.maxX)
      expect(position[2] - size[1] / 2).toBeGreaterThanOrEqual(CITY_BOUNDS.minZ)
      expect(position[2] + size[1] / 2).toBeLessThanOrEqual(CITY_BOUNDS.maxZ)
    }
  })
})
