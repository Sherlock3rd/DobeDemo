import { buildingCatalog } from '../../game/buildingCatalog'
import {
  BUILDING_MAX_LEVEL,
  getTargetBuildingLevel,
} from '../../game/buildingUpgrade'
import type {
  BuildingKind,
  BuildingLevel,
  BuildingProgress,
} from '../../game/cityTypes'
import type {
  BoxVisualPart,
  BuildingColorRole,
  BuildingVisualPart,
  CylinderVisualPart,
} from './buildingVisualConfig'

export interface BuildingFragmentBlueprint {
  id: string
  name: string
  description: string
  // Local slot centre. Task 4 renders each fragment under
  // `<group position={anchor}>`, so a fragment can scale in place without its
  // parts sliding toward the building origin.
  anchor: readonly [number, number, number]
  // Parts are authored relative to the anchor (origin-relative), Lv.1 form.
  parts: readonly BuildingVisualPart[]
}

export type FragmentRenderState = 'current' | 'target' | 'scaffold'

export interface RenderedBuildingFragment {
  id: string
  name: string
  state: FragmentRenderState
  anchor: readonly [number, number, number]
  parts: readonly BuildingVisualPart[]
  animate: boolean
}

const BUILDING_KINDS = [
  'repair',
  'recycling',
  'commercial',
  'metalworking',
  'gas',
  'clubhouse',
] as const satisfies readonly BuildingKind[]

const FRAGMENT_SLOT_COLUMNS = 5
const FRAGMENT_SLOT_ROWS = 2

// Small, uniform per-level growth: keeps the current/target difference visible
// without pushing the tallest slot past the footprint / hitbox at Lv.10.
const FRAGMENT_HEIGHT_GROWTH_PER_LEVEL = 0.04
const FRAGMENT_MARKER_BASE_HEIGHT = 0.3
const FRAGMENT_MARKER_HEIGHT_PER_LEVEL = 0.15

const footprintByKind = Object.fromEntries(
  buildingCatalog.map((building) => [building.kind, building.footprint]),
) as Record<BuildingKind, readonly [number, number]>

function box(
  tag: string,
  position: readonly [number, number, number],
  size: readonly [number, number, number],
  colorRole: BuildingColorRole,
  rotation?: readonly [number, number, number],
): BoxVisualPart {
  return rotation
    ? { shape: 'box', tag, position, size, rotation, colorRole }
    : { shape: 'box', tag, position, size, colorRole }
}

function cyl(
  tag: string,
  position: readonly [number, number, number],
  radius: number,
  height: number,
  colorRole: BuildingColorRole,
  rotation?: readonly [number, number, number],
): CylinderVisualPart {
  return rotation
    ? { shape: 'cylinder', tag, position, radius, height, rotation, colorRole }
    : { shape: 'cylinder', tag, position, radius, height, colorRole }
}

interface FragmentMeta {
  name: string
  description: string
}

const fragmentMeta: Readonly<Record<BuildingKind, readonly FragmentMeta[]>> = {
  repair: [
    { name: '基础维修棚', description: '单跨维修棚，承担日常保养作业。' },
    { name: '零件货架', description: '户外零件货架，分层存放常用配件。' },
    { name: '举升工位', description: '液压举升工位，抬升车辆检修底盘。' },
    { name: '排气设施', description: '排气抽风设施，排走尾气与烟尘。' },
    { name: '诊断工位', description: '电子诊断工位，读取车辆故障码。' },
    { name: '轮胎工位', description: '轮胎拆装工位，快速换胎与动平衡。' },
    { name: '小型起重机', description: '小型起重机，吊装发动机与总成。' },
    { name: '喷漆间', description: '封闭喷漆间，负责钣金喷涂与烤漆。' },
    { name: '调校工位', description: '性能调校工位，标定动力与悬挂。' },
    { name: '控制室', description: '维修控制室，统一调度各工位。' },
  ],
  recycling: [
    { name: '废车堆场', description: '开放废车堆场，集中堆放待拆解车辆。' },
    { name: '抓机', description: '单臂抓机，抓取并转运废旧车体。' },
    { name: '压块车间', description: '压块车间，将废料压制成金属块。' },
    { name: '分拣货架', description: '分拣货架，分类存放回收部件。' },
    { name: '打包机', description: '废料打包机，捆扎散碎金属。' },
    { name: '磁吸吊机', description: '磁吸吊机，吸附搬运钢铁废料。' },
    { name: '破碎机', description: '重型破碎机，粉碎大型废件。' },
    { name: '输送分选线', description: '输送分选线，自动分流不同物料。' },
    { name: '金属分离器', description: '金属分离器，分离有色与黑色金属。' },
    { name: '控制塔', description: '回收控制塔，统筹全厂调度。' },
  ],
  commercial: [
    { name: '主街商铺', description: '沿街主力商铺，构成商业街门面。' },
    { name: '装卸后巷', description: '装卸后巷，供货车理货与补货。' },
    { name: '二号商铺', description: '二号临街商铺，扩展经营面积。' },
    { name: '街区广告牌', description: '街区广告牌，展示品牌与促销。' },
    { name: '餐饮摊位', description: '餐饮摊位，提供街头小吃与饮品。' },
    { name: '商业连廊', description: '商业连廊，连接商铺遮风避雨。' },
    { name: '转角商铺', description: '转角旗舰商铺，占据街角人流。' },
    { name: '中央广场', description: '中央广场，集散人流与举办活动。' },
    { name: '综合塔楼', description: '商业综合塔楼，叠加办公与零售。' },
    { name: '中央灯塔', description: '中央灯塔，点亮整条商业街地标。' },
  ],
  metalworking: [
    { name: '基础加工车间', description: '基础加工车间，承担常规金属件加工。' },
    { name: '熔炉', description: '工业熔炉，熔炼金属原料。' },
    { name: '材料堆', description: '原料堆场，储备待加工金属材料。' },
    { name: '冲压车间', description: '冲压车间，成型钣金与结构件。' },
    { name: '主烟囱', description: '主排烟烟囱，排放炉窑高温废气。' },
    { name: '龙门吊架', description: '龙门吊架，吊运重型工件。' },
    { name: '二号炉体', description: '二号炉体，扩充熔炼产能。' },
    { name: '切割线', description: '自动切割线，负责精密下料。' },
    { name: '重型天车', description: '重型天车，跨车间搬运重物。' },
    { name: '生产控制塔', description: '生产控制塔，集中监控产线。' },
  ],
  gas: [
    { name: '一号泵岛', description: '一号加油泵岛，提供基础加注。' },
    { name: '二号泵岛', description: '二号加油泵岛，扩充加注车位。' },
    { name: '金属顶棚', description: '金属顶棚，为泵岛遮阳挡雨。' },
    { name: '便利店', description: '便利店，售卖车品与快消品。' },
    { name: '价格立柱', description: '价格立柱，展示实时油价。' },
    { name: '三号泵岛', description: '三号加油泵岛，缓解高峰排队。' },
    { name: '洗车间', description: '自动洗车间，快速清洗车身。' },
    { name: '卡车加注区', description: '卡车加注区，服务重型车辆。' },
    { name: '储油标识', description: '高耸储油标识，标示站点位置。' },
    { name: '综合服务楼', description: '综合服务楼，集合休息与办公。' },
  ],
  clubhouse: [
    { name: '主会所', description: '砖墙主会所，帮派成员的据点。' },
    { name: '门廊', description: '入口门廊，迎接来访成员。' },
    { name: '会所招牌', description: '会所招牌，彰显帮派名号。' },
    { name: '二层露台', description: '二层露台，俯瞰城区街景。' },
    { name: '二层会馆', description: '二层会馆，扩展聚会空间。' },
    { name: '霓虹标识', description: '霓虹标识，夜间点亮会所。' },
    { name: '车库', description: '专属车库，停放成员座驾。' },
    { name: '休息室', description: '成员休息室，供日常歇脚。' },
    { name: '屋顶观景台', description: '屋顶观景台，眺望全城天际线。' },
    { name: '会馆灯塔', description: '会馆灯塔，成为帮派地标。' },
  ],
}

