# Gang Task 4 报告：帮派树、HUD 与锁定建筑面板

## 状态

完成。三组 UI 均按 RED → GREEN 严格 TDD 完成，`npm test`/`npm run typecheck`/`npm run lint` 全部通过。未修改 `App.tsx`、场景（`scene/`）或任何 CSS 文件；未执行任何 Git 初始化/提交操作。

## 约束遵循

- `CityHudProps.onOpenGangTree` 按 brief 声明为 `onOpenGangTree?: () => void`（可选），组件内新增 `props = {}` 默认值以保持无 props 调用可用。
- HUD/GangTreePanel/BuildingPanel 的数值展示均通过 `gangProgression.ts` 中既有纯函数（`getGangLevel`/`getGangRole`/`getNextGangRole`/`getLevelProgress`/`getBuildingUnlock`/`isBuildingUnlocked`/`getTotalReputationForLevel`）派生，组件内未重复任何等级/声望计算公式。
- 唯一超出三组 UI 范围的改动：修正了既有 `src/App.test.tsx` 中"预选中建筑"用例——原用例预选 `gas-station`（现需要 Lv.32 才解锁，默认 Lv.1 下会渲染锁定面板导致断言失效），改为预选恒定解锁的 `repair-shop`，未触碰 `App.tsx` 源码。

## 三组 RED/GREEN 记录

### 1. CityHud

- RED：新增 `src/ui/CityHud.test.tsx`（4 个用例：标题/提示保留、rep=0 展示 Lv1 Prospect 与 0/30、rep=220 展示 Lv8 Full Patch 与 10/30、点击"打开帮派树"触发回调），运行确认 3 个用例因组件未实现而失败（1 个原标题/提示用例天然通过）。
- GREEN：重写 `src/ui/CityHud.tsx`，订阅 `useGangStore` 的 `totalReputation`，渲染 `Lv. N`、`职位（中文）`、`current / required` 文案、`<progress max=30 value=current>`、`+5 声望/秒`、"打开帮派树"按钮（`onClick={onOpenGangTree}`），保留原标题与操作提示。4/4 通过。
- 同时把原先混在 `BuildingPanel.test.tsx` 内的 `describe('CityHud', …)` 迁移进新文件，避免测试重复分散。

### 2. GangTreePanel

- RED：新增 `src/ui/GangTreePanel.tsx`（尚不存在）与 `src/ui/GangTreePanel.test.tsx`（8 个用例），运行因模块缺失整体失败。
- GREEN：新增 `src/ui/GangTreePanel.tsx`：
  - `open=false` 返回 `null`；hooks（`keydown` 监听）在条件返回之前注册，满足 React hooks 规则且保证卸载/关闭时正确移除监听。
  - 外层 overlay `div` 与内层 `role="dialog" aria-modal="true"` 的 `section` 均绑定 `onPointerDown`/`onClick` 的 `stopPropagation`。
  - 关闭按钮 `aria-label="关闭帮派树"`；`Escape` 触发 `onClose`；`open` 变为 `false` 或组件卸载后监听移除（测试验证二次 `Escape` 不再触发）。
  - 顶部展示当前 `Lv. N · Role（中文） · 总声望 X`；`getNextGangRole` 为空时展示"已达到最高职位"，否则展示"下一职位：… · 需要 Lv. N"。
  - 用 `Array.from` 生成恰好 50 个 `<li>`，每项文本节点以 `等级 N` 开头（可访问名称天然包含该串），并通过 `data-state`（`completed`/`current`/`locked`）与 `aria-current="step"`（仅 current）标注状态；1/8/16/24/32/40/50 额外渲染职位中英文；1/8/16/24/32/40 额外渲染对应建筑名 + `已解锁`/`待解锁`（依据 `state !== 'locked'` 判定，等价于当前帮派等级 ≥ 该等级）。
  - 8/8 用例通过，覆盖：关闭态、开启态节点与文案数量、Lv0 与 Lv16 状态边界、关闭按钮、Escape 开关行为、父级事件隔离、Lv50 文案。

### 3. BuildingPanel（锁定分支）

