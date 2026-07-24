# 战役 · 英雄养成 · 全局 HUD 设计规格

- 日期：2026-07-24
- 作者：Demo 技术负责人
- 状态：设计已逐节获用户批准，待实现
- 关联研究：`docs/research/2026-07-24-5v5example-0.5s-analysis.md`
- 关联既有规格：`docs/superpowers/specs/2026-07-24-progressive-building-upgrade-flow-design.md`、`docs/superpowers/specs/2026-07-22-gang-tree-idle-unlocks-design.md`

> 本文档只固化设计，不改动源码/配置/测试。文中出现的所有 `src/**` 路径、JSON 契约、类型与公式均为**待实现目标**的规格描述。全文不含任何占位符或未决项，所有数值均给出确定的代表性建议值与推导公式。

---

## 1. 概述

在既有「工业城帮派树 + 渐进式建筑升级 + 三资源经济」Demo 之上，新增一条完整的**关卡战役玩法闭环**：

1. **战役（推关）**：2 章 × 10 关，共 20 关；纯函数确定性固定步长战斗引擎在独立 R3F 俯视战斗场景中自动演出。
2. **英雄养成**：五阵位（前排 2 + 后排 3）、首版 3 名原创英雄；只消耗共享英雄经验升级；等级受帮派等级封顶。
3. **挂机经验**：通关 1-1 后开启，速率由最高通关关卡决定；地图底部宝箱领取到共享经验池，再在培养页自由升级。
4. **全局 HUD 重构**：顶部头像 / 帮派树入口 / 四资源条，底部「推关 / 英雄 / 设置」导航，红点提示，移动优先 390×844，单 `activeOverlay` 状态机。
5. **帮派树统一解锁**：`ProgressionUnlock` 数组统一承载 building / hero / feature 三类解锁，允许同级多解锁；英雄解锁为**派生**判定。
6. **建筑进度语义**：改为「当前主等级阶段进度」，用可推导基线，不加存档字段。

参考视频（`example/5v5example.mp4`）仅用于提炼玩法结构与交互；**不复制其美术、文案、角色或稀有度/道具体系**（见 §16 非目标）。

### 1.1 与既有系统的边界

- 城市存档 `dobe-city-progression-v1`（persist v3）与经济 `src/config/economy.config.json`（schema v2）**保持不变**。建筑进度语义调整为纯展示/决策层改动，不改存档结构（§9）。
- 帮派声望存档 `gang-progression-v1` 保持；仅将建筑解锁映射迁移进统一 `ProgressionUnlock` 数组（§8）。
- 新增独立 **Adventure Store**（`dobe-adventure-progression-v1`，persist v1，§7）承载英雄/战役/挂机的持久数据。战斗 session 不持久。

---

## 2. 技术路线

### 2.1 纯函数确定性固定步长战斗引擎

- **纯函数**：`simulateBattle(input): BattleResult`，无副作用、不读时钟、不使用 `Math.random`；相同输入必然产生相同 tick 序列与结果（可重放、可单测）。
- **固定步长**：逻辑步长 `tickMs = 100`（每秒 10 tick）。战斗时长上限 `maxBattleTicks = 600`（60 秒）→ 超时未分胜负判**失败**。
- **确定性目标/伤害/技能**：全部由固定优先级与整数运算决定（§11、§12）。
- **seed**：`createBattleSeed(input): string` 由「关卡 id + 双方单位构成（heroId/level/position、enemy 定义）」稳定派生；引擎本身不消费随机数，seed 仅用于日志、重放校验与并列去重的调试标识（并列一律用 slot index 升序打破，无随机）。
- **重放**：因引擎为纯函数 + 固定步长，重放 = 用同一 `BattleInput` 重新调用 `simulateBattle`；`BattleResult.timeline` 可逐 tick 回放到 R3F 场景。

### 2.2 独立 R3F 俯视战斗场景

- 战斗场景 `src/scene/battle/BattleScene.tsx` 独立于城市场景 `CityScene`；进入战斗时通过 `activeOverlay='battle'` 全屏挂载，退出时卸载。
- 场景消费引擎产出的 `timeline`（逐 tick 快照）驱动可视化：单位走位、普攻枪火、技能齐射、伤害飘字、死亡倒地。**可视化不反向影响引擎**（引擎已跑完或按 tick 推进，视图只渲染）。
- 播放控制：`1x`/`2x` 决定每个渲染帧消费的逻辑 tick 数（1 或 2），`暂停`停止 tick 推进，`退出`卸载场景并丢弃 session。倍速不改变结果（结果只依赖 tick 序列）。
- 自动化：走位、普攻、技能均自动；技能冷却归零后在该单位下一个行动 tick 自动释放。英雄头像只展示生命与技能冷却，不可点击施法，也不提供 `Auto` 手动切换。无扫荡 / 体力 / 付费次数 —— 关卡可无限免费重打。

---

## 3. 战役系统

### 3.1 结构

- 20 关 = **2 章 × 每章 10 关**。全局序号 `g ∈ [1, 20]`；章内显示 `${chapter}-${stage}`（如 `1-1 … 1-10`、`2-1 … 2-10`）。
- 全局序号换算：`g = (chapter - 1) * 10 + stageInChapter`，`chapter ∈ {1,2}`，`stageInChapter ∈ [1,10]`。

### 3.2 敌人数量（按全局序号）

| 全局关卡 g | 敌人数 |
|---|---|
| 1–3 | 1 |
| 4–7 | 2 |
| 8–11 | 3 |
| 12–15 | 4 |
| 16–20 | 5 |

纯函数 `getEnemyCount(g)`：
```
1 ≤ g ≤ 3  → 1
4 ≤ g ≤ 7  → 2
8 ≤ g ≤ 11 → 3
12 ≤ g ≤ 15 → 4
16 ≤ g ≤ 20 → 5
其它 → 抛错（非法关卡）
```

### 3.3 递增曲线（战力 / 等级 / 技能）

敌人属性随 `g` 递增，由 `campaign.config.json` 完整物化（§10.2）。推导公式（代表性）：

- `enemyLevel(g)   = 1 + floor((g - 1) / 2)`（g1,g2→Lv1；g3,g4→Lv2；…；g19,g20→Lv10）。与参考视频「1-1/1-2 为 Lv1、1-3 为 Lv2」一致。
- `enemyBaseHp(g)  = 400 + 80 * (g - 1)`
- `enemyBaseAtk(g) = 70  + 12 * (g - 1)`
- `enemyBaseDef(g) = 15  + 4  * (g - 1)`
- 同一关内的多名敌人使用相同基础属性（先填前排、再填后排；§11.1 阵位映射）。
- 敌人技能沿用全局技能默认（`combat.config.json.skill`），冷却更长（`enemySkillCooldownTicks = 120`），使玩家侧节奏领先。

