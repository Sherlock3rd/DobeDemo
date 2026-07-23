# 独立子建筑与模拟经营经济设计

## 目标

把现有“按固定顺序完成碎片，再确认主建筑升级”的流程改造成可自由选择的独立子建筑升级，并增加钱、油、物资三资源的在线/离线生产和升级消耗。

同时调整：

- 修车厂最多 5 个子建筑。
- 帮派声望改为每 10 秒 +1。
- Clubhouse 最高 Lv.10；其余建筑最高 Lv.5，且不得升级到高于 Clubhouse 的等级。
- 配置数据外置，为后续独立配置 EXE 提供稳定文件格式。
- 完成后分段提交 `main`，更新 `gh-pages` 并公开复验。

## 已确认规则

### 主建筑与子建筑

- 主建筑初始 Lv.1。
- 子建筑初始 Lv.0，表示“未建设”。
- 玩家可自由选择任一未追平的子建筑升级。
- 子建筑等级不得高于所属主建筑等级。
- 只有全部子建筑达到主建筑当前等级，主建筑才进入可升级状态。
- 主建筑升级成功后，子建筑保持原等级，玩家再次自由选择升级顺序。
- 修车厂使用 5 个子建筑蓝图。
- 其他五类建筑沿用 10 个子建筑蓝图。

### 等级上限和 Clubhouse 门槛

- Clubhouse 主建筑和子建筑最高 Lv.10。
- 其他建筑主建筑和子建筑最高 Lv.5。
- 非 Clubhouse 的目标主建筑等级不得高于 Clubhouse 当前等级。
- Clubhouse 尚未按帮派树解锁时，任何非 Clubhouse 主建筑升级都阻止，并提示：
  - `需要先将帮派树提升至 Lv.40 解锁 Clubhouse`
- Clubhouse 已解锁但等级不足时，阻止升级并提示：
  - `需要先将 Clubhouse 提升至 Lv.N`
- 建筑自身尚未解锁时，继续显示现有帮派树等级/职位解锁提示，不显示升级控件。

## 领域模型

### 等级

```ts
export type ChildBuildingLevel = 0 | BuildingLevel

export interface BuildingProgress {
  level: BuildingLevel
  childLevels: ChildBuildingLevel[]
}
```

`childLevels` 长度必须等于建筑子建筑数量：

- `repair-shop`: 5
- 其余建筑: 10

规范化不信任数据时：

- 缺失/非法子建筑等级变为 0。
- 子建筑等级截断到 `0...主建筑等级`。
- 非 Clubhouse 主建筑截断到 `1...5`。
- Clubhouse 主建筑截断到 `1...10`。
- 非 Clubhouse 主建筑严格截断到不高于 Clubhouse 等级。

### 资源

```ts
export const RESOURCE_TYPES = ['money', 'oil', 'materials'] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]

export interface ResourceWallet {
  money: number
  oil: number
  materials: number
}
```

资源为非负有限整数。所有生产和扣费操作都返回新对象；余额不足时升级严格 no-op。

### 城市持久状态

`useCityStore` 统一持久化：

```ts
interface CityDurableState {
  buildingProgress: BuildingProgressById
  resources: ResourceWallet
  lastResourceUpdatedAt: number
  activeProducerIds: BuildingId[]
}
```

`selectedBuildingId` 仍是瞬时 UI 状态，不持久化。

把建筑进度和资源放在同一 Store，可以在一次 Zustand `set` 内完成：

1. 先结算升级操作发生前的生产。
2. 检查建筑/Clubhouse/资源门槛。
3. 扣除资源。
4. 修改一个子建筑或主建筑等级。

不会出现资源已扣但等级未变的跨 Store 中间态。

## 配置文件

新增：

- `src/config/economy.config.json`
- `src/config/economyConfig.ts`
- `src/config/economyConfig.test.ts`

JSON 只承载可调数值，不承载核心等级不变量：

