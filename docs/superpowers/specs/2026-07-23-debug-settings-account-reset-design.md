# 调试设置与重置账号设计

## 目标

在城市 HUD 增加“设置”入口，打开独立调试设置面板。首个调试功能为“重置账号”：

- 清空帮派声望并恢复 Lv.1 Prospect（见习）。
- 把挂机结算基准时间更新为重置发生时间，避免重新获得旧账号的离线收益。
- 把六座建筑恢复为 Lv.1、0 个碎片。
- 清除当前建筑选择，使除修车厂外的建筑随帮派等级恢复锁定状态。
- 将初始状态写回现有持久化存档，刷新页面后仍保持初始账号。

## 已确认交互

- HUD 同时显示“打开帮派树”和“设置”两个入口。
- 设置使用独立模态对话框，不挤压 HUD 主信息。
- 设置面板与帮派树互斥，打开其中一个会关闭另一个。
- “重置账号”采用面板内二次确认，不允许单击直接清档。
- 确认重置后关闭设置面板，不刷新页面。
- 支持关闭按钮与 Escape；取消确认可返回设置首页。

## 方案

### 统一账号重置

新增 `src/game/resetAccount.ts`：

```ts
export function resetAccount(now: number = Date.now()): void
```

执行顺序：

1. `useCityStore.getState().reset()`。
2. `useGangStore.getState().reset(now)`。

两个 Zustand reset 都是同步操作；在同一个 React 点击事件内调用时，界面只呈现最终初始状态。persist 中间件使用现有 safe storage 把初始值写回：

- `dobe-city-progression-v1`
- `gang-progression-v1`

`now` 非有限值时，帮派 store 已有 reset 会回退到 `Date.now()`。重置模块不直接操作 `localStorage`，避免绕过 safe storage 或造成内存回退状态与浏览器存储不一致。

### HUD 入口

`CityHudProps` 增加：

```ts
onOpenSettings?: () => void
```

HUD 操作按钮放入 `.city-hud__actions`：

- 主按钮：“打开帮派树”
- 次按钮：“设置”，`aria-label="打开调试设置"`

按钮都保留在 HUD 唯一可接收指针事件的区域，不改变画布拖动规则。

### 设置面板

新增 `src/ui/SettingsPanel.tsx`：

```ts
export interface SettingsPanelProps {
  onClose: () => void
}
```

仅在 `App` 的 `settingsOpen === true` 时挂载，因此关闭后内部确认态自然销毁。

默认内容：

- 标题“调试设置”
- 说明“仅用于 Demo 调试”
- 设置项“账号”
- 危险按钮“重置账号”

首次点击“重置账号”：

- 不修改 store。
- 显示警告：声望、职位、建筑解锁、建筑等级和碎片进度都会恢复初始状态。
- 显示“取消”和“确认重置账号”。

点击确认：

1. 调用 `resetAccount(Date.now())`。
2. 调用 `onClose()`。

点击取消只退出确认态。关闭按钮或 Escape 直接关闭整个面板。

对话框结构：

- overlay 阻止 pointer/click 传播到 3D 场景。
- `role="dialog"`、`aria-modal="true"`、`aria-labelledby`。
- 关闭按钮具名为“关闭调试设置”。
- 危险操作使用明确文案，不只依赖红色表达风险。

### App 状态

`App` 管理：

```ts
const [gangTreeOpen, setGangTreeOpen] = useState(false)
const [settingsOpen, setSettingsOpen] = useState(false)
```

互斥打开：

- 打开帮派树：先关闭设置，再打开帮派树。
- 打开设置：先关闭帮派树，再打开设置。

设置面板条件挂载：

```tsx
{settingsOpen ? <SettingsPanel onClose={() => setSettingsOpen(false)} /> : null}
```

## 样式

- 设置 overlay 与帮派树使用相同的暗色遮罩、模糊背景和 z-index 层级。
- 桌面面板宽度不超过 30rem，居中显示。
- 移动端使用全宽底部抽屉，留出安全边距并允许纵向滚动。
- 危险按钮使用红色边框/背景；确认态警告有可读文本。
- focus-visible 清晰可见。
- `prefers-reduced-motion: reduce` 禁用 overlay/panel 入场和按钮位移动画。

## 测试

### `resetAccount`

- 非初始帮派声望与建筑进度被恢复。
- 当前建筑选择清空。
- gang `lastUpdatedAt` 等于传入时间。
- city/gang 两个 localStorage 存档均为初始值。
- 非有限时间安全回退。

### `CityHud`

- 渲染“设置”按钮。
- 点击只调用 `onOpenSettings` 一次。
- 现有帮派树按钮不回归。

### `SettingsPanel`

- 默认显示调试设置与重置入口。
- 首次点击不重置账号，只显示警告与确认按钮。
- 取消后状态不变并返回默认页。
- 确认后双 store 恢复且调用 `onClose`。
- Escape/关闭按钮调用 `onClose`。
- overlay/panel 操作不冒泡到父场景。

### `App`

- 默认不显示设置 dialog。
- HUD 设置按钮打开 dialog。
- 关闭按钮关闭 dialog。
- 打开设置会关闭帮派树，反之亦然。

### 浏览器与发布

- 本地真实浏览器把账号推进到非初始状态。
- 打开设置，首次点击后账号不变。
- 确认后 HUD 回到 Lv.1、建筑面板关闭、修车厂为 Lv.1 / 0 碎片。
- 刷新后仍为初始账号。
- 桌面与移动设置面板不溢出。
- 通过格式、类型、Lint、全量测试、构建后普通推送 `main`，更新 `gh-pages` 并验证公开 URL 与当前资源 HTTP 200。

## 非目标

- 本次不增加音量、画质、语言、作弊数值输入或解锁调试。
- 不增加账号导入/导出。
- 不增加撤销重置；安全性由二次确认提供。
- 不引入路由、后端账号或云存档。
