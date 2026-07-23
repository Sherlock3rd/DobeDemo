# Layout Task 4 报告：拖动阈值、误点击抑制与光标

## 状态

已完成。严格按分组 TDD（每组先写测试确认 RED，再实现到 GREEN）。未做 Git commit/push。未改动布局/帮派规则。

## 分组 RED/GREEN 记录

| 分组 | 新增/修改文件 | RED | GREEN |
| --- | --- | --- | --- |
| 1. Pointer tracker | `pointerDragTracker.ts` / `.test.ts` | import 未解析（0 test 失败） | 15 tests 通过 |
| 2. Cursor controller | `cityCursorController.ts` / `.test.ts` | import 未解析（0 test 失败） | 9 tests 通过 |
| 3. Gesture component | `CityPointerGestures.tsx` / `.test.tsx` | import 未解析（0 test 失败） | 5 tests 通过 |
| 4a. Click helper | `pointerDragClick.ts` / `.test.ts` | import 未解析（0 test 失败） | 7 tests 通过 |
| 4b. InteractiveBuilding | `InteractiveBuilding.tsx`（改）/ `.test.tsx` | 4/5 失败（原实现无抑制、仍写 document.body 光标） | 5 tests 通过 |
| 4c. CityScene | `CityScene.tsx`（改）/ `.test.tsx` | 2/3 失败（未挂 gesture、背景 click 无抑制） | 3 tests 通过 |
| 5. CSS | `App.css`（改） | 无单测（视觉 fallback） | — |

## 关键实现点

### 阈值（6px，严格大于）

- `POINTER_DRAG_THRESHOLD_PX = 6`；`Math.hypot(dx, dy) > 6` 才判定 dragged。
- 用例覆盖：5px、6px 均不算拖动；7px 与对角线 (5,5)≈7.07 算拖动；对角线 (4,4)≈5.66 不算。

### 多 pointer 独立

- 每个 pointerId 独立记录起点与 dragged 标志（`Map<number, ActivePointer>`）。
- `isDragging()` 在任意 active pointer dragged 时为 true。
- unknown id 的 `pointerMove` 返回 false。
- 同 ID 重新 `pointerDown` 会先清除该 ID 的陈旧待消费状态（`completedDrags.delete`）。

### Click 抑制

- `consumeDraggedClick` 对匹配 ID 只返回一次 true（基于 `Set.delete` 语义）。
- `pointerUp`：dragged 转入 `completedDrags` 待消费集合；否则清理。
- `pointerCancel` 同时清除 active 与 completed。
- 共享辅助 `pointerDragClick.ts`：`getPointerId`（类型守卫读取 `nativeEvent.pointerId`，非有限值/缺失时回退鼠标 ID `1`）+ `consumePointerDrag`。无 `any`；fallback 路径有专门单测（null/undefined/非对象/NaN/非数字）。
- `InteractiveBuilding` click 一律 `stopPropagation`，drag click 直接 return 不 select；`CityScene` 背景 group click drag 时不 `clearSelection`。

### Listener 清理

- `CityPointerGestures` 用 `useThree((s) => s.gl.domElement)` 取 Canvas，`useEffect` 中以命名函数引用注册 `pointerdown/move/up/cancel`。
- unmount：以同一函数引用逐个 `removeEventListener`，随后 `tracker.reset()` + cursor `unregister()` + `reset()`。
- 测试用 `vi.spyOn(canvas, 'addEventListener'/'removeEventListener')` 精确校验 4 类事件 add/remove 一一配对，并断言 unmount 后光标恢复为原值、tracker 清空。

### Cursor 优先级

1. dragging → `grabbing`
2. 任意 building hovered → `pointer`
3. 默认 → `grab`

- 光标写入注册元素的内联 `style.cursor`（覆盖 CSS），不再污染 `document.body`。
- 多个建筑共享 hover 所有权由 controller 内部 `Set<BuildingId>` 维护；unregister/reset 恢复元素原 `cursor`。
- 替换了 `InteractiveBuilding` 原先的模块级 `hoveredBuildingIds` Set 与 `document.body.style.cursor` 写法，hover 归属改由 `cityCursorController.setBuildingHovered` 管理，组件卸载时释放。

