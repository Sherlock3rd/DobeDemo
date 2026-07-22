# Gang Task 5 报告：3D 锁定地块与 App 集成

## 状态

完成，并已修复审查提出的两项 Important。三组严格 TDD（`buildingAccess` 纯函数、`App.tsx` 集成、`BuildingVisual` 组件切换）均有 RED → GREEN 记录；场景切换由 `InteractiveBuilding` 实际调用的 `BuildingVisual` 组件负责，并由真实 gang store 的组件级测试覆盖。Task 1–4 遗留的 11 个文件已仅作 Prettier 机械格式化。`npm test`、`npm run typecheck`、`npm run lint`、全仓库 `npm run format:check` 全部通过。未执行任何 Git 初始化/提交操作，未做 session/HTTP 截图。

## 三组 RED/GREEN 记录

### 1. `buildingAccess`（纯呈现模式函数）

- RED：新增 `src/scene/city/buildingAccess.test.ts`（4 个 `describe` 用例，含 `it.each(BUILDING_UNLOCKS)` 参数化），运行时因 `./buildingAccess` 模块不存在，整个文件加载失败（0 测试执行，构建错误）。
- GREEN：新增 `src/scene/city/buildingAccess.ts`，仅调用既有 `getGangLevel` + `isBuildingUnlocked` 派生 `'locked' | 'unlocked'`，未重复任何等级/声望公式。9/9 用例通过，覆盖：
  - rep=0 时仅 `repair-shop` unlocked，其余 5 座建筑 locked；
  - 每座建筑在其 `requiredLevel` 对应声望阈值前一点 locked、达到阈值 unlocked（用 `getTotalReputationForLevel` 精确构造边界，`repair-shop` 阈值为 0 时跳过"前一点"分支）；
  - 超额声望（10000）下全部建筑 unlocked；
  - 未知建筑 ID 在任意声望下均 locked。

### 2. `App.tsx` 集成

- RED：重写 `src/App.test.tsx`，新增对 `./game/GangIdleController` 的 mock（渲染 `data-testid="gang-idle-controller-mock"` 占位节点，避免真实定时器）及 2 个新用例（挂载占位控制器、点击"打开帮派树"后出现 `role=dialog`+50 个 `listitem` 并可通过关闭按钮消失）与 1 个补充用例（初始未渲染对话框）。运行确认新增的 2 个断言失败（`mounts the gang idle controller placeholder…` 因找不到占位节点失败；`opens the gang tree dialog…` 因找不到 `role=dialog` 失败），原有 3 个用例（标题、正交相机、预选建筑面板）与新增的"未点击时无对话框"用例共 4 个继续通过。
- GREEN：修改 `src/App.tsx`：引入 `useState` 管理 `gangTreeOpen`，在 `main` 内按 brief 顺序渲染 `<GangIdleController />`、`<CityHud onOpenGangTree={...}>`、`<BuildingPanel />`、`<GangTreePanel open={gangTreeOpen} onClose={...}>`；`AppErrorBoundary`、`Canvas`（含正交相机配置）、`Loader` 均保留不变。6/6 用例通过。

### 3. `BuildingVisual` 组件级场景切换（审查修复）

- RED：先新增 `src/scene/city/BuildingVisual.test.tsx`，测试使用真实 `useGangStore`，只对重型 R3F 子组件 `BuildingModel`/`LockedBuildingPlot` 做可识别 mock。首次运行因 `./BuildingVisual` 尚不存在而加载失败，明确证明缺少实际组件选择层覆盖。
- GREEN：新增 `src/scene/city/BuildingVisual.tsx`，把 `InteractiveBuilding` 原有的 reputation 订阅、`getBuildingRenderMode` 判定及两种视觉分支小幅抽取到该组件；随后修改 `InteractiveBuilding`，在原命中盒/高亮/点击结构内实际渲染 `<BuildingVisual id={id} level={level} highlighted={highlighted} />`。3/3 组件测试通过，真实验证：
  - reputation=0 时 `repair-shop` 渲染 `BuildingModel`，不渲染 `LockedBuildingPlot`；
  - reputation=0 时 `recycling-yard` 渲染 `LockedBuildingPlot`，不渲染 `BuildingModel`；
  - 真实 gang store 达到 Lv.8 声望阈值后，`recycling-yard` 切换为 `BuildingModel`。