### 3.4 首通 / 重试 / 解锁

- **失败无限重试**：失败不消耗任何资源、不改任何持久状态，可立即重打。
- **胜利**：
  - 若该关是**新的最高通关**（`g === highestClearedStage + 1`），在**同一事务**内（§7.4）：`highestClearedStage = g`；`sharedExp += firstClearReward(g)`；若此前挂机未开启且 `g ≥ 1`，初始化挂机时钟。
  - 若为重打已通关卡，仅结算战斗结果，不发首通奖励、不改 `highestClearedStage`。
- **解锁下一关**：关卡 `g` 可挑战的判定 `isStageUnlocked(g) = (g === 1) || (g ≤ highestClearedStage + 1)`。即已通关卡与「下一关」可打。

---

## 4. 英雄系统

### 4.1 阵位模型（前排 2 + 后排 3，最多 5 人）

```ts
type Row = 'front' | 'back'
interface FormationSlot { row: Row; index: number } // front: index 0..1；back: index 0..2
type FormationAssignment = Array<{ heroId: HeroId; row: Row; index: number }>
```

- 阵位共 5 个槽：`front[0], front[1], back[0], back[1], back[2]`。
- 全局作战顺序索引 `globalIndex`：`front[0]=0, front[1]=1, back[0]=2, back[1]=3, back[2]=4`。用于确定性目标选择的并列打破。
- 一名英雄至多占一个槽；一个槽至多一名英雄；`assignment` 长度 ∈ [1, 5]，去重校验。
- 前排职责：**优先承伤**（敌方普攻优先锁定存活前排）+ **防御修正**；后排：**输出修正**、前排全灭前不被普攻锁定（仍可被技能 splash 波及）。阵位修正见 §11.2。

### 4.2 首版英雄（3 名，原创）

| heroId | 中文名 · 绰号 | 定位 | 默认阵位 | 解锁 | 程序化外观方向（仅基础几何体，不用外部美术） |
|---|---|---|---|---|---|
| `foreman` | 陈锤 · 「工头」 | 后排 · 全能枪手 | back[1] | 玩家本体，默认拥有（帮派 Lv1） | 中等胶囊躯干 + 黄色工装配色，头部安全帽为半球，肩部两块方形护垫，手持短管霰弹枪（圆柱+方块）。暖黄主色。 |
| `anvil` | 岳峰 · 「铁砧」 | 前排 · 坦克 | front[0] | 帮派 Lv12 自动永久解锁 | 厚重方体躯干（宽肩）+ 深灰装甲块，胸前橙色反光条，左手钢板盾（大扁盒），右手改装消防斧（长柱+楔块）。冷灰 + 橙警示。 |
| `skyline` | 秦岚 · 「长空」 | 后排 · 射手 | back[0] | 帮派 Lv28 自动永久解锁 | 细高胶囊 + 深蓝紧身轮廓，肩挎长管步枪（细长圆柱），头部瞄具为青色发光小方块。冷青点缀。 |

- 命名与外观均为原创，不复制参考游戏（无「CYCLOPS」「Enforcer」「SR」等资产/文案）。
- 外观由 `heroes.config.json.appearance` 描述（几何原语 + 配色），由 `BattleUnit.tsx` 程序化组装；不引入贴图/模型文件。

### 4.3 等级、经验与封顶

- 英雄等级 `heroLevel ∈ [1, 50]`，且**不得超过当前帮派等级**：`heroLevelCap = min(50, gangLevel)`。
- 升级**只消耗共享英雄经验 `sharedExp`**，不消耗钱/油/物资。
- 单次升级 `L → L+1` 消耗 `expToLevel(L)`（§10.1）。原子操作（§7.4）：
  1. 若 `heroLevel ≥ heroLevelCap` → 阻止，原因 `hero-level-capped-by-gang`（当 `gangLevel < 50`）或 `hero-maxed`（当 `heroLevel === 50`）。
  2. 若 `sharedExp < expToLevel(L)` → 阻止，原因 `insufficient-shared-exp`。
  3. 否则 `sharedExp -= cost`；`heroLevels[heroId] = L + 1`。
- 属性、战力、技能、升级经验全部配置化（§10.1）。
- **帮派调试直升 50**：设置面板「解锁帮派树」把声望置为 1470（Lv50）。由于英雄解锁是**派生自 `gangLevel`**（§8.2），`anvil`(12)、`skyline`(28) 立即视为已解锁；无需一次性 UI 事件。

### 4.4 单位属性推导

给定英雄在等级 `L`（配置见 §10.1）：
```
HP(L)  = baseHp  + hpPerLevel  * (L - 1)
ATK(L) = baseAtk + atkPerLevel * (L - 1)
DEF(L) = baseDef + defPerLevel * (L - 1)
```
全部为安全整数（`Number.isSafeInteger`），配置解析时校验非负、`perLevel ≥ 0`。

---

## 5. 挂机经验系统

### 5.1 开启条件与速率

- 通关 1-1 后开启：`idleUnlocked = highestClearedStage ≥ 1`。
- 速率由**最高通关关卡**决定：`idleExpPerTick = ratePerTick(highestClearedStage)`（§10.4）。代表性：`ratePerTick(g) = 2 * g`（g1→2/10s，g20→40/10s）；`g = 0` 时未开启，速率视为 0。
- tick = 10 秒；离线上限 `maxOfflineSeconds = 28800`（8 小时）；不足一个 tick 的时间余量保留到下次；系统时钟倒退 no-op（沿用 §5.2 结算规则）。

### 5.2 结算（纯函数，复用既有模式）

`settleIdleExperience({ lastUpdatedAt, now, highestClearedStage }): { earnedExp, nextUpdatedAt }`，与 `gangProgression.calculateIdleSettlement` / `resourceEconomy.settleResourceProduction` 同构：

```
若 !finite(lastUpdatedAt) || !finite(now) || now < lastUpdatedAt → { earnedExp: 0, nextUpdatedAt: lastUpdatedAt }   // 时钟倒退/非法 no-op
若 !idleUnlocked → { earnedExp: 0, nextUpdatedAt: lastUpdatedAt }       // 未开启不产出；首通时事务把时钟初始化为胜利时刻
tickMs      = 10_000
maxOffMs    = 28_800_000
elapsedMs   = now - lastUpdatedAt
capped      = elapsedMs > maxOffMs
effElapsed  = min(elapsedMs, maxOffMs)
ticks       = floor(effElapsed / tickMs)
若 ticks === 0 → { earnedExp: 0, nextUpdatedAt: lastUpdatedAt }        // 余量保留
earnedExp   = ratePerTick(highestClearedStage) * ticks
nextUpdatedAt = capped ? now : lastUpdatedAt + ticks * tickMs           // 余量保留
```
`earnedExp` 用饱和加法并入池；`sharedExp` 与 `earnedExp` 均限制在 `[0, Number.MAX_SAFE_INTEGER]`。

