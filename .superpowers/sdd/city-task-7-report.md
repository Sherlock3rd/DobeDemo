# City Task 7 实施报告

## 状态

已完成 App 最终切换、响应式样式、旧代码清理、session 文档与完整验收。未初始化 Git，未配置飞书 CLI。

## 复审 Minor 修正

- 将 `src/main.tsx` 在缺少挂载节点时的错误文案由旧主题更新为“无法启动工业城市 Demo：缺少 #root 挂载节点。”。
- 修正 HTTP 冒烟端口记录：启动时 5173 已被其他进程占用，本任务 Vite 因此使用 5174；HTTP 200 验证后，仅停止本任务进程树并确认本任务使用的 5174 已释放。未声称启动前 5173 无监听，也未处理占用 5173 的其他进程。
- 未调整相机、视觉构图或其他功能。
- 修正后复验：`npm.cmd run typecheck`、`npm.cmd run lint`、`npm.cmd run format:check`、`npm.cmd test` 全部退出码 0；全套测试仍为 **10 个测试文件、60 项测试全部通过**。

## 文件

- 创建 `src/App.test.tsx`
- 修改 `src/App.tsx`
- 替换 `src/App.css`
- 修改 `src/ui/CityHud.tsx`（新增 `city-hud__title`/`city-hud__hint` 结构 class，未改变行为）
- 修改 `src/ui/BuildingPanel.tsx`（新增 `building-panel__close`/`__title`/`__level`/`__description`/`__upgrade` 结构 class，未改变行为）
- 删除 `src/scene/DemoScene.tsx`
- 删除 `src/scene/RotatingCube.tsx`
- 删除 `src/store/useDemoStore.ts`
- 删除 `src/store/useDemoStore.test.ts`
- 删除 `src/ui/DemoHud.tsx`
- 删除 `src/ui/DemoHud.test.tsx`
- 创建 `session/requirements/city-building-upgrade-demo.md`
- 修改 `session/session.md`
- 创建 `.superpowers/sdd/city-demo-screenshot.png`（截图证据）
- 创建 `.superpowers/sdd/city-task-7-report.md`（本报告）

## App 集成 TDD

`src/App.test.tsx` 通过模块 mock 避免 jsdom WebGL：`@react-three/fiber` 的 `Canvas` mock 为捕获 props 的简单容器（暴露是否收到 `orthographic`）、`@react-three/drei` 的 `Loader` mock 为占位元素、`./scene/city/CityScene` mock 为占位元素；`beforeEach` 重置 `useCityStore`。

- **RED**：先创建测试文件，此时 `App.tsx` 仍引用旧 `DemoScene`（其内部使用未 mock 的 `OrbitControls`），运行 `npm.cmd test -- src/App.test.tsx` 结果为 **3 个测试文件内 3 项全部失败**——`AppErrorBoundary` 捕获渲染异常，页面仅显示"Demo 加载失败"兜底 UI，找不到"工业城改造计划"标题、`orthographic` prop 为 `undefined`、找不到"加油站"面板。证明当前 App 未接入城市场景。
- **GREEN**：切换 `App.tsx` 后重新运行同一命令，**3 项全部通过**：标题断言、`orthographic: true` 断言、预选 `gas-station` 后面板展示"加油站"与"等级 1 / 3"断言均通过。

## App.tsx

保留 `AppErrorBoundary` 与 `Loader`。结构改为 `Canvas`（`shadows`、`orthographic`、`camera` 使用 `CAMERA_CONFIG.position`/`initialZoom`、`dpr={[1, 1.75]}`）包裹 `Suspense` + `CityScene`，随后渲染 `Loader`（中文加载文案）、`CityHud`、`BuildingPanel`。未保留 `DemoScene`、`DemoHud` 或 glow 装饰的任何引用。

## App.css

整体改为桌面横屏工业城市控制台视觉：

- `.city-app` 全屏深蓝灰/工业灰渐变背景。
- `.city-app__canvas` 全屏绝对定位，`touch-action: none`。
- `.city-hud` 左上角，深色半透明面板，左侧窄黄色竖线，标题突出、提示文字紧凑。
- `.building-panel` 桌面态右侧垂直居中浮层，宽度 `min(320px, 100vw-1.5rem)`，深色半透明背景、边框、大阴影、`backdrop-filter: blur`；`building-panel__close` 命中区域 `2.5rem × 2.5rem`（40px+）位于右上角；`building-panel__upgrade` 暖黄色按钮，完整 hover/active/focus-visible/disabled 状态。
- 面板入场动画使用 `opacity`/`transform` 短促过渡，`@media (prefers-reduced-motion: reduce)` 下关闭全部动画与过渡。
- `<45rem`（720px 断点覆盖）：HUD 紧凑（缩小内边距与字号）；`.building-panel` 变为底部抽屉（`bottom: 0`，左右各 `12px`，`max-height: 55vh` 可滚动，顶部圆角），不遮满画面。
- 未引入远程字体资源，延续 `index.css` 的系统字体栈。

## 旧代码清理

