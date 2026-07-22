# Task 5 实施报告

## 状态和文件

状态：完成。

已创建：

- `src/ui/AppErrorBoundary.test.tsx`
- `src/ui/AppErrorBoundary.tsx`
- `.superpowers/sdd/task-5-report.md`

未修改 App、入口、CSS、HUD、场景、store；未初始化 Git。

## RED

- 命令：`npm test -- src/ui/AppErrorBoundary.test.tsx`
- 退出码：`1`
- 预期失败：Vite 无法解析尚不存在的 `./AppErrorBoundary` 模块。
- 核心错误：`Error: Failed to resolve import "./AppErrorBoundary" from "src/ui/AppErrorBoundary.test.tsx". Does the file exist?`
- 结果：1 个测试文件失败，0 个测试被收集；失败原因与 brief 要求一致。确认 RED 后才创建 `AppErrorBoundary.tsx`。

## GREEN 与全套测试

- 单测命令：`npm test -- src/ui/AppErrorBoundary.test.tsx`
- 退出码：`0`
- 结果：1 个测试文件通过，2 个测试通过。
- 全套命令：`npm test`
- 退出码：`0`
- 结果：3 个测试文件通过，6 个测试通过。
- 测试输出无警告；抛错测试中 mock 了 `console.error`，`afterEach` 中 `vi.restoreAllMocks()` 已恢复，无 mock 污染。

实现包含：

- React class component `AppErrorBoundary`，接收 `children`
- 状态 `{ hasError: boolean }`，初始 `false`
- `static getDerivedStateFromError()` 返回 `{ hasError: true }`
- 正常时原样渲染 children
- 子组件抛错时显示 `role="alert"` 回退，含 `Demo 加载失败` 与刷新页面提示
- `className="app-error-boundary"` 供 Task 6 设置样式

## 静态验证

- `npm run typecheck`：退出码 `0`
- `npm run lint`：退出码 `0`

## 自审

- 严格执行 RED→GREEN：先写 2 个行为测试并确认模块缺失失败，再创建最小 class component。
- 测试覆盖 brief 要求的两项：正常 child 显示、抛错 child 显示 alert 与 `Demo 加载失败`。
- 未添加重试、日志上报或其他未要求功能；未吞掉正常 children。
- 变更范围仅限 brief 指定的两个生产/测试文件与报告。

## 关注事项

- 错误边界尚未接入应用入口，需由 Task 6 在 App 组装时包裹 HUD 与 3D 场景。
- 回退 UI 样式（`.app-error-boundary`）需由 Task 6 全局 CSS 完成。
- 仅覆盖渲染期抛错行为，未测试异步错误或事件处理器内抛错（brief 未要求）。