### 5.3 宝箱（派生，不额外持久）

- 关卡地图底部常驻**挂机宝箱**，展示「当前可领取经验」= `settleIdleExperience({ lastUpdatedAt: idleClock, now: Date.now(), highestClearedStage }).earnedExp`。此值是**时钟的纯函数**，不单独持久化字段（避免与 §7 的最小持久集冲突）。
- **领取（claim）**为一次原子操作：先结算，再 `sharedExp += earnedExp`，并 `idleClock = nextUpdatedAt`（保留余量）。领取后宝箱归零，继续累计。
- 领取入**共享池**后，玩家在**培养页**自由分配给任意英雄升级（§4.3）。挂机在任何 overlay 下持续累计（时钟不因打开界面而暂停）。

---

## 6. 全局 HUD 重构

参考用户提供的 HUD 图，移动优先基准视口 **390×844**（iPhone 12/13 逻辑分辨率）。

### 6.1 顶部区

- **玩家头像**（左上）：点击打开「英雄/培养」overlay（`heroes`）。
- **帮派树入口**（含**等级 + 职位**文案，如 `Lv.12 Full Patch（正式成员）`）：点击打开 `gangTree` overlay。
- **资源条**：钱 / 油 / 物资 / **英雄经验（`sharedExp`）** 四项常驻，展示余额；钱/油/物资沿用既有 `getCurrentProductionRates` 展示每 10 秒产量，英雄经验展示当前可领挂机宝箱增量提示。

### 6.2 底部导航（三入口）

| 入口 | overlay | 说明 |
|---|---|---|
| 推关 | `adventure` | 打开战役地图（章节/关卡节点、宝箱、挑战）。 |
| 英雄 | `heroes` | 培养页：阵位编排 + 英雄升级（消耗共享经验）。 |
| 设置 | `settings` | 复用既有调试设置（解锁帮派树 / 各资源 +10000 / 二次确认重置）。 |

### 6.3 红点提示

`hasRedDot(entry)` 纯函数：
- **推关**红点：存在可挑战的新关（`highestClearedStage < 20` 且下一关已解锁未打）**或**挂机宝箱可领取（`chestExp > 0`）。
- **英雄**红点：存在任一英雄可升级（`heroLevel < min(50, gangLevel)` 且 `sharedExp ≥ expToLevel(heroLevel)`）。
- **设置**：无红点。
- 红点为派生态，不持久化。

### 6.4 单 `activeOverlay` 状态机（App 重构）

将 `App.tsx` 现有 `gangTreeOpen`/`settingsOpen` 布尔 + `useCityStore.selectedBuildingId` 驱动的建筑面板，统一为单一 overlay：

```ts
type ActiveOverlay =
  | { kind: 'none' }
  | { kind: 'buildingDetail'; buildingId: BuildingId }
  | { kind: 'gangTree' }
  | { kind: 'settings' }
  | { kind: 'adventure' }
  | { kind: 'heroes' }
  | { kind: 'battle'; stage: number }
```

规则：
- **同一时刻至多一个 overlay**。打开任一 overlay 前先关闭当前 overlay。
- 打开**全屏玩法**（`adventure` / `heroes` / `battle`）会**关闭建筑详情**（清空 `selectedBuildingId`）。
- 打开 `battle` 只能从 `adventure` 的关卡挑战发起；`battle` 退出/结算回到 `adventure`。
- **挂机继续**：无论当前 overlay 为何，`GangIdleController`、`EconomyIdleController` 与新增 `AdventureIdleClock` 均照常运行；overlay 只影响视图，不暂停时钟。
- `Escape` 关闭当前非 `none` overlay（`battle` 的 Escape 等价「退出战斗」，需二次确认，见 §14.3）。
- `buildingDetail` 由点击城市建筑触发（沿用 `selectBuilding`），映射为 `activeOverlay.kind==='buildingDetail'`。

---

## 7. Adventure Store（persist v1）

### 7.1 存档键与版本

- key：`dobe-adventure-progression-v1`；Zustand `persist` version = 1；`storage` 复用 `createSafeStorage()`（localStorage 不可用回退内存）。

### 7.2 持久字段（`partialize` 仅这些）

```ts
interface AdventureDurableState {
  heroLevels: Record<HeroId, number>       // 仅英雄等级
  sharedExp: number                        // 共享英雄经验池
  formation: FormationAssignment           // 5 阵位编排（≤5 人）
  highestClearedStage: number              // 最高通关全局序号 0..20（0=未通关）
  idleClock: number                        // 挂机时钟（lastUpdatedAt ms）
}
```

- **战斗 session 不持久**：选中关卡、battle timeline、逐单位 HP/能量/冷却、播放速度、结果页——全部为瞬态（存于非持久 slice 或组件内），刷新即丢弃。
- **首通集合不单独持久**：由 `highestClearedStage` 完全编码（关卡必须顺序通关，故「已首通集合 = {1..highestClearedStage}」）。首通奖励在跨过新最高时发放（§7.4）。
- **挂机宝箱不单独持久**：为 `idleClock` 的纯函数（§5.3）。

### 7.3 初始态（新账号）

```
heroLevels = { foreman: 1, anvil: 1, skyline: 1 }   // 等级存在但受解锁与封顶约束展示
sharedExp = 0
formation = [{ heroId: 'foreman', row: 'back', index: 1 }]   // 仅本体默认上阵
highestClearedStage = 0
idleClock = Date.now()
```
> 说明：`anvil`/`skyline` 的等级字段存在但仅在 `isHeroUnlocked` 为真时可编入阵位/升级；未解锁英雄在培养页显示为「帮派 Lv.N 解锁」锁定态。

### 7.4 原子事务

所有涉及经验/等级/通关的写入均在**单个 `set`** 内完成，先结算、后判定、再写入；任一门槛不满足则整体不写：

- **领取宝箱**：`settleIdle → sharedExp += earned → idleClock = next`（单事务）。
- **升级英雄**：`校验 cap 与 sharedExp → sharedExp -= cost → heroLevels[id]+1`（单事务）。
- **胜利首通**：`highestClearedStage = g` 与 `sharedExp += firstClearReward(g)`（若挂机首次开启则一并初始化 `idleClock`）在**同一 `set`** 内完成，保证不出现「涨了最高关但没发经验」的中间态。

### 7.5 reset 协调三个 store

