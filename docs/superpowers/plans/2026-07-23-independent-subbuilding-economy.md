# Independent Subbuilding Economy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将固定顺序碎片升级改为可自由选择的独立子建筑等级，并增加钱、油、物资生产、消费、Clubhouse 等级门槛和 10 秒帮派挂机。

**Architecture:** 数值放入经过校验的 JSON 配置；纯函数负责等级、成本、生产和门槛判定；`useCityStore` 统一持久化建筑与资源并原子扣费升级。3D 按每个子建筑自己的等级渲染，HUD/建筑面板只消费纯判定结果。

**Tech Stack:** React 19、TypeScript 6、Zustand 5 persist、Three.js/R3F、Vitest 4、Testing Library、Vite 8、Chrome CDP

## Global Constraints

- 修车厂固定 5 个子建筑；其他建筑固定 10 个。
- 子建筑从 Lv.0 开始，可自由选择，且不得高于主建筑等级。
- 全部子建筑追平当前主建筑等级后才允许升级主建筑。
- Clubhouse 最高 Lv.10；其他建筑最高 Lv.5。
- 非 Clubhouse 主建筑升级目标不得高于 Clubhouse 当前等级。
- Clubhouse 未解锁时提示 `需要先将帮派树提升至 Lv.40 解锁 Clubhouse`。
- Clubhouse 等级不足时提示 `需要先将 Clubhouse 提升至 Lv.N`。
- 三资源为 `money`、`oil`、`materials`；第一版所有升级成本仅消耗钱，但结构和 UI 必须支持三资源。
- 修车厂/商业街产钱，加油站产油，金属加工厂产物资；回收厂和 Clubhouse 不生产。
- 资源每 10 秒结算，离线最多 8 小时，新解锁生产建筑不得追溯解锁前收益。
- 帮派声望每 10 秒 +1，离线最多 8 小时，总声望仍封顶 1,470。
- 城市存档键保持 `dobe-city-progression-v1`，版本升为 2，并严格执行 Clubhouse 等级约束。
- v1 迁移不追溯资源收益；迁移时间作为资源生产基准。
- 重置账号使用同一 `now` 重置帮派、资源、生产时间和主/子建筑。
- 本次创建 JSON 配置契约和校验；不创建配置 EXE。
- 不新增第三方依赖。
- 子代理不得 commit/push；父代理审查通过后分段提交。
- 最终普通推送 `main` 并快进更新 `gh-pages`，禁止 force push。

---

### Task 1: 可编辑经济配置与纯资源规则

**Files:**

- Modify: `tsconfig.app.json`
- Create: `src/config/economy.config.json`
- Create: `src/config/economyConfig.ts`
- Create: `src/config/economyConfig.test.ts`
- Create: `src/game/resourceEconomy.ts`
- Create: `src/game/resourceEconomy.test.ts`

**Interfaces:**

```ts
export const RESOURCE_TYPES = ['money', 'oil', 'materials'] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]

export interface ResourceWallet {
  money: number
  oil: number
  materials: number
}

export type ResourceCost = ResourceWallet

export interface ProductionConfig {
  resource: ResourceType
  basePerTick: number
  childLevelStep: number
  bonusPerStep: number
}

export type BuildingProgressByIdLike = Readonly<
  Record<BuildingId, { childLevels: readonly number[] }>
>

export interface ResourceSettlement {
  wallet: ResourceWallet
  earned: ResourceWallet
  nextUpdatedAt: number
}

export interface EconomyConfig {
  version: 1
  resourceTickSeconds: 10
  maxOfflineSeconds: 28_800
  production: Partial<Record<BuildingId, ProductionConfig>>
  childUpgradeCostByTargetLevel: Record<BuildingLevel, ResourceCost>
  buildingUpgradeCostByTargetLevel: Partial<Record<BuildingLevel, ResourceCost>>
}

export function parseEconomyConfig(value: unknown): EconomyConfig
export const economyConfig: EconomyConfig
export const EMPTY_WALLET: ResourceWallet

export function canAfford(wallet: ResourceWallet, cost: ResourceCost): boolean
export function subtractCost(
  wallet: ResourceWallet,
  cost: ResourceCost,
): ResourceWallet
export function getBuildingProductionPerTick(
  buildingId: BuildingId,
  childLevels: readonly number[],
): ResourceWallet
export function settleResourceProduction(input: {
  wallet: ResourceWallet
  buildingProgress: BuildingProgressByIdLike
  activeProducerIds: readonly BuildingId[]
  lastUpdatedAt: number
  now: number
}): ResourceSettlement
```

