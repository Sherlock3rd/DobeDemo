# Fragmented Building Upgrades — Task 5 Report

## 状态

Task 5「Setup 面板与确认闭环」已按严格 TDD 完成。`BuildingPanel` 从旧的「点击一次直
接整级升级 / 3」重写为参考视频的两层 Setup 闭环：逐个完成目标级子建筑 → 100% → 独立
确认卡提交主建筑等级。同时**删除**了 Task 2 起临时保留的全部 legacy 兼容层：
`useCityStore` 的派生 `buildingLevels` 视图与 `upgradeBuilding` no-op shim、以及
`buildingUpgrade` 里的 `upgradeBuildingLevel`。`buildingProgress` 现为唯一 API，`src`
下零残留（仅存 store 测试里断言两者为 `undefined` 的守卫）。未 commit / push。全量
test / typecheck / lint / format 全绿。

## 改动文件

**重写**

- `src/ui/BuildingPanel.tsx` — Setup 工作台闭环。
- `src/ui/BuildingPanel.test.tsx` — 覆盖新闭环 + 锁定/事件阻断。
- `src/store/useCityStore.test.ts` — 移除 legacy `buildingLevels` / `upgradeBuilding`
  用例，新增「无 legacy 视图」守卫。

**修改**

- `src/store/useCityStore.ts` — 删除 `buildingLevels` 字段、`deriveBuildingLevels`、
  `BuildingLevels` 类型、`upgradeBuilding` action 及 `upgradeBuildingLevel` 导入；
  `buildingProgress` 成为唯一真源，`merge`/`reset`/mutations 不再同步派生视图。
- `src/game/buildingUpgrade.ts` — 删除 legacy `upgradeBuildingLevel`。
- `src/App.css` — Setup 面板样式：进度条、当前设施卡、确认卡、N 格状态网格、绿色斜扫
  `__sweep`、满级态；扩展 `prefers-reduced-motion` 关闭扫光/位移/过渡。
- `src/App.test.tsx` — 预选建筑断言 `等级 1 / 3` → `等级 1 / 10`。

## 关键实现

### 1. Setup 闭环 UI（解锁态）

- 标题：建筑名 + `等级 L / 10`。
- 目标：`升级至 Lv.N`（`getTargetBuildingLevel`）。
- 总进度：`role="progressbar"`，`aria-valuemin=0` / `aria-valuemax=N` /
  `aria-valuenow=k` / `aria-valuetext="k / N 个子建筑"`，配可见 `k / N 个子建筑` 文案与
  百分比填充条（`getBuildingUpgradePercent`）。
- 当前设施卡：`子建筑 {k+1} / N` + 当前子建筑**名称/说明**，取自
  `getBuildingFragments(kind)[k]`（按 kind 的目标设施文案）。
- N 格状态网格：`data-state` 明确 `done`（i<k）/ `current`（i===k 且未就绪）/
  `pending`（i>k）。
- 主按钮**只** `completeNextFragment`，标签 `升级子建筑 {k+1}/N`。

### 2. 确认闭环

- `isBuildingReadyToLevelUp`（k===N 且 level<10）为真时，隐藏碎片按钮，改渲染**独立确认
  卡** `.building-panel__confirm`：`升级确认`、`Lv.L → Lv.N`、N 个目标子建筑名称徽章、
  按钮 `完成 Lv.N 升级`。
- 只有点击该按钮才 `confirmBuildingLevelUp`，原子 `level+1` 且 `completedFragments`
  归零；随后面板自动显示新一级 `0 / (N+1)`。
- Lv.10：不渲染 progressbar / 碎片按钮，显示满级说明 + 10 格全 `done` 网格 + 禁用按钮
  `已满级 · 10 个子建筑`。

### 3. 绿色扫光（每次完成触发）

- `sweepKey` state 每次 `completeNextFragment` 自增，作为 `key` 挂到
  `.building-panel__sweep` 上；重新挂载即重放 ~320ms 绿色斜向 CSS 扫光（`skewX(-18deg)`
  的渐变条），内层 `overflow:hidden` 防止面板横向滚动。
- 切换建筑时用 React「渲染期比较并调整 state」模式重置 `sweepKey`（避免
  `react-hooks/set-state-in-effect`，无 effect）。
- `prefers-reduced-motion: reduce` 下扫光、进度填充过渡、当前格放大全部关闭。

### 4. 布局

- 桌面：`.building-panel` 保留 `overflow-y:auto` 纵向滚动 + `max-height`。
- 小屏（≤45rem）：底部抽屉，`max-height:55vh` 不溢出；碎片网格
  `repeat(auto-fill, minmax(2.1rem, 1fr))` 自适应。

### 5. 锁定态与事件阻断

- 未解锁分支（帮派等级不足）完全保持：`尚未解锁` / `需要 Lv.X · 角色` / `当前 Lv.g / X`，
  不暴露任何升级/碎片控件。
- `onPointerDown` / `onClick` 的 `stopPropagation` 在解锁态与锁定态都保留，面板交互不冒泡
  到 3D 场景。

