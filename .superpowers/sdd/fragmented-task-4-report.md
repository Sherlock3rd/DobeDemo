# Fragmented Building Upgrades — Task 4 Report

## 状态

Task 4「3D 碎片渲染与入场动画」已按严格 TDD 完成。碎片视觉类型从 legacy
`buildingVisualConfig` 迁出至 `buildingVisualTypes`，随后**删除** legacy
`buildingVisualConfig.ts` / `.test.ts`，全仓无残留 import。3D 层改为消费
`getRenderedBuildingFragments`，新增 400ms 纯 transform 入场动画（只写 refs、尊重
reduced motion），并把等级读取从 legacy `buildingLevels` 兼容视图切换到 store 的完整
`buildingProgress`。未改 UI、未 commit / push。全量 test / typecheck / lint / format 全绿。

## 改动文件

**新增**

- `src/scene/city/buildingVisualTypes.ts` — 承接 `BuildingColorRole` /
  `BoxVisualPart` / `CylinderVisualPart` / `BuildingVisualPart`（不含 legacy 的
  `BuildingVisualStages`）。
- `src/scene/city/buildingFragmentAnimation.ts` — `BUILDING_FRAGMENT_ANIMATION_MS`、
  `FRAGMENT_GLOW_COLOR`、纯 `getFragmentAnimationTransform`。
- `src/scene/city/AnimatedBuildingFragment.tsx` + `.test.tsx` — 入场动画组件。
- `src/scene/city/fragmentAnimationController.ts` + `.test.ts` — 可测动画 controller
  （`FragmentAnimationController` / `applyFragmentFrame` / `snapFragmentRest`），
  审查后新增。
- `src/scene/city/buildingFragmentMaterial.ts` — scaffold / highlight / clubhouse
  neon 材质语义纯函数 `getFragmentPartMaterial`。
- `src/scene/city/BuildingModel.test.tsx` — 材质语义 + fragment 映射测试。
- `src/scene/city/usePrefersReducedMotion.ts` + `.test.ts` — 小 hook。

**改写 / 修改**

- `src/scene/city/BuildingModel.tsx` — `useMemo(getRenderedBuildingFragments)`，
  `<group position={anchor}>` + 稳定 `fragment.id` key，scaffold 半透明，保留
  highlight 与 clubhouse 霓虹语义。
- `src/scene/city/BuildingVisual.tsx` + `.test.tsx` — 订阅完整 `progress`，计算
  `animatedFragmentId`。
- `src/scene/city/InteractiveBuilding.tsx` — 移除 legacy `buildingLevels` 读取。
- `src/scene/city/buildingFragmentCatalog.ts` + `.test.ts` — 类型导入指向
  `buildingVisualTypes`。

**删除**

- `src/scene/city/buildingVisualConfig.ts`
- `src/scene/city/buildingVisualConfig.test.ts`

## 关键实现

### 1. 类型迁移 + 删除 legacy

`buildingVisualConfig` 的三快照 API（`getBuildingVisualStage` / `buildingVisualConfig`）
是 Task 3 明确保留的过渡 legacy。Task 4 把其中被复用的**类型**抽到独立
`buildingVisualTypes.ts`，`buildingFragmentCatalog` 与其测试改指该文件后，删除
`buildingVisualConfig.ts` / `.test.ts`。`rg buildingVisualConfig|getBuildingVisualStage`
在 `src/**` 下**零命中**。

### 2. AnimatedBuildingFragment + 400ms 纯 transform

- `getFragmentAnimationTransform(elapsedMs, reducedMotion)` 为**纯确定性**函数：
  线性插值 `scale 0.78→1`、`yOffset -0.35→0`、`glow 1→0`，`progress`
  clamp 到 `[0,1]`；`reducedMotion` 直接返回 `{ scale:1, yOffset:0, glow:0 }`。
- 组件用 `useFrame` **只写 refs**：内层 group 的 `scale`/`position.y` 与**独立绿色
  `pointLight`** 的 `intensity`（见「审查修复 1」）。**不触碰** 子网格 highlight/neon
  材质，也**不写** React state 或 Zustand。
- 帧逻辑委托给可测的 `FragmentAnimationController` + `applyFragmentFrame`；起点由
  `useLayoutEffect([animate])` 在 prop 变化时 `reset`，`animate=false` 时并
  `snapFragmentRest` 立即复位（见「审查修复 2/3/4」）。
