# Progressive Building Upgrade Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将六座建筑改造成“逐级解锁槽位、当前槽逐级建设、总进度达到 100% 后独立确认主建筑升级”的完整闭环，并安全迁移 v2 存档、加入展示型建筑战力和可重复调试/发布验收。

**Architecture:** 配置解析器只负责经济数值与战力 JSON，`buildingUpgrade.ts` 集中固定领域规则，Zustand Store 在单次 `set` 中完成结算、重查、扣费和升级。建筑面板只保存会话级选择/确认状态，3D 只消费领域层给出的已解锁前缀；跨城市/帮派调试操作由独立协调器按同一个 `now` 调用两个 Store。

**Tech Stack:** React 19、TypeScript 6、Zustand 5 persist、Three.js/R3F、Vitest 4、Testing Library、Vite 8、Chrome CDP、GitHub Pages

## Global Constraints

- 计划日期固定为 `2026-07-24`。
- 六类建筑主等级统一为 `1...10`，`BUILDING_MAX_LEVEL = 10`；子建筑等级为 `0...10`，且永不高于所属主建筑。
- 修车厂固定容量为 blueprint 前 5 槽，主 Lv.1–5 分别解锁 1–5 槽，主 Lv.6–10 始终为 5 槽；其他建筑固定容量为 10，主 Lv.1–10 分别解锁 1–10 槽。
- 未解锁槽位不得出现在 DOM、3D、脚手架、标签、焦点顺序或程序化升级入口中；已解锁 Lv.0 槽显示脚手架。
- 总进度只统计已解锁槽：`completedSteps = sum(unlocked childLevels)`、`totalSteps = unlockedCount * mainLevel`；精确相等才算 100%，可见非完成百分比向下取整。
- 主升级 reason 严格短路顺序为 `building-locked` → `building-maxed` → `children-not-caught-up` → 计算目标等级 → `repair-shop-too-low` → `clubhouse-locked` → `clubhouse-too-low` → `insufficient-resources` → `ready`。
- 目标 Lv.2–5：修车厂与 Clubhouse 无外部建筑门槛，其余四栋不得高于修车厂；目标 Lv.6–10：所有非 Clubhouse 建筑只受 Clubhouse Lv.40 解锁与 Clubhouse 当前等级门槛，不叠加修车厂门槛。
- 子升级 reason 严格顺序为 `building-locked` → `child-locked` → `child-at-main-level` → `insufficient-resources` → `ready`；非法或隐藏下标统一为 `child-locked`。
- 建筑原帮派树解锁等级保持修车厂 1、废车回收厂 8、商业街 16、金属加工厂 24、加油站 32、Clubhouse 40。
- `src/config/economy.config.json` schema 版本为 2；生产、10 秒 tick、28,800 秒离线上限、1–10 子升级成本和 2–10 主升级成本数值不变。
- `buildingPowerById` 必须精确包含六个 buildingId 及字符串键 `"1"` 至 `"10"`；值为有限、非负、安全整数并在同一建筑内严格递增。战力只展示，不参与生产、进度、解锁或升级判定。
- 新账号与重置钱包固定为 `{ money: 10000, oil: 0, materials: 0 }`；城市存档键保持 `dobe-city-progression-v1`，persist 版本升为 3，且仍只持久化四个 durable 字段。
- v2→v3 只对新规则隐藏并清零的旧子等级退款，逐级使用冻结的 v2 子升级成本快照；不退主建筑、不退仍解锁槽、不改声望。v3 rehydrate 规范化但绝不重复退款；v1 必须先映射到 v2 形态再执行同一 v3 清零退款。
- 资源结算、迁移退款和调试加钱均使用非负安全整数与逐项饱和加法，最大值为 `Number.MAX_SAFE_INTEGER`。
- 两个升级动作对合法请求都在同一次 Zustand `set` 内执行 settle → recheck → deduct → upgrade，并返回 `UpgradeActionResult`；失败最多保留合法结算结果，不扣费、不改等级。
- UI 点击“升级主建筑”只进入确认页，不结算、不扣费、不升级；只有确认按钮调用 Store，Store 以点击时最新状态重查。
- 调试“解锁帮派树”把声望设为 1470/Lv.50，先按旧生产者结算再同步新生产者，不追溯；“钱/油/物资各 +10000”先结算再饱和增加，可重复执行且无需二次确认。
- 保持每 10 秒声望 +1、每 10 秒资源 tick、8 小时离线上限、现有生产公式、新生产者不追溯、400ms 子升级动画、rehydrate 不播放动画、重置二次确认、响应式和可访问性。
- 不新增第三方依赖；不实现配置 EXE、服务器账号、云存档、防作弊、倒计时、付费加速或战力玩法。
- 所有 Node/npm 验证命令在 Windows 使用 `npm.cmd`；每个任务结束必须运行全量 `npm.cmd test` 与 `npm.cmd run typecheck`，并保持中间提交可运行。
- 每个任务形成独立可审查提交；禁止 force push。最终仅普通 push `main`，`gh-pages` 由 fresh `dist` 通过独立临时 index 更新，不能把 `dist` 或临时 Chrome/CDP 文件提交到 `main`。

---

## File Map and Intermediate-Commit Strategy

最终会修改：

- `src/config/economy.config.json`：保留既有经济数值，升为 v2 并加入六栋建筑的 Lv.1–10 战力。
- `src/config/economyConfig.ts`、`src/config/economyConfig.test.ts`：v2 类型、精确键校验、严格递增战力和 `getBuildingPower`。
- `src/game/buildingUpgrade.ts`、`src/game/buildingUpgrade.test.ts`：统一 max10、固定容量/已解锁前缀、进度、子升级与主升级纯判定。
- `src/game/resourceEconomy.ts`、`src/game/resourceEconomy.test.ts`：可复用饱和钱包加法，防止生产/调试/迁移溢出。
- `src/store/cityProgressMigration.ts`、`src/store/cityProgressMigration.test.ts`：v3 规范化、v2 成本快照退款、v1 链式迁移和 v3 不重复退款。
- `src/store/useCityStore.ts`、`src/store/useCityStore.test.ts`：初始 10000、v3 persist、返回结果的原子升级、调试资源动作。
- `src/store/useGangStore.ts`、`src/store/useGangStore.test.ts`：幂等的 Lv.50 调试动作。
- `src/game/resetAccount.test.ts`：重置后的 v3 钱包和完整初始状态。
- `src/game/debugActions.ts`、`src/game/debugActions.test.ts`：跨 Store 调试协调器，同一次读取的 `now`，不追溯生产。
- `src/ui/BuildingPanel.tsx`、`src/ui/BuildingPanel.test.tsx`：会话状态机、单选槽位、共享按钮、progressbar、确认页、门槛文案与焦点。
- `src/ui/SettingsPanel.tsx`、`src/ui/SettingsPanel.test.tsx`：两个即时调试按钮、独立重置确认、`aria-live`。
- `src/scene/city/buildingFragmentCatalog.ts`、`src/scene/city/buildingFragmentCatalog.test.ts`：只构建已解锁槽的渲染结果及全等级边界。
- `src/scene/city/BuildingVisual.tsx`、`src/scene/city/BuildingVisual.test.tsx`：只对一次会话中恰好一个已解锁槽 `+1` 触发动画。
- `src/scene/city/BuildingModel.tsx`、`src/scene/city/BuildingModel.test.tsx`：把 `buildingId` 传入渲染目录并验证隐藏槽无 mesh。
- `src/App.tsx`、`src/App.test.tsx`、`src/App.css`：面板焦点回退目标、设置协调与桌面/390×844 样式。
- `README.md`、`session/session.md`、`session/requirements/gang-tree-idle-unlocks.md`、`session/requirements/city-building-upgrade-demo.md`：删除 Lv.5/全部槽可见等旧规则，登记 v3、战力、调试和验收证据。

最终会新增：

