# 渐进式建筑升级流程设计

日期：2026-07-24

## 目标

在现有独立子建筑经济系统上，把建筑升级改为“当前等级逐槽建设 → 总进度 100% → 独立确认主建筑升级 → 解锁下一槽”的渐进闭环，并加入可配置、仅展示的建筑战力。

本设计替代 `2026-07-23-independent-subbuilding-economy-design.md` 中以下旧规则：

- 所有建筑主等级上限统一为 Lv.10，不再区分 Clubhouse 与其他建筑。
- 子建筑不是一次性全部可见，而是随主等级逐槽解锁。
- 建筑详情不再为每个子建筑提供独立升级按钮，改为一个选中项和一个公用升级按钮。
- 主建筑升级不再从详情页直接扣费，必须经过独立确认界面。
- 非 Clubhouse 的等级门槛改为 Lv.2–5 受修车厂约束、Lv.6–10 受 Clubhouse 约束。
- 初始钱包从全零改为 `{ money: 10000, oil: 0, materials: 0 }`。
- 城市存档版本从 v2 升为 v3，并首次为被隐藏的旧子建筑等级退款。

未被本设计明确替代的规则继续保留：帮派树原建筑解锁序列、每 10 秒声望、每 10 秒资源 tick、8 小时离线上限、现有生产公式、新生产者不追溯、400ms 子建筑动画、rehydrate 不播放动画、响应式、可访问性、重置二次确认及 GitHub Pages 发布方式。

## 设计原则

1. **规则集中**：槽位解锁、总进度和主升级门槛都由纯函数给出，UI 与 Store 不自行复制规则。
2. **扣费原子化**：所有会改变资源或等级的 Store 动作均在同一次 Zustand `set` 中完成结算、重查、扣费和升级。
3. **UI 状态瞬时化**：选中子建筑与确认页状态只属于本次面板会话，不进入持久化存档。
4. **配置与不变量分离**：成本、生产和战力属于 JSON；等级上限、槽位解锁方式和门槛判定顺序属于 TypeScript 领域规则。
5. **坏存档安全降级**：不信任持久化数据，任何非法数值都规范化；迁移退款只增加资源，不允许溢出。

## 固定领域规则

### 主建筑、槽位与子建筑

- 六类建筑主等级均为 `1...10`，最高 Lv.10。
- 子建筑等级为 `0...10`；Lv.0 表示已解锁但尚未建设，且任何子建筑永不高于所属主建筑。
- 修车厂固定使用 blueprint 前 5 个槽位：
  - 主 Lv.1–5 分别解锁 1–5 个；
  - 主 Lv.6–10 始终保持 5 个。
- 其他建筑固定使用 10 个槽位，主 Lv.1–10 分别解锁 1–10 个。
- 未解锁槽位在建筑面板和 3D 场景中完全不存在：不显示卡片、脚手架、占位、标签，也不能被键盘或程序化操作升级。
- 已解锁且等级为 0 的槽位仍显示现有脚手架；等级为 1 以上时显示该槽自己的几何。
- 子建筑升级始终只提升当前选中槽一级，不能批量升级，也不能跳级。

```ts
export const BUILDING_MAX_LEVEL = 10

export function getBuildingChildCount(id: BuildingId): 5 | 10

export function getUnlockedChildCount(
  id: BuildingId,
  mainLevel: BuildingLevel,
): number {
  return id === 'repair-shop' ? Math.min(mainLevel, 5) : mainLevel
}
```

`getBuildingChildCount` 表示存档数组和 blueprint 的固定容量；`getUnlockedChildCount` 表示当前可交互、可计入进度和可渲染的前缀长度。两者不能混用。

### 总进度

总进度只统计已解锁槽位：

```text
completedSteps = sum(childLevels[0 .. unlockedCount - 1])
totalSteps = unlockedCount * mainLevel
ratio = completedSteps / totalSteps
```