function getFragmentAnchor(
  kind: BuildingKind,
  index: number,
): readonly [number, number, number] {
  const [footprintX, footprintZ] = footprintByKind[kind]
  const column = index % FRAGMENT_SLOT_COLUMNS
  const row = Math.floor(index / FRAGMENT_SLOT_COLUMNS)
  const cellWidth = footprintX / FRAGMENT_SLOT_COLUMNS
  const cellDepth = footprintZ / FRAGMENT_SLOT_ROWS

  return [
    -footprintX / 2 + cellWidth * (column + 0.5),
    0,
    -footprintZ / 2 + cellDepth * (row + 0.5),
  ]
}

// Half-extents available to a fragment inside its slot cell (origin-relative).
function getFragmentBudget(kind: BuildingKind): { bx: number; bz: number } {
  const [footprintX, footprintZ] = footprintByKind[kind]
  return {
    bx: footprintX / (2 * FRAGMENT_SLOT_COLUMNS),
    bz: footprintZ / (2 * FRAGMENT_SLOT_ROWS),
  }
}

function buildRepairParts(
  index: number,
  bx: number,
  bz: number,
): readonly BuildingVisualPart[] {
  switch (index) {
    case 0:
      return [
        box('repair-shed', [0, 1.1, 0], [bx * 1.4, 2.2, bz * 1.0], 'primary'),
        box(
          'repair-roll-door',
          [0, 0.7, bz * 0.5 + 0.06],
          [bx * 0.9, 1.4, 0.12],
          'accent',
        ),
      ]
    case 1:
      return [
        box(
          'repair-rack-frame',
          [0, 1.2, 0],
          [bx * 1.2, 2.4, bz * 0.5],
          'dark',
        ),
        box(
          'repair-parts-shelf',
          [0, 0.6, bz * 0.28],
          [bx * 1.0, 0.22, bz * 0.4],
          'accent',
        ),
        box(
          'repair-parts-shelf',
          [0, 1.2, bz * 0.28],
          [bx * 1.0, 0.22, bz * 0.4],
          'accent',
        ),
        box(
          'repair-parts-shelf',
          [0, 1.8, bz * 0.28],
          [bx * 1.0, 0.22, bz * 0.4],
          'accent',
        ),
      ]
    case 2:
      return [
        cyl('repair-lift-post', [-bx * 0.5, 1.1, 0], 0.14, 2.2, 'dark'),
        cyl('repair-lift-post', [bx * 0.5, 1.1, 0], 0.14, 2.2, 'dark'),
        box(
          'repair-lift-platform',
          [0, 1.6, 0],
          [bx * 1.2, 0.2, bz * 0.7],
          'accent',
        ),
        box(
          'repair-lifted-car',
          [0, 2.0, 0],
          [bx * 0.9, 0.7, bz * 0.6],
          'primary',
        ),
      ]
    case 3:
      return [
        box(
          'repair-exhaust-hood',
          [0, 1.0, 0],
          [bx * 1.2, 2.0, bz * 0.7],
          'primary',
        ),
        cyl('repair-exhaust-fan', [0, 2.2, bz * 0.3], 0.5, 0.4, 'accent', [
          Math.PI / 2,
          0,
          0,
        ]),
        cyl('repair-exhaust-stack', [bx * 0.4, 3.0, 0], 0.18, 2.0, 'roof'),
      ]
    case 4:
      return [
        box(
          'repair-diagnostic-booth',
          [0, 1.1, 0],
          [bx * 1.3, 2.2, bz * 0.8],
          'primary',
        ),
        box(
          'repair-diagnostic-screen',
          [bx * 0.3, 1.4, bz * 0.4 + 0.06],
          [bx * 0.7, 1.0, 0.12],
          'glass',
        ),
        cyl(
          'repair-diagnostic-sensor',
          [-bx * 0.5, 1.6, -bz * 0.2],
          0.1,
          1.2,
          'accent',
        ),
      ]
    case 5:
      return [
        box('repair-tire-rack', [0, 1.0, 0], [bx * 1.2, 2.0, bz * 0.5], 'dark'),
        cyl('repair-tire', [-bx * 0.3, 0.5, bz * 0.35], 0.5, 0.4, 'accent', [
          Math.PI / 2,
          0,
          0,
        ]),
        cyl('repair-tire', [bx * 0.3, 0.5, bz * 0.35], 0.5, 0.4, 'accent', [
          Math.PI / 2,
          0,
          0,
        ]),
        cyl('repair-tire', [0, 1.2, bz * 0.35], 0.5, 0.4, 'accent', [
          Math.PI / 2,
          0,
          0,
        ]),
      ]
    case 6:
      return [
        box(
          'repair-crane-base',
          [-bx * 0.3, 0.3, 0],
          [bx * 0.7, 0.6, bz * 0.4],
          'dark',
        ),
        cyl('repair-crane-column', [-bx * 0.3, 1.9, 0], 0.16, 3.2, 'accent'),
        box(
          'repair-crane-boom',
          [bx * 0.2, 3.2, 0],
          [bx * 1.4, 0.18, 0.18],
          'accent',
          [0, 0, -0.2],
        ),
        box('repair-crane-hook', [bx * 0.5, 2.5, 0], [0.12, 0.6, 0.12], 'dark'),
      ]
    case 7:
      return [
        box(
          'repair-paint-booth',
          [0, 1.3, 0],
          [bx * 1.4, 2.6, bz * 0.9],
          'primary',
        ),
        box(
          'repair-paint-filter',
          [0, 2.9, 0],
          [bx * 1.0, 0.6, bz * 0.6],
          'accent',
        ),
        cyl('repair-paint-vent', [bx * 0.4, 3.9, 0], 0.16, 1.4, 'roof'),
      ]
    case 8:
      return [
        box(
          'repair-tuning-rig',
          [0, 0.9, 0],
          [bx * 1.3, 1.8, bz * 0.9],
          'primary',
        ),
        cyl('repair-dyno-roller', [0, 0.4, bz * 0.35], 0.35, bx * 1.0, 'dark', [
          0,
          0,
          Math.PI / 2,
        ]),
        cyl('repair-dyno-roller', [0, 0.4, bz * 0.1], 0.35, bx * 1.0, 'dark', [
          0,
          0,
          Math.PI / 2,
        ]),
        box(
          'repair-tuning-console',
          [bx * 0.4, 1.3, -bz * 0.3],
          [bx * 0.6, 0.8, bz * 0.3],
          'accent',
        ),
      ]
    default:
      return [
        box(
          'repair-control-room',
          [0, 1.4, 0],
          [bx * 1.4, 2.8, bz * 0.9],
          'primary',
        ),
        box(
          'repair-control-window',
          [0, 1.9, bz * 0.45 + 0.06],
          [bx * 1.1, 0.8, 0.12],
          'glass',
        ),
        cyl('repair-control-antenna', [bx * 0.4, 3.6, 0], 0.08, 1.6, 'accent'),
        box(
          'repair-control-dish',
          [-bx * 0.4, 3.05, 0],
          [0.5, 0.5, 0.2],
          'roof',
        ),
      ]
  }
}