- `.superpowers/sdd/progressive-building-upgrade-flow-cdp.mjs`：安全、可重复的本地 Chrome CDP 全流程。
- `.superpowers/sdd/progressive-building-upgrade-flow-results.json`：本地脚本实际生成的脱敏结果。
- `.superpowers/sdd/progressive-building-upgrade-flow-report.md`：门禁、浏览器、审查、发布与公开复验证据。
- `.superpowers/sdd/progressive-building-upgrade-flow-public-cdp.mjs`：公开 Pages 关键流程复验。
- `.superpowers/sdd/progressive-building-upgrade-flow-public-results.json`：公开复验脚本实际生成的脱敏结果。

本地和公开脚本会生成 PNG 证据，但 `.superpowers/sdd/.gitignore` 当前为 `*`，因此图片保持本地、不进入提交；报告只记录 basename、尺寸与断言结果。

为保证每个中间提交都通过全量测试：

1. Task 1 先把当前旧规则复制到临时 `src/game/legacyBuildingUpgrade.ts`，仅让尚未改造的 Store/迁移/UI 继续引用它；新的最终 `buildingUpgrade.ts` 可以一次建立完整 v3 纯接口。
2. Task 2 将 Store 与迁移切到最终纯规则；旧 BuildingPanel 仍通过临时模块运行，`BuildingPanel.test.tsx` 在 setup 中显式设为旧用例需要的钱包值，避免初始 10000 改变旧测试含义。
3. Task 3 在同一提交内完成 BuildingPanel 状态机并删除 `legacyBuildingUpgrade.ts`；全仓产品代码不得再引用临时接口。
4. Task 4 只改变 3D 消费层；Task 3 已经只显示已解锁前缀，因此 UI 与 3D 的短暂中间差异不会产生不可升级的坏状态。
5. Task 5 再接入跨 Store 调试协调器；Task 1–4 不依赖调试入口。

### Task 1: Economy Config v2 and Pure Progressive Rules

**Files:**

- Modify: `src/config/economy.config.json`
- Modify: `src/config/economyConfig.ts`
- Modify: `src/config/economyConfig.test.ts`
- Rewrite: `src/game/buildingUpgrade.ts`
- Rewrite: `src/game/buildingUpgrade.test.ts`
- Create: `src/game/legacyBuildingUpgrade.ts`
- Modify: `src/store/cityProgressMigration.ts`（只把旧规则 import 指向临时适配器）
- Modify: `src/store/useCityStore.ts`（只把旧规则 import 指向临时适配器）
- Modify: `src/ui/BuildingPanel.tsx`（只把旧规则 import 指向临时适配器）

**Interfaces:**

- Consumes: `BuildingId`、`BuildingLevel`、`BuildingProgress`、`ResourceWallet`、`ResourceCost`、`isBuildingUnlocked`。
- Produces:

```ts
export const BUILDING_MAX_LEVEL = 10

export interface BuildingUpgradeProgress {
  unlockedChildCount: number
  completedSteps: number
  totalSteps: number
  ratio: number
  percent: number
  complete: boolean
}

export type ChildUpgradeBlockReason =
  | 'ready'
  | 'building-locked'
  | 'child-locked'
  | 'child-at-main-level'
  | 'insufficient-resources'

export interface ChildUpgradeDecisionInput {
  buildingId: BuildingId
  childIndex: number
  progress: BuildingProgress
  wallet: ResourceWallet
  gangLevel: number
}

export interface ChildUpgradeDecision {
  reason: ChildUpgradeBlockReason
  targetLevel: BuildingLevel | null
  cost: ResourceCost | null
  missingResources: ResourceCost
}

export type MainUpgradeBlockReason =
  | 'ready'
  | 'building-locked'
  | 'building-maxed'
  | 'children-not-caught-up'
  | 'repair-shop-too-low'
  | 'clubhouse-locked'
  | 'clubhouse-too-low'
  | 'insufficient-resources'

export interface MainUpgradeDecision {
  reason: MainUpgradeBlockReason
  targetLevel: BuildingLevel | null
  cost: ResourceCost | null
  missingResources: ResourceCost
  requiredBuildingId: BuildingId | null
  requiredBuildingLevel: BuildingLevel | null
}

export interface MainUpgradeDecisionInput {
  buildingId: BuildingId
  progress: BuildingProgress
  repairShopProgress: BuildingProgress
  clubhouseProgress: BuildingProgress
  wallet: ResourceWallet
  gangLevel: number
}

export function getBuildingChildCount(id: BuildingId): 5 | 10
export function getUnlockedChildCount(
  id: BuildingId,
  mainLevel: BuildingLevel,
): number
export function getBuildingUpgradeProgress(
  buildingId: BuildingId,
  progress: BuildingProgress,
): BuildingUpgradeProgress
export function getChildUpgradeDecision(
  input: ChildUpgradeDecisionInput,
): ChildUpgradeDecision
export function getMainUpgradeDecision(
  input: MainUpgradeDecisionInput,
): MainUpgradeDecision
export function getBuildingPower(
  buildingId: BuildingId,
  level: BuildingLevel,
): number
```

- Temporary compatibility: `legacyBuildingUpgrade.ts` exports the current Lv.5/Clubhouse-gated API unchanged and is deleted in Task 3.

- [x] **Step 1: Preserve the current consumers behind the temporary adapter**

Copy the current `buildingUpgrade.ts` implementation verbatim to `legacyBuildingUpgrade.ts`, then change only these imports:

```ts
// cityProgressMigration.ts, useCityStore.ts, BuildingPanel.tsx
import {
  getBuildingChildCount,
  getBuildingMaxLevel,
  getChildUpgradeDecision,
  getMainUpgradeDecision,
} from '../game/legacyBuildingUpgrade'
```

Use each file's existing relative path. This keeps the pre-v3 UI/Store behavior stable while the final module is rewritten.

- [x] **Step 2: Write config-v2 RED tests**

Add exact assertions:

```ts
expect(economyConfig.version).toBe(2)
expect(getBuildingPower('repair-shop', 1)).toBe(100)
expect(getBuildingPower('repair-shop', 10)).toBe(550)
expect(getBuildingPower('clubhouse', 10)).toBe(1150)

const missingLevel = structuredClone(economyConfig) as Record<string, unknown>
delete (missingLevel.buildingPowerById as Record<string, Record<string, number>>)[
  'repair-shop'
]['10']
expect(() => parseEconomyConfig(missingLevel)).toThrow(
  'Invalid economy config: buildingPowerById.repair-shop.10',
)
```

Also test an extra buildingId, extra level `"11"`, negative/unsafe/non-integer power, and equal/decreasing adjacent power.

- [x] **Step 3: Run config RED**

Run: `npm.cmd test -- src/config/economyConfig.test.ts`

Expected: FAIL because the current parser requires version 1 and has no `buildingPowerById`/`getBuildingPower`.

- [x] **Step 4: Implement the exact v2 JSON and parser**

Keep every existing production/cost object unchanged and append:

```json
"buildingPowerById": {
  "repair-shop": { "1": 100, "2": 130, "3": 165, "4": 205, "5": 250, "6": 300, "7": 355, "8": 415, "9": 480, "10": 550 },
  "recycling-yard": { "1": 120, "2": 155, "3": 195, "4": 240, "5": 290, "6": 345, "7": 405, "8": 470, "9": 540, "10": 615 },
  "commercial-street": { "1": 150, "2": 190, "3": 235, "4": 285, "5": 340, "6": 400, "7": 465, "8": 535, "9": 610, "10": 690 },
  "metalworking-plant": { "1": 180, "2": 225, "3": 275, "4": 330, "5": 390, "6": 455, "7": 525, "8": 600, "9": 680, "10": 765 },
  "gas-station": { "1": 160, "2": 202, "3": 249, "4": 301, "5": 358, "6": 420, "7": 487, "8": 559, "9": 636, "10": 718 },
  "clubhouse": { "1": 250, "2": 310, "3": 380, "4": 460, "5": 550, "6": 650, "7": 760, "8": 880, "9": 1010, "10": 1150 }
}
```