- [x] **Step 1: 启用 JSON 导入并写配置 RED**

在 `tsconfig.app.json` 增加：

```json
"resolveJsonModule": true
```

先创建测试，断言：

```ts
expect(economyConfig.resourceTickSeconds).toBe(10)
expect(economyConfig.maxOfflineSeconds).toBe(28_800)
expect(economyConfig.production['repair-shop']).toEqual({
  resource: 'money',
  basePerTick: 1,
  childLevelStep: 5,
  bonusPerStep: 1,
})
expect(economyConfig.childUpgradeCostByTargetLevel[1]).toEqual({
  money: 5,
  oil: 0,
  materials: 0,
})
expect(economyConfig.buildingUpgradeCostByTargetLevel[10]?.money).toBe(1250)
```

Run: `npm.cmd test -- src/config/economyConfig.test.ts`

Expected: FAIL because config files do not exist.

- [x] **Step 2: 写 JSON 与严格解析器**

JSON 数值逐字复制设计规格。解析器：

- 根对象、`version === 1`、tick/offline 正整数。
- production 只允许四个指定建筑和三种资源。
- 1–10 子建筑成本完整。
- 2–10 主建筑成本完整。
- 每个 cost 精确包含三个非负有限整数。
- 错误抛出 `Error('Invalid economy config: <path>')`，路径指出第一个无效字段。

- [x] **Step 3: 覆盖坏配置**

测试：

```ts
expect(() => parseEconomyConfig({})).toThrow('Invalid economy config: version')
expect(() =>
  parseEconomyConfig({
    ...valid,
    childUpgradeCostByTargetLevel: {
      ...valid.childUpgradeCostByTargetLevel,
      1: { money: -1, oil: 0, materials: 0 },
    },
  }),
).toThrow('childUpgradeCostByTargetLevel.1.money')
```

同时覆盖未知生产建筑、错误资源、缺失 level 10、浮点/Infinity。

- [x] **Step 4: 写钱包和生产 RED**

断言：

```ts
expect(canAfford({ money: 5, oil: 0, materials: 0 }, cost5)).toBe(true)
expect(subtractCost({ money: 5, oil: 2, materials: 3 }, cost5)).toEqual({
  money: 0,
  oil: 2,
  materials: 3,
})
expect(getBuildingProductionPerTick('repair-shop', [1, 1, 1, 1, 1])).toEqual({
  money: 2,
  oil: 0,
  materials: 0,
})
```

资源结算覆盖 9.999 秒为 0、10 秒一 tick、25 秒两 tick并保留 5 秒余量、8 小时封顶、无 active producer 为 0、非法时间 no-op。

- [x] **Step 5: 实现纯资源规则**

生产总额：

```ts
perTick =
  basePerTick + Math.floor(sum(childLevels) / childLevelStep) * bonusPerStep
```

结算使用完整 tick；达到离线上限时 `nextUpdatedAt = now`，否则保留余量：

```ts
nextUpdatedAt = lastUpdatedAt + ticks * tickMs
```

- [x] **Step 6: 验证**

Run:

```powershell
npm.cmd test -- src/config/economyConfig.test.ts src/game/resourceEconomy.test.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: all exit 0.

### Task 2: 独立子建筑领域、v2 迁移与原子 Store

**Files:**

- Modify: `src/game/cityTypes.ts`
- Rewrite: `src/game/buildingUpgrade.ts`
- Rewrite: `src/game/buildingUpgrade.test.ts`
- Modify: `src/store/cityProgressMigration.ts`
- Modify: `src/store/cityProgressMigration.test.ts`
- Rewrite: `src/store/useCityStore.ts`
- Rewrite: `src/store/useCityStore.test.ts`
- Modify: `src/game/resetAccount.ts`
- Modify: `src/game/resetAccount.test.ts`
- Modify: `src/ui/BuildingPanel.tsx` (temporary compile bridge)
- Modify: `src/scene/city/BuildingVisual.tsx` (temporary compile bridge)
- Modify: `src/scene/city/buildingFragmentCatalog.ts` (temporary compile bridge)

**Interfaces:**

```ts
export type ChildBuildingLevel = 0 | BuildingLevel