function buildRecyclingParts(
  index: number,
  bx: number,
  bz: number,
): readonly BuildingVisualPart[] {
  switch (index) {
    case 0:
      return [
        box(
          'recycling-yard-pad',
          [0, 0.2, 0],
          [bx * 1.5, 0.4, bz * 1.2],
          'dark',
        ),
        box(
          'recycling-wreck',
          [-bx * 0.3, 0.8, bz * 0.2],
          [bx * 0.7, 1.2, bz * 0.4],
          'primary',
          [0, 0.3, 0],
        ),
        box(
          'recycling-wreck',
          [bx * 0.4, 1.0, -bz * 0.2],
          [bx * 0.6, 1.4, bz * 0.35],
          'accent',
          [0, -0.4, 0],
        ),
      ]
    case 1:
      return [
        box(
          'recycling-grab-base',
          [0, 0.6, 0],
          [bx * 1.0, 1.2, bz * 0.5],
          'dark',
        ),
        box(
          'recycling-grab-cab',
          [-bx * 0.3, 1.4, 0],
          [bx * 0.5, 0.8, bz * 0.3],
          'primary',
        ),
        cyl(
          'recycling-grab-arm',
          [0, 2.4, 0],
          0.16,
          3.2,
          'accent',
          [0, 0, 0.25],
        ),
        box(
          'recycling-grab-claw',
          [bx * 0.6, 3.4, 0],
          [0.3, 0.6, 0.3],
          'accent',
        ),
      ]
    case 2:
      return [
        box(
          'recycling-baler-hall',
          [0, 1.3, 0],
          [bx * 1.4, 2.6, bz * 0.9],
          'primary',
        ),
        box(
          'recycling-baler-press',
          [0, 3.0, 0],
          [bx * 1.0, 0.8, bz * 0.6],
          'accent',
        ),
        box(
          'recycling-metal-block',
          [bx * 0.4, 0.5, bz * 0.4],
          [0.7, 1.0, 0.7],
          'dark',
        ),
      ]
    case 3:
      return [
        box(
          'recycling-sort-frame',
          [0, 1.4, 0],
          [bx * 1.3, 2.8, bz * 0.5],
          'dark',
        ),
        box(
          'recycling-sort-shelf',
          [0, 0.7, bz * 0.3],
          [bx * 1.1, 0.2, bz * 0.5],
          'accent',
        ),
        box(
          'recycling-sort-shelf',
          [0, 1.5, bz * 0.3],
          [bx * 1.1, 0.2, bz * 0.5],
          'accent',
        ),
        box(
          'recycling-sort-shelf',
          [0, 2.3, bz * 0.3],
          [bx * 1.1, 0.2, bz * 0.5],
          'accent',
        ),
      ]
    case 4:
      return [
        box(
          'recycling-packer-body',
          [0, 1.1, 0],
          [bx * 1.3, 2.2, bz * 0.8],
          'primary',
        ),
        cyl('recycling-packer-hopper', [0, 2.65, 0], 0.6, 0.9, 'accent'),
        cyl(
          'recycling-bale',
          [bx * 0.4, 0.5, bz * 0.3],
          0.4,
          bz * 0.5,
          'dark',
          [Math.PI / 2, 0, 0],
        ),
      ]
    case 5:
      return [
        box(
          'recycling-magnet-base',
          [-bx * 0.3, 0.6, 0],
          [bx * 0.7, 1.2, bz * 0.4],
          'dark',
        ),
        cyl('recycling-magnet-mast', [-bx * 0.3, 2.6, 0], 0.18, 4.0, 'accent'),
        box(
          'recycling-magnet-boom',
          [bx * 0.1, 4.3, 0],
          [bx * 1.4, 0.2, 0.2],
          'accent',
          [0, 0, -0.15],
        ),
        cyl('recycling-magnet-disc', [bx * 0.5, 3.4, 0], 0.5, 0.4, 'primary'),
      ]
    case 6:
      return [
        box(
          'recycling-crusher-body',
          [0, 1.4, 0],
          [bx * 1.4, 2.8, bz * 0.9],
          'dark',
        ),
        box(
          'recycling-crusher-intake',
          [0, 3.1, 0],
          [bx * 0.9, 0.6, bz * 0.5],
          'accent',
        ),
        cyl(
          'recycling-crusher-rotor',
          [0, 0.8, bz * 0.4],
          0.4,
          bx * 1.0,
          'primary',
          [0, 0, Math.PI / 2],
        ),
      ]
    case 7:
      return [
        box(
          'recycling-conveyor-belt',
          [0, 1.2, 0],
          [bx * 0.8, 0.3, bz * 1.3],
          'accent',
          [0.15, 0, 0],
        ),
        cyl('recycling-conveyor-leg', [0, 0.5, bz * 0.4], 0.1, 1.0, 'dark'),
        cyl('recycling-conveyor-leg', [0, 0.9, -bz * 0.4], 0.1, 1.8, 'dark'),
        box(
          'recycling-conveyor-chute',
          [bx * 0.3, 1.6, bz * 0.5],
          [0.5, 0.8, 0.5],
          'primary',
        ),
      ]
    case 8:
      return [
        box(
          'recycling-separator-frame',
          [0, 1.1, 0],
          [bx * 1.3, 2.2, bz * 0.7],
          'dark',
        ),
        cyl(
          'recycling-separator-drum',
          [0, 1.4, bz * 0.3],
          0.7,
          bz * 0.6,
          'accent',
          [Math.PI / 2, 0, 0],
        ),
        box(
          'recycling-separator-outlet',
          [bx * 0.4, 0.6, -bz * 0.3],
          [0.6, 1.2, 0.6],
          'primary',
        ),
      ]
    default:
      return [
        box(
          'recycling-control-shaft',
          [0, 2.0, 0],
          [bx * 0.8, 4.0, bz * 0.5],
          'primary',
        ),
        box(
          'recycling-control-cabin',
          [0, 4.5, 0],
          [bx * 1.3, 1.0, bz * 0.8],
          'accent',
        ),
        cyl('recycling-control-antenna', [0, 5.7, 0], 0.08, 1.4, 'roof'),
      ]
  }
}