`resetAccount(now)` 扩展为**协调三个 store**（当前只协调 city+gang）：
```
useCityStore.getState().reset(now)        // 既有
useGangStore.getState().reset(now)        // 既有
useAdventureStore.getState().reset(now)   // 新增：回到 §7.3 初始态
```
`useAdventureStore.reset(now)` 把持久字段整体恢复为 §7.3，并清空瞬态 battle session。三者互不依赖顺序，均为幂等。

### 7.6 迁移与坏存档规范化

- 无历史版本 → 仅需 `version:1` + `migrate`（v<1 一律规范化为初始态）。
- `merge(persisted, current)`：`persisted == null` 时返回 `current`（保留 §7.3 初始 `sharedExp/formation` 等，避免把新访客规范化为空——与 city store 既有 `merge` 教训一致）；否则 `{ ...current, ...normalizeAdventureDurableState(persisted, now) }`。
- `normalizeAdventureDurableState`：
  - `heroLevels`：每个已知 `HeroId` 取 `clampInt(value, 1, 50)`；未知 key 丢弃；缺失补 1。
  - `sharedExp`：`clampInt(value, 0, MAX_SAFE_INTEGER)`。
  - `formation`：过滤非法 heroId / 非法槽；去重（同 heroId 或同槽只留首个）；长度截到 ≤5；行/索引越界丢弃；结果为空则回退为 `[{ foreman, back, 1 }]`。
  - `highestClearedStage`：`clampInt(value, 0, 20)`。
  - `idleClock`：`finite(value) ? value : now`。
- 跨 Store 约束由 `reconcileAdventureWithGang(gangLevel)` 在 Adventure hydrate 完成及帮派等级变化后幂等执行：把所有 `heroLevels[id]` 夹到 `1..min(50, gangLevel)`，并从阵容移除当前未解锁英雄；若阵容为空则回退本体默认位。正常游戏中帮派等级只增不减，唯一降级入口是三 Store 同时 reset；该协调主要防御手改/损坏存档。

---

## 8. 帮派树统一 ProgressionUnlock

### 8.1 统一数组

用统一数组替换 `gangProgression.BUILDING_UNLOCKS`，允许同一等级挂多个不同 kind 的解锁：

```ts
type UnlockKind = 'building' | 'hero' | 'feature'
type FeatureId = 'adventure' | 'heroes'
interface ProgressionUnlockBase { requiredLevel: number; roleTitle: string }
type ProgressionUnlock =
  | (ProgressionUnlockBase & { kind: 'building'; buildingId: BuildingId })
  | (ProgressionUnlockBase & { kind: 'hero'; heroId: HeroId })
  | (ProgressionUnlockBase & { kind: 'feature'; featureId: FeatureId })

export const PROGRESSION_UNLOCKS: readonly ProgressionUnlock[] = [
  { kind: 'building', buildingId: 'repair-shop',        requiredLevel: 1,  roleTitle: 'Prospect' },
  { kind: 'feature',  featureId: 'adventure',           requiredLevel: 1,  roleTitle: 'Prospect' },
  { kind: 'feature',  featureId: 'heroes',              requiredLevel: 1,  roleTitle: 'Prospect' },
  { kind: 'hero',     heroId: 'foreman',                requiredLevel: 1,  roleTitle: 'Prospect' },
  { kind: 'building', buildingId: 'recycling-yard',     requiredLevel: 8,  roleTitle: 'Full Patch' },
  { kind: 'hero',     heroId: 'anvil',                  requiredLevel: 12, roleTitle: 'Full Patch' },
  { kind: 'building', buildingId: 'commercial-street',  requiredLevel: 16, roleTitle: 'Wrench' },
  { kind: 'building', buildingId: 'metalworking-plant', requiredLevel: 24, roleTitle: 'Bar Liaison' },
  { kind: 'hero',     heroId: 'skyline',                requiredLevel: 28, roleTitle: 'Bar Liaison' },
  { kind: 'building', buildingId: 'gas-station',        requiredLevel: 32, roleTitle: 'Road Captain' },
  { kind: 'building', buildingId: 'clubhouse',          requiredLevel: 40, roleTitle: 'V. PRESIDENT' },
]
```
> 建筑解锁等级与既有 `BUILDING_UNLOCKS` 完全一致（1/8/16/24/32/40）；`getBuildingUnlock`/`isBuildingUnlocked` 改为从统一数组按 `kind==='building'` 过滤派生，行为不变（帮派树 6 建筑里程碑与既有测试保持）。

### 8.2 英雄解锁为派生

```ts
function heroUnlockLevel(heroId: HeroId): number   // 从 PROGRESSION_UNLOCKS 查 kind==='hero'
function isHeroUnlocked(heroId: HeroId, gangLevel: number): boolean {
  const req = heroUnlockLevel(heroId)
  return normalizeGangLevel(gangLevel) >= req
}
```
- 解锁**不依赖一次性 UI 事件**：任何时刻由当前 `gangLevel` 直接判定。调试直升 50 → `anvil`/`skyline` 立即解锁（§4.3）。
- 帮派树 modal 渲染统一数组：同级多解锁在同一节点并列展示（如 Lv12 展示「英雄：岳峰·铁砧」，Lv1 展示「建筑：修车厂 / 功能：战役 / 功能：英雄 / 英雄：陈锤·工头」）。

---

## 9. 建筑进度：改为「当前主等级阶段进度」

### 9.1 目标语义

进度条只表达**当前主等级 M 这一阶段**的完成度，而非全部累计子等级：

- 主 Lv2、子 `[1, 0]`（刚从 Lv1 升上来）→ **初始 0%**；本阶段需 **3 次**必要子升级 → 逐次 **33% / 66% / 100%**。
- 修车厂 Lv5→6 阶段（无新槽，5 个子建筑均需 +1）→ 需 **5 次**，每次 **20%**。

### 9.2 可推导基线（不加存档字段）

子建筑 `i` 的解锁主等级 `childUnlockLevel(buildingId, i) = i + 1`（修车厂 `i∈0..4`→`1..5`；其余 `i∈0..9`→`1..10`）。

在当前主等级 `M`、已解锁子数 `U = getUnlockedChildCount(id, M)`，对每个已解锁子 `i (0 ≤ i < U)` 定义**基线**：
```
baseline(i, M) = (childUnlockLevel(id, i) === M) ? 0 : (M - 1)
```
含义：本级 M 才新解锁的那个子建筑基线为 0（从 0 开始建到 M）；更早解锁的子建筑在主升到 M 的瞬间必然已追平到 `M-1`（因为主升级前置条件就是全部已解锁子追平到 M-1），故基线为 `M-1`。此基线**完全由 `i` 与 `M` 推导**，无需存档新增字段。

### 9.3 精确公式