删除 `DemoScene.tsx`、`RotatingCube.tsx`、`useDemoStore.ts`、`useDemoStore.test.ts`、`DemoHud.tsx`、`DemoHud.test.tsx` 六个文件后，对 `src` 全目录执行 `DemoScene|RotatingCube|DemoHud|useDemoStore|demo-app|demo-hud` 正则检索，结果为**零匹配**，确认无生产引用或残留旧文件/类名。

## 全量验证

在 `d:\charlie\dobe demo` 下依次执行，全部退出码 **0**：

| 命令 | 结果 |
|------|------|
| `npm.cmd run format` | 0，格式化 39 个文件（多数无变化） |
| `npm.cmd run typecheck` | 0，无输出 |
| `npm.cmd run lint` | 0，无输出 |
| `npm.cmd run format:check` | 0，"All matched files use Prettier code style!" |
| `npm.cmd test` | 0，**10 个测试文件、60 项测试全部通过** |
| `npm.cmd run build` | 0，产物 `dist/index.html`（0.39 kB）、`dist/assets/index-*.css`（4.44 kB）、`dist/assets/index-*.js`（1,108.61 kB，仅有 chunk 体积警告，非错误） |

测试计数说明：相较 Task 6 报告的 61 项（11 个文件），本任务删除 `useDemoStore.test.ts`、`DemoHud.test.tsx` 两个文件，新增 `App.test.tsx`（3 项），文件数净变化为 11 − 2 + 1 = 10，与本次实际运行输出的 10 个文件一致；测试项净变化后实际运行结果为 60 项，以本次真实运行输出为准。

## HTTP 冒烟

- 启动前检查未能证明 5173 空闲；实际启动 `npm.cmd run dev -- --host 127.0.0.1` 时，Vite 明确报告 **5173 已被其他进程占用**，因此本任务 Vite 自动改用 **5174** 并输出 `http://127.0.0.1:5174/`。
- `Invoke-WebRequest http://127.0.0.1:5174/` 返回 **`STATUS:200`**，响应 HTML 包含 `<div id="root">` 与 `<script type="module" src="/src/main.tsx">`，满足验收要求。
- 验证后依次终止本任务启动的 npm 包装进程（PID 53472）与实际监听 **5174** 的 Vite/Node 子进程（PID 59696），随后 `netstat` 复核 **5174 不再有 `LISTENING`**；本任务进程树与本任务使用的 5174 端口均已释放。未对占用 5173 的其他进程做任何处理。

## 截图

本机检测到 Chrome（`C:\Program Files\Google\Chrome\Application\chrome.exe`），使用无头模式：

```
chrome.exe --headless=new --disable-gpu --hide-scrollbars --window-size=1440,900 --screenshot="...\city-demo-screenshot.png" --virtual-time-budget=4000 "http://127.0.0.1:5174/"
```

截图成功生成于 `.superpowers/sdd/city-demo-screenshot.png`（约 102 KB）。人工核查截图内容：左上角 HUD 正确显示"工业城改造计划"标题与操作提示，正交俯视视角下可见六座建筑、道路网、河流、树木与静态车辆，构图与既往 Task 6 场景设计一致，未见渲染异常或裁切问题。

## Session

- 新建 `session/requirements/city-building-upgrade-demo.md`，状态"已完成"，记录参考图（`example/cityview.jpg`、`example/citystyle.jpg`）、六座建筑、三级外观、固定角度平移缩放镜头、非目标（无经济系统/多人协作/存档持久化、无后端账号数据库联网、无正式美术资源、不支持镜头旋转、未初始化 Git、未配置飞书 CLI），逐项登记测试/typecheck/lint/format check/build/HTTP 200 验收条件。
- 更新 `session/session.md`：当前目标改为交付工业城建筑互动升级 Demo；当前状态"已完成"；变更总账新增本次城市数据、状态、UI、模型、场景、镜头、集成与验证共 7 行；将历史"6 项测试"行更正为其最终实际"8 项测试（4 个测试文件）"，避免历史记录不一致。

## 自审与关注事项

- 已逐项核对任务清单中的创建/修改/删除文件均已落地，且 `AppErrorBoundary`、`Loader`、全局 `index.css` 未做超出布局最小必要调整的改动。
- `CityHud`/`BuildingPanel` 新增的结构 class 均为纯样式挂钩，未改变原有 `aria-label`、文案、事件处理逻辑；`BuildingPanel.test.tsx`、既有 CityHud 测试运行结果不受影响（已在全量测试中确认通过）。
- 构建输出存在单个 JS chunk 超过 500 kB 的提示性警告（非错误、非本任务范围要求的代码分割优化），如后续任务需要优化首屏体积可考虑动态 `import()` 或调整 `chunkSizeWarningLimit`。
- HTTP 冒烟时端口非 5173（被环境中另一无关进程占用），已按 Vite 实际输出的 5174 端口完成验证，未强制指定端口以避免与未知进程冲突。
- 无头截图为程序化验证附加证据，人工比对显示效果符合预期；但受限于运行环境，未做多分辨率/多浏览器交叉验证，若需更严格的视觉回归建议后续引入截图对比工具。