主建筑最低为 Lv.1，且至少解锁一个槽位，因此 `totalSteps` 在合法状态下必定大于 0。防御性实现遇到 `totalSteps <= 0` 时返回 0，不抛异常。

```ts
export interface BuildingUpgradeProgress {
  unlockedChildCount: number
  completedSteps: number
  totalSteps: number
  ratio: number // 规范化到 0...1
  percent: number // ratio * 100，不预先取整
  complete: boolean // completedSteps === totalSteps
}

export function getBuildingUpgradeProgress(
  buildingId: BuildingId,
  progress: BuildingProgress,
): BuildingUpgradeProgress
```

进度条宽度使用精确 `percent`；可见文案使用向下取整的整数百分比，避免未完成时因四舍五入显示 100%。只有 `complete === true` 才显示 `100%`。

每次成功子建筑升级，`completedSteps` 固定增加 1。主建筑成功升级后，分母增大，且非修车厂通常新增一个 Lv.0 槽位，所以进度重新低于 100%。

### 主建筑目标等级门槛

门槛只判断即将到达的 `targetLevel = currentLevel + 1`：

- Clubhouse：不受修车厂或其他建筑等级约束；仅受自身帮派 Lv.40 解锁、已解锁子建筑进度、资源和 Lv.10 上限约束。
- 修车厂：
  - 目标 Lv.2–5 无外部建筑等级门槛；
  - 目标 Lv.6–10 不得高于 Clubhouse 当前等级。
- 其余四类建筑：
  - 目标 Lv.2–5 不得高于修车厂当前等级；
  - 目标 Lv.6–10 不得高于 Clubhouse 当前等级。
- Lv.6–10 的非 Clubhouse 判定不再叠加修车厂门槛；修车厂门槛只适用于目标 Lv.2–5。
- 建筑自身仍须按原帮派树序列解锁：修车厂 Lv.1、废车回收厂 Lv.8、商业街 Lv.16、金属加工厂 Lv.24、加油站 Lv.32、Clubhouse Lv.40。

### 精确判定顺序与 reason

主升级纯函数接口：

```ts
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

export function getMainUpgradeDecision(
  input: MainUpgradeDecisionInput,
): MainUpgradeDecision
```

判定严格按以下顺序短路：

1. `building-locked`：当前建筑未达到原帮派树解锁等级。
2. `building-maxed`：当前主等级已为 Lv.10。
3. `children-not-caught-up`：已解锁槽位的总进度未达到 100%；隐藏槽位不参与。
4. 计算目标等级。
5. 当目标为 Lv.2–5 且建筑既不是修车厂也不是 Clubhouse，若目标高于修车厂当前等级，返回 `repair-shop-too-low`。
6. 当目标为 Lv.6–10 且建筑不是 Clubhouse，若帮派等级低于 40，返回 `clubhouse-locked`；否则若目标高于 Clubhouse 当前等级，返回 `clubhouse-too-low`。
7. 读取目标等级主升级成本；钱包不足返回 `insufficient-resources`。
8. 全部通过返回 `ready`。

精确界面文案：

| reason | 文案 |
|---|---|
| `building-locked` | 沿用当前建筑自己的 `需要 Lv. X · 职位` 文案 |
| `building-maxed` | `已达到最高等级 Lv.10` |
| `children-not-caught-up` | `请先将当前已解锁子建筑全部提升至 Lv.X` |
| `repair-shop-too-low` | `需要先将修车厂提升至 Lv.N` |
| `clubhouse-locked` | `需要先将帮派树提升至 Lv.40 解锁 Clubhouse` |
| `clubhouse-too-low` | `需要先将 Clubhouse 提升至 Lv.N` |
| `insufficient-resources` | `资源不足，还需 钱 A · 油 B · 物资 C`，零缺口项省略 |
| `ready` | 不显示阻止原因 |

`N` 始终等于本次目标等级。这样相同输入只产生一个稳定 reason，详情页、确认页和 Store 重查共用同一判定。

子升级判定扩展为：

