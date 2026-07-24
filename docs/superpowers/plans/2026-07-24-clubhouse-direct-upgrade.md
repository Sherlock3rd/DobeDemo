# Clubhouse Direct Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Clubhouse 改为保留主成本的一键原子升级特殊建筑，移除其子建筑、阶段进度和确认页，并安全迁移旧存档。

**Architecture:** 领域层用统一 `isDirectUpgradeBuilding()` 标识特殊建筑；主升级决策对 Clubhouse 跳过子进度，子升级决策拒绝 Clubhouse。Store 继续复用主升级原子事务。UI 渲染 Clubhouse 专属详情分支，3D 将蓝图按主等级直接物化。City persist v4 一次性退款旧 Clubhouse 子投入并清零。

**Tech Stack:** React 19、TypeScript、Zustand persist、React Three Fiber、Vitest、Chrome CDP。

## Global Constraints

- Clubhouse 解锁仍为帮派 Lv.40，等级仍为 1–10。
- 使用现有 `buildingUpgradeCostByTargetLevel` 和 Clubhouse 战力配置。
- 点击直接升级，不打开确认页。
- Clubhouse `childLevels` 运行期恒为 10 个 0。
- 其他建筑升级流程不得改变。
- 不新增依赖；参考视频、截图、`dist` 不提交。

---

### Task 1: 领域规则与 Store 原子升级

**Files:**
- Modify: `src/game/buildingUpgrade.ts`
- Modify: `src/game/buildingUpgrade.test.ts`
- Modify: `src/store/useCityStore.ts`
- Modify: `src/store/useCityStore.test.ts`

**Interfaces:**
- Produces: `isDirectUpgradeBuilding(id: BuildingId): boolean`
- `getChildUpgradeDecision()` 对 Clubhouse 返回 `direct-main-upgrade-only`
- `getMainUpgradeDecision()` 对 Clubhouse 跳过 `children-not-caught-up`
- `upgradeMainBuilding('clubhouse', gangLevel, now)` 继续作为直接升级事务

- [ ] **Step 1: 写领域 RED 测试**

```ts
expect(isDirectUpgradeBuilding('clubhouse')).toBe(true)
expect(isDirectUpgradeBuilding('repair-shop')).toBe(false)
expect(getChildUpgradeDecision(clubhouseInput).reason).toBe(
  'direct-main-upgrade-only',
)
expect(getMainUpgradeDecision({
  buildingId: 'clubhouse',
  progress: { level: 1, childLevels: Array(10).fill(0) },
  wallet: richWallet,
  gangLevel: 40,
  repairShopProgress,
  clubhouseProgress,
}).reason).toBe('ready')
```

- [ ] **Step 2: 运行 RED**

Run:

```powershell
npm.cmd test -- src/game/buildingUpgrade.test.ts src/store/useCityStore.test.ts
```

Expected: 缺少直接建筑规则或仍返回 `children-not-caught-up`。

- [ ] **Step 3: 实现最小领域与 Store 防线**

```ts
export function isDirectUpgradeBuilding(id: BuildingId): boolean {
  return id === 'clubhouse'
}

// getChildUpgradeDecision 最前部（解锁校验后）
if (isDirectUpgradeBuilding(buildingId)) {
  return childDecision('direct-main-upgrade-only')
}

// getMainUpgradeDecision
if (
  !isDirectUpgradeBuilding(buildingId) &&
  !getBuildingUpgradeProgress(buildingId, progress).complete
) {
  return blocked('children-not-caught-up')
}
```

Store 不新增非原子动作；`upgradeChildBuilding` 通过 decision 返回拒绝，`upgradeMainBuilding` 复用现有单 `set` 结算/扣费/升级。

- [ ] **Step 4: 补 Store 原子测试并运行 GREEN**

覆盖：

- Clubhouse 钱包足够：一次点击成本精确扣除、level +1、childLevels 不变全 0。
- 钱包不足、Lv.10、gang Lv39：状态完全不写。
- `upgradeChildBuilding('clubhouse', …)` 不写。

Run: 同 Step 2，Expected: PASS。

- [ ] **Step 5: Task 1 审查与提交**

