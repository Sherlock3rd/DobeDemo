# Campaign · Heroes · Global HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在既有工业城 Demo 上新增一条完整的确定性关卡战役闭环（2 章 20 关纯函数固定步长战斗、五阵位三英雄养成、挂机经验、统一帮派树解锁、全局单 overlay HUD 与独立 R3F 战斗场景），并安全迁移现有 App/建筑进度语义，不破坏 city/gang 既有存档。

**Architecture:** 纯规则与配置在 `src/config`/`src/game` 中以带校验解析器与无副作用函数实现（禁用 `Math.random`/`Date.now`）；战斗结果由 `simulateBattle` 一次性预计算为 `timeline`，R3F 场景只回放不反算；持久数据分三个 Zustand `persist` store（city v3、gang、新增 adventure v1），跨 store 关系由 `resetAccount` 与 `reconcileAdventureWithGang` 幂等协调；前 5 个任务只新增 standalone 组件与纯逻辑（不改 `App.tsx`），第 6 个任务一次性完成 `App.tsx` 单 `activeOverlay` 接线与建筑进度展示切换。

**Tech Stack:** React 19、TypeScript 6、Zustand 5 persist、Three.js/R3F（@react-three/fiber 9、@react-three/drei 10）、Vitest 4、Testing Library、Vite 8、Chrome CDP、GitHub Pages。

## Global Constraints

- 计划日期固定为 `2026-07-24`。
- 引擎与所有纯规则禁用 `Math.random` 与 `Date.now()`（时间一律由调用方注入）；并列一律用 `globalIndex` 升序打破，无随机；死亡在本 tick 末统一生效。
- 战斗为确定性固定步长：`tickMs = 100`（每秒 10 tick）；`maxBattleTicks = 600`（60 秒）；超时未分胜负判 `defeat`；相同 `BattleInput` 多次 `simulateBattle` 必产生完全一致的 `timeline` 与结果。
- 敌人数量映射：`1≤g≤3→1`、`4≤g≤7→2`、`8≤g≤11→3`、`12≤g≤15→4`、`16≤g≤20→5`，其它 `g` 抛错。
- 敌人递增公式（物化进 `campaign.config.json`）：`enemyLevel(g)=1+floor((g-1)/2)`、`enemyBaseHp(g)=400+80*(g-1)`、`enemyBaseAtk(g)=70+12*(g-1)`、`enemyBaseDef(g)=15+4*(g-1)`、`firstClearReward.sharedExp=500*g`。
- 全局序号换算：`g=(chapter-1)*10+stageInChapter`，`chapter∈{1,2}`，`stageInChapter∈[1,10]`；`id=${chapter}-${stageInChapter}`。
- 阵位共 5 槽：`front[0],front[1],back[0],back[1],back[2]`，`globalIndex`：`front[0]=0,front[1]=1,back[0]=2,back[1]=3,back[2]=4`；一名英雄至多一槽、一槽至多一名英雄，`assignment` 长度 ∈ [1,5]，去重校验。
- 英雄等级 `heroLevel∈[1,50]` 且不得超过 `heroLevelCap=min(50,gangLevel)`；升级只消耗 `sharedExp`，`expToLevel(L)=50*(L+1)`（L∈1..49）。
- 单位属性：`HP(L)=baseHp+hpPerLevel*(L-1)`、`ATK(L)=baseAtk+atkPerLevel*(L-1)`、`DEF(L)=baseDef+defPerLevel*(L-1)`，全部为非负安全整数。
- 阵位修正后属性：`effAtk=round(ATK*atkMul)`、`effDef=round(DEF*defMul)`、`effHp=HP`（HP 不受阵位修正）；`power(unit)=round(effHp*hp权重+effAtk*atk权重+effDef*def权重)`；战力仅供展示与建议，引擎不读战力。
- 伤害整数确定性：`mitigation=defenseConstant/(defenseConstant+effDef)`；`普攻=max(1,floor(effAtk*mitigation))`；`技能主目标=max(1,floor(effAtk*targetMultiplier*mitigation))`；`技能溅射=max(1,floor(effAtk*splashMultiplier*mitigation))`；所有伤害恒 `≥1`。
- 目标选择：敌对阵营存活 `front` 非空则目标集合=存活 front，否则=存活 back；集合内按 `globalIndex` 升序取第一个；技能溅射作用于所有其它存活敌方（不受前后排限制）。
- 技能全自动冷却模型：开局冷却=`initialCooldownTicks`；每 tick -1，到 0 就绪；就绪后在该单位下一个行动 tick 自动释放；释放后重置为 `cooldownTicks`（敌方用 `enemySkillCooldownTicks`）。**不得出现手动施法、点击施法或 Auto 手动开关**；英雄头像为只读状态，仅展示生命与技能冷却。
- 行动相位：`ally: globalIndex % attackIntervalTicks`、`enemy: (5+globalIndex) % attackIntervalTicks`；每 tick 顺序：递减冷却 → 标记就绪 → 先我方 `globalIndex` 升序后敌方结算行动（冷却为 0 时技能优先否则普攻）→ 本 tick 末统一结算死亡 → 记录快照 → 胜负判定。
- 挂机：`idleUnlocked = highestClearedStage ≥ 1`；`ratePerTick(g)=2*g`（g<1 返回 0）；tick=10 秒；离线上限 28800 秒；不足一 tick 余量保留；时钟倒退/非法 no-op；`settleIdleExperience` 与既有 `calculateIdleSettlement`/`settleResourceProduction` 同构。
- 四份新配置均带 schema `version:1`，由带校验解析器在 import 期严格校验，任一非法结构/缺字段/类型错误/越界/非严格递增一律 `throw new Error('Invalid <name> config: <path>')`，阻止 `tsc`/`vite build`/测试。
- 统一 `PROGRESSION_UNLOCKS` 承载 `building`/`hero`/`feature` 三类解锁，允许同级多解锁；建筑解锁等级保持 `repair-shop 1 / recycling-yard 8 / commercial-street 16 / metalworking-plant 24 / gas-station 32 / clubhouse 40`；英雄解锁为派生：`foreman 1 / anvil 12 / skyline 28`；feature：`adventure 1 / heroes 1`。英雄解锁由当前 `gangLevel` 直接派生，不依赖一次性 UI 事件；调试直升 50 立即派生解锁 `anvil`/`skyline`，无额外英雄调试按钮。
- 建筑进度改为「当前主等级阶段进度」：`baseline(i,M)=(childUnlockLevel(id,i)===M)?0:(M-1)`；`completedStageSteps=Σ clamp(childLevels[i]-baseline,0,M-baseline)`；`totalStageSteps=Σ (M-baseline)`；`complete=(completedStageSteps===totalStageSteps)&&totalStageSteps>0`，与既有 `getBuildingUpgradeProgress().complete` 逻辑等价；不新增存档字段、不改 `childLevels` 存储、persist 仍为 v3；只有精确 100% 才显示 `100%`。
- Adventure 存档键 `dobe-adventure-progression-v1`，persist version=1，`storage` 复用 `createSafeStorage()`；`partialize` 仅 `heroLevels/sharedExp/formation/highestClearedStage/idleClock`；战斗 session、首通集合、挂机宝箱均不单独持久。
- 首版三英雄命名/外观原创、程序化几何，不复制参考游戏美术/角色/文案/稀有度/道具（无 `SR`/`CYCLOPS`/`Enforcer` 等资产文案）；四类奖励简化为共享英雄经验为主，不引入抽卡碎片/技能书/体力/扫荡/付费次数/云存档/PVP/服务器校验。
- 单 `activeOverlay` 状态机：同一时刻至多一个 overlay；打开全屏玩法（`adventure`/`formation`/`heroes`/`battle`）关闭建筑详情（清空 `selectedBuildingId`）；`formation` 只能从 `adventure` 发起，`battle` 只能从 `formation` 发起，取消编队或退出/结算回 `adventure`；`GangIdleController`/`EconomyIdleController`/`AdventureIdleClock` 不因 overlay 暂停；`Escape` 关闭非 `none` overlay，`battle` 的 Escape 等价退出并需二次确认。
- 原子事务：领取宝箱（结算→`sharedExp+=earned`→`idleClock=next`）、升级英雄（判 cap→判经验→扣→`heroLevels[id]+1`）、胜利首通（同一 `set` 内 `highestClearedStage=g` 与 `sharedExp+=firstClearReward(g)`，首次开挂机则一并初始化 `idleClock`）均在单个 `set` 内先结算后判定再写入；任一门槛不满足整体不写。胜利播放到 `resolved` 才提交首通；退出战斗不触发任何持久写入、无奖励、无进度变更。
- `resetAccount(now)` 协调三 store（city+gang+adventure），三者幂等且互不依赖顺序；`reconcileAdventureWithGang(gangLevel)` 仅在 Adventure 与 Gang 两个 persist 均完成 hydrate 后及后续帮派等级变化时幂等执行（禁止用 Gang 未 hydrate 的默认 Lv1 提前夹低合法等级）：`heroLevels` 夹到 `1..min(50,gangLevel)`、移除未解锁英雄、阵容空则回退 `[{ foreman, back, 1 }]`。
- 坏存档规范化（Adventure）：`persisted==null` 返回初始态（保留初始 `sharedExp/formation`）；`heroLevels` 每个已知 `HeroId` 夹 `[1,50]`、未知丢弃、缺失补 1；`sharedExp` 夹 `[0,MAX_SAFE_INTEGER]`；`formation` 过滤非法/去重/截 ≤5/越界丢弃/空回退；`highestClearedStage` 夹 `[0,20]`；`idleClock` `finite? value : now`。
- 所有经验/伤害/战力/HP 用整数运算与 `Number.isSafeInteger` 校验；`sharedExp` 增用饱和加法（上限 `Number.MAX_SAFE_INTEGER`），减前校验 `≥cost`。
- 可视化：走位插值、普攻枪火、技能金色齐射、伤害飘整数、死亡倒地、`START`/`VICTORY`/`DEFEAT` 演出；`prefers-reduced-motion`（复用 `usePrefersReducedMotion`）只改表现（即时切换、无拖尾、可一次性跳到终局），不改 `BattleResult`；倍速（1x/2x）与 reduced motion 正交，只影响每渲染帧消费 tick 数，不改结果。
- 移动优先基准视口 390×844；HUD/overlay 语义化、`aria-label`、`role="progressbar"`/`role="status"`/`aria-live="polite"`、可键盘 Tab/Escape、焦点管理、无横向溢出可纵向滚动、触摸热区充足。
- 城市存档 `dobe-city-progression-v1`（persist v3）与 `economy.config.json`（schema v2）保持不变；帮派声望存档 `gang-progression-v1` 保持；仅将建筑解锁映射迁移进统一 `PROGRESSION_UNLOCKS`（派生 `getBuildingUnlock`/`isBuildingUnlocked` 行为不变，`BUILDING_UNLOCKS` 仍导出同形状同顺序）。
- 不新增第三方依赖；四份新配置随功能提交。
- 参考视频 `example/5v5example.mp4` 与抽帧 `.superpowers/sdd/5v5-0.5s-analysis/*` 仅供参考，**严禁纳入任何提交**；`.superpowers/sdd/.gitignore` 为 `*`，PNG 证据保持本地不入库；当前工作区文件模式噪声必须精确 `git add` 指定路径，绝不 `git add -A` 混入未跟踪视频/抽帧/dist/临时 profile。
- 所有 Node/npm 验证命令在 Windows 使用 `npm.cmd`；每个任务结束必须运行全量 `npm.cmd test` 与 `npm.cmd run typecheck`（并保持 `lint`/`format:check` 绿），每个中间提交都可 typecheck+全量 test 通过、可运行。
- 每个任务形成独立可审查提交；禁止 force push；最终仅普通 push `main`，`gh-pages` 由 fresh `dist`（资源以 `/DobeDemo/` 开头）通过独立临时 index 快进更新，不把 `dist`/临时 Chrome/CDP/PNG 提交到 `main`。

---

## File Map and Intermediate-Commit Strategy

最终会新增：

- 配置：`src/config/heroes.config.json`、`src/config/heroesConfig.ts`(+`.test.ts`)、`src/config/campaign.config.json`、`src/config/campaignConfig.ts`(+`.test.ts`)、`src/config/combat.config.json`、`src/config/combatConfig.ts`(+`.test.ts`)、`src/config/idle-experience.config.json`、`src/config/idleExperienceConfig.ts`(+`.test.ts`)。
- 领域：`src/game/progressionUnlocks.ts`(+`.test.ts`)、`src/game/heroes.ts`(+`.test.ts`)、`src/game/combat/power.ts`(+`.test.ts`)、`src/game/combat/damage.ts`(+`.test.ts`)、`src/game/combat/targeting.ts`(+`.test.ts`)、`src/game/combat/battleEngine.ts`(+`.test.ts`)、`src/game/AdventureIdleClock.tsx`(+`.test.tsx`)。
- Store：`src/store/adventureMigration.ts`(+`.test.ts`)、`src/store/useAdventureStore.ts`(+`.test.ts`)。
- UI：`src/ui/GlobalHud.tsx`(+`.test.tsx`)、`src/ui/HeroesPanel.tsx`(+`.test.tsx`)、`src/ui/AdventurePanel.tsx`(+`.test.tsx`)、`src/ui/FormationPanel.tsx`(+`.test.tsx`)、`src/ui/BattleHud.tsx`(+`.test.tsx`)、`src/ui/BattleScreen.tsx`(+`.test.tsx`)。
- 场景：`src/scene/battle/BattleScene.tsx`(+`.test.tsx`)、`src/scene/battle/BattleUnit.tsx`(+`.test.tsx`)、`src/scene/battle/DamageNumbers.tsx`(+`.test.tsx`)、`src/scene/battle/BattleEnvironment.tsx`(+`.test.tsx`)。
- CDP/文档证据：`.superpowers/sdd/campaign-heroes-global-hud-cdp.mjs`、`.superpowers/sdd/campaign-heroes-global-hud-results.json`、`.superpowers/sdd/campaign-heroes-global-hud-report.md`、`.superpowers/sdd/campaign-heroes-global-hud-public-cdp.mjs`、`.superpowers/sdd/campaign-heroes-global-hud-public-results.json`。

最终会修改：

- `src/game/gangProgression.ts`(+`.test.ts`)：`BUILDING_UNLOCKS`/`getBuildingUnlock`/`isBuildingUnlocked` 改为从 `progressionUnlocks.ts` 派生并 re-export；导出 `normalizeGangLevel`。
- `src/game/buildingUpgrade.ts`(+`.test.ts`)：新增 `getBuildingStageProgress`（§9），保留 `getMainUpgradeDecision` 语义与既有 `getBuildingUpgradeProgress`。
- `src/game/resetAccount.ts`(+`.test.ts`)：扩展为协调三个 store。
- `src/ui/GangTreePanel.tsx`(+`.test.tsx`)：渲染统一 `PROGRESSION_UNLOCKS`（同级多解锁并列）。
- `src/ui/BuildingPanel.tsx`(+`.test.tsx`)：进度条数据源换为 `getBuildingStageProgress`（仅展示层，Task 6）。
- `src/App.tsx`(+`.test.tsx`)、`src/App.css`：单 `activeOverlay` 状态机接线（Task 6）。
- `README.md`、`session/session.md`：登记新玩法、存档、调试、验收证据（Task 7）。

复用/不改：`useCityStore`（persist v3）、`economy.config.json`（v2）、`useGangStore`、`GangIdleController`、`EconomyIdleController`、`usePrefersReducedMotion`、`createSafeStorage`、`AppErrorBoundary`、`resourceEconomy`。

中间提交不断裂策略：

1. **Task 1** 引入统一 `PROGRESSION_UNLOCKS` 时，`gangProgression.ts` 把 `BUILDING_UNLOCKS`/`getBuildingUnlock`/`isBuildingUnlocked` 改为从 `progressionUnlocks.ts` 派生并 re-export（形状/顺序不变）。所有既有 importer（`useCityStore`、`buildingUpgrade`、`GangTreePanel`、`GangIdleController` 等）继续从原路径导入，行为不变，不产生编译断裂。`getBuildingStageProgress` 只新增纯函数，`BuildingPanel` 展示切换延后到 Task 6。
2. **Task 2–3**（引擎、Adventure store）只新增文件；`resetAccount` 在 Task 3 扩展第三个 store（既有 city/gang 行为不变）。
3. **Task 4–5** 只新增 standalone UI 组件（`GlobalHud`/`HeroesPanel`/`AdventurePanel`/`FormationPanel`），并在 Task 4 更新 `GangTreePanel` 渲染统一数组；**不改 `App.tsx`**，现有 boolean overlay 与 `selectedBuildingId` 驱动的建筑面板保持可运行。
4. **Task 6** 一次性把 `App.tsx` 重写为单 `activeOverlay`：删除 `gangTreeOpen`/`settingsOpen` 布尔，`buildingDetail` 映射 `selectedBuildingId`，接入 `GlobalHud`/`AdventurePanel`/`HeroesPanel`/`BattleScreen`/`AdventureIdleClock`，并把 `BuildingPanel` 进度展示切到 `getBuildingStageProgress`。此前 `App.tsx` 一直是可编译的旧形态，避免中间断裂。
5. **Task 7** 门禁、CDP、文档、审查、发布。

Task 7 前对每个任务执行任务级 review，最终对全分支执行 review；任何 Critical/Important 发现先写失败测试 TDD 修复、单独提交、重跑全量门禁与 CDP，再复审。

---
## Task 1: JSON Config Schemas, Strict Parsers, Unified ProgressionUnlock, Hero Rules, Building Stage Progress

**Files:**

- Create: `src/config/heroes.config.json`
- Create: `src/config/heroesConfig.ts`
- Create: `src/config/heroesConfig.test.ts`
- Create: `src/config/campaign.config.json`
- Create: `src/config/campaignConfig.ts`
- Create: `src/config/campaignConfig.test.ts`
- Create: `src/config/combat.config.json`
- Create: `src/config/combatConfig.ts`
- Create: `src/config/combatConfig.test.ts`
- Create: `src/config/idle-experience.config.json`
- Create: `src/config/idleExperienceConfig.ts`
- Create: `src/config/idleExperienceConfig.test.ts`
- Create: `src/game/progressionUnlocks.ts`
- Create: `src/game/progressionUnlocks.test.ts`
- Create: `src/game/heroes.ts`
- Create: `src/game/heroes.test.ts`
- Modify: `src/game/gangProgression.ts`
- Modify: `src/game/gangProgression.test.ts`
- Modify: `src/game/buildingUpgrade.ts`
- Modify: `src/game/buildingUpgrade.test.ts`

**Interfaces:**

- Consumes: `BuildingId`/`BUILDING_IDS`（`cityTypes`）、`BuildingLevel`/`BuildingProgress`、`getUnlockedChildCount`/`getBuildingUpgradeProgress`（`buildingUpgrade`）、`GANG_MIN_LEVEL`/`GANG_MAX_LEVEL`（`gangProgression`）。
- Produces（后续任务依赖的精确签名）：

```ts
// src/game/heroes.ts
export const HERO_IDS: readonly ['foreman', 'anvil', 'skyline']
export type HeroId = (typeof HERO_IDS)[number]
export type Row = 'front' | 'back'
export interface HeroStats { hp: number; atk: number; def: number }
export function isHeroId(value: string): value is HeroId
export function getHeroStats(heroId: HeroId, level: number): HeroStats
export function getHeroLevelCap(gangLevel: number): number // min(50, normalizeGangLevel(gangLevel))
export { heroUnlockLevel, isHeroUnlocked } from './progressionUnlocks'

// src/game/progressionUnlocks.ts
export type UnlockKind = 'building' | 'hero' | 'feature'
export type FeatureId = 'adventure' | 'heroes'
export interface ProgressionUnlockBase { requiredLevel: number; roleTitle: string }
export type ProgressionUnlock =
  | (ProgressionUnlockBase & { kind: 'building'; buildingId: BuildingId })
  | (ProgressionUnlockBase & { kind: 'hero'; heroId: HeroId })
  | (ProgressionUnlockBase & { kind: 'feature'; featureId: FeatureId })
export const PROGRESSION_UNLOCKS: readonly ProgressionUnlock[]
export interface BuildingUnlock { buildingId: BuildingId; requiredLevel: number; roleTitle: string }
export function getBuildingUnlock(buildingId: string): BuildingUnlock | null
export function isBuildingUnlocked(buildingId: string, gangLevel: number): boolean
export function heroUnlockLevel(heroId: HeroId): number
export function isHeroUnlocked(heroId: HeroId, gangLevel: number): boolean
export function isFeatureUnlocked(featureId: FeatureId, gangLevel: number): boolean

// src/config/combatConfig.ts
export interface SkillConfig {
  targetMultiplier: number
  splashMultiplier: number
  initialCooldownTicks: number
  cooldownTicks: number
}
export interface PositionModifier { atkMul: number; defMul: number; aggro: boolean }
export const combatConfig: {
  version: 1; tickMs: 100; maxBattleTicks: 600; attackIntervalTicks: number
  defenseConstant: number
  positionModifiers: { front: PositionModifier; back: PositionModifier }
  powerWeights: { hp: number; atk: number; def: number }
  skillDefaults: SkillConfig
  enemySkillCooldownTicks: number
}

// src/config/heroesConfig.ts
export interface HeroSkillConfig extends SkillConfig { name: string }
export interface HeroAppearance {
  primaryColor: string; accentColor: string
  silhouette: 'capsule' | 'bulk' | 'slim'
  weapon: 'shotgun' | 'axe-shield' | 'rifle'
}
export interface HeroDefinition {
  name: string; alias: string; role: Row
  defaultSlot: { row: Row; index: number }; unlockGangLevel: number
  baseHp: number; baseAtk: number; baseDef: number
  hpPerLevel: number; atkPerLevel: number; defPerLevel: number
  skill: HeroSkillConfig; appearance: HeroAppearance
}
export const heroesConfig: { version: 1; heroes: Record<HeroId, HeroDefinition> }
export function expToLevel(level: number): number // L in 1..49

// src/config/campaignConfig.ts
export interface EnemyStats { level: number; hp: number; atk: number; def: number }
export interface StageConfig {
  id: string; global: number; enemyCount: number
  enemy: EnemyStats; firstClearReward: { sharedExp: number }
}
export const campaignConfig: { version: 1; chapters: 2; stagesPerChapter: 10; stages: readonly StageConfig[] }
export function getStage(g: number): StageConfig
export function getEnemyCount(g: number): number
export function getFirstClearReward(g: number): number
export function isStageUnlocked(g: number, highestClearedStage: number): boolean

// src/config/idleExperienceConfig.ts
export interface IdleSettlementInput { lastUpdatedAt: number; now: number; highestClearedStage: number }
export interface IdleSettlement { earnedExp: number; nextUpdatedAt: number }
export function ratePerTick(highestClearedStage: number): number // g<1 -> 0
export function settleIdleExperience(input: IdleSettlementInput): IdleSettlement

// src/game/buildingUpgrade.ts (added)
export interface BuildingStageProgress {
  unlockedChildCount: number
  completedStageSteps: number
  totalStageSteps: number
  ratio: number
  percent: number
  complete: boolean
}
export function childUnlockLevel(buildingId: BuildingId, childIndex: number): number
export function getBuildingStageProgress(
  buildingId: BuildingId,
  progress: BuildingProgress,
): BuildingStageProgress
```