Parser uses `BUILDING_IDS` and `BUILDING_LEVELS` to reject missing/extra keys. Power parsing must use:

```ts
function parsePower(value: unknown, path: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    invalidConfig(path)
  }
  return value
}
```

After each building is parsed, loop levels 2–10 and reject `current <= previous` at the current level path.

Export the display-only lookup from `economyConfig.ts`; do not duplicate the
power table in the UI or domain module:

```ts
export function getBuildingPower(
  buildingId: BuildingId,
  level: BuildingLevel,
): number {
  const power = economyConfig.buildingPowerById[buildingId]?.[level]
  if (!Number.isSafeInteger(power)) {
    throw new Error(
      `Invalid economy config: buildingPowerById.${buildingId}.${level}`,
    )
  }
  return power
}
```

- [x] **Step 5: Write progressive-rule RED tests**

Cover all six max levels, repair unlock sequence `[1,2,3,4,5,5,5,5,5,5]`, other unlock sequence `[1,2,3,4,5,6,7,8,9,10]`, hidden child indices, exact progress and every main reason collision. Representative assertions:

```ts
expect(BUILDING_MAX_LEVEL).toBe(10)
expect(
  BUILDING_LEVELS.map((level) => getUnlockedChildCount('repair-shop', level)),
).toEqual([1, 2, 3, 4, 5, 5, 5, 5, 5, 5])

expect(
  getBuildingUpgradeProgress('commercial-street', {
    level: 3,
    childLevels: [3, 2, 1, 3, 3, 3, 3, 3, 3, 3],
  }),
).toEqual({
  unlockedChildCount: 3,
  completedSteps: 6,
  totalSteps: 9,
  ratio: 2 / 3,
  percent: (2 / 3) * 100,
  complete: false,
})
```

Use collision cases to prove order: locked+maxed returns `building-locked`; maxed+incomplete returns `building-maxed`; incomplete+repair low returns `children-not-caught-up`; target Lv.6 with gang 39 and low Clubhouse returns `clubhouse-locked`; target Lv.6 with gang 40 and low Clubhouse returns `clubhouse-too-low`; only then resources.

- [x] **Step 6: Run domain RED**

Run: `npm.cmd test -- src/game/buildingUpgrade.test.ts`

Expected: FAIL because the current module has split max levels, no unlocked-prefix/progress API, no `child-locked` or repair-shop gate.

- [x] **Step 7: Implement the minimal pure rules**

Implement progress defensively:

```ts
const unlockedChildCount = getUnlockedChildCount(buildingId, progress.level)
const completedSteps = progress.childLevels
  .slice(0, unlockedChildCount)
  .reduce((sum, level) => sum + Math.min(progress.level, Math.max(0, level)), 0)
const totalSteps = unlockedChildCount * progress.level
const ratio = totalSteps <= 0 ? 0 : Math.min(1, completedSteps / totalSteps)
return {
  unlockedChildCount,
  completedSteps,
  totalSteps,
  ratio,
  percent: ratio * 100,
  complete: totalSteps > 0 && completedSteps === totalSteps,
}
```

Main gate implementation must use this shape:

```ts
function blocked(
  reason: MainUpgradeBlockReason,
  targetLevel: BuildingLevel | null = null,
  cost: ResourceCost | null = null,
  requiredBuildingId: BuildingId | null = null,
  requiredBuildingLevel: BuildingLevel | null = null,
  wallet?: ResourceWallet,
): MainUpgradeDecision {
  const missingResources =
    cost && wallet
      ? {
          money: Math.max(0, cost.money - wallet.money),
          oil: Math.max(0, cost.oil - wallet.oil),
          materials: Math.max(0, cost.materials - wallet.materials),
        }
      : { ...EMPTY_WALLET }
  return {
    reason,
    targetLevel,
    cost,
    missingResources,
    requiredBuildingId,
    requiredBuildingLevel,
  }
}

if (!isBuildingUnlocked(buildingId, gangLevel)) return blocked('building-locked')
if (progress.level >= BUILDING_MAX_LEVEL) return blocked('building-maxed')
if (!getBuildingUpgradeProgress(buildingId, progress).complete) {
  return blocked('children-not-caught-up')
}
const targetLevel = (progress.level + 1) as BuildingLevel
if (
  targetLevel <= 5 &&
  buildingId !== 'repair-shop' &&
  buildingId !== 'clubhouse' &&
  targetLevel > repairShopProgress.level
) {
  return blocked(
    'repair-shop-too-low',
    targetLevel,
    null,
    'repair-shop',
    targetLevel,
  )
}
if (targetLevel >= 6 && buildingId !== 'clubhouse') {
  if (!isBuildingUnlocked('clubhouse', gangLevel)) {
    return blocked('clubhouse-locked', targetLevel, null, 'clubhouse', null)
  }
  if (targetLevel > clubhouseProgress.level) {
    return blocked(
      'clubhouse-too-low',
      targetLevel,
      null,
      'clubhouse',
      targetLevel,
    )
  }
}
```

Child gate checks `Number.isInteger(childIndex)`, fixed capacity and unlocked prefix before reading the child level. Missing cost or power remains a thrown configuration error, never a free upgrade.

- [x] **Step 8: Run GREEN and full intermediate gate**

Run:

```powershell
npm.cmd test -- src/config/economyConfig.test.ts src/game/buildingUpgrade.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: all commands exit 0; legacy consumers remain green through `legacyBuildingUpgrade.ts`.

- [x] **Step 9: Commit Task 1**

```powershell
git add src/config/economy.config.json src/config/economyConfig.ts src/config/economyConfig.test.ts src/game/buildingUpgrade.ts src/game/buildingUpgrade.test.ts src/game/legacyBuildingUpgrade.ts src/store/cityProgressMigration.ts src/store/useCityStore.ts src/ui/BuildingPanel.tsx
git commit -m "feat: centralize progressive building upgrade rules"
```

### Task 2: City Persist v3, Refund Migration, and Atomic Store Results

**Files:**

- Modify: `src/game/resourceEconomy.ts`
- Modify: `src/game/resourceEconomy.test.ts`
- Rewrite: `src/store/cityProgressMigration.ts`
- Rewrite: `src/store/cityProgressMigration.test.ts`
- Rewrite: `src/store/useCityStore.ts`
- Rewrite: `src/store/useCityStore.test.ts`
- Modify: `src/game/resetAccount.test.ts`
- Modify: `src/ui/BuildingPanel.test.tsx`（仅显式建立旧 UI 用例的钱包，Task 3 随 UI 一起重写）

**Interfaces:**

- Consumes: Task 1 的 `getBuildingChildCount`、`getUnlockedChildCount`、`getChildUpgradeDecision`、`getMainUpgradeDecision`。
- Produces:

```ts
export const INITIAL_RESOURCES: Readonly<ResourceWallet> = {
  money: 10_000,
  oil: 0,
  materials: 0,
}

export interface UpgradeActionResult {
  applied: boolean
  reason:
    | ChildUpgradeBlockReason
    | MainUpgradeBlockReason
    | 'invalid-request'
}

export function addWalletSaturated(
  wallet: ResourceWallet,
  delta: ResourceWallet,
): ResourceWallet

upgradeChildBuilding(
  id: string,
  childIndex: number,
  gangLevel: number,
  now: number,
): UpgradeActionResult

upgradeMainBuilding(
  id: string,
  gangLevel: number,
  now: number,
): UpgradeActionResult

