# HUD、怒气技能、五品质与配件领取 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化 HUD 与英雄技能展示，落地真实怒气战斗、五品质配件迁移，并把废车回收厂挂机改为生产 Tab 手动领取。

**Architecture:** 战斗、品质和挂机预览继续由纯函数驱动；Zustand 只保存可恢复的 durable state，领取结果和面板 Tab 保持 UI 会话态。玩家英雄使用怒气，敌人保留冷却；配件挂机只在领取时随机结算。

**Tech Stack:** React 19、TypeScript、Zustand persist、Vitest、React Testing Library、Three.js/R3F、Vite。

## Global Constraints

- 设计规范：`docs/superpowers/specs/2026-07-26-ui-rage-quality-salvage-claim-design.md`。
- 玩家英雄怒气初始 0、上限/消耗 100、普攻 +20、每次受击 +10；敌人保留冷却。
- 五品质固定为 `common/uncommon/rare/epic/legendary`，旧 `worn/tuned/elite/prototype` 必须安全映射。
- Adventure persist 版本升至 v6，存储键不变。
- 配件挂机期间不得自动入库；只有领取动作可写库存、零件、序号和时钟。
- 离线上限 8 小时、仓库上限 40、满仓自动回收语义保持。
- HUD 使用方案 B：战力并入帮派徽标，主资源条保持三格。
- 本轮只完成本地工作树实现、终审与验收；不 commit、不 push、不发布。后续若单独授权发布，仍禁止 force push。

---

### Task 1: 五品质领域模型与 v6 迁移

**Files:**
- Modify: `src/game/equipmentTypes.ts`
- Modify: `src/game/equipmentProgression.ts`
- Modify: `src/game/stageRewards.ts`
- Modify: `src/store/adventureMigration.ts`
- Modify: `src/store/useAdventureStore.ts`
- Test: `src/game/equipmentProgression.test.ts`
- Test: `src/game/stageRewards.test.ts`
- Test: `src/store/adventureMigration.test.ts`
- Test: `src/store/useAdventureStore.test.ts`

**Interfaces:**
- Produces: `CAR_PART_QUALITY_IDS = ['common','uncommon','rare','epic','legendary']`
- Produces: `normalizeLegacyPartQuality(value): CarPartQuality | null`
- Produces: 五键 `PartQualityWeights`

- [x] **Step 1: 写失败测试**

覆盖五品质 ID/名称/颜色/强度、Lv.10 `8/12/25/30/25`、推关/赛车五键权重，以及旧品质迁移后配件和安装关系不丢失。

- [x] **Step 2: 运行 RED**

Run: `npx vitest run src/game/equipmentProgression.test.ts src/game/stageRewards.test.ts src/store/adventureMigration.test.ts src/store/useAdventureStore.test.ts`

Expected: FAIL，原因是五品质 ID 和 legacy 映射尚不存在。

- [x] **Step 3: 实现五品质与迁移**

使用设计文档中的数值表替换 `CAR_PART_QUALITY_INFO`、升级成本和全部概率矩阵。在 normalize 校验前执行：

```ts
const LEGACY_PART_QUALITY_MAP = {
  worn: 'common',
  tuned: 'rare',
  elite: 'epic',
  prototype: 'legendary',
} as const
```

将 Adventure persist `version` 改为 `6`。

- [x] **Step 4: 运行 GREEN**

Run: `npx vitest run src/game/equipmentProgression.test.ts src/game/stageRewards.test.ts src/store/adventureMigration.test.ts src/store/useAdventureStore.test.ts`

Expected: PASS。

---

### Task 2: 玩家英雄真实怒气战斗

**Files:**
- Modify: `src/config/heroes.config.json`
- Modify: `src/config/heroesConfig.ts`
- Modify: `src/game/combat/battleEngine.ts`
- Modify: `src/ui/BattleHud.tsx`
- Modify: `src/ui/BattleScreen.tsx`
- Test: `src/config/heroesConfig.test.ts`
- Test: `src/game/combat/battleEngine.test.ts`
- Test: `src/ui/BattleHud.test.tsx`
- Test: `src/ui/BattleScreen.test.tsx`

**Interfaces:**
- Produces: `HeroSkillConfig.description/rageCost/ragePerBasicAttack/ragePerHitTaken`
- Produces: 玩家 `UnitState`/`UnitSnapshot` 的 `rage`、`maxRage`
- Preserves: 敌人 cooldown 行为与确定性 timeline

- [x] **Step 1: 写失败测试**

测试初始怒气 0、普攻命中 +20、一次受击 +10、100 怒时下次行动施放技能并归零；同时断言敌人仍按 cooldown 施法，BattleHud 展示怒气进度。