export interface BuildingProgress {
  level: BuildingLevel
  childLevels: ChildBuildingLevel[]
}

export const NON_CLUBHOUSE_MAX_LEVEL = 5
export const CLUBHOUSE_MAX_LEVEL = 10

export function getBuildingChildCount(id: BuildingId): 5 | 10
export function getBuildingMaxLevel(id: BuildingId): BuildingLevel
export function createInitialBuildingProgress(): BuildingProgressById
export function normalizeBuildingProgressById(
  value: unknown,
  now?: number,
): BuildingProgressById
export function normalizeCityDurableState(
  value: unknown,
  now?: number,
): CityDurableState
export function migrateCityState(
  persistedState: unknown,
  persistedVersion: number,
  now?: number,
): CityDurableState
```

Store:

```ts
interface CityState extends CityDurableState {
  selectedBuildingId: BuildingId | null
  selectBuilding(id: BuildingId): void
  clearSelection(): void
  syncResourceProduction(now: number, gangLevel: number): void
  upgradeChildBuilding(
    id: string,
    childIndex: number,
    gangLevel: number,
    now: number,
  ): void
  upgradeMainBuilding(id: string, gangLevel: number, now: number): void
  // Temporary compile bridge removed in Task 5.
  completeNextFragment(id: string): void
  confirmBuildingLevelUp(id: string): void
  reset(now?: number): void
}
```

Pure decisions:

```ts
export type UpgradeBlockReason =
  | 'ready'
  | 'building-locked'
  | 'child-at-main-level'
  | 'children-not-caught-up'
  | 'building-maxed'
  | 'clubhouse-locked'
  | 'clubhouse-too-low'
  | 'insufficient-resources'

export interface ChildUpgradeDecisionInput {
  buildingId: BuildingId
  childIndex: number
  progress: BuildingProgress
  wallet: ResourceWallet
  gangLevel: number
}

export interface MainUpgradeDecisionInput {
  buildingId: BuildingId
  progress: BuildingProgress
  clubhouseProgress: BuildingProgress
  wallet: ResourceWallet
  gangLevel: number
}