grantDebugResources(now: number): void
```

- Persisted v3 shape remains exactly `buildingProgress`、`resources`、`lastResourceUpdatedAt`、`activeProducerIds`.

- [x] **Step 1: Write saturated-wallet and v3 migration RED tests**

Test the exact design example and three-resource cumulative refunds:

```ts
const migrated = migrateCityState(
  {
    buildingProgress: {
      'repair-shop': { level: 2, childLevels: [2, 1, 2, 0, 1] },
      'commercial-street': {
        level: 3,
        childLevels: [3, 2, 1, 2, 1, 0, 0, 0, 0, 0],
      },
    },
    resources: { money: 100, oil: 7, materials: 9 },
  },
  2,
  MIGRATION_TIME,
)
expect(migrated.buildingProgress['repair-shop'].childLevels).toEqual([
  2, 1, 0, 0, 0,
])
expect(migrated.buildingProgress['commercial-street'].childLevels).toEqual([
  3, 2, 1, 0, 0, 0, 0, 0, 0, 0,
])
expect(migrated.resources).toEqual({ money: 140, oil: 7, materials: 9 })
```

Add a v3 input with those hidden levels and assert they are cleared with wallet still 100 (no second refund), plus v1→v2→v3, malformed levels/arrays, and saturation near `Number.MAX_SAFE_INTEGER`.

- [x] **Step 2: Run migration RED**

Run: `npm.cmd test -- src/game/resourceEconomy.test.ts src/store/cityProgressMigration.test.ts`

Expected: FAIL because current normalization enforces the old Clubhouse cap, has no hidden-prefix refund, and wallet addition can exceed safe integers.

- [x] **Step 3: Implement safe arithmetic and the frozen v2 snapshot**

Use per-field saturation:

```ts
export function addWalletSaturated(
  wallet: ResourceWallet,
  delta: ResourceWallet,
): ResourceWallet {
  const add = (left: number, right: number) =>
    Math.min(Number.MAX_SAFE_INTEGER, left + right)
  return {
    money: add(wallet.money, delta.money),
    oil: add(wallet.oil, delta.oil),
    materials: add(wallet.materials, delta.materials),
  }
}
```

Freeze the migration snapshot inside `cityProgressMigration.ts`, independent of live config:

```ts
const V2_CHILD_COST_BY_TARGET_LEVEL = {
  1: { money: 5, oil: 0, materials: 0 },
  2: { money: 10, oil: 0, materials: 0 },
  3: { money: 20, oil: 0, materials: 0 },
  4: { money: 35, oil: 0, materials: 0 },
  5: { money: 50, oil: 0, materials: 0 },
  6: { money: 75, oil: 0, materials: 0 },
  7: { money: 105, oil: 0, materials: 0 },
  8: { money: 140, oil: 0, materials: 0 },
  9: { money: 180, oil: 0, materials: 0 },
  10: { money: 225, oil: 0, materials: 0 },
} as const
```

Normalize each building to max10, compute unlocked count, sum target costs `1...oldLevel` for every hidden index, then zero it. Dispatch migration explicitly:

```ts
if (persistedVersion < 2) {
  return upgradeV2ShapeToV3(migrateV1ToV2Shape(source, migrationTime), false)
}
if (persistedVersion < 3) {
  return upgradeV2ShapeToV3(source, true)
}
return upgradeV2ShapeToV3(source, false)
```

The boolean means “refund hidden children”; normalization and hidden-slot clearing always run. Only persisted v2 receives the frozen snapshot refund because v1 fragment progress did not spend economy resources.

- [x] **Step 4: Write Store action-result RED tests**

Test initial/reset 10000, invalid requests, hidden index, settle-before-recheck and stale confirmation:

```ts
expect(useCityStore.getState().resources).toEqual({
  money: 10_000,
  oil: 0,
  materials: 0,
})

expect(
  useCityStore
    .getState()
    .upgradeChildBuilding('repair-shop', 1, 1, START),
).toEqual({ applied: false, reason: 'child-locked' })

expect(
  useCityStore
    .getState()
    .upgradeChildBuilding('unknown', 0, 1, START),
).toEqual({ applied: false, reason: 'invalid-request' })
```

For stale confirmation, set wallet 24 and `lastResourceUpdatedAt = START - 10_000`; the old repair producer earns 1, so main upgrade recheck sees 25 and succeeds. Reverse the case with a three-resource cost fixture or an insufficient wallet and assert settlement persists but level/cost do not change.

- [x] **Step 5: Run Store RED**

Run: `npm.cmd test -- src/store/useCityStore.test.ts src/game/resetAccount.test.ts`

Expected: FAIL because actions return `void`, initial/reset wallet is zero, persist is v2, and Store does not distinguish `invalid-request`.

- [x] **Step 6: Implement one-set transactions and persist v3**

Because Zustand `set` does not return the callback result, capture the synchronous result:

```ts
let result: UpgradeActionResult = {
  applied: false,
  reason: 'invalid-request',
}
set((state) => {
  const settlement = settleResourceProduction({
    wallet: state.resources,
    buildingProgress: state.buildingProgress,
    activeProducerIds: state.activeProducerIds,
    lastUpdatedAt: state.lastResourceUpdatedAt,
    now,
  })
  const decision = getChildUpgradeDecision({
    buildingId: id,
    childIndex,
    progress: state.buildingProgress[id],
    wallet: settlement.wallet,
    gangLevel,
  })
  result = { applied: decision.reason === 'ready', reason: decision.reason }
  if (decision.reason !== 'ready' || !decision.cost) {
    return {
      resources: settlement.wallet,
      lastResourceUpdatedAt: settlement.nextUpdatedAt,
    }
  }
  const childLevels = [...state.buildingProgress[id].childLevels]
  childLevels[childIndex] = decision.targetLevel as ChildBuildingLevel
  return {
    resources: subtractCost(settlement.wallet, decision.cost),
    lastResourceUpdatedAt: settlement.nextUpdatedAt,
    buildingProgress: {
      ...state.buildingProgress,
      [id]: {
        ...state.buildingProgress[id],
        childLevels,
      },
    },
  }
})
return result
```

Main action uses the same settlement and failure partial; its ready branch only replaces
`buildingProgress[id].level` with `decision.targetLevel`. Main input must pass both:

```ts
repairShopProgress: state.buildingProgress['repair-shop'],
clubhouseProgress: state.buildingProgress.clubhouse,
```

Validate unknown ID, non-integer/fixed-capacity index and non-finite `now` before `set`. Do not reject a legal-capacity hidden index before the pure child decision.

Set persist `version: 3`; preserve the existing four-field `partialize`; `merge` calls v3 normalization without refunds.

- [x] **Step 7: Add the atomic debug-resource Store action**

`grantDebugResources(now)` rejects non-finite `now`. In one `set`, settle with current producers and progress, then:

```ts
return {
  resources: addWalletSaturated(settlement.wallet, {
    money: 10_000,
    oil: 10_000,
    materials: 10_000,
  }),
  lastResourceUpdatedAt: settlement.nextUpdatedAt,
}
```

Test two clicks add 20000 to every field, current production settles first, and a near-max wallet saturates.

- [x] **Step 8: Update old-panel test setup without changing production behavior**

Until Task 3 rewrites the panel, make `BuildingPanel.test.tsx` explicitly set `{ money: 0, oil: 0, materials: 0 }` in `beforeEach`. Each test that needs funds already calls `setResources`; this prevents initial 10000 from invalidating old resource-shortage cases without hiding the new Store default.

- [x] **Step 9: Run GREEN and full intermediate gate**

Run:

```powershell
npm.cmd test -- src/game/resourceEconomy.test.ts src/store/cityProgressMigration.test.ts src/store/useCityStore.test.ts src/game/resetAccount.test.ts src/ui/BuildingPanel.test.tsx
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: all commands exit 0; persist fixture versions are 3; legacy panel remains runnable.

- [x] **Step 10: Commit Task 2**