### CSS

- `.city-app__canvas { cursor: grab; }` 作为无 JS fallback；`touch-action: none` 保留。
- controller 内联状态（grab/grabbing/pointer）覆盖 CSS。UI 按钮 cursor 保持 pointer（未改动）。

## 测试数

- 本任务新增 6 个测试文件，合计 **44** 个新增用例：
  - `pointerDragTracker.test.ts`：15
  - `cityCursorController.test.ts`：9
  - `CityPointerGestures.test.tsx`：5
  - `pointerDragClick.test.ts`：7
  - `InteractiveBuilding.test.tsx`：5
  - `CityScene.test.tsx`：3
- `npm.cmd test -- src/scene/city`：11 files / 74 tests 全通过。
- `npm.cmd test`（全量）：25 files / 257 tests 全通过。

## 验证结果

| 命令 | 结果 |
| --- | --- |
| `npm.cmd test -- src/scene/city` | 通过（74） |
| `npm.cmd test` | 通过（257） |
| `npm.cmd run typecheck` | 通过 |
| `npm.cmd run lint` | 通过 |
| `npm.cmd run format:check` | 本任务全部文件通过；仅剩下述预存在文件告警 |

## 自审 / 关注事项

- **format:check 预存在告警（非本任务引入）**：`src/game/cityLayout.test.ts`、`src/game/placementGeometry.ts`、`src/game/placementGeometry.test.ts`、`src/scene/city/CityCameraControls.test.tsx` 属 Task 1–3 产出，未在本任务范围内，故未 `--write`（避免触碰布局/相机规则文件）。本任务新增/修改的全部文件均已通过 prettier 校验。如需整仓 format:check 干净，需要另行处理这些文件。
- **测试非只测 mock**：tracker/controller/helper 均直接验证真实模块行为；gesture/组件测试用真实 jsdom HTMLElement 派发带 `pointerId/clientX/clientY` 的事件，仅 mock `useThree` 与重量级三维子组件（避免 Canvas/three 依赖），断言的是共享单例的真实状态与 DOM 光标。
- **stopPropagation 断言方式**：react-dom（非 R3F reconciler）下 `<mesh>` 走原生 DOM 委托，合成 `stopPropagation` 会调用原生 `stopPropagation`，因此改为 spy 原生事件的 `stopPropagation` 被调用；这是 jsdom 环境的等价校验，非弱化。
- **共享单例耦合**：`cityPointerDragTracker` 与 `cityCursorController` 为模块级单例，gesture/building/scene 均依赖之；相关测试均在 `beforeEach` 中 `reset()` 以避免跨用例串扰。
- **fallback pointerId=1**：现代浏览器 click 为 PointerEvent，但类型可能暴露为 MouseEvent；缺失/非有限 `pointerId` 时回退鼠标 ID 1，已覆盖对应单测。

---

# 审查修复（v2）

针对审查中的 Important 项，继续严格测试先行（RED → GREEN）修复。未新增依赖，未改布局/帮派规则，未 commit/push。

## 修复项与 RED/GREEN

| 项 | 变更文件 | RED | GREEN |
| --- | --- | --- | --- |
| 1. 触控 pointerId 不一致 → tracker 手势安全消费 | `pointerDragTracker.ts` / `.test.ts` | 新增 5 用例，3 失败（跨 ID 消费、exact 优先+回退、active 空开新手势清陈旧） | tracker 21 tests 通过 |
| 2. 共享 handled marker（消除唯一依赖 stopPropagation） | `pointerDragClick.ts` / `.test.ts`、`InteractiveBuilding.tsx` / `.test.tsx`、`CityScene.tsx` / `.test.tsx`、`dragClickSuppression.test.tsx`(新) | marker 4 用例 fn 未定义失败；building/scene/集成 5 用例失败 | 全通过 |
| 3. `lostpointercapture` 监听 | `CityPointerGestures.tsx` / `.test.tsx` | 2 失败（行为=cancel、add/remove 配对 4≠5） | gesture 6 tests 通过 |
| 4. 修复 4 个既有 Prettier 告警 | `cityLayout.test.ts`、`placementGeometry.ts` / `.test.ts`、`CityCameraControls.test.tsx` | — | 全仓 format:check 通过 |