- reduced motion 经 `usePrefersReducedMotion`（防御性 `matchMedia`，缺省 false）。

### 3. BuildingModel

- `useMemo` 依据 `(kind, progress, animatedFragmentId)` 调 `getRenderedBuildingFragments`
  （该函数在这些输入上纯确定，适合 memo）。
- 每 fragment：`<group key={fragment.id} position={fragment.anchor}>` 内嵌
  `AnimatedBuildingFragment animate={fragment.animate}`，实现锚点原地缩放，升级不向
  建筑原点滑动。
- `fragment.state === 'scaffold'` → 材质 `transparent + opacity 0.5`（半透明施工基座）。
- highlight（hover/选中）优先，其次 clubhouse `tag.includes('neon')` 的 accent 霓虹辉光，
  语义与旧实现一致（旧 `clubhouse-sign`/`neon-sign` → 新专属「霓虹标识」fragment 的
  `clubhouse-neon-*` 部件）。

### 4. BuildingVisual —「本会话点击才播放，刷新不重播，StrictMode 不丢」

- 从 store 订阅 `buildingProgress[id]`（完整 progress，非 legacy `buildingLevels`）。
- 采用 React 官方**「渲染期比较上一次 props」**模式（`useState` 存 previousProgress，
  渲染期 `if (previous !== progress) setState(...)`）判定动画：**仅**当
  `level` 不变且 `completedFragments === previous + 1` 时，取刚完成槽
  `fragments[completed-1].id` 作为 `animatedFragmentId`。
  - 该模式**幂等**，StrictMode 双重渲染/双调 effect 不会丢动画；
  - 首次挂载 `previous === progress`（含 rehydrate 后已有半完成进度），**不** animate，
    刷新不重播入场；
  - confirm 升级（level 变、碎片归零）不满足条件，不 animate。
- 独立 effect 依 `animatedFragmentId` 起 `setTimeout(BUILDING_FRAGMENT_ANIMATION_MS)`
  清除，cleanup `clearTimeout`；400ms 后 `animate` 归零。
- 锁定态仍渲染 `LockedBuildingPlot`，行为不变。

### 5. InteractiveBuilding

- 删除 `const level = useCityStore(s => s.buildingLevels[id])` 及向 `BuildingVisual`
  透传的 `level`。`BuildingVisual` 自订阅 progress。
- 拖动抑制、hover（cursor controller）、选中 highlight、hitbox 点击语义全部保持；相关
  测试无需改动即通过。

## TDD 证据

### RED

- 先写 `AnimatedBuildingFragment.test.tsx`（transform 0/200/400/越界/负值/reduced
  motion + 组件渲染 group/children + frame 回调安全）、`usePrefersReducedMotion.test.ts`、
  `BuildingModel.test.tsx`（材质语义 + fragment 映射/animate 透传）、
  `BuildingVisual.test.tsx`（progress 透传、rehydrate 不重播、点击只动新槽后 400ms 清除、
  StrictMode 不丢动画）。在实现文件尚不存在或旧签名（`BuildingVisual` 收 `level`、
  `BuildingModel` 收 `level` 无 fragment 映射）下必然 RED。

### GREEN

- 实现后逐文件定向测试通过：
  - `AnimatedBuildingFragment.test.tsx` + `usePrefersReducedMotion.test.ts`：11/11。
  - `BuildingModel.test.tsx`：8/8。
  - `BuildingVisual.test.tsx`：7/7。
- 期间修复：`StrictMode` 误从 `@testing-library/react` 导入（应从 `react`）。

## 最终验证（含审查修复后）

- `npm.cmd test` — PASS，32 文件、**391** 测试。
- `npm.cmd run typecheck` — PASS。
- `npm.cmd run lint` — PASS（初次因 `react-refresh/only-export-components` 报错，遂将纯
  函数拆到 `buildingFragmentAnimation.ts` / `buildingFragmentMaterial.ts`，修复后绿）。
- `npm.cmd run format:check` — PASS。
- 变更文件 IDE lint — PASS，无诊断。
- `rg buildingVisualConfig|getBuildingVisualStage` under `src/**` — 零命中。

## 审查修复（Critical / Important，测试先行）