- [x] **Step 2: 运行 RED**

Run: `npx vitest run src/config/heroesConfig.test.ts src/game/combat/battleEngine.test.ts src/ui/BattleHud.test.tsx src/ui/BattleScreen.test.tsx`

Expected: FAIL，缺少 rage 字段和配置。

- [x] **Step 3: 实现怒气引擎**

玩家行动分支：

```ts
if (unit.side === 'ally' && unit.rage >= unit.skill.rageCost) {
  useSkill()
  unit.rage = 0
} else {
  useBasicAttack()
  unit.rage = Math.min(unit.maxRage, unit.rage + 20)
}
```

每个伤害事件命中玩家英雄后独立增加 10。敌方继续检查 cooldown。快照携带 rage，BattleHud 对 ally 渲染 `aria-label="怒气 X/100"`。

- [x] **Step 4: 运行 GREEN**

Run: `npx vitest run src/config/heroesConfig.test.ts src/game/combat/battleEngine.test.ts src/ui/BattleHud.test.tsx src/ui/BattleScreen.test.tsx`

Expected: PASS。

---

### Task 3: 配件挂机只读预览与手动领取

**Files:**
- Modify: `src/game/equipmentProgression.ts`
- Modify: `src/store/useAdventureStore.ts`
- Modify: `src/game/PartSalvageController.tsx`
- Test: `src/game/equipmentProgression.test.ts`
- Test: `src/store/useAdventureStore.test.ts`
- Test: `src/game/PartSalvageController.test.tsx`

**Interfaces:**
- Produces: `getPartSalvagePreview(input): PartSalvagePreview`
- Produces: `claimPartSalvage(now, recyclingYardLevel, gangLevel, random?): PartSalvageClaimResult`
- `PartSalvageClaimResult.receivedParts` 只包含本次实际入库配件

- [x] **Step 1: 写失败测试**

覆盖 preview 只读、未满一批不可领、非法或低于 Lv.8 的 `gangLevel` 零写入、领取后时钟/序号/库存推进、8 小时 cap、满仓回收和 Controller 不再自动入库。

- [x] **Step 2: 运行 RED**

Run: `npx vitest run src/game/equipmentProgression.test.ts src/store/useAdventureStore.test.ts src/game/PartSalvageController.test.tsx`

Expected: FAIL，缺少 preview/claim 且 Controller 仍自动 settle。

- [x] **Step 3: 实现 preview 与 claim**

`getPartSalvagePreview` 只做时间和批次数计算，不调用随机源。`claimPartSalvage` 接收调用方提供的 `gangLevel`，先用 `isBuildingUnlocked('recycling-yard', gangLevel)` 校验废车回收厂已在帮派 Lv.8 解锁；非法或未解锁请求返回未领取且不进入 Store 写事务。合法领取在一个 Store `set` 中调用 `settlePartSalvage`，通过旧库存 ID 集合提取 `receivedParts`，返回自动回收零件增量。cap 命中后将领取时钟推进到 `now`。

Controller 仅保留解锁边沿：

```ts
if (!wasUnlocked && unlocked) {
  resetPartIdleClock(now)
}
```

- [x] **Step 4: 运行 GREEN**

Run: `npx vitest run src/game/equipmentProgression.test.ts src/store/useAdventureStore.test.ts src/game/PartSalvageController.test.tsx`

Expected: PASS。

---

### Task 4: 回收厂生产 Tab 与领取结果弹窗

**Files:**
- Modify: `src/ui/buildingPanelSession.ts`
- Modify: `src/ui/BuildingPanel.tsx`
- Modify: `src/ui/HeroesPanel.tsx`
- Modify: `src/App.css`
- Test: `src/ui/BuildingPanel.test.tsx`
- Test: `src/ui/HeroesPanel.test.tsx`

**Interfaces:**
- Produces: `RecyclingPanelTab = 'building' | 'production'`
- Consumes: `getPartSalvagePreview`、`claimPartSalvage(now, recyclingYardLevel, gangLevel, random?)`
- Produces: UI 会话态 `part-claim-result`

- [x] **Step 1: 写失败 UI 测试**

覆盖仅回收厂显示 Tab、默认建筑 Tab、生产红点、累计时间/批次/进度、领取按钮禁用/启用、领取结果配件列表与自动回收文案，以及 HeroesPanel 不再显示回收厂倒计时。

- [x] **Step 2: 运行 RED**

Run: `npx vitest run src/ui/BuildingPanel.test.tsx src/ui/HeroesPanel.test.tsx`