export function getChildUpgradeDecision(
  input: ChildUpgradeDecisionInput,
): UpgradeDecision
export function getMainUpgradeDecision(
  input: MainUpgradeDecisionInput,
): UpgradeDecision
```

- [x] **Step 1: 写 5/10 槽和等级门槛 RED**

断言：

```ts
expect(getBuildingChildCount('repair-shop')).toBe(5)
expect(getBuildingChildCount('clubhouse')).toBe(10)
expect(getBuildingMaxLevel('repair-shop')).toBe(5)
expect(getBuildingMaxLevel('clubhouse')).toBe(10)
expect(createInitialBuildingProgress()['repair-shop']).toEqual({
  level: 1,
  childLevels: [0, 0, 0, 0, 0],
})
```

覆盖自由选择 index 4、子建筑达到主建筑时阻止、全部追平、非 Clubhouse Lv.5、Clubhouse Lv.10、Clubhouse 锁定/不足和资源不足。

Run: `npm.cmd test -- src/game/buildingUpgrade.test.ts`

Expected: FAIL against legacy completedFragments model.

- [x] **Step 2: 实现纯升级判定**

判定不得读取 Zustand。`UpgradeDecision` 至少包含：

```ts
interface UpgradeDecision {
  reason: UpgradeBlockReason
  targetLevel: number | null
  cost: ResourceCost | null
  missingResources: ResourceCost
}
```

主建筑判定顺序严格为：自身解锁→满级→子建筑追平→Clubhouse 解锁→Clubhouse 等级→资源。

- [x] **Step 3: 写 v1→v2 迁移 RED**

旧输入：

```ts
{
  buildingProgress: {
    'repair-shop': { level: 3, completedFragments: 2 },
    clubhouse: { level: 2, completedFragments: 0 }
  }
}
```

断言：

- repair 主建筑严格不高于迁移后 Clubhouse。
- repair 只有 5 槽。
- 已完成旧碎片映射为目标/允许等级，其余旧可见碎片映射为旧等级，未出现槽位为 0。
- wallet 为 0。
- active producer 仅 repair。
- `lastResourceUpdatedAt === MIGRATION_TIME`。

同时覆盖 v2 坏数组、负资源、未知 active producer、非有限时间。

- [x] **Step 4: 实现迁移和 persist version 2**

Zustand 配置：

```ts
{
  name: CITY_STORAGE_KEY,
  version: 2,
  storage: createJSONStorage(() => createSafeStorage()),
  migrate: (persisted, version) =>
    migrateCityState(persisted, version, Date.now()),
  partialize: ({
    buildingProgress,
    resources,
    lastResourceUpdatedAt,
    activeProducerIds,
  }) => ({
    buildingProgress,
    resources,
    lastResourceUpdatedAt,
    activeProducerIds,
  }),
  merge: (persisted, current) => ({
    ...current,
    ...normalizeCityDurableState(persisted, Date.now()),
  }),
}
```

- [x] **Step 5: 写原子 Store RED**

覆盖：

- `syncResourceProduction` 先按旧 active producer 结算，再激活当前新解锁生产建筑。
- 新激活 commercial 不追溯过去 8 小时。
- `upgradeChildBuilding('repair-shop', 4, ...)` 先结算旧产量，再扣 5 钱并只把 index 4 从 0→1。
- 余额不足保持完整 state 引用。
- `upgradeMainBuilding` 在五个 repair 子建筑都 Lv.1、Clubhouse Lv.2 且余额足够时扣钱并把主建筑 1→2。
- Clubhouse 未解锁/等级不足严格 no-op。
- 未知 ID/index、非法 now no-op。

- [x] **Step 6: 实现 Store**

把“结算→判定→扣费→升级”放在一次 `set((state) => ...)`。不调用另一个 action，避免两次通知。

更新 `resetAccount(now)`：

```ts
useCityStore.getState().reset(now)
useGangStore.getState().reset(now)
```

- [x] **Step 7: 迁移期间兼容消费者**

Task 3–5 完成前，旧 UI/3D 仍引用固定顺序 API。本任务必须在同一提交内增加最小编译桥接，而不是把旧字段写回 v2 存档：

```ts
export function getCaughtUpChildCount(progress: BuildingProgress): number {
  return progress.childLevels.filter((level) => level === progress.level).length
}
```

- `completeNextFragment(id)` 临时、免费地升级第一个低于主建筑的子建筑。
- `confirmBuildingLevelUp(id)` 临时只在全部子建筑追平时提升主建筑。
- 旧 UI/3D 只能通过 `getCaughtUpChildCount` 读取顺序进度；禁止给最终 `BuildingProgress` 增加 `completedFragments`。
- 两个桥接 action 只为 Task 2–4 的中间提交保持 TypeScript/现有组件可运行，不写入额外存档字段，不用于 Task 5 最终 UI，并在 Task 5 删除。

- [x] **Step 8: 验证**

Run:

```powershell
npm.cmd test -- src/game/buildingUpgrade.test.ts src/store/cityProgressMigration.test.ts src/store/useCityStore.test.ts src/game/resetAccount.test.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: all exit 0.

### Task 3: 10 秒帮派挂机、资源控制器与 HUD

**Files:**

- Modify: `src/game/gangProgression.ts`
- Modify: `src/game/gangProgression.test.ts`
- Modify: `src/store/useGangStore.test.ts`
- Create: `src/game/EconomyIdleController.tsx`
- Create: `src/game/EconomyIdleController.test.tsx`
- Modify: `src/ui/CityHud.tsx`
- Modify: `src/ui/CityHud.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**

```ts
export const REPUTATION_TICK_SECONDS = 10
export const REPUTATION_PER_TICK = 1

