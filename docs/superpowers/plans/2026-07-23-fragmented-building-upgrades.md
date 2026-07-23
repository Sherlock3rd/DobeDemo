# Fragmented Building Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将六座建筑升级改造成持久化的 1–10 级碎片闭环，目标等级 N 需要逐个完成 N 个子建筑，再确认主建筑升级。

**Architecture:** 纯函数模块负责等级、碎片和迁移不变量；Zustand 只持久化每建筑 `{ level, completedFragments }`。程序化蓝图为每类建筑提供 10 个稳定子建筑，3D 根据当前级和部分完成数选择旧形态、目标形态与施工基座；UI 复刻参考视频的 Setup 进度、设施格、绿色扫光和最终确认。

**Tech Stack:** TypeScript 6、React 19、Three.js 0.185、React Three Fiber 9、Zustand 5 persist、Vitest 4、Testing Library、Vite 8

## Global Constraints

- 默认六座建筑均为 Lv.1，碎片进度为 0。
- 建筑最高 Lv.10。
- 目标等级 N 恰好需要 N 个子建筑任务。
- Lv.10 完整状态恰好显示 10 个逻辑子建筑。
- 不增加货币、材料、付费加速或施工倒计时。
- 不改变帮派树、建筑解锁顺序、城市 placement、道路和相机规则。
- 程序化模型必须留在原 footprint 内，最高点不超过 `BUILDING_HITBOX_HEIGHT`。
- 400ms 入场动画；reduced motion 下立即完成。
- 存档键 `dobe-city-progression-v1`，只持久化建筑进度。
- 每个任务通过审查后由父代理分段提交；子代理不得 commit/push。

---

### Task 1: 十级领域规则

**Files:**

- Modify: `src/game/cityTypes.ts`
- Rewrite: `src/game/buildingUpgrade.ts`
- Rewrite: `src/game/buildingUpgrade.test.ts`
- Modify: `src/game/buildingCatalog.ts`
- Modify: `src/game/buildingCatalog.test.ts`

**Interfaces:**

```ts
export const BUILDING_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
export type BuildingLevel = (typeof BUILDING_LEVELS)[number]

export interface BuildingProgress {
  level: BuildingLevel
  completedFragments: number
}

export const BUILDING_MAX_LEVEL = 10
export function normalizeBuildingLevel(value: unknown): BuildingLevel
export function normalizeBuildingProgress(value: unknown): BuildingProgress
export function getTargetBuildingLevel(level: BuildingLevel): BuildingLevel
export function getRequiredFragmentCount(level: BuildingLevel): number
export function getBuildingUpgradePercent(progress: BuildingProgress): number
export function isBuildingReadyToLevelUp(progress: BuildingProgress): boolean
export function completeNextBuildingFragment(
  progress: BuildingProgress,
): BuildingProgress
export function confirmBuildingLevelUp(
  progress: BuildingProgress,
): BuildingProgress
```

- [x] **Step 1:** 先写 1–10 类型、目标等级、N 个碎片、每次 +1、确认门槛、准备态不再增加、Lv.10 封顶和非法输入测试。
- [x] **Step 2:** 运行 `npm.cmd test -- src/game/buildingUpgrade.test.ts`，确认旧三等级实现 RED。
- [x] **Step 3:** 实现最小纯函数并保证无 UI/store 依赖。
- [x] **Step 4:** 把 `BuildingDefinition.levelSummary` 改为 10 项 readonly tuple；六建筑补 10 级递进文案。
- [x] **Step 5:** 更新 catalog 测试，断言六建筑每个都有 10 项、ID 唯一。
- [x] **Step 6:** 运行 game 定向测试、typecheck、lint。

### Task 2: 安全持久化城市进度

**Files:**

- Create: `src/store/safeStorage.ts`
- Create: `src/store/safeStorage.test.ts`
- Create: `src/store/cityProgressMigration.ts`
- Create: `src/store/cityProgressMigration.test.ts`
- Rewrite: `src/store/useCityStore.ts`
- Rewrite: `src/store/useCityStore.test.ts`
- Modify: `src/store/useGangStore.ts`
- Modify: `src/store/useGangStore.test.ts`

**Interfaces:**