## 场景切换（InteractiveBuilding ↔ LockedBuildingPlot）

- 新增 `src/scene/city/LockedBuildingPlot.tsx`：接收城市渲染单位的 `footprint`（不再乘 `BUILDING_RENDER_SCALE`）与 `highlighted`；渲染低矮深灰施工地基（`boxGeometry`）、四角围栏立柱（`cylinderGeometry`）、两条交叉斜向警示条（`boxGeometry` + 45°旋转）、居中程序化锁形标识（1 个 box 锁体 + 3 个 cylinder 组成的 U 形锁扣，均为程序化几何体，无文字/外部资源）；`highlighted` 时锁体材质切换为暖黄色 emissive（`#ffb703`，强度 0.65），常态 emissive 为 `#000000`；所有 mesh 均 `castShadow`/`receiveShadow`；组件本身不绑定任何指针/点击事件。
- 新增 `src/scene/city/BuildingVisual.tsx` 并由 `InteractiveBuilding` 实际调用：组件订阅 `useGangStore.totalReputation`，通过 `getBuildingRenderMode(id, totalReputation)` 决定分支——`unlocked` 保持原 `scale(BUILDING_RENDER_SCALE)` 包裹的 `BuildingModel`；`locked` 渲染 `LockedBuildingPlot`（传入已缩放的 `renderedFootprint`）。`InteractiveBuilding` 原高亮底座 overlay、命中盒（`BUILDING_HITBOX_HEIGHT`）、`onClick`/`onPointerOver`/`onPointerOut`（含 hover 光标集合与 `selectBuilding`）逻辑完全未改动、不因锁定状态分支跳过，因此锁定地块保持可点击、可选中；升级操作仍只在 `BuildingPanel` 内触发（锁定态面板本就不渲染升级按钮，Task 4 已实现）。

## Prettier 历史文件修复（审查修复）

- 对先前导致全仓库 `format:check` 失败的 11 个 Task 1–4 文件执行定向 `prettier --write`，仅机械格式化，未修改行为：
  - `src/game/cityTypes.ts`
  - `src/game/GangIdleController.tsx`、`src/game/GangIdleController.test.tsx`
  - `src/game/gangProgression.ts`、`src/game/gangProgression.test.ts`
  - `src/store/useGangStore.ts`、`src/store/useGangStore.test.ts`
  - `src/ui/BuildingPanel.test.tsx`
  - `src/ui/CityHud.test.tsx`
  - `src/ui/GangTreePanel.tsx`、`src/ui/GangTreePanel.test.tsx`
- 格式化后全套 182 项测试、typecheck、lint 均通过，证明机械格式化未引入行为回归；全仓库 `format:check` 现为退出码 0。

## App 与 CSS 接线

- `App.tsx`：新增 `GangIdleController`、`GangTreePanel` 引入及 `gangTreeOpen` 状态；`CityHud` 的 `onOpenGangTree` 现接入真实的 `setGangTreeOpen(true)`。
- `App.css` 新增/调整：
  - HUD：`.city-hud__level`（等级，黄色强调）、`.city-hud__role`（职位中英文）、`.city-hud__progress-label`/`.city-hud__progress`（原生 `<progress>` 的 webkit/moz 伪元素着色）、`.city-hud__rate`（速率，绿色强调）、`.city-hud__open-gang-tree`（按钮，唯一 `pointer-events: auto`，其余 `.city-hud` 内文本保持 `pointer-events: none` 不阻断画布拖拽/缩放）。
  - `.gang-tree-panel__overlay`：`position: fixed; inset: 0`，`z-index: 20`（高于 `.building-panel` 的 `z-index: 3`），深色半透明 backdrop + blur。
  - `.gang-tree-panel`：`width: min(720px, 100%)`、`max-height: 90vh`、`overflow-y: auto`，深色工业风背景配 4px 黄色左边框 + 细描边。
  - `.gang-tree-panel__levels`/`__level`：纵向 50 节点列表，左侧竖线+圆点时间轴样式；`data-state` 三态样式（`completed` 绿色描边、`current` 黄色描边+外发光、`locked` 半透明降低不透明度）；`__level-role`（黄底职位徽章）与 `__level-building`（绿色描边建筑解锁徽章）视觉突出。
  - `.gang-tree-panel__close`：`min-width/height: 2.5rem`（40px），`:focus-visible` 有清晰描边。
  - `building-panel__lock-status`/`__lock-requirement`/`__lock-current`：锁定态 `BuildingPanel` 的"尚未解锁"徽章、需求、当前进度样式。
  - `@media (max-width: 45rem)`：`.gang-tree-panel__overlay` 无内边距，`.gang-tree-panel` 全屏（`width/height: 100%`、无圆角、`border-left: none`）；HUD 已有紧凑样式保持不变。
  - `@media (prefers-reduced-motion: reduce)`：新增 overlay/panel 入场动画与关闭按钮过渡的禁用规则，与既有 HUD/BuildingPanel 一并处理。