```powershell
git add src/game/resourceEconomy.ts src/game/resourceEconomy.test.ts src/store/cityProgressMigration.ts src/store/cityProgressMigration.test.ts src/store/useCityStore.ts src/store/useCityStore.test.ts src/game/resetAccount.test.ts src/ui/BuildingPanel.test.tsx
git commit -m "feat: migrate city saves and atomically apply upgrades"
```

### Task 3: Building Panel Selection, Progress, Confirmation, and Responsive State Machine

**Files:**

- Rewrite: `src/ui/BuildingPanel.tsx`
- Rewrite: `src/ui/BuildingPanel.test.tsx`
- Modify: `src/App.css`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Delete: `src/game/legacyBuildingUpgrade.ts`

**Interfaces:**

- Consumes: Task 1 decisions/progress/power, Task 2 result-returning Store actions, `getBuildingFragments`.
- Produces:

```ts
type BuildingPanelView =
  | { kind: 'details'; selectedChildIndex: number | null }
  | {
      kind: 'main-upgrade-confirm'
      selectedChildIndex: number | null
      actionReason: MainUpgradeBlockReason | null
    }

export function findDefaultChildIndex(
  progress: BuildingProgress,
  unlockedChildCount: number,
): number | null

export function findNextIncompleteChildIndex(
  progress: BuildingProgress,
  unlockedChildCount: number,
  afterIndex: number,
): number | null

export function mainUpgradeBlockerMessage(
  decision: MainUpgradeDecision,
  mainLevel: BuildingLevel,
): string | null
```

- UI controls: radiogroup/radio child selector, one shared child upgrade button, exact progressbar, details-only main button, independent confirm page.

- [x] **Step 1: Write session-selection and hidden-DOM RED tests**

Test initial repair Lv.1 renders exactly one radio/card, defaults to index 0, and no hidden names exist. At repair Lv.3 render exactly three; manually choose index 2, update wallet via Store, rerender, and assert index 2 remains checked.

```ts
expect(screen.getAllByRole('radio')).toHaveLength(3)
await user.click(screen.getByRole('radio', { name: /举升工位/ }))
act(() => useCityStore.setState({ resources: richWallet }))
expect(screen.getByRole('radio', { name: /举升工位/ })).toBeChecked()
expect(screen.queryByText('排气设施')).not.toBeInTheDocument()
```

Close/reopen and switch buildings to prove a new session reselects the first incomplete unlocked slot.

- [x] **Step 2: Run selection RED**

Run: `npm.cmd test -- src/ui/BuildingPanel.test.tsx`

Expected: FAIL because the current panel renders every fixed-capacity slot with one button per card and has no radio selection.

- [x] **Step 3: Implement session identity and cyclic selection**

Track session by selected building ID. Initialize it in an effect so rendering
remains pure and wallet/progress rerenders do not reset the selection:

```ts
const [session, setSession] = useState<{
  buildingId: BuildingId
  view: BuildingPanelView
} | null>(null)

useEffect(() => {
  if (!selectedBuildingId) {
    setSession(null)
    return
  }
  const progress =
    useCityStore.getState().buildingProgress[selectedBuildingId]
  const unlockedCount = getUnlockedChildCount(
    selectedBuildingId,
    progress.level,
  )
  setSession({
    buildingId: selectedBuildingId,
    view: {
      kind: 'details',
      selectedChildIndex: findDefaultChildIndex(progress, unlockedCount),
    },
  })
}, [selectedBuildingId])
```

Do not derive/reset selection from wallet or progress on every render. After a successful child result, inspect latest Store progress; keep current index if still below main level, otherwise search `(afterIndex + offset) % unlockedCount` for the first incomplete slot, or set null.

- [x] **Step 4: Write progress/shared-button RED tests**

At commercial Lv.3 with `[3,2,1,0,0,0,0,0,0,0]`, assert exact `aria-valuenow={(6 / 9) * 100}`, visible `66%`, one shared button for selected slot, and no per-card upgrade buttons. Upgrade selected child and assert completed steps +1 and selection behavior.

At `[3,3,3,0,0,0,0,0,0,0]`, assert the progress/shared child region is replaced by `升级主建筑至 Lv.4`; for Lv.10 show only `已达到最高等级 Lv.10`.

- [x] **Step 5: Implement details view and exact reason text**

Render only:

```tsx
const visibleBlueprints = getBuildingFragments(building.kind).slice(
  0,
  upgradeProgress.unlockedChildCount,
)
```

For non-complete progress:

```tsx
<div
  role="progressbar"
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={upgradeProgress.percent}
>
  <span style={{ width: `${upgradeProgress.percent}%` }} />
</div>
<span>
  {upgradeProgress.complete ? '100%' : `${Math.floor(upgradeProgress.percent)}%`}
</span>
```

Reason text must be exactly:

```ts
case 'children-not-caught-up':
  return `请先将当前已解锁子建筑全部提升至 Lv.${mainLevel}`
case 'repair-shop-too-low':
  return `需要先将修车厂提升至 Lv.${decision.requiredBuildingLevel}`
case 'clubhouse-locked':
  return '需要先将帮派树提升至 Lv.40 解锁 Clubhouse'
case 'clubhouse-too-low':
  return `需要先将 Clubhouse 提升至 Lv.${decision.requiredBuildingLevel}`
case 'building-maxed':
  return '已达到最高等级 Lv.10'
case 'insufficient-resources':
  return `资源不足，还需 ${formatNonZeroCost(decision.missingResources)}`
```

Locked building text continues using `需要 Lv. X · 职位`; locked panels render no upgrade controls.

- [x] **Step 6: Write confirmation-state RED tests**

Starting at complete repair Lv.1:

1. Record wallet/level.
2. Click `升级主建筑至 Lv.2`.
3. Assert details content is absent, heading `修车厂 · 目标等级 Lv.2` is focused, and wallet/level are unchanged.
4. Assert complete cost includes `钱 25`, `油 0`, `物资 0`; power shows `当前建筑战力 100`、`本次战力 +30`、`升级后战力 130`.
5. Click 返回 and assert state unchanged/focus returns to main button.
6. Reenter, mutate wallet to insufficient, assert confirmation recomputes and disables.
7. Fund and confirm; assert one deduction, level +1, details view, new slot index 1 selected.

Add repair Lv.5→6 test: no new slot, selected index becomes the first child below Lv.6.

- [x] **Step 7: Run confirmation RED**

Run: `npm.cmd test -- src/ui/BuildingPanel.test.tsx src/App.test.tsx`

Expected: FAIL because the current main button upgrades immediately and no confirmation/power/focus state exists.

- [x] **Step 8: Implement confirm page without early settlement**

Opening confirmation only calls `setSession`; it must not call `Date.now()` or Store actions. Recompute `getMainUpgradeDecision` from current Store values every render.

Confirm handler:

```ts
const previousUnlocked = getUnlockedChildCount(id, progress.level)
const result = upgradeMainBuilding(id, gangLevel, Date.now())
if (!result.applied) {
  setSession((current) =>
    current
      ? {
          ...current,
          view: {
            ...current.view,
            actionReason: result.reason as MainUpgradeBlockReason,
          },
        }
      : current,
  )
  return
}
const latest = useCityStore.getState().buildingProgress[id]
const nextUnlocked = getUnlockedChildCount(id, latest.level)
const selectedChildIndex =
  nextUnlocked > previousUnlocked
    ? previousUnlocked
    : findDefaultChildIndex(latest, nextUnlocked)
setSession({
  buildingId: id,
  view: {
    kind: 'details',
    selectedChildIndex,
  },
})
```

All failures remain on confirmation, never alter selection, and display current pure decision or returned failure reason.

- [x] **Step 9: Implement focus, Escape, pointer isolation, and responsive CSS**

Give Canvas `tabIndex={0}` and `aria-label="工业城市 3D 场景"` as a deterministic close focus target. Details→confirm focuses the confirm title via `ref`; return focuses the remembered main button; close/Escape clears selection then focuses Canvas. Switching buildings creates a new session.

