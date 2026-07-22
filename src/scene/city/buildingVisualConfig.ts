import type { BuildingKind, BuildingLevel } from '../../game/cityTypes'

export type BuildingColorRole = 'primary' | 'accent' | 'roof' | 'dark' | 'glass'

export interface BoxVisualPart {
  shape: 'box'
  tag: string
  position: readonly [number, number, number]
  size: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  colorRole: BuildingColorRole
}

export interface CylinderVisualPart {
  shape: 'cylinder'
  tag: string
  position: readonly [number, number, number]
  radius: number
  height: number
  rotation?: readonly [number, number, number]
  colorRole: BuildingColorRole
}

export type BuildingVisualPart = BoxVisualPart | CylinderVisualPart
export type BuildingVisualStages = Readonly<
  Record<BuildingLevel, readonly BuildingVisualPart[]>
>

const recyclingLevel1 = [
  {
    shape: 'box',
    tag: 'main-building',
    position: [0, 1.5, 1],
    size: [8, 3, 6],
    colorRole: 'primary',
  },
  {
    shape: 'box',
    tag: 'scrap-car',
    position: [-5, 0.6, -2],
    size: [2.8, 1.2, 1.5],
    colorRole: 'accent',
  },
  {
    shape: 'cylinder',
    tag: 'grab-crane',
    position: [4.5, 2.4, -2],
    radius: 0.55,
    height: 4.8,
    colorRole: 'accent',
  },
  {
    shape: 'box',
    tag: 'crane-boom',
    position: [2.8, 4.3, -2],
    size: [4, 0.4, 0.4],
    rotation: [0, 0, -0.18],
    colorRole: 'accent',
  },
] as const satisfies readonly BuildingVisualPart[]

const metalworkingLevel1 = [
  {
    shape: 'box',
    tag: 'main-building',
    position: [0, 2, 0],
    size: [13, 4, 8],
    colorRole: 'primary',
  },
  {
    shape: 'cylinder',
    tag: 'furnace',
    position: [-4.5, 1.6, 3.5],
    radius: 1.3,
    height: 3.2,
    colorRole: 'dark',
  },
  {
    shape: 'box',
    tag: 'material-stack',
    position: [4.5, 0.9, 4.2],
    size: [4, 1.8, 1.6],
    colorRole: 'accent',
  },
] as const satisfies readonly BuildingVisualPart[]

const gasLevel1 = [
  {
    shape: 'box',
    tag: 'main-building',
    position: [-3.5, 1.4, 1],
    size: [5, 2.8, 5],
    colorRole: 'primary',
  },
  {
    shape: 'box',
    tag: 'fuel-pump',
    position: [1.4, 0.9, 0],
    size: [0.8, 1.8, 0.7],
    colorRole: 'accent',
  },
  {
    shape: 'box',
    tag: 'fuel-pump-2',
    position: [3.2, 0.9, 0],
    size: [0.8, 1.8, 0.7],
    colorRole: 'accent',
  },
  {
    shape: 'box',
    tag: 'pump-canopy',
    position: [2.3, 3.2, 0],
    size: [5, 0.5, 5],
    colorRole: 'roof',
  },
] as const satisfies readonly BuildingVisualPart[]

const repairLevel1 = [
  {
    shape: 'box',
    tag: 'repair-shed',
    position: [0, 2, 0],
    size: [9, 4, 7],
    colorRole: 'primary',
  },
  {
    shape: 'box',
    tag: 'garage-door',
    position: [0, 1.6, 3.55],
    size: [3.8, 2.8, 0.2],
    colorRole: 'accent',
  },
  {
    shape: 'box',
    tag: 'outdoor-parts-rack',
    position: [-5.5, 1, 1],
    size: [1.5, 2, 4],
    colorRole: 'dark',
  },
] as const satisfies readonly BuildingVisualPart[]

const clubhouseLevel1 = [
  {
    shape: 'box',
    tag: 'main-building',
    position: [0, 1.8, 0],
    size: [7, 3.6, 6],
    colorRole: 'primary',
  },
  {
    shape: 'box',
    tag: 'clubhouse-sign',
    position: [0, 2.5, 3.15],
    size: [3.8, 0.8, 0.25],
    colorRole: 'accent',
  },
  {
    shape: 'box',
    tag: 'porch',
    position: [0, 0.3, 3.8],
    size: [4.5, 0.6, 1.6],
    colorRole: 'roof',
  },
] as const satisfies readonly BuildingVisualPart[]

const commercialLevel1 = [
  {
    shape: 'box',
    tag: 'main-building',
    position: [0, 2, 0],
    size: [14, 4, 8],
    colorRole: 'primary',
  },
  {
    shape: 'box',
    tag: 'storefront',
    position: [0, 1.5, 4.1],
    size: [8, 2.4, 0.25],
    colorRole: 'glass',
  },
  {
    shape: 'box',
    tag: 'rear-loading-bay',
    position: [3, 1.1, -4.1],
    size: [4, 2.2, 0.25],
    colorRole: 'dark',
  },
] as const satisfies readonly BuildingVisualPart[]

