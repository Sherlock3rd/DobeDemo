# Gang Task 5：3D 锁定地块与 App 集成

## 约束

工作区：`d:\charlie\dobe demo`。帮派规则/store/UI 已完成。本任务完成场景和 App/CSS 接线。严格 TDD；不初始化 Git。

## 可测试呈现模式

创建：

- `src/scene/city/buildingAccess.ts`
- `src/scene/city/buildingAccess.test.ts`

接口：

```ts
export type BuildingRenderMode = 'locked' | 'unlocked'
export function getBuildingRenderMode(
  buildingId: string,
  totalReputation: number,
): BuildingRenderMode
```

必须使用 `getGangLevel` + `isBuildingUnlocked`，未知 ID locked。测试 rep0 仅 repair unlocked；其余各自阈值前/后；超额声望。

## LockedBuildingPlot

创建 `src/scene/city/LockedBuildingPlot.tsx`：

```ts
interface LockedBuildingPlotProps {
  footprint: readonly [number, number]
  highlighted: boolean
}
```

footprint 已是城市渲染单位，不再乘 scale。

视觉：

- 低矮深灰施工地基。
- 四角立柱/围栏或斜向警示条。
- 中央暖黄色锁定标识（程序化 box/cylinder，不用文字/外部资源）。
- highlighted 时使用暖黄色 emissive；普通时暗色。
- mesh cast/receive shadow。
- 组件不处理点击。

## InteractiveBuilding

订阅 `useGangStore.totalReputation`，通过 `getBuildingRenderMode`：

- unlocked：渲染原有 scaled BuildingModel。
- locked：渲染 LockedBuildingPlot，传 renderedFootprint。

原命中盒、高亮底座、hover/cursor、点击选择逻辑完全保留，因此锁定地块可点击。不得根据锁定状态调用升级；升级只在面板。

## App TDD 与集成

修改 `src/App.test.tsx`：

- mock Canvas/CityScene/Loader 继续有效。
- mock `GangIdleController` 为可识别占位节点，避免 timer。
- 初始断言控制器存在。
- 点击 `打开帮派树` 后出现 role=dialog、50节点。
- 点击关闭后 dialog 消失。
- 现有正交相机、标题、repair面板测试继续通过。

先运行当前 App 确认新断言 RED，再修改 `App.tsx`。

App：

```tsx
const [gangTreeOpen, setGangTreeOpen] = useState(false)
```

在 main 内渲染：

- `<GangIdleController />`
- `<CityHud onOpenGangTree={() => setGangTreeOpen(true)} />`
- `<BuildingPanel />`
- `<GangTreePanel open={gangTreeOpen} onClose={() => setGangTreeOpen(false)} />`

关闭 modal 后焦点恢复不是本次硬要求，但按钮/close必须可键盘操作。AppErrorBoundary、Canvas、Loader 保留。

## CSS

修改 `src/App.css`：

- HUD 增加等级行、职位、progress、速率、帮派树按钮样式。
- `.city-hud` 保持 `pointer-events:none`，只有帮派树按钮 `pointer-events:auto`，不破坏画布平移。
- Gang modal overlay fixed inset0，z-index高于 BuildingPanel，深色 backdrop。
- panel 最大宽约720px、高度不超过90vh、可滚动、工业边框和黄色强调。
- 50节点纵向树；completed/current/locked 三种状态；职位里程碑和建筑解锁 badge明显。
- 关闭按钮至少40px，focus-visible清晰。
- overlay/panel接收事件。
- locked BuildingPanel 状态样式清楚。
- 小于720px modal全屏、面板无圆角或小边距；HUD紧凑。
- prefers-reduced-motion。

## 验证

```powershell
npm.cmd test -- src/scene/city/buildingAccess.test.ts src/App.test.tsx
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

报告写 `.superpowers/sdd/gang-task-5-report.md`，含两组 RED/GREEN、场景切换、App modal、测试数、typecheck/lint/format、自审。最终仅返回状态、摘要、关注事项。
