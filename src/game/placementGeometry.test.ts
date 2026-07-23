import { describe, expect, it } from 'vitest'
import { BUILDING_RENDER_SCALE, CITY_BOUNDS } from './cityLayout'
import {
  aabbContains,
  aabbsOverlapWithClearance,
  getInteractiveBuildingPlacement,
  getPlacementAabb,
  isAabbInsideBounds,
  type PlacementAabb,
} from './placementGeometry'

const UNIT_AABB: PlacementAabb = {
  minX: 0,
  maxX: 1,
  minZ: 0,
  maxZ: 1,
}

describe('getPlacementAabb', () => {
  it('returns the unrotated footprint at 0 degrees', () => {
    expect(
      getPlacementAabb({
        position: [4, 0, -3],
        size: [6, 2],
        rotation: 0,
      }),
    ).toEqual({ minX: 1, maxX: 7, minZ: -4, maxZ: -2 })
  })

  it('swaps projected width and depth at 90 degrees', () => {
    const aabb = getPlacementAabb({
      position: [4, 0, -3],
      size: [6, 2],
      rotation: Math.PI / 2,
    })

    expect(aabb.minX).toBeCloseTo(3)
    expect(aabb.maxX).toBeCloseTo(5)
    expect(aabb.minZ).toBeCloseTo(-6)
    expect(aabb.maxZ).toBeCloseTo(0)
  })

  it('projects width and depth at an arbitrary angle', () => {
    const aabb = getPlacementAabb({
      position: [0, 0, 0],
      size: [4, 2],
      rotation: Math.PI / 4,
    })
    const halfExtent = (3 * Math.SQRT2) / 2

    expect(aabb.minX).toBeCloseTo(-halfExtent)
    expect(aabb.maxX).toBeCloseTo(halfExtent)
    expect(aabb.minZ).toBeCloseTo(-halfExtent)
    expect(aabb.maxZ).toBeCloseTo(halfExtent)
  })
})

describe('getInteractiveBuildingPlacement', () => {
  it('uses the scaled catalog footprint and preserves the transform', () => {
    const building = {
      id: 'recycling-yard',
      position: [-11, 0, -8],
      rotation: Math.PI / 3,
    } as const

    expect(getInteractiveBuildingPlacement(building)).toEqual({
      position: building.position,
      size: [18 * BUILDING_RENDER_SCALE, 14 * BUILDING_RENDER_SCALE],
      rotation: building.rotation,
    })
  })

  it('looks up a different footprint by building id', () => {
    const building = {
      id: 'gas-station',
      position: [3, 0, 5],
      rotation: 0,
    } as const

    expect(getInteractiveBuildingPlacement(building).size).toEqual([
      14 * BUILDING_RENDER_SCALE,
      10 * BUILDING_RENDER_SCALE,
    ])
  })
})

