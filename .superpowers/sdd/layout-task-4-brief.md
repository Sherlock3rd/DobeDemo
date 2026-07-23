# Layout Task 4：拖动阈值、误点击抑制与光标

## 范围

工作区：`d:\charlie\dobe demo`。Task3 已完成 OrbitControls PAN 映射。本任务实现 Canvas 原生指针跟踪、6px 阈值、建筑/背景 click 抑制和 grab/grabbing/pointer 光标。不要改布局/帮派规则，不 commit/push。

## Pointer tracker

创建：

- `src/scene/city/pointerDragTracker.ts`
- `src/scene/city/pointerDragTracker.test.ts`

接口：

```ts
export const POINTER_DRAG_THRESHOLD_PX = 6

export interface PointerDragTracker {
  pointerDown(pointerId: number, x: number, y: number): void
  pointerMove(pointerId: number, x: number, y: number): boolean
  pointerUp(pointerId: number): void
  pointerCancel(pointerId: number): void
  consumeDraggedClick(pointerId: number): boolean
  isDragging(): boolean
  reset(): void
}

export function createPointerDragTracker(): PointerDragTracker
export const cityPointerDragTracker: PointerDragTracker
```

规则：

- 每个 pointer 独立记录起点和 dragged。
- 欧氏距离严格 `> 6` 才 dragged；5、6 都不是。
- pointerMove unknown id 返回 false。
- pointerUp：若 dragged，转入待消费集合；否则清理。
- consume 对匹配 ID 只返回一次 true。
- 新 pointerDown 同 ID 必须清除该 ID 的陈旧待消费状态。
- cancel 清除 active 和 completed。
- isDragging 在任意 active pointer dragged 时为 true。
- reset 清空全部。

## Cursor controller

创建：

- `src/scene/city/cityCursorController.ts`
- `src/scene/city/cityCursorController.test.ts`

接口可按现有代码最小化，但必须支持：

```ts
registerCanvas(element: HTMLElement): () => void
setCameraDragging(dragging: boolean): void
setBuildingHovered(id: BuildingId, hovered: boolean): void
reset(): void
```

优先级：

1. dragging → `grabbing`
2. 任意 building hovered → `pointer`
3. 默认 → `grab`

unregister/reset 后恢复元素原 cursor，不污染其他页面。替换 `InteractiveBuilding` 当前直接写 `document.body.style.cursor` 的模块级 Set，但保留多个建筑共享 hover 所有权。

## Gesture component

创建：

- `src/scene/city/CityPointerGestures.tsx`
- `src/scene/city/CityPointerGestures.test.tsx`

实现：

- `useThree((state) => state.gl.domElement)` 获取 Canvas。
- mount 注册 canvas 到 cursor controller。
- canvas 监听 `pointerdown`、`pointermove`、`pointerup`、`pointercancel`。
- 每次 move/up/cancel 后根据 tracker `isDragging()` 同步 cursor controller。
- unmount 移除同一函数引用的全部 listener，tracker.reset，cursor unregister/reset。
- 组件返回 null。

测试：

- mock useThree 返回真实 jsdom HTMLElement。
- dispatch 带 pointerId/clientX/clientY 的 pointer event。
- 验证 7px move 后 tracker/cursor 为 dragging/grabbing。
- up 后停止 dragging，但 completed click 可消费。
- cancel/reset。
- spy add/remove 每个 listener 精确配对。

## Click 抑制

修改 `InteractiveBuilding.tsx`：

- click 一律 stopPropagation。
- 从 `event.nativeEvent` 读取 pointerId；使用类型守卫，不用 `any`。
- 若 `cityPointerDragTracker.consumeDraggedClick(pointerId)` 为 true，直接 return，不 select。
- 普通 click 继续 select。
- pointer over/out 改用 cursor controller。

修改 `CityScene.tsx`：

- 在 Canvas 根层挂载 `<CityPointerGestures />`。
- group 背景 click 同样先检查 pointerId：
  - drag click：consume 后不 clearSelection。
  - 普通 click：clearSelection。
- 可抽取 `getPointerId` / `consumePointerDrag` 到小型共享模块，避免两处重复；必须有单测。

注意：现代浏览器 click 是 PointerEvent，但类型可能暴露为 MouseEvent。若 nativeEvent 没有有限 pointerId，返回保留鼠标 ID（推荐 1）；对应 fallback 必须测试。

## CSS

修改 `App.css`：

- `.city-app__canvas { cursor: grab; }` 作为无 JS fallback。
- 内联 controller 状态必须覆盖 CSS。
- UI button cursor 保持 pointer。

## TDD 顺序

1. tracker 测试 RED → 实现。
2. cursor controller 测试 RED → 实现。
3. gesture component 测试 RED → 实现。
4. click helper/InteractiveBuilding/CityScene 集成测试 RED → 实现。
5. 运行全 scene/App tests。

## 验证

```powershell
npm.cmd test -- src/scene/city
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

报告写 `.superpowers/sdd/layout-task-4-report.md`，包含分组 RED/GREEN、阈值、多 pointer、listener 清理、click 抑制、cursor 优先级、测试数、自审。不得 Git commit/push。