```json
{
  "version": 1,
  "resourceTickSeconds": 10,
  "maxOfflineSeconds": 28800,
  "production": {
    "repair-shop": {
      "resource": "money",
      "basePerTick": 1,
      "childLevelStep": 5,
      "bonusPerStep": 1
    },
    "commercial-street": {
      "resource": "money",
      "basePerTick": 2,
      "childLevelStep": 5,
      "bonusPerStep": 1
    },
    "gas-station": {
      "resource": "oil",
      "basePerTick": 1,
      "childLevelStep": 5,
      "bonusPerStep": 1
    },
    "metalworking-plant": {
      "resource": "materials",
      "basePerTick": 1,
      "childLevelStep": 5,
      "bonusPerStep": 1
    }
  },
  "childUpgradeCostByTargetLevel": {
    "1": { "money": 5, "oil": 0, "materials": 0 },
    "2": { "money": 10, "oil": 0, "materials": 0 },
    "3": { "money": 20, "oil": 0, "materials": 0 },
    "4": { "money": 35, "oil": 0, "materials": 0 },
    "5": { "money": 50, "oil": 0, "materials": 0 },
    "6": { "money": 75, "oil": 0, "materials": 0 },
    "7": { "money": 105, "oil": 0, "materials": 0 },
    "8": { "money": 140, "oil": 0, "materials": 0 },
    "9": { "money": 180, "oil": 0, "materials": 0 },
    "10": { "money": 225, "oil": 0, "materials": 0 }
  },
  "buildingUpgradeCostByTargetLevel": {
    "2": { "money": 25, "oil": 0, "materials": 0 },
    "3": { "money": 60, "oil": 0, "materials": 0 },
    "4": { "money": 120, "oil": 0, "materials": 0 },
    "5": { "money": 200, "oil": 0, "materials": 0 },
    "6": { "money": 320, "oil": 0, "materials": 0 },
    "7": { "money": 480, "oil": 0, "materials": 0 },
    "8": { "money": 700, "oil": 0, "materials": 0 },
    "9": { "money": 950, "oil": 0, "materials": 0 },
    "10": { "money": 1250, "oil": 0, "materials": 0 }
  }
}
```

生产公式：

```ts
perTick = basePerTick +
  Math.floor(sum(childLevels) / childLevelStep) * bonusPerStep
```

配置校验器必须拒绝：

- 错误版本。
- 未知/缺失资源字段。
- 负数、非整数或非有限数值。
- 不完整的 1–10 子建筑成本或 2–10 主建筑成本。
- 未知生产建筑或未支持的资源。

第一版升级成本三资源结构完整，但油和物资均为 0；后续配置 EXE 只需读写此 JSON、运行校验并提交 Git。EXE 不属于本次实现范围。

## 资源生产

### 生产建筑

- 修车厂：钱。
- 商业街：钱。
- 加油站：油。
- 金属加工厂：物资。
- 废车回收厂：本版无产出。
- Clubhouse：本版无产出。

### 在线与离线结算

- 每 10 秒形成一个完整生产 tick。
- 控制器每秒检查一次，但不足 10 秒时 Store 不变。
- 保留不足一个 tick 的时间余量。
- 离线最多结算 8 小时。
- 生产只来自已解锁且已激活的生产建筑。

`activeProducerIds` 防止新解锁建筑追溯生产：

1. 使用持久化的 active producer 集合结算过去时间。
2. 再根据当前帮派等级刷新 active producer 集合。
3. 新进入集合的建筑从本次同步时间开始生产。

升级操作在扣费前用旧子建筑等级结算到 `now`，因此不会把刚升级后的高产量追溯到过去。

初始资源为 `{ money: 0, oil: 0, materials: 0 }`。修车厂初始已激活，子建筑全 Lv.0 时仍每 10 秒生产 1 钱，避免经济死锁。

## 帮派挂机

替换现有每秒产出：

```ts
export const REPUTATION_TICK_SECONDS = 10
export const REPUTATION_PER_TICK = 1
```

结算规则：

```ts
ticks = Math.floor((now - lastUpdatedAt) / 10_000)
earnedReputation = ticks
nextUpdatedAt = lastUpdatedAt + ticks * 10_000
```