CSS requirements:

- desktop side panel remains vertically bounded and scrollable;
- 390×844 uses full-width/bottom panel with `max-height` inside viewport;
- selector wraps or scrolls internally without page horizontal overflow;
- shared/confirm/back controls are at least 44×44 CSS px;
- checked radio has icon/text/border, not color alone;
- focus ring remains visible;
- reduced-motion disables panel transitions, not final state.

- [x] **Step 10: Remove the temporary adapter and scan**

Change all remaining product imports to `src/game/buildingUpgrade.ts`, delete `legacyBuildingUpgrade.ts`, then run:

```powershell
rg "legacyBuildingUpgrade|NON_CLUBHOUSE_MAX_LEVEL|CLUBHOUSE_MAX_LEVEL" src
```

Expected: no matches.

- [x] **Step 11: Run GREEN and full task gate**

Run:

```powershell
npm.cmd test -- src/ui/BuildingPanel.test.tsx src/App.test.tsx
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: all commands exit 0; UI selection/confirm state is absent from persisted JSON.

- [x] **Step 12: Commit Task 3**

```powershell
git add -A src/ui/BuildingPanel.tsx src/ui/BuildingPanel.test.tsx src/App.css src/App.tsx src/App.test.tsx src/game/legacyBuildingUpgrade.ts
git commit -m "feat: add progressive building upgrade confirmation flow"
```

### Task 4: Unlocked-Only 3D Rendering and Animation Boundaries

**Files:**

- Modify: `src/scene/city/buildingFragmentCatalog.ts`
- Modify: `src/scene/city/buildingFragmentCatalog.test.ts`
- Modify: `src/scene/city/BuildingVisual.tsx`
- Modify: `src/scene/city/BuildingVisual.test.tsx`
- Modify: `src/scene/city/BuildingModel.tsx`
- Modify: `src/scene/city/BuildingModel.test.tsx`

**Interfaces:**

- Consumes: Task 1 `getUnlockedChildCount(buildingId, level)`.
- Produces:

```ts
export function getRenderedBuildingFragments(
  buildingId: BuildingId,
  progress: BuildingProgress,
  animatedFragmentId?: string,
): readonly RenderedBuildingFragment[]
```

- `BuildingModel` passes `definition.id`; `BuildingVisual` animation detection receives `id` and ignores hidden/multi/main-only transitions.

- [x] **Step 1: Write unlocked-prefix RED tests for all levels**

For every `BuildingId` and every `BUILDING_LEVELS`, create canonical progress and assert rendered length equals `getUnlockedChildCount`. Explicitly assert fresh repair and commercial each render one scaffold, repair Lv.6 renders five, commercial Lv.6 renders six.

```ts
const rendered = getRenderedBuildingFragments('commercial-street', {
  level: 3,
  childLevels: [1, 0, 0, 9, 9, 9, 9, 9, 9, 9],
})
expect(rendered).toHaveLength(3)
expect(rendered.map(({ state }) => state)).toEqual([
  'current',
  'scaffold',
  'scaffold',
])
```

Assert hidden blueprint IDs and scaffold tags are absent from serialized render results.

- [x] **Step 2: Run render RED**

Run: `npm.cmd test -- src/scene/city/buildingFragmentCatalog.test.ts src/scene/city/BuildingModel.test.tsx`

Expected: FAIL because current catalog maps every fixed-capacity blueprint and accepts `BuildingKind`, not `BuildingId`.

- [x] **Step 3: Implement buildingId-driven prefix rendering**

Resolve definition and slice before mapping:

```ts
const definition = buildingCatalogById[buildingId]
const blueprints = getBuildingFragments(definition.kind).slice(
  0,
  getUnlockedChildCount(buildingId, progress.level),
)
return blueprints.map((blueprint, index) =>
  renderUnlockedSlot(blueprint, progress.childLevels[index] ?? 0, animatedFragmentId),
)
```

Do not create placeholders for the suffix. `BuildingModel` memo dependencies become `[definition.id, progress, animatedFragmentId]`.

- [x] **Step 4: Write animation-boundary RED tests**

Cover:

- one unlocked child `+1` animates only that stable fragment ID for 400ms;
- main level +1 with unchanged children does not animate, including a newly visible Lv.0 slot;
- a hidden child array change does not animate;
- two children changed, migration, reset and rehydrate do not animate;
- reduced-motion remains covered by `AnimatedBuildingFragment.test.tsx`.

Representative hidden case:

```ts
// commercial Lv.2 unlocks only indices 0..1
before.childLevels[7] = 0
after.childLevels[7] = 1
expect(model).toHaveAttribute('data-animated', '')
```

- [x] **Step 5: Implement exact animation detection**

Require same main level and same array length, and compare only unlocked prefix:

```ts
if (previous.level !== progress.level) return undefined
const unlocked = getUnlockedChildCount(id, progress.level)
let upgradedIndex = -1
for (let index = 0; index < progress.childLevels.length; index += 1) {
  const delta = progress.childLevels[index] - previous.childLevels[index]
  if (index >= unlocked) {
    if (delta !== 0) return undefined
    continue
  }
  if (delta === 0) continue
  if (delta !== 1 || upgradedIndex !== -1) return undefined
  upgradedIndex = index
}
```

Only map the final index to a blueprint ID when it is non-negative and unlocked.

- [x] **Step 6: Extend full geometry envelope tests**

For all six buildings, main Lv.1–10 and representative unlocked child levels `0`, `1`, `mainLevel`, assert every returned part remains within footprint and below `BUILDING_HITBOX_HEIGHT`. Keep existing semantic tag, rooftop attachment and positive geometry tests; update helpers to accept `BuildingId`.

- [x] **Step 7: Run GREEN and full task gate**

Run:

```powershell
npm.cmd test -- src/scene/city/buildingFragmentCatalog.test.ts src/scene/city/BuildingVisual.test.tsx src/scene/city/BuildingModel.test.tsx src/scene/city/AnimatedBuildingFragment.test.tsx
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: all commands exit 0; every level renders exactly the unlocked prefix and no non-child transition animates.

- [x] **Step 8: Commit Task 4**

```powershell
git add src/scene/city/buildingFragmentCatalog.ts src/scene/city/buildingFragmentCatalog.test.ts src/scene/city/BuildingVisual.tsx src/scene/city/BuildingVisual.test.tsx src/scene/city/BuildingModel.tsx src/scene/city/BuildingModel.test.tsx
git commit -m "feat: render only unlocked building slots"
```

### Task 5: Debug Settings Coordinator and Accessible Feedback

**Files:**

- Create: `src/game/debugActions.ts`
- Create: `src/game/debugActions.test.ts`
- Modify: `src/store/useGangStore.ts`
- Modify: `src/store/useGangStore.test.ts`
- Modify: `src/store/useCityStore.test.ts`
- Rewrite: `src/ui/SettingsPanel.tsx`
- Rewrite: `src/ui/SettingsPanel.test.tsx`
- Modify: `src/App.css`
- Modify: `src/App.test.tsx`

**Interfaces:**

- Consumes: Task 2 `syncResourceProduction(now, 50)` and `grantDebugResources(now)`.
- Produces:

```ts
// useGangStore
unlockForDebug(now: number): void

// debugActions.ts
export function unlockGangTreeForDebug(now: number = Date.now()): boolean
export function grantAllResourcesForDebug(now: number = Date.now()): boolean
```

- Return `false` only for non-finite `now`; valid calls return `true`.

- [x] **Step 1: Write coordinator RED tests**

At `START`, set repair as the only producer and advance 80,000 seconds. Call:

```ts
expect(unlockGangTreeForDebug(START + 80_000_000)).toBe(true)
expect(useGangStore.getState()).toMatchObject({
  totalReputation: 1470,
  lastUpdatedAt: START + 80_000_000,
})
expect(useCityStore.getState().activeProducerIds).toEqual([
  'repair-shop',
  'commercial-street',
  'metalworking-plant',
  'gas-station',
])
```

