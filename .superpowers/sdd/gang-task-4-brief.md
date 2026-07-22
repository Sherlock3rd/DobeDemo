# Gang Task 4：帮派树、HUD 与锁定建筑面板

## 约束

工作区：`d:\charlie\dobe demo`。帮派规则/store 已完成。本任务只创建/修改 UI 与测试，不修改 App、场景或 CSS。为保持当前 App 类型检查，`CityHud.onOpenGangTree` 在此任务暂时允许 optional；Task5 必须传入真实 callback。严格 TDD，不初始化 Git。

## CityHud

`CityHudProps`：

```ts
interface CityHudProps {
  onOpenGangTree?: () => void
}
```

显示：

- 标题 `工业城改造计划`
- `Lv. N`
- 当前职位：英文 + `（中文）`
- 本级声望进度，例如 `10 / 30`
- `<progress>`，max30，value current
- `+5 声望/秒`
- 按钮 `打开帮派树`，点击 callback
- 原操作提示保留

订阅 totalReputation，并使用纯规则派生，不在组件内重复公式。

## GangTreePanel

Props：

```ts
interface GangTreePanelProps {
  open: boolean
  onClose: () => void
}
```

- open=false 返回 null。
- `role="dialog"`、`aria-modal="true"`、标题 `帮派树`。
- overlay 与 panel 的 pointerDown/click stopPropagation，不能触发父级场景。
- 关闭按钮 aria-label `关闭帮派树`。
- open 时注册 keydown，Escape 关闭；close/unmount 移除。
- 显示当前 `Lv. N`、职位、总声望。
- 显示下一职位与所需等级；Lv50 显示 `已达到最高职位`。
- 渲染恰好50个 level list item，每项可访问名称含 `等级 N`。
- 状态：
  - level < current：`data-state="completed"`
  - == current：`data-state="current"` + `aria-current="step"`
  - > current：`data-state="locked"`
- 1/8/16/24/32/40/50 显示职位中英文。
- 1/8/16/24/32/40 显示对应建筑名及 `已解锁`/`待解锁`。

## BuildingPanel

继续显示关闭按钮。

根据 totalReputation 派生 gang level 与 `getBuildingUnlock`：

- 已解锁：原等级说明和升级按钮行为不变。
- 锁定：
  - 标题建筑名
  - 状态 `尚未解锁`
  - `需要 Lv. X · Role（中文职位）`
  - `当前 Lv. N / X`
  - 不渲染任何升级按钮
  - 不调用 upgradeBuilding

未知 unlock 或目录安全返回 null。

## TDD

新增 `CityHud.test.tsx`：

- rep=0 显示 Lv1 Prospect（见习）、0/30、+5声望/秒。
- rep=220（Lv8，余10）显示 Full Patch（正式成员）、10/30。
- 点击打开按钮调用 callback。

新增 `GangTreePanel.test.tsx`：

- closed null。
- open 有50等级节点、7职位文本、6建筑名。
- rep0 当前等级1，1级 current、2级 locked，修车厂已解锁，废车回收厂待解锁。
- rep达到Lv16时状态正确。
- 关闭按钮/Escape。
- 父级 click/pointer spy 不调用。
- Lv50最高职位文案。

修改 `BuildingPanel.test.tsx`：

- beforeEach 同时 reset city/gang store并清 localStorage。
- 默认选修车厂仍可升级。
- 默认选废车回收厂显示锁定条件、无升级按钮。
- 将 reputation 设为 Lv8 阈值后，废车回收厂显示升级按钮。
- gas 等原测试在需要时先设为解锁阈值，保持既有覆盖。

最终：

```powershell
npm.cmd test -- src/ui
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
```

报告写 `.superpowers/sdd/gang-task-4-report.md`，含三组 RED/GREEN、测试数、事件与锁定边界、自审。最终仅返回状态、摘要、关注事项。
