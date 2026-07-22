# Task 6：组装应用、样式与最终验证

## 项目背景

当前已有：

- `DemoScene`：基础 3D 场景，不含 Canvas。
- `DemoHud`：暂停/继续交互。
- `AppErrorBoundary`：渲染错误回退。
- 全套 6 个行为测试。

本任务组装浏览器应用、完成响应式样式、执行全量质量检查和开发服务器 HTTP 冒烟，并更新 session。

## 全局约束

- 工作区：`d:\charlie\dobe demo`
- Windows PowerShell。
- 不初始化 Git，不执行 Git 提交。
- 不配置飞书 CLI。
- 不实现具体游戏玩法、后端或正式美术。
- 不改已确认的组件接口；发现问题先以最小修复处理并在报告说明。

## 文件

- 创建 `src/App.tsx`
- 创建 `src/App.css`
- 创建 `src/index.css`
- 创建 `src/main.tsx`
- 可创建 `.prettierignore`，用于保护归档规范、治理文档和 `.superpowers` 交接文件不被自动重排
- 修改 `session/session.md`
- 修改 `session/requirements/web-3d-demo-environment.md`

## 应用组装

`src/App.tsx`：

- 导入 `Canvas`、React `Suspense`、Drei `Loader`、`DemoScene`、`DemoHud`、`AppErrorBoundary` 和 CSS。
- `AppErrorBoundary` 包裹整个应用内容。
- 主容器为全屏应用外壳。
- `Canvas` 开启 shadows；相机 `position: [4, 3, 6]`，使用合理 fov。
- Canvas 内以 `Suspense fallback={null}` 包裹 `DemoScene`。
- 页面层包含 Drei `Loader`，资源加载时显示明确进度。
- `DemoHud` 与 Canvas 并列覆盖显示。
- 可添加少量纯装饰元素，但不得增加玩法或新状态。

`src/main.tsx`：

- 导入 `StrictMode`、`createRoot`、`App` 与 `index.css`。
- 从 `#root` 获取节点；节点缺失时抛出含义明确的错误。
- 使用 `StrictMode` 挂载 `<App />`。

## 样式

`src/index.css`：

- 设置 box-sizing、全局字体、颜色方案。
- `html`、`body`、`#root` 全尺寸，body 无 margin 且 overflow hidden。
- 提供可读的按钮字体继承和基础渲染设置。

`src/App.css`：

- 深蓝黑背景，黄色强调色。
- Canvas 全屏。
- HUD 左上角半透明深色面板，清楚显示标题、状态和按钮。
- 状态应有明显视觉提示。
- 按钮具备 hover、active、focus-visible 状态；focus 不得仅靠颜色。
- `.app-error-boundary` 有可读的错误回退样式。
- 小屏幕使用媒体查询确保 HUD 不超出视口。
- 避免大段动画，仅允许不妨碍阅读的轻量入场或环境装饰。

## 格式保护

如果 `npm run format` 会改写 `spec/`、`rules/`、`session/`、`mistakes/`、`docs/` 或 `.superpowers/` 中的 Markdown，创建 `.prettierignore` 忽略这些文档目录，但不得忽略 `src/` 和根目录代码配置。随后运行格式化。

## 自动化验证

依次运行：

```powershell
npm run format
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

每个命令退出码必须为 0；记录测试通过数量和构建产物摘要。

## 开发服务器冒烟

- 启动 `npm run dev -- --host 127.0.0.1`。
- 等待 Vite 输出本地 URL。
- 使用 HTTP 请求访问实际 URL，必须返回 200，HTML 必须包含 `#root` 挂载节点或应用入口。
- 验证后停止本任务启动的开发服务器，不能留下后台进程。
- 记录 URL、HTTP 状态及停止结果。

## 状态更新

`session/session.md`：

- 将当前环境部署状态更新为“已完成”。
- 变更总账记录治理文件、工程配置、store、HUD、场景、错误边界、应用组装和验证结果。

`session/requirements/web-3d-demo-environment.md`：

- 状态更新为“已完成”。
- 验收项逐项记录 typecheck、lint、format check、测试、生产构建和 HTTP 200。
- 明确未初始化 Git、未配置飞书 CLI。

## 最终范围核查

- `rules/`、`session/`、`mistakes/`、`spec/`、`docs/` 均存在。
- 根目录不残留三份旧规范。
- 不存在 `.git/`。
- 不存在误创建的后端、账号、数据库或联网功能。

## 报告

写入 `.superpowers/sdd/task-6-report.md`：

- 状态与创建/修改文件
- 每个验证命令、退出码、摘要
- HTTP 冒烟 URL、状态码和进程停止结果
- 最终范围核查
- 自审与关注事项

最终回复只返回状态、一行全量验证摘要和关注事项。
