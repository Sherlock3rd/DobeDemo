# City Task 7：应用集成、样式与完整验收

## 背景与约束

工作区：`d:\charlie\dobe demo`。新城市场景、HUD、建筑面板、store 已完成；当前 App 仍显示旧旋转方块。本任务完成最终切换、响应式视觉、旧代码清理、session 与完整验证。不要初始化 Git，不配置飞书 CLI。

## 文件

- 创建 `src/App.test.tsx`
- 修改 `src/App.tsx`
- 替换 `src/App.css`
- 删除 `src/scene/DemoScene.tsx`
- 删除 `src/scene/RotatingCube.tsx`
- 删除 `src/store/useDemoStore.ts`
- 删除 `src/store/useDemoStore.test.ts`
- 删除 `src/ui/DemoHud.tsx`
- 删除 `src/ui/DemoHud.test.tsx`
- 创建 `session/requirements/city-building-upgrade-demo.md`
- 修改 `session/session.md`

保留 `AppErrorBoundary`、`Loader`、全局 `index.css`，除非为新布局做最小必要调整。

## App 集成 TDD

先创建 `src/App.test.tsx`，使用模块 mock 避免 jsdom WebGL：

- mock `@react-three/fiber` Canvas 为简单容器，并暴露是否收到 `orthographic`。
- mock `CityScene` 为占位元素。
- mock Drei `Loader` 为占位元素。
- beforeEach reset `useCityStore`。

测试至少覆盖：

1. App 显示 `工业城改造计划`，不再显示 `Web 3D Demo Workspace`。
2. Canvas 接收 orthographic。
3. 预先选择 `gas-station` 后，App 中显示 `加油站` 与 `等级 1 / 3`，证明 BuildingPanel 已接入。

先运行当前 App，确认至少城市 HUD 断言 RED，再修改 App。

## App.tsx

保留 `AppErrorBoundary` 与 Loader。结构：

```tsx
<main className="city-app">
  <Canvas
    className="city-app__canvas"
    shadows
    orthographic
    camera={{
      position: CAMERA_CONFIG.position,
      zoom: CAMERA_CONFIG.initialZoom,
      near: 0.1,
      far: 200,
    }}
    dpr={[1, 1.75]}
  >
    <Suspense fallback={null}>
      <CityScene />
    </Suspense>
  </Canvas>
  <Loader ...中文加载文案... />
  <CityHud />
  <BuildingPanel />
</main>
```

不得保留 DemoScene、DemoHud 或 glow 装饰的旧引用。

## App.css

整体目标：桌面横屏工业城市控制台，不是通用模板页。

- `.city-app` 全屏，深蓝灰/工业灰背景。
- Canvas 全屏且 touch-action none。
- `.city-hud` 左上，深色半透明面板，窄黄色顶线或侧线。
- HUD 标题突出，提示文字紧凑可读。
- `.building-panel` 右侧垂直居中或右上，宽度约 320px，深色半透明背景、边框、阴影、轻微 backdrop blur。
- 面板标题、等级 badge、说明和升级按钮有清晰层级。
- 关闭按钮位于右上角，命中区域至少 40px。
- 升级按钮暖黄色，hover/active/focus-visible/disabled 完整。
- 面板出现可使用短促 opacity/translate 动画；尊重 `prefers-reduced-motion`。
- 小于 720px：HUD 紧凑；BuildingPanel 变为底部抽屉，左右留 12px，不遮满画面，高度可滚动。
- 使用现有 className；如必要可给 UI 组件增加少量结构 class，但不得改行为。
- 字体不请求远程资源。

## 删除旧 Demo

App 切换成功后删除六个旧 Demo 文件。使用 Glob/rg 确认没有 `DemoScene`、`RotatingCube`、`DemoHud`、`useDemoStore` 的生产引用或旧文件。

## Session

创建 `session/requirements/city-building-upgrade-demo.md`：

- 状态“已完成”。
- 记录参考图、六座建筑、三级外观、固定角度平移缩放镜头、非目标。
- 逐项登记测试、typecheck、lint、format check、build、HTTP 200。
- 记录未初始化 Git、未配置飞书 CLI。

更新 `session/session.md`：

- 当前目标改为城市建筑互动升级 Demo。
- 当前状态“已完成”。
- 变更总账新增本次城市数据、状态、UI、模型、场景、镜头、集成与验证。
- 将旧环境交付行的“6 项测试”纠正为其最终实际 8 项，避免历史记录不一致。

## 全量验证

```powershell
npm.cmd run format
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run build
```

全部退出码 0。记录测试文件数/测试数和构建产物。

## HTTP 冒烟

- 检查无现有 Vite server。
- 启动 `npm.cmd run dev -- --host 127.0.0.1`。
- 访问实际 `http://127.0.0.1:<port>/`，HTTP 200，HTML 包含 `#root` 和 `/src/main.tsx`。
- 停止本任务启动的完整进程树并确认端口释放。

如果本机 Edge/Chrome 可用，可额外用 headless 模式截取桌面截图到 `.superpowers/sdd/city-demo-screenshot.png`；截图失败不阻断自动化验收，但必须报告。

## 报告

写入 `.superpowers/sdd/city-task-7-report.md`，包含 App RED/GREEN、文件、旧代码清理、全部命令、测试计数、build、HTTP/端口、截图状态、session、自审与关注事项。最终只返回状态、全量验证摘要、关注事项。
