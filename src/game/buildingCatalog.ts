import {
  BUILDING_IDS,
  type BuildingDefinition,
  type BuildingId,
} from './cityTypes'

export const buildingCatalog: readonly BuildingDefinition[] = [
  {
    id: 'repair-shop',
    name: '修车厂',
    kind: 'repair',
    footprint: [16, 12],
    primaryColor: '#37434a',
    accentColor: '#58a6a6',
    levelSummary: [
      '单跨维修棚和室外零件架',
      '双工位车间配起重机与排气管',
      '多跨检修大厅配屋顶机械平台',
    ],
  },
  {
    id: 'recycling-yard',
    name: '废车回收厂',
    kind: 'recycling',
    footprint: [18, 14],
    primaryColor: '#48515a',
    accentColor: '#d9822b',
    levelSummary: [
      '开放式废车堆场与单臂抓机',
      '增设压块车间和双层废料货架',
      '封闭式分拣主楼配大型磁吸吊机',
    ],
  },
  {
    id: 'commercial-street',
    name: '商业街',
    kind: 'commercial',
    footprint: [28, 20],
    primaryColor: '#50575c',
    accentColor: '#c49a52',
    levelSummary: [
      '沿街单层商铺与装卸后巷',
      '两层商业街配连廊和广告牌',
      '商业街综合楼群配中央灯塔',
    ],
  },
  {
    id: 'metalworking-plant',
    name: '金属加工厂',
    kind: 'metalworking',
    footprint: [24, 16],
    primaryColor: '#394651',
    accentColor: '#e0b43c',
    levelSummary: [
      '低矮加工车间、基础熔炉与材料堆',
      '扩建冲压车间、增加烟囱与吊装架',
      '大型金属加工主楼、双炉体、重型天车与高烟囱',
    ],
  },
  {
    id: 'gas-station',
    name: '加油站',
    kind: 'gas',
    footprint: [14, 10],
    primaryColor: '#60666b',
    accentColor: '#d94a3d',
    levelSummary: [
      '双泵岛与短跨金属顶棚',
      '四泵岛配便利店和价格立柱',
      '重型车辆加注区配高耸储油标识',
    ],
  },
  {
    id: 'clubhouse',
    name: 'Clubhouse',
    kind: 'clubhouse',
    footprint: [13, 11],
    primaryColor: '#34383c',
    accentColor: '#c66b43',
    levelSummary: [
      '砖墙会所与简易门廊',
      '增建二层露台和霓虹招牌',
      '完整工业风会馆配屋顶观景台',
    ],
  },
]

export const buildingCatalogById: Readonly<
  Record<BuildingId, BuildingDefinition>
> = Object.fromEntries(
  buildingCatalog.map((building) => [building.id, building]),
) as Record<BuildingId, BuildingDefinition>

export function isBuildingId(value: string): value is BuildingId {
  return BUILDING_IDS.some((id) => id === value)
}