- Temporary compatibility: `gangProgression.ts` 保留 `BUILDING_UNLOCKS`/`getBuildingUnlock`/`isBuildingUnlocked` 导出，但改为 re-export `progressionUnlocks.ts` 的派生实现（形状 `{buildingId, requiredLevel, roleTitle}`、顺序与旧数组完全一致）。这不是临时垫片、无需后续删除；它是永久兼容层，避免改动所有既有 importer。

- [ ] **Step 1: Write unified-unlock RED tests**

在 `src/game/progressionUnlocks.test.ts` 写：

```ts
import { describe, expect, it } from 'vitest'
import {
  PROGRESSION_UNLOCKS,
  getBuildingUnlock,
  heroUnlockLevel,
  isFeatureUnlocked,
  isHeroUnlocked,
} from './progressionUnlocks'

it('derives building unlocks in the legacy order/shape', () => {
  expect(getBuildingUnlock('repair-shop')).toEqual({
    buildingId: 'repair-shop',
    requiredLevel: 1,
    roleTitle: 'Prospect',
  })
  expect(getBuildingUnlock('clubhouse')?.requiredLevel).toBe(40)
  expect(getBuildingUnlock('unknown')).toBeNull()
})

it('exposes hero unlock levels and gang-derived hero unlocks', () => {
  expect(heroUnlockLevel('foreman')).toBe(1)
  expect(heroUnlockLevel('anvil')).toBe(12)
  expect(heroUnlockLevel('skyline')).toBe(28)
  expect(isHeroUnlocked('anvil', 11)).toBe(false)
  expect(isHeroUnlocked('anvil', 12)).toBe(true)
  expect(isHeroUnlocked('skyline', 50)).toBe(true)
})

it('marks adventure and heroes features unlocked at Lv.1', () => {
  expect(isFeatureUnlocked('adventure', 1)).toBe(true)
  expect(isFeatureUnlocked('heroes', 1)).toBe(true)
})

it('allows multiple unlocks at level 1', () => {
  const lv1 = PROGRESSION_UNLOCKS.filter((u) => u.requiredLevel === 1)
  expect(lv1).toHaveLength(4) // repair-shop building + adventure/heroes feature + foreman hero
})
```

在 `src/game/heroes.test.ts` 写：

```ts
import { describe, expect, it } from 'vitest'
import { getHeroLevelCap, getHeroStats, isHeroId } from './heroes'

it('derives level-1 stats from config base values', () => {
  expect(getHeroStats('foreman', 1)).toEqual({ hp: 800, atk: 120, def: 40 })
})

it('applies per-level growth as safe integers', () => {
  // foreman Lv3: hp 800+60*2=920, atk 120+10*2=140, def 40+3*2=46
  expect(getHeroStats('foreman', 3)).toEqual({ hp: 920, atk: 140, def: 46 })
})

it('caps hero level by gang level', () => {
  expect(getHeroLevelCap(12)).toBe(12)
  expect(getHeroLevelCap(60)).toBe(50)
  expect(getHeroLevelCap(0)).toBe(1)
})

it('narrows hero ids', () => {
  expect(isHeroId('anvil')).toBe(true)
  expect(isHeroId('nobody')).toBe(false)
})
```

- [ ] **Step 2: Run unlock/hero RED**

Run: `npm.cmd test -- src/game/progressionUnlocks.test.ts src/game/heroes.test.ts`
Expected: FAIL，模块尚不存在（`Cannot find module './progressionUnlocks'`）。

- [ ] **Step 3: Implement progressionUnlocks and heroes modules**

`src/game/progressionUnlocks.ts`：

```ts
import type { BuildingId } from './cityTypes'
import type { HeroId } from './heroes'

export type UnlockKind = 'building' | 'hero' | 'feature'
export type FeatureId = 'adventure' | 'heroes'
export interface ProgressionUnlockBase { requiredLevel: number; roleTitle: string }
export type ProgressionUnlock =
  | (ProgressionUnlockBase & { kind: 'building'; buildingId: BuildingId })
  | (ProgressionUnlockBase & { kind: 'hero'; heroId: HeroId })
  | (ProgressionUnlockBase & { kind: 'feature'; featureId: FeatureId })

export const PROGRESSION_UNLOCKS: readonly ProgressionUnlock[] = [
  { kind: 'building', buildingId: 'repair-shop', requiredLevel: 1, roleTitle: 'Prospect' },
  { kind: 'feature', featureId: 'adventure', requiredLevel: 1, roleTitle: 'Prospect' },
  { kind: 'feature', featureId: 'heroes', requiredLevel: 1, roleTitle: 'Prospect' },
  { kind: 'hero', heroId: 'foreman', requiredLevel: 1, roleTitle: 'Prospect' },
  { kind: 'building', buildingId: 'recycling-yard', requiredLevel: 8, roleTitle: 'Full Patch' },
  { kind: 'hero', heroId: 'anvil', requiredLevel: 12, roleTitle: 'Full Patch' },
  { kind: 'building', buildingId: 'commercial-street', requiredLevel: 16, roleTitle: 'Wrench' },
  { kind: 'building', buildingId: 'metalworking-plant', requiredLevel: 24, roleTitle: 'Bar Liaison' },
  { kind: 'hero', heroId: 'skyline', requiredLevel: 28, roleTitle: 'Bar Liaison' },
  { kind: 'building', buildingId: 'gas-station', requiredLevel: 32, roleTitle: 'Road Captain' },
  { kind: 'building', buildingId: 'clubhouse', requiredLevel: 40, roleTitle: 'V. PRESIDENT' },
]

export const GANG_MIN_LEVEL = 1
export const GANG_MAX_LEVEL = 50

export function normalizeGangLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return level === Number.POSITIVE_INFINITY ? GANG_MAX_LEVEL : GANG_MIN_LEVEL
  }
  return Math.min(Math.max(Math.floor(level), GANG_MIN_LEVEL), GANG_MAX_LEVEL)
}

export interface BuildingUnlock { buildingId: BuildingId; requiredLevel: number; roleTitle: string }

export const BUILDING_UNLOCKS: readonly BuildingUnlock[] = PROGRESSION_UNLOCKS.filter(
  (u): u is ProgressionUnlock & { kind: 'building' } => u.kind === 'building',
).map(({ buildingId, requiredLevel, roleTitle }) => ({ buildingId, requiredLevel, roleTitle }))

export function getBuildingUnlock(buildingId: string): BuildingUnlock | null {
  return BUILDING_UNLOCKS.find((u) => u.buildingId === buildingId) ?? null
}

export function isBuildingUnlocked(buildingId: string, level: number): boolean {
  const unlock = getBuildingUnlock(buildingId)
  return unlock !== null && normalizeGangLevel(level) >= unlock.requiredLevel
}

export function heroUnlockLevel(heroId: HeroId): number {
  const unlock = PROGRESSION_UNLOCKS.find((u) => u.kind === 'hero' && u.heroId === heroId)
  if (!unlock) {
    throw new Error(`Unknown hero unlock: ${heroId}`)
  }
  return unlock.requiredLevel
}

export function isHeroUnlocked(heroId: HeroId, gangLevel: number): boolean {
  return normalizeGangLevel(gangLevel) >= heroUnlockLevel(heroId)
}

export function isFeatureUnlocked(featureId: FeatureId, gangLevel: number): boolean {
  const unlock = PROGRESSION_UNLOCKS.find((u) => u.kind === 'feature' && u.featureId === featureId)
  return unlock !== undefined && normalizeGangLevel(gangLevel) >= unlock.requiredLevel
}
```

`src/game/heroes.ts`：

```ts
import { heroesConfig } from '../config/heroesConfig'
import { heroUnlockLevel, isHeroUnlocked, normalizeGangLevel } from './progressionUnlocks'

export const HERO_IDS = ['foreman', 'anvil', 'skyline'] as const
export type HeroId = (typeof HERO_IDS)[number]
export type Row = 'front' | 'back'
export interface HeroStats { hp: number; atk: number; def: number }

export function isHeroId(value: string): value is HeroId {
  return HERO_IDS.some((id) => id === value)
}

export function getHeroStats(heroId: HeroId, level: number): HeroStats {
  const clampedLevel = Math.min(Math.max(Math.floor(level), 1), 50)
  const def = heroesConfig.heroes[heroId]
  return {
    hp: def.baseHp + def.hpPerLevel * (clampedLevel - 1),
    atk: def.baseAtk + def.atkPerLevel * (clampedLevel - 1),
    def: def.baseDef + def.defPerLevel * (clampedLevel - 1),
  }
}

export function getHeroLevelCap(gangLevel: number): number {
  return Math.min(50, normalizeGangLevel(gangLevel))
}

export { heroUnlockLevel, isHeroUnlocked }
```

- [ ] **Step 4: Write four-config parser RED tests**

在 `src/config/heroesConfig.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { expToLevel, heroesConfig, parseHeroesConfig } from './heroesConfig'

it('exposes hero base stats and skill', () => {
  expect(heroesConfig.version).toBe(1)
  expect(heroesConfig.heroes.foreman.baseHp).toBe(800)
  expect(heroesConfig.heroes.anvil.role).toBe('front')
  expect(heroesConfig.heroes.skyline.skill.targetMultiplier).toBe(3.2)
})

it('materializes expToLevel(L) = 50 * (L + 1)', () => {
  expect(expToLevel(1)).toBe(100)
  expect(expToLevel(2)).toBe(150)
  expect(expToLevel(49)).toBe(2500)
  expect(() => expToLevel(50)).toThrow()
  expect(() => expToLevel(0)).toThrow()
})

it('rejects unlockGangLevel diverging from PROGRESSION_UNLOCKS', () => {
  const bad = structuredClone(heroesConfig) as Record<string, unknown>
  ;(bad.heroes as Record<string, Record<string, unknown>>).anvil.unlockGangLevel = 13
  expect(() => parseHeroesConfig(bad)).toThrow(
    'Invalid heroes config: heroes.anvil.unlockGangLevel',
  )
})

it('rejects negative or non-integer base stats', () => {
  const bad = structuredClone(heroesConfig) as Record<string, unknown>
  ;(bad.heroes as Record<string, Record<string, unknown>>).foreman.baseHp = -1
  expect(() => parseHeroesConfig(bad)).toThrow('Invalid heroes config: heroes.foreman.baseHp')
})
```

在 `src/config/campaignConfig.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { campaignConfig, getEnemyCount, getFirstClearReward, getStage, isStageUnlocked, parseCampaignConfig } from './campaignConfig'

it('holds exactly 20 stages with monotonically increasing globals', () => {
  expect(campaignConfig.stages).toHaveLength(20)
  expect(campaignConfig.stages.map((s) => s.global)).toEqual(
    Array.from({ length: 20 }, (_, i) => i + 1),
  )
})

it('maps enemy counts by the §3.2 bands', () => {
  expect([1, 2, 3, 4, 5, 6, 7].map(getEnemyCount)).toEqual([1, 1, 1, 2, 2, 2, 2])
  expect([8, 11, 12, 15, 16, 20].map(getEnemyCount)).toEqual([3, 3, 4, 4, 5, 5])
  expect(() => getEnemyCount(0)).toThrow()
  expect(() => getEnemyCount(21)).toThrow()
})

it('materializes derived enemy curves and rewards', () => {
  expect(getStage(3).enemy).toEqual({ level: 2, hp: 560, atk: 94, def: 23 })
  expect(getStage(20).enemy).toEqual({ level: 10, hp: 1920, atk: 298, def: 91 })
  expect(getFirstClearReward(1)).toBe(500)
  expect(getFirstClearReward(20)).toBe(10000)
  expect(getStage(1).id).toBe('1-1')
  expect(getStage(20).id).toBe('2-10')
})

it('unlocks only cleared stages and the next stage', () => {
  expect(isStageUnlocked(1, 0)).toBe(true)
  expect(isStageUnlocked(2, 0)).toBe(false)
  expect(isStageUnlocked(2, 1)).toBe(true)
  expect(isStageUnlocked(6, 5)).toBe(true)
  expect(isStageUnlocked(7, 5)).toBe(false)
})

it('rejects an enemyCount inconsistent with getEnemyCount', () => {
  const bad = structuredClone(campaignConfig) as Record<string, unknown>
  ;(bad.stages as Record<string, unknown>[])[0].enemyCount = 2
  expect(() => parseCampaignConfig(bad)).toThrow('Invalid campaign config: stages.0.enemyCount')
})
```

在 `src/config/combatConfig.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { combatConfig, parseCombatConfig } from './combatConfig'

it('locks tickMs and maxBattleTicks', () => {
  expect(combatConfig.tickMs).toBe(100)
  expect(combatConfig.maxBattleTicks).toBe(600)
  expect(combatConfig.positionModifiers.front.aggro).toBe(true)
  expect(combatConfig.positionModifiers.back.aggro).toBe(false)
})

it('rejects a wrong tickMs', () => {
  const bad = structuredClone(combatConfig) as Record<string, unknown>
  bad.tickMs = 50
  expect(() => parseCombatConfig(bad)).toThrow('Invalid combat config: tickMs')
})

it('rejects a non-positive defenseConstant', () => {
  const bad = structuredClone(combatConfig) as Record<string, unknown>
  bad.defenseConstant = 0
  expect(() => parseCombatConfig(bad)).toThrow('Invalid combat config: defenseConstant')
})
```

在 `src/config/idleExperienceConfig.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { ratePerTick, settleIdleExperience } from './idleExperienceConfig'

it('scales rate as 2 * highestClearedStage and 0 when unopened', () => {
  expect(ratePerTick(1)).toBe(2)
  expect(ratePerTick(20)).toBe(40)
  expect(ratePerTick(0)).toBe(0)
})

it('accrues whole ticks and keeps the remainder', () => {
  const base = 1_000_000
  const r = settleIdleExperience({ lastUpdatedAt: base, now: base + 25_000, highestClearedStage: 1 })
  expect(r).toEqual({ earnedExp: 4, nextUpdatedAt: base + 20_000 }) // 2 ticks * 2
})

it('no-ops on unopened idle, clock rewind and sub-tick', () => {
  const base = 1_000_000
  expect(settleIdleExperience({ lastUpdatedAt: base, now: base + 25_000, highestClearedStage: 0 })).toEqual({ earnedExp: 0, nextUpdatedAt: base })
  expect(settleIdleExperience({ lastUpdatedAt: base, now: base - 1, highestClearedStage: 1 })).toEqual({ earnedExp: 0, nextUpdatedAt: base })
  expect(settleIdleExperience({ lastUpdatedAt: base, now: base + 9_999, highestClearedStage: 1 })).toEqual({ earnedExp: 0, nextUpdatedAt: base })
})

it('caps offline earnings at 8 hours and sets clock to now', () => {
  const base = 1_000_000
  const nineHours = 9 * 3600 * 1000
  const r = settleIdleExperience({ lastUpdatedAt: base, now: base + nineHours, highestClearedStage: 1 })
  expect(r.earnedExp).toBe(2 * 2880) // 8h / 10s = 2880 ticks
  expect(r.nextUpdatedAt).toBe(base + nineHours)
})
```

- [ ] **Step 5: Run four-config RED**

Run: `npm.cmd test -- src/config/heroesConfig.test.ts src/config/campaignConfig.test.ts src/config/combatConfig.test.ts src/config/idleExperienceConfig.test.ts`
Expected: FAIL，四份模块与 JSON 尚不存在。

- [ ] **Step 6: Write the four materialized JSON configs**

`src/config/combat.config.json`：

```json
{
  "version": 1,
  "tickMs": 100,
  "maxBattleTicks": 600,
  "attackIntervalTicks": 8,
  "defenseConstant": 100,
  "positionModifiers": {
    "front": { "atkMul": 1.0, "defMul": 1.25, "aggro": true },
    "back": { "atkMul": 1.15, "defMul": 0.9, "aggro": false }
  },
  "powerWeights": { "hp": 0.5, "atk": 2.0, "def": 1.5 },
  "skillDefaults": { "targetMultiplier": 2.0, "splashMultiplier": 0.5, "initialCooldownTicks": 30, "cooldownTicks": 90 },
  "enemySkillCooldownTicks": 120
}
```

`src/config/idle-experience.config.json`（`ratePerTickByHighestStage` 键 `"1".."20"`，值 `2*g`）：

```json
{
  "version": 1,
  "tickSeconds": 10,
  "maxOfflineSeconds": 28800,
  "ratePerTickByHighestStage": {
    "1": 2, "2": 4, "3": 6, "4": 8, "5": 10, "6": 12, "7": 14, "8": 16, "9": 18, "10": 20,
    "11": 22, "12": 24, "13": 26, "14": 28, "15": 30, "16": 32, "17": 34, "18": 36, "19": 38, "20": 40
  }
}
```

`src/config/heroes.config.json`（`expToLevel` 覆盖 `"1".."49"`，值 `50*(L+1)`，即 100,150,200,…,2500）：

```json
{
  "version": 1,
  "expToLevel": {
    "1": 100, "2": 150, "3": 200, "4": 250, "5": 300, "6": 350, "7": 400, "8": 450, "9": 500, "10": 550,
    "11": 600, "12": 650, "13": 700, "14": 750, "15": 800, "16": 850, "17": 900, "18": 950, "19": 1000, "20": 1050,
    "21": 1100, "22": 1150, "23": 1200, "24": 1250, "25": 1300, "26": 1350, "27": 1400, "28": 1450, "29": 1500, "30": 1550,
    "31": 1600, "32": 1650, "33": 1700, "34": 1750, "35": 1800, "36": 1850, "37": 1900, "38": 1950, "39": 2000, "40": 2050,
    "41": 2100, "42": 2150, "43": 2200, "44": 2250, "45": 2300, "46": 2350, "47": 2400, "48": 2450, "49": 2500
  },
  "heroes": {
    "foreman": {
      "name": "陈锤", "alias": "工头", "role": "back",
      "defaultSlot": { "row": "back", "index": 1 }, "unlockGangLevel": 1,
      "baseHp": 800, "baseAtk": 120, "baseDef": 40,
      "hpPerLevel": 60, "atkPerLevel": 10, "defPerLevel": 3,
      "skill": { "name": "散射压制", "targetMultiplier": 2.5, "splashMultiplier": 0.8, "initialCooldownTicks": 30, "cooldownTicks": 90 },
      "appearance": { "primaryColor": "#e8b83a", "accentColor": "#3a3a3a", "silhouette": "capsule", "weapon": "shotgun" }
    },
    "anvil": {
      "name": "岳峰", "alias": "铁砧", "role": "front",
      "defaultSlot": { "row": "front", "index": 0 }, "unlockGangLevel": 12,
      "baseHp": 1500, "baseAtk": 80, "baseDef": 90,
      "hpPerLevel": 110, "atkPerLevel": 6, "defPerLevel": 7,
      "skill": { "name": "钢盾镇场", "targetMultiplier": 1.8, "splashMultiplier": 0.5, "initialCooldownTicks": 40, "cooldownTicks": 100 },
      "appearance": { "primaryColor": "#5a5f66", "accentColor": "#ff7a1a", "silhouette": "bulk", "weapon": "axe-shield" }
    },
    "skyline": {
      "name": "秦岚", "alias": "长空", "role": "back",
      "defaultSlot": { "row": "back", "index": 0 }, "unlockGangLevel": 28,
      "baseHp": 650, "baseAtk": 160, "baseDef": 30,
      "hpPerLevel": 45, "atkPerLevel": 14, "defPerLevel": 2,
      "skill": { "name": "长空穿击", "targetMultiplier": 3.2, "splashMultiplier": 0.4, "initialCooldownTicks": 35, "cooldownTicks": 80 },
      "appearance": { "primaryColor": "#22405f", "accentColor": "#3fd0d0", "silhouette": "slim", "weapon": "rifle" }
    }
  }
}
```

`src/config/campaign.config.json`（20 关全部物化，`level=1+floor((g-1)/2)`、`hp=400+80*(g-1)`、`atk=70+12*(g-1)`、`def=15+4*(g-1)`、`enemyCount`=§3.2、`sharedExp=500*g`）：