- 不足 10 秒不产出。
- 保留余量。
- 离线最多结算 8 小时，即最多 2,880 个 tick。
- Store 继续把总声望封顶到 1,470。
- HUD 显示 `+1 声望/10秒`。

## 升级判定

### 子建筑升级

输入：

```ts
upgradeChildBuilding(
  buildingId: string,
  childIndex: number,
  gangLevel: number,
  now: number,
): void
```

顺序：

1. 结算 `now` 前资源。
2. 校验建筑 ID、子建筑下标和帮派解锁。
3. 校验 `childLevel < building.level`。
4. 获取目标子建筑等级成本。
5. 校验余额。
6. 原子扣费并仅提升所选子建筑一级。

玩家可按任意顺序升级，不存在“下一个固定碎片”。

### 主建筑升级

输入：

```ts
upgradeMainBuilding(
  buildingId: string,
  gangLevel: number,
  now: number,
): void
```

顺序：

1. 结算 `now` 前资源。
2. 校验建筑解锁。
3. 校验建筑未达到自身上限。
4. 校验全部子建筑等级等于主建筑等级。
5. 非 Clubhouse 校验 Clubhouse 解锁和目标等级门槛。
6. 校验目标主建筑等级成本。
7. 原子扣费并提升主建筑一级。

纯判定函数返回以下明确状态之一，Store 只对 `ready` 执行：

```ts
type UpgradeBlockReason =
  | 'ready'
  | 'building-locked'
  | 'child-at-main-level'
  | 'children-not-caught-up'
  | 'building-maxed'
  | 'clubhouse-locked'
  | 'clubhouse-too-low'
  | 'insufficient-resources'
```

## 3D 渲染与动画

`getRenderedBuildingFragments` 改为按每个 `childLevels[index]` 渲染：

- Lv.0：脚手架。
- Lv.1+：按该子建筑自己的等级生成几何部件。
- 本次点击提升的子建筑：使用现有 400ms 绿色入场动画。
- 刷新/rehydrate 不重播动画。

修车厂只返回前 5 个蓝图，并把五个锚点重新居中为一排或适配单行网格；其他建筑保持 5×2。

`BuildingVisual` 从比较 `completedFragments + 1` 改为比较两个 `childLevels` 数组，只在恰好一个子建筑提升一级时解析动画 ID。主建筑升级不触发错误的子建筑动画。

## UI

### HUD

保留帮派等级、职位和进度，新增：

- 钱余额与当前每 10 秒钱产量。
- 油余额与当前每 10 秒油产量。
- 物资余额与当前每 10 秒物资产量。
- 帮派挂机文案 `+1 声望/10秒`。

### 建筑面板

已解锁建筑显示：

1. 主建筑等级：`等级 L / 5` 或 Clubhouse `等级 L / 10`。
2. 当前建筑产出与三资源余额。
3. 主建筑升级卡：
   - 目标等级。
   - 三资源成本。
   - 未追平子建筑数量。
   - Clubhouse 门槛或资源不足原因。
4. 子建筑卡片网格：
   - 名称、描述。
   - `Lv.X / 主建筑 Lv.L`，Lv.0 显示“未建设”。
   - 下一等级成本。
   - 独立升级按钮。
   - 达到主建筑等级时禁用并显示“已追平主建筑”。

修车厂只显示 5 张卡片；其他建筑显示 10 张。

门槛提示优先级：

1. 建筑自身未解锁。
2. 已满级。
3. 子建筑未全部追平。
4. Clubhouse 未解锁。
5. Clubhouse 等级不足。
6. 资源不足。
7. 可升级。

面板继续阻止事件传入 3D 场景，保持响应式滚动和 reduced-motion。

## 存档迁移

城市存档版本从 1 升为 2，存档键保持：

```text
dobe-city-progression-v1
```

旧结构：

```ts
{ level, completedFragments }
```

迁移策略：