Assert the first settlement includes only old repair production; a second click at the same time changes no balances and remains Lv.50. Test `NaN` returns false and changes neither Store.

For resources, assert one coordinator call settles current production then adds 10000 each; two clicks add 20000 each; near-max values saturate.

- [x] **Step 2: Run coordinator RED**

Run: `npm.cmd test -- src/game/debugActions.test.ts src/store/useGangStore.test.ts src/store/useCityStore.test.ts`

Expected: FAIL because the coordinator and `unlockForDebug` do not exist.

- [x] **Step 3: Implement Store hooks and coordinator ordering**

Gang Store:

```ts
unlockForDebug: (now) => {
  if (!Number.isFinite(now)) return
  set({ totalReputation: 1470, lastUpdatedAt: now })
}
```

Coordinator:

```ts
export function unlockGangTreeForDebug(now = Date.now()): boolean {
  if (!Number.isFinite(now)) return false
  useCityStore.getState().syncResourceProduction(now, 50)
  useGangStore.getState().unlockForDebug(now)
  return true
}

export function grantAllResourcesForDebug(now = Date.now()): boolean {
  if (!Number.isFinite(now)) return false
  useCityStore.getState().grantDebugResources(now)
  return true
}
```

This order is mandatory: city settles old producers before gang Lv.50 is visible, and both receive the same `now`.

- [x] **Step 4: Write SettingsPanel RED tests**

Test:

- `解锁帮派树` executes immediately, leaves panel open, shows `帮派树已解锁`;
- `钱/油/物资各 +10000` executes twice, leaves panel open, shows `钱、油、物资各增加 10000`;
- feedback container has `aria-live="polite"`;
- neither debug action reveals reset confirmation;
- reset still requires two clicks and closes only after confirmation;
- Escape, named close, pointer isolation and mobile dialog behavior remain.

- [x] **Step 5: Run Settings RED**

Run: `npm.cmd test -- src/ui/SettingsPanel.test.tsx src/App.test.tsx`

Expected: FAIL because current settings only contains the reset flow.

- [x] **Step 6: Implement immediate actions and accessible feedback**

Use one `Date.now()` per click:

```tsx
const unlock = () => {
  if (unlockGangTreeForDebug(Date.now())) setFeedback('帮派树已解锁')
}
const grant = () => {
  if (grantAllResourcesForDebug(Date.now())) {
    setFeedback('钱、油、物资各增加 10000')
  }
}
```

Render debug actions in a neutral settings section separate from the red reset section. Keep panel open and do not alter `confirming`. Add:

```tsx
<p className="settings-panel__feedback" aria-live="polite">
  {feedback}
</p>
```

Buttons and close controls remain at least 44×44 CSS px and have visible focus styles.

- [x] **Step 7: Run GREEN and full task gate**

Run:

```powershell
npm.cmd test -- src/game/debugActions.test.ts src/store/useGangStore.test.ts src/store/useCityStore.test.ts src/ui/SettingsPanel.test.tsx src/App.test.tsx
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: all commands exit 0; repeated debug actions are deterministic and no debug state is added to persistence.

- [x] **Step 8: Commit Task 5**

```powershell
git add src/game/debugActions.ts src/game/debugActions.test.ts src/store/useGangStore.ts src/store/useGangStore.test.ts src/store/useCityStore.test.ts src/ui/SettingsPanel.tsx src/ui/SettingsPanel.test.tsx src/App.css src/App.test.tsx
git commit -m "feat: add repeatable debug progression controls"
```

### Task 6: Full Documentation, Safe CDP Acceptance, Review, Push, Pages, and Final Evidence

**Files:**

- Modify: `README.md`
- Modify: `session/session.md`
- Modify: `session/requirements/gang-tree-idle-unlocks.md`
- Modify: `session/requirements/city-building-upgrade-demo.md`
- Create: `.superpowers/sdd/progressive-building-upgrade-flow-cdp.mjs`
- Create: `.superpowers/sdd/progressive-building-upgrade-flow-results.json`
- Create: `.superpowers/sdd/progressive-building-upgrade-flow-report.md`
- Create: `.superpowers/sdd/progressive-building-upgrade-flow-public-cdp.mjs`
- Create: `.superpowers/sdd/progressive-building-upgrade-flow-public-results.json`

**Interfaces:**

- Local script command: `node .superpowers/sdd/progressive-building-upgrade-flow-cdp.mjs`
- Public script command: `node .superpowers/sdd/progressive-building-upgrade-flow-public-cdp.mjs`
- Storage: `dobe-city-progression-v1`, persist version 3.
- Public URL: `https://sherlock3rd.github.io/DobeDemo/`.
- Deployment base: `/DobeDemo/`.

- [x] **Step 1: Run the fresh engineering gate before writing evidence**

Run:

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Expected: all exit 0; `dist/index.html` references current JS/CSS under `/DobeDemo/`.

- [x] **Step 2: Implement the repeatable local CDP safety shell**

Base it on the current `independent-economy-cdp.mjs`, changing names and assertions. It must:

- dynamically select unused dev/CDP ports and skip occupied preferred ports;
- start Vite with `--strictPort`;
- track only child PIDs it spawned and refuse to terminate unknown PIDs;
- create Chrome profile with `fs.mkdtempSync(path.join(os.tmpdir(), 'dobe-progressive-upgrade-cdp-'))`;
- verify that exact prefix before recursive deletion;
- record only basenames, relative repo paths, numeric measurements and whitelisted error `name`/`code`;
- print raw stack only to stderr;
- write JSON from actual runtime values;
- include a pure good-data/empty-data assertion self-test and Windows/Unix path redaction self-test;
- set nonzero `process.exitCode` for any failed assertion, runtime error, cleanup failure, occupied-owned-port mismatch or missing screenshot;
- verify dev/CDP ports released and temporary profile removed.

- [x] **Step 3: Implement the local Chrome acceptance flow**

Drive real Chrome via CDP at desktop 1440×900 and mobile 390×844. Use real pointer clicks for visible controls; legal localStorage injection may prepare expensive levels, but every asserted transition must be triggered by the actual UI action under test.

Required assertions:

1. Clear storage; assert fresh v3 wallet `{10000,0,0}`, all main levels 1, only first repair slot in UI/3D, and no hidden scaffold/label/radio.
2. Use shared button to upgrade the selected slot; assert completed steps increase by one, exact progress percent changes and only that 3D ROI changes during the 400ms window.
3. At a multi-slot level, manually select a different radio; perform a resource tick/rerender and assert selection remains; upgrade repeatedly until caught up, then assert cyclic selection.
4. At exact 100%, assert progress/shared region is replaced by `升级主建筑至 Lv.N`.
5. Click that button; assert wallet and main level unchanged and confirm page appears with full three-resource cost and current/+delta/after power.
6. Click 返回; assert no state change. Reenter with insufficient resources; assert disabled exact reason. Fund and confirm; assert one deduction, main +1, new Lv.0 slot appears in UI/3D and is selected.
7. Inject each reason collision and assert exact priority/text, including `building-locked`, max10, incomplete children, repair-shop-too-low for target 2–5, clubhouse-locked/too-low for target 6, and resources last.
8. Verify repair target 2–5 ignores external gates; repair Lv.5→6 uses Clubhouse and, after success, still has five slots and selects first child below Lv.6.
9. Verify Clubhouse at gang Lv.40 ignores repair/Clubhouse level gates and is constrained only by own unlock/progress/resources/max.
10. Click `解锁帮派树`; assert 1470/Lv.50, old producers settle once, all current producers activate at the click time, no historical production from new producers, second click idempotent.
11. Click `钱/油/物资各 +10000` twice; assert each cumulative +20000 plus only current-time production settlement, and panel remains open with polite feedback.
12. Reset through two confirmations; assert wallet 10000, gang reputation 0, all main Lv.1, child arrays zero, repair-only producer, both clocks equal one captured reset time, and building selection/session closed.
13. Inject the specified representative v2 save; reload and assert 40-money refund and hidden slots zero; reload again and assert persisted version 3 and no repeated refund.
14. Desktop and 390×844: details, confirmation and settings remain within viewport, no document/panel horizontal overflow, content scrolls, 44px controls are reachable, focus is visible and expected focus transfers occur.
15. Teardown proves only owned PIDs were targeted, both ports released, temporary profile removed, and all expected screenshots are nonempty.