Expected: FAIL，生产 Tab 与领取弹窗尚不存在。

- [x] **Step 3: 实现 UI 状态机**

生产 Tab 使用 `useChestTick` 每秒重算 preview，不写 Store。点击领取时传入当前 `gangLevel` 与回收厂等级，并保存 `PartSalvageClaimResult` 到本地 session；弹窗逐件复用配件卡视觉，关闭后保持 production Tab。其他建筑完全沿用现状。

- [x] **Step 4: 运行 GREEN**

Run: `npx vitest run src/ui/BuildingPanel.test.tsx src/ui/HeroesPanel.test.tsx`

Expected: PASS。

---

### Task 5: HUD B 方案与英雄技能卡

**Files:**
- Modify: `src/ui/GlobalHud.tsx`
- Modify: `src/ui/HeroesPanel.tsx`
- Modify: `src/App.css`
- Test: `src/ui/GlobalHud.test.tsx`
- Test: `src/ui/HeroesPanel.test.tsx`

**Interfaces:**
- Consumes: 英雄 skill description/rage 字段
- Consumes: `skillMainDamage`、`skillSplashDamage`
- Preserves: 三格主资源条

- [x] **Step 1: 写失败 UI 测试**

断言总战力位于帮派按钮内部、顶层不再有独立 power ResourceAmount；英雄姓名行含战力，技能卡含说明、倍率、预估伤害和 `怒气 100 / 普攻 +20 / 受击 +10`。

- [x] **Step 2: 运行 RED**

Run: `npx vitest run src/ui/GlobalHud.test.tsx src/ui/HeroesPanel.test.tsx`

Expected: FAIL，现有 DOM 仍有独立战力节点且技能仅显示名称。

- [x] **Step 3: 实现布局**

把 total power 的 `ResourceAmount` 移入 `.global-hud__gang`，删除 `.global-hud__top > .resource-amount` 独立布局。HeroesPanel identity 行加入战力，技能卡调用真实伤害函数；修复 ≤560px portrait weapon 负偏移与 overflow。

- [x] **Step 4: 运行 GREEN**

Run: `npx vitest run src/ui/GlobalHud.test.tsx src/ui/HeroesPanel.test.tsx`

Expected: PASS。

---

### Task 6: 设置概率、文档与本地集成验收

**Files:**
- Modify: `src/ui/SettingsPanel.tsx`
- Modify: `src/ui/SettingsPanel.test.tsx`
- Modify: `.superpowers/sdd/progression-economy-combat-smoke.mjs`
- Add: `.superpowers/sdd/browser-layout-assertions.mjs`
- Add: `src/ui/browserLayoutAssertions.test.ts`
- Update: `.superpowers/sdd/progression-economy-combat-smoke.png`
- Modify: `README.md`
- Modify: `session/session.md`
- Modify: `docs/superpowers/specs/2026-07-26-ui-rage-quality-salvage-claim-design.md`
- Modify: `docs/superpowers/plans/2026-07-26-ui-rage-quality-salvage-claim.md`
- Test: all affected tests

**Interfaces:**
- Consumes: 五品质概率和领取 UI
- Produces: Chrome smoke 对 HUD、技能怒气、生产 Tab、领取弹窗和五品质的断言

- [x] **Step 1: 更新设置概率和 smoke 失败断言**

将旧“原型/4 按钮”断言改为“传说/5 按钮”，增加生产 Tab 和怒气 UI 断言。

- [x] **Step 2: 运行全量门禁**

Run:

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

Expected: 全部 exit 0。

- [x] **Step 3: 本地 Chrome 验收**

启动独立 Vite 端口并运行 smoke；验证桌面和 390×844 无横向溢出、HUD 无孤立战力行、英雄战力无遮挡、生产领取与真实怒气可观察。

- [x] **Step 4: 终审并修复 Critical/Important**

对完整未提交 diff 做只读 defect-first review；所有 Critical/Important 必须修复并复审。

- [x] **Step 5: 提交并推送**

功能提交 `92155f5` 与发布记录已普通 push `main`，未使用 force push。

- [x] **Step 6: 发布 Pages**

已从推送后的 `main` fresh build，运行 `scripts/deploy-gh-pages.ps1` 发布 `gh-pages` `f2a5e88`；发布一致性审计后又以相同产物树重新发布为 `2ab2021`。Pages 状态为 `built`，HTML/JS/CSS 均为 HTTP 200，公开 URL smoke 通过。

> 当前交接状态：Task1–6 的实现、终审、本地验收、提交推送、Pages 发布与公开复验均已完成。
