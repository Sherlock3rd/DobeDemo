# City Task 4：建筑信息面板与城市 HUD

## 背景与约束

工作区：`d:\charlie\dobe demo`。城市 store、建筑目录已完成。本任务创建新 UI，但不修改 App、不删除旧 DemoHud（App 暂时依赖它）、不创建场景、不初始化 Git。严格 TDD。

## 文件

- 创建 `src/ui/BuildingPanel.tsx`
- 创建 `src/ui/BuildingPanel.test.tsx`
- 创建 `src/ui/CityHud.tsx`

## BuildingPanel 行为

- 无 selectedBuildingId 时返回 null。
- 根据 `buildingCatalogById` 显示建筑名称；其中 `Clubhouse` 保持用户指定的英文名称，其余五座显示中文名称。
- 显示 `等级 N / 3`。
- 显示当前等级对应的 `levelSummary[level - 1]`。
- 未满级按钮 aria-label 和可见文案均为 `升级到 N 级`。
- 点击升级后立即更新面板。
- 3 级按钮文案 `已满级` 且 disabled。
- 关闭按钮 aria-label `关闭建筑面板`，点击清除选择。
- 根节点 class `building-panel`，使用 `aria-labelledby`。
- 根节点 `onPointerDown` 与 `onClick` 都 stopPropagation，UI 操作不得触发外层场景点击。
- 目录缺失时安全返回 null。

## CityHud 行为

静态语义 section：

- 标题：`工业城改造计划`
- 操作提示：`拖拽平移 · 滚轮缩放 · 点击建筑升级`
- class `city-hud`

## TDD

先创建面板测试并确认模块不存在 RED。至少覆盖：

1. 未选中不渲染。
2. 选择加油站后显示标题、等级 1 和第一条说明。
3. 点击 `升级到 2 级` 后显示等级 2 与第二条说明。
4. 连续升级到 3 后按钮为 `已满级` 且 disabled。
5. 关闭按钮清除选择。
6. 在带父级 onClick spy 的容器中点击升级/关闭，父级 spy 不应调用，验证事件不穿透。

测试 beforeEach reset，console 无警告。

最终运行：

```powershell
npm.cmd test -- src/ui/BuildingPanel.test.tsx
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
```

## 报告

写入 `.superpowers/sdd/city-task-4-report.md`，包含 RED/GREEN、UI 测试数、全套测试、typecheck/lint、自审与关注事项。最终仅返回状态、验证摘要、关注事项。
