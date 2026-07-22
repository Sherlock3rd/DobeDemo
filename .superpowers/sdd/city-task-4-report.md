# City Task 4 实施报告

## 状态

已完成建筑信息面板与城市 HUD。新增：

- `src/ui/BuildingPanel.tsx`
- `src/ui/BuildingPanel.test.tsx`
- `src/ui/CityHud.tsx`

未修改 `App`、场景、旧 `DemoHud`，未初始化 Git。

## TDD 记录

### RED

1. 先创建 `BuildingPanel.test.tsx`，运行定向测试，因 `./BuildingPanel` 模块不存在而按预期失败。
2. 面板测试 GREEN 后，先加入 `CityHud` 语义测试，再运行定向测试，因 `./CityHud` 模块不存在而按预期失败。

### GREEN

1. 创建最小 `BuildingPanel` 实现后，定向测试 7/7 通过。
2. 创建最小 `CityHud` 实现后，定向 UI 测试 8/8 通过。

## 覆盖范围

UI 测试共 8 条：

- 无选择时不渲染。
- 选择加油站后显示中文标题、等级 1、第一条等级说明。
- 升级后立即显示等级 2、第二条等级说明及下一等级按钮文案。
- 连续升级到等级 3 后显示第三条说明，按钮为“已满级”且禁用。
- 关闭按钮清除选择并关闭面板。
- 升级与关闭的 pointer/click 事件均不穿透父级场景容器。
- 目录缺少所选建筑时安全返回 null。
- 城市 HUD 显示规定标题、操作提示与 `city-hud` class。

定向测试输出无 React/console 警告。

## 最终验证

- `npm.cmd test -- src/ui/BuildingPanel.test.tsx`：通过，1 个测试文件、8 条测试。
- `npm.cmd test`：通过，9 个测试文件、43 条测试。
- `npm.cmd run typecheck`：通过。
- `npm.cmd run lint`：通过。
- 编辑器诊断：新增与修改文件无 linter 错误。

## 自审

- `BuildingPanel` 根节点使用 `building-panel` 和 `aria-labelledby`。
- 未满级按钮的可见文案与 aria-label 一致；满级状态禁用。
- 根节点同时拦截 `onPointerDown` 与 `onClick` 冒泡。
- 建筑目录读取有缺失保护。
- 仅实现任务要求，未接入应用入口或场景。

## 关注事项

- 按任务约束，新组件尚未挂载到 `App`，当前应用运行时不会显示它们；需由后续集成任务接入。
- 本任务未要求新增样式，组件只提供约定 class 作为后续样式挂钩。

## 后续澄清与 Minor 修复

- 目录命名已澄清：`Clubhouse` 保持用户原始指定的英文显示名称，其余五座建筑使用中文名称；无需修改建筑目录或生产面板。
- 满级测试现同时明确断言按钮可访问名称为 `已满级`、可见文本为 `已满级`，并且按钮处于 disabled 状态。
- 复验 `npm.cmd test -- src/ui/BuildingPanel.test.tsx`：通过，1 个测试文件、8 条测试。
- 复验 `npm.cmd test`：通过，9 个测试文件、43 条测试。
- 复验 `npm.cmd run typecheck`：通过。
- 复验 `npm.cmd run lint`：通过。
