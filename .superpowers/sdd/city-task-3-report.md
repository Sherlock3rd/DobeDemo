# City Task 3 报告：Zustand 城市状态

## 状态

已完成 `useCityStore` 及其测试。保留旧 `useDemoStore`，未修改 UI/场景，未初始化 Git。

## TDD 记录

### RED

- 先创建 `src/store/useCityStore.test.ts`。
- 首次运行 `npm.cmd test -- src/store/useCityStore.test.ts`：
  - 退出码：1
  - 结果：1 个测试文件失败、0 个测试执行
  - 预期失败原因：无法解析尚未创建的 `./useCityStore` 模块。

### GREEN

- 创建最小实现 `src/store/useCityStore.ts`。
- 首次 GREEN 运行：
  - 1 个测试文件通过
  - 7 个测试通过
- 覆盖初始六建筑等级、选择/切换/清除、单建筑升级、3 级封顶、未知 ID 无状态变更、reset 新建等级对象，以及 `beforeEach reset` 隔离。

## 最终验证

- `npm.cmd test -- src/store/useCityStore.test.ts`：通过，1 个文件、7 个测试。
- `npm.cmd test`：通过，8 个文件、35 个测试。
- `npm.cmd run typecheck`：通过，退出码 0。
- `npm.cmd run lint`：通过，退出码 0。

## 自审

- `BuildingLevels`、`createInitialBuildingLevels` 与 `useCityStore` 按约定导出。
- 初始选择为 `null`，六座建筑均为 1 级。
- 升级复用 `upgradeBuildingLevel`，合法 ID 只替换目标等级。
- 未知 ID 返回原 state，不改变引用或内容。
- reset 恢复选择和等级，并创建新的 `buildingLevels` 对象。
- 未删除或修改旧 `useDemoStore`；未触碰 UI/场景文件；未执行 Git 初始化。

## 关注事项

- 当前任务仅提供状态层，按约束未接入 UI/场景。
- 无已知阻塞或失败验证。