## 关键实现说明

### 1. Tracker 手势安全消费（触控 pointerId 不一致）

- `pointerDown`：仅当 `active.size === 0`（无任何按下指针）视为新手势起点并 `completedDrags.clear()` 清陈旧；手势进行中（active 非空）的后续 `pointerDown` **不清**，保留同一多指手势内早先完成的拖动。
- `consumeDraggedClick(id)`：先 exact 匹配（鼠标/一致设备）删除该 ID；exact 未命中且 `completedDrags` 非空，则消费当前手势的 completed（清空并返回 true），解决触控 click 的 pointerId 与拖动指针不同的问题。
- 新增测试覆盖：跨 ID 触控消费、exact 优先再回退、active 空开新手势清陈旧、多指后续 pointerDown 不清、未拖动不误消费。

### 2. 共享 native-event handled marker（不再唯一依赖 stopPropagation）

- `pointerDragClick.ts` 增加 `WeakSet<object>` 支撑的 `markPointerEventHandled` / `isPointerEventHandled`，对非对象 nativeEvent 安全忽略（类型守卫，无 `any`）。
- `InteractiveBuilding` click：先 `stopPropagation`（保留），再 `markPointerEventHandled(nativeEvent)`——**普通与拖动 click 都标记**；随后拖动则 return，否则 select。
- `CityScene` 背景 handler：**先检查 `isPointerEventHandled`** → 命中直接 return（既不 consume 也不 clear）；未命中再走原 consume/clear 逻辑。
- 集成测试 `dragClickSuppression.test.tsx`：渲染真实 `CityScene`+真实 `InteractiveBuilding`（仅 mock 视觉/相机/环境/gesture），用**同一个 `MouseEvent` 对象**先派发到建筑 hitbox、再派发到背景 group，断言：普通建筑选择不被背景清除、拖动场景也不清除。同时 `InteractiveBuilding.test` 断言 stopPropagation 仍被调用。

### 3. `lostpointercapture`

- 在 canvas 上新增 `lostpointercapture` 监听，语义同 `pointercancel`（`tracker.pointerCancel` + 同步光标）；卸载时以同一函数引用移除。
- 测试：行为等价 cancel（停止 dragging、光标回 grab、无可消费 click）；add/remove 配对测试的 `POINTER_EVENT_TYPES` 扩为 5 项并全部精确配对。

### 4. Prettier

- 对审查提及的 4 个既有告警文件仅执行 `prettier --write`（纯机械格式化，无逻辑改动；全量 272 测试与 typecheck 通过佐证行为不变）。

## 验证命令与结果（v2 最终）

| 命令 | 结果 |
| --- | --- |
| `npm.cmd test -- src/scene/city` | 通过：12 files / **89** tests |
| `npm.cmd test` | 通过：26 files / **272** tests |
| `npm.cmd run typecheck` | 通过（exit 0） |
| `npm.cmd run lint` | 通过（exit 0） |
| `npm.cmd run format:check` | 通过：`All matched files use Prettier code style!` |

## 测试数变化

- 本轮新增用例：tracker +5、marker helper +4、gesture +1、InteractiveBuilding +2、CityScene +1、集成新文件 +2，合计 **+15**，新增 1 个测试文件。
- scene/city：11 files/74 tests → **12 files/89 tests**；全仓 257 → **272**。

## v2 关注事项

- **同一 native event 跨组件测试**：依赖 jsdom 允许在一次 dispatch 完成后重复派发同一 `Event` 对象（dispatch 标志会在每次派发后复位），已实测通过；这是隔离“handled marker”与 stopPropagation 的必要手段（jsdom 下 stopPropagation 会阻断同一次 dispatch 的冒泡，故用两次显式派发验证 marker）。
- **回退消费的范围**：exact 未命中时回退清空当前手势的全部 completed；因新手势起点已清陈旧，pending 的 completed 必属最近一次手势，不会跨手势误消费。单指/多指、tap（未拖动）均有用例保障不误伤正常点击。
- **既有格式化文件**：`cityLayout.test.ts` 等相对上次提交仍有大量差异，但那是 Task1–3 的未提交内容，本轮仅对其做了 prettier 机械格式化。

