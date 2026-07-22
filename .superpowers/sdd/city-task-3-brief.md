# City Task 3：城市 Zustand 状态

## 背景与约束

工作区：`d:\charlie\dobe demo`。Task 1 已提供 `BUILDING_IDS`、`BuildingId`、`BuildingLevel`、`isBuildingId()` 与 `upgradeBuildingLevel()`。本任务创建城市选择与升级状态。不要修改 UI/场景，不要删除旧 `useDemoStore`（旧旋转方块暂时仍依赖它），不要初始化 Git。严格 TDD。

## 文件

- 创建 `src/store/useCityStore.ts`
- 创建 `src/store/useCityStore.test.ts`

## 接口

```ts
export type BuildingLevels = Record<BuildingId, BuildingLevel>

interface CityState {
  selectedBuildingId: BuildingId | null
  buildingLevels: BuildingLevels
  selectBuilding: (id: BuildingId) => void
  clearSelection: () => void
  upgradeBuilding: (id: string) => void
  reset: () => void
}

export const createInitialBuildingLevels: () => BuildingLevels
export const useCityStore: UseBoundStore<StoreApi<CityState>>
```

## 行为

- 初始 selectedBuildingId 为 null。
- 六座建筑初始全部 1 级。
- selectBuilding 选择或切换稳定 ID。
- clearSelection 恢复 null。
- upgradeBuilding 只升级目标建筑，使用 `upgradeBuildingLevel`，3 级保持 3。
- `upgradeBuilding('unknown')` 不改变 state 对象内容。
- reset 恢复初始选择与六个等级，并生成新的 levels 对象。

## TDD

先创建测试并运行确认模块缺失 RED。至少覆盖：

1. 六座建筑均从 1 级开始。
2. 选择、切换、清除。
3. 单次升级只影响目标建筑。
4. 连续升级到 3 后保持 3。
5. 未知 ID 不改变任何等级与选择。
6. reset 恢复全部初始值。
7. 每个测试通过 beforeEach reset 隔离，至少一个测试以非默认状态结束，使隔离可观察。

再实现最小 store。

最终运行：

```powershell
npm.cmd test -- src/store/useCityStore.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
```

## 报告

写入 `.superpowers/sdd/city-task-3-report.md`，包含 RED/GREEN、测试数、全套测试、typecheck/lint、自审与关注事项。最终只返回状态、验证摘要、关注事项。