```
completedStageSteps = Σ_{i=0}^{U-1} clamp(childLevels[i] - baseline(i, M), 0, M - baseline(i, M))
totalStageSteps     = Σ_{i=0}^{U-1} (M - baseline(i, M))
ratio   = totalStageSteps <= 0 ? (allChildrenAtM ? 1 : 0) : completedStageSteps / totalStageSteps
percent = ratio * 100
complete = (completedStageSteps === totalStageSteps) && totalStageSteps > 0   // 等价于所有已解锁子 === M
```

`totalStageSteps` 展开式（便于校验）：
- 含新槽的阶段（存在 `i` 使 `childUnlockLevel===M`，即非修车厂全程、修车厂 M∈1..5）：`totalStageSteps = M + (U - 1) * 1`。
  - 非修车厂 M：`U = M`，`= M + (M-1) = 2M - 1`。M=2 → **3**（与 `[1,0]` 3 次一致）。
  - 修车厂 M∈1..5：`U = M`，同为 `2M - 1`。M=1 → 1；M=2 → 3。
- 无新槽的阶段（修车厂 M∈6..10）：所有 5 个子 baseline `= M-1`，`totalStageSteps = 5 * 1 = 5`。→ Lv5→6 **5 次、每次 20%**一致。

### 9.4 边界

- **主 Lv1**：`U=1`，唯一子 baseline 0，`totalStageSteps=1`；子 0→1 即 100%，随后可升主到 2。
- **主 Lv10（满级）**：公式照常给出阶段进度，可达 100%（全部子=10），但主升级决策返回 `building-maxed`，不提供主升级按钮。
- **锁定建筑**：`isBuildingUnlocked` 为假时不进入进度计算，展示解锁条件（沿用既有）。
- **非负与整数**：`clamp(..., 0, ...)` 保证 `completedStageSteps ∈ [0, totalStageSteps]`；`percent` 展示取整数，且**只有精确 100%（`complete`）才显示 `100%`**（沿用既有「非精确不显示 100%」规则）。

### 9.5 与 `getMainUpgradeDecision` 的关系 / 迁移兼容

- **主升级门槛判定不变**：新 `complete`（所有已解锁子 === M）与既有 `getBuildingUpgradeProgress().complete`（`Σ min(M, c[i]) === U*M`）**逻辑等价**（因 `c[i] ≤ M` 恒成立）。因此 `getMainUpgradeDecision` 的 `children-not-caught-up` 短路行为、八段阻止优先级、门槛（修车厂 Lv2–5 无外部 / Lv6–10 受 Clubhouse；其余 Lv2–5 受修车厂 / Lv6–10 受 Clubhouse；Clubhouse 仅自身）全部保持。
- **只改展示层**：把 `BuildingPanel` 进度条与百分比文案的数据源从旧 `getBuildingUpgradeProgress`（累计口径）换为新 `getBuildingStageProgress`（阶段口径），`role="progressbar"` 与整数百分比文案沿用。
- **迁移兼容**：不改变 `childLevels` 存储、不新增字段、persist 仍为 v3、无需 city 迁移；既有 v3 存档在新公式下渲染正确（阶段基线可从 `M` 与 `i` 推导）。旧的累计口径函数可保留供内部/测试对照，或改为委托新函数。

---

## 10. 四份 JSON 配置契约（严格 schema v1）

四份新增配置均带 schema `version: 1`，由**带校验的解析器**加载（模式参照现有 `economyConfig.ts`）：非法结构/缺字段/类型错误/越界/非严格递增等一律 `throw new Error('Invalid <name> config: <path>')`，在模块 import 期抛出——**配置错误直接阻止构建**（§13.3）。所有数值均给出确定的代表性建议值。

### 10.1 `src/config/heroes.config.json`

```jsonc
{
  "version": 1,
  // 升级经验：从 L 到 L+1 所需，L ∈ 1..49；公式 expToLevel(L) = 50 * (L + 1)
  "expToLevel": { "1": 100, "2": 150, "3": 200, /* … 公式物化到 … */ "49": 2500 },
  "heroes": {
    "foreman": {
      "name": "陈锤", "alias": "工头", "role": "back",
      "defaultSlot": { "row": "back", "index": 1 }, "unlockGangLevel": 1,
      "baseHp": 800, "baseAtk": 120, "baseDef": 40,
      "hpPerLevel": 60, "atkPerLevel": 10, "defPerLevel": 3,
      "skill": { "name": "散射压制", "targetMultiplier": 2.5, "splashMultiplier": 0.8,
                 "initialCooldownTicks": 30, "cooldownTicks": 90 },
      "appearance": { "primaryColor": "#e8b83a", "accentColor": "#3a3a3a",
                      "silhouette": "capsule", "weapon": "shotgun" }
    },
    "anvil": {
      "name": "岳峰", "alias": "铁砧", "role": "front",
      "defaultSlot": { "row": "front", "index": 0 }, "unlockGangLevel": 12,
      "baseHp": 1500, "baseAtk": 80, "baseDef": 90,
      "hpPerLevel": 110, "atkPerLevel": 6, "defPerLevel": 7,
      "skill": { "name": "钢盾镇场", "targetMultiplier": 1.8, "splashMultiplier": 0.5,
                 "initialCooldownTicks": 40, "cooldownTicks": 100 },
      "appearance": { "primaryColor": "#5a5f66", "accentColor": "#ff7a1a",
                      "silhouette": "bulk", "weapon": "axe-shield" }
    },
    "skyline": {
      "name": "秦岚", "alias": "长空", "role": "back",
      "defaultSlot": { "row": "back", "index": 0 }, "unlockGangLevel": 28,
      "baseHp": 650, "baseAtk": 160, "baseDef": 30,
      "hpPerLevel": 45, "atkPerLevel": 14, "defPerLevel": 2,
      "skill": { "name": "长空穿击", "targetMultiplier": 3.2, "splashMultiplier": 0.4,
                 "initialCooldownTicks": 35, "cooldownTicks": 80 },
      "appearance": { "primaryColor": "#22405f", "accentColor": "#3fd0d0",
                      "silhouette": "slim", "weapon": "rifle" }
    }
  }
}
```
校验：`role∈{front,back}`；`unlockGangLevel` 与 `PROGRESSION_UNLOCKS` 一致；`base*/perLevel` 非负安全整数；`*Multiplier > 0`；`*CooldownTicks` 为正整数；`expToLevel` 覆盖键 `"1".."49"`、值为正整数；`heroId` 集合与 `HeroId` 类型完全一致。

### 10.2 `src/config/campaign.config.json`