export function getCurrentProductionRates(
  buildingProgress: BuildingProgressById,
  activeProducerIds: readonly BuildingId[],
): ResourceWallet
```

- [x] **Step 1: 写 10 秒帮派 RED**

断言常量和结算：

```ts
expect(REPUTATION_TICK_SECONDS).toBe(10)
expect(REPUTATION_PER_TICK).toBe(1)
expect(calculateIdleSettlement(BASE, BASE + 9_999)).toEqual({
  earnedReputation: 0,
  nextUpdatedAt: BASE,
})
expect(calculateIdleSettlement(BASE, BASE + 25_000)).toEqual({
  earnedReputation: 2,
  nextUpdatedAt: BASE + 20_000,
})
```

8 小时为 2,880 声望，再由 Store 封顶到 1,470。

- [x] **Step 2: 实现帮派结算并更新 Store 测试**

删除 `REPUTATION_PER_SECOND`。所有 HUD/测试改用 tick 常量，系统时间倒退、Infinity 和满级行为不回归。

- [x] **Step 3: 写资源控制器 RED**

使用 fake timers：

- mount 立即同步一次。
- 每秒检查，但 9 秒钱包仍 0。
- 第 10 秒 repair 钱为 1。
- visibility visible 触发同步。
- StrictMode 不重复收益。
- unmount 清理 timer/listener。

- [x] **Step 4: 实现 `EconomyIdleController`**

控制器从 gang store 读取最新声望计算 gang level，再调用：

```ts
syncResourceProduction(Date.now(), gangLevel)
```

App 在 `GangIdleController` 后挂载该控制器。

- [x] **Step 5: 写 HUD RED**

初始断言：

```ts
expect(screen.getByText('+1 声望/10秒')).toBeInTheDocument()
expect(screen.getByText('钱 0')).toBeInTheDocument()
expect(screen.getByText('油 0')).toBeInTheDocument()
expect(screen.getByText('物资 0')).toBeInTheDocument()
expect(screen.getByText('钱 +1/10秒')).toBeInTheDocument()
```

激活 commercial/gas/metal 且提高子建筑等级后，断言三种当前产量。

- [x] **Step 6: 实现 HUD 与 App**

资源数字使用整数格式；无产出资源仍显示 `+0/10秒`。资源区使用可读文本，不只用图标。

- [x] **Step 7: 验证**

Run:

```powershell
npm.cmd test -- src/game/gangProgression.test.ts src/store/useGangStore.test.ts src/game/EconomyIdleController.test.tsx src/ui/CityHud.test.tsx src/App.test.tsx
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: all exit 0.

### Task 4: 按独立子建筑等级渲染 3D

**Files:**

- Modify: `src/scene/city/buildingFragmentCatalog.ts`
- Modify: `src/scene/city/buildingFragmentCatalog.test.ts`
- Modify: `src/scene/city/BuildingVisual.tsx`
- Modify: `src/scene/city/BuildingVisual.test.tsx`
- Modify: `src/scene/city/BuildingModel.tsx`
- Modify: `src/scene/city/BuildingModel.test.tsx`

**Interfaces:**

```ts
export function getBuildingFragments(
  kind: BuildingKind,
): readonly BuildingFragmentBlueprint[]

export function getRenderedBuildingFragments(
  kind: BuildingKind,
  progress: BuildingProgress,
  animatedFragmentId?: string,
): readonly RenderedBuildingFragment[]
```

- [x] **Step 1: 写 5/10 蓝图和 Lv.0 RED**

断言：

```ts
expect(getBuildingFragments('repair')).toHaveLength(5)
expect(getBuildingFragments('commercial')).toHaveLength(10)

const rendered = getRenderedBuildingFragments('repair', {
  level: 1,
  childLevels: [0, 0, 0, 0, 0],
})
expect(rendered).toHaveLength(5)
expect(rendered.every(({ state }) => state === 'scaffold')).toBe(true)
```

混合 `[1, 0, 1, 0, 0]` 时 index 0/2 按 Lv.1 parts，其余脚手架；父建筑 Lv.3、子建筑 `[1,2,3...]` 必须产生不同高度签名。

- [x] **Step 2: 重排修车厂五槽**

修车厂使用 5 列×1 行，anchor 在 footprint 内沿 Z 居中；其他建筑保持 5×2。更新几何预算与 AABB 测试，保证零越界。

- [x] **Step 3: 实现独立等级渲染**

每个 blueprint：

```ts
if (childLevel === 0) {
  return scaffold
}
return renderFragmentParts(blueprint, childLevel)
```

只有 `blueprint.id === animatedFragmentId` 且 childLevel > 0 时 state=`target`/animate=true；其他已建成子建筑 state=`current`。