```json
{
  "version": 1, "chapters": 2, "stagesPerChapter": 10,
  "stages": [
    { "id": "1-1", "global": 1, "enemyCount": 1, "enemy": { "level": 1, "hp": 400, "atk": 70, "def": 15 }, "firstClearReward": { "sharedExp": 500 } },
    { "id": "1-2", "global": 2, "enemyCount": 1, "enemy": { "level": 1, "hp": 480, "atk": 82, "def": 19 }, "firstClearReward": { "sharedExp": 1000 } },
    { "id": "1-3", "global": 3, "enemyCount": 1, "enemy": { "level": 2, "hp": 560, "atk": 94, "def": 23 }, "firstClearReward": { "sharedExp": 1500 } },
    { "id": "1-4", "global": 4, "enemyCount": 2, "enemy": { "level": 2, "hp": 640, "atk": 106, "def": 27 }, "firstClearReward": { "sharedExp": 2000 } },
    { "id": "1-5", "global": 5, "enemyCount": 2, "enemy": { "level": 3, "hp": 720, "atk": 118, "def": 31 }, "firstClearReward": { "sharedExp": 2500 } },
    { "id": "1-6", "global": 6, "enemyCount": 2, "enemy": { "level": 3, "hp": 800, "atk": 130, "def": 35 }, "firstClearReward": { "sharedExp": 3000 } },
    { "id": "1-7", "global": 7, "enemyCount": 2, "enemy": { "level": 4, "hp": 880, "atk": 142, "def": 39 }, "firstClearReward": { "sharedExp": 3500 } },
    { "id": "1-8", "global": 8, "enemyCount": 3, "enemy": { "level": 4, "hp": 960, "atk": 154, "def": 43 }, "firstClearReward": { "sharedExp": 4000 } },
    { "id": "1-9", "global": 9, "enemyCount": 3, "enemy": { "level": 5, "hp": 1040, "atk": 166, "def": 47 }, "firstClearReward": { "sharedExp": 4500 } },
    { "id": "1-10", "global": 10, "enemyCount": 3, "enemy": { "level": 5, "hp": 1120, "atk": 178, "def": 51 }, "firstClearReward": { "sharedExp": 5000 } },
    { "id": "2-1", "global": 11, "enemyCount": 3, "enemy": { "level": 6, "hp": 1200, "atk": 190, "def": 55 }, "firstClearReward": { "sharedExp": 5500 } },
    { "id": "2-2", "global": 12, "enemyCount": 4, "enemy": { "level": 6, "hp": 1280, "atk": 202, "def": 59 }, "firstClearReward": { "sharedExp": 6000 } },
    { "id": "2-3", "global": 13, "enemyCount": 4, "enemy": { "level": 7, "hp": 1360, "atk": 214, "def": 63 }, "firstClearReward": { "sharedExp": 6500 } },
    { "id": "2-4", "global": 14, "enemyCount": 4, "enemy": { "level": 7, "hp": 1440, "atk": 226, "def": 67 }, "firstClearReward": { "sharedExp": 7000 } },
    { "id": "2-5", "global": 15, "enemyCount": 4, "enemy": { "level": 8, "hp": 1520, "atk": 238, "def": 71 }, "firstClearReward": { "sharedExp": 7500 } },
    { "id": "2-6", "global": 16, "enemyCount": 5, "enemy": { "level": 8, "hp": 1600, "atk": 250, "def": 75 }, "firstClearReward": { "sharedExp": 8000 } },
    { "id": "2-7", "global": 17, "enemyCount": 5, "enemy": { "level": 9, "hp": 1680, "atk": 262, "def": 79 }, "firstClearReward": { "sharedExp": 8500 } },
    { "id": "2-8", "global": 18, "enemyCount": 5, "enemy": { "level": 9, "hp": 1760, "atk": 274, "def": 83 }, "firstClearReward": { "sharedExp": 9000 } },
    { "id": "2-9", "global": 19, "enemyCount": 5, "enemy": { "level": 10, "hp": 1840, "atk": 286, "def": 87 }, "firstClearReward": { "sharedExp": 9500 } },
    { "id": "2-10", "global": 20, "enemyCount": 5, "enemy": { "level": 10, "hp": 1920, "atk": 298, "def": 91 }, "firstClearReward": { "sharedExp": 10000 } }
  ]
}
```

- [ ] **Step 7: Implement the four strict parsers**

四份解析器复用 `economyConfig.ts` 的模式（`isRecord`、`parsePositiveInteger`、`parseNonNegativeInteger`、`invalidConfig(path)`）。关键实现要点：

`combatConfig.ts`：

```ts
import raw from './combat.config.json'
export interface SkillConfig { targetMultiplier: number; splashMultiplier: number; initialCooldownTicks: number; cooldownTicks: number }
export interface PositionModifier { atkMul: number; defMul: number; aggro: boolean }

function invalidConfig(path: string): never { throw new Error(`Invalid combat config: ${path}`) }
function parsePositiveMultiplier(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) invalidConfig(path)
  return v
}
function parsePositiveInt(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) invalidConfig(path)
  return v
}
function parseSkill(v: unknown, path: string): SkillConfig {
  if (typeof v !== 'object' || v === null) invalidConfig(path)
  const o = v as Record<string, unknown>
  return {
    targetMultiplier: parsePositiveMultiplier(o.targetMultiplier, `${path}.targetMultiplier`),
    splashMultiplier: parsePositiveMultiplier(o.splashMultiplier, `${path}.splashMultiplier`),
    initialCooldownTicks: parsePositiveInt(o.initialCooldownTicks, `${path}.initialCooldownTicks`),
    cooldownTicks: parsePositiveInt(o.cooldownTicks, `${path}.cooldownTicks`),
  }
}
export function parseCombatConfig(value: unknown) {
  const o = value as Record<string, unknown>
  if (!o || o.version !== 1) invalidConfig('version')
  if (o.tickMs !== 100) invalidConfig('tickMs')
  if (o.maxBattleTicks !== 600) invalidConfig('maxBattleTicks')
  const defenseConstant = o.defenseConstant
  if (typeof defenseConstant !== 'number' || !Number.isFinite(defenseConstant) || defenseConstant <= 0) invalidConfig('defenseConstant')
  const parsePM = (pm: unknown, p: string): PositionModifier => {
    const m = pm as Record<string, unknown>
    if (typeof m?.aggro !== 'boolean') invalidConfig(`${p}.aggro`)
    return { atkMul: parsePositiveMultiplier(m.atkMul, `${p}.atkMul`), defMul: parsePositiveMultiplier(m.defMul, `${p}.defMul`), aggro: m.aggro }
  }
  const modifiers = o.positionModifiers as Record<string, unknown>
  const weights = o.powerWeights as Record<string, unknown>
  const parseWeight = (w: unknown, p: string): number => {
    if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) invalidConfig(p)
    return w
  }
  return {
    version: 1 as const, tickMs: 100 as const, maxBattleTicks: 600 as const,
    attackIntervalTicks: parsePositiveInt(o.attackIntervalTicks, 'attackIntervalTicks'),
    defenseConstant,
    positionModifiers: { front: parsePM(modifiers?.front, 'positionModifiers.front'), back: parsePM(modifiers?.back, 'positionModifiers.back') },
    powerWeights: { hp: parseWeight(weights?.hp, 'powerWeights.hp'), atk: parseWeight(weights?.atk, 'powerWeights.atk'), def: parseWeight(weights?.def, 'powerWeights.def') },
    skillDefaults: parseSkill(o.skillDefaults, 'skillDefaults'),
    enemySkillCooldownTicks: parsePositiveInt(o.enemySkillCooldownTicks, 'enemySkillCooldownTicks'),
  }
}
export const combatConfig = parseCombatConfig(raw)
```

`idleExperienceConfig.ts`：

```ts
import raw from './idle-experience.config.json'
function invalidConfig(path: string): never { throw new Error(`Invalid idle-experience config: ${path}`) }
function parseConfig(value: unknown) {
  const o = value as Record<string, unknown>
  if (!o || o.version !== 1) invalidConfig('version')
  if (o.tickSeconds !== 10) invalidConfig('tickSeconds')
  if (o.maxOfflineSeconds !== 28800) invalidConfig('maxOfflineSeconds')
  const rates = o.ratePerTickByHighestStage as Record<string, unknown>
  if (typeof rates !== 'object' || rates === null) invalidConfig('ratePerTickByHighestStage')
  const parsed: Record<number, number> = {}
  for (const key of Object.keys(rates)) {
    const g = Number(key)
    if (!Number.isInteger(g) || g < 1 || g > 20 || String(g) !== key) invalidConfig(`ratePerTickByHighestStage.${key}`)
  }
  for (let g = 1; g <= 20; g += 1) {
    const value = rates[String(g)]
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) invalidConfig(`ratePerTickByHighestStage.${g}`)
    parsed[g] = value
  }
  return { version: 1 as const, tickSeconds: 10 as const, maxOfflineSeconds: 28800 as const, ratePerTickByHighestStage: parsed }
}
export const idleExperienceConfig = parseConfig(raw)
export function ratePerTick(highestClearedStage: number): number {
  if (!Number.isFinite(highestClearedStage) || highestClearedStage < 1) return 0
  const g = Math.min(20, Math.floor(highestClearedStage))
  return idleExperienceConfig.ratePerTickByHighestStage[g] ?? 0
}
export interface IdleSettlementInput { lastUpdatedAt: number; now: number; highestClearedStage: number }
export interface IdleSettlement { earnedExp: number; nextUpdatedAt: number }
export function settleIdleExperience({ lastUpdatedAt, now, highestClearedStage }: IdleSettlementInput): IdleSettlement {
  if (!Number.isFinite(lastUpdatedAt) || !Number.isFinite(now) || now < lastUpdatedAt) return { earnedExp: 0, nextUpdatedAt: lastUpdatedAt }
  if (highestClearedStage < 1) return { earnedExp: 0, nextUpdatedAt: lastUpdatedAt }
  const tickMs = idleExperienceConfig.tickSeconds * 1000
  const maxOffMs = idleExperienceConfig.maxOfflineSeconds * 1000
  const elapsedMs = now - lastUpdatedAt
  const capped = elapsedMs > maxOffMs
  const effElapsed = Math.min(elapsedMs, maxOffMs)
  const ticks = Math.floor(effElapsed / tickMs)
  if (ticks === 0) return { earnedExp: 0, nextUpdatedAt: lastUpdatedAt }
  const earnedExp = ratePerTick(highestClearedStage) * ticks
  return { earnedExp, nextUpdatedAt: capped ? now : lastUpdatedAt + ticks * tickMs }
}
```

`campaignConfig.ts`：

```ts
import raw from './campaign.config.json'
export interface EnemyStats { level: number; hp: number; atk: number; def: number }
export interface StageConfig { id: string; global: number; enemyCount: number; enemy: EnemyStats; firstClearReward: { sharedExp: number } }
function invalidConfig(path: string): never { throw new Error(`Invalid campaign config: ${path}`) }
export function getEnemyCount(g: number): number {
  if (!Number.isInteger(g) || g < 1 || g > 20) invalidConfig(`getEnemyCount.${g}`)
  if (g <= 3) return 1
  if (g <= 7) return 2
  if (g <= 11) return 3
  if (g <= 15) return 4
  return 5
}
function parseSafeInt(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) invalidConfig(path)
  return v
}
export function parseCampaignConfig(value: unknown) {
  const o = value as Record<string, unknown>
  if (!o || o.version !== 1) invalidConfig('version')
  if (o.chapters !== 2) invalidConfig('chapters')
  if (o.stagesPerChapter !== 10) invalidConfig('stagesPerChapter')
  const stages = o.stages
  if (!Array.isArray(stages) || stages.length !== 20) invalidConfig('stages')
  const parsed: StageConfig[] = stages.map((s, i) => {
    const st = s as Record<string, unknown>
    const global = st.global
    if (global !== i + 1) invalidConfig(`stages.${i}.global`)
    const chapter = global <= 10 ? 1 : 2
    const stageInChapter = global <= 10 ? global : global - 10
    if (st.id !== `${chapter}-${stageInChapter}`) invalidConfig(`stages.${i}.id`)
    if (st.enemyCount !== getEnemyCount(global)) invalidConfig(`stages.${i}.enemyCount`)
    const enemy = st.enemy as Record<string, unknown>
    const reward = st.firstClearReward as Record<string, unknown>
    return {
      id: st.id as string, global, enemyCount: st.enemyCount as number,
      enemy: {
        level: parseSafeInt(enemy?.level, `stages.${i}.enemy.level`),
        hp: parseSafeInt(enemy?.hp, `stages.${i}.enemy.hp`),
        atk: parseSafeInt(enemy?.atk, `stages.${i}.enemy.atk`),
        def: parseSafeInt(enemy?.def, `stages.${i}.enemy.def`),
      },
      firstClearReward: { sharedExp: parseSafeInt(reward?.sharedExp, `stages.${i}.firstClearReward.sharedExp`) },
    }
  })
  return { version: 1 as const, chapters: 2 as const, stagesPerChapter: 10 as const, stages: parsed }
}
export const campaignConfig = parseCampaignConfig(raw)
export function getStage(g: number): StageConfig {
  const stage = campaignConfig.stages.find((s) => s.global === g)
  if (!stage) invalidConfig(`getStage.${g}`)
  return stage
}
export function getFirstClearReward(g: number): number { return getStage(g).firstClearReward.sharedExp }
export function isStageUnlocked(g: number, highestClearedStage: number): boolean {
  if (!Number.isInteger(g) || g < 1 || g > 20) return false
  return g === 1 || g <= highestClearedStage + 1
}
```

`heroesConfig.ts`（校验 `role∈{front,back}`、`unlockGangLevel` 与 `heroUnlockLevel` 一致、`base*/perLevel` 非负安全整数、`*Multiplier>0`、`*CooldownTicks` 正整数、`expToLevel` 覆盖 `"1".."49"` 正整数、`heroId` 集合恰为 `HERO_IDS`、`appearance` 枚举合法）：

```ts
import raw from './heroes.config.json'
import type { SkillConfig } from './combatConfig'
import { HERO_IDS, type HeroId, type Row } from '../game/heroes'
import { heroUnlockLevel } from '../game/progressionUnlocks'
export interface HeroSkillConfig extends SkillConfig { name: string }
export interface HeroAppearance { primaryColor: string; accentColor: string; silhouette: 'capsule' | 'bulk' | 'slim'; weapon: 'shotgun' | 'axe-shield' | 'rifle' }
export interface HeroDefinition {
  name: string; alias: string; role: Row; defaultSlot: { row: Row; index: number }; unlockGangLevel: number
  baseHp: number; baseAtk: number; baseDef: number; hpPerLevel: number; atkPerLevel: number; defPerLevel: number
  skill: HeroSkillConfig; appearance: HeroAppearance
}
function invalidConfig(path: string): never { throw new Error(`Invalid heroes config: ${path}`) }
function parseNonNegSafeInt(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) invalidConfig(path)
  return v
}
function parsePositiveSafeInt(v: unknown, path: string): number {
  const n = parseNonNegSafeInt(v, path)
  if (n === 0) invalidConfig(path)
  return n
}
function parsePositiveNumber(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) invalidConfig(path)
  return v
}
function parseString(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.trim().length === 0) invalidConfig(path)
  return v
}
function parseRow(v: unknown, path: string): Row {
  if (v !== 'front' && v !== 'back') invalidConfig(path)
  return v
}
function parseSkill(v: unknown, path: string): HeroSkillConfig {
  const s = v as Record<string, unknown>
  if (!s) invalidConfig(path)
  return {
    name: parseString(s.name, `${path}.name`),
    targetMultiplier: parsePositiveNumber(s.targetMultiplier, `${path}.targetMultiplier`),
    splashMultiplier: parsePositiveNumber(s.splashMultiplier, `${path}.splashMultiplier`),
    initialCooldownTicks: parsePositiveSafeInt(s.initialCooldownTicks, `${path}.initialCooldownTicks`),
    cooldownTicks: parsePositiveSafeInt(s.cooldownTicks, `${path}.cooldownTicks`),
  }
}
function parseAppearance(v: unknown, path: string): HeroAppearance {
  const a = v as Record<string, unknown>
  if (!a) invalidConfig(path)
  if (a.silhouette !== 'capsule' && a.silhouette !== 'bulk' && a.silhouette !== 'slim') invalidConfig(`${path}.silhouette`)
  if (a.weapon !== 'shotgun' && a.weapon !== 'axe-shield' && a.weapon !== 'rifle') invalidConfig(`${path}.weapon`)
  return {
    primaryColor: parseString(a.primaryColor, `${path}.primaryColor`),
    accentColor: parseString(a.accentColor, `${path}.accentColor`),
    silhouette: a.silhouette,
    weapon: a.weapon,
  }
}
export function parseHeroesConfig(value: unknown): { version: 1; heroes: Record<HeroId, HeroDefinition>; expToLevel: Record<number, number> } {
  const o = value as Record<string, unknown>
  if (!o || o.version !== 1) invalidConfig('version')
  const expRaw = o.expToLevel as Record<string, unknown>
  const exp: Record<number, number> = {}
  for (const key of Object.keys(expRaw ?? {})) {
    const L = Number(key)
    if (!Number.isInteger(L) || L < 1 || L > 49 || String(L) !== key) invalidConfig(`expToLevel.${key}`)
  }
  for (let L = 1; L <= 49; L += 1) {
    const v = expRaw?.[String(L)]
    if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) invalidConfig(`expToLevel.${L}`)
    exp[L] = v
  }
  const heroesRaw = o.heroes as Record<string, unknown>
  for (const key of Object.keys(heroesRaw ?? {})) {
    if (!HERO_IDS.some((id) => id === key)) invalidConfig(`heroes.${key}`)
  }
  const heroes = {} as Record<HeroId, HeroDefinition>
  for (const id of HERO_IDS) {
    const h = heroesRaw?.[id] as Record<string, unknown>
    if (!h) invalidConfig(`heroes.${id}`)
    const role = parseRow(h.role, `heroes.${id}.role`)
    const unlockGangLevel = parsePositiveSafeInt(h.unlockGangLevel, `heroes.${id}.unlockGangLevel`)
    if (unlockGangLevel !== heroUnlockLevel(id)) invalidConfig(`heroes.${id}.unlockGangLevel`)
    const slot = h.defaultSlot as Record<string, unknown>
    if (!slot) invalidConfig(`heroes.${id}.defaultSlot`)
    heroes[id] = {
      name: parseString(h.name, `heroes.${id}.name`),
      alias: parseString(h.alias, `heroes.${id}.alias`),
      role,
      defaultSlot: {
        row: parseRow(slot.row, `heroes.${id}.defaultSlot.row`),
        index: parseNonNegSafeInt(slot.index, `heroes.${id}.defaultSlot.index`),
      },
      unlockGangLevel,
      baseHp: parseNonNegSafeInt(h.baseHp, `heroes.${id}.baseHp`),
      baseAtk: parseNonNegSafeInt(h.baseAtk, `heroes.${id}.baseAtk`),
      baseDef: parseNonNegSafeInt(h.baseDef, `heroes.${id}.baseDef`),
      hpPerLevel: parseNonNegSafeInt(h.hpPerLevel, `heroes.${id}.hpPerLevel`),
      atkPerLevel: parseNonNegSafeInt(h.atkPerLevel, `heroes.${id}.atkPerLevel`),
      defPerLevel: parseNonNegSafeInt(h.defPerLevel, `heroes.${id}.defPerLevel`),
      skill: parseSkill(h.skill, `heroes.${id}.skill`),
      appearance: parseAppearance(h.appearance, `heroes.${id}.appearance`),
    }
  }
  return { version: 1, heroes, expToLevel: exp }
}
export const heroesConfig = parseHeroesConfig(raw)
export function expToLevel(level: number): number {
  const cost = heroesConfig.expToLevel[level]
  if (!Number.isInteger(cost)) throw new Error(`Invalid heroes config: expToLevel.${level}`)
  return cost
}
```

- [ ] **Step 8: Write building stage-progress RED tests**

在 `src/game/buildingUpgrade.test.ts` 追加：

```ts
import { childUnlockLevel, getBuildingStageProgress } from './buildingUpgrade'

it('childUnlockLevel = index + 1', () => {
  expect(childUnlockLevel('repair-shop', 0)).toBe(1)
  expect(childUnlockLevel('repair-shop', 4)).toBe(5)
  expect(childUnlockLevel('commercial-street', 9)).toBe(10)
})

it('Lv1 needs 1 step', () => {
  expect(getBuildingStageProgress('commercial-street', { level: 1, childLevels: [0, ...Array(9).fill(0)] as never })).toMatchObject({ totalStageSteps: 1, completedStageSteps: 0, complete: false })
  expect(getBuildingStageProgress('commercial-street', { level: 1, childLevels: [1, ...Array(9).fill(0)] as never }).complete).toBe(true)
})

it('Lv2 [1,0] progresses 0 -> 33 -> 66 -> 100 across 3 steps', () => {
  const p = (c: number[]) => getBuildingStageProgress('commercial-street', { level: 2, childLevels: [...c, ...Array(10 - c.length).fill(0)] as never })
  expect(p([1, 0]).totalStageSteps).toBe(3)
  expect(p([1, 0]).completedStageSteps).toBe(0)
  expect(Math.floor(p([2, 0]).percent)).toBe(33)
  expect(Math.floor(p([2, 1]).percent)).toBe(66)
  expect(p([2, 2]).complete).toBe(true)
})

it('repair Lv5->6 needs 5 steps of 20% (no new slot)', () => {
  const p = (c: number[]) => getBuildingStageProgress('repair-shop', { level: 6, childLevels: c as never })
  expect(p([5, 5, 5, 5, 5]).totalStageSteps).toBe(5)
  expect(p([5, 5, 5, 5, 5]).completedStageSteps).toBe(0)
  expect(p([6, 5, 5, 5, 5]).percent).toBe(20)
  expect(p([6, 6, 6, 6, 6]).complete).toBe(true)
})

it('is complete-equivalent to getBuildingUpgradeProgress', () => {
  const progress = { level: 3, childLevels: [3, 3, 3, ...Array(7).fill(0)] } as never
  expect(getBuildingStageProgress('commercial-street', progress).complete).toBe(
    getBuildingUpgradeProgress('commercial-street', progress).complete,
  )
})
```

- [ ] **Step 9: Run stage-progress RED**

Run: `npm.cmd test -- src/game/buildingUpgrade.test.ts`
Expected: FAIL，`getBuildingStageProgress`/`childUnlockLevel` 未定义。

- [ ] **Step 10: Implement getBuildingStageProgress and childUnlockLevel**

在 `src/game/buildingUpgrade.ts` 追加（`getBuildingUpgradeProgress`、`getMainUpgradeDecision` 完全保留不改）：

```ts
export interface BuildingStageProgress {
  unlockedChildCount: number
  completedStageSteps: number
  totalStageSteps: number
  ratio: number
  percent: number
  complete: boolean
}

export function childUnlockLevel(_buildingId: BuildingId, childIndex: number): number {
  return childIndex + 1
}

export function getBuildingStageProgress(
  buildingId: BuildingId,
  progress: BuildingProgress,
): BuildingStageProgress {
  const mainLevel = progress.level
  const unlockedChildCount = getUnlockedChildCount(buildingId, mainLevel)
  let completedStageSteps = 0
  let totalStageSteps = 0
  let allAtMain = true
  for (let i = 0; i < unlockedChildCount; i += 1) {
    const baseline = childUnlockLevel(buildingId, i) === mainLevel ? 0 : mainLevel - 1
    const span = mainLevel - baseline
    const childLevel = Math.max(0, progress.childLevels[i] ?? 0)
    completedStageSteps += Math.min(Math.max(childLevel - baseline, 0), span)
    totalStageSteps += span
    if (childLevel !== mainLevel) allAtMain = false
  }
  const ratio = totalStageSteps <= 0 ? (allAtMain ? 1 : 0) : completedStageSteps / totalStageSteps
  return {
    unlockedChildCount,
    completedStageSteps,
    totalStageSteps,
    ratio,
    percent: ratio * 100,
    complete: completedStageSteps === totalStageSteps && totalStageSteps > 0,
  }
}
```