```jsonc
{
  "version": 1, "chapters": 2, "stagesPerChapter": 10,
  "stages": [
    { "id": "1-1", "global": 1, "enemyCount": 1,
      "enemy": { "level": 1, "hp": 400, "atk": 70,  "def": 15 },
      "firstClearReward": { "sharedExp": 500 } },
    { "id": "1-2", "global": 2, "enemyCount": 1,
      "enemy": { "level": 1, "hp": 480, "atk": 82,  "def": 19 },
      "firstClearReward": { "sharedExp": 1000 } },
    { "id": "1-3", "global": 3, "enemyCount": 1,
      "enemy": { "level": 2, "hp": 560, "atk": 94,  "def": 23 },
      "firstClearReward": { "sharedExp": 1500 } },
    // … global 4..20 由公式物化（§3.3）：
    //   enemy.level = 1 + floor((g-1)/2)
    //   enemy.hp    = 400 + 80*(g-1)
    //   enemy.atk   = 70  + 12*(g-1)
    //   enemy.def   = 15  + 4*(g-1)
    //   enemyCount  = §3.2 映射
    //   firstClearReward.sharedExp = 500 * g
    { "id": "2-10", "global": 20, "enemyCount": 5,
      "enemy": { "level": 10, "hp": 1920, "atk": 298, "def": 91 },
      "firstClearReward": { "sharedExp": 10000 } }
  ]
}
```
校验：`stages` 恰 20 项，`global` 为 1..20 无重复、递增；`id` 与 `chapter/stageInChapter` 一致；`enemyCount` 等于 `getEnemyCount(global)`；`enemy.*` 非负安全整数；`firstClearReward.sharedExp ≥ 0` 安全整数。同一关的 `enemyCount` 名敌人复用同一 `enemy` 定义，按 §11.1 铺位。

### 10.3 `src/config/combat.config.json`

```jsonc
{
  "version": 1,
  "tickMs": 100,
  "maxBattleTicks": 600,
  "attackIntervalTicks": 8,
  "defenseConstant": 100,
  "positionModifiers": {
    "front": { "atkMul": 1.0,  "defMul": 1.25, "aggro": true  },
    "back":  { "atkMul": 1.15, "defMul": 0.9,  "aggro": false }
  },
  "powerWeights": { "hp": 0.5, "atk": 2.0, "def": 1.5 },
  "skillDefaults": { "targetMultiplier": 2.0, "splashMultiplier": 0.5,
                     "initialCooldownTicks": 30, "cooldownTicks": 90 },
  "enemySkillCooldownTicks": 120
}
```
校验：`tickMs===100`；`maxBattleTicks===600`；`attackIntervalTicks` 正整数；`defenseConstant > 0`；`positionModifiers.front/back` 完整、`*Mul > 0`、`aggro` 布尔；`powerWeights.*` 非负有限数；技能默认合法。

### 10.4 `src/config/idle-experience.config.json`

```jsonc
{
  "version": 1,
  "tickSeconds": 10,
  "maxOfflineSeconds": 28800,
  // ratePerTick(g) = 2 * g，g ∈ 1..20；g=0 未开启（不产出）
  "ratePerTickByHighestStage": { "1": 2, "2": 4, "3": 6, /* … */ "20": 40 }
}
```
校验：`tickSeconds===10`；`maxOfflineSeconds===28800`；键覆盖 `"1".."20"`、值为正整数；解析器提供 `ratePerTick(g)`（`g<1` 返回 0）。

---

## 11. 战斗规则（确定性引擎细节）

### 11.1 阵位映射（我方/敌方）

- 我方按 `formation` 的 `globalIndex`（§4.1）排布：`front[0..1]` 承伤在前，`back[0..2]` 在后。
- 敌方按 `enemyCount` 依次铺位：先 `front[0], front[1]`，再 `back[0], back[1], back[2]`（即 count=1 只占 `front[0]`；count=5 占满）。敌人共享 `campaign` 的 `enemy` 定义与关卡等级。

### 11.2 战力（展示 / 建议公式）

单位在等级 L、阵位 P（front/back）的**阵位修正后属性**：
```
effAtk = round(ATK(L) * positionModifiers[P].atkMul)
effDef = round(DEF(L) * positionModifiers[P].defMul)
effHp  = HP(L)                       // 本版 HP 不受阵位修正
```
单位战力：
```
power(unit) = round(effHp * powerWeights.hp + effAtk * powerWeights.atk + effDef * powerWeights.def)
```
队伍总战力：`teamPower = Σ power(unit)`（安全整数、饱和）。编队页与对阵条同时显示**双方阵位修正后总战力**（如「13.2k vs 8,100」的表达）。

> **战力仅供展示与建议**（与既有 `buildingPower` 仅展示的哲学一致）：胜负由 §11.3–11.6 的实际战斗模拟决定，不由战力大小直接判定。配置数值调校使战力与胜率正相关，但引擎不读战力。

### 11.3 伤害公式（整数、确定性）

```
mitigation = defenseConstant / (defenseConstant + effDef_defender)   // ∈ (0,1]
普攻伤害   = max(1, floor(effAtk_attacker * mitigation))
技能主目标 = max(1, floor(effAtk_attacker * skill.targetMultiplier * mitigation))
技能溅射   = max(1, floor(effAtk_attacker * skill.splashMultiplier * mitigation))   // 对主目标外每个存活敌方
```
所有伤害为正整数，至少为 1（破防下限），避免 0 伤害僵局。

### 11.4 目标选择（确定性，无随机）

对攻击方 A 选目标（在敌对阵营存活单位中）：
1. **优先前排承伤**：若敌对阵营存在存活的 `front` 单位，则目标集合 = 存活 front；否则 = 存活 back（前排全灭才可锁后排）。
2. 在目标集合内按 `globalIndex` **升序**取第一个。
3. 无存活敌对单位 → 该阵营已全灭（触发胜负判定）。

技能主目标同上；技能溅射作用于**所有其它存活敌方**（不受前后排限制，对应参考视频的多段齐射）。

### 11.5 能量 / 技能（全自动冷却模型）

- 采用**全自动冷却模型**（参考视频头像显示整数秒倒数，但本项目按用户确认改为全自动）：
  - 战斗开始，每个单位技能冷却 = `skill.initialCooldownTicks`。
  - 每 tick 冷却 -1，到 0 即**就绪**。
  - 就绪后：该单位在其下一个行动 tick 自动释放；敌我规则一致。
  - 释放后冷却重置为 `skill.cooldownTicks`（敌方用 `enemySkillCooldownTicks`）。
- 头像 UI：其下条形表示冷却填充进度（`1 - remaining/total`），就绪时镀金高亮；未就绪显示剩余整数秒 `ceil(remainingTicks / 10)`。头像为只读状态，不具备按钮语义。

### 11.6 行动顺序 / tick 结算（确定性）

