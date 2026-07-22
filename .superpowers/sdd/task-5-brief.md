# Task 5：以 TDD 实现应用错误边界

## 项目背景

HUD 与 3D 场景组件已完成。本任务只实现 React 渲染错误边界，为后续应用组装提供可读回退。

## 全局约束

- 工作区：`d:\charlie\dobe demo`
- 不初始化 Git，不执行 Git 提交。
- 不配置飞书 CLI。
- 严格执行 RED→GREEN：先创建测试并确认因模块不存在失败，再创建生产实现。
- 不创建或修改 App、入口、CSS、HUD、场景和 store。

## 文件

- 创建 `src/ui/AppErrorBoundary.test.tsx`
- 创建 `src/ui/AppErrorBoundary.tsx`

## 接口与行为

- 导出 React class component `AppErrorBoundary`。
- 接收 `children`。
- 状态结构为 `{ hasError: boolean }`，初始为 `false`。
- `static getDerivedStateFromError()` 返回 `{ hasError: true }`。
- 正常时原样渲染 children。
- 子组件渲染抛错时，显示带 `role="alert"` 的回退区域。
- 回退内容必须包含 `Demo 加载失败`，并提供简短、可读的刷新页面提示。
- 提供 className 供 Task 6 设置样式。

## RED

先创建测试，至少覆盖：

1. 正常 child 能正常显示。
2. 抛错 child 被捕获，显示 `role="alert"` 与 `Demo 加载失败`。

抛错测试中临时 mock `console.error`，并确保每个测试后恢复 mock，避免污染其他测试。

运行：

```powershell
npm test -- src/ui/AppErrorBoundary.test.tsx
```

确认因 `AppErrorBoundary` 模块不存在失败；报告记录命令、退出码和核心错误。

## GREEN

创建最小 class component 实现，使两个测试通过。错误边界不得吞掉正常 children，不添加重试、日志上报或其他未要求功能。

## 验证

运行并记录：

```powershell
npm test -- src/ui/AppErrorBoundary.test.tsx
npm test
npm run typecheck
npm run lint
```

全部必须通过，测试输出不得留下未处理错误或 mock 污染警告。

## 报告

写入 `.superpowers/sdd/task-5-report.md`：

- 状态与创建文件
- RED 命令、退出码和预期失败证据
- GREEN 目标测试与全套测试数量
- typecheck、lint 结果
- 自审和关注事项

最终回复只返回状态、一行验证摘要和关注事项。