function buildCommercialParts(
  index: number,
  bx: number,
  bz: number,
): readonly BuildingVisualPart[] {
  switch (index) {
    case 0:
      return [
        box(
          'commercial-main-shop',
          [0, 1.4, 0],
          [bx * 1.4, 2.8, bz * 0.9],
          'primary',
        ),
        box(
          'commercial-shop-glass',
          [0, 1.1, bz * 0.45 + 0.06],
          [bx * 1.2, 1.8, 0.12],
          'glass',
        ),
        box(
          'commercial-shop-awning',
          [0, 2.4, bz * 0.5],
          [bx * 1.3, 0.2, bz * 0.25],
          'accent',
          [0.2, 0, 0],
        ),
      ]
    case 1:
      return [
        box('commercial-dock', [0, 1.0, 0], [bx * 1.4, 2.0, bz * 0.8], 'dark'),
        box(
          'commercial-dock-door',
          [-bx * 0.4, 0.8, bz * 0.4 + 0.06],
          [bx * 0.5, 1.6, 0.12],
          'accent',
        ),
        box(
          'commercial-dock-door',
          [bx * 0.4, 0.8, bz * 0.4 + 0.06],
          [bx * 0.5, 1.6, 0.12],
          'accent',
        ),
      ]
    case 2:
      return [
        box(
          'commercial-second-shop',
          [0, 1.6, 0],
          [bx * 1.3, 3.2, bz * 0.9],
          'primary',
        ),
        box(
          'commercial-second-glass',
          [0, 1.0, bz * 0.45 + 0.06],
          [bx * 1.0, 1.6, 0.12],
          'glass',
        ),
        box(
          'commercial-second-balcony',
          [0, 2.4, bz * 0.5],
          [bx * 1.2, 0.15, bz * 0.2],
          'roof',
        ),
      ]
    case 3:
      return [
        cyl(
          'commercial-billboard-post',
          [-bx * 0.4, 1.5, 0],
          0.12,
          3.0,
          'dark',
        ),
        cyl('commercial-billboard-post', [bx * 0.4, 1.5, 0], 0.12, 3.0, 'dark'),
        box(
          'commercial-billboard-panel',
          [0, 3.4, 0],
          [bx * 1.4, 1.2, 0.2],
          'accent',
        ),
      ]
    case 4:
      return [
        box(
          'commercial-food-counter',
          [0, 0.8, 0],
          [bx * 1.3, 1.6, bz * 0.6],
          'primary',
        ),
        cyl('commercial-food-parasol-pole', [0, 1.8, 0], 0.08, 1.6, 'dark'),
        box(
          'commercial-food-parasol',
          [0, 2.7, 0],
          [bx * 1.2, 0.15, bz * 0.5],
          'accent',
        ),
        box(
          'commercial-food-stool',
          [0, 0.35, bz * 0.45],
          [bx * 0.9, 0.3, bz * 0.15],
          'roof',
        ),
      ]
    case 5:
      return [
        cyl(
          'commercial-arcade-column',
          [-bx * 0.5, 1.2, bz * 0.3],
          0.14,
          2.4,
          'primary',
        ),
        cyl(
          'commercial-arcade-column',
          [bx * 0.5, 1.2, bz * 0.3],
          0.14,
          2.4,
          'primary',
        ),
        cyl(
          'commercial-arcade-column',
          [0, 1.2, -bz * 0.4],
          0.14,
          2.4,
          'primary',
        ),
        box(
          'commercial-arcade-roof',
          [0, 2.525, 0],
          [bx * 1.5, 0.25, bz * 1.3],
          'roof',
        ),
      ]
    case 6:
      return [
        box(
          'commercial-corner-wing-a',
          [-bx * 0.4, 1.5, 0],
          [bx * 0.8, 3.0, bz * 0.9],
          'primary',
        ),
        box(
          'commercial-corner-wing-b',
          [bx * 0.4, 1.2, bz * 0.3],
          [bx * 0.9, 2.4, bz * 0.6],
          'accent',
        ),
        box(
          'commercial-corner-sign',
          [-bx * 0.4, 3.3, 0],
          [bx * 0.6, 0.6, 0.3],
          'roof',
        ),
      ]
    case 7:
      return [
        box(
          'commercial-plaza-pad',
          [0, 0.15, 0],
          [bx * 1.6, 0.3, bz * 1.4],
          'roof',
        ),
        cyl('commercial-plaza-fountain', [0, 0.6, 0], 0.7, 1.2, 'glass'),
        box(
          'commercial-plaza-planter',
          [-bx * 0.5, 0.4, bz * 0.5],
          [bx * 0.4, 0.8, bz * 0.2],
          'primary',
        ),
        box(
          'commercial-plaza-planter',
          [bx * 0.5, 0.4, -bz * 0.5],
          [bx * 0.4, 0.8, bz * 0.2],
          'primary',
        ),
      ]
    case 8:
      return [
        box(
          'commercial-tower-podium',
          [0, 1.0, 0],
          [bx * 1.5, 2.0, bz * 0.9],
          'primary',
        ),
        box(
          'commercial-tower-shaft',
          [0, 3.6, 0],
          [bx * 1.0, 3.2, bz * 0.6],
          'dark',
        ),
        box(
          'commercial-tower-crown',
          [0, 5.4, 0],
          [bx * 0.8, 0.4, bz * 0.45],
          'accent',
        ),
      ]
    default:
      return [
        box(
          'commercial-beacon-base',
          [0, 1.3, 0],
          [bx * 1.2, 2.6, bz * 0.8],
          'primary',
        ),
        cyl('commercial-central-beacon', [0, 4.3, 0], 0.4, 3.4, 'accent'),
        cyl('commercial-beacon-light', [0, 6.3, 0], 0.55, 0.6, 'roof'),
      ]
  }
}