### 6. 删除 legacy，`buildingProgress` 成唯一 API

- `useCityStore` 不再有 `buildingLevels` 派生视图、`upgradeBuilding` shim；
  `buildingUpgrade` 不再有 `upgradeBuildingLevel`。
- `rg 'buildingLevels|upgradeBuilding\b|upgradeBuildingLevel|BuildingLevels'` 在 `src/**`
  仅命中 store 测试中「断言其为 `undefined`」的守卫，无实现残留。

## TDD 证据

### RED

先重写/更新测试：

- `BuildingPanel.test.tsx`：Lv.1 显示 `0/2` progressbar、碎片格 done/current/pending、
  每次只 `completeNextFragment`、两次后进入确认但主级仍为 1、确认后 `Lv.2` 且 `0/3`、
  Lv.9→10 需十次点击再确认、Lv.10 禁用满级、锁定无控件、Lv.8 解锁后出现工作台、确认卡列
  目标子建筑、事件不冒泡。
- `useCityStore.test.ts`：删除 legacy 用例，新增「无 `buildingLevels` / `upgradeBuilding`」
  守卫；持久化/迁移/封顶用例改为只断言 `buildingProgress`。
- `App.test.tsx`：`等级 1 / 10`。

在旧实现（`buildingLevels` + `upgradeBuilding` + `升级到 N 级` + `/ 3`）下运行 →
**11 failed**（RED 确认）。

### GREEN

实现 store 删除 + `BuildingPanel` 重写 + CSS 后：

- 定向 4 文件（BuildingPanel / useCityStore / App / buildingUpgrade）：**71/71** 通过。

期间两处修复（先补测试语义后改实现）：

- typecheck：store 测试 `CityState → Record<string, unknown>` 直接断言不合法，改
  `as unknown as Record<...>`。
- lint（`react-hooks/set-state-in-effect`）：`sweepKey` 重置从 `useEffect(setState)` 改为
  渲染期比较 `sweepBuildingId` 并调整 state 的官方模式。

## 最终验证

- `npm.cmd test` — PASS，**32 文件 / 390 测试**。
- `npm.cmd run typecheck` — PASS。
- `npm.cmd run lint` — PASS。
- `npm.cmd run format:check` — PASS。
- 变更文件 IDE 诊断 — 无。
- `src/**` legacy API 残留 — 零（仅 store 守卫断言 undefined）。
- 未 commit / push。

## 审查修复（Important，测试先行）

针对 Task 5 审查的两个 Important，先补测试再改实现：

### 1. progressbar 缺少可访问名称

- `.building-panel__progress` 增加 `aria-label={`${building.name}升级进度`}`，屏幕阅读器可
  读出「修车厂升级进度」而不仅是裸进度值。
- 测试：`getByRole('progressbar', { name: '修车厂升级进度' })`（在实现前 RED）。

### 2. 碎片格不再持续放大 current，改为最新完成项一次性 pop

- 移除 `[data-state='current']` 的持久 `transform: scale(1.08)`（改为仅保留描边/底色/描边
  高亮，不再持续放大）。
- 新增 `building-panel__fragment--latest` 类：仅当 `completed > 0` 时挂到
  `index === completed - 1` 的**单个**最新完成格上。CSS 用一次性 ~300ms
  `building-panel-fragment-pop` keyframes（放大 1→1.18→1 + 绿色辉光后回到 done 常态，
  无 `forwards`）。
- 每次 k 增长，该类从旧格移到新格 → 新格首次获得该类即重播动画，旧格失去类；因此任一时刻
  至多一个格在 pop。`prefers-reduced-motion` 下该动画置为 `none`。
- 测试：`completed=0` 时无 `--latest`；`1/2` 仅 index0、`2/2` 仅 index1 各一个
  `--latest`（在实现前 RED）。

### 修复后验证

- `BuildingPanel.test.tsx`：**16/16**（新增 latest 用例 + progressbar 具名断言）。
- `npm.cmd test` 全量：**32 文件 / 391 测试** 通过。
- `npm.cmd run typecheck` / `lint` / `format:check`：全绿。
- 未 commit / push。

## 关注事项 / 交接（Task 6）

- 面板绿色扫光为 CSS `key` 重挂动画，与 3D 入场动画（`BuildingVisual` 本会话内自算的
  `animatedFragmentId`）解耦，两者互不依赖。
- 计划 Task 5 的按钮契约以 `升级子建筑 {k+1}/N` 落地（design 的 `升级子建筑 k/N` 取
  「即将完成的第 k+1 个」语义，与进度 `k/N` 并存不冲突）。
- Task 6 浏览器验收（CDP 截图、刷新恢复、注入 Lv.10 存档、桌面/移动视口）仍待做；本任务
  未运行浏览器验收（按要求 refresh 兼容由 store 测试覆盖，UI 测试不模拟损坏存档）。
- 旧 `.building-panel__description` CSS 已随组件重写一并删除，无死代码残留。