```ts
export type ChildUpgradeBlockReason =
  | 'ready'
  | 'building-locked'
  | 'child-locked'
  | 'child-at-main-level'
  | 'insufficient-resources'
```

顺序为建筑解锁 → 下标是否在固定容量内且小于 `getUnlockedChildCount` → 子等级是否已追平主等级 → 成本 → 资源。非法或隐藏下标统一返回 `child-locked`，Store 不扣费。

## 配置 JSON 契约

继续使用 `src/config/economy.config.json`，schema 版本升为 2。现有生产、tick、离线上限、`childUpgradeCostByTargetLevel` 和 `buildingUpgradeCostByTargetLevel` 数值保持不变，新增 `buildingPowerById`：

```json
{
  "version": 2,
  "resourceTickSeconds": 10,
  "maxOfflineSeconds": 28800,
  "production": {},
  "childUpgradeCostByTargetLevel": {},
  "buildingUpgradeCostByTargetLevel": {},
  "buildingPowerById": {
    "repair-shop":             { "1": 100, "2": 130, "3": 165, "4": 205, "5": 250, "6": 300, "7": 355, "8": 415, "9": 480, "10": 550 },
    "recycling-yard":          { "1": 120, "2": 155, "3": 195, "4": 240, "5": 290, "6": 345, "7": 405, "8": 470, "9": 540, "10": 615 },
    "commercial-street":       { "1": 150, "2": 190, "3": 235, "4": 285, "5": 340, "6": 400, "7": 465, "8": 535, "9": 610, "10": 690 },
    "metalworking-plant":      { "1": 180, "2": 225, "3": 275, "4": 330, "5": 390, "6": 455, "7": 525, "8": 600, "9": 680, "10": 765 },
    "gas-station":             { "1": 160, "2": 202, "3": 249, "4": 301, "5": 358, "6": 420, "7": 487, "8": 559, "9": 636, "10": 718 },
    "clubhouse":               { "1": 250, "2": 310, "3": 380, "4": 460, "5": 550, "6": 650, "7": 760, "8": 880, "9": 1010, "10": 1150 }
  }
}
```

上例中的空对象只表示既有字段在此处省略；实际 JSON 必须保留当前完整生产配置、1–10 子升级成本和 2–10 主升级成本。

类型契约：

```ts
export interface EconomyConfig {
  version: 2
  resourceTickSeconds: 10
  maxOfflineSeconds: 28_800
  production: Partial<Record<BuildingId, ProductionConfig>>
  childUpgradeCostByTargetLevel: Record<BuildingLevel, ResourceCost>
  buildingUpgradeCostByTargetLevel:
    Partial<Record<BuildingLevel, ResourceCost>>
  buildingPowerById:
    Record<BuildingId, Record<BuildingLevel, number>>
}

export function getBuildingPower(
  buildingId: BuildingId,
  level: BuildingLevel,
): number
```

配置校验除现有规则外，必须拒绝：

- `version !== 2`。
- 缺少或额外的 buildingId。
- 任一建筑缺少或额外的等级键，键必须精确为字符串 `"1"` 至 `"10"`。
- 战力不是有限、非负、安全整数。
- 同一建筑的战力未严格递增，即任意 `power[level + 1] <= power[level]`。

建筑战力只用于展示。当前战力为 `power[currentLevel]`，本次固定增长为 `power[targetLevel] - power[currentLevel]`，升级后战力为 `power[targetLevel]`。它不进入生产公式、子建筑进度、建筑解锁或主升级门槛。未来配置 EXE 只需修改并校验此 JSON，不改变代码契约。

## Store 与原子动作

### 持久化边界

城市 v3 仍只持久化四个字段：

```ts
interface CityDurableState {
  buildingProgress: BuildingProgressById
  resources: ResourceWallet
  lastResourceUpdatedAt: number
  activeProducerIds: BuildingId[]
}
```

存档键继续使用 `dobe-city-progression-v1`，Zustand persist `version` 改为 3。`selectedBuildingId`、选中子槽、详情/确认页面和动画状态都不持久化。