function buildMetalworkingParts(
  index: number,
  bx: number,
  bz: number,
): readonly BuildingVisualPart[] {
  switch (index) {
    case 0:
      return [
        box(
          'metalworking-basic-hall',
          [0, 1.3, 0],
          [bx * 1.4, 2.6, bz * 0.9],
          'dark',
        ),
        box(
          'metalworking-basic-door',
          [0, 0.9, bz * 0.45 + 0.06],
          [bx * 0.7, 1.8, 0.12],
          'accent',
        ),
        cyl('metalworking-basic-duct', [bx * 0.4, 3.3, 0], 0.16, 1.4, 'roof'),
      ]
    case 1:
      return [
        cyl('metalworking-furnace-body', [0, 1.4, 0], 1.0, 2.8, 'primary'),
        cyl(
          'metalworking-furnace-chimney',
          [bx * 0.4, 3.8, 0],
          0.3,
          2.0,
          'roof',
        ),
        box(
          'metalworking-furnace-tap',
          [0, 0.6, bz * 0.4],
          [bx * 0.6, 1.0, bz * 0.3],
          'accent',
        ),
      ]
    case 2:
      return [
        box(
          'metalworking-material-pallet',
          [0, 0.15, bz * 0.4],
          [bx * 1.2, 0.3, bz * 0.4],
          'dark',
        ),
        box(
          'metalworking-material-slab',
          [0, 0.5, 0],
          [bx * 1.4, 1.0, bz * 0.9],
          'accent',
        ),
        box(
          'metalworking-material-slab',
          [-bx * 0.2, 1.4, 0],
          [bx * 1.0, 0.8, bz * 0.7],
          'accent',
        ),
        box(
          'metalworking-material-slab',
          [bx * 0.2, 2.1, 0],
          [bx * 0.7, 0.6, bz * 0.5],
          'accent',
        ),
      ]
    case 3:
      return [
        box(
          'metalworking-stamp-hall',
          [0, 1.5, 0],
          [bx * 1.4, 3.0, bz * 0.9],
          'dark',
        ),
        box(
          'metalworking-stamp-ram',
          [0, 3.4, 0],
          [bx * 0.8, 0.8, bz * 0.5],
          'accent',
        ),
        cyl('metalworking-stamp-piston', [0, 4.2, 0], 0.2, 0.8, 'primary'),
      ]
    case 4:
      return [
        box(
          'metalworking-chimney-base',
          [0, 0.8, 0],
          [bx * 0.9, 1.6, bz * 0.5],
          'dark',
        ),
        cyl('metalworking-main-chimney', [0, 3.6, 0], 0.35, 4.0, 'roof'),
        cyl('metalworking-chimney-cap', [0, 5.8, 0], 0.5, 0.4, 'accent'),
      ]
    case 5:
      return [
        cyl(
          'metalworking-gantry-leg',
          [-bx * 0.55, 1.6, 0],
          0.16,
          3.2,
          'accent',
        ),
        cyl(
          'metalworking-gantry-leg',
          [bx * 0.55, 1.6, 0],
          0.16,
          3.2,
          'accent',
        ),
        box(
          'metalworking-gantry-beam',
          [0, 3.35, 0],
          [bx * 1.4, 0.3, bz * 0.3],
          'dark',
        ),
        box(
          'metalworking-gantry-trolley',
          [bx * 0.2, 3.0, 0],
          [0.5, 0.5, 0.5],
          'primary',
        ),
      ]
    case 6:
      return [
        cyl('metalworking-second-furnace', [0, 1.5, 0], 0.9, 3.0, 'primary'),
        cyl(
          'metalworking-second-duct',
          [bx * 0.5, 3.6, 0],
          0.25,
          1.8,
          'roof',
          [0, 0, 0.2],
        ),
        box(
          'metalworking-second-charge',
          [-bx * 0.4, 0.8, bz * 0.3],
          [bx * 0.6, 1.6, bz * 0.3],
          'accent',
        ),
      ]
    case 7:
      return [
        box(
          'metalworking-cutting-bed',
          [0, 0.5, 0],
          [bx * 1.4, 1.0, bz * 1.2],
          'dark',
        ),
        box(
          'metalworking-cutting-rail',
          [-bx * 0.5, 1.4, 0],
          [0.2, 0.6, bz * 1.2],
          'accent',
        ),
        box(
          'metalworking-cutting-rail',
          [bx * 0.5, 1.4, 0],
          [0.2, 0.6, bz * 1.2],
          'accent',
        ),
        box(
          'metalworking-cutting-torch',
          [0, 1.8, bz * 0.2],
          [0.4, 0.8, 0.4],
          'primary',
        ),
      ]
    case 8:
      return [
        box(
          'metalworking-crane-rail',
          [-bx * 0.6, 3.0, 0],
          [0.25, 0.4, bz * 1.1],
          'dark',
        ),
        box(
          'metalworking-crane-rail',
          [bx * 0.6, 3.0, 0],
          [0.25, 0.4, bz * 1.1],
          'dark',
        ),
        box(
          'metalworking-crane-bridge',
          [0, 3.4, 0],
          [bx * 1.5, 0.4, bz * 0.4],
          'accent',
        ),
        box(
          'metalworking-crane-hoist',
          [bx * 0.1, 2.6, 0],
          [0.6, 1.2, 0.6],
          'primary',
        ),
      ]
    default:
      return [
        box(
          'metalworking-control-tower',
          [0, 2.2, 0],
          [bx * 0.9, 4.4, bz * 0.6],
          'primary',
        ),
        box(
          'metalworking-control-cabin',
          [0, 4.85, 0],
          [bx * 1.3, 0.9, bz * 0.9],
          'accent',
        ),
        cyl('metalworking-control-mast', [0, 6.0, 0], 0.08, 1.4, 'roof'),
      ]
  }
}