- [ ] **Step 11: Update gangProgression to derive from progressionUnlocks**

把 `src/game/gangProgression.ts` 内 `BUILDING_UNLOCKS`/`getBuildingUnlock`/`isBuildingUnlocked`/`BuildingUnlock` 的本地定义删除，改为 re-export（并导出 `normalizeGangLevel`）：

```ts
export {
  BUILDING_UNLOCKS,
  getBuildingUnlock,
  isBuildingUnlocked,
  normalizeGangLevel,
  type BuildingUnlock,
} from './progressionUnlocks'
```

`gangProgression.ts` 内部若仍需 `normalizeLevel` 用于 `getGangRole`/`getLevelProgress`，保留其本地私有 `normalizeLevel`（与 `normalizeGangLevel` 等价）。`gangProgression.test.ts` 若断言 `BUILDING_UNLOCKS` 精确数组，确认派生结果与旧数组逐项 `toEqual`（顺序：repair-shop/recycling-yard/commercial-street/metalworking-plant/gas-station/clubhouse，等级 1/8/16/24/32/40，roleTitle 一致）；若不一致则修正测试期望以匹配派生值（本任务已保证一致）。

- [ ] **Step 12: Run GREEN and full intermediate gate**

Run:

```powershell
npm.cmd test -- src/config/heroesConfig.test.ts src/config/campaignConfig.test.ts src/config/combatConfig.test.ts src/config/idleExperienceConfig.test.ts src/game/progressionUnlocks.test.ts src/game/heroes.test.ts src/game/buildingUpgrade.test.ts src/game/gangProgression.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: 全部 exit 0；既有 city/gang/building 测试保持绿（`isBuildingUnlocked` 行为不变）。

- [ ] **Step 13: Commit Task 1**

```powershell
git add src/config/heroes.config.json src/config/heroesConfig.ts src/config/heroesConfig.test.ts src/config/campaign.config.json src/config/campaignConfig.ts src/config/campaignConfig.test.ts src/config/combat.config.json src/config/combatConfig.ts src/config/combatConfig.test.ts src/config/idle-experience.config.json src/config/idleExperienceConfig.ts src/config/idleExperienceConfig.test.ts src/game/progressionUnlocks.ts src/game/progressionUnlocks.test.ts src/game/heroes.ts src/game/heroes.test.ts src/game/gangProgression.ts src/game/gangProgression.test.ts src/game/buildingUpgrade.ts src/game/buildingUpgrade.test.ts
git commit -m "feat: add campaign/hero/combat/idle configs and unified progression unlocks"
```

## Task 2: Deterministic 100ms Fixed-Step Battle Engine

**Files:**

- Create: `src/game/combat/power.ts`
- Create: `src/game/combat/power.test.ts`
- Create: `src/game/combat/damage.ts`
- Create: `src/game/combat/damage.test.ts`
- Create: `src/game/combat/targeting.ts`
- Create: `src/game/combat/targeting.test.ts`
- Create: `src/game/combat/battleEngine.ts`
- Create: `src/game/combat/battleEngine.test.ts`

**Interfaces:**

- Consumes: `combatConfig`/`SkillConfig`（`combatConfig`）、`getHeroStats`/`HeroId`/`Row`（`heroes`）、`getStage`/`getEnemyCount`/`EnemyStats`（`campaignConfig`）、`getHeroLevelCap`。`FormationAssignment` 由本任务定义并供 store/UI 复用。
- Produces：

```ts
// src/game/combat/power.ts
export interface FormationSlot { row: Row; index: number }
export type FormationAssignment = Array<{ heroId: HeroId; row: Row; index: number }>
export function globalIndexOf(row: Row, index: number): number // front[0]=0,front[1]=1,back[0]=2,back[1]=3,back[2]=4
export interface EffStats { effAtk: number; effDef: number; effHp: number }
export function effectiveStats(row: Row, stats: { hp: number; atk: number; def: number }): EffStats
export function unitPower(row: Row, stats: { hp: number; atk: number; def: number }): number
export function teamPower(units: ReadonlyArray<{ row: Row; hp: number; atk: number; def: number }>): number

// src/game/combat/damage.ts
export function mitigation(effDef: number): number // defenseConstant/(defenseConstant+effDef)
export function basicAttackDamage(effAtk: number, effDef: number): number
export function skillMainDamage(effAtk: number, effDef: number, targetMultiplier: number): number
export function skillSplashDamage(effAtk: number, effDef: number, splashMultiplier: number): number

// src/game/combat/targeting.ts
export type Side = 'ally' | 'enemy'
export interface CombatUnitState { globalIndex: number; row: Row; side: Side; hp: number; alive: boolean }
export function selectTarget(defenders: readonly CombatUnitState[]): CombatUnitState | null // front-priority + globalIndex asc

// src/game/combat/battleEngine.ts
export interface BattleUnitInput { side: Side; heroId?: HeroId; level: number; row: Row; index: number; hp: number; atk: number; def: number; skill: SkillConfig }
export interface BattleInput { stage: number; allies: BattleUnitInput[]; enemies: BattleUnitInput[]; seed: string }
export interface UnitSnapshot { side: Side; globalIndex: number; row: Row; hp: number; maxHp: number; cooldownRemaining: number; cooldownTotal: number; alive: boolean }
export interface HitEvent { attackerSide: Side; attackerGlobalIndex: number; targetSide: Side; targetGlobalIndex: number; amount: number; kind: 'basic' | 'skill-main' | 'skill-splash' }
export interface DeathEvent { side: Side; globalIndex: number }
export interface TickSnapshot { tick: number; units: UnitSnapshot[]; hits: HitEvent[]; deaths: DeathEvent[] }
export interface BattleResult { outcome: 'victory' | 'defeat'; endedAtTick: number; reason: 'enemies-cleared' | 'allies-defeated' | 'timeout'; timeline: TickSnapshot[]; alliesSurvived: number }
export function createBattleSeed(input: Omit<BattleInput, 'seed'>): string
export function simulateBattle(input: BattleInput): BattleResult
export function buildBattleInput(stage: number, formation: FormationAssignment, heroLevels: Record<HeroId, number>, gangLevel: number): BattleInput
```

- [ ] **Step 1: Write power/globalIndex RED tests**

`src/game/combat/power.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { effectiveStats, globalIndexOf, teamPower, unitPower } from './power'

it('maps slots to a fixed global order', () => {
  expect(globalIndexOf('front', 0)).toBe(0)
  expect(globalIndexOf('front', 1)).toBe(1)
  expect(globalIndexOf('back', 0)).toBe(2)
  expect(globalIndexOf('back', 2)).toBe(4)
})

it('applies position modifiers to atk/def but not hp', () => {
  // back: atkMul 1.15, defMul 0.9; atk 160 -> round(184)=184, def 30 -> round(27)=27, hp unchanged
  expect(effectiveStats('back', { hp: 650, atk: 160, def: 30 })).toEqual({ effAtk: 184, effDef: 27, effHp: 650 })
  // front: atkMul 1.0, defMul 1.25; def 90 -> round(112.5)=113 (round half up)
  expect(effectiveStats('front', { hp: 1500, atk: 80, def: 90 })).toEqual({ effAtk: 80, effDef: 113, effHp: 1500 })
})

it('computes integer power via weights', () => {
  // back skyline: effHp650*0.5 + effAtk184*2.0 + effDef27*1.5 = 325 + 368 + 40.5 = 733.5 -> round 734
  expect(unitPower('back', { hp: 650, atk: 160, def: 30 })).toBe(734)
  expect(teamPower([{ row: 'back', hp: 650, atk: 160, def: 30 }])).toBe(734)
})
```

- [ ] **Step 2: Run power RED**

Run: `npm.cmd test -- src/game/combat/power.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: Implement power.ts**

```ts
import { combatConfig } from '../../config/combatConfig'
import type { HeroId, Row } from '../heroes'

export interface FormationSlot { row: Row; index: number }
export type FormationAssignment = Array<{ heroId: HeroId; row: Row; index: number }>

export function globalIndexOf(row: Row, index: number): number {
  return row === 'front' ? index : 2 + index
}

export interface EffStats { effAtk: number; effDef: number; effHp: number }

export function effectiveStats(row: Row, stats: { hp: number; atk: number; def: number }): EffStats {
  const mod = combatConfig.positionModifiers[row]
  return { effAtk: Math.round(stats.atk * mod.atkMul), effDef: Math.round(stats.def * mod.defMul), effHp: stats.hp }
}

export function unitPower(row: Row, stats: { hp: number; atk: number; def: number }): number {
  const eff = effectiveStats(row, stats)
  const w = combatConfig.powerWeights
  return Math.round(eff.effHp * w.hp + eff.effAtk * w.atk + eff.effDef * w.def)
}

export function teamPower(units: ReadonlyArray<{ row: Row; hp: number; atk: number; def: number }>): number {
  return Math.min(Number.MAX_SAFE_INTEGER, units.reduce((sum, u) => sum + unitPower(u.row, u), 0))
}
```

- [ ] **Step 4: Write damage RED tests**

`src/game/combat/damage.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { basicAttackDamage, mitigation, skillMainDamage, skillSplashDamage } from './damage'

it('computes mitigation from defenseConstant 100', () => {
  expect(mitigation(0)).toBe(1)
  expect(mitigation(100)).toBeCloseTo(0.5, 10)
})

it('floors basic attack with a minimum of 1', () => {
  // effAtk 184, effDef 27 -> mitigation 100/127; 184*100/127 = 144.88 -> floor 144
  expect(basicAttackDamage(184, 27)).toBe(144)
  // tiny attacker vs huge defender -> at least 1
  expect(basicAttackDamage(1, 100000)).toBe(1)
})

it('scales skill damage by multipliers with floor and min 1', () => {
  expect(skillMainDamage(184, 27, 3.2)).toBe(Math.max(1, Math.floor(184 * 3.2 * (100 / 127))))
  expect(skillSplashDamage(184, 27, 0.4)).toBe(Math.max(1, Math.floor(184 * 0.4 * (100 / 127))))
})
```

- [ ] **Step 5: Run damage RED**

Run: `npm.cmd test -- src/game/combat/damage.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 6: Implement damage.ts**

```ts
import { combatConfig } from '../../config/combatConfig'

export function mitigation(effDef: number): number {
  const k = combatConfig.defenseConstant
  return k / (k + Math.max(0, effDef))
}
export function basicAttackDamage(effAtk: number, effDef: number): number {
  return Math.max(1, Math.floor(effAtk * mitigation(effDef)))
}
export function skillMainDamage(effAtk: number, effDef: number, targetMultiplier: number): number {
  return Math.max(1, Math.floor(effAtk * targetMultiplier * mitigation(effDef)))
}
export function skillSplashDamage(effAtk: number, effDef: number, splashMultiplier: number): number {
  return Math.max(1, Math.floor(effAtk * splashMultiplier * mitigation(effDef)))
}
```

- [ ] **Step 7: Write targeting RED tests**

`src/game/combat/targeting.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { selectTarget, type CombatUnitState } from './targeting'

const u = (globalIndex: number, row: 'front' | 'back', alive: boolean): CombatUnitState => ({ globalIndex, row, side: 'enemy', hp: alive ? 10 : 0, alive })

it('prefers living front units by ascending globalIndex', () => {
  const defenders = [u(0, 'front', true), u(1, 'front', true), u(2, 'back', true)]
  expect(selectTarget(defenders)?.globalIndex).toBe(0)
})

it('falls back to back only when all front are dead', () => {
  const defenders = [u(0, 'front', false), u(1, 'front', false), u(2, 'back', true), u(3, 'back', true)]
  expect(selectTarget(defenders)?.globalIndex).toBe(2)
})

it('returns null when nothing is alive', () => {
  expect(selectTarget([u(0, 'front', false)])).toBeNull()
})
```

- [ ] **Step 8: Run targeting RED**

Run: `npm.cmd test -- src/game/combat/targeting.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 9: Implement targeting.ts**

```ts
import type { Row } from '../heroes'
export type Side = 'ally' | 'enemy'
export interface CombatUnitState { globalIndex: number; row: Row; side: Side; hp: number; alive: boolean }

export function selectTarget(defenders: readonly CombatUnitState[]): CombatUnitState | null {
  const alive = defenders.filter((d) => d.alive)
  if (alive.length === 0) return null
  const front = alive.filter((d) => d.row === 'front')
  const pool = front.length > 0 ? front : alive
  return pool.reduce((best, d) => (d.globalIndex < best.globalIndex ? d : best))
}
```

- [ ] **Step 10: Write engine determinism/outcome RED tests**

`src/game/combat/battleEngine.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { buildBattleInput, createBattleSeed, simulateBattle, type BattleInput } from './battleEngine'

function foremanVsStage1(): BattleInput {
  return buildBattleInput(1, [{ heroId: 'foreman', row: 'back', index: 1 }], { foreman: 1, anvil: 1, skyline: 1 }, 1)
}

it('is fully deterministic for identical input', () => {
  const input = foremanVsStage1()
  const a = simulateBattle(input)
  const b = simulateBattle(input)
  expect(a).toEqual(b)
  expect(a.timeline).toEqual(b.timeline)
})

it('never reads Math.random or Date.now (stable seed)', () => {
  const input = foremanVsStage1()
  expect(createBattleSeed({ stage: input.stage, allies: input.allies, enemies: input.enemies })).toBe(input.seed)
})

it('wins stage 1 with foreman and reports enemies-cleared', () => {
  const result = simulateBattle(foremanVsStage1())
  expect(result.outcome).toBe('victory')
  expect(result.reason).toBe('enemies-cleared')
  expect(result.alliesSurvived).toBeGreaterThanOrEqual(1)
  expect(result.endedAtTick).toBeLessThanOrEqual(600)
})

it('records tick snapshots with hits and a final death', () => {
  const result = simulateBattle(foremanVsStage1())
  expect(result.timeline.length).toBe(result.endedAtTick)
  expect(result.timeline.some((t) => t.hits.length > 0)).toBe(true)
  expect(result.timeline.some((t) => t.deaths.length > 0)).toBe(true)
})

it('times out to defeat when no side can kill (Lv1 vs Lv10 wall)', () => {
  const input = buildBattleInput(20, [{ heroId: 'foreman', row: 'back', index: 1 }], { foreman: 1, anvil: 1, skyline: 1 }, 1)
  const result = simulateBattle(input)
  expect(result.outcome).toBe('defeat')
  expect(['allies-defeated', 'timeout']).toContain(result.reason)
})

it('builds enemies by count and shared stage stats, filling front then back', () => {
  const input = buildBattleInput(8, [{ heroId: 'foreman', row: 'back', index: 1 }], { foreman: 1, anvil: 1, skyline: 1 }, 1)
  expect(input.enemies).toHaveLength(3) // getEnemyCount(8) === 3
  expect(input.enemies.map((e) => `${e.row}:${e.index}`)).toEqual(['front:0', 'front:1', 'back:0'])
})
```

补充确定性子测试：技能在 `initialCooldownTicks` 后释放（timeline 中出现 `kind:'skill-main'` 事件）、溅射作用于多敌（stage≥4 时同 tick 多 `skill-splash`）、并列目标按 `globalIndex` 升序、死亡当 tick 末统一移出目标池。

- [ ] **Step 11: Run engine RED**

Run: `npm.cmd test -- src/game/combat/battleEngine.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 12: Implement battleEngine.ts**

实现要点（严格按 §11.5/§11.6 顺序，纯函数、无 `Math.random`/`Date.now`）：

```ts
import { campaignConfig, getEnemyCount, getStage } from '../../config/campaignConfig'
import { combatConfig, type SkillConfig } from '../../config/combatConfig'
import { getHeroStats, type HeroId, type Row } from '../heroes'
import { heroesConfig } from '../../config/heroesConfig'
import { effectiveStats, globalIndexOf, type FormationAssignment } from './power'
import { basicAttackDamage, skillMainDamage, skillSplashDamage } from './damage'
import { selectTarget, type CombatUnitState, type Side } from './targeting'

export interface BattleUnitInput { side: Side; heroId?: HeroId; level: number; row: Row; index: number; hp: number; atk: number; def: number; skill: SkillConfig }
export interface BattleInput { stage: number; allies: BattleUnitInput[]; enemies: BattleUnitInput[]; seed: string }
export interface UnitSnapshot { side: Side; globalIndex: number; row: Row; hp: number; maxHp: number; cooldownRemaining: number; cooldownTotal: number; alive: boolean }
export interface HitEvent { attackerSide: Side; attackerGlobalIndex: number; targetSide: Side; targetGlobalIndex: number; amount: number; kind: 'basic' | 'skill-main' | 'skill-splash' }
export interface DeathEvent { side: Side; globalIndex: number }
export interface TickSnapshot { tick: number; units: UnitSnapshot[]; hits: HitEvent[]; deaths: DeathEvent[] }
export interface BattleResult { outcome: 'victory' | 'defeat'; endedAtTick: number; reason: 'enemies-cleared' | 'allies-defeated' | 'timeout'; timeline: TickSnapshot[]; alliesSurvived: number }

interface RuntimeUnit {
  input: BattleUnitInput; globalIndex: number; effAtk: number; effDef: number
  maxHp: number; hp: number; alive: boolean; cooldown: number; cooldownTotal: number
}

export function createBattleSeed(input: Omit<BattleInput, 'seed'>): string {
  const part = (u: BattleUnitInput) => `${u.side}:${u.heroId ?? 'enemy'}:${u.level}:${u.row}${u.index}`
  return `stage${input.stage}|${input.allies.map(part).join(',')}|${input.enemies.map(part).join(',')}`
}

const ENEMY_APPEARANCE_ROWS: ReadonlyArray<{ row: Row; index: number }> = [
  { row: 'front', index: 0 }, { row: 'front', index: 1 },
  { row: 'back', index: 0 }, { row: 'back', index: 1 }, { row: 'back', index: 2 },
]

export function buildBattleInput(stage: number, formation: FormationAssignment, heroLevels: Record<HeroId, number>, gangLevel: number): BattleInput {
  const stageConfig = getStage(stage)
  const allies: BattleUnitInput[] = formation.map((slot) => {
    const level = Math.max(1, Math.min(50, heroLevels[slot.heroId] ?? 1))
    const stats = getHeroStats(slot.heroId, level)
    return { side: 'ally', heroId: slot.heroId, level, row: slot.row, index: slot.index, hp: stats.hp, atk: stats.atk, def: stats.def, skill: heroesConfig.heroes[slot.heroId].skill }
  })
  const count = getEnemyCount(stage)
  const enemySkill: SkillConfig = { ...combatConfig.skillDefaults, cooldownTicks: combatConfig.enemySkillCooldownTicks }
  const enemies: BattleUnitInput[] = ENEMY_APPEARANCE_ROWS.slice(0, count).map((slot) => ({
    side: 'enemy', level: stageConfig.enemy.level, row: slot.row, index: slot.index,
    hp: stageConfig.enemy.hp, atk: stageConfig.enemy.atk, def: stageConfig.enemy.def, skill: enemySkill,
  }))
  const seed = createBattleSeed({ stage, allies, enemies })
  return { stage, allies, enemies, seed }
}

export function simulateBattle(input: BattleInput): BattleResult {
  const build = (u: BattleUnitInput): RuntimeUnit => {
    const eff = effectiveStats(u.row, { hp: u.hp, atk: u.atk, def: u.def })
    return { input: u, globalIndex: globalIndexOf(u.row, u.index), effAtk: eff.effAtk, effDef: eff.effDef, maxHp: eff.effHp, hp: eff.effHp, alive: true, cooldown: u.skill.initialCooldownTicks, cooldownTotal: u.skill.cooldownTicks }
  }
  const allies = input.allies.map(build)
  const enemies = input.enemies.map(build)
  const timeline: TickSnapshot[] = []
  const interval = combatConfig.attackIntervalTicks
  let outcome: BattleResult['outcome'] = 'defeat'
  let reason: BattleResult['reason'] = 'timeout'
  let endedAtTick = 0

  const defenderStates = (defenders: RuntimeUnit[]): CombatUnitState[] =>
    defenders.map((d) => ({ globalIndex: d.globalIndex, row: d.input.row, side: d.input.side, hp: d.hp, alive: d.alive }))

  for (let tick = 1; tick <= combatConfig.maxBattleTicks; tick += 1) {
    const hits: HitEvent[] = []
    const deaths: DeathEvent[] = []
    // 1. decrement cooldowns for living units
    for (const unit of [...allies, ...enemies]) if (unit.alive && unit.cooldown > 0) unit.cooldown -= 1
    // 2-3. resolve actions: allies (globalIndex asc) then enemies
    const actIn = (attackers: RuntimeUnit[], defenders: RuntimeUnit[], attackerSide: Side, defenderSide: Side) => {
      for (const attacker of [...attackers].sort((a, b) => a.globalIndex - b.globalIndex)) {
        if (!attacker.alive) continue
        const phase = attackerSide === 'ally' ? attacker.globalIndex % interval : (5 + attacker.globalIndex) % interval
        if (tick % interval !== phase) continue
        const target = selectTarget(defenderStates(defenders))
        if (!target) continue
        const targetUnit = defenders.find((d) => d.globalIndex === target.globalIndex && d.alive)
        if (!targetUnit) continue
        if (attacker.cooldown <= 0) {
          const main = skillMainDamage(attacker.effAtk, targetUnit.effDef, attacker.input.skill.targetMultiplier)
          targetUnit.hp -= main
          hits.push({ attackerSide, attackerGlobalIndex: attacker.globalIndex, targetSide: defenderSide, targetGlobalIndex: targetUnit.globalIndex, amount: main, kind: 'skill-main' })
          for (const other of defenders) {
            if (other === targetUnit || !other.alive) continue
            const splash = skillSplashDamage(attacker.effAtk, other.effDef, attacker.input.skill.splashMultiplier)
            other.hp -= splash
            hits.push({ attackerSide, attackerGlobalIndex: attacker.globalIndex, targetSide: defenderSide, targetGlobalIndex: other.globalIndex, amount: splash, kind: 'skill-splash' })
          }
          attacker.cooldown = attacker.cooldownTotal
        } else {
          const dmg = basicAttackDamage(attacker.effAtk, targetUnit.effDef)
          targetUnit.hp -= dmg
          hits.push({ attackerSide, attackerGlobalIndex: attacker.globalIndex, targetSide: defenderSide, targetGlobalIndex: targetUnit.globalIndex, amount: dmg, kind: 'basic' })
        }
      }
    }
    actIn(allies, enemies, 'ally', 'enemy')
    actIn(enemies, allies, 'enemy', 'ally')
    // 4. resolve deaths at tick end
    for (const unit of [...allies, ...enemies]) {
      if (unit.alive && unit.hp <= 0) { unit.alive = false; unit.hp = 0; deaths.push({ side: unit.input.side, globalIndex: unit.globalIndex }) }
    }
    // 5. snapshot
    const snapshot = (u: RuntimeUnit): UnitSnapshot => ({ side: u.input.side, globalIndex: u.globalIndex, row: u.input.row, hp: u.hp, maxHp: u.maxHp, cooldownRemaining: Math.max(0, u.cooldown), cooldownTotal: u.cooldownTotal, alive: u.alive })
    timeline.push({ tick, units: [...allies, ...enemies].map(snapshot), hits, deaths })
    // 6. outcome
    const alliesAlive = allies.some((u) => u.alive)
    const enemiesAlive = enemies.some((u) => u.alive)
    endedAtTick = tick
    if (!enemiesAlive && alliesAlive) { outcome = 'victory'; reason = 'enemies-cleared'; break }
    if (!alliesAlive) { outcome = 'defeat'; reason = 'allies-defeated'; break }
    if (tick >= combatConfig.maxBattleTicks) { outcome = 'defeat'; reason = 'timeout'; break }
  }
  return { outcome, endedAtTick, reason, timeline, alliesSurvived: allies.filter((u) => u.alive).length }
}
```

> 注：enemy skill cooldownTicks 用 `enemySkillCooldownTicks`，但 `initialCooldownTicks` 沿用 `skillDefaults.initialCooldownTicks`（敌方节奏靠更长的 `cooldownTicks` 落后于玩家）。

- [ ] **Step 13: Run GREEN and full task gate**

Run:

```powershell
npm.cmd test -- src/game/combat/power.test.ts src/game/combat/damage.test.ts src/game/combat/targeting.test.ts src/game/combat/battleEngine.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: 全部 exit 0；引擎多次调用结果完全一致，无 `Math.random`/`Date.now`（可用 `rg "Math.random|Date.now" src/game/combat` 断言无匹配）。

