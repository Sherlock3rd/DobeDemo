# Gang Tree Idle Unlocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为城市 Demo 加入 1–50 级帮派职位树、在线/离线挂机声望和按职位顺序解锁建筑的完整流程。

**Architecture:** 纯规则模块统一负责等级、职位、收益和建筑解锁；独立持久 Zustand store 只保存累计声望与结算时间。UI、建筑面板和 3D 场景都从同一帮派等级派生状态，避免复制所有权。

**Tech Stack:** React 19、TypeScript、Three.js、React Three Fiber、Zustand persist、Vitest、React Testing Library、Vite

## Global Constraints

- 等级范围 1–50；1 级 Prospect，50 级 PRESIDENT。
- 职位阈值固定为 1/8/16/24/32/40/50。
- 建筑解锁顺序固定为修车厂、废车回收厂、商业街、金属加工厂、加油站、Clubhouse。
- 每级 30 声望，在线每秒 5 声望，满级累计 1470。
- 离线收益最多结算 8 小时，使用 localStorage 键 `gang-progression-v1`。
- 玩家初始仅拥有修车厂；锁定建筑可查看条件但不能升级。
- 不加入手动领取、付费加速、后端、防作弊、任务或分支技能。
- 不初始化 Git，不配置飞书 CLI。
- 新行为严格 RED→GREEN→REFACTOR。

---

## File Map

- `src/game/gangProgression.ts`、`.test.ts`：职位、等级、收益和建筑解锁纯规则。
- `src/store/useGangStore.ts`、`.test.ts`：持久声望与时间结算。
- `src/game/GangIdleController.tsx`、`.test.tsx`：在线 tick 和 visibility 结算。
- `src/ui/GangTreePanel.tsx`、`.test.tsx`：50 节点帮派树。
- `src/ui/CityHud.tsx`、`.test.tsx`：当前职位、声望与入口。
- `src/ui/BuildingPanel.tsx`、`.test.tsx`：锁定条件或正常升级。
- `src/scene/city/LockedBuildingPlot.tsx`：锁定地块。
- `src/scene/city/InteractiveBuilding.tsx`：按帮派等级切换锁定/完整建筑。
- `src/App.tsx`、`src/App.test.tsx`、`src/App.css`：控制器、modal 和响应式集成。
- 城市类型、目录、布局和视觉配置：将物流中心替换为金属加工厂，商业区改商业街。

### Task 1: 迁移六座建筑目录与视觉

**Files:**
- Modify: `src/game/cityTypes.ts`
- Modify: `src/game/buildingCatalog.ts`
- Modify: `src/game/buildingCatalog.test.ts`
- Modify: `src/game/cityLayout.ts`
- Modify: `src/game/cityLayout.test.ts`
- Modify: `src/scene/city/buildingVisualConfig.ts`
- Modify: `src/scene/city/buildingVisualConfig.test.ts`

**Interfaces:**

```ts
export const BUILDING_IDS = [
  'repair-shop',
  'recycling-yard',
  'commercial-street',
  'metalworking-plant',
  'gas-station',
  'clubhouse',
] as const
```

`BuildingKind` 改为 `repair | recycling | commercial | metalworking | gas | clubhouse`。

- [ ] **Step 1:** 先修改目录/布局/视觉测试，断言新 ID、名称、顺序和金属加工三级 tag，运行确认 RED。
- [ ] **Step 2:** 更新类型与目录；名称逐字为修车厂、废车回收厂、商业街、金属加工厂、加油站、Clubhouse。
- [ ] **Step 3:** 保持原六个中心位置，但将旧 logistics placement 改为 `metalworking-plant`，旧 commercial ID 改为 `commercial-street`。
- [ ] **Step 4:** 将 logistics 视觉改为 metalworking，三级必须包含 `furnace`、`stamping-shop`、`gantry-crane`、`tall-smokestack` 等阶段识别 tag；commercial 语义改商业街。
- [ ] **Step 5:** 运行 game、视觉、布局、typecheck、lint；其余代码若因 ID 迁移报错，只做必要兼容修复，不实现后续功能。

### Task 2: 帮派进度纯规则

**Files:**
- Create: `src/game/gangProgression.ts`
- Create: `src/game/gangProgression.test.ts`

**Interfaces:**

```ts
export type GangLevel = number
export interface GangRole {
  threshold: number
  title: string
  chineseTitle: string
}
export interface BuildingUnlock {
  buildingId: BuildingId
  requiredLevel: number
  roleTitle: string
}

export const GANG_MAX_LEVEL = 50
export const REPUTATION_PER_LEVEL = 30
export const REPUTATION_PER_SECOND = 5
export const MAX_OFFLINE_SECONDS = 28_800
export const MAX_REPUTATION = 1470
export const GANG_ROLES: readonly GangRole[]
export const BUILDING_UNLOCKS: readonly BuildingUnlock[]
export function getGangLevel(totalReputation: number): number
export function getGangRole(level: number): GangRole
export function getNextGangRole(level: number): GangRole | null
export function getLevelProgress(totalReputation: number): { current: number; required: number }
export function getBuildingUnlock(buildingId: string): BuildingUnlock | null
export function isBuildingUnlocked(buildingId: string, level: number): boolean
export function calculateIdleReputation(lastUpdatedAt: number, now: number): number
```