function buildGasParts(
  index: number,
  bx: number,
  bz: number,
): readonly BuildingVisualPart[] {
  switch (index) {
    case 0:
      return [
        box(
          'gas-island-1-pad',
          [0, 0.15, 0],
          [bx * 1.4, 0.3, bz * 0.8],
          'dark',
        ),
        box(
          'gas-island-1-pump',
          [0, 0.9, 0],
          [bx * 0.5, 1.8, bz * 0.25],
          'accent',
        ),
        box(
          'gas-island-1-topper',
          [0, 1.9, 0],
          [bx * 0.7, 0.3, bz * 0.35],
          'primary',
        ),
      ]
    case 1:
      return [
        box(
          'gas-island-2-pad',
          [0, 0.15, 0],
          [bx * 1.4, 0.3, bz * 0.9],
          'dark',
        ),
        box(
          'gas-island-2-pump',
          [-bx * 0.4, 0.9, 0],
          [bx * 0.45, 1.8, bz * 0.22],
          'accent',
        ),
        box(
          'gas-island-2-pump',
          [bx * 0.4, 0.9, 0],
          [bx * 0.45, 1.8, bz * 0.22],
          'accent',
        ),
      ]
    case 2:
      return [
        cyl('gas-canopy-pillar', [-bx * 0.6, 1.4, 0], 0.14, 2.8, 'dark'),
        cyl('gas-canopy-pillar', [bx * 0.6, 1.4, 0], 0.14, 2.8, 'dark'),
        box('gas-canopy-roof', [0, 2.95, 0], [bx * 1.8, 0.3, bz * 1.4], 'roof'),
        box(
          'gas-canopy-fascia',
          [0, 2.7, bz * 0.65],
          [bx * 1.7, 0.4, 0.12],
          'accent',
        ),
      ]
    case 3:
      return [
        box('gas-store', [0, 1.2, 0], [bx * 1.5, 2.4, bz * 0.9], 'primary'),
        box(
          'gas-store-glass',
          [0, 0.9, bz * 0.45 + 0.06],
          [bx * 1.2, 1.4, 0.12],
          'glass',
        ),
        box('gas-store-sign', [0, 2.7, 0], [bx * 1.0, 0.5, 0.2], 'accent'),
      ]
    case 4:
      return [
        cyl('gas-price-pole', [0, 1.8, 0], 0.12, 3.6, 'dark'),
        box('gas-price-board', [0, 3.4, 0], [bx * 1.0, 1.2, 0.25], 'accent'),
      ]
    case 5:
      return [
        box(
          'gas-island-3-pad',
          [0, 0.15, 0],
          [bx * 1.3, 0.3, bz * 0.8],
          'dark',
        ),
        box(
          'gas-island-3-pump',
          [0, 0.9, 0],
          [bx * 0.5, 1.8, bz * 0.25],
          'accent',
        ),
        cyl('gas-island-3-light', [0, 2.1, 0], 0.1, 0.6, 'roof'),
      ]
    case 6:
      return [
        box(
          'gas-wash-tunnel',
          [0, 1.1, 0],
          [bx * 1.4, 2.2, bz * 1.1],
          'primary',
        ),
        box(
          'gas-wash-arch',
          [0, 1.4, bz * 0.55 + 0.06],
          [bx * 1.3, 1.6, 0.12],
          'glass',
        ),
        cyl('gas-wash-brush', [0, 1.0, bz * 0.3], 0.4, 1.6, 'accent'),
      ]
    case 7:
      return [
        box('gas-truck-pad', [0, 0.15, 0], [bx * 1.6, 0.3, bz * 1.3], 'dark'),
        box(
          'gas-truck-pump',
          [-bx * 0.4, 1.2, 0],
          [bx * 0.6, 2.4, bz * 0.3],
          'accent',
        ),
        box(
          'gas-truck-gantry',
          [0, 2.525, 0],
          [bx * 1.4, 0.25, 0.25],
          'primary',
        ),
      ]
    case 8:
      return [
        cyl('gas-storage-tank', [0, 0.9, -bz * 0.2], 0.7, 1.8, 'primary', [
          0,
          0,
          Math.PI / 2,
        ]),
        cyl('gas-storage-mast', [bx * 0.45, 2.0, bz * 0.2], 0.1, 4.0, 'dark'),
        box(
          'gas-storage-logo',
          [bx * 0.45, 3.8, bz * 0.2],
          [bx * 0.8, 0.9, 0.2],
          'accent',
        ),
      ]
    default:
      return [
        box(
          'gas-service-building',
          [0, 1.6, 0],
          [bx * 1.5, 3.2, bz * 0.95],
          'primary',
        ),
        box(
          'gas-service-sign',
          [0, 2.0, bz * 0.48 + 0.06],
          [bx * 1.2, 0.8, 0.12],
          'accent',
        ),
        box(
          'gas-service-rooftop',
          [0, 3.5, 0],
          [bx * 1.0, 0.6, bz * 0.5],
          'roof',
        ),
      ]
  }
}

