# Layout Task 1：共享布局几何规则

## 范围

工作区：`d:\charlie\dobe demo`。只创建共享几何纯函数和测试，并把 `cityLayout.test.ts` 的重复 AABB 计算迁移过去。不要调整任何 placement 坐标，不实现拖动，不提交 Git。

## 接口

创建 `src/game/placementGeometry.ts`：

```ts
export interface PlacementAabb {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export function getPlacementAabb(placement: CityPlacement): PlacementAabb
export function getInteractiveBuildingPlacement(
  building: InteractiveBuildingPlacement,
): CityPlacement
export function aabbsOverlapWithClearance(
  first: PlacementAabb,
  second: PlacementAabb,
  clearance: number,
): boolean
export function aabbContains(
  container: PlacementAabb,
  contained: PlacementAabb,
): boolean
export function isAabbInsideBounds(
  aabb: PlacementAabb,
  bounds: typeof CITY_BOUNDS,
): boolean
```

规则：

- 旋转 AABB：projected width=`w*abs(cos)+d*abs(sin)`，depth=`w*abs(sin)+d*abs(cos)`。
- building placement 使用 catalog footprint × `BUILDING_RENDER_SCALE`，保留 position/rotation。
- clearance 负数、NaN 规范为 0。
- 两个 AABB 的轴向边界间距小于指定 clearance 时返回 true；刚好满足 clearance 返回 false。
- `aabbContains` 边界相等视为包含。
- `isAabbInsideBounds` 边界相等视为位于城市内。

## TDD

先创建 `placementGeometry.test.ts`，覆盖：

- 0°、90°、任意角旋转。
- interactive building 实际尺寸。
- 正面积重叠。
- 相切：clearance 0 时不重叠；clearance >0 时判冲突。
- 实际 gap 小于/等于/大于 clearance。
- NaN/负 clearance。
- contains 和 city bounds 边界。

先运行模块缺失 RED，再实现。

修改 `cityLayout.test.ts`：

- 删除本地 `getPlacementAabb`。
- `aabbsHavePositiveOverlap` 改用共享模块，保持现有环境仓库测试语义。
- 不改当前坐标和既有 expected positions。

验证：

```powershell
npm.cmd test -- src/game/placementGeometry.test.ts src/game/cityLayout.test.ts
npm.cmd run typecheck
npm.cmd run lint
```

报告写 `.superpowers/sdd/layout-task-1-report.md`，包含 RED/GREEN、测试数、边界说明和自审。最终仅返回状态、摘要、关注事项。