- [ ] **Step 1:** 测试七职位阈值、中间等级、声望边界、六建筑顺序、初始仅修车厂、离线 cap/负时间，确认 RED。
- [ ] **Step 2:** 实现纯规则；所有输入 clamp，未知建筑返回 null/false。
- [ ] **Step 3:** 运行定向和全套 game 测试。

### Task 3: 持久帮派 store 与挂机控制器

**Files:**
- Create: `src/store/useGangStore.ts`
- Create: `src/store/useGangStore.test.ts`
- Create: `src/game/GangIdleController.tsx`
- Create: `src/game/GangIdleController.test.tsx`

**Interfaces:**

```ts
interface GangState {
  totalReputation: number
  lastUpdatedAt: number
  syncIdleProgress: (now: number) => void
  reset: (now: number) => void
}
```

- [ ] **Step 1:** 测试 sync 正常增益、8h cap、未来时间、满级、reset 与持久字段，确认 RED。
- [ ] **Step 2:** 使用 Zustand persist，键 `gang-progression-v1`，仅持久化 reputation/lastUpdatedAt；storage 失败时回退当前会话。
- [ ] **Step 3:** 控制器测试 fake timers：挂载立即 sync、每秒 sync、visibility visible sync、卸载清理。
- [ ] **Step 4:** 实现无 UI 控制器并通过全套测试/typecheck/lint。

### Task 4: 帮派树、HUD 与锁定建筑面板

**Files:**
- Create: `src/ui/GangTreePanel.tsx`
- Create: `src/ui/GangTreePanel.test.tsx`
- Modify/Create: `src/ui/CityHud.tsx`
- Create: `src/ui/CityHud.test.tsx`
- Modify: `src/ui/BuildingPanel.tsx`
- Modify: `src/ui/BuildingPanel.test.tsx`

**Interfaces:**

```ts
interface CityHudProps { onOpenGangTree: () => void }
interface GangTreePanelProps { open: boolean; onClose: () => void }
```

- [ ] **Step 1:** HUD 测试等级、职位、进度、速率和入口 callback，确认 RED 后实现。
- [ ] **Step 2:** 帮派树测试 open=false 不渲染、50 节点、七职位、六建筑里程碑、当前状态、关闭/Escape、防穿透，确认 RED 后实现。
- [ ] **Step 3:** BuildingPanel 测试默认修车厂可升级、锁定建筑显示所需等级/职位且无升级按钮、解锁后恢复升级。
- [ ] **Step 4:** 实现 UI，未知目录/解锁安全返回；运行 UI 全套。

### Task 5: 3D 锁定地块与 App 集成

**Files:**
- Create: `src/scene/city/LockedBuildingPlot.tsx`
- Modify: `src/scene/city/InteractiveBuilding.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.css`

- [ ] **Step 1:** 抽取可测试的建筑呈现模式纯函数，测试等级不足为 locked、达到阈值为 unlocked。
- [ ] **Step 2:** 实现锁定地块：缩放 footprint 的深色地基、围栏/施工标记、选中/hover 高亮；复用现有命中盒。
- [ ] **Step 3:** InteractiveBuilding 根据 gang level 在 LockedBuildingPlot 与 BuildingModel 间切换，点击锁定地块仍选择。
- [ ] **Step 4:** App 测试控制器、HUD callback 和 tree modal 开关，确认 RED 后集成 `GangIdleController` 与本地 open state。
- [ ] **Step 5:** CSS 增加 HUD 进度、帮派树 modal、50 节点、锁定面板和小屏全屏样式；modal 接收事件，HUD 中按钮恢复 pointer events。

### Task 6: 文档、视觉与完整验收

**Files:**
- Create: `session/requirements/gang-tree-idle-unlocks.md`
- Modify: `session/session.md`

- [ ] **Step 1:** 格式、typecheck、lint、format check、全部测试、build。
- [ ] **Step 2:** 启动固定本地端口 HTTP 冒烟，验证 200 后停止完整进程树。
- [ ] **Step 3:** 无头浏览器截图；视觉检查默认仅修车厂完整，其余五个锁定地块、HUD 帮派等级、帮派树 50 节点和 modal。
- [ ] **Step 4:** 更新 session，记录映射、公式、持久化、测试计数和验收。

## Final Verification

- [ ] 默认 Lv.1 Prospect，仅修车厂解锁。
- [ ] 职位阈值与建筑顺序精确匹配设计。
- [ ] 声望每秒 +5，1470 封顶，离线最多 8h。
- [ ] 50 个等级节点、七职位、六建筑里程碑全部可见。
- [ ] 锁定建筑不可升级，解锁后出现 1 级模型并可升级。
- [ ] 物流中心已完整替换为金属加工厂。
- [ ] 刷新后本地进度恢复并结算离线收益。
- [ ] 桌面/小屏 UI 可操作且不穿透。
- [ ] 全量检查、构建、HTTP 和截图通过。
- [ ] 无 `.git/`，未配置飞书 CLI。