## 验证摘要

```
npm.cmd test -- src/scene/city/BuildingVisual.test.tsx src/scene/city/buildingAccess.test.ts src/App.test.tsx
  → 3 files / 18 tests passed

npm.cmd test
  → 17 files / 182 tests passed

npm.cmd run typecheck
  → 0 errors

npm.cmd run lint
  → 0 errors/warnings

npm.cmd run format:check
  → 退出码 0；All matched files use Prettier code style!
```

## 自审

- `getBuildingRenderMode` 未重复实现等级/解锁公式，纯转调 `getGangLevel`/`isBuildingUnlocked`；未知建筑 ID 会被 `isBuildingUnlocked` 的 `getBuildingUnlock` 查找返回 `null` 从而判定为 locked，符合 brief。
- `LockedBuildingPlot` 的 `footprint` 严格按"已是城市渲染单位"处理，组件内不出现任何 `BUILDING_RENDER_SCALE` 相关乘法；`InteractiveBuilding` 传入的是已乘过 `BUILDING_RENDER_SCALE` 的 `renderedFootprint`，与 unlocked 分支的 `BuildingModel`（在外层 `<group scale={BUILDING_RENDER_SCALE}>` 中，使用未缩放的原始 `definition.footprint` 语义）在视觉尺寸上保持一致。
- `InteractiveBuilding` 的命中盒、高亮底座 overlay、hover 状态集合（`hoveredBuildingIds`）与光标切换、`onClick`→`selectBuilding` 均位于实际调用的 `BuildingVisual` 之外，锁定/解锁状态切换不影响这些行为；未在任何位置引入基于锁定状态的升级调用。
- `BuildingVisual.test.tsx` 不重复断言 `buildingAccess` 纯函数返回值，而是渲染真实组件、使用真实 Zustand gang store，并检查最终选择的视觉子组件；三条要求中的 repair-shop 初始模型、recycling-yard 初始锁定、Lv.8 后切换模型均有独立断言。
- `App.tsx` 未删除或改动 `AppErrorBoundary`、`Canvas`（含 orthographic 相机配置）、`Loader` 的既有 props/结构；仅新增四个子组件的渲染与一个 `useState`。
- CSS 改动仅新增/追加规则块，未删除或覆盖原有 `.city-hud`/`.building-panel`/`.app-error-boundary` 既有声明；`.city-hud` 顶层 `pointer-events: none` 保持不变，新增文本类均未设置 `pointer-events`（继承 none），只有 `.city-hud__open-gang-tree` 显式设为 `auto`。
- 我创建的三个新文件（`buildingAccess.ts`、`buildingAccess.test.ts`、`LockedBuildingPlot.tsx`）最初以 CRLF 换行写入，被 `prettier --check` 检出；已用 `prettier --write` 仅对本任务的 5 个受影响文件（含 `App.css`、`App.test.tsx` 的换行/换行位置问题）定向格式化并复验通过，未触碰其他任务文件。

## 关注事项

- `LockedBuildingPlot` 的锁形图标与警示条尺寸/位置基于各建筑 `footprint` 等比例估算（未针对每座建筑单独调参），不同建筑（如 13×11 的 Clubhouse 与 28×20 的商业街）锁定地块的视觉密度会有差异，但均满足"低矮地基+四角围栏/警示条+居中暖黄锁形标识"的呈现要求；如需更精细的按建筑定制视觉，可作为后续美术优化任务。
- 组件级测试按审查允许的稳定方案测试由 `InteractiveBuilding` 实际调用的 `BuildingVisual`，避免在 React DOM 中直接渲染全部 R3F 宿主节点；`BuildingModel`/`LockedBuildingPlot` 只作为可识别叶子 mock，选择逻辑与 gang store 均为真实实现。