每个逻辑 tick 按固定顺序结算，保证可重放：
1. 递减所有存活单位技能冷却。
2. 标记本 tick 到达行动相位且技能冷却为 0 的单位自动释放技能。
3. 单位相位定义为 `ally: globalIndex % attackIntervalTicks`、`enemy: (5 + globalIndex) % attackIntervalTicks`。按阵营固定顺序（先我方 `globalIndex` 升序、后敌方），对满足 `tickIndex % attackIntervalTicks === phase` 的单位结算行动：冷却为 0 时技能优先，否则普攻；应用 §11.3 伤害、§11.4 目标。
4. 结算死亡：HP ≤ 0 的单位标记死亡并移出目标池（死亡在本 tick 末统一生效，避免顺序偏置）。
5. 记录本 tick 快照进 `timeline`（各单位位置/HP/能量、命中/伤害事件、死亡事件）。
6. **胜负判定**：
   - 敌方全灭且我方有存活 → `victory`。
   - 我方全灭 → `defeat`。
   - `tickIndex ≥ maxBattleTicks` 仍未分 → `defeat`（60 秒超时失败）。

`走位`为视觉插值：单位向当前目标靠近到攻击射程（`timeline` 记录逻辑位置，`BattleUnit` 平滑插值），不影响命中（命中由目标选择决定，射程仅用于表现与到位判定）。

### 11.7 引擎接口

```ts
interface BattleUnitInput { side: 'ally' | 'enemy'; heroId?: HeroId; level: number;
  row: Row; index: number; hp: number; atk: number; def: number; skill: SkillConfig }
interface BattleInput { stage: number; allies: BattleUnitInput[]; enemies: BattleUnitInput[]; seed: string }
interface BattleResult { outcome: 'victory' | 'defeat'; endedAtTick: number;
  reason: 'enemies-cleared' | 'allies-defeated' | 'timeout';
  timeline: TickSnapshot[]; alliesSurvived: number }
function simulateBattle(input: BattleInput): BattleResult   // 纯函数
function buildBattleInput(stage: number, formation: FormationAssignment,
  heroLevels: Record<HeroId, number>, gangLevel: number): BattleInput
```

---

## 12. 模块 / 接口 / 数据模型总览（待实现文件清单）

新增（描述性规格，非本次创建）：

- `src/game/heroes.ts`：`HeroId`、`Row`、`isHeroUnlocked`、`heroUnlockLevel`、`getHeroStats(id, L)`、`getHeroLevelCap(gangLevel)`。
- `src/config/heroesConfig.ts` + `heroes.config.json`（§10.1）。
- `src/config/campaignConfig.ts` + `campaign.config.json`（§10.2）；`getStage(g)`、`getEnemyCount(g)`、`getFirstClearReward(g)`、`isStageUnlocked(g, highest)`。
- `src/config/combatConfig.ts` + `combat.config.json`（§10.3）。
- `src/config/idleExperienceConfig.ts` + `idle-experience.config.json`（§10.4）；`ratePerTick(g)`、`settleIdleExperience(...)`。
- `src/game/combat/{battleEngine,targeting,damage,power}.ts`（§11）。
- `src/game/progressionUnlocks.ts`：`PROGRESSION_UNLOCKS`、派生 `getBuildingUnlock`/`isBuildingUnlocked`/`isHeroUnlocked`/`isFeatureUnlocked`（§8）。
- `src/game/buildingUpgrade.ts`（既有）新增 `getBuildingStageProgress`（§9），保留 `getMainUpgradeDecision` 语义。
- `src/store/useAdventureStore.ts` + `src/store/adventureMigration.ts`（§7）。
- `src/game/resetAccount.ts`（既有，扩展为三 store，§7.5）。
- `src/scene/battle/{BattleScene,BattleUnit,DamageNumbers,BattleEnvironment}.tsx`（§2.2、§15）。
- `src/ui/{GlobalHud,AdventurePanel,FormationPanel,BattleHud,HeroesPanel}.tsx`；`App.tsx` 重构为单 `activeOverlay`（§6.4）。
- `src/game/AdventureIdleClock.tsx`：轻量控制器，仅按秒触发宝箱展示刷新（不写状态，写入只发生在领取时）。

复用/不改：`useCityStore`（persist v3）、`economy.config.json`（v2）、`useGangStore`、`GangIdleController`、`EconomyIdleController`、`usePrefersReducedMotion`、`createSafeStorage`、`AppErrorBoundary`。

---

## 13. 健壮性：错误边界 / 安全整数 / 坏存档 / 配置校验

### 13.1 错误边界
- `BattleScene` 外层包 `AppErrorBoundary`（或战斗专用边界）；引擎抛错（非法 `BattleInput`）时降级为「战斗初始化失败」提示并允许退出回地图，不崩溃整站。

### 13.2 安全整数
- 所有经验/伤害/战力/HP 用整数运算与 `Number.isSafeInteger` 校验；`sharedExp` 增用饱和加法（上限 `MAX_SAFE_INTEGER`）、减法前校验 `≥ cost`；伤害恒 `≥ 1`。

### 13.3 配置错误阻止构建
- 四份配置解析器在 import 期严格校验并抛错；任一非法 → `tsc`/`vite build`/测试阶段即失败（与既有 `economyConfig` 一致），杜绝坏配置进入产物。

### 13.4 坏存档规范化
- Adventure store `merge/migrate` 走 §7.6 规范化：越界等级夹紧、非法英雄/阵位丢弃、`sharedExp/highestClearedStage/idleClock` 夹紧或回退；`persisted==null` 保留初始态。
- 运行期 `heroLevel` 展示/可用性再按 `min(50, gangLevel)` 与 `isHeroUnlocked` 二次约束（存档里即使残留高于封顶的等级，也不越权升级/上阵）。

### 13.5 确定性保证
- 引擎与所有纯规则**禁用 `Math.random` / `Date.now()`**（时间由调用方注入）；并列一律 `globalIndex` 升序打破；死亡本 tick 末统一生效。

---

## 14. UI 状态机与原子顺序

### 14.1 全局 overlay（§6.4）
`activeOverlay` 单实例；全屏玩法关闭建筑详情；挂机不受 overlay 影响。

### 14.2 战役 session 生命周期
```
adventure(选关) --挑战--> formation(编队) --Start--> battle.running
battle.running <--暂停/继续--> battle.paused
battle.running --(1x/2x)--> 调整每帧消费 tick 数
battle.running --引擎判定--> battle.resolved(victory|defeat)
battle.resolved(victory & 新最高) --原子事务(§7.4)--> 结算页 --Next/空白--> adventure
battle.resolved(defeat 或 重打) --> 结算页(无首通奖励) --> adventure
任意 battle.* --退出(二次确认)--> adventure(丢弃 session、无奖励、无进度变更)
```