```ts
export const CITY_STORAGE_KEY = 'dobe-city-progression-v1'
export type BuildingProgressById = Record<BuildingId, BuildingProgress>

export function createSafeStorage(getStorage?: () => Storage): StateStorage
export function createInitialBuildingProgress(): BuildingProgressById
export function normalizeBuildingProgressById(value: unknown): BuildingProgressById

interface CityState {
  selectedBuildingId: BuildingId | null
  buildingProgress: BuildingProgressById
  selectBuilding(id: BuildingId): void
  clearSelection(): void
  completeNextFragment(id: string): void
  confirmBuildingLevelUp(id: string): void
  reset(): void
}
```

- [ ] **Step 1:** 提取 safe storage 测试，覆盖 get/set/remove 任一异常后 sticky fallback。
- [ ] **Step 2:** 实现共享 safe storage，`useGangStore` 重导出兼容名称。
- [ ] **Step 3:** 写迁移测试：旧数字等级、部分对象、缺失建筑、NaN/Infinity、碎片越界、Lv.10 清零。
- [ ] **Step 4:** 实现归一化与初始进度。
- [ ] **Step 5:** 写 store RED：默认、目标隔离、未知 ID 引用不变、碎片到确认、reset、persist partialize、rehydrate 半完成进度。
- [ ] **Step 6:** 用 Zustand persist 实现 store，selected/动画状态不持久化。
- [ ] **Step 7:** 运行 store 全套、typecheck、lint。

### Task 3: 六类十槽子建筑蓝图

**Files:**

- Create: `src/scene/city/buildingFragmentCatalog.ts`
- Create: `src/scene/city/buildingFragmentCatalog.test.ts`
- Rewrite: `src/scene/city/buildingVisualConfig.ts`
- Rewrite: `src/scene/city/buildingVisualConfig.test.ts`

**Interfaces:**

```ts
export interface BuildingFragmentBlueprint {
  id: string
  name: string
  description: string
  parts: readonly BuildingVisualPart[]
}

export type FragmentRenderState = 'current' | 'target' | 'scaffold'

export interface RenderedBuildingFragment {
  id: string
  name: string
  state: FragmentRenderState
  parts: readonly BuildingVisualPart[]
  animate: boolean
}

export function getBuildingFragments(
  kind: BuildingKind,
): readonly BuildingFragmentBlueprint[]
export function getRenderedBuildingFragments(
  kind: BuildingKind,
  progress: BuildingProgress,
): readonly RenderedBuildingFragment[]
```

- [ ] **Step 1:** 写六 kind × 10 唯一 fragment、名称/说明非空、part 有效测试。
- [ ] **Step 2:** 写 Lv.N 恰好 N 个 fragment、部分完成选择 current/target/scaffold、仅最新完成项 animate 测试。
- [ ] **Step 3:** 实现六类稳定槽位和共享等级强化生成器。
- [ ] **Step 4:** 用 Three.js matrix/Box3 验证每个 kind 的 Lv.1–10 和部分态都位于原 footprint、最高点不超过命中盒。
- [ ] **Step 5:** 删除旧 3 快照 API，迁移调用测试。
- [ ] **Step 6:** 运行 visual config 定向测试、typecheck、lint。

### Task 4: 3D 碎片渲染与入场动画

**Files:**

- Create: `src/scene/city/AnimatedBuildingFragment.tsx`
- Create: `src/scene/city/AnimatedBuildingFragment.test.tsx`
- Rewrite: `src/scene/city/BuildingModel.tsx`
- Modify: `src/scene/city/BuildingVisual.tsx`
- Modify: `src/scene/city/BuildingVisual.test.tsx`
- Modify: `src/scene/city/InteractiveBuilding.tsx`
- Modify: `src/scene/city/InteractiveBuilding.test.tsx`

**Interfaces:**

```ts
export const BUILDING_FRAGMENT_ANIMATION_MS = 400
export function getFragmentAnimationTransform(
  elapsedMs: number,
  reducedMotion: boolean,
): { scale: number; yOffset: number; glow: number }

interface BuildingModelProps {
  definition: BuildingDefinition
  progress: BuildingProgress
  highlighted: boolean
}
```