```powershell
git add src/game/buildingUpgrade.ts src/game/buildingUpgrade.test.ts src/store/useCityStore.ts src/store/useCityStore.test.ts
git commit -m "feat: add direct Clubhouse upgrade rule"
```

### Task 2: City persist v4 迁移

**Files:**
- Modify: `src/store/cityProgressMigration.ts`
- Modify: `src/store/cityProgressMigration.test.ts`
- Modify: `src/store/useCityStore.ts`
- Modify: `src/store/useCityStore.test.ts`

**Interfaces:**
- City persist `version: 4`
- Produces: v3→v4 Clubhouse 子投入一次退款与清零

- [ ] **Step 1: 写迁移 RED 测试**

```ts
const migrated = migrateCityState(
  {
    buildingProgress: {
      ...initial,
      clubhouse: { level: 3, childLevels: [1, 2, 3, 0, 0, 0, 0, 0, 0, 0] },
    },
    resources: { money: 100, oil: 0, materials: 0 },
    lastResourceUpdatedAt: NOW,
    activeProducerIds: ['repair-shop'],
  },
  3,
  NOW,
)

expect(migrated.buildingProgress.clubhouse).toEqual({
  level: 3,
  childLevels: Array(10).fill(0),
})
expect(migrated.resources).toEqual({
  money: 100 + cost(1) + cost(1) + cost(2) + cost(1) + cost(2) + cost(3),
  oil: 0,
  materials: 0,
})
```

另断言 persistedVersion 4 不重复退款，坏存档与初始态 Clubhouse 子等级全 0。

- [ ] **Step 2: 运行 RED**

```powershell
npm.cmd test -- src/store/cityProgressMigration.test.ts src/store/useCityStore.test.ts
```

- [ ] **Step 3: 实现退款**

使用当前 `economyConfig.childUpgradeCostByTargetLevel`，按旧每个 Clubhouse child level 从 1 累加至记录等级，调用 `addWalletSaturated`。规范化时对 Clubhouse 强制：

```ts
const childLevels =
  id === 'clubhouse'
    ? Array(getBuildingChildCount(id)).fill(0)
    : normalizeChildren(...)
```

`migrateCityState`：

- `<2` 先走旧迁移，再执行 v4 Clubhouse 清理（不重复旧退款）。
- `2` 先执行 v2→v3 隐藏槽退款，再执行 Clubhouse 退款。
- `3` 执行 Clubhouse 退款。
- `>=4` 只规范化，不退款。

- [ ] **Step 4: Store persist 升 v4 并 GREEN**

将 `useCityStore` persist `version` 改为 4。运行 Step 2 与完整 Store 测试。

- [ ] **Step 5: Task 2 审查与提交**

```powershell
git add src/store/cityProgressMigration.ts src/store/cityProgressMigration.test.ts src/store/useCityStore.ts src/store/useCityStore.test.ts
git commit -m "feat: migrate Clubhouse child progress to direct upgrades"
```

### Task 3: Clubhouse 专属 UI

**Files:**
- Modify: `src/ui/BuildingPanel.tsx`
- Modify: `src/ui/BuildingPanel.test.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Clubhouse details button accessible name:
  `直接升级 Clubhouse 至 Lv.N · <cost>`
- 点击直接调用 `upgradeMainBuilding('clubhouse', gangLevel, Date.now())`

- [ ] **Step 1: 写 UI RED 测试**

```tsx
render(<BuildingPanel />)
expect(screen.queryByRole('radiogroup')).toBeNull()
expect(screen.queryByRole('progressbar')).toBeNull()
expect(screen.queryByRole('button', { name: /确认升级/ })).toBeNull()

await user.click(
  screen.getByRole('button', { name: /直接升级 Clubhouse 至 Lv.2/ }),
)
expect(useCityStore.getState().buildingProgress.clubhouse.level).toBe(2)
expect(useCityStore.getState().resources).toEqual(expectedWallet)
```

覆盖未解锁、资源不足、满级、点击后仍停留详情页。

- [ ] **Step 2: 运行 RED**

```powershell
npm.cmd test -- src/ui/BuildingPanel.test.tsx
```

- [ ] **Step 3: 实现专属详情分支**

在通用确认页判断之前渲染 Clubhouse 分支。计算：

```ts
const targetLevel = level < 10 ? level + 1 : null
const decision = getMainUpgradeDecision(...)
const cost = targetLevel
  ? economyConfig.buildingUpgradeCostByTargetLevel[targetLevel]
  : null