- [ ] **Step 14: Commit Task 2**

```powershell
git add src/game/combat/power.ts src/game/combat/power.test.ts src/game/combat/damage.ts src/game/combat/damage.test.ts src/game/combat/targeting.ts src/game/combat/targeting.test.ts src/game/combat/battleEngine.ts src/game/combat/battleEngine.test.ts
git commit -m "feat: add deterministic fixed-step battle engine"
```

## Task 3: Adventure Store (persist v1), Idle EXP, Hero Leveling, Formation, First-Clear, Reset Coordination

**Files:**

- Create: `src/store/adventureMigration.ts`
- Create: `src/store/adventureMigration.test.ts`
- Create: `src/store/useAdventureStore.ts`
- Create: `src/store/useAdventureStore.test.ts`
- Modify: `src/game/resetAccount.ts`
- Modify: `src/game/resetAccount.test.ts`

**Interfaces:**

- Consumes: `HERO_IDS`/`HeroId`/`isHeroId`（`heroes`）、`isHeroUnlocked`/`getHeroLevelCap`、`FormationAssignment`（`combat/power`）、`expToLevel`（`heroesConfig`）、`getFirstClearReward`/`isStageUnlocked`（`campaignConfig`）、`settleIdleExperience`（`idleExperienceConfig`）、`createSafeStorage`。
- Produces：

```ts
// src/store/adventureMigration.ts
export const ADVENTURE_STORAGE_KEY = 'dobe-adventure-progression-v1'
export interface AdventureDurableState {
  heroLevels: Record<HeroId, number>
  sharedExp: number
  formation: FormationAssignment
  highestClearedStage: number
  idleClock: number
}
export function createInitialAdventureState(now: number): AdventureDurableState
export function normalizeAdventureDurableState(value: unknown, now: number): AdventureDurableState
export function reconcileAdventureWithGang(state: AdventureDurableState, gangLevel: number): AdventureDurableState

// src/store/useAdventureStore.ts
export type UpgradeHeroResult = { applied: boolean; reason: 'ready' | 'hero-level-capped-by-gang' | 'hero-maxed' | 'insufficient-shared-exp' | 'invalid-request' }
interface AdventureState extends AdventureDurableState {
  claimIdleChest: (now: number) => number // returns earnedExp claimed
  upgradeHero: (heroId: string, gangLevel: number) => UpgradeHeroResult
  recordVictory: (stage: number, now: number) => { firstClear: boolean; rewardExp: number }
  setFormation: (formation: FormationAssignment, gangLevel: number) => boolean
  reconcileWithGang: (gangLevel: number) => void
  reset: (now?: number) => void
}
export const useAdventureStore: ...
export function getClaimableIdleExp(idleClock: number, highestClearedStage: number, now: number): number
```

- [ ] **Step 1: Write migration/normalization RED tests**

`src/store/adventureMigration.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { createInitialAdventureState, normalizeAdventureDurableState, reconcileAdventureWithGang } from './adventureMigration'

const NOW = 1_700_000_000_000

it('null persisted keeps initial state', () => {
  // merge path passes current when persisted == null; normalize is only for actual payloads
  expect(createInitialAdventureState(NOW)).toEqual({
    heroLevels: { foreman: 1, anvil: 1, skyline: 1 },
    sharedExp: 0,
    formation: [{ heroId: 'foreman', row: 'back', index: 1 }],
    highestClearedStage: 0,
    idleClock: NOW,
  })
})

it('clamps hero levels, drops unknown heroes, backfills missing', () => {
  const n = normalizeAdventureDurableState({ heroLevels: { foreman: 999, ghost: 5 }, sharedExp: -3, highestClearedStage: 99, idleClock: 'x', formation: [] }, NOW)
  expect(n.heroLevels).toEqual({ foreman: 50, anvil: 1, skyline: 1 })
  expect(n.sharedExp).toBe(0)
  expect(n.highestClearedStage).toBe(20)
  expect(n.idleClock).toBe(NOW)
  expect(n.formation).toEqual([{ heroId: 'foreman', row: 'back', index: 1 }]) // empty -> fallback
})

it('filters illegal formation slots, dedupes, caps to 5', () => {
  const n = normalizeAdventureDurableState({ heroLevels: {}, sharedExp: 0, highestClearedStage: 0, idleClock: NOW, formation: [
    { heroId: 'foreman', row: 'front', index: 0 },
    { heroId: 'foreman', row: 'back', index: 2 }, // duplicate hero -> dropped
    { heroId: 'anvil', row: 'front', index: 0 }, // duplicate slot -> dropped
    { heroId: 'skyline', row: 'back', index: 9 }, // illegal index -> dropped
    { heroId: 'ghost', row: 'back', index: 1 }, // illegal hero -> dropped
  ] }, NOW)
  expect(n.formation).toEqual([{ heroId: 'foreman', row: 'front', index: 0 }])
})

it('reconciles hero levels and formation against gang level', () => {
  const state = { heroLevels: { foreman: 40, anvil: 30, skyline: 20 }, sharedExp: 0, highestClearedStage: 0, idleClock: NOW, formation: [{ heroId: 'anvil', row: 'front', index: 0 }] }
  const reconciled = reconcileAdventureWithGang(state, 12)
  expect(reconciled.heroLevels.foreman).toBe(12)
  expect(reconciled.heroLevels.skyline).toBe(12)
  // skyline unlock 28 > 12 -> not unlocked; anvil unlock 12 <= 12 -> stays; formation kept
  expect(reconciled.formation).toEqual([{ heroId: 'anvil', row: 'front', index: 0 }])
})

it('drops unlocked heroes from formation and falls back when empty', () => {
  const state = { heroLevels: { foreman: 1, anvil: 1, skyline: 1 }, sharedExp: 0, highestClearedStage: 0, idleClock: NOW, formation: [{ heroId: 'skyline', row: 'back', index: 0 }] }
  const reconciled = reconcileAdventureWithGang(state, 1) // skyline locked at gang 1
  expect(reconciled.formation).toEqual([{ heroId: 'foreman', row: 'back', index: 1 }])
})
```

- [ ] **Step 2: Run migration RED**

Run: `npm.cmd test -- src/store/adventureMigration.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: Implement adventureMigration.ts**

```ts
import { HERO_IDS, isHeroId, isHeroUnlocked, type HeroId } from '../game/heroes'
import type { FormationAssignment } from '../game/combat/power'

export const ADVENTURE_STORAGE_KEY = 'dobe-adventure-progression-v1'
export interface AdventureDurableState {
  heroLevels: Record<HeroId, number>
  sharedExp: number
  formation: FormationAssignment
  highestClearedStage: number
  idleClock: number
}
const DEFAULT_FORMATION: FormationAssignment = [{ heroId: 'foreman', row: 'back', index: 1 }]
function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v) }
function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(v)))
}
const MAX_INDEX_BY_ROW = { front: 1, back: 2 } as const

export function createInitialAdventureState(now: number): AdventureDurableState {
  return { heroLevels: { foreman: 1, anvil: 1, skyline: 1 }, sharedExp: 0, formation: DEFAULT_FORMATION.map((s) => ({ ...s })), highestClearedStage: 0, idleClock: Number.isFinite(now) ? now : Date.now() }
}

function normalizeFormation(value: unknown): FormationAssignment {
  if (!Array.isArray(value)) return DEFAULT_FORMATION.map((s) => ({ ...s }))
  const seenHeroes = new Set<string>()
  const seenSlots = new Set<string>()
  const result: FormationAssignment = []
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.heroId !== 'string' || !isHeroId(raw.heroId)) continue
    const row = raw.row
    if (row !== 'front' && row !== 'back') continue
    const index = raw.index
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > MAX_INDEX_BY_ROW[row]) continue
    const slotKey = `${row}:${index}`
    if (seenHeroes.has(raw.heroId) || seenSlots.has(slotKey)) continue
    if (result.length >= 5) break
    seenHeroes.add(raw.heroId)
    seenSlots.add(slotKey)
    result.push({ heroId: raw.heroId, row, index })
  }
  return result.length === 0 ? DEFAULT_FORMATION.map((s) => ({ ...s })) : result
}

export function normalizeAdventureDurableState(value: unknown, now: number): AdventureDurableState {
  const src = isRecord(value) ? value : {}
  const levelsSrc = isRecord(src.heroLevels) ? src.heroLevels : {}
  const heroLevels = {} as Record<HeroId, number>
  for (const id of HERO_IDS) heroLevels[id] = clampInt(levelsSrc[id], 1, 50, 1)
  return {
    heroLevels,
    sharedExp: clampInt(src.sharedExp, 0, Number.MAX_SAFE_INTEGER, 0),
    formation: normalizeFormation(src.formation),
    highestClearedStage: clampInt(src.highestClearedStage, 0, 20, 0),
    idleClock: typeof src.idleClock === 'number' && Number.isFinite(src.idleClock) ? src.idleClock : (Number.isFinite(now) ? now : Date.now()),
  }
}

export function reconcileAdventureWithGang(state: AdventureDurableState, gangLevel: number): AdventureDurableState {
  const cap = Math.min(50, Math.max(1, Math.floor(Number.isFinite(gangLevel) ? gangLevel : 1)))
  const heroLevels = {} as Record<HeroId, number>
  for (const id of HERO_IDS) heroLevels[id] = Math.min(state.heroLevels[id] ?? 1, cap)
  const formation = state.formation.filter((slot) => isHeroUnlocked(slot.heroId, gangLevel))
  return { ...state, heroLevels, formation: formation.length === 0 ? DEFAULT_FORMATION.map((s) => ({ ...s })) : formation }
}
```

- [ ] **Step 4: Write store transaction RED tests**

`src/store/useAdventureStore.test.ts`（覆盖初始态、领取宝箱余量、升级英雄 cap/经验/原子、首通单事务、阵容校验、reconcile、reset）：

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAdventureStore, getClaimableIdleExp } from './useAdventureStore'

const NOW = 1_700_000_000_000
beforeEach(() => { window.localStorage.clear(); useAdventureStore.getState().reset(NOW) })
afterEach(() => { window.localStorage.clear(); useAdventureStore.getState().reset(NOW) })

it('starts at documented initial state', () => {
  const s = useAdventureStore.getState()
  expect(s.sharedExp).toBe(0)
  expect(s.highestClearedStage).toBe(0)
  expect(s.formation).toEqual([{ heroId: 'foreman', row: 'back', index: 1 }])
})

it('claim idle chest settles, adds to pool, keeps remainder', () => {
  useAdventureStore.setState({ highestClearedStage: 1, idleClock: NOW })
  const claimed = useAdventureStore.getState().claimIdleChest(NOW + 25_000)
  expect(claimed).toBe(4) // 2 ticks * rate 2
  expect(useAdventureStore.getState().sharedExp).toBe(4)
  expect(useAdventureStore.getState().idleClock).toBe(NOW + 20_000)
})

it('upgrade hero blocks by gang cap then by exp then applies atomically', () => {
  useAdventureStore.setState({ sharedExp: 1_000, heroLevels: { foreman: 12, anvil: 1, skyline: 1 } })
  expect(useAdventureStore.getState().upgradeHero('foreman', 12)).toEqual({ applied: false, reason: 'hero-level-capped-by-gang' })
  useAdventureStore.setState({ sharedExp: 50, heroLevels: { foreman: 1, anvil: 1, skyline: 1 } })
  expect(useAdventureStore.getState().upgradeHero('foreman', 50)).toEqual({ applied: false, reason: 'insufficient-shared-exp' })
  useAdventureStore.setState({ sharedExp: 100 })
  expect(useAdventureStore.getState().upgradeHero('foreman', 50)).toEqual({ applied: true, reason: 'ready' })
  expect(useAdventureStore.getState().heroLevels.foreman).toBe(2)
  expect(useAdventureStore.getState().sharedExp).toBe(0) // 100 - expToLevel(1)=100
})

it('records first clear in one transaction and initializes idle clock', () => {
  const r = useAdventureStore.getState().recordVictory(1, NOW + 5_000)
  expect(r).toEqual({ firstClear: true, rewardExp: 500 })
  expect(useAdventureStore.getState().highestClearedStage).toBe(1)
  expect(useAdventureStore.getState().sharedExp).toBe(500)
  expect(useAdventureStore.getState().idleClock).toBe(NOW + 5_000)
  // replay already-cleared stage: no reward, no highest change
  const again = useAdventureStore.getState().recordVictory(1, NOW + 6_000)
  expect(again).toEqual({ firstClear: false, rewardExp: 0 })
  expect(useAdventureStore.getState().sharedExp).toBe(500)
})

it('rejects an out-of-order victory', () => {
  const r = useAdventureStore.getState().recordVictory(3, NOW)
  expect(r).toEqual({ firstClear: false, rewardExp: 0 })
  expect(useAdventureStore.getState().highestClearedStage).toBe(0)
})

it('validates formation before applying and reconciles with gang', () => {
  expect(useAdventureStore.getState().setFormation([{ heroId: 'skyline', row: 'back', index: 0 }], 1)).toBe(false) // skyline locked
  expect(useAdventureStore.getState().setFormation([{ heroId: 'foreman', row: 'front', index: 0 }], 1)).toBe(true)
  useAdventureStore.setState({ heroLevels: { foreman: 40, anvil: 40, skyline: 40 } })
  useAdventureStore.getState().reconcileWithGang(12)
  expect(useAdventureStore.getState().heroLevels.foreman).toBe(12)
})
```

- [ ] **Step 5: Run store RED**

Run: `npm.cmd test -- src/store/useAdventureStore.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 6: Implement useAdventureStore.ts**

```ts
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { expToLevel } from '../config/heroesConfig'
import { getFirstClearReward, isStageUnlocked } from '../config/campaignConfig'
import { settleIdleExperience } from '../config/idleExperienceConfig'
import { getHeroLevelCap, isHeroId, isHeroUnlocked, type HeroId } from '../game/heroes'
import type { FormationAssignment } from '../game/combat/power'
import { createSafeStorage } from './safeStorage'
import { ADVENTURE_STORAGE_KEY, createInitialAdventureState, normalizeAdventureDurableState, reconcileAdventureWithGang, type AdventureDurableState } from './adventureMigration'

export type UpgradeHeroResult = { applied: boolean; reason: 'ready' | 'hero-level-capped-by-gang' | 'hero-maxed' | 'insufficient-shared-exp' | 'invalid-request' }

export function getClaimableIdleExp(idleClock: number, highestClearedStage: number, now: number): number {
  return settleIdleExperience({ lastUpdatedAt: idleClock, now, highestClearedStage }).earnedExp
}

// AdventureState extends AdventureDurableState with actions (see Interfaces)
function isValidFormation(formation: FormationAssignment, gangLevel: number): boolean {
  if (formation.length < 1 || formation.length > 5) return false
  const heroes = new Set<string>()
  const slots = new Set<string>()
  for (const s of formation) {
    if (!isHeroId(s.heroId) || !isHeroUnlocked(s.heroId, gangLevel)) return false
    const maxIndex = s.row === 'front' ? 1 : 2
    if (s.index < 0 || s.index > maxIndex) return false
    if (heroes.has(s.heroId) || slots.has(`${s.row}:${s.index}`)) return false
    heroes.add(s.heroId); slots.add(`${s.row}:${s.index}`)
  }
  return true
}

export const useAdventureStore = create<AdventureState>()(
  persist(
    (set, get) => ({
      ...createInitialAdventureState(Date.now()),
      claimIdleChest: (now) => {
        let claimed = 0
        set((state) => {
          const settlement = settleIdleExperience({ lastUpdatedAt: state.idleClock, now, highestClearedStage: state.highestClearedStage })
          if (settlement.earnedExp <= 0) return state
          claimed = settlement.earnedExp
          return { sharedExp: Math.min(Number.MAX_SAFE_INTEGER, state.sharedExp + settlement.earnedExp), idleClock: settlement.nextUpdatedAt }
        })
        return claimed
      },
      upgradeHero: (heroId, gangLevel) => {
        if (!isHeroId(heroId)) return { applied: false, reason: 'invalid-request' }
        let result: UpgradeHeroResult = { applied: false, reason: 'invalid-request' }
        set((state) => {
          const level = state.heroLevels[heroId]
          const cap = getHeroLevelCap(gangLevel)
          if (level >= 50) { result = { applied: false, reason: 'hero-maxed' }; return state }
          if (level >= cap) { result = { applied: false, reason: 'hero-level-capped-by-gang' }; return state }
          const cost = expToLevel(level)
          if (state.sharedExp < cost) { result = { applied: false, reason: 'insufficient-shared-exp' }; return state }
          result = { applied: true, reason: 'ready' }
          return { sharedExp: state.sharedExp - cost, heroLevels: { ...state.heroLevels, [heroId]: level + 1 } }
        })
        return result
      },
      recordVictory: (stage, now) => {
        let outcome = { firstClear: false, rewardExp: 0 }
        set((state) => {
          if (stage !== state.highestClearedStage + 1) return state
          if (!isStageUnlocked(stage, state.highestClearedStage)) return state
          const reward = getFirstClearReward(stage)
          const idleWasClosed = state.highestClearedStage < 1
          outcome = { firstClear: true, rewardExp: reward }
          return {
            highestClearedStage: stage,
            sharedExp: Math.min(Number.MAX_SAFE_INTEGER, state.sharedExp + reward),
            idleClock: idleWasClosed && Number.isFinite(now) ? now : state.idleClock,
          }
        })
        return outcome
      },
      setFormation: (formation, gangLevel) => {
        if (!isValidFormation(formation, gangLevel)) return false
        set({ formation: formation.map((s) => ({ ...s })) })
        return true
      },
      reconcileWithGang: (gangLevel) => set((state) => reconcileAdventureWithGang(state, gangLevel)),
      reset: (now = Date.now()) => set(createInitialAdventureState(now)),
    }),
    {
      name: ADVENTURE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (_persisted, _version) => undefined, // v<1 -> merge normalizes; keep simple
      partialize: ({ heroLevels, sharedExp, formation, highestClearedStage, idleClock }) => ({ heroLevels, sharedExp, formation, highestClearedStage, idleClock }),
      merge: (persisted, current) => persisted == null ? current : { ...current, ...normalizeAdventureDurableState(persisted, Date.now()) },
    },
  ),
)
```

> `AdventureState` 类型为 `AdventureDurableState & { 上述 actions }`；把该接口定义写在文件顶部。`migrate` 返回 `undefined` 时 zustand 会把 `undefined` 传给 `merge`，此时 `persisted==null` 分支返回初始 `current`（即坏/旧版本存档回到初始态，符合 §7.6「v<1 一律规范化为初始态」）。

- [ ] **Step 7: Write resetAccount three-store RED test**

在 `src/game/resetAccount.test.ts` 追加：

```ts
import { useAdventureStore } from '../store/useAdventureStore'

it('resets the adventure store alongside city and gang', () => {
  useAdventureStore.setState({ sharedExp: 999, highestClearedStage: 5, heroLevels: { foreman: 20, anvil: 10, skyline: 5 } })
  resetAccount(RESET_TIME)
  expect(useAdventureStore.getState().sharedExp).toBe(0)
  expect(useAdventureStore.getState().highestClearedStage).toBe(0)
  expect(useAdventureStore.getState().idleClock).toBe(RESET_TIME)
  expect(useAdventureStore.getState().formation).toEqual([{ heroId: 'foreman', row: 'back', index: 1 }])
})
```

- [ ] **Step 8: Run resetAccount RED**

Run: `npm.cmd test -- src/game/resetAccount.test.ts`
Expected: FAIL，`resetAccount` 尚未协调 adventure store。

- [ ] **Step 9: Implement resetAccount three-store coordination**

```ts
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { useAdventureStore } from '../store/useAdventureStore'