- [x] **Step 4: 改会话动画检测**

`BuildingVisual` 比较前后 `childLevels`：

- 数组长度相同。
- 恰好一个 index 增加 1。
- 主建筑 level 不要求不变，但主建筑单独升级不改变 childLevels，因此不会动画。
- 多项变化（rehydrate/reset）不动画。

- [x] **Step 5: 验证**

Run:

```powershell
npm.cmd test -- src/scene/city/buildingFragmentCatalog.test.ts src/scene/city/BuildingVisual.test.tsx src/scene/city/BuildingModel.test.tsx src/scene/city/AnimatedBuildingFragment.test.tsx
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: all exit 0.

### Task 5: 自由选择升级工作台与 Clubhouse 提示

**Files:**

- Rewrite: `src/ui/BuildingPanel.tsx`
- Rewrite: `src/ui/BuildingPanel.test.tsx`
- Modify: `src/App.css`
- Modify: `src/game/buildingUpgrade.ts`
- Modify: `src/store/useCityStore.ts`

**Interfaces:**

- Consumes:
  - `getChildUpgradeDecision`
  - `getMainUpgradeDecision`
  - `upgradeChildBuilding`
  - `upgradeMainBuilding`
  - `ResourceWallet`
- Produces accessible buttons:
  - `升级 <子建筑名> 至 Lv.N`
  - `升级主建筑至 Lv.N`

- [x] **Step 1: 写修车厂 5 卡片 RED**

初始选中修车厂，断言：

- `等级 1 / 5`
- 5 张 `.building-panel__child-card`
- 每张 `未建设 · Lv.0 / 1`
- 任意卡片按钮成本 `钱 5`
- 不再出现旧 `progressbar`、`completedFragments` 或“升级子建筑 1/N”。

- [x] **Step 2: 写自由选择与原子消费 RED**

给钱包 5 钱，先点第五张：

```ts
await user.click(screen.getByRole('button', { name: '升级 诊断工位 至 Lv.1' }))
expect(childLevels).toEqual([0, 0, 0, 0, 1])
expect(resources.money).toBe(0)
```

具体第五个名称以修车厂裁剪后的 blueprint 为准，测试从 `getBuildingFragments('repair')[4].name` 构造 accessible name，禁止硬编码错误名称。

- [x] **Step 3: 写主建筑判定 UI RED**

覆盖：

- 子建筑未全 Lv.1：`还有 N 个子建筑未达到 Lv.1`。
- 全部 Lv.1、gang Lv.1：显示精确 Clubhouse 未解锁提示。
- gang Lv.40、Clubhouse Lv.1：显示 `需要先将 Clubhouse 提升至 Lv.2`。
- Clubhouse Lv.2、钱不足：显示缺少钱。
- 条件满足：启用 `升级主建筑至 Lv.2`，点击扣费并升到2。
- repair Lv.5：显示 `已达到最高等级 Lv.5`。
- Clubhouse Lv.10：显示 `已达到最高等级 Lv.10`。

- [x] **Step 4: 实现面板**

结构：

```tsx
<section className="building-panel__economy-summary" />
<section className="building-panel__main-upgrade" />
<ul className="building-panel__child-grid">
  <li className="building-panel__child-card" />
</ul>
```

每次按钮点击传 `Date.now()` 和当前 gang level。成本展示函数固定顺序：钱→油→物资，只隐藏值为0的项；全0显示“免费”。

- [x] **Step 5: 删除迁移兼容层**

删除：

- `completedFragments`
- `completeNextFragment`
- `confirmBuildingLevelUp`
- `getRequiredFragmentCount`
- `getBuildingUpgradePercent`
- `isBuildingReadyToLevelUp`

全仓 `rg` 不得有产品代码引用；历史文档和验收 JSON 可保留旧文本。

- [x] **Step 6: 响应式样式**

桌面子建筑卡片 2 列；窄屏 1 列。面板保持现有最大高度和滚动，成本/提示可换行，不产生横向滚动。新按钮加入 focus-visible 和 reduced-motion。

- [x] **Step 7: 验证**

Run:

```powershell
npm.cmd test -- src/ui/BuildingPanel.test.tsx src/App.test.tsx
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: all tests pass and commands exit 0.

