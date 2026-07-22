import type { ReactElement } from 'react'
import { BoxGeometry, CylinderGeometry, Euler, Matrix4 } from 'three'
import { describe, expect, it } from 'vitest'
import { buildingCatalogById } from '../../game/buildingCatalog'
import {
  BUILDING_HITBOX_HEIGHT,
  BUILDING_RENDER_SCALE,
} from '../../game/cityLayout'
import type { BuildingKind } from '../../game/cityTypes'
import { BuildingModel } from './BuildingModel'
import {
  buildingVisualConfig,
  getBuildingVisualStage,
  type BuildingVisualPart,
} from './buildingVisualConfig'

const buildingKinds = [
  'recycling',
  'metalworking',
  'gas',
  'repair',
  'clubhouse',
  'commercial',
] as const satisfies readonly BuildingKind[]

const expectedLevelTags: Readonly<
  Record<BuildingKind, Readonly<Record<1 | 2 | 3, readonly string[]>>>
> = {
  recycling: {
    1: ['main-building', 'scrap-car', 'grab-crane', 'crane-boom'],
    2: ['baling-workshop', 'scrap-rack-lower', 'scrap-rack-upper'],
    3: ['sorting-hall', 'magnet-crane', 'magnet-crane-boom', 'scrap-car'],
  },
  metalworking: {
    1: ['main-building', 'furnace', 'material-stack'],
    2: ['stamping-shop', 'smokestack', 'lifting-frame'],
    3: [
      'main-building',
      'furnace',
      'material-stack',
      'metalworking-hall',
      'second-furnace',
      'gantry-crane',
      'tall-smokestack',
    ],
  },
  gas: {
    1: ['fuel-pump', 'fuel-pump-2', 'pump-canopy'],
    2: [
      'fuel-pump',
      'fuel-pump-2',
      'fuel-pump-3',
      'fuel-pump-4',
      'convenience-store',
      'price-sign',
    ],
    3: ['fuel-pump', 'truck-canopy', 'truck-fueling-area', 'tall-price-sign'],
  },
  repair: {
    1: ['repair-shed', 'garage-door', 'outdoor-parts-rack'],
    2: ['service-bay-1', 'service-bay-2', 'overhead-crane', 'exhaust-stack'],
    3: ['multi-bay-service-hall', 'mechanical-platform', 'garage-door'],
  },
  clubhouse: {
    1: ['main-building', 'porch'],
    2: ['upper-floor', 'terrace', 'clubhouse-sign'],
    3: ['observation-deck', 'clubhouse-sign'],
  },
  commercial: {
    1: ['storefront', 'rear-loading-bay'],
    2: ['upper-retail-floor', 'skybridge', 'billboard'],
    3: ['retail-tower-a', 'retail-tower-b', 'central-beacon', 'storefront'],
  },
}

function expectPositiveGeometry(part: BuildingVisualPart) {
  if (part.shape === 'box') {
    part.size.forEach((dimension) => expect(dimension).toBeGreaterThan(0))
    return
  }

  expect(part.radius).toBeGreaterThan(0)
  expect(part.height).toBeGreaterThan(0)
}

function getVisualPartTop(part: BuildingVisualPart) {
  const geometry =
    part.shape === 'box'
      ? new BoxGeometry(part.size[0], part.size[1], part.size[2])
      : new CylinderGeometry(part.radius, part.radius, part.height, 16)
  const rotation = part.rotation ?? [0, 0, 0]

  geometry.applyMatrix4(
    new Matrix4().makeRotationFromEuler(
      new Euler(rotation[0], rotation[1], rotation[2], 'XYZ'),
    ),
  )
  geometry.computeBoundingBox()

  const top = part.position[1] + geometry.boundingBox!.max.y
  geometry.dispose()
  return top
}

interface MaterialProps {
  emissive: string
  emissiveIntensity: number
}

type ModelMesh = ReactElement<{
  children: readonly ReactElement<MaterialProps>[]
}>

function getClubhouseMaterial(
  tag: string,
  highlighted: boolean,
): MaterialProps {
  const model = BuildingModel({
    definition: buildingCatalogById.clubhouse,
    level: 2,
    highlighted,
  }) as ReactElement<{ children: readonly ModelMesh[] }>
  const mesh = model.props.children.find(({ key }) =>
    String(key).startsWith(`${tag}-`),
  )

  expect(mesh, `missing ${tag} mesh`).toBeDefined()
  return mesh!.props.children.at(-1)!.props
}

describe('buildingVisualConfig', () => {
  it('defines all three levels for every building kind', () => {
    buildingKinds.forEach((kind) => {
      expect(Object.keys(buildingVisualConfig[kind]).map(Number)).toEqual([
        1, 2, 3,
      ])
    })
  })

  it('provides non-empty stages whose part counts strictly increase', () => {
    buildingKinds.forEach((kind) => {
      const stages = buildingVisualConfig[kind]

      expect(stages[1].length).toBeGreaterThan(0)
      expect(stages[2].length).toBeGreaterThan(stages[1].length)
      expect(stages[3].length).toBeGreaterThan(stages[2].length)
    })
  })

  it('uses only positive geometry dimensions', () => {
    buildingKinds.forEach((kind) => {
      ;([1, 2, 3] as const).forEach((level) => {
        buildingVisualConfig[kind][level].forEach(expectPositiveGeometry)
      })
    })
  })

  it('keeps every scaled visual part below the building hitbox height', () => {
    expect(BUILDING_HITBOX_HEIGHT).toBe(5)

    buildingKinds.forEach((kind) => {
      ;([1, 2, 3] as const).forEach((level) => {
        buildingVisualConfig[kind][level].forEach((part) => {
          const scaledTop = getVisualPartTop(part) * BUILDING_RENDER_SCALE

          expect(
            scaledTop,
            `${kind} level ${level} ${part.tag} top`,
          ).toBeLessThanOrEqual(BUILDING_HITBOX_HEIGHT)
        })
      })
    })
  })

  it('represents every catalog level summary with stage-specific tags', () => {
    buildingKinds.forEach((kind) => {
      ;([1, 2, 3] as const).forEach((level) => {
        const stageTags = buildingVisualConfig[kind][level].map(
          ({ tag }) => tag,
        )

        expect(stageTags, `${kind} level ${level}`).toEqual(
          expect.arrayContaining([...expectedLevelTags[kind][level]]),
        )
      })
    })
  })

  it('returns the exact requested stage', () => {
    buildingKinds.forEach((kind) => {
      ;([1, 2, 3] as const).forEach((level) => {
        expect(getBuildingVisualStage(kind, level)).toBe(
          buildingVisualConfig[kind][level],
        )
      })
    })
  })
})

describe('BuildingModel material emissive', () => {
  it('keeps the clubhouse sign glowing while other parts follow highlight state', () => {
    expect(getClubhouseMaterial('clubhouse-sign', false)).toMatchObject({
      emissive: buildingCatalogById.clubhouse.accentColor,
      emissiveIntensity: 0.45,
    })
    expect(getClubhouseMaterial('main-building', false)).toMatchObject({
      emissive: '#000000',
      emissiveIntensity: 0,
    })
    expect(getClubhouseMaterial('main-building', true)).toMatchObject({
      emissive: '#ffcf70',
      emissiveIntensity: 0.22,
    })
  })

  it('uses the shared warm highlight for a highlighted neon sign', () => {
    expect(getClubhouseMaterial('clubhouse-sign', true)).toMatchObject({
      emissive: '#ffcf70',
      emissiveIntensity: 0.22,
    })
  })
})
