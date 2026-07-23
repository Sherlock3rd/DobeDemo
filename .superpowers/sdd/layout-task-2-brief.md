# Layout Task 2：严格碰撞矩阵与城市重排

## 范围

工作区：`d:\charlie\dobe demo`。Task1 几何工具已完成。本任务只修改 `src/game/cityLayout.ts` 与 `.test.ts`，建立严格建筑区域矩阵并重排 placement。不要实现拖动，不改建筑尺寸/catalog/视觉，不 commit/push。

## 固定间距

```ts
export const LOT_ROAD_CLEARANCE = 0.35
export const LOT_CLEARANCE = 0.25
export const BUILDING_STATIC_CLEARANCE = 0.2
```

如放在 `cityLayout.ts`，测试从生产代码导入。不要在测试复制不同数字。

## 碰撞矩阵

使用 Task1：

- `getPlacementAabb`
- `getInteractiveBuildingPlacement`
- `aabbsOverlapWithClearance`
- `aabbContains`
- `isAabbInsideBounds`

增加收集式测试，一次列出全部 label，不在首个失败处中止：

1. 每个 interactive building footprint ↔ 每条 road：clearance 0.35。
2. 每个 building footprint ↔ 每段 river：0.35。
3. 每个 building footprint ↔ 每棵 tree/每辆 vehicle：0.2。
4. 每个 lot ↔ road/river：0.35。
5. lot ↔ 其他 lot：0.25。
6. lot ↔ environment building：0.35。
7. environment ↔ road/river/building/other environment：至少不得正面积重叠（clearance 0）。
8. 每个 building footprint、lot、environment AABB 在 CITY_BOUNDS 内。
9. 对应 lot 必须 `aabbContains(lotAabb, buildingAabb)`，且中心一致。

车辆允许和道路重叠；道路允许彼此相交。tree 与 road 不作为错误。

失败消息格式至少包含 `building recycling-yard vs road 2` 之类双方标识。

## RED

先在当前坐标上加入 building/lot ↔ road 检查并运行。报告实际冲突，预期至少：

- recycling-yard
- metalworking-plant
- repair-shop
- commercial-street

确认 RED 后再改坐标。

## 候选重排

建筑与 lot 同中心：

```ts
recycling-yard: [-6, 0, -4]
metalworking-plant: [-6, 0, -10.5]
clubhouse: [7, 0, -7]
repair-shop: [-8, 0, 4]
gas-station: [-12, 0, 10.5]
commercial-street: [6.8, 0, 6]
```

lot 保留现有 size，更新中心。

道路：

```ts
{ position: [0, 0, 0], size: [36, 1.5] }
{ position: [0, 0, 0], size: [1.5, 28] }
{ position: [-15, 0, -3], size: [1.5, 6] }
{ position: [14, 0, 3], size: [1.5, 6] }
```

支路必须与中央十字路连接，并避开地块。

建议环境起点（可按矩阵做最小调整）：

```ts
[-14, 0, -12.5] size [3,3]
[7, 0, -12.5] size [3,2]
[7, 0, 12] size [3,3]
[-15, 0, 5] size [3,4]
[-17, 0, 13] size [2,2]
[16.5, 0, 8] size [2.5,3]
[-4, 0, 12] size [4,3]
[15, 0, 12] size [4,4]
```

树建议迁移：

```ts
[-17,0,-8], [-17,0,9], [-8,0,12], [12,0,-13], [2,0,-12],
[10,0,-11], [4,0,1], [17,0,2], [4,0,12], [12,0,12]
```

车辆保留中央道路上的安全项；原 `[1,0,5]`、`[5,0,7]`、`[12,0,9]` 需迁到新的主路或支路，并避开 building footprint。

## 保留测试

- 六个 ID 恰好一次。
- expected positions 更新为最终精确坐标。
- 道路中央十字 + 至少两条连接支路。
- 右侧河流规则。
- camera position/zoom/pan bounds。
- 8 个环境仓库、至少 6 辆车/6 棵树。

## 验证

```powershell
npm.cmd test -- src/game/cityLayout.test.ts
npm.cmd test -- src/game
npm.cmd run typecheck
npm.cmd run lint
```

报告写 `.superpowers/sdd/layout-task-2-report.md`，包含 RED 的全部冲突、最终坐标、矩阵覆盖、测试数、自审。最终仅返回状态、摘要、关注事项。