### 初始与重置

初始钱包固定为：

```ts
const INITIAL_RESOURCES = { money: 10_000, oil: 0, materials: 0 }
```

新账号及 `resetAccount(now)` 都恢复：

- 所有主建筑 Lv.1。
- 所有固定容量子槽 Lv.0；每栋建筑只有首槽处于已解锁状态。
- 钱 10000、油 0、物资 0。
- `lastResourceUpdatedAt = now`。
- `activeProducerIds = ['repair-shop']`。
- 帮派声望 0、`lastUpdatedAt = now`。
- 清空建筑选择和所有面板会话状态。

重置账号继续要求二次确认。

### 升级动作

动作必须返回结果，供 UI 准确区分成功、失败与仅结算：

```ts
export interface UpgradeActionResult {
  applied: boolean
  reason:
    | ChildUpgradeBlockReason
    | MainUpgradeBlockReason
    | 'invalid-request'
}

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
```

两种升级均遵循同一事务顺序：

1. 在同一次 `set` 回调中，以操作前的建筑进度和 `activeProducerIds` 把资源原子结算到 `now`。
2. 用结算后的钱包重新调用纯判定函数，不能信任 UI 打开确认页时的旧判定。
3. 非 `ready` 时保留结算结果与资源时钟，不扣费、不改等级，并返回失败 reason。
4. `ready` 时扣除完整三资源成本。
5. 子升级只修改指定槽 `+1`；主升级只修改主等级 `+1`。
6. 返回 `{ applied: true, reason: 'ready' }`。

无效 buildingId、非整数/固定容量外的 childIndex、非有限 `now` 在进入 `set` 前统一返回 `{ applied: false, reason: 'invalid-request' }`，不得抛错或改变状态。合法 buildingId 的隐藏槽下标进入纯子升级判定并返回 `child-locked`。

### 调试动作

设置面板新增两个无需二次确认、点击即执行的按钮：

1. **解锁帮派树**
   - 读取唯一时间 `now`。
   - 先调用城市动作 `syncResourceProduction(now, 50)`：仅用旧 `activeProducerIds` 和旧等级结算到 `now`，再把当前已解锁生产者同步为 Lv.50 对应集合，并把生产基准推进到 `now`，所以新生产者不追溯。
   - 再把帮派 `totalReputation = 1470`、`lastUpdatedAt = now`。
   - 连续点击是幂等的；第二次只进行正常的到时结算并保持 Lv.50。

2. **钱/油/物资各 +10000**
   - 读取唯一时间 `now`。
   - 在城市 Store 的一次原子 `set` 内先按当前生产者结算到 `now`，再给三项资源分别增加 10000。
   - 可重复点击。
   - 每项使用安全加法 `min(Number.MAX_SAFE_INTEGER, normalizedBalance + 10000)`，禁止 Infinity、负数和不安全整数。

设置面板不因执行这两个动作自动关闭；以 `aria-live="polite"` 显示“帮派树已解锁”或“钱、油、物资各增加 10000”。重置入口及其二次确认流程保持独立。

## 建筑面板 UI 状态机

### 状态

```ts
type BuildingPanelView =
  | { kind: 'details'; selectedChildIndex: number | null }
  | { kind: 'main-upgrade-confirm'; selectedChildIndex: number | null }
```

面板关闭由全局 `selectedBuildingId === null` 表示。面板会话从某建筑被选中开始，到关闭或切换到另一建筑结束。

### 进入详情与子建筑选择

进入一个新的建筑面板会话时：

1. 计算已解锁槽位的 blueprint 顺序。
2. 默认选择第一个 `childLevel < mainLevel` 的槽位。
3. 若已解锁槽位全部追平，`selectedChildIndex = null`。

详情页展示：