```

展示资源、当前/目标/增量战力、成本和 blocker。按钮点击直接调用 Store，不写 panel confirm session。

- [ ] **Step 4: CSS 与 GREEN**

复用 `.building-panel__main-button`，确保双轴 ≥44px、focus-visible。运行 UI 测试、typecheck、lint、format。

- [ ] **Step 5: Task 3 审查与提交**

```powershell
git add src/ui/BuildingPanel.tsx src/ui/BuildingPanel.test.tsx src/App.css
git commit -m "feat: add one-click Clubhouse upgrade panel"
```

### Task 4: 3D 主等级视觉与验收发布

**Files:**
- Modify: `src/scene/city/buildingFragmentCatalog.ts`
- Modify: `src/scene/city/buildingFragmentCatalog.test.ts`
- Modify: `src/scene/city/BuildingModel.test.tsx`
- Modify: `README.md`
- Modify: `session/session.md`
- Create: `.superpowers/sdd/clubhouse-direct-upgrade-cdp.mjs`
- Create: `.superpowers/sdd/clubhouse-direct-upgrade-results.json`
- Create: `.superpowers/sdd/clubhouse-direct-upgrade-report.md`

**Interfaces:**
- `getRenderedBuildingFragments('clubhouse', progress)` 忽略 childLevels，按 main level 返回前 N 个 `current` 视觉层

- [ ] **Step 1: 写 3D RED 测试**

```ts
expect(
  getRenderedBuildingFragments('clubhouse', {
    level: 4,
    childLevels: Array(10).fill(0),
  }).map(({ state }) => state),
).toEqual(['current', 'current', 'current', 'current'])
```

另断言不同 Clubhouse childLevels 得到相同结果、无 scaffold；其他建筑仍读取 childLevels。

- [ ] **Step 2: 实现并运行场景 GREEN**

在 `getRenderedBuildingFragments` 顶部加入 Clubhouse 特殊分支，复用前 N 蓝图并按 `resolveFragmentPartsAtLevel(fragment, progress.level)` 生成完成态。

Run:

```powershell
npm.cmd test -- src/scene/city/buildingFragmentCatalog.test.ts src/scene/city/BuildingModel.test.tsx
```

- [ ] **Step 3: 完整工程门禁**

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

- [ ] **Step 4: 安全本地 CDP**

脚本沿用动态 owned Vite、Chrome `--remote-debugging-port=0`、隔离 profile、真实 `Input.dispatchMouseEvent`、失败非零和脱敏 JSON。断言：

- Lv.40 Clubhouse 无 radio/progress/确认入口。
- 钱包足够时真实点击一次，level 1→2、钱包按主成本减少、无确认页。
- 3D Clubhouse ROI 发生变化。
- 资源不足/满级阻止。
- v3→v4 退款一次、刷新不重复。
- 390×844 无横向溢出且按钮双轴 ≥44px。

- [ ] **Step 5: 文档、终审、提交**

更新 README/session/report；完整分支审查必须无 Critical/Important/Medium。

```powershell
git add README.md session/session.md src/scene/city/buildingFragmentCatalog.ts src/scene/city/buildingFragmentCatalog.test.ts src/scene/city/BuildingModel.test.tsx
git add -f .superpowers/sdd/clubhouse-direct-upgrade-cdp.mjs .superpowers/sdd/clubhouse-direct-upgrade-results.json .superpowers/sdd/clubhouse-direct-upgrade-report.md
git commit -m "test: verify direct Clubhouse upgrades"
```

- [ ] **Step 6: 发布与公开复验**

普通 push `main`；用 fresh `dist` 临时 index 快进发布 `gh-pages`，等待 Pages build 精确匹配 `built`。公开 URL 真实 Chrome 验证一键升级、资产 200 和移动布局；提交公开脱敏证据。