function buildClubhouseParts(
  index: number,
  bx: number,
  bz: number,
): readonly BuildingVisualPart[] {
  switch (index) {
    case 0:
      return [
        box(
          'clubhouse-main-hall',
          [0, 1.4, 0],
          [bx * 1.5, 2.8, bz * 0.95],
          'primary',
        ),
        box(
          'clubhouse-main-door',
          [0, 0.8, bz * 0.48 + 0.06],
          [bx * 0.6, 1.6, 0.12],
          'dark',
        ),
        cyl(
          'clubhouse-main-chimney',
          [bx * 0.4, 3.5, -bz * 0.2],
          0.18,
          1.4,
          'roof',
        ),
      ]
    case 1:
      return [
        cyl(
          'clubhouse-porch-column',
          [-bx * 0.5, 0.9, bz * 0.3],
          0.12,
          1.8,
          'roof',
        ),
        cyl(
          'clubhouse-porch-column',
          [bx * 0.5, 0.9, bz * 0.3],
          0.12,
          1.8,
          'roof',
        ),
        box(
          'clubhouse-porch-roof',
          [0, 1.925, bz * 0.3],
          [bx * 1.4, 0.25, bz * 0.5],
          'accent',
        ),
      ]
    case 2:
      return [
        cyl('clubhouse-sign-post', [-bx * 0.5, 1.0, 0], 0.1, 2.0, 'dark'),
        cyl('clubhouse-sign-post', [bx * 0.5, 1.0, 0], 0.1, 2.0, 'dark'),
        box('clubhouse-name-sign', [0, 2.4, 0], [bx * 1.5, 1.0, 0.2], 'accent'),
      ]
    case 3:
      return [
        box(
          'clubhouse-terrace-base',
          [0, 1.2, 0],
          [bx * 1.4, 2.4, bz * 0.8],
          'primary',
        ),
        box(
          'clubhouse-terrace-slab',
          [0, 2.525, bz * 0.2],
          [bx * 1.5, 0.25, bz * 0.6],
          'roof',
        ),
        box(
          'clubhouse-terrace-rail',
          [0, 2.9, bz * 0.45],
          [bx * 1.4, 0.5, 0.1],
          'accent',
        ),
      ]
    case 4:
      return [
        box(
          'clubhouse-second-lower',
          [0, 1.1, 0],
          [bx * 1.5, 2.2, bz * 0.95],
          'primary',
        ),
        box(
          'clubhouse-second-upper',
          [-bx * 0.1, 2.9, 0],
          [bx * 1.2, 1.4, bz * 0.7],
          'dark',
        ),
        box(
          'clubhouse-second-window',
          [bx * 0.4, 2.9, bz * 0.36 + 0.06],
          [bx * 0.5, 0.8, 0.1],
          'glass',
        ),
      ]
    case 5:
      return [
        cyl('clubhouse-neon-mast', [0, 1.6, 0], 0.1, 3.2, 'dark'),
        box(
          'clubhouse-neon-sign',
          [0, 3.4, 0],
          [bx * 1.4, 1.2, 0.18],
          'accent',
        ),
        cyl('clubhouse-neon-halo', [0, 3.4, 0.2], 0.6, 0.15, 'accent', [
          Math.PI / 2,
          0,
          0,
        ]),
      ]
    case 6:
      return [
        box('clubhouse-garage', [0, 1.0, 0], [bx * 1.5, 2.0, bz * 0.9], 'dark'),
        box(
          'clubhouse-garage-door',
          [0, 0.8, bz * 0.45 + 0.06],
          [bx * 1.2, 1.5, 0.12],
          'accent',
        ),
        cyl('clubhouse-garage-vent', [bx * 0.4, 2.4, 0], 0.12, 0.8, 'roof'),
      ]
    case 7:
      return [
        box(
          'clubhouse-lounge',
          [0, 1.2, 0],
          [bx * 1.5, 2.4, bz * 0.9],
          'primary',
        ),
        box(
          'clubhouse-lounge-window',
          [0, 1.3, bz * 0.45 + 0.06],
          [bx * 1.3, 1.4, 0.12],
          'glass',
        ),
        box(
          'clubhouse-lounge-canopy',
          [0, 2.5, bz * 0.55],
          [bx * 1.4, 0.15, bz * 0.3],
          'roof',
          [0.2, 0, 0],
        ),
      ]
    case 8:
      return [
        box(
          'clubhouse-deck-building',
          [0, 1.5, 0],
          [bx * 1.4, 3.0, bz * 0.9],
          'primary',
        ),
        box(
          'clubhouse-deck-platform',
          [0, 3.125, 0],
          [bx * 1.5, 0.25, bz * 0.7],
          'roof',
        ),
        cyl(
          'clubhouse-deck-rail',
          [-bx * 0.5, 3.55, bz * 0.3],
          0.06,
          0.6,
          'accent',
        ),
        cyl(
          'clubhouse-deck-rail',
          [bx * 0.5, 3.55, -bz * 0.3],
          0.06,
          0.6,
          'accent',
        ),
      ]
    default:
      return [
        box(
          'clubhouse-beacon-tower',
          [0, 2.0, 0],
          [bx * 1.0, 4.0, bz * 0.6],
          'primary',
        ),
        cyl('clubhouse-beacon-lantern', [0, 4.6, 0], 0.5, 1.2, 'accent'),
        cyl('clubhouse-beacon-finial', [0, 5.7, 0], 0.12, 1.0, 'roof'),
      ]
  }
}

function buildFragmentParts(
  kind: BuildingKind,
  index: number,
): readonly BuildingVisualPart[] {
  const { bx, bz } = getFragmentBudget(kind)

  switch (kind) {
    case 'repair':
      return buildRepairParts(index, bx, bz)
    case 'recycling':
      return buildRecyclingParts(index, bx, bz)
    case 'commercial':
      return buildCommercialParts(index, bx, bz)
    case 'metalworking':
      return buildMetalworkingParts(index, bx, bz)
    case 'gas':
      return buildGasParts(index, bx, bz)
    case 'clubhouse':
      return buildClubhouseParts(index, bx, bz)
  }
}

function buildKindFragments(
  kind: BuildingKind,
): readonly BuildingFragmentBlueprint[] {
  return fragmentMeta[kind].map((meta, index) => ({
    id: `${kind}-fragment-${index + 1}`,
    name: meta.name,
    description: meta.description,
    anchor: getFragmentAnchor(kind, index),
    parts: buildFragmentParts(kind, index),
  }))
}

const buildingFragmentCatalog = Object.fromEntries(
  BUILDING_KINDS.map((kind) => [kind, buildKindFragments(kind)]),
) as Record<BuildingKind, readonly BuildingFragmentBlueprint[]>