### Task 6: 文档、浏览器验收、分段提交与 Pages

**Files:**

- Modify: `README.md`
- Modify: `session/session.md`
- Modify: `session/requirements/gang-tree-idle-unlocks.md`
- Modify: `docs/superpowers/plans/2026-07-23-independent-subbuilding-economy.md`
- Create: `.superpowers/sdd/independent-economy-cdp.mjs`
- Create: `.superpowers/sdd/independent-economy-results.json`
- Create: `.superpowers/sdd/independent-economy-initial.png`
- Create: `.superpowers/sdd/independent-economy-free-choice.png`
- Create: `.superpowers/sdd/independent-economy-gate.png`
- Create: `.superpowers/sdd/independent-economy-resources.png`
- Create: `.superpowers/sdd/independent-economy-mobile.png`
- Create: `.superpowers/sdd/independent-economy-report.md`

**Interfaces:**

- HUD: `+1 声望/10秒`, `钱`, `油`, `物资`
- Child action: `升级 <name> 至 Lv.N`
- Main action: `升级主建筑至 Lv.N`
- Storage: `dobe-city-progression-v1`, version 2

- [x] **Step 1: fresh 工程门禁**

Run:

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Expected: all exit 0; production asset refs start `/DobeDemo/`.

- [x] **Step 2: 安全 CDP 预检**

脚本必须：

- 检查并跳过占用端口，不终止未知 PID。
- Vite 使用 `--strictPort`。
- 只记录并终止脚本自己 spawn 的 PID。
- Chrome 使用独立临时 profile，删除前验证 temp 前缀。
- 结果 JSON 只记录 basename，不记录绝对路径。
- error 只记录白名单 name/code；原始 stack 仅 stderr。
- 失败非零退出。
- assertion self-test 对空坏数据全部失败，并包含错误路径脱敏自检。

- [x] **Step 3: 浏览器流程**

至少断言：

1. fresh v2 存档：repair Lv.1、5 子建筑全0、资源全0。
2. 10秒后钱精确 +1，9.999秒无收益由纯测试覆盖。
3. 注入钱后先升级 repair 第5个子建筑，数组变为 `[0,0,0,0,1]`。
4. 第5个 3D 槽 ROI 变化，其他 child state 不变。
5. 五个全部 Lv.1 后显示 Clubhouse 未解锁精确提示。
6. 注入 gang Lv.40 后显示 Clubhouse Lv.2 门槛。
7. 完成 Clubhouse 十个 Lv.1 子建筑、升 Clubhouse Lv.2，再升 repair Lv.2。
8. 刷新后钱包、active producers、主/子等级持久。
9. 激活商业街/加油站/金属加工厂并等待10秒，钱/油/物资按配置增长。
10. 非 Clubhouse Lv.5、Clubhouse Lv.10 上限注入后按钮禁用。
11. 390×844 无横向溢出且可滚动。
12. dev/CDP 端口释放、临时 profile 删除、仅 owned PID 被 targeting。

- [x] **Step 4: 文档**

README 写明：

- 5/10 子建筑、Lv.0、自由升级。
- 三资源生产和离线8小时。
- 10秒帮派声望。
- Clubhouse 上限/门槛。
- `src/config/economy.config.json` 是后续 EXE 契约。
- 当前测试数量和验收脚本。

session/requirements 删除旧的固定顺序碎片描述，避免并存矛盾。

- [x] **Step 5: 分段提交与终审**

父代理按审查通过的逻辑分段提交：

1. config + pure rules。
2. v2 migration + atomic store。
3. idle + HUD。
4. independent 3D。
5. free-choice panel。
6. acceptance + docs。

运行全分支审查；修复所有 Critical/Important，再 fresh 全门禁。

- [x] **Step 6: 推送和 Pages**

1. 普通推送 `main`。
2. fresh `dist` 通过独立临时 index 生成 `gh-pages` 快进提交。
3. 等待最新 Pages build 的 commit 精确匹配且 status=`built`。
4. 公开 HTML、当前 JS/CSS HTTP 200。
5. 真实 Chrome 加载公开 URL，截图可见三资源 HUD 和修车厂五子建筑面板。
6. 更新发布报告和 session，提交并再次普通推送 `main`。
