# Debug Settings Account Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加 HUD 设置入口和可访问调试设置面板，通过二次确认把帮派与城市进度恢复为可持久化的初始账号。

**Architecture:** 独立 `resetAccount` 协调现有两个 Zustand store，不直接读写浏览器存储。`SettingsPanel` 只管理确认 UI，`App` 管理与帮派树互斥的模态开关；现有 persist/safe storage 负责写回初始账号。

**Tech Stack:** TypeScript 6、React 19、Zustand 5 persist、Testing Library、Vitest 4、Vite 8

## Global Constraints

- 重置范围必须同时覆盖帮派声望/挂机时间、建筑等级/碎片进度和当前建筑选择。
- 帮派 reset 时间使用确认操作发生时的 `Date.now()`，不得继承旧离线时长。
- 重置后不得刷新页面。
- 设置与帮派树模态互斥。
- 重置必须二次确认；首次点击不得修改任何 store。
- 不直接操作 `localStorage`，继续使用 store persist 与 safe storage。
- 桌面居中模态、移动端底部抽屉；不得阻断未打开时的画布拖动。
- 不增加其它设置项、路由、依赖或后端。
- 子代理不得 commit/push；每个任务审查通过后由父代理分段提交。

---

### Task 1: 统一账号重置协调器

**Files:**

- Create: `src/game/resetAccount.ts`
- Create: `src/game/resetAccount.test.ts`

**Interfaces:**

- Consumes:
  - `useCityStore.getState().reset(): void`
  - `useGangStore.getState().reset(now: number): void`
- Produces:

```ts
export function resetAccount(now: number = Date.now()): void
```

- [ ] **Step 1: 写双 store 失败测试**

```ts
it('restores both progression stores and clears the selected building', () => {
  useGangStore.setState({ totalReputation: 480, lastUpdatedAt: BASE_TIME })
  useCityStore.setState({
    selectedBuildingId: 'repair-shop',
    buildingProgress: {
      ...useCityStore.getState().buildingProgress,
      'repair-shop': { level: 7, completedFragments: 4 },
    },
  })

  resetAccount(RESET_TIME)

  expect(useGangStore.getState().totalReputation).toBe(0)
  expect(useGangStore.getState().lastUpdatedAt).toBe(RESET_TIME)
  expect(useCityStore.getState().selectedBuildingId).toBeNull()
  expect(useCityStore.getState().buildingProgress['repair-shop']).toEqual({
    level: 1,
    completedFragments: 0,
  })
})
```

- [ ] **Step 2: 运行 RED**

Run: `npm.cmd test -- src/game/resetAccount.test.ts`

Expected: FAIL because `resetAccount.ts` does not exist.

- [ ] **Step 3: 实现最小协调器**

```ts
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'

export function resetAccount(now: number = Date.now()): void {
  useCityStore.getState().reset()
  useGangStore.getState().reset(now)
}
```

- [ ] **Step 4: 补持久化断言**

测试解析 `CITY_STORAGE_KEY` 与 `GANG_STORAGE_KEY`，断言城市六建筑均为 Lv.1/0、帮派为 0 声望且时间为 `RESET_TIME`；再调用 `persist.rehydrate()`，状态仍是初始账号。

- [ ] **Step 5: 补非有限时间测试**

用 `vi.setSystemTime(FALLBACK_TIME)` 调用 `resetAccount(Number.NaN)`，断言 gang `lastUpdatedAt === FALLBACK_TIME`。

- [ ] **Step 6: 验证**

Run:

```powershell
npm.cmd test -- src/game/resetAccount.test.ts src/store
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: all exit 0.

### Task 2: 设置入口、二次确认面板与模态互斥

**Files:**

- Create: `src/ui/SettingsPanel.tsx`
- Create: `src/ui/SettingsPanel.test.tsx`
- Modify: `src/ui/CityHud.tsx`
- Modify: `src/ui/CityHud.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.css`

**Interfaces:**

- Consumes: `resetAccount(now?: number): void`
- Produces:

```ts
export interface SettingsPanelProps {
  onClose: () => void
}

export interface CityHudProps {
  onOpenGangTree?: () => void
  onOpenSettings?: () => void
}
```

- [ ] **Step 1: 写 CityHud 设置入口 RED**

```tsx
it('calls onOpenSettings from the debug settings button', async () => {
  const onOpenSettings = vi.fn()
  render(<CityHud onOpenSettings={onOpenSettings} />)

  await userEvent.setup().click(
    screen.getByRole('button', { name: '打开调试设置' }),
  )

  expect(onOpenSettings).toHaveBeenCalledTimes(1)
})
```

Run: `npm.cmd test -- src/ui/CityHud.test.tsx`

Expected: FAIL because the settings button is absent.

- [ ] **Step 2: 实现 HUD 双按钮**

用 `.city-hud__actions` 包裹现有帮派树按钮和新增按钮：

```tsx
<button
  type="button"
  className="city-hud__open-settings"
  aria-label="打开调试设置"
  onClick={onOpenSettings}
>
  设置