针对 Task 4 审查发现，按严格 TDD 先补/改测试再改实现：

### 1. 入场动画不再命令式改写业务材质

- 移除 `AnimatedBuildingFragment` 中对子网格 `material.emissive` / `emissiveIntensity`
  的 `traverse` 命令式写入。
- 绿色反馈改为**独立 `pointLight`**（`FRAGMENT_GLOW_COLOR`），仅在 `animate` 为真时挂载
  于 fragment 内层 group；动画只写**内层 group 的 scale/y** 与**该 light 的 intensity**。
  原 highlight / neon 声明式材质完全不被触碰。
- 组件测试断言：animating 时渲染 `pointLight`、idle 时不渲染且子 `meshStandardMaterial`
  原样保留。

### 2. animate=false 与 400ms 均显式 snap 最终态

- 新增可测 `FragmentAnimationController.sample()`：`!animate` 时 `startSeconds=null`
  并返回 REST；`elapsed >= 400ms` 或 reduced motion 时返回 REST（最终态）。
- `applyFragmentFrame` 据此把 group 归位 `scale=1 / y=0`、feedback `intensity=0`。
- 测试覆盖「非动画即复位并清起点」「400ms 收尾 snap」。

### 3. animate false→true 每次重置起点（不依赖 false 帧）

- 用 `useLayoutEffect([animate])` 在 prop 变化时 `controller.reset()`；`animate=false`
  时并调用 `snapFragmentRest` 立即复位可见姿态。**不再依赖恰好出现一个 animate=false 的
  useFrame** 来重置。
- 保证同一 stable fragment ID 在后续等级可重播；测试「同实例打断后从 0 重播」与
  「reset 强制下一动画帧重启」。

### 4. 快速 A→B 打断 + 可测 controller

- 每个 fragment 实例各持一个 `FragmentAnimationController`；A 的 `animate` 转 false 时其
  effect 立即 `reset + snap`，B 的 `animate` 转 true 时其 effect `reset`，首帧从 0 起。
- 抽出 `fragmentAnimationController.ts`（controller + `applyFragmentFrame` +
  `snapFragmentRest`），10 个单测覆盖：起点、从首帧计时、400ms 收尾、非动画复位、
  打断复位/同槽重播、reduced motion、reset、frame 写入、空 ref 分支。

### 5. 空 group 测试实际走分支

- 旧「null group」用例是 `animate=false` 早退，并未触达写入分支。改为
  `applyFragmentFrame(null, null, controller, now, /*animate*/ true, false)`：确认
  空 ref 下不抛错，且 controller 仍推进（后续帧继续 easing）。

### 6. neon 排除 mast

- `getFragmentPartMaterial` 的 neon 判定收紧为
  `neon && tag.includes('neon') && !tag.includes('mast')`：只让真实霓虹 sign / tube
  （`clubhouse-neon-sign` / `clubhouse-neon-halo`）发光，安装立柱
  `clubhouse-neon-mast` 不发光。测试新增 mast 不发光、sign+halo 发光断言。

### 修复后验证

- Task 4 定向（6 文件）：45/45 通过。
- `npm.cmd test` 全量：32 文件、**391** 测试通过。
- `npm.cmd run typecheck` / `lint` / `format:check`：全绿。
- `useFrame` 仍**不写** React / Zustand。UI 未改。未 commit / push。

## 关注事项 / 交接（Task 5）

- `useCityStore.buildingLevels` 派生兼容视图与 legacy `upgradeBuilding` no-op 仍保留，供
  尚未迁移的 `BuildingPanel` 使用；Task 5 重写面板围绕 `completeNextFragment` /
  `confirmBuildingLevelUp` 后可移除。
- `animatedFragmentId` 由渲染层（`BuildingVisual`）在本会话内自算，不进 store、不持久化；
  面板绿色扫光另由 Task 5 的 CSS 实现，与 3D 入场解耦。
- 计划 Task 4 的 Files / Interfaces 已对齐实际实现（新增 `buildingVisualTypes`、
  `buildingFragmentAnimation`、`buildingFragmentMaterial`、`usePrefersReducedMotion`、
  `BuildingModel.test`；`BuildingModelProps` 补 `animatedFragmentId?`；
  `BuildingVisualProps` 收敛为 `id` / `highlighted`）。