export function resetAccount(now: number = Date.now()): void {
  const resetTime = Number.isFinite(now) ? now : Date.now()
  useCityStore.getState().reset(resetTime)
  useGangStore.getState().reset(resetTime)
  useAdventureStore.getState().reset(resetTime)
}
```

- [ ] **Step 10: Run GREEN and full task gate**

Run:

```powershell
npm.cmd test -- src/store/adventureMigration.test.ts src/store/useAdventureStore.test.ts src/game/resetAccount.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: 全部 exit 0；持久 JSON 仅含 5 个 durable 字段。

- [ ] **Step 11: Commit Task 3**

```powershell
git add src/store/adventureMigration.ts src/store/adventureMigration.test.ts src/store/useAdventureStore.ts src/store/useAdventureStore.test.ts src/game/resetAccount.ts src/game/resetAccount.test.ts
git commit -m "feat: add adventure store with idle exp, hero leveling, and reset coordination"
```

## Task 4: Standalone Hero / Gang Tree / Global HUD UI Components

**Files:**

- Create: `src/ui/GlobalHud.tsx`
- Create: `src/ui/GlobalHud.test.tsx`
- Create: `src/ui/HeroesPanel.tsx`
- Create: `src/ui/HeroesPanel.test.tsx`
- Create: `src/ui/redDots.ts`
- Create: `src/ui/redDots.test.ts`
- Modify: `src/ui/GangTreePanel.tsx`
- Modify: `src/ui/GangTreePanel.test.tsx`
- Modify: `src/App.css`

**Interfaces:**

- Consumes: `useCityStore`/`useGangStore`/`useAdventureStore`、`getGangLevel`/`getGangRole`/`getLevelProgress`（`gangProgression`）、`getHeroStats`/`getHeroLevelCap`/`isHeroUnlocked`/`HERO_IDS`、`heroesConfig`、`expToLevel`、`getClaimableIdleExp`、`isStageUnlocked`、`PROGRESSION_UNLOCKS`。
- 这些组件都是 **standalone**（用 props 回调 + store hooks），Task 6 才由 `App.tsx` 挂载。Task 4 不改 `App.tsx`。
- Produces：

```ts
// src/ui/redDots.ts
export type BottomNavEntry = 'adventure' | 'heroes' | 'settings'
export function hasAdventureRedDot(highestClearedStage: number, claimableChestExp: number): boolean
export function hasHeroesRedDot(heroLevels: Record<HeroId, number>, sharedExp: number, gangLevel: number): boolean
export function hasRedDot(entry: BottomNavEntry, input: { highestClearedStage: number; claimableChestExp: number; heroLevels: Record<HeroId, number>; sharedExp: number; gangLevel: number }): boolean

// src/ui/GlobalHud.tsx
export interface GlobalHudProps {
  onOpenHeroes: () => void
  onOpenGangTree: () => void
  onOpenAdventure: () => void
  onOpenSettings: () => void
}
export function GlobalHud(props: GlobalHudProps): JSX.Element

// src/ui/HeroesPanel.tsx
export interface HeroesPanelProps { onClose: () => void }
export function HeroesPanel(props: HeroesPanelProps): JSX.Element
```

- [ ] **Step 1: Write red-dot RED tests**

`src/ui/redDots.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { hasAdventureRedDot, hasHeroesRedDot } from './redDots'

it('adventure dot when a new stage is challengeable or chest has exp', () => {
  expect(hasAdventureRedDot(0, 0)).toBe(true) // stage 1 challengeable
  expect(hasAdventureRedDot(20, 0)).toBe(false) // all cleared, empty chest
  expect(hasAdventureRedDot(20, 5)).toBe(true) // chest claimable
})

it('heroes dot when any unlocked hero can level up with available exp', () => {
  // foreman Lv1 cost expToLevel(1)=100; cap min(50,gang)
  expect(hasHeroesRedDot({ foreman: 1, anvil: 1, skyline: 1 }, 100, 1)).toBe(false) // cap 1 blocks
  expect(hasHeroesRedDot({ foreman: 1, anvil: 1, skyline: 1 }, 99, 2)).toBe(false)
  expect(hasHeroesRedDot({ foreman: 1, anvil: 1, skyline: 1 }, 100, 2)).toBe(true) // cap 2 allows foreman
})
```

- [ ] **Step 2: Run red-dot RED**

Run: `npm.cmd test -- src/ui/redDots.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: Implement redDots.ts**

```ts
import { expToLevel } from '../config/heroesConfig'
import { isStageUnlocked } from '../config/campaignConfig'
import { getHeroLevelCap, isHeroUnlocked, HERO_IDS, type HeroId } from '../game/heroes'

export type BottomNavEntry = 'adventure' | 'heroes' | 'settings'

export function hasAdventureRedDot(highestClearedStage: number, claimableChestExp: number): boolean {
  const nextStage = highestClearedStage + 1
  const newStage = highestClearedStage < 20 && isStageUnlocked(nextStage, highestClearedStage)
  return newStage || claimableChestExp > 0
}

export function hasHeroesRedDot(heroLevels: Record<HeroId, number>, sharedExp: number, gangLevel: number): boolean {
  const cap = getHeroLevelCap(gangLevel)
  return HERO_IDS.some((id) => {
    if (!isHeroUnlocked(id, gangLevel)) return false
    const level = heroLevels[id] ?? 1
    return level < cap && level < 50 && sharedExp >= expToLevel(level)
  })
}

export function hasRedDot(entry: BottomNavEntry, input: { highestClearedStage: number; claimableChestExp: number; heroLevels: Record<HeroId, number>; sharedExp: number; gangLevel: number }): boolean {
  if (entry === 'adventure') return hasAdventureRedDot(input.highestClearedStage, input.claimableChestExp)
  if (entry === 'heroes') return hasHeroesRedDot(input.heroLevels, input.sharedExp, input.gangLevel)
  return false
}
```

- [ ] **Step 4: Write GlobalHud RED tests**

`src/ui/GlobalHud.test.tsx`（顶部头像+帮派入口含等级/职位+四资源条；底部三导航含红点；`aria-label`）：

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GlobalHud } from './GlobalHud'
import { useGangStore } from '../store/useGangStore'
import { useAdventureStore } from '../store/useAdventureStore'

beforeEach(() => { useGangStore.getState().reset(0); useAdventureStore.getState().reset(0) })

it('renders four resource readouts including shared hero exp', () => {
  render(<GlobalHud onOpenHeroes={() => {}} onOpenGangTree={() => {}} onOpenAdventure={() => {}} onOpenSettings={() => {}} />)
  expect(screen.getByLabelText('资源')).toBeInTheDocument()
  expect(screen.getByText(/英雄经验/)).toBeInTheDocument()
})

it('shows gang level and role in the gang entry', () => {
  useGangStore.setState({ totalReputation: 330, lastUpdatedAt: 0 }) // Lv12
  render(<GlobalHud onOpenHeroes={() => {}} onOpenGangTree={() => {}} onOpenAdventure={() => {}} onOpenSettings={() => {}} />)
  expect(screen.getByRole('button', { name: /Full Patch/ })).toBeInTheDocument()
})

it('routes bottom nav callbacks', async () => {
  const onOpenAdventure = vi.fn()
  render(<GlobalHud onOpenHeroes={() => {}} onOpenGangTree={() => {}} onOpenAdventure={onOpenAdventure} onOpenSettings={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /推关/ }))
  expect(onOpenAdventure).toHaveBeenCalled()
})

it('shows the adventure red dot for a fresh account', () => {
  render(<GlobalHud onOpenHeroes={() => {}} onOpenGangTree={() => {}} onOpenAdventure={() => {}} onOpenSettings={() => {}} />)
  expect(screen.getByLabelText('有可挑战关卡或可领取宝箱')).toBeInTheDocument()
})
```

- [ ] **Step 5: Run GlobalHud RED**

Run: `npm.cmd test -- src/ui/GlobalHud.test.tsx`
Expected: FAIL，组件不存在。

- [ ] **Step 6: Implement GlobalHud.tsx**

顶部区：玩家头像按钮（`onOpenHeroes`，`aria-label="打开英雄培养"`）、帮派入口按钮（文案 `Lv.${level} ${role.title}（${role.chineseTitle}）`，`onOpenGangTree`）、资源条（钱/油/物资沿用 `getCurrentProductionRates` 展示每 10 秒产量；英雄经验展示 `sharedExp` 余额与「可领 N」宝箱增量提示，用 `getClaimableIdleExp(idleClock, highestClearedStage, Date.now())`）。底部三导航按钮（推关/英雄/设置）各绑定回调；红点按 `hasRedDot` 派生，用 `<span aria-label="有可挑战关卡或可领取宝箱" />` 与 `<span aria-label="有可升级英雄" />`。所有交互按钮 `type="button"`，热区 ≥44px（CSS）。四资源容器 `aria-label="资源"`。

```tsx
import type { JSX } from 'react'
import { getGangLevel, getGangRole } from '../game/gangProgression'
import { getCurrentProductionRates } from '../game/resourceEconomy'
import { getClaimableIdleExp } from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { useAdventureStore } from '../store/useAdventureStore'
import { hasAdventureRedDot, hasHeroesRedDot } from './redDots'
export interface GlobalHudProps {
  onOpenHeroes: () => void
  onOpenGangTree: () => void
  onOpenAdventure: () => void
  onOpenSettings: () => void
}
export function GlobalHud(props: GlobalHudProps): JSX.Element {
  const resources = useCityStore((s) => s.resources)
  const buildingProgress = useCityStore((s) => s.buildingProgress)
  const activeProducerIds = useCityStore((s) => s.activeProducerIds)
  const totalReputation = useGangStore((s) => s.totalReputation)
  const heroLevels = useAdventureStore((s) => s.heroLevels)
  const sharedExp = useAdventureStore((s) => s.sharedExp)
  const highestClearedStage = useAdventureStore((s) => s.highestClearedStage)
  const idleClock = useAdventureStore((s) => s.idleClock)
  const gangLevel = getGangLevel(totalReputation)
  const role = getGangRole(gangLevel)
  const rates = getCurrentProductionRates(buildingProgress, activeProducerIds)
  const claimable = getClaimableIdleExp(idleClock, highestClearedStage, Date.now())
  const adventureDot = hasAdventureRedDot(highestClearedStage, claimable)
  const heroesDot = hasHeroesRedDot(heroLevels, sharedExp, gangLevel)
  return (
    <section className="global-hud" aria-label="主界面 HUD">
      <div className="global-hud__top">
        <button type="button" aria-label="打开英雄培养" onClick={props.onOpenHeroes}>玩家</button>
        <button type="button" onClick={props.onOpenGangTree}>
          Lv.{gangLevel} {role.title}（{role.chineseTitle}）
        </button>
        <div className="global-hud__resources" aria-label="资源">
          <span>钱 {resources.money} +{rates.money}/10秒</span>
          <span>油 {resources.oil} +{rates.oil}/10秒</span>
          <span>物资 {resources.materials} +{rates.materials}/10秒</span>
          <span>英雄经验 {sharedExp} · 可领 {claimable}</span>
        </div>
      </div>
      <nav className="global-hud__bottom" aria-label="主导航">
        <button type="button" onClick={props.onOpenAdventure}>
          推关{adventureDot && <span aria-label="有可挑战关卡或可领取宝箱" />}
        </button>
        <button type="button" onClick={props.onOpenHeroes}>
          英雄{heroesDot && <span aria-label="有可升级英雄" />}
        </button>
        <button type="button" onClick={props.onOpenSettings}>设置</button>
      </nav>
    </section>
  )
}
```

- [ ] **Step 7: Write HeroesPanel RED tests**

`src/ui/HeroesPanel.test.tsx`（多英雄培养、统一树节点信息、未解锁锁定态、升级消耗共享经验、cap 文案、`role="dialog"`/`aria-live` toast、响应式无溢出）：

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { HeroesPanel } from './HeroesPanel'
import { useGangStore } from '../store/useGangStore'
import { useAdventureStore } from '../store/useAdventureStore'

beforeEach(() => { useGangStore.getState().reset(0); useAdventureStore.getState().reset(0) })

it('lists all three heroes, locking those above gang level', () => {
  render(<HeroesPanel onClose={() => {}} />)
  expect(screen.getByText(/陈锤/)).toBeInTheDocument()
  expect(screen.getByText(/岳峰/)).toBeInTheDocument()
  expect(screen.getByText(/帮派 Lv.12 解锁/)).toBeInTheDocument() // anvil locked at gang 1
})

it('upgrades foreman spending shared exp when cap allows', async () => {
  useGangStore.setState({ totalReputation: 60, lastUpdatedAt: 0 }) // Lv3 cap
  useAdventureStore.setState({ sharedExp: 100 })
  render(<HeroesPanel onClose={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /升级 陈锤/ }))
  expect(useAdventureStore.getState().heroLevels.foreman).toBe(2)
  expect(screen.getByRole('status')).toHaveTextContent(/升级|经验/)
})

it('blocks and explains gang cap', async () => {
  useAdventureStore.setState({ sharedExp: 100 }) // gang Lv1 -> cap 1 blocks
  render(<HeroesPanel onClose={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /升级 陈锤/ }))
  expect(screen.getByRole('status')).toHaveTextContent(/不能超过帮派等级/)
})
```

- [ ] **Step 8: Run HeroesPanel RED**

Run: `npm.cmd test -- src/ui/HeroesPanel.test.tsx`
Expected: FAIL，组件不存在。

- [ ] **Step 9: Implement HeroesPanel.tsx**

对每个 `HERO_IDS`：读 `heroesConfig.heroes[id]`（name/alias/role/skill/appearance 摘要）、`heroLevels[id]`、`getHeroStats(id, level)`、`getHeroLevelCap(gangLevel)`、`isHeroUnlocked`。未解锁英雄展示锁定态文案 `帮派 Lv.${heroUnlockLevel(id)} 解锁`，不渲染升级按钮。已解锁英雄渲染 `升级 ${name}` 按钮（`type="button"`），点击调用 `useAdventureStore.getState().upgradeHero(id, gangLevel)`，按返回 `reason` 设置 `role="status" aria-live="polite"` 文案：`ready→已升级 ${name} 至 Lv.${level+1}`、`hero-level-capped-by-gang→英雄等级不能超过帮派等级`、`hero-maxed→已达到最高等级 Lv.50`、`insufficient-shared-exp→英雄经验不足，还需 ${expToLevel(level)-sharedExp}`。展示当前 `sharedExp`。面板 `role="dialog" aria-modal="true"`，含关闭按钮（`onClose`）、`Escape` 关闭、pointer stopPropagation（沿用 `SettingsPanel`/`GangTreePanel` 模式）。

- [ ] **Step 10: Update GangTreePanel to render unified unlocks**

把 `GangTreePanel.tsx` 的 `BUILDING_UNLOCK_BY_LEVEL` 换为按 `PROGRESSION_UNLOCKS` 分组的 `Map<number, ProgressionUnlock[]>`，同级多解锁并列展示（建筑用 `buildingCatalogById[id].name`；英雄用 `heroesConfig.heroes[heroId]` 的 `名·绰号`；feature 用中文 `战役`/`英雄`）。RED 先加断言：

```tsx
it('renders multiple unlocks on a single level node', () => {
  useGangStore.setState({ totalReputation: 1470, lastUpdatedAt: 0 }) // Lv50 all unlocked
  render(<GangTreePanel open onClose={() => {}} />)
  const lv1 = screen.getByText('等级 1').closest('li') as HTMLElement
  expect(lv1).toHaveTextContent('修车厂')
  expect(lv1).toHaveTextContent('战役')
  expect(lv1).toHaveTextContent('英雄')
  expect(lv1).toHaveTextContent('陈锤')
  const lv12 = screen.getByText('等级 12').closest('li') as HTMLElement
  expect(lv12).toHaveTextContent('岳峰')
})
```

实现映射每个 unlock 的展示文本与已解锁/待解锁状态（`state !== 'locked'`）。

- [ ] **Step 11: Run GangTreePanel RED then implement**

Run: `npm.cmd test -- src/ui/GangTreePanel.test.tsx`
Expected: FAIL（同级多解锁尚未渲染）→ 实现后 GREEN。

- [ ] **Step 12: Add responsive/a11y CSS**

在 `src/App.css` 新增 `.global-hud`、`.heroes-panel` 样式：移动优先 390×844，底部导航固定、顶部条 flex、无横向溢出、可纵向滚动、按钮 ≥44×44、红点用形状+`aria-label`不仅靠颜色、焦点环可见、`prefers-reduced-motion` 禁用过渡。

- [ ] **Step 13: Run GREEN and full task gate**

Run:

```powershell
npm.cmd test -- src/ui/redDots.test.ts src/ui/GlobalHud.test.tsx src/ui/HeroesPanel.test.tsx src/ui/GangTreePanel.test.tsx
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: 全部 exit 0；`App.tsx` 未改动仍可运行。

- [ ] **Step 14: Commit Task 4**

```powershell
git add src/ui/redDots.ts src/ui/redDots.test.ts src/ui/GlobalHud.tsx src/ui/GlobalHud.test.tsx src/ui/HeroesPanel.tsx src/ui/HeroesPanel.test.tsx src/ui/GangTreePanel.tsx src/ui/GangTreePanel.test.tsx src/App.css
git commit -m "feat: add standalone global HUD, heroes panel, and unified gang tree"
```

## Task 5: Standalone Campaign / StageMap / Formation / IdleChest Components

**Files:**

- Create: `src/ui/AdventurePanel.tsx`
- Create: `src/ui/AdventurePanel.test.tsx`
- Create: `src/ui/FormationPanel.tsx`
- Create: `src/ui/FormationPanel.test.tsx`
- Modify: `src/App.css`

**Interfaces:**

- Consumes: `campaignConfig`/`getStage`/`isStageUnlocked`、`useAdventureStore`/`getClaimableIdleExp`、`useGangStore`/`getGangLevel`、`buildBattleInput`/`teamPower`/`getHeroStats`、`isHeroUnlocked`/`getHeroLevelCap`、`heroesConfig`。
- Standalone；Task 6 才由 `App.tsx` 挂载并把「挑战」连到 `battle` overlay。
- Produces：

```ts
// src/ui/AdventurePanel.tsx
export interface AdventurePanelProps {
  onClose: () => void
  onChallenge: (stage: number) => void // opens formation/battle flow (wired in Task 6)
}
export function AdventurePanel(props: AdventurePanelProps): JSX.Element

// src/ui/FormationPanel.tsx
export interface FormationPanelProps {
  stage: number
  onCancel: () => void
  onStart: (stage: number) => void // Task 6 builds BattleInput + opens battle
}
export function FormationPanel(props: FormationPanelProps): JSX.Element
export function computeTeamPowerForFormation(formation: FormationAssignment, heroLevels: Record<HeroId, number>): number
export function computeEnemyPowerForStage(stage: number): number
```

- [ ] **Step 1: Write AdventurePanel RED tests**

`src/ui/AdventurePanel.test.tsx`（2 章 20 关节点、章内 `x-y` 编号、选关只允许已解锁、锁定关禁用、底部挂机宝箱领取）：

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdventurePanel } from './AdventurePanel'
import { useAdventureStore } from '../store/useAdventureStore'

beforeEach(() => { useAdventureStore.getState().reset(0) })

it('renders 20 stage nodes across two chapters', () => {
  render(<AdventurePanel onClose={() => {}} onChallenge={() => {}} />)
  expect(screen.getByRole('button', { name: /1-1/ })).toBeEnabled()
  expect(screen.getByRole('button', { name: /2-10/ })).toBeDisabled() // locked
})

it('only allows challenging unlocked stages', async () => {
  const onChallenge = vi.fn()
  useAdventureStore.setState({ highestClearedStage: 2 })
  render(<AdventurePanel onClose={() => {}} onChallenge={onChallenge} />)
  await userEvent.click(screen.getByRole('button', { name: /1-3/ })) // next stage unlocked
  await userEvent.click(screen.getByRole('button', { name: /^挑战/ }))
  expect(onChallenge).toHaveBeenCalledWith(3)
})

it('claims the idle chest into the shared pool', async () => {
  useAdventureStore.setState({ highestClearedStage: 1, idleClock: 0 })
  vi.spyOn(Date, 'now').mockReturnValue(25_000)
  render(<AdventurePanel onClose={() => {}} onChallenge={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /领取宝箱/ }))
  expect(useAdventureStore.getState().sharedExp).toBe(4)
  vi.restoreAllMocks()
})
```

- [ ] **Step 2: Run AdventurePanel RED**

Run: `npm.cmd test -- src/ui/AdventurePanel.test.tsx`
Expected: FAIL，组件不存在。

- [ ] **Step 3: Implement AdventurePanel.tsx**

渲染 `campaignConfig.stages`，按 `global` 分两章各 10 关；节点按钮文案含 `id`（`1-1`…`2-10`）与敌方等级/数量摘要；`disabled = !isStageUnlocked(global, highestClearedStage)`；已通关卡加已通标记。选中关卡后展示奖励预览（`getFirstClearReward`）与 `挑战 ${id}` 按钮（`onChallenge(global)`）。底部常驻挂机宝箱：`getClaimableIdleExp(idleClock, highestClearedStage, Date.now())` 展示「当前可领取 N」，`领取宝箱` 按钮调用 `useAdventureStore.getState().claimIdleChest(Date.now())`，toast `role="status"`。面板 `role="dialog"`、`Escape`/`onClose`、pointer 隔离、移动无横向溢出可滚动。

- [ ] **Step 4: Write FormationPanel RED tests**

`src/ui/FormationPanel.test.tsx`（2 前 3 后阵位、点击/键盘交换、双方阵位修正后总战力对比、快速部署、只上阵已解锁英雄、Start 校验）：

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FormationPanel, computeTeamPowerForFormation, computeEnemyPowerForStage } from './FormationPanel'
import { useGangStore } from '../store/useGangStore'
import { useAdventureStore } from '../store/useAdventureStore'

beforeEach(() => { useGangStore.getState().reset(0); useAdventureStore.getState().reset(0) })

it('renders five slots labeled front[0..1] and back[0..2]', () => {
  render(<FormationPanel stage={1} onCancel={() => {}} onStart={() => {}} />)
  expect(screen.getAllByRole('button', { name: /阵位/ })).toHaveLength(5)
})

it('shows both team powers using position-modified stats', () => {
  render(<FormationPanel stage={1} onCancel={() => {}} onStart={() => {}} />)
  const ourPower = computeTeamPowerForFormation([{ heroId: 'foreman', row: 'back', index: 1 }], { foreman: 1, anvil: 1, skyline: 1 })
  expect(screen.getByLabelText(new RegExp(`我方战力 ${ourPower}`))).toBeInTheDocument()
  expect(computeEnemyPowerForStage(1)).toBeGreaterThan(0)
})

it('deploys a hero into a slot via keyboard swap and starts', async () => {
  const onStart = vi.fn()
  render(<FormationPanel stage={1} onCancel={() => {}} onStart={onStart} />)
  await userEvent.click(screen.getByRole('button', { name: /^快速部署/ }))
  await userEvent.click(screen.getByRole('button', { name: /^开始$/ }))
  expect(onStart).toHaveBeenCalledWith(1)
})

it('cannot deploy a locked hero', () => {
  render(<FormationPanel stage={1} onCancel={() => {}} onStart={() => {}} />)
  // anvil (unlock 12) at gang 1 shows locked and is not draggable/deployable
  expect(screen.getByText(/岳峰.*帮派 Lv.12/)).toBeInTheDocument()
})
```