- 建筑名、`等级 L / 10`、当前建筑战力。
- 现有产出与三资源余额。
- 已解锁子建筑选择器，只显示 blueprint 前 `unlockedChildCount` 项；每项显示名称、描述和 `Lv.X / Lv.L`。
- 当前选中项的名称、等级和升一级完整三资源成本。
- 进度区。

选择器支持鼠标、触摸和键盘；使用单选语义（`radiogroup`/`radio` 或等价 tablist），选中态不能仅依赖颜色。

用户手动选择后，在本次面板会话中保持该选择。资源变化、10 秒 tick 和普通重渲染不得重置它。

### 公用子升级按钮与自动选择

当总进度 `< 100%` 时，进度区显示：

- `role="progressbar"`，`aria-valuemin=0`、`aria-valuemax=100`、`aria-valuenow` 为当前精确百分比。
- 整数百分比文案。
- 唯一一个公用子建筑升级按钮。

按钮文案为 `升级「名称」至 Lv.N · 钱 A · 油 B · 物资 C`，零成本项可省略。资源不足时按钮禁用，并显示精确缺口；选中项非法或不存在时按钮禁用。

成功升级后：

- 若当前槽仍低于主等级，保持选中当前槽，便于连续升级。
- 若当前槽刚好追平主等级，从当前 index 的下一个位置开始，按 blueprint 顺序循环查找第一个已解锁且未追平的槽。
- 找到则自动选中；找不到说明总进度已完成，设为 `null` 并进入 100% 展示。

失败升级不改变选择。UI 选择永不写入 localStorage。

### 100% 与主升级确认

当总进度 `=== 100%`：

- 进度条和公用子升级按钮整个区域替换为一个 `升级主建筑至 Lv.N` 按钮。
- Lv.10 时不显示按钮，显示 `已达到最高等级 Lv.10`。
- 点击主升级按钮只把状态切到 `main-upgrade-confirm`，不结算、不扣费、不升级。

确认界面是同一面板内的独立页面，不与详情内容同时展示。它显示：

- 建筑名和 `目标等级 Lv.N`。
- 钱、油、物资三项完整成本，包含 0 值项。
- `当前建筑战力 P`。
- `本次战力 +D`。
- `升级后战力 Q`。
- 当前门槛/资源判定结果。
- `返回`按钮。
- `确认升级`按钮。

确认界面每次渲染都基于最新 Store 重新计算 decision。只有 reason 为 `ready` 时确认按钮可用；资源不足及任一其他 reason 都禁用，并显示上文精确文案。点击返回只回详情，不改变资源、等级或原选择。

点击可用的确认按钮时调用 Store 原子动作。Store 仍执行 settle → recheck → deduct → upgrade：

- 成功：回到详情页。若主升级新解锁了槽位，自动选中新槽位，即 index 为旧 `unlockedChildCount`；修车厂 Lv.5→6 及以后没有新槽，则选择 blueprint 顺序第一个未追平槽。新槽在 UI 显示 Lv.0 脚手架，并开始计入总进度。
- 失败：停留确认页，按 Store 返回 reason 和最新状态更新禁用态与文案，不出现部分扣费。

关闭按钮、Escape、切换建筑都终止会话；再次打开时重新默认选择首个未追平槽，不恢复旧选择。详情和确认界面都阻止 pointer/click 事件传入 3D 场景。

## 3D 渲染与动画

`getRenderedBuildingFragments` 先取得 `unlockedChildCount`，仅遍历 blueprint 的此前缀：

```ts
blueprints
  .slice(0, getUnlockedChildCount(buildingId, progress.level))
  .map((blueprint, index) => renderUnlockedSlot(...))
```

接口改为携带 `buildingId`，避免由 UI 或渲染层重复推断修车厂规则：

```ts
getRenderedBuildingFragments(
  buildingId: BuildingId,
  progress: BuildingProgress,
  animatedFragmentId?: string,
): readonly RenderedBuildingFragment[]
```