### 14.3 原子顺序（关键）
- **进入战斗**：构建 `BattleInput`（读当前 `formation/heroLevels/gangLevel`）→ `simulateBattle` 得 `BattleResult` → 挂载场景按 `timeline` 回放。构建时校验：阵容非空、所有上阵英雄已解锁、等级 ≤ `min(50,gangLevel)`；不满足则不进入并提示。
- **胜利结算**：回放到 `resolved` 后，若新最高 → §7.4 单事务发奖 + 涨最高（+ 可能初始化挂机时钟）；然后展示结算页。**先事务、后展示**，保证展示的数值即已入账数值。
- **领取宝箱 / 升级英雄**：§7.4 单事务；升级英雄先判 cap 再判经验再写。
- **退出战斗**：仅卸载视图与瞬态 session，不触发任何持久写入。

---

## 15. 动画与 reduced motion

- 战斗可视化（程序化）：单位靠近走位（位置插值）、普攻枪口闪光、技能金色多段齐射、命中飘整数伤害数字、死亡倒地（简单下沉/翻倒）、`START` 开场字幕、`VICTORY/DEFEAT` 结算演出。子建筑/城市动画沿用既有 400ms 绿色入场规则，不受本次影响。
- `prefers-reduced-motion`（复用 `usePrefersReducedMotion`）：跳过/缩短所有 tween 与镜头强调，`START`/结算即时切换、无齐射拖尾、伤害数字瞬显瞬隐；**引擎结果不变**（reduced motion 只改表现，`timeline` 仍逐 tick 应用，可用「一次性跳到终局」快进）。
- 倍速与 reduced motion 正交：两者都只影响表现层与消费 tick 的节奏，不影响 `BattleResult`。

---

## 16. 可访问性

- HUD/overlay：语义化 `section`/`h1`/`button`；帮派入口、底部导航、资源条均有 `aria-label`；红点用 `aria-label` 附加（如「有可升级英雄」）。
- 进度/血条/能量条：`role="progressbar"` + `aria-valuenow/min/max` + 整数文案；战力用可读文本（`13.2k` 同时提供完整整数 `aria-label`）。
- Toast：`role="status"` / `aria-live="polite"`（「已领取 N 经验」「英雄等级不能超过帮派等级」等）。
- 键盘：`Escape` 关闭 overlay / 触发退出确认；导航与按钮可 Tab 聚焦；战斗控件（暂停/倍速/退出）可键盘触发。英雄头像为只读状态，读出生命与技能冷却。
- 焦点管理：overlay 打开时焦点移入、关闭后返回触发元素。
- 移动 390×844：所有面板不横向溢出、可纵向滚动；触摸拖拽编队与点击技能有足够热区。

---

## 17. 测试矩阵

- **纯规则（Vitest）**：
  - 引擎确定性：同 `BattleInput` 多次 `simulateBattle` 结果与 `timeline` 完全一致。
  - 伤害/破防下限/减伤公式；目标选择（前排优先、全灭转后排、`globalIndex` 并列）；技能冷却/就绪/释放/溅射；超时失败；胜利/失败判定。
  - 战力公式（阵位修正、权重、安全整数）；`getEnemyCount` 全 20 关映射；`enemyLevel/hp/atk/def` 公式与配置一致。
  - 建筑阶段进度 `getBuildingStageProgress`：Lv1（1 步）、Lv2 `[1,0]`（0→33→66→100）、修车厂 Lv5→6（5 步各 20%）、满级、边界与 `complete` 等价性。
  - 挂机结算：整 tick、余量保留、8h cap、时钟倒退 no-op、未开启不产出。
  - 英雄等级封顶 `min(50, gangLevel)`；`ProgressionUnlock` 派生（建筑/英雄/feature、调试直升 50 派生解锁）。
- **Store**：Adventure persist/migrate/merge（`persisted==null` 保初始、坏存档规范化）；首通单事务（涨最高与发经验同事务）；领取宝箱（结算+入池+余量）；升级英雄（cap/经验/原子）；`resetAccount` 协调三 store 且幂等。
- **UI（RTL）**：GlobalHud 渲染四资源 + 帮派入口（等级/职位）+ 红点各条件；单 `activeOverlay` 互斥与「全屏玩法关闭建筑详情」；底部导航切换；FormationPanel 拖拽部署/去重/总战力刷新；BattleHud 暂停/1x/2x/退出确认、只读英雄头像与自动技能冷却；390×844 无横向溢出可滚动；`Escape` 行为。
- **R3F（组件级）**：BattleScene 按 `timeline` 挂载与卸载、单位/伤害数字渲染；reduced motion 分支；不泄漏事件到城市场景。
- **真实浏览器 CDP（本地 + 公开 Pages）**：安全模式脚本（动态空闲端口、`--strictPort`、仅杀自建 PID、临时 profile 前缀校验+清理、结果脱敏、失败非零退出），真机覆盖：fresh 存档 → 通关 1-1（观察 START/普攻/技能/VICTORY）→ 首通经验入池 → 领取挂机宝箱 → 培养页升级本体 → 调试帮派直升 50 → 校验 anvil/skyline 派生解锁并可编入阵位 → 单 overlay 互斥 → 建筑阶段进度百分比。本地与公开各跑一遍并留非空截图。
- **发布纪律**：分段提交、普通 push、`gh-pages` 快进并核对 Pages build 状态与公开 JS/CSS HTTP 200；**严禁提交未跟踪的 `example/5v5example.mp4` 及抽帧 `.superpowers/sdd/5v5-0.5s-analysis/*`**（沿用参考视频独立/隔离处理惯例）。四份新配置随功能提交；README/session 变更总账更新。

---

## 18. 发布流程

1. 本地门禁全绿：`npm run format:check` / `typecheck` / `lint` / `test` / `build`；`dist` 资源以 `/DobeDemo/` 开头。
2. 本地 + 公开 CDP 安全验收通过并留证据。
3. 分段提交（引擎 / 配置 / store / UI / 场景 / 测试 / 文档分开），普通 push 到 `main`。
4. fresh `dist` 发布到 `gh-pages`（独立临时 index 快进），核对 Pages build 精确匹配且状态 `built`，公开 HTML 与当前 JS/CSS HTTP 200。
5. 抽帧与参考视频不入常规提交；如需保留参考视频，沿用既有「独立隔离提交」惯例，不混入功能提交。

---

## 19. 非目标

- 不做升星、装备、突破、抽卡、PVP、服务器校验、云存档、扫荡、体力、付费次数。
- 不直接复制 Whiteout Survival（或参考视频所属游戏）的美术资产、角色、文案、稀有度体系与道具结构；英雄命名与外观均原创、程序化几何。
- 本次不实现「配置 EXE」；四份新配置仅冻结/新增其 JSON 契约与校验器。
- 战斗为本地确定性模拟，无联机、无真实物理引擎；3D 均为程序化基础几何体。
