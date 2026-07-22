# City Task 2：城市布局与镜头配置

## 背景与约束

工作区：`d:\charlie\dobe demo`。任务 1 已提供 `BuildingId` 和六座建筑目录。本任务只创建静态城市布局数据与测试，不创建 React/R3F 组件。布局参考 `example/cityview.jpg`：道路十字、右上河流、六座互动建筑相对分区。不要初始化 Git。

## 文件

- 创建 `src/game/cityLayout.ts`
- 创建 `src/game/cityLayout.test.ts`

## 接口

```ts
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

export const CITY_BOUNDS = { minX: -18, maxX: 18, minZ: -14, maxZ: 14 } as const

export const CAMERA_CONFIG = {
  position: [24, 28, 30] as const,
  target: [0, 0, 0] as const,
  initialZoom: 22,
  minZoom: 16,
  maxZoom: 34,
  panBounds: { minX: -8, maxX: 8, minZ: -6, maxZ: 6 },
} as const
```

必须导出：

- `interactiveBuildingPlacements`
- `roadPlacements`
- `lotPlacements`
- `riverPlacements`
- `environmentBuildingPlacements`
- `vehiclePlacements`
- `treePlacements`

互动建筑精确位置：

```ts
[
  { id: 'recycling-yard', position: [-11, 0, -8], rotation: 0 },
  { id: 'logistics-center', position: [-2, 0, -9], rotation: 0 },
  { id: 'clubhouse', position: [7, 0, -7], rotation: 0 },
  { id: 'repair-shop', position: [-11, 0, 0], rotation: 0 },
  { id: 'gas-station', position: [-5, 0, 8], rotation: 0 },
  { id: 'commercial-district', position: [8, 0, 4], rotation: 0 },
]
```

道路形成横纵主干道与至少两条支路；河流在右上边缘；环境建筑不得占用互动建筑中心。静态车辆、树木均至少 6 个。

## TDD

先写测试并确认模块不存在 RED。至少覆盖：

- 互动建筑 ID 与 `BUILDING_IDS` 完全一致、无重复。
- 所有互动建筑位置落在 `CITY_BOUNDS`。
- 道路、地块、河流、环境建筑、车辆、树木数组非空。
- 道路至少 4 段、车辆和树木各至少 6 个。
- `minZoom < initialZoom < maxZoom`。
- panBounds 完全位于 CITY_BOUNDS 内。
- 河流所有 position.x 为正且 position.z 为负，符合右上区域约定（本场景负 z 为上方）。

再实现最小完整布局并通过。

最终运行：

```powershell
npm.cmd test -- src/game/cityLayout.test.ts
npm.cmd test -- src/game
npm.cmd run typecheck
npm.cmd run lint
```

## 报告

写入 `.superpowers/sdd/city-task-2-report.md`，包含状态、文件、RED/GREEN、数组数量、测试数量、typecheck/lint、自审与关注事项。最终仅返回状态、验证摘要、关注事项。