- 未解锁槽不返回任何渲染对象，完全隐藏。
- 已解锁 Lv.0 槽返回 scaffold。
- 已解锁 Lv.1+ 槽按自己的等级生成几何。
- 单次会话中恰好一个已解锁子槽 `+1` 时，仅该槽播放现有 400ms 绿色扫光、抬升和回弹。
- 主等级变化、新槽从隐藏变为 Lv.0、多槽迁移、重置和 rehydrate 均不播放子升级动画。
- `prefers-reduced-motion` 继续关闭动画但保留最终几何状态。

## v2 → v3 迁移与规范化

### 迁移顺序

1. 按固定容量读取六栋建筑；主等级规范化为 `1...10`，子等级规范化为 `0...主等级`。
2. 计算每栋建筑在新规则下的 `unlockedChildCount`。
3. 对每个 index `>= unlockedChildCount` 的隐藏槽：
   - 读取已规范化旧等级 `L`；
   - 退款该槽从 Lv.0 建到 Lv.L 的每一步旧子升级成本，即累加旧目标等级 1、2、…、L 的三资源成本；
   - 把该槽等级重置为 0。
4. 已解锁槽保留规范化后的旧等级。
5. 把所有槽重新截断到不高于主等级。
6. 将三资源退款分别加到规范化旧钱包，使用饱和安全加法截断到 `Number.MAX_SAFE_INTEGER`。
7. 规范化 `lastResourceUpdatedAt` 和 `activeProducerIds`；不追溯迁移时刻之前的新生产者收益。