- [ ] **Step 5: Run FormationPanel RED**

Run: `npm.cmd test -- src/ui/FormationPanel.test.tsx`
Expected: FAIL，组件不存在。

- [ ] **Step 6: Implement FormationPanel.tsx**

会话级本地状态维护草稿 `FormationAssignment`（初始来自 `useAdventureStore.formation`）。渲染 5 个阵位按钮（`阵位 front 0`…`阵位 back 2`，`aria-label`）与英雄槽位来源列表（只列 `isHeroUnlocked` 的英雄，锁定英雄显示 `名·绰号 · 帮派 Lv.N 解锁` 不可部署）。交互：点击英雄再点阵位放入；点击已占阵位与另一阵位交换（点击/键盘 `Enter`/`Space` 均可，热区充足）。实时用 `computeTeamPowerForFormation(draft, heroLevels)` 与 `computeEnemyPowerForStage(stage)` 显示双方阵位修正后总战力（`我方战力 N` / `敌方战力 M`，`aria-label` 给完整整数）。`快速部署` 用 store 已有 `formation` 或默认本体铺满已解锁英雄默认槽。`开始` 校验草稿非空/全解锁/等级≤cap（复用 store `setFormation(draft, gangLevel)` 持久化草稿；成功后 `onStart(stage)`；失败给 `role="status"` 文案）。`取消`→`onCancel`。

```ts
import { buildBattleInput } from '../game/combat/battleEngine'
import { teamPower } from '../game/combat/power'
import { getHeroStats } from '../game/heroes'
import { getStage, getEnemyCount } from '../config/campaignConfig'
import { effectiveStats } from '../game/combat/power' // for enemy power

export function computeTeamPowerForFormation(formation, heroLevels) {
  return teamPower(formation.map((s) => ({ row: s.row, ...getHeroStats(s.heroId, heroLevels[s.heroId] ?? 1) })))
}
export function computeEnemyPowerForStage(stage) {
  const { enemy } = getStage(stage)
  const count = getEnemyCount(stage)
  const rows = [{ row: 'front' }, { row: 'front' }, { row: 'back' }, { row: 'back' }, { row: 'back' }].slice(0, count)
  return teamPower(rows.map((r) => ({ row: r.row as 'front' | 'back', hp: enemy.hp, atk: enemy.atk, def: enemy.def })))
}
```

- [ ] **Step 7: Add formation/adventure CSS**

在 `src/App.css` 新增 `.adventure-panel`、`.formation-panel`：章节关卡节点网格、阵位错列（前排靠上、后排靠下）、拖拽/点击热区 ≥44px、战力对阵条、无横向溢出可滚动、`prefers-reduced-motion` 禁用过渡。

- [ ] **Step 8: Run GREEN and full task gate**

Run:

```powershell
npm.cmd test -- src/ui/AdventurePanel.test.tsx src/ui/FormationPanel.test.tsx
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: 全部 exit 0；`App.tsx` 仍未改动。

- [ ] **Step 9: Commit Task 5**

```powershell
git add src/ui/AdventurePanel.tsx src/ui/AdventurePanel.test.tsx src/ui/FormationPanel.tsx src/ui/FormationPanel.test.tsx src/App.css
git commit -m "feat: add standalone campaign map and formation panels"
```

## Task 6: R3F BattleScene/BattleScreen and Final App single-activeOverlay Integration

**Files:**

- Create: `src/scene/battle/BattleEnvironment.tsx`
- Create: `src/scene/battle/BattleEnvironment.test.tsx`
- Create: `src/scene/battle/BattleUnit.tsx`
- Create: `src/scene/battle/BattleUnit.test.tsx`
- Create: `src/scene/battle/DamageNumbers.tsx`
- Create: `src/scene/battle/DamageNumbers.test.tsx`
- Create: `src/scene/battle/BattleScene.tsx`
- Create: `src/scene/battle/BattleScene.test.tsx`
- Create: `src/ui/BattleHud.tsx`
- Create: `src/ui/BattleHud.test.tsx`
- Create: `src/ui/BattleScreen.tsx`
- Create: `src/ui/BattleScreen.test.tsx`
- Create: `src/game/AdventureIdleClock.tsx`
- Create: `src/game/AdventureIdleClock.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.css`
- Modify: `src/ui/GlobalHud.tsx`
- Modify: `src/ui/GlobalHud.test.tsx`
- Modify: `src/ui/AdventurePanel.tsx`
- Modify: `src/ui/AdventurePanel.test.tsx`
- Modify: `src/ui/BuildingPanel.tsx`
- Modify: `src/ui/BuildingPanel.test.tsx`

**Interfaces:**

- Consumes: `simulateBattle`/`buildBattleInput`/`BattleResult`/`TickSnapshot`/`UnitSnapshot`（`battleEngine`）、`usePrefersReducedMotion`、`heroesConfig`（外观）、`useAdventureStore`/`useGangStore`/`useCityStore`、`getGangLevel`、`recordVictory`、`getBuildingStageProgress`（`buildingUpgrade`）。
- Produces：

```ts
// src/ui/BattleScreen.tsx
export interface BattleScreenProps { stage: number; onExit: () => void }
export function BattleScreen(props: BattleScreenProps): JSX.Element

// src/ui/BattleHud.tsx
export type PlaybackSpeed = 1 | 2
export interface BattleHudProps {
  phase: 'running' | 'paused' | 'resolved'
  speed: PlaybackSpeed
  onTogglePause: () => void
  onSetSpeed: (speed: PlaybackSpeed) => void
  onRequestExit: () => void
  units: UnitSnapshot[] // for read-only portraits (hp + cooldown)
}
export function BattleHud(props: BattleHudProps): JSX.Element

// src/scene/battle/BattleScene.tsx
export interface BattleSceneProps { result: BattleResult; currentTick: number }
export function BattleScene(props: BattleSceneProps): JSX.Element

// src/game/AdventureIdleClock.tsx
export function AdventureIdleClock(): null

// src/App.tsx
export type ActiveOverlay =
  | { kind: 'none' }
  | { kind: 'buildingDetail'; buildingId: BuildingId }
  | { kind: 'gangTree' }
  | { kind: 'settings' }
  | { kind: 'adventure' }
  | { kind: 'formation'; stage: number }
  | { kind: 'heroes' }
  | { kind: 'battle'; stage: number }
```

- [ ] **Step 1: Write AdventureIdleClock RED test**

`src/game/AdventureIdleClock.test.tsx`（每秒触发一次刷新用的 re-render tick，但**不写状态**；写入只发生在领取时）：

```tsx
import { render } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADVENTURE_STORAGE_KEY } from '../store/adventureMigration'
import { AdventureIdleClock, useChestTick } from './AdventureIdleClock'

beforeEach(() => {
  vi.useFakeTimers()
  useChestTick.setState({ tick: 0 })
  localStorage.setItem(ADVENTURE_STORAGE_KEY, '{"sentinel":true}')
})
afterEach(() => vi.useRealTimers())

it('mounts, ticks on an interval, and never persists on its own', () => {
  const { unmount } = render(<AdventureIdleClock />)
  act(() => { vi.advanceTimersByTime(3_000) })
  expect(useChestTick.getState().tick).toBe(3)
  expect(localStorage.getItem(ADVENTURE_STORAGE_KEY)).toBe('{"sentinel":true}')
  unmount()
})
```

> `AdventureIdleClock` 仅维护一个本地 `tick` 计数用于让消费 `getClaimableIdleExp` 的 HUD 每秒重渲染；它不调用任何 store 写方法。为使 HUD 感知刷新，改为在 `GlobalHud`/`AdventurePanel` 内用一个每秒自增的 `useState` 局部时钟触发 `Date.now()` 重算，或让 `AdventureIdleClock` 通过一个极小的非持久 zustand slice 递增 `chestRefreshTick`。本计划采用后者：新增非持久模块级 store `useChestTick`（不 persist），`AdventureIdleClock` 每秒 `incr()`，HUD/Adventure 订阅它触发重算。

修正实现说明：`AdventureIdleClock` 使用 `useChestTick`（见 Step 3）每 1000ms `increment()`；该 slice 无 `persist`，不落盘，符合「宝箱为派生、不持久」。

- [ ] **Step 2: Run idle-clock RED**

Run: `npm.cmd test -- src/game/AdventureIdleClock.test.tsx`
Expected: FAIL，模块不存在。

- [ ] **Step 3: Implement AdventureIdleClock + non-persistent chest tick slice**

```tsx
// src/game/AdventureIdleClock.tsx
import { useEffect } from 'react'
import { create } from 'zustand'

export const useChestTick = create<{ tick: number; increment: () => void }>((set) => ({
  tick: 0,
  increment: () => set((s) => ({ tick: s.tick + 1 })),
}))

const REFRESH_MS = 1_000