- RED：重写 `src/ui/BuildingPanel.test.tsx`（11 个用例，`beforeEach` 同时 `useCityStore.getState().reset()` 与 `useGangStore.getState().reset(BASE_TIME)` 并清空 `localStorage`），运行确认新增的"废车回收厂锁定展示"与"缺失 unlock 配置返回 null"两个用例失败，其余因逻辑未变继续通过。
- GREEN：修改 `src/ui/BuildingPanel.tsx`：
  - 新增基于 `getBuildingUnlock`/`getGangLevel`/`isBuildingUnlocked` 的解锁判定；`getBuildingUnlock` 返回 `null`（目录外或 unlock 配置缺失）时直接返回 `null`，与既有"目录缺失"分支行为一致。
  - 锁定态渲染：建筑名标题保留、关闭按钮保留、`尚未解锁`、`需要 Lv. X · Role（中文职位）`、`当前 Lv. N / X`，不渲染升级按钮，不调用 `upgradeBuilding`（用例断言锁定态查询升级/满级按钮均不存在，交互上不可能触发升级）。
  - 解锁态保持原有等级说明与升级按钮行为（含满级禁用）不变。
  - 11/11 通过，覆盖：默认修车厂可升级、废车回收厂锁定展示与无升级按钮、达到 Lv8 后废车回收厂可升级、加油站（Lv32 阈值设置后）升级/满级流程、关闭交互、父级事件隔离（解锁态与锁定态各一次）、目录缺失、unlock 配置缺失。

## 验证摘要

```
npm.cmd test -- src/ui          → 4 files / 25 tests passed
npm.cmd test                    → 15 files / 167 tests passed
npm.cmd run typecheck           → 0 errors
npm.cmd run lint                → 0 errors/warnings
```

## 事件与锁定边界确认

- HUD 打开帮派树按钮：`onOpenGangTree` 未提供时按钮可点击但不产生副作用（`onClick={undefined}` 合法），提供时点击触发 1 次回调。
- GangTreePanel：Escape 仅在 `open=true` 期间生效；`open` 变为 `false` 后触发的 `Escape` 不再调用 `onClose`（测试用 `rerender` 验证调用次数保持 1 次不增）。overlay 与内层面板的 `click`/`pointerDown` 均已 `stopPropagation`，父级场景处理函数在关闭按钮点击、面板本体点击场景下均未被调用。
- 建筑锁定边界：以 `getTotalReputationForLevel(requiredLevel)` 精确构造"刚好达到解锁阈值"的声望值验证解锁态渲染与升级按钮出现；`requiredLevel - 1` 场景（默认 Lv1）保持锁定文案且不渲染任何升级/满级按钮。

## 自审

- 未修改 `App.tsx`、`scene/` 下任何文件或任意 `.css` 文件；确认 `git status`/提交流程均未涉及（未初始化 Git，也未执行任何 git 命令）。
- 三个组件的数值展示均来自 `gangProgression.ts` 既有纯函数，未在组件内新增等级/声望计算逻辑，避免与 store/规则重复实现产生偏差。
- `BuildingPanel.test.tsx` 中用 `BUILDING_UNLOCKS.splice` 临时移除一条 unlock 配置来覆盖"目录安全返回 null"分支，测试内以 `try/finally` 还原，不影响其他测试用例的状态。

## 关注事项

- `src/App.test.tsx` 中原"预选中建筑"用例预选的是 `gas-station`（Lv32 才解锁），在引入锁定面板后于默认 Lv1 状态下会失败；已将该用例改为预选恒定解锁的 `repair-shop`，仅改测试数据，未触碰 `App.tsx` 源码。后续 Task5 为 `CityHud.onOpenGangTree` 传入真实回调时，请留意 `App.tsx` 组装处仍需引入 `GangTreePanel` 并管理其 `open` 状态（本任务未做该接线，按 brief 要求保留给 Task5）。
- `GangTreePanel` 与锁定态 `BuildingPanel` 新增了若干未在现有 CSS 中定义样式的 class 名（如 `gang-tree-panel__*`、`building-panel__lock-*`），当前无视觉样式，纯结构/文案已就位；后续如需样式需在允许修改 CSS 的任务中补充，不属于本任务范围。