</button>
```

- [ ] **Step 3: 写 SettingsPanel RED**

覆盖：

```tsx
it('requires a second confirmation before resetting', async () => {
  render(<SettingsPanel onClose={onClose} />)
  await user.click(screen.getByRole('button', { name: '重置账号' }))

  expect(useGangStore.getState().totalReputation).toBe(480)
  expect(screen.getByRole('button', { name: '确认重置账号' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '确认重置账号' }))
  expect(useGangStore.getState().totalReputation).toBe(0)
  expect(onClose).toHaveBeenCalledTimes(1)
})
```

同时测试取消、关闭、Escape、`role="dialog"`、警告文案、父级 pointer/click 不触发。

- [ ] **Step 4: 实现 SettingsPanel**

组件内部使用 `useState(false)` 管理 `confirming`。首次危险按钮只进入确认态；确认调用 `resetAccount(Date.now())` 后关闭。挂载期间监听 Escape，卸载时移除监听。

- [ ] **Step 5: 写 App 互斥 RED**

测试：

- 默认没有“调试设置” dialog。
- 点击 HUD 设置按钮打开。
- 关闭按钮关闭。
- 先开帮派树，再通过重新可用入口打开设置时只保留设置 dialog。
- 先开设置、关闭后开帮派树时只保留帮派树 dialog。

- [ ] **Step 6: 实现 App 状态**

```tsx
const [settingsOpen, setSettingsOpen] = useState(false)

const openGangTree = () => {
  setSettingsOpen(false)
  setGangTreeOpen(true)
}

const openSettings = () => {
  setGangTreeOpen(false)
  setSettingsOpen(true)
}
```

条件挂载设置面板，确保关闭后确认态销毁。

- [ ] **Step 7: 实现响应式样式**

新增：

- `.city-hud__actions`
- `.city-hud__open-settings`
- `.settings-panel__overlay`
- `.settings-panel`
- 标题、说明、设置项、危险按钮、确认警告、确认/取消按钮

桌面 `width:min(30rem,100%)` 居中；`max-width:45rem` 下改为底部抽屉。将设置 overlay/panel/按钮加入 reduced-motion 规则。

- [ ] **Step 8: 验证**

Run:

```powershell
npm.cmd test -- src/ui/CityHud.test.tsx src/ui/SettingsPanel.test.tsx src/App.test.tsx
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: all exit 0.

### Task 3: 集成验收、文档与 GitHub Pages 发布

**Files:**

- Modify: `README.md`
- Modify: `session/session.md`
- Modify: `docs/superpowers/plans/2026-07-23-debug-settings-account-reset.md`
- Create: `.superpowers/sdd/settings-reset-report.md`
- Create: `.superpowers/sdd/settings-reset-cdp.mjs`
- Create: `.superpowers/sdd/settings-reset-results.json`
- Create: `.superpowers/sdd/settings-reset-confirm.png`
- Create: `.superpowers/sdd/settings-reset-complete.png`
- Create: `.superpowers/sdd/settings-reset-mobile.png`

**Interfaces:**

- Public entry: HUD button `aria-label="打开调试设置"`
- Dialog: `role="dialog"` with name `调试设置`
- Actions: `重置账号` → `确认重置账号`
- Persistent keys: `dobe-city-progression-v1`, `gang-progression-v1`

- [ ] **Step 1: fresh 工程门禁**

Run:

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Expected: all exit 0; build assets use `/DobeDemo/`.

- [ ] **Step 2: 编写安全 CDP 验收**

沿用 `.superpowers/sdd/fragmented-upgrades-cdp.mjs` 的端口 preflight、只终止自建进程、临时 profile、失败非零和断言自检。

真实流程：

1. 注入 Lv.12 帮派声望与修车厂 Lv.6/3 碎片存档。
2. 打开修车厂证明非初始建筑状态。
3. 点击设置，断言帮派树未打开。
4. 首次点击重置，断言 store/HUD/建筑面板仍未变化并截图确认态。
5. 确认重置，断言 dialog 与建筑面板关闭、HUD 为 Lv.1。
6. 重新打开修车厂，断言 Lv.1/10、0/2。
7. 刷新后再次断言双存档保持初始。
8. 390×844 下设置抽屉不横向溢出并截图。

- [ ] **Step 3: 文档与报告**

README 增加设置/重置操作；session 记录功能与验收。报告写明命令、断言、截图、进程安全和公开发布结果。

- [ ] **Step 4: 分段提交**

父代理提交：

1. reset 协调器。
2. 设置 UI 与 App 集成。
3. 验收证据与文档。

每次提交前检查 status/diff/log，不提交 secrets、`dist` 或临时 profile。

- [ ] **Step 5: 发布与公开复验**

1. 普通推送 `main`。
2. 用独立临时 index 把 fresh `dist` 快进推送到 `gh-pages`。
3. 验证 Pages source 为 `gh-pages:/` 且 status built。
4. 验证公开 HTML、当前 JS、CSS HTTP 200。
5. 用真实 Chrome 加载公开 URL 并保存渲染截图。