- [x] **Step 4: Run local CDP and record actual evidence**

Run:

```powershell
node .superpowers/sdd/progressive-building-upgrade-flow-cdp.mjs
```

Expected: exit 0, `ASSERTION SELF-TEST: PASS`, every numbered assertion prints `PASS`, JSON is generated, and cleanup assertions pass.

If any assertion fails, fix the source or script with a focused RED test, rerun the affected unit test, then rerun the full engineering gate and the entire CDP flow from fresh storage.

- [x] **Step 5: Update all current documentation**

README and both requirements files must state:

- all buildings max10;
- repair 5-slot sequence and other 10-slot sequence;
- hidden slots absent, Lv.0 scaffold only when unlocked;
- shared child button, exact progress, independent main confirmation;
- repair gates for target 2–5 and Clubhouse gates for target 6–10;
- v3 storage and one-time v2 hidden-slot refund;
- initial/reset 10000 money;
- display-only building power;
- both debug controls and reset confirmation;
- current actual test counts and local acceptance script.

`session/session.md` updates current goal and appends dated ledger entries for implementation and local acceptance. The report records actual command outputs, browser assertions, generated basenames/sizes and any real defect/retry history; it must not claim push or Pages completion yet.

- [x] **Step 6: Run the post-documentation gate and commit local delivery**

Run:

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
node .superpowers/sdd/progressive-building-upgrade-flow-cdp.mjs
```

Expected: all exit 0.

Then:

```powershell
git add README.md session/session.md session/requirements/gang-tree-idle-unlocks.md session/requirements/city-building-upgrade-demo.md .superpowers/sdd/progressive-building-upgrade-flow-cdp.mjs .superpowers/sdd/progressive-building-upgrade-flow-results.json .superpowers/sdd/progressive-building-upgrade-flow-report.md
git commit -m "test: document progressive upgrade acceptance"
```

Do not add ignored PNGs, `dist`, temporary profiles, terminal files, review diffs or unknown local files.

- [ ] **Step 7: Perform full-branch review and repair every actionable branch defect**

Review the complete range from the pre-feature base through HEAD, not just the latest commit. Require explicit review of:

- exact reason priority and repair/Clubhouse target bands;
- v2 snapshot cumulative refund and v3 non-repeat behavior;
- settlement/recheck/deduction atomicity and failure results;
- hidden DOM/3D slots and animation boundaries;
- session-only UI state, no early confirmation deduction, focus/Escape;
- debug no-backdating and saturation;
- CDP process/path/error safety.

Fix every Critical/Important actionable finding with a focused failing test, commit the fix separately, rerun the full engineering gate and local CDP, then re-review the fix range. Expected final review: approved with no Critical/Important findings.

- [ ] **Step 8: Ordinary push main**

Verify clean intended history and then use:

```powershell
git push origin main
```

Expected: ordinary fast-forward push succeeds. Do not use `--force` or `--force-with-lease`.

- [ ] **Step 9: Publish fresh dist through an independent temporary index**

After the pushed main commit passes the fresh gate, rebuild. Create a temporary index with:

```powershell
$git = "C:\cygwin64\bin\git.exe"
$cygpath = "C:\cygwin64\bin\cygpath.exe"
$name = "dobe-gh-pages-" + [guid]::NewGuid().ToString("N")
$indexWin = Join-Path (Resolve-Path ".git").Path $name
$indexCyg = (& $cygpath -u $indexWin).Trim()
$distCyg = (& $cygpath -u (Resolve-Path "dist").Path).Trim()
$previousIndex = $env:GIT_INDEX_FILE
try {
  $env:GIT_INDEX_FILE = $indexCyg
  & $git read-tree --empty
  & $git --work-tree="$distCyg" add -f -A
  $tree = (& $git write-tree).Trim()
  $parent = (& $git rev-parse origin/gh-pages).Trim()
  $timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
  $identity = "Sherlock3rd <64402141+Sherlock3rd@users.noreply.github.com> $timestamp +0800"
  $payload = "tree $tree`nparent $parent`nauthor $identity`ncommitter $identity`n`ndeploy: publish progressive building upgrades`n"
  $commit = ($payload | & $git hash-object -t commit -w --stdin).Trim()
  $published = @(& $git ls-tree -r --name-only $commit)
  if (-not ($published -contains "index.html")) {
    throw "Published tree is missing index.html"
  }
  & $git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin "${commit}:refs/heads/gh-pages"
} finally {
  if ($null -eq $previousIndex) {
    Remove-Item Env:GIT_INDEX_FILE -ErrorAction SilentlyContinue
  } else {
    $env:GIT_INDEX_FILE = $previousIndex
  }
  $gitRoot = [IO.Path]::GetFullPath((Resolve-Path ".git").Path)
  $indexPath = [IO.Path]::GetFullPath($indexWin)
  if (-not $indexPath.StartsWith($gitRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove temporary index outside .git"
  }
  Remove-Item $indexPath -Force -ErrorAction SilentlyContinue
  Remove-Item ($indexPath + ".lock") -Force -ErrorAction SilentlyContinue
}
```

The normal working index must remain untouched. Expected published tree contains only `index.html` and current assets, and push is fast-forward.

- [ ] **Step 10: Wait for the exact Pages commit to become built**

Use GitHub CLI/API to poll the Pages deployment/build for the exact `gh-pages` commit from Step 9. Accept only:

```text
deployment commit == pushed gh-pages commit
status == built
```

An older successful build does not satisfy this step. Stop and report a definitive auth/permission failure rather than altering credentials or force-pushing.

- [ ] **Step 11: Verify public HTTP and Chrome key flows**

Fetch public HTML without cache, extract its current hashed JS/CSS references, and assert HTML, JS and CSS each return HTTP 200 and use `/DobeDemo/`.

Implement `progressive-building-upgrade-flow-public-cdp.mjs` with the same owned-process/profile/error safety. On a fresh isolated public profile, verify:

- wallet starts at 10000 and repair shows only one unlocked slot;
- debug resource action works twice with feedback;
- one child upgrade changes progress/3D;
- reaching 100% opens confirmation without early deduction;
- confirm deducts once and reveals the next slot;
- representative v2 injection refunds once across two reloads;
- settings/reset and 390×844 layouts remain usable.

Run:

```powershell
node .superpowers/sdd/progressive-building-upgrade-flow-public-cdp.mjs
```

Expected: exit 0, all public assertions pass, result JSON and nonempty local screenshot are generated, and profile cleanup succeeds.

- [ ] **Step 12: Commit final evidence and ordinary-push main again**

Update the report and session ledger with actual main commit, gh-pages commit, Pages build ID/status, public asset URLs/statuses, public CDP assertions and screenshot basename/size.

Run the final gate once more:

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Expected: all exit 0.

Then:

```powershell
git add session/session.md .superpowers/sdd/progressive-building-upgrade-flow-report.md .superpowers/sdd/progressive-building-upgrade-flow-public-cdp.mjs .superpowers/sdd/progressive-building-upgrade-flow-public-results.json
git commit -m "docs: record progressive upgrade release evidence"
git push origin main
```

Expected: final evidence commit is an ordinary fast-forward push; working tree contains no accidentally tracked `dist`, temporary index/profile/CDP data, ignored PNGs or unknown files.