function levelGrowth(level: BuildingLevel): number {
  return 1 + FRAGMENT_HEIGHT_GROWTH_PER_LEVEL * (level - 1)
}

// Uniform vertical scale from the fragment's local ground (y = 0). Ground parts
// stay grounded and grow taller; a part sitting on another part's top keeps
// resting on it, so rooftop attachments never sink into a taller body.
function enhancePart(
  part: BuildingVisualPart,
  level: BuildingLevel,
): BuildingVisualPart {
  const growth = levelGrowth(level)

  if (part.shape === 'box') {
    return {
      ...part,
      size: [part.size[0], part.size[1] * growth, part.size[2]],
      position: [part.position[0], part.position[1] * growth, part.position[2]],
    }
  }

  return {
    ...part,
    height: part.height * growth,
    position: [part.position[0], part.position[1] * growth, part.position[2]],
  }
}

function partTop(part: BuildingVisualPart): number {
  return part.shape === 'box'
    ? part.position[1] + part.size[1] / 2
    : part.position[1] + part.height / 2
}

function partHorizontalSpan(part: BuildingVisualPart): number {
  return part.shape === 'box'
    ? Math.min(part.size[0], part.size[2])
    : part.radius * 2
}

// Builds the level accent marker from the fragment's real apex (the tallest
// enhanced part), without assuming which part is a box.
function buildLevelMarker(
  parts: readonly BuildingVisualPart[],
  level: BuildingLevel,
  fragmentId: string,
): BoxVisualPart {
  const apex = parts.reduce((tallest, part) =>
    partTop(part) > partTop(tallest) ? part : tallest,
  )
  const markerHeight =
    FRAGMENT_MARKER_BASE_HEIGHT + FRAGMENT_MARKER_HEIGHT_PER_LEVEL * (level - 1)
  const top = partTop(apex)
  const footprint = Math.max(0.3, partHorizontalSpan(apex) * 0.7)

  return box(
    `${fragmentId}-level-marker`,
    [apex.position[0], top + markerHeight / 2, apex.position[2]],
    [footprint, markerHeight, footprint],
    'accent',
  )
}

function renderFragmentParts(
  blueprint: BuildingFragmentBlueprint,
  level: BuildingLevel,
): readonly BuildingVisualPart[] {
  const enhanced = blueprint.parts.map((part) => enhancePart(part, level))

  if (level <= 1) {
    return enhanced
  }

  return [...enhanced, buildLevelMarker(enhanced, level, blueprint.id)]
}

// Low construction pad shown for a fragment slot that the target level added but
// that has not been upgraded yet, mirroring the reference video scaffolding.
function buildScaffoldParts(
  blueprint: BuildingFragmentBlueprint,
): readonly BuildingVisualPart[] {
  const main = blueprint.parts[0]
  const centerX = main.position[0]
  const centerZ = main.position[2]
  const width = partHorizontalSpan(main) * 0.9
  const depth = (main.shape === 'box' ? main.size[2] : main.radius * 2) * 0.9
  const cornerX = width * 0.4
  const cornerZ = depth * 0.4

  return [
    box(
      `${blueprint.id}-scaffold-base`,
      [centerX, 0.2, centerZ],
      [width, 0.4, depth],
      'dark',
    ),
    cyl(
      `${blueprint.id}-scaffold-pole-1`,
      [centerX - cornerX, 0.55, centerZ - cornerZ],
      0.06,
      1.1,
      'roof',
    ),
    cyl(
      `${blueprint.id}-scaffold-pole-2`,
      [centerX + cornerX, 0.55, centerZ - cornerZ],
      0.06,
      1.1,
      'roof',
    ),
    cyl(
      `${blueprint.id}-scaffold-pole-3`,
      [centerX - cornerX, 0.55, centerZ + cornerZ],
      0.06,
      1.1,
      'roof',
    ),
    cyl(
      `${blueprint.id}-scaffold-pole-4`,
      [centerX + cornerX, 0.55, centerZ + cornerZ],
      0.06,
      1.1,
      'roof',
    ),
    box(
      `${blueprint.id}-scaffold-beam`,
      [centerX, 1.1, centerZ],
      [width, 0.12, 0.12],
      'accent',
    ),
  ]
}

export function getBuildingFragments(
  kind: BuildingKind,
): readonly BuildingFragmentBlueprint[] {
  return buildingFragmentCatalog[kind]
}

// Pure and deterministic in (kind, progress, animatedFragmentId): the same
// inputs always yield an equivalent result, so it is a good fit for useMemo in
// the render layer (memoize on those inputs; each call still returns a fresh
// array). `animatedFragmentId` is opt-in: with no id nothing animates, so a
// refresh never replays an entrance.
export function getRenderedBuildingFragments(
  kind: BuildingKind,
  progress: BuildingProgress,
  animatedFragmentId?: string,
): readonly RenderedBuildingFragment[] {
  const blueprints = buildingFragmentCatalog[kind]
  const level = progress.level
  const targetLevel = getTargetBuildingLevel(level)
  const completed =
    level === BUILDING_MAX_LEVEL
      ? 0
      : Math.max(
          0,
          Math.min(targetLevel, Math.trunc(progress.completedFragments)),
        )

  const toRendered = (
    blueprint: BuildingFragmentBlueprint,
    state: FragmentRenderState,
    parts: readonly BuildingVisualPart[],
  ): RenderedBuildingFragment => ({
    id: blueprint.id,
    name: blueprint.name,
    state,
    anchor: blueprint.anchor,
    parts,
    // Only a freshly completed slot (a target-form fragment) plays the entrance
    // animation; current/scaffold slots never animate even if their id is sent.
    animate:
      state === 'target' &&
      animatedFragmentId != null &&
      blueprint.id === animatedFragmentId,
  })

  if (completed === 0) {
    return blueprints
      .slice(0, level)
      .map((blueprint) =>
        toRendered(blueprint, 'current', renderFragmentParts(blueprint, level)),
      )
  }

  return blueprints.slice(0, targetLevel).map((blueprint, index) => {
    if (index < completed) {
      return toRendered(
        blueprint,
        'target',
        renderFragmentParts(blueprint, targetLevel),
      )
    }

    if (index < level) {
      return toRendered(
        blueprint,
        'current',
        renderFragmentParts(blueprint, level),
      )
    }

    return toRendered(blueprint, 'scaffold', buildScaffoldParts(blueprint))
  })
}