describe('aabbsOverlapWithClearance', () => {
  it('detects positive-area overlap', () => {
    expect(
      aabbsOverlapWithClearance(
        UNIT_AABB,
        { minX: 0.5, maxX: 1.5, minZ: 0.5, maxZ: 1.5 },
        0,
      ),
    ).toBe(true)
  })

  it('does not treat touching as overlap at zero clearance', () => {
    const touching = { minX: 1, maxX: 2, minZ: 0, maxZ: 1 }

    expect(aabbsOverlapWithClearance(UNIT_AABB, touching, 0)).toBe(false)
  })

  it('treats touching as a conflict with positive clearance', () => {
    const touching = { minX: 1, maxX: 2, minZ: 0, maxZ: 1 }

    expect(aabbsOverlapWithClearance(UNIT_AABB, touching, 0.1)).toBe(true)
  })

  it('does not treat Z-axis touching as overlap at zero clearance', () => {
    const touchingOnZ = { minX: 0, maxX: 1, minZ: 1, maxZ: 2 }

    expect(aabbsOverlapWithClearance(UNIT_AABB, touchingOnZ, 0)).toBe(false)
  })

  it('treats Z-axis touching as a conflict with positive clearance', () => {
    const touchingOnZ = { minX: 0, maxX: 1, minZ: 1, maxZ: 2 }

    expect(aabbsOverlapWithClearance(UNIT_AABB, touchingOnZ, 1)).toBe(true)
  })

  it('detects a Z-axis gap smaller than clearance', () => {
    const nearbyOnZ = { minX: 0, maxX: 1, minZ: 2, maxZ: 3 }

    expect(aabbsOverlapWithClearance(UNIT_AABB, nearbyOnZ, 2)).toBe(true)
  })

  it('allows a Z-axis gap equal to clearance', () => {
    const exactClearanceOnZ = { minX: 0, maxX: 1, minZ: 2, maxZ: 3 }

    expect(aabbsOverlapWithClearance(UNIT_AABB, exactClearanceOnZ, 1)).toBe(
      false,
    )
  })

  it('allows a Z-axis gap greater than clearance', () => {
    const beyondClearanceOnZ = { minX: 0, maxX: 1, minZ: 3, maxZ: 4 }

    expect(aabbsOverlapWithClearance(UNIT_AABB, beyondClearanceOnZ, 1)).toBe(
      false,
    )
  })

  it('detects a gap smaller than clearance', () => {
    const nearby = { minX: 1.2, maxX: 2.2, minZ: 0, maxZ: 1 }

    expect(aabbsOverlapWithClearance(UNIT_AABB, nearby, 0.3)).toBe(true)
  })

  it('allows a gap equal to or greater than clearance', () => {
    const equalGap = { minX: 1.3, maxX: 2.3, minZ: 0, maxZ: 1 }
    const greaterGap = { minX: 1.4, maxX: 2.4, minZ: 0, maxZ: 1 }

    expect(aabbsOverlapWithClearance(UNIT_AABB, equalGap, 0.3)).toBe(false)
    expect(aabbsOverlapWithClearance(UNIT_AABB, greaterGap, 0.3)).toBe(false)
  })

  it('normalizes negative and NaN clearance to zero', () => {
    const touching = { minX: 1, maxX: 2, minZ: 0, maxZ: 1 }

    expect(aabbsOverlapWithClearance(UNIT_AABB, touching, -1)).toBe(false)
    expect(aabbsOverlapWithClearance(UNIT_AABB, touching, Number.NaN)).toBe(
      false,
    )
  })
})

describe('AABB boundary helpers', () => {
  it('includes equal boundaries when checking containment', () => {
    expect(aabbContains(UNIT_AABB, { ...UNIT_AABB })).toBe(true)
    expect(
      aabbContains(UNIT_AABB, {
        minX: -0.01,
        maxX: 1,
        minZ: 0,
        maxZ: 1,
      }),
    ).toBe(false)
    expect(
      aabbContains(UNIT_AABB, {
        minX: 0,
        maxX: 1.01,
        minZ: 0,
        maxZ: 1,
      }),
    ).toBe(false)
    expect(
      aabbContains(UNIT_AABB, {
        minX: 0,
        maxX: 1,
        minZ: -0.01,
        maxZ: 1,
      }),
    ).toBe(false)
    expect(
      aabbContains(UNIT_AABB, {
        minX: 0,
        maxX: 1,
        minZ: 0,
        maxZ: 1.01,
      }),
    ).toBe(false)
  })

  it('includes equal boundaries when checking city bounds', () => {
    expect(
      isAabbInsideBounds(
        {
          minX: CITY_BOUNDS.minX,
          maxX: CITY_BOUNDS.maxX,
          minZ: CITY_BOUNDS.minZ,
          maxZ: CITY_BOUNDS.maxZ,
        },
        CITY_BOUNDS,
      ),
    ).toBe(true)
    expect(
      isAabbInsideBounds(
        {
          minX: CITY_BOUNDS.minX - 0.01,
          maxX: CITY_BOUNDS.maxX,
          minZ: CITY_BOUNDS.minZ,
          maxZ: CITY_BOUNDS.maxZ,
        },
        CITY_BOUNDS,
      ),
    ).toBe(false)
    expect(
      isAabbInsideBounds(
        {
          minX: CITY_BOUNDS.minX,
          maxX: CITY_BOUNDS.maxX + 0.01,
          minZ: CITY_BOUNDS.minZ,
          maxZ: CITY_BOUNDS.maxZ,
        },
        CITY_BOUNDS,
      ),
    ).toBe(false)
    expect(
      isAabbInsideBounds(
        {
          minX: CITY_BOUNDS.minX,
          maxX: CITY_BOUNDS.maxX,
          minZ: CITY_BOUNDS.minZ - 0.01,
          maxZ: CITY_BOUNDS.maxZ,
        },
        CITY_BOUNDS,
      ),
    ).toBe(false)
    expect(
      isAabbInsideBounds(
        {
          minX: CITY_BOUNDS.minX,
          maxX: CITY_BOUNDS.maxX,
          minZ: CITY_BOUNDS.minZ,
          maxZ: CITY_BOUNDS.maxZ + 0.01,
        },
        CITY_BOUNDS,
      ),
    ).toBe(false)
  })
})