退款必须使用 v2 发布时 `economy.config.json` 的旧子升级价格快照，而不是未来可能被配置 EXE 改动的 v3 当前价格。实现中冻结以下迁移常量：

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
  10: { money: 225, oil: 0, materials: 0 }
} as const
```

迁移只退被新规则隐藏而删除的子等级步骤，不退主建筑成本，不退仍解锁槽的等级，也不改变帮派声望。

### 迁移例子

v2 输入：

```json
{
  "buildingProgress": {
    "repair-shop": { "level": 2, "childLevels": [2, 1, 2, 0, 1] },
    "commercial-street": { "level": 3, "childLevels": [3, 2, 1, 2, 1, 0, 0, 0, 0, 0] }
  },
  "resources": { "money": 100, "oil": 7, "materials": 9 }
}
```

迁移结果：

- 修车厂 Lv.2 只解锁前 2 槽：
  - 隐藏槽 2 的旧 Lv.2 退款 `5 + 10 = 15` 钱；
  - 隐藏槽 4 的旧 Lv.1 退款 `5` 钱；
  - 新数组为 `[2, 1, 0, 0, 0]`。
- 商业街 Lv.3 解锁前 3 槽：
  - 隐藏槽 3 的旧 Lv.2 退款 `15` 钱；
  - 隐藏槽 4 的旧 Lv.1 退款 `5` 钱；
  - 新数组为 `[3, 2, 1, 0, 0, 0, 0, 0, 0, 0]`。
- 总退款 40 钱，钱包变为 `{ money: 140, oil: 7, materials: 9 }`。

若某隐藏槽旧等级为 3，则该槽退款为目标 Lv.1、Lv.2、Lv.3 成本总和，即 35 钱，而不是只退 Lv.3 的 20 钱。

### 坏数据边界

- 缺失建筑回退到主 Lv.1、固定容量全 Lv.0。
- 非有限、负数、小数等级先截断为有限整数并限制在合法范围。
- 数组过短补 0，过长忽略多余项。
- 钱包缺失、负数、NaN、Infinity 规范化为 0；小数向下取整；超过安全整数截断到 `Number.MAX_SAFE_INTEGER`。
- 退款累加逐项饱和，不能先产生 Infinity 再规范化。
- v3 rehydrate 仍执行相同规范化和隐藏槽清零，但不重复退款；退款只在 `persistedVersion < 3 && persistedVersion >= 2` 的迁移路径执行一次。
- v1 存档先沿用现有 v1→v2 映射，再立即执行 v2→v3 隐藏槽清零与退款；这样任意旧版本都得到同一 v3 不变量。

## 错误处理边界

- 配置 JSON schema 错误属于构建/启动错误，校验器抛出带精确字段路径的 `Invalid economy config: <path>`；测试和构建必须阻止发布。
- 运行时纯判定函数对合法 TypeScript 领域对象无副作用；Store 入口对字符串 ID、下标和时间做防御校验。
- 找不到成本或战力配置视为配置错误，不能把缺失成本当免费，也不能执行升级。
- 资源结算、调试加钱、迁移退款统一使用非负安全整数和饱和加法。
- 系统时间倒退时沿用现有策略：不倒退资源时钟、不产生负收益，但升级仍以最后已结算钱包重新判定。
- UI 打开确认后资源、帮派或门槛发生变化时，以确认点击时 Store 的重查为准。
- 任意失败升级最多推进合法资源结算时钟，不扣升级费、不改主/子等级、不播放升级动画。
- React 错误边界继续覆盖可恢复的渲染错误；配置模块加载失败由构建检查和启动失败页处理，不展示带错误数据的城市。

## 测试矩阵

### 纯规则与配置

- 六栋建筑主等级上限均为 Lv.10。
- 修车厂每级解锁数为 `1,2,3,4,5,5,5,5,5,5`；其他建筑为 `1...10`。
- 隐藏下标返回 `child-locked`；子建筑不能超过主建筑。
- 总进度只统计已解锁槽，逐次升级分子 +1；100% 使用精确等式。
- 主升级 reason 顺序逐项覆盖，包括同时满足多个阻止条件时只返回优先项。
- 目标 Lv.2–5：修车厂无外部门槛，其他四栋受修车厂门槛，Clubhouse 不受该门槛。
- 目标 Lv.6–10：所有非 Clubhouse 受 Clubhouse 解锁和等级门槛，Clubhouse 自身不受外部门槛。
- 配置包含每栋建筑 Lv.1–10 战力，严格递增、非负、安全整数；缺键、额外键、重复/下降值均拒绝。
- 战力差只用于展示，不改变生产和升级判定。

### 迁移、Store 与重置

- v2→v3 对修车厂和普通建筑按新解锁数清零隐藏槽。
- 每个删除槽按 1...旧等级逐步退款三资源；多建筑、多槽累加正确。
- 已解锁槽不退款，主等级不退款，v3 rehydrate 不二次退款。
- 钱包接近 `Number.MAX_SAFE_INTEGER` 时退款和调试加钱饱和不溢出。
- v1→v2→v3 链式迁移和坏存档规范化。
- 新账号和重置均得到 `{ money:10000, oil:0, materials:0 }` 及其他初始状态。
- 子升级和主升级均验证 settle → recheck → deduct → upgrade 的原子顺序。
- 确认页打开后资源被其他 tick 改变，再确认仍以最新钱包判定。
- 无效 ID、隐藏下标、非有限时间严格 no-op。
- 持久化对象只含四个 v3 durable 字段，不含 UI 选择。

### UI 状态机

- 打开面板默认选择首个已解锁未追平槽。
- 手选后普通重渲染和资源 tick 保持选择。
- 当前槽未追平时连续升级仍选当前槽；追平后从下一槽循环选择。
- 找不到未追平槽时进度区完整替换为主升级按钮。
- 点击主升级只进入确认页，资源和等级不变。
- 确认页展示目标等级、完整三资源成本、当前战力、固定增量和升级后战力。
- 资源不足或建筑门槛不满足时确认禁用并显示精确 reason 文案。
- 返回详情不改变状态；成功确认返回详情并自动选择新解锁槽。
- 修车厂 Lv.5→6 成功后因无新槽而选择首个未追平槽。
- 关闭再打开不恢复旧子槽选择。
- 未解锁槽在 DOM 中不存在；锁定建筑不显示升级控件。
- 设置两个调试动作无需确认、可重复；重置仍需二次确认。
- 对话/面板语义、焦点、Escape、键盘选择、`aria-live` 和 reduced-motion 可访问。

### 3D

- 每栋建筑 Lv.1–10 的渲染槽数等于 `getUnlockedChildCount`。
- 未解锁槽无 scaffold、mesh 和动画 ID。
- 已解锁 Lv.0 显示 scaffold，Lv.1+ 使用自身等级几何。
- 子升级只播放对应槽 400ms 动画；主升级解锁新槽不播放；rehydrate、迁移和重置不播放。
- 全等级与部分等级几何仍在 footprint 和 hitbox 边界内。

### 集成与真实浏览器验收

真实 Chrome CDP 必须覆盖：

1. 清空存档后验证初始 10000 钱、首槽可见、其余槽在 UI/3D 隐藏。
2. 自由选择已解锁槽并用公用按钮连续升级，观察进度逐次增长和 400ms 对应 3D 动画。
3. 达到 100% 后验证进度区替换为主升级按钮；点击后资源未扣且进入确认页。
4. 在确认页验证三资源、战力三组数字、返回和资源不足禁用。
5. 成功确认后验证只扣一次费、主等级 +1、新槽出现并自动选中。
6. 普通建筑目标 Lv.2–5 分别验证修车厂过低和通过；修车厂该区间不受外部门槛。
7. 非 Clubhouse 目标 Lv.6 验证 Clubhouse 未解锁、等级过低和通过；Clubhouse 自身验证只受 Lv.40、进度和资源。
8. 点击“解锁帮派树”，验证声望 1470/Lv.50、生产者同步且无历史追溯。
9. 连续点击两次“钱/油/物资各 +10000”，验证每项累计 +20000 且先结算当期生产。
10. 重置经二次确认后恢复初始钱包、帮派、建筑、生产时钟和选择。
11. 注入代表性 v2 存档，刷新触发一次退款，再次刷新不重复退款。
12. 桌面和 390×844 视口逐页验证详情、确认和设置面板：无横向溢出、内容可滚动、按钮可触达、焦点可见。

## 响应式与可访问性

- 桌面沿用侧边建筑面板；390×844 使用底部/全宽滚动面板，详情与确认页都限制在可视高度内。
- 子建筑选择器允许换行或横向受控滚动，但页面本身不能横向溢出。
- 公用升级按钮和确认按钮触控目标不小于 44×44 CSS px。
- 进度不能只用颜色表达，必须同时有百分比文本和 `progressbar` 语义。
- 战力增长同时显示 `+N` 文本。
- 进入确认页时焦点移到确认页标题；返回时焦点回到“升级主建筑”按钮；关闭后焦点回到触发建筑。
- 禁用按钮附近有可读阻止原因；颜色对比和焦点环沿用现有高对比样式。

## 发布边界

实现完成后的发布验收范围为：

- 运行单元/UI 测试、TypeScript typecheck、ESLint、Prettier check 和 production build。
- 用真实 Chrome CDP 完成桌面与 390×844 全流程，不以 jsdom 测试替代真实交互。
- 构建继续使用 GitHub Pages base `/DobeDemo/`。
- 发布 `gh-pages` 后等待 Pages 状态为 `built`。
- 验证公开 HTML 及其引用的当前 JS/CSS 均返回 HTTP 200，并在公开地址复跑关键升级、迁移和设置动作。
- 不发布 `dist`、临时 Chrome profile、CDP 临时数据或未知本地文件。
- 不 force push。

本设计文件本身不执行构建、Git 操作或 Pages 发布；这些属于后续实现计划及交付阶段。

## 非目标

- 不制作未来配置 EXE，只冻结其可读写的 JSON schema。
- 不让战力影响生产、帮派、资源或升级门槛。
- 不新增升级等待、倒计时、付费加速或“立即完成”。
- 不新增服务器账号、云存档、防作弊或跨设备同步。
- 不持久化子建筑 UI 选择或确认页。
- 不改变帮派树建筑解锁顺序、生产建筑种类或现有生产公式。