export const buildingVisualConfig: Readonly<
  Record<BuildingKind, BuildingVisualStages>
> = {
  recycling: {
    1: recyclingLevel1,
    2: [
      ...recyclingLevel1,
      {
        shape: 'box',
        tag: 'baling-workshop',
        position: [5.5, 1.25, 1.5],
        size: [3, 2.5, 5],
        colorRole: 'dark',
      },
      {
        shape: 'box',
        tag: 'scrap-rack-lower',
        position: [-4.5, 0.8, 2.8],
        size: [3.5, 0.7, 1],
        colorRole: 'accent',
      },
      {
        shape: 'box',
        tag: 'scrap-rack-upper',
        position: [-4.5, 2.1, 2.8],
        size: [3.5, 0.7, 1],
        colorRole: 'accent',
      },
    ],
    3: [
      ...recyclingLevel1,
      {
        shape: 'box',
        tag: 'sorting-hall',
        position: [5, 2, 1],
        size: [4, 4, 6],
        colorRole: 'dark',
      },
      {
        shape: 'box',
        tag: 'scrap-rack-lower',
        position: [-4.5, 0.8, 2.8],
        size: [3.5, 0.7, 1],
        colorRole: 'accent',
      },
      {
        shape: 'box',
        tag: 'scrap-rack-upper',
        position: [-4.5, 2.1, 2.8],
        size: [3.5, 0.7, 1],
        colorRole: 'accent',
      },
      {
        shape: 'cylinder',
        tag: 'magnet-crane',
        position: [5, 5, -1],
        radius: 0.55,
        height: 6,
        colorRole: 'accent',
      },
      {
        shape: 'box',
        tag: 'magnet-crane-boom',
        position: [2.8, 7.5, -1],
        size: [5, 0.45, 0.45],
        rotation: [0, 0, -0.15],
        colorRole: 'accent',
      },
    ],
  },
  metalworking: {
    1: metalworkingLevel1,
    2: [
      ...metalworkingLevel1,
      {
        shape: 'box',
        tag: 'stamping-shop',
        position: [8, 1.7, 0],
        size: [3, 3.4, 7],
        colorRole: 'dark',
      },
      {
        shape: 'cylinder',
        tag: 'smokestack',
        position: [-6, 2.5, -3],
        radius: 0.5,
        height: 4,
        colorRole: 'roof',
      },
      {
        shape: 'box',
        tag: 'lifting-frame',
        position: [-4, 3, 4.8],
        size: [5, 0.4, 1.8],
        colorRole: 'roof',
      },
    ],
    3: [
      ...metalworkingLevel1,
      {
        shape: 'box',
        tag: 'metalworking-hall',
        position: [7, 3.5, 0],
        size: [4, 7, 8],
        colorRole: 'dark',
      },
      {
        shape: 'cylinder',
        tag: 'second-furnace',
        position: [-6, 1.6, 3.5],
        radius: 1.3,
        height: 3.2,
        colorRole: 'dark',
      },
      {
        shape: 'box',
        tag: 'gantry-crane',
        position: [-8, 3, 0],
        size: [2.5, 6, 3],
        colorRole: 'accent',
      },
      {
        shape: 'cylinder',
        tag: 'tall-smokestack',
        position: [-6, 4, -3],
        radius: 0.5,
        height: 6,
        colorRole: 'roof',
      },
    ],
  },
  gas: {
    1: gasLevel1,
    2: [
      ...gasLevel1,
      {
        shape: 'box',
        tag: 'fuel-pump-3',
        position: [1.4, 0.9, -2],
        size: [0.8, 1.8, 0.7],
        colorRole: 'accent',
      },
      {
        shape: 'box',
        tag: 'fuel-pump-4',
        position: [3.2, 0.9, -2],
        size: [0.8, 1.8, 0.7],
        colorRole: 'accent',
      },
      {
        shape: 'box',
        tag: 'convenience-store',
        position: [-3.5, 1.7, 1],
        size: [5, 3.4, 5],
        colorRole: 'primary',
      },
      {
        shape: 'box',
        tag: 'price-sign',
        position: [5.5, 2.2, -3],
        size: [1.2, 4.4, 0.5],
        colorRole: 'accent',
      },
    ],
    3: [
      ...gasLevel1,
      {
        shape: 'box',
        tag: 'truck-canopy',
        position: [2.5, 3.8, 0],
        size: [6, 0.6, 6],
        colorRole: 'roof',
      },
      {
        shape: 'box',
        tag: 'tall-price-sign',
        position: [5.5, 2.8, -3],
        size: [1.3, 5.6, 0.55],
        colorRole: 'accent',
      },
      {
        shape: 'box',
        tag: 'truck-fueling-area',
        position: [2.5, 0.15, 0],
        size: [7, 0.3, 7],
        colorRole: 'dark',
      },
      {
        shape: 'cylinder',
        tag: 'fuel-tank-marker',
        position: [-5, 3, -3],
        radius: 0.8,
        height: 6,
        colorRole: 'accent',
      },
      {
        shape: 'box',
        tag: 'heavy-vehicle-pump',
        position: [4.8, 1.1, 1.8],
        size: [0.8, 1.8, 0.7],
        colorRole: 'accent',
      },
    ],
  },
  repair: {
    1: repairLevel1,
    2: [
      ...repairLevel1,
      {
        shape: 'box',
        tag: 'service-bay-1',
        position: [-2.3, 1.6, 3.55],
        size: [3.5, 2.8, 0.2],
        colorRole: 'accent',
      },
      {
        shape: 'box',
        tag: 'service-bay-2',
        position: [2.3, 1.6, 3.55],
        size: [3.5, 2.8, 0.2],
        colorRole: 'accent',
      },
      {
        shape: 'box',
        tag: 'overhead-crane',
        position: [0, 3.7, 0],
        size: [7, 0.35, 0.5],
        colorRole: 'dark',
      },
      {
        shape: 'cylinder',
        tag: 'exhaust-stack',
        position: [-3, 4.8, -1],
        radius: 0.35,
        height: 2.4,
        colorRole: 'roof',
      },
    ],
    3: [
      ...repairLevel1,
      {
        shape: 'box',
        tag: 'multi-bay-service-hall',
        position: [5.5, 2.3, 0],
        size: [2, 4.6, 7],
        colorRole: 'dark',
      },
      {
        shape: 'box',
        tag: 'service-bay-2',
        position: [3.8, 1.7, 3.55],
        size: [2.4, 3, 0.2],
        colorRole: 'accent',
      },
      {
        shape: 'box',
        tag: 'service-bay-3',
        position: [6.8, 1.7, 3.55],
        size: [2.4, 3, 0.2],
        colorRole: 'accent',
      },
      {
        shape: 'cylinder',
        tag: 'exhaust-stack',
        position: [-3, 5, -1],
        radius: 0.35,
        height: 2.8,
        colorRole: 'roof',
      },
      {
        shape: 'box',
        tag: 'mechanical-platform',
        position: [1.5, 4.4, -1],
        size: [4, 0.5, 3],
        colorRole: 'roof',
      },
      {
        shape: 'cylinder',
        tag: 'roof-fan',
        position: [1.5, 5.1, -1],
        radius: 0.8,
        height: 0.9,
        colorRole: 'accent',
      },
    ],
  },
  clubhouse: {
    1: clubhouseLevel1,
    2: [
      ...clubhouseLevel1,
      {
        shape: 'box',
        tag: 'upper-floor',
        position: [-1, 4.5, -0.5],
        size: [5, 1.8, 4],
        colorRole: 'dark',
      },
      {
        shape: 'box',
        tag: 'terrace',
        position: [2.5, 3.8, 0],
        size: [2.5, 0.35, 5],
        colorRole: 'roof',
      },
    ],
    3: [
      ...clubhouseLevel1,
      {
        shape: 'box',
        tag: 'upper-floor',
        position: [-1, 4.5, -0.5],
        size: [5, 1.8, 4],
        colorRole: 'dark',
      },
      {
        shape: 'box',
        tag: 'terrace',
        position: [2.5, 3.8, 0],
        size: [2.5, 0.35, 5],
        colorRole: 'roof',
      },
      {
        shape: 'box',
        tag: 'observation-deck',
        position: [-1, 5.8, -0.5],
        size: [4, 0.35, 3],
        colorRole: 'roof',
      },
      {
        shape: 'cylinder',
        tag: 'neon-mast',
        position: [0, 7, 0],
        radius: 0.25,
        height: 2.5,
        colorRole: 'accent',
      },
    ],
  },
  commercial: {
    1: commercialLevel1,
    2: [
      ...commercialLevel1,
      {
        shape: 'box',
        tag: 'upper-retail-floor',
        position: [-3, 5.5, 0],
        size: [8, 3, 7],
        colorRole: 'dark',
      },
      {
        shape: 'box',
        tag: 'skybridge',
        position: [5, 4.5, 0],
        size: [4, 1.2, 2],
        colorRole: 'glass',
      },
      {
        shape: 'box',
        tag: 'billboard',
        position: [3, 7.3, 0],
        size: [4, 1.5, 0.4],
        colorRole: 'accent',
      },
    ],
    3: [
      ...commercialLevel1,
      {
        shape: 'box',
        tag: 'retail-tower-a',
        position: [-5, 6, 0],
        size: [5, 8, 7],
        colorRole: 'dark',
      },
      {
        shape: 'box',
        tag: 'retail-tower-b',
        position: [5, 4.5, 0],
        size: [4, 5, 7],
        colorRole: 'primary',
      },
      {
        shape: 'box',
        tag: 'skybridge',
        position: [0, 5, 0],
        size: [5, 1.2, 2],
        colorRole: 'glass',
      },
      {
        shape: 'cylinder',
        tag: 'central-beacon',
        position: [0, 8, 0],
        radius: 0.7,
        height: 7,
        colorRole: 'accent',
      },
    ],
  },
}

export function getBuildingVisualStage(
  kind: BuildingKind,
  level: BuildingLevel,
): readonly BuildingVisualPart[] {
  return buildingVisualConfig[kind][level]
}