1. 先读取并规范化旧主建筑等级。
2. 旧 `completedFragments > 0` 时，把主建筑候选等级提升一级，表示旧流程已经开始目标级施工。
3. 旧已完成碎片映射为目标级子建筑；旧当前主建筑包含的其余碎片映射为旧主建筑等级；未出现的槽位映射为 Lv.0。
4. 修车厂只保留前 5 槽。
5. Clubhouse 截断到 Lv.10。
6. 其他建筑截断到 Lv.5，并严格截断到不高于迁移后 Clubhouse 等级。
7. 最后把每个子建筑截断到不高于其主建筑。
8. v1 没有资源生产历史：钱包设为 0，修车厂设为初始 active producer，`lastResourceUpdatedAt=迁移发生时间`，不追溯功能上线前收益。

这会使旧存档中高于 Clubhouse 的非 Clubhouse 等级下降；这是执行新“不得高于 Clubhouse”硬规则的预期迁移。

## 重置账号

`resetAccount(now)` 使用同一个时间：

1. 城市 Store 重置主建筑 Lv.1、全部子建筑 Lv.0、资源归零、生产时间为 `now`、active producer 仅修车厂。
2. 帮派 Store 声望归零、挂机时间为 `now`。
3. 当前建筑选择清空。

刷新后仍保持该初始账号。

## 测试

### 单元测试

- JSON 配置完整性、拒绝非法配置。
- 修车厂 5 槽、其余 10 槽。
- Lv.0 到主建筑等级的自由子建筑升级。
- 子建筑不超过主建筑。
- 全部追平后主建筑才可升级。
- Clubhouse Lv.10、其他建筑 Lv.5。
- Clubhouse 未解锁/等级不足判定。
- 钱-only 初始成本和三资源扣费结构。
- 每 10 秒生产、余量、8 小时离线上限、active producer 不追溯。
- 帮派每 10 秒 +1、余量和封顶。
- v1→v2 迁移和坏存档规范化。
- reset 同时恢复资源、生产时间、主/子建筑。

### UI/3D 测试

- HUD 三资源和 `+1 声望/10秒`。
- 5/10 子建筑卡片、任意顺序升级。
- 成本、余额、缺失资源和 Clubhouse 提示。
- Lv.0 脚手架和不同子建筑等级几何。
- 仅点击的子建筑播放动画。
- 移动端面板可滚动无横向溢出。

### 浏览器验收

可重复安全 CDP 流程：

1. fresh v2 存档和 0 资源。
2. 等待 10 秒，修车厂获得 1 钱。
3. 注入足够钱，自由选择第 5 个修车厂子建筑先升级。
4. 子建筑达到主建筑等级后按钮禁用。
5. 五个子建筑全部 Lv.1 后，主建筑显示 Clubhouse 未解锁提示。
6. 注入帮派 Lv.40，Clubhouse 解锁但 Lv.1，修车厂 Lv.2 目标仍提示需先提升 Clubhouse。
7. 先升级 Clubhouse 子建筑和主建筑，再成功升级修车厂主建筑。
8. 刷新后资源、主建筑、子建筑和生产时间持久。
9. 注入生产建筑后验证钱/油/物资 10 秒产出。
10. 桌面与 390×844 面板无溢出。

## Git 与 Pages

- 设计、领域/迁移、Store、3D、UI、验收文档分段提交。
- 提交前排除 `dist`、临时 Chrome profile 和未知文件。
- 普通推送 `main`，禁止 force push。
- fresh 构建使用 `/DobeDemo/` base。
- 独立临时 index 快进发布 `gh-pages`。
- 等待 Pages build `built`，验证公开 HTML、当前 JS/CSS HTTP 200，并用真实 Chrome 截图。

## 非目标

- 本次不制作配置 EXE，只冻结其未来读写的 JSON 契约。
- 不增加服务器账号、云存档或防作弊。
- 不增加手动领取按钮。
- 不为废车回收厂或 Clubhouse 配置产出。
- 不在第一版成本中实际消耗油或物资，但结构和 UI 必须支持。