- [ ] **Step 1:** 写动画 easing RED：0ms、200ms、400ms、越界 clamp、reduced motion。
- [ ] **Step 2:** 实现纯 transform 与 `useFrame` 组件；只更新 refs。
- [ ] **Step 3:** `BuildingModel` 映射 `getRenderedBuildingFragments`，稳定 key 为 fragment ID。
- [ ] **Step 4:** `BuildingVisual` 从 store 订阅完整 progress 并传递；锁定模式保持不变。
- [ ] **Step 5:** `InteractiveBuilding` 选中/highlight/拖动行为保持，改读 `progress.level`。
- [ ] **Step 6:** 组件测试断言 progress 透传、仅最新 fragment animate、锁定切换不回归。
- [ ] **Step 7:** 运行 scene 定向测试、typecheck、lint。

### Task 5: Setup 面板与确认闭环

**Files:**

- Rewrite: `src/ui/BuildingPanel.tsx`
- Rewrite: `src/ui/BuildingPanel.test.tsx`
- Modify: `src/App.css`
- Modify: `src/App.test.tsx`

**UI contracts:**

```text
等级 L / 10
升级至 Lv.N
k / N 个子建筑
升级子建筑 {k+1}/{N}
完成 Lv.N 升级
已满级 · 10 个子建筑
```

- [ ] **Step 1:** 写 Lv.1 显示 0/2、两次点击进入确认但不升主级、确认后 Lv.2 与 0/3 测试。
- [ ] **Step 2:** 写 Lv.9 需要 10 次、Lv.10 禁用、锁定建筑无按钮、事件不冒泡测试。
- [ ] **Step 3:** 实现 progressbar、当前设施卡、N 格碎片网格和确认卡。
- [ ] **Step 4:** 每次碎片完成更新 `data-upgrade-pulse` 或稳定 animation key，触发绿色扫光。
- [ ] **Step 5:** CSS 实现桌面滚动面板、小屏抽屉、自适应网格、完成/当前/待升级状态。
- [ ] **Step 6:** reduced motion 关闭扫光与位移动画。
- [ ] **Step 7:** 运行 UI/App 定向测试、typecheck、lint、format check。

### Task 6: 集成、存档和浏览器验收

**Files:**

- Modify: `README.md`
- Modify: `session/requirements/gang-tree-idle-unlocks.md`
- Modify: `session/session.md`
- Create: `.superpowers/sdd/fragmented-upgrades-report.md`
- Create: `.superpowers/sdd/fragmented-upgrades-cdp.mjs`
- Create: `.superpowers/sdd/fragmented-upgrades-results.json`
- Create: `.superpowers/sdd/fragmented-upgrades-lv1.png`
- Create: `.superpowers/sdd/fragmented-upgrades-partial.png`
- Create: `.superpowers/sdd/fragmented-upgrades-lv10.png`

- [ ] **Step 1:** 运行 format、typecheck、lint、全量 test、build。
- [ ] **Step 2:** 本地固定端口 HTTP 200，并验证生产 base 资源路径。
- [ ] **Step 3:** Chrome/CDP 普通点击修车厂，断言面板显示 Lv.1/10、0/2。
- [ ] **Step 4:** 完成第一个碎片并截图，断言 1/2 和画面像素变化。
- [ ] **Step 5:** 刷新后断言仍为 1/2；完成第二个碎片，确认主级后断言 Lv.2、0/3。
- [ ] **Step 6:** 注入合法 Lv.10 存档并刷新，断言满级 UI、10 个 fragment、按钮禁用。
- [ ] **Step 7:** 桌面 1440×900 与移动 390×844 无面板溢出。
- [ ] **Step 8:** 更新 README、需求、session 和可重复验收报告。

### Task 7: 分段 Git 与 GitHub Pages

**Files:**

- Add: `example/levelupExample.mp4`
- Build output: `dist/**`（仅进入 `gh-pages` 分支）

- [ ] **Step 1:** 父代理按纯规则、状态、3D、UI/文档分别提交，提交前检查 status/diff/log。
- [ ] **Step 2:** 参考视频作为独立 assets 提交，确认单文件约 13.7MB、低于 GitHub 100MB 上限。
- [ ] **Step 3:** fresh 运行 format/typecheck/lint/test/build。
- [ ] **Step 4:** 推送 `main`，禁止 force。
- [ ] **Step 5:** 用独立临时 index 从 `dist` 构造 `gh-pages` 根提交并普通推送。
- [ ] **Step 6:** 验证 `https://sherlock3rd.github.io/DobeDemo/`、JS、CSS HTTP 200。
- [ ] **Step 7:** 在公开页面执行 Lv.1 的一次碎片升级冒烟，记录结果。