---

# 复审修复（v3）：lostpointercapture 误删已完成拖动（Critical）

## 问题

Chrome/OrbitControls 的正常指针序列是 `pointerup → lostpointercapture → click`。v2 的 `lostpointercapture` handler 调用 `tracker.pointerCancel`，而 `pointerCancel` 会 `completedDrags.delete(id)`——于是 `pointerup` 刚生成的 completed drag 在紧随其后的 `lostpointercapture` 中被删除，导致其后的 `click` 不再被抑制（拖动结束仍会误触发 select/clearSelection）。

## 严格测试先行（RED → GREEN）

| 步骤 | 文件 | RED | GREEN |
| --- | --- | --- | --- |
| 复现真实序列 + 语义单测（5 项） | `pointerDragTracker.test.ts` | `tracker.pointerLostCapture is not a function`（5 失败） | tracker 25 tests 通过 |
| gesture 真实序列集成 | `CityPointerGestures.test.tsx` | `up→lostpointercapture` 后 `consume` 期望 true 实得 false（复现 Critical，1 失败） | gesture 7 tests 通过 |

## 变更

- `pointerDragTracker.ts`：
  - 接口新增 `pointerLostCapture(pointerId: number): void`。
  - 抽取内部 `endActivePointer(id)`（release 语义）：仅当该指针仍 active 时移除之，若其 `dragged` 则写入 completed；若已被 `pointerup`/`pointerCancel` 移除则 **no-op，绝不删除已存在的 completed**。`pointerUp` 与 `pointerLostCapture` 均复用它。
  - 关键差异：`pointerCancel` 仍会清除 active 与 completed（真正取消）；`pointerLostCapture` 只“收尾”，不清 completed。
- `CityPointerGestures.tsx`：`lostpointercapture` handler 由 `pointerCancel` 改为 `pointerLostCapture`。

## 覆盖的语义（单测）

1. `down→move>6→up→lostpointercapture` → `consumeDraggedClick` 为 **true**（Critical 修复，item 1/2）。
2. 中途丢失捕获且无 `pointerup`（`down→move>6→lostpointercapture`）→ 生成 completed，`consume` true、`isDragging` false。
3. 未拖动 `down→move(2px)→up→lostpointercapture` → `consume` **false**（item 4，不误抑制正常 click）。
4. `down→move>6→pointercancel→lostpointercapture` → `consume` **false**（item 3，取消后不得复活 completed）。
5. `lostpointercapture(unknown)` → no-op。
6. gesture 组件层：真实事件序列 `pointerup→lostpointercapture` 后仍可消费；非拖动丢失捕获不抑制。

## 验证命令与结果（v3 最终）

| 命令 | 结果 |
| --- | --- |
| `npm.cmd test -- src/scene/city` | 通过：12 files / **95** tests |
| `npm.cmd test` | 通过：26 files / **278** tests |
| `npm.cmd run typecheck` | 通过（exit 0） |
| `npm.cmd run lint` | 通过（exit 0） |
| `npm.cmd run format:check` | 通过：`All matched files use Prettier code style!` |

## 测试数变化

- tracker `pointerLostCapture` 新增 5 用例；gesture 由“类 cancel”1 用例替换为“真实序列可消费”+“非拖动不抑制”2 用例（净 +1）。合计 **+6**。
- scene/city：89 → **95**；全仓 272 → **278**。

## v3 关注事项

- `pointerCancel` 与 `pointerLostCapture` 现在语义有意不同：前者用于真正的手势取消（清 completed），后者用于捕获移交/收尾（保留 completed）。gesture 组件仍保留独立的 `pointercancel` 监听。
- 未改布局/帮派规则；未新增依赖；未 commit/push。