export function AdventureIdleClock(): null {
  const increment = useChestTick((s) => s.increment)
  useEffect(() => {
    const id = window.setInterval(increment, REFRESH_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') increment() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [increment])
  return null
}
```

在 `GlobalHud`/`AdventurePanel` 中 `useChestTick((s) => s.tick)` 订阅以每秒重算宝箱增量（不改持久状态）。分别在 `GlobalHud.test.tsx` 与 `AdventurePanel.test.tsx` 用 fake timers/手动 `useChestTick.setState` 证明 `Date.now()` 前进后“可领取经验”与推关红点更新，同时 `idleClock` 和 localStorage 均不变。

- [ ] **Step 4: Write BattleScene/BattleUnit/DamageNumbers RED tests**

R3F 组件用 `@react-three/fiber` 的测试渲染（沿用既有 `BuildingModel.test.tsx` 模式，在 jsdom 下浅渲染 mesh 并断言存在/数量/data 属性，不做真实 GL）。`src/scene/battle/BattleScene.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { buildBattleInput, simulateBattle, type HitEvent, type UnitSnapshot } from '../../game/combat/battleEngine'
import { BattleScene } from './BattleScene'

vi.mock('./BattleUnit', () => ({
  BattleUnit: ({ unit }: { unit: UnitSnapshot }) => (
    <div data-testid="battle-unit" data-side={unit.side} data-dead={String(!unit.alive)} />
  ),
}))
vi.mock('./DamageNumbers', () => ({
  DamageNumbers: ({ hits }: { hits: HitEvent[] }) => <div data-testid="damage-numbers">{hits.length}</div>,
}))
vi.mock('./BattleEnvironment', () => ({
  BattleEnvironment: () => <div data-testid="battle-environment" />,
}))

it('renders the exact snapshot units and hit count for the selected tick', () => {
  const result = simulateBattle(buildBattleInput(
    1,
    [{ heroId: 'foreman', row: 'back', index: 1 }],
    { foreman: 1, anvil: 1, skyline: 1 },
    1,
  ))
  const hitIndex = result.timeline.findIndex((tick) => tick.hits.length > 0)
  const { rerender } = render(<BattleScene result={result} currentTick={1} />)
  expect(screen.getAllByTestId('battle-unit')).toHaveLength(result.timeline[0].units.length)
  expect(screen.getByTestId('battle-environment')).toBeInTheDocument()
  rerender(<BattleScene result={result} currentTick={hitIndex + 1} />)
  expect(screen.getByTestId('damage-numbers')).toHaveTextContent(String(result.timeline[hitIndex].hits.length))
})

it('keeps dead units in the final snapshot for the death animation', () => {
  const result = simulateBattle(buildBattleInput(
    1,
    [{ heroId: 'foreman', row: 'back', index: 1 }],
    { foreman: 1, anvil: 1, skyline: 1 },
    1,
  ))
  render(<BattleScene result={result} currentTick={result.endedAtTick} />)
  expect(screen.getAllByTestId('battle-unit').some((node) => node.dataset.dead === 'true')).toBe(true)
})
```

关键断言：给定 `simulateBattle(buildBattleInput(1, ...))` 的 `result`，在 `currentTick=1` 渲染 `BattleScene`，我方 1 + 敌方 1 单位组存在；在最终 tick，死亡敌方单位标记 `data-dead`；`DamageNumbers` 对该 tick 的 `hits` 渲染整数飘字元素；`BattleUnit` 依 `heroesConfig.appearance` 选择 silhouette/weapon 几何（断言 `data-silhouette`/`data-weapon`）。reduced-motion 分支：`usePrefersReducedMotion()` 为真时跳过 tween（断言无过渡 data 标记）。

> 若既有测试基建对 R3F 组件采用 mock（参见 `src/scene/city/*.test.tsx` 的做法），沿用同一 mock 策略；断言点为「按 timeline 快照渲染的单位/伤害/死亡数量」而非 GL 像素。

- [ ] **Step 5: Run scene RED**

Run: `npm.cmd test -- src/scene/battle/BattleScene.test.tsx src/scene/battle/BattleUnit.test.tsx src/scene/battle/DamageNumbers.test.tsx src/scene/battle/BattleEnvironment.test.tsx`
Expected: FAIL，组件不存在。

- [ ] **Step 6: Implement battle scene components**

- `BattleEnvironment.tsx`：程序化俯视街道地面 + 阵位虚线方框（纯几何，无外部资产）。
- `BattleUnit.tsx`：接收 `UnitSnapshot` + `appearance`（我方由 `heroesConfig.heroes[heroId].appearance`；敌方用统一敌人配色几何）。按 `silhouette`（capsule/bulk/slim）与 `weapon`（shotgun/axe-shield/rifle）组装基础几何体；血条（`role` 无需，属 3D）随 `hp/maxHp`；死亡 `alive===false` 时倒地下沉；位置由 `globalIndex`（我方下方、敌方上方）+ 走位插值（reduced motion 时不插值）。
- `DamageNumbers.tsx`：对当前 tick 的 `hits` 渲染整数飘字（reduced motion 瞬显瞬隐）。
- `BattleScene.tsx`：`props.result.timeline[currentTick-1]` 取快照，映射快照中的全部单位为 `BattleUnit`（`alive=false` 保留到该快照以播放死亡倒地），附 `BattleEnvironment` 与 `DamageNumbers`；纯回放，不反算引擎。

- [ ] **Step 7: Write BattleHud RED tests**

`src/ui/BattleHud.test.tsx`（暂停/继续、1x/2x、退出二次确认、只读英雄头像展示生命+技能冷却、**无手动施法/无 Auto 开关**）：

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BattleHud } from './BattleHud'

const units = [{ side: 'ally', globalIndex: 2, row: 'back', hp: 800, maxHp: 800, cooldownRemaining: 30, cooldownTotal: 90, alive: true }]

it('has no manual-cast or Auto controls', () => {
  render(<BattleHud phase="running" speed={1} onTogglePause={() => {}} onSetSpeed={() => {}} onRequestExit={() => {}} units={units as never} />)
  expect(screen.queryByRole('button', { name: /Auto|自动战斗|释放技能|施法/ })).toBeNull()
})

it('toggles pause and switches speed', async () => {
  const onTogglePause = vi.fn(); const onSetSpeed = vi.fn()
  render(<BattleHud phase="running" speed={1} onTogglePause={onTogglePause} onSetSpeed={onSetSpeed} onRequestExit={() => {}} units={units as never} />)
  await userEvent.click(screen.getByRole('button', { name: /暂停/ }))
  expect(onTogglePause).toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: /2x/ }))
  expect(onSetSpeed).toHaveBeenCalledWith(2)
})

it('requires exit confirmation', async () => {
  const onRequestExit = vi.fn()
  render(<BattleHud phase="running" speed={1} onTogglePause={() => {}} onSetSpeed={() => {}} onRequestExit={onRequestExit} units={units as never} />)
  await userEvent.click(screen.getByRole('button', { name: /退出/ }))
  await userEvent.click(screen.getByRole('button', { name: /确认退出/ }))
  expect(onRequestExit).toHaveBeenCalled()
})

it('renders read-only portraits with cooldown seconds', () => {
  render(<BattleHud phase="running" speed={1} onTogglePause={() => {}} onSetSpeed={() => {}} onRequestExit={() => {}} units={units as never} />)
  // ceil(30/10)=3 seconds; portrait is not a button
  expect(screen.getByText('3')).toBeInTheDocument()
})
```

- [ ] **Step 8: Run BattleHud RED then implement**

Run: `npm.cmd test -- src/ui/BattleHud.test.tsx` → FAIL → 实现：左上暂停按钮、右侧 1x/2x 按钮组（`aria-pressed`）、退出按钮触发内联二次确认（`确认退出`/`取消`）。底部我方英雄只读头像：展示血条与冷却填充 `1 - remaining/total`，未就绪显示 `ceil(remainingTicks/10)` 秒、就绪镀金高亮；头像为 `div`/`span`（非 button，无点击语义）。可键盘 Tab/Escape（Escape 等价退出确认）。**绝不渲染任何 Auto 或施法按钮。**

- [ ] **Step 9: Write BattleScreen RED tests**

`src/ui/BattleScreen.test.tsx`（自动回放、START、结算胜/负、退出无奖励、胜利播放到 resolved 才提交首通、reduced motion 快进）：

```tsx
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BattleScreen } from './BattleScreen'
import { useAdventureStore } from '../store/useAdventureStore'
import { useGangStore } from '../store/useGangStore'

beforeEach(() => { vi.useFakeTimers(); useAdventureStore.getState().reset(0); useGangStore.getState().reset(0) })
afterEach(() => vi.useRealTimers())

it('plays to victory and commits the first clear exactly once at resolve', () => {
  const onExit = vi.fn()
  render(<BattleScreen stage={1} onExit={onExit} />)
  act(() => { vi.advanceTimersByTime(60_000) }) // exceed max battle playback
  expect(useAdventureStore.getState().highestClearedStage).toBe(1)
  expect(useAdventureStore.getState().sharedExp).toBe(500)
  expect(screen.getByText(/VICTORY|胜利/)).toBeInTheDocument()
})

it('exit before resolve commits nothing', async () => {
  const onExit = vi.fn()
  render(<BattleScreen stage={1} onExit={onExit} />)
  await userEvent.click(screen.getByRole('button', { name: /退出/ }))
  await userEvent.click(screen.getByRole('button', { name: /确认退出/ }))
  expect(onExit).toHaveBeenCalled()
  expect(useAdventureStore.getState().highestClearedStage).toBe(0)
  expect(useAdventureStore.getState().sharedExp).toBe(0)
})
```

> 说明：`BattleScreen` 挂载即 `simulateBattle(buildBattleInput(stage, formation, heroLevels, gangLevel))`，用 `requestAnimationFrame`/`setInterval` 按 `speed` 每帧推进 `currentTick`（1x 消费 1 tick、2x 消费 2 tick；reduced motion 一次性跳到 `endedAtTick`）。回放到 `endedAtTick`（`phase='resolved'`）后：若 `result.outcome==='victory'` 调 `useAdventureStore.getState().recordVictory(stage, Date.now())`（单事务，先事务后展示结算页数值）；`defeat`/重打不发奖。退出（HUD 二次确认或 Escape）在任何 `phase` 都只 `onExit()`，不触发持久写入。

- [ ] **Step 10: Run BattleScreen RED then implement**

Run: `npm.cmd test -- src/ui/BattleScreen.test.tsx` → FAIL → 实现回放状态机（running↔paused、1x/2x、resolved→结算页 VICTORY/DEFEAT + 奖励/`Next`/空白继续 → `onExit`）；用 `usePrefersReducedMotion` 决定即时跳终局；构建 `BattleInput` 前校验阵容非空/全解锁/等级≤`min(50,gangLevel)`，不满足则渲染「战斗初始化失败」并允许退出（外层由 App 的 `AppErrorBoundary` 兜底引擎抛错）。

- [ ] **Step 11: Write App single-overlay RED tests**

`src/App.test.tsx` 重写关键断言：

```tsx
vi.mock('./ui/GlobalHud', () => ({
  GlobalHud: (p: { onOpenAdventure: () => void; onOpenSettings: () => void }) => (
    <nav><button onClick={p.onOpenAdventure}>推关</button><button onClick={p.onOpenSettings}>设置</button></nav>
  ),
}))
vi.mock('./ui/AdventurePanel', () => ({
  AdventurePanel: (p: { onChallenge: (stage: number) => void }) => (
    <div role="dialog" aria-label="推关地图"><button onClick={() => p.onChallenge(1)}>挑战 1-1</button></div>
  ),
}))
vi.mock('./ui/FormationPanel', () => ({
  FormationPanel: (p: { onStart: (stage: number) => void; stage: number }) => (
    <div role="dialog" aria-label="编队"><button onClick={() => p.onStart(p.stage)}>开始</button></div>
  ),
}))
vi.mock('./ui/BattleScreen', () => ({
  BattleScreen: (p: { onExit: () => void }) => (
    <div role="dialog" aria-label="战斗"><button onClick={p.onExit}>退出战斗</button></div>
  ),
}))

it('opens at most one overlay and closes building detail when opening a full-screen play', async () => {
  useCityStore.getState().selectBuilding('repair-shop')
  render(<App />)
  expect(screen.getByRole('dialog', { name: /修车厂/ })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '推关' }))
  expect(screen.getByRole('dialog', { name: '推关地图' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: /修车厂/ })).toBeNull()
  expect(useCityStore.getState().selectedBuildingId).toBeNull()
})
it('formation can only be entered from adventure, battle only from formation, and exit returns to adventure', async () => {
  render(<App />)
  expect(screen.queryByRole('dialog', { name: '编队' })).toBeNull()
  expect(screen.queryByRole('dialog', { name: '战斗' })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: '推关' }))
  await userEvent.click(screen.getByRole('button', { name: '挑战 1-1' }))
  expect(screen.getByRole('dialog', { name: '编队' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '开始' }))
  expect(screen.getByRole('dialog', { name: '战斗' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '退出战斗' }))
  expect(screen.getByRole('dialog', { name: '推关地图' })).toBeInTheDocument()
})
it('Escape closes the current non-none overlay', async () => {
  render(<App />)
  await userEvent.click(screen.getByRole('button', { name: '设置' }))
  expect(screen.getByRole('dialog', { name: /设置/ })).toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: /设置/ })).toBeNull()
})
it('idle controllers (gang/economy/adventure) mount regardless of overlay', async () => {
  render(<App />)
  expect(screen.getByTestId('gang-idle-controller')).toBeInTheDocument()
  expect(screen.getByTestId('economy-idle-controller')).toBeInTheDocument()
  expect(screen.getByTestId('adventure-idle-clock')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '推关' }))
  expect(screen.getByTestId('gang-idle-controller')).toBeInTheDocument()
  expect(screen.getByTestId('economy-idle-controller')).toBeInTheDocument()
  expect(screen.getByTestId('adventure-idle-clock')).toBeInTheDocument()
})
```

沿用现有 `App.test.tsx` 的 Controller/Canvas/Panel mocks，并让三个 idle mock 输出上述 `data-testid`。测试 `beforeEach` 必须 reset city/gang/adventure store，避免 overlay 与存档跨用例泄漏。

- [ ] **Step 12: Run App RED**

Run: `npm.cmd test -- src/App.test.tsx`
Expected: FAIL（当前 App 仍是 boolean overlay，无 adventure/heroes/battle）。

- [ ] **Step 13: Rewrite App.tsx to a single activeOverlay state machine**

用 `activeOverlay` 单状态替换 `gangTreeOpen`/`settingsOpen`：

```tsx
const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>({ kind: 'none' })
const selectedBuildingId = useCityStore((s) => s.selectedBuildingId)
const clearSelection = useCityStore((s) => s.clearSelection)

// building click maps to buildingDetail
useEffect(() => {
  if (selectedBuildingId) setActiveOverlay({ kind: 'buildingDetail', buildingId: selectedBuildingId })
}, [selectedBuildingId])

const openFullScreen = (overlay: ActiveOverlay) => { clearSelection(); setActiveOverlay(overlay) }
const closeOverlay = () => { if (activeOverlay.kind === 'buildingDetail') clearSelection(); setActiveOverlay({ kind: 'none' }) }
```

- 挂载 `GangIdleController`/`EconomyIdleController`/`AdventureIdleClock`（都不受 overlay 影响）。
- App 定义 `reconcileWhenBothHydrated()`：仅当 `useAdventureStore.persist.hasHydrated()` 与 `useGangStore.persist.hasHydrated()` 都为真时，才读取当前声望计算 gang level 并调用 `reconcileWithGang`。mount 时分别注册两个 store 的 `onFinishHydration(reconcileWhenBothHydrated)`，立即调用一次该函数，并在后续 `gangLevel` 变化 effect 中再次调用；cleanup 必须解除两个 hydration 监听。`App.test.tsx` 增加竞态回归：Adventure 先 hydrate 出合法 Lv20 英雄而 Gang 尚为默认 Lv1 时不得夹低；Gang 随后 hydrate 到 Lv20 后才协调；坏存档中的 Lv40 在双方 hydrate 且 Gang Lv12 时夹到12并移除 skyline。
- `GlobalHud` 回调：`onOpenHeroes/onOpenGangTree/onOpenAdventure/onOpenSettings` → 对应 overlay（全屏玩法先 `clearSelection`）。
- 按 `activeOverlay.kind` 渲染唯一 overlay：`buildingDetail→BuildingPanel`、`gangTree→GangTreePanel`、`settings→SettingsPanel`、`adventure→AdventurePanel`（`onChallenge(stage)` → `{kind:'formation',stage}`）、`formation→FormationPanel`（Cancel → `adventure`；Start 校验并持久化阵容后 → `{kind:'battle',stage}`）、`heroes→HeroesPanel`、`battle→BattleScreen`（退出或结算 Next → `adventure`）。不得从 HUD 或其它 overlay 直接构造 `battle`。
- 全局 `Escape` 关闭当前非 `none` overlay；`battle` 的 Escape 交由 `BattleScreen`/`BattleHud` 的退出二次确认处理。
- **城市 canvas 卸载/隐藏策略**：进入 `adventure`/`heroes`/`battle` 全屏玩法时，用 CSS 隐藏（`display:none` 或 `visibility:hidden` + `aria-hidden`）城市 `Canvas` 容器以停止其交互与可见渲染，`battle` 场景在自己的全屏 `Canvas` 中挂载；退出全屏玩法恢复城市 canvas。明确选择「隐藏而非卸载」以避免城市场景重建开销与相机状态丢失（在计划中固定此决策）。
- `BuildingPanel` 只在 `buildingDetail` 打开；其余保持既有行为。

- [ ] **Step 14: Switch BuildingPanel progress to getBuildingStageProgress**

`BuildingPanel.tsx` 把进度条与百分比文案的数据源从 `getBuildingUpgradeProgress` 换为 `getBuildingStageProgress`（`role="progressbar"`、`aria-valuenow`=`percent`、只有 `complete` 才显示 `100%`、否则 `Math.floor(percent)%`）。主升级门槛判定仍用 `getMainUpgradeDecision`（不变）。在 `BuildingPanel.test.tsx` 更新/追加：Lv2 `[1,0]` 显示 `0%`→`33%`→`66%`→`100%`、repair Lv5→6 每次 `20%` 的展示断言。

- [ ] **Step 15: Run GREEN and full task gate**

Run:

```powershell
npm.cmd test -- src/scene/battle/ src/ui/BattleHud.test.tsx src/ui/BattleScreen.test.tsx src/game/AdventureIdleClock.test.tsx src/App.test.tsx src/ui/BuildingPanel.test.tsx
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
```

Expected: 全部 exit 0；`dist/index.html` 资源以 `/DobeDemo/` 开头；单 overlay 互斥、formation 仅从 adventure 进入、battle 仅从 formation 进入、挂机不暂停。

- [ ] **Step 16: Commit Task 6**

```powershell
git add src/scene/battle/BattleEnvironment.tsx src/scene/battle/BattleEnvironment.test.tsx src/scene/battle/BattleUnit.tsx src/scene/battle/BattleUnit.test.tsx src/scene/battle/DamageNumbers.tsx src/scene/battle/DamageNumbers.test.tsx src/scene/battle/BattleScene.tsx src/scene/battle/BattleScene.test.tsx src/ui/BattleHud.tsx src/ui/BattleHud.test.tsx src/ui/BattleScreen.tsx src/ui/BattleScreen.test.tsx src/game/AdventureIdleClock.tsx src/game/AdventureIdleClock.test.tsx src/ui/GlobalHud.tsx src/ui/GlobalHud.test.tsx src/ui/AdventurePanel.tsx src/ui/AdventurePanel.test.tsx src/App.tsx src/App.test.tsx src/App.css src/ui/BuildingPanel.tsx src/ui/BuildingPanel.test.tsx
git commit -m "feat: integrate battle scene and single-overlay app shell"
```

## Task 7: Full Local Gate, Safe CDP Closed Loop, Docs/README/Session, Full-Branch Review, Push, Fresh Pages, Public Verification, Final Evidence

**Files:**

- Modify: `README.md`
- Modify: `session/session.md`
- Create: `.superpowers/sdd/campaign-heroes-global-hud-cdp.mjs`
- Create: `.superpowers/sdd/campaign-heroes-global-hud-results.json`
- Create: `.superpowers/sdd/campaign-heroes-global-hud-report.md`
- Create: `.superpowers/sdd/campaign-heroes-global-hud-public-cdp.mjs`
- Create: `.superpowers/sdd/campaign-heroes-global-hud-public-results.json`

**Interfaces:**

- Local script: `node .superpowers/sdd/campaign-heroes-global-hud-cdp.mjs`
- Public script: `node .superpowers/sdd/campaign-heroes-global-hud-public-cdp.mjs`
- Storage keys: `dobe-city-progression-v1`(v3)、`gang-progression-v1`、`dobe-adventure-progression-v1`(v1)。
- Public URL: `https://sherlock3rd.github.io/DobeDemo/`；Deployment base: `/DobeDemo/`。

- [ ] **Step 1: Run the fresh engineering gate before writing evidence**

Run:

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Expected: 全部 exit 0；`dist/index.html` 引用当前 hash 的 JS/CSS，均以 `/DobeDemo/` 开头。

- [ ] **Step 2: Implement the repeatable local CDP safety shell**

以现有 `.superpowers/sdd/progressive-building-upgrade-flow-cdp.mjs` 为模板，改名/改断言，安全模型与既有 progressive 脚本**完全一致**：

- 动态选择空闲 dev/CDP 端口，跳过被占用的偏好端口，绝不连接/杀死 preflight 发现的既有监听者；
- 只追踪本脚本 spawn 的子 PID，拒绝终止未知 PID；
- Chrome profile 用 `fs.mkdtempSync(path.join(os.tmpdir(), 'dobe-campaign-heroes-cdp-'))`，递归删除前校验该精确前缀；
- Vite 用 `--strictPort`；
- 结果 JSON 只记录 basename、相对仓库路径、数值度量与白名单 `name`/`code`，原始 stack 只写 stderr；
- 含纯 good-data/empty-data 断言自测与 Windows/Unix 路径脱敏自测；
- 任一断言失败/运行错误/清理失败/占用-自有端口不符/缺失截图，设置非零 `process.exitCode`；
- 结束校验 dev/CDP 端口已释放、临时 profile 已删除。

- [ ] **Step 3: Implement the local Chrome acceptance flow**

真机 CDP 驱动 desktop 1440×900 与 mobile 390×844。可见控件用真实指针点击；合法 localStorage 注入可预置昂贵状态（如高等级/高经验/高声望），但每个被断言的过渡都必须由真实 UI 操作触发。必需断言（fresh 存档起）：

1. 清空三个存档；断言 fresh：city 钱包 `{10000,0,0}`、gang 声望 0、adventure `sharedExp 0`/`highestClearedStage 0`/仅本体在阵；HUD 四资源含英雄经验、底部推关红点存在。
2. 打开推关 → 选 1-1 → 编队（阵位 2 前 3 后、双方总战力对比）→ Start → 观察 `START` 演出、我方自动走位/普攻/技能齐射（无 Auto/无手动施法按钮）、伤害飘字、敌方倒地、`VICTORY`。
3. 胜利结算后断言首通经验入池（`sharedExp === 500`）、`highestClearedStage === 1`、挂机时钟已初始化；退出回到推关。
4. 领取挂机宝箱：等待/注入时钟推进，`领取宝箱` 后 `sharedExp` 增加、宝箱归零并继续累计；断言余量保留（时钟对齐整 tick）。
5. 打开英雄培养页，用共享经验升级本体（`heroLevels.foreman` +1、`sharedExp` 相应扣减），toast `role="status"`。
6. 打开设置 `解锁帮派树`：gang 声望 1470/Lv50；断言 `anvil`/`skyline` 在帮派树与培养页派生解锁并可编入阵位（无额外英雄调试按钮）。
7. 单 overlay 互斥：打开推关/编队/英雄/战斗时建筑详情关闭（`selectedBuildingId` 清空）；`Escape` 关闭当前 overlay；`formation` 只能从 adventure 进入、`battle` 只能从 formation 进入，战斗退出回 adventure 且退出前无奖励/无进度变更。
8. 建筑阶段进度：升级子建筑观察百分比按阶段口径变化（Lv2 `[1,0]` 0→33→66→100 展示、修车厂 Lv5→6 每次 20%），仅精确 100% 显示 `100%`。
9. 坏/旧 adventure 存档注入（`persisted==null` 保初始、越界等级夹紧、非法阵位丢弃）reload 后规范化正确；三 store reset 二次确认后全部回初始（钱包 10000、声望 0、adventure 初始态、三时钟对齐一次捕获的 reset 时刻）。
10. desktop 与 390×844：HUD/推关/编队/战斗/英雄/建筑/设置面板均不横向溢出、可滚动、44px 热区可达、焦点可见、焦点转移符合预期。
11. teardown 证明只终止自有 PID、两端口释放、临时 profile 删除、所有预期截图非空。

- [ ] **Step 4: Run local CDP and record actual evidence**

Run:

```powershell
node .superpowers/sdd/campaign-heroes-global-hud-cdp.mjs
```

Expected: exit 0，`ASSERTION SELF-TEST: PASS`，每条编号断言 `PASS`，JSON 由实际运行值生成，清理断言通过。任一失败：用聚焦 RED 测试修源码/脚本，重跑受影响单测，再重跑全量门禁与整套 CDP（fresh 存档）。

- [ ] **Step 5: Update README and session ledger**

`README.md` 记述：2 章 20 关确定性战斗、五阵位三英雄、共享经验升级与帮派封顶、挂机经验+宝箱、统一 `PROGRESSION_UNLOCKS`（含 feature/hero 派生）、建筑阶段进度语义、单 `activeOverlay` HUD、新增 `dobe-adventure-progression-v1`(v1) 存档、技能全自动（无手动/无 Auto）、当前实际测试数量与本地验收脚本；明确参考视频/抽帧仅供参考绝不入库。`session/session.md` 更新当前目标并追加带日期的实现与本地验收账目；`campaign-heroes-global-hud-report.md` 记录真实命令输出、浏览器断言、生成 basename/尺寸、任何真实缺陷/重试历史；此时**不得**声称已 push 或 Pages 完成。

- [ ] **Step 6: Run post-doc gate and commit local delivery**

Run:

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
node .superpowers/sdd/campaign-heroes-global-hud-cdp.mjs
```

Expected: 全部 exit 0。然后**精确 stage 指定路径**（绝不 `git add -A`，避免混入未跟踪的 `example/5v5example.mp4`、抽帧、`dist`、临时 profile、终端文件）：

```powershell
git add README.md session/session.md .superpowers/sdd/campaign-heroes-global-hud-cdp.mjs .superpowers/sdd/campaign-heroes-global-hud-results.json .superpowers/sdd/campaign-heroes-global-hud-report.md
git status
git commit -m "test: document campaign/heroes/hud local acceptance"
```

提交前 `git status` 复核暂存区不含 PNG/视频/抽帧/dist/临时文件。

- [ ] **Step 7: Per-task review then full-branch review; TDD-fix Critical/Important**

先对每个任务提交做任务级 review；再对从功能基线到 HEAD 的**全分支范围**做 review（非仅最新提交）。必须显式复核：

- 引擎确定性/无随机时钟、目标优先级、伤害下限、技能全自动冷却、超时失败、死亡本 tick 末统一生效；
- 配置严格校验阻止构建；
- Adventure persist/merge/normalize（`null` 保初始、坏存档夹紧）、首通单事务、领取余量、升级 cap/经验原子、reset 三 store 幂等、`reconcileAdventureWithGang` 时机；
- 统一 `PROGRESSION_UNLOCKS` 派生（建筑行为不变、英雄/feature 派生、调试直升 50 派生解锁）、建筑阶段进度与 `complete` 等价；
- 单 overlay 互斥、formation 仅从 adventure、battle 仅从 formation、挂机不暂停、退出无奖励、胜利到 resolved 才提交首通、城市 canvas 隐藏策略、reduced motion/倍速不改结果；
- 无手动施法/无 Auto 开关；
- CDP 进程/路径/脱敏安全与既有 progressive 脚本一致；
- 未跟踪视频/抽帧绝未进入任何提交、暂存精确。

每个 Critical/Important 发现：写聚焦失败测试 TDD 修复、单独提交、重跑全量门禁与本地 CDP，再复审该修复范围。目标：最终审查 approved、无 Critical/Important。

- [ ] **Step 8: Ordinary push main**

复核历史干净后：

```powershell
git push origin main
```

Expected: 普通 fast-forward 成功。不得 `--force`/`--force-with-lease`。

- [ ] **Step 9: Publish fresh dist through an independent temporary index**

推送后的 main 提交通过 fresh 门禁后重建 `dist`，用独立临时 index 把 fresh `dist` 快进到 `gh-pages`（沿用 progressive plan Step 9 的 PowerShell 临时 index 流程：`GIT_INDEX_FILE` 指向 `.git` 下唯一临时文件、`read-tree --empty`、`--work-tree=dist add -f -A`、`write-tree`、以 `origin/gh-pages` 为 parent 造 commit、校验发布 tree 含 `index.html`、`push origin <commit>:refs/heads/gh-pages`，`finally` 恢复 `GIT_INDEX_FILE` 并仅删除 `.git` 内校验过前缀的临时 index）。正常工作区 index 不受影响；发布 tree 只含 `index.html` 与当前资源；push 为 fast-forward。

- [ ] **Step 10: Wait for the exact Pages commit to become built**

用 GitHub CLI/API 轮询 Step 9 的精确 `gh-pages` commit 的 Pages 部署/构建，只接受：

```text
deployment commit == pushed gh-pages commit
status == built
```

旧的成功构建不满足此步。遇确定性的 auth/权限失败则停止并报告，不改凭据、不 force push。

- [ ] **Step 11: Verify public HTTP and Chrome key flows**

无缓存拉取公开 HTML，提取当前 hash 的 JS/CSS 引用，断言 HTML/JS/CSS 各返回 HTTP 200 且以 `/DobeDemo/` 开头。实现 `campaign-heroes-global-hud-public-cdp.mjs`（同样的自有进程/profile/错误安全模型），在 fresh 隔离公开 profile 上验证关键闭环：

- fresh 存档 → 通关 1-1（观察 START/普攻/技能/VICTORY）→ 首通经验入池；
- 领取挂机宝箱 → 培养页升级本体；
- 调试帮派直升 50 → 校验 `anvil`/`skyline` 派生解锁并可编入阵位；
- 单 overlay 互斥、退出战斗无奖励；
- 建筑阶段进度百分比；
- 390×844 布局可用。

Run:

```powershell
node .superpowers/sdd/campaign-heroes-global-hud-public-cdp.mjs
```

Expected: exit 0，公开断言全过，结果 JSON 与非空本地截图生成，profile 清理成功。

- [ ] **Step 12: Commit final evidence and ordinary-push main again**

用实际 main commit、gh-pages commit、Pages build ID/status、公开资源 URL/状态、公开 CDP 断言与截图 basename/尺寸更新 report 与 session 账目。最终门禁：

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Expected: 全部 exit 0。然后精确 stage：

```powershell
git add session/session.md .superpowers/sdd/campaign-heroes-global-hud-report.md .superpowers/sdd/campaign-heroes-global-hud-public-cdp.mjs .superpowers/sdd/campaign-heroes-global-hud-public-results.json
git status
git commit -m "docs: record campaign/heroes/hud release evidence"
git push origin main
```

Expected: 最终证据提交为普通 fast-forward；工作树不含误跟踪的 `dist`、临时 index/profile/CDP 数据、忽略的 PNG、`example/5v5example.mp4`、抽帧或未知文件。

---

## Self-Review

**1. Spec coverage（逐节核对 → 任务）：**

- §2.1 确定性引擎 / §11 战斗规则 / §13.5 → Task 2；§2.2 R3F 战斗场景 / §15 动画 → Task 6。
- §3 战役结构/敌人数量/递增曲线/首通解锁 → §10.2 配置 Task 1 + `campaignConfig` + Task 3 首通事务 + Task 5 选关。
- §4 英雄阵位/首版三英雄/等级封顶/属性推导 → Task 1（`heroes`/`heroesConfig`）+ Task 3（升级）+ Task 5（阵位）。
- §5 挂机经验/结算/宝箱 → Task 1（`idleExperienceConfig`）+ Task 3（领取事务/派生宝箱）+ Task 6（`AdventureIdleClock`）。
- §6 全局 HUD/底部导航/红点/单 overlay → Task 4（GlobalHud/redDots）+ Task 6（App wiring）。
- §7 Adventure Store 全部子节 → Task 3；§7.5 三 store reset → Task 3 Step 7–9。
- §8 统一 ProgressionUnlock/英雄派生 → Task 1（`progressionUnlocks`）+ Task 4（GangTreePanel）。
- §9 建筑阶段进度 → Task 1（纯函数）+ Task 6 Step 14（BuildingPanel 展示切换）。
- §10 四份配置 → Task 1 全覆盖；§13.3 配置阻止构建 → Task 1 解析器。
- §12 文件清单 → File Map 全覆盖。
- §13 健壮性（错误边界/安全整数/坏存档/确定性）→ Task 2/3/6 分散覆盖 + `AppErrorBoundary`（Task 6）。
- §14 UI 状态机/原子顺序 → Task 6（App/BattleScreen）+ Task 3（事务）。
- §16 可访问性 → Task 4/5/6 各组件 a11y 断言。
- §17 测试矩阵（纯规则/Store/UI/R3F/CDP）→ Tasks 1–7 对应 RED/GREEN + Task 7 CDP。
- §18/§19 发布纪律/非目标 → Task 7 + Global Constraints。

无遗漏 spec 需求；建筑进度展示切换已显式落到 Task 6 Step 14。

**2. Placeholder scan：** 扫描通过；配置解析、战斗接口、HUD、挂机时钟与 App 接线均给出完整代码或精确字段/断言与命令。

**3. Type consistency：** 跨任务签名核对一致：`HeroId`/`Row`（heroes）→ 各处一致；`FormationAssignment`（`combat/power`）在 store/UI/引擎统一引用；`SkillConfig`（combatConfig）被 `heroesConfig.HeroSkillConfig extends` 且引擎 `BattleUnitInput.skill` 使用；`BattleResult`/`TickSnapshot`/`UnitSnapshot`（battleEngine）在 BattleScene/BattleHud 一致；`getBuildingStageProgress`/`childUnlockLevel`（buildingUpgrade）在 Task 1 定义、Task 6 消费；`getClaimableIdleExp`（useAdventureStore）在 GlobalHud/AdventurePanel 一致；`ActiveOverlay`（App）与各 overlay kind 一致；`reconcileAdventureWithGang`/`normalizeAdventureDurableState`/`createInitialAdventureState`（adventureMigration）在 store/tests 一致。`isBuildingUnlocked` 保持从 `gangProgression` re-export，既有 importer 不受影响。

修复项：Task 4 Step 1 首个 heroes-dot 断言与 gang cap 语义冲突，已在同 Step 内以「修正」段和补充用例更正为 `gangLevel=1→false`、`gangLevel=2→true`，实现以 `redDots.ts` 的 `level<cap` 为准。
