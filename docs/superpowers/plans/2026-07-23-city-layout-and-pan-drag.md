# City Layout and Pan Drag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重新排布城市使所有建筑区严格避让道路，并支持左键、右键和单指按住拖动地图且不误触建筑。

**Architecture:** 用共享纯几何模块统一旋转 AABB、间距和边界判断，布局测试建立建筑区域碰撞矩阵。OrbitControls 使用显式鼠标/触摸 PAN 映射；独立指针拖动跟踪器在移动超过 6px 后消费随后的建筑 click。

**Tech Stack:** TypeScript、React 19、Three.js、React Three Fiber、Drei OrbitControls、Zustand、Vitest、React Testing Library

## Global Constraints

- 保留六座建筑、建筑尺寸、`BUILDING_RENDER_SCALE = 0.4`、城市边界、帮派解锁和升级规则。
- 保留中央十字主路、固定正交镜头和禁用旋转。
- 地块与道路间距至少 0.35；地块间距至少 0.25。
- 建筑 footprint 与道路/河流至少 0.35，与树木/车辆至少 0.2。
- 左键/右键/单指 PAN，中键 DOLLY，双指 DOLLY_PAN。
- 移动距离严格大于 6 CSS px 才算拖动。
- 不允许拖动建筑。
- 不执行 Git commit，除非用户另行明确要求。

---

## File Map

- `src/game/placementGeometry.ts`、`.test.ts`：共享旋转 AABB、间距、包含与边界纯函数。
- `src/game/cityLayout.ts`、`.test.ts`：新坐标与完整建筑区域碰撞矩阵。
- `src/scene/city/cameraConstraints.ts`、`.test.ts`：OrbitControls 鼠标与触摸映射。
- `src/scene/city/pointerDragTracker.ts`、`.test.ts`：6px 拖动阈值和 click 消费。
- `src/scene/city/CityPointerGestures.tsx`、`.test.tsx`：Canvas 原生 pointer listener 生命周期。
- `src/scene/city/CityCameraControls.tsx`：应用输入映射。
- `src/scene/city/InteractiveBuilding.tsx`：拖动后抑制建筑选择。
- `src/scene/city/CityScene.tsx`：挂载指针手势组件。
- `src/App.css`：grab/grabbing 光标。

### Task 1: 共享布局几何规则

**Files:**

- Create: `src/game/placementGeometry.ts`
- Create: `src/game/placementGeometry.test.ts`
- Modify: `src/game/cityLayout.test.ts`

**Interfaces:**

```ts
export interface PlacementAabb {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export function getPlacementAabb(placement: CityPlacement): PlacementAabb
export function getInteractiveBuildingPlacement(
  building: InteractiveBuildingPlacement,
): CityPlacement
export function aabbsOverlapWithClearance(
  first: PlacementAabb,
  second: PlacementAabb,
  clearance: number,
): boolean
export function aabbContains(
  container: PlacementAabb,
  contained: PlacementAabb,
): boolean
export function isAabbInsideBounds(
  aabb: PlacementAabb,
  bounds: typeof CITY_BOUNDS,
): boolean
```

- [x] **Step 1:** 写旋转 90°/任意角 AABB、间距相切、包含和边界测试；模块缺失时确认 RED。
- [x] **Step 2:** 实现 `getPlacementAabb`，投影宽度为 `w*abs(cos)+d*abs(sin)`，深度为 `w*abs(sin)+d*abs(cos)`。
- [x] **Step 3:** 实现 building placement 转换，读取 catalog footprint 并乘 `BUILDING_RENDER_SCALE`。
- [x] **Step 4:** 把 `cityLayout.test.ts` 内重复的 AABB 公式迁移到共享模块。
- [x] **Step 5:** 运行 `npm.cmd test -- src/game/placementGeometry.test.ts src/game/cityLayout.test.ts`。

### Task 2: 严格重排城市

**Files:**

- Modify: `src/game/cityLayout.ts`
- Modify: `src/game/cityLayout.test.ts`

**Candidate centers:**

```ts
recycling-yard: [-6, 0, -4]
metalworking-plant: [-6, 0, -10.5]
clubhouse: [7, 0, -7]
repair-shop: [-8, 0, 4]
gas-station: [-12, 0, 10.5]
commercial-street: [6.8, 0, 6]
```

对应 lot 使用相同中心和现有尺寸。

道路候选：

```ts
{ position: [0, 0, 0], size: [36, 1.5] }
{ position: [0, 0, 0], size: [1.5, 28] }
{ position: [-15, 0, -3], size: [1.5, 6] }
{ position: [14, 0, 3], size: [1.5, 6] }
```

- [x] **Step 1:** 增加当前布局建筑/地块 ↔ 道路测试，收集并断言至少回收厂、金属加工厂、修车厂、商业街四处 RED。
- [x] **Step 2:** 加入完整矩阵：footprint↔道路/河流/树/车辆，lot↔道路/河流/lot/环境仓库，环境仓库↔道路/河流/建筑/仓库。
- [x] **Step 3:** 应用候选建筑、lot 和道路坐标。
- [x] **Step 4:** 根据失败标签最小调整环境仓库、树和车辆；车辆允许在道路上。
- [x] **Step 5:** 所有建筑/lot/环境仓库做 CITY_BOUNDS 检查；建筑必须被对应 lot 包含。
- [x] **Step 6:** 保留主路相交、两条支路连接、右侧河流和相机约束测试。
- [x] **Step 7:** 运行 game 全套与 typecheck/lint。

### Task 3: OrbitControls 显式 PAN 映射

**Files:**

- Modify: `src/scene/city/cameraConstraints.ts`
- Modify: `src/scene/city/cameraConstraints.test.ts`
- Modify: `src/scene/city/CityCameraControls.tsx`

**Interfaces:**

```ts
import { MOUSE, TOUCH } from 'three'

export const CAMERA_MOUSE_BUTTONS = {
  LEFT: MOUSE.PAN,
  MIDDLE: MOUSE.DOLLY,
  RIGHT: MOUSE.PAN,
} as const

export const CAMERA_TOUCHES = {
  ONE: TOUCH.PAN,
  TWO: TOUCH.DOLLY_PAN,
} as const
```

- [x] **Step 1:** 测试鼠标三键、单指/双指和 `enableRotate=false`，确认新导出缺失 RED。
- [x] **Step 2:** 添加常量并传给 OrbitControls 的 `mouseButtons`、`touches`。
- [x] **Step 3:** 保留 zoom、pan clamp 和 fixed angle。
- [x] **Step 4:** 运行 camera 定向测试、typecheck、lint。

### Task 4: 拖动阈值与点击抑制

**Files:**

- Create: `src/scene/city/pointerDragTracker.ts`
- Create: `src/scene/city/pointerDragTracker.test.ts`
- Create: `src/scene/city/CityPointerGestures.tsx`
- Create: `src/scene/city/CityPointerGestures.test.tsx`
- Modify: `src/scene/city/InteractiveBuilding.tsx`
- Modify: `src/scene/city/CityScene.tsx`
- Modify: `src/App.css`

**Interfaces:**

```ts
export const POINTER_DRAG_THRESHOLD_PX = 6

export interface PointerDragTracker {
  pointerDown(pointerId: number, x: number, y: number): void
  pointerMove(pointerId: number, x: number, y: number): boolean
  pointerUp(pointerId: number): void
  pointerCancel(pointerId: number): void
  consumeDraggedClick(pointerId: number): boolean
  reset(): void
}

export const cityPointerDragTracker: PointerDragTracker
```

- [x] **Step 1:** 测试 5px 点击、6px 仍点击、6.01px 拖动、一次消费、多 pointer、cancel/reset，确认 RED。
- [x] **Step 2:** 实现 tracker，使用欧氏距离，拖动 click 只消费一次。
- [x] **Step 3:** `CityPointerGestures` 从 `useThree` 获取 `gl.domElement`，注册 pointerdown/move/up/cancel；卸载移除 listener 并 reset。
- [x] **Step 4:** 组件测试 spy add/removeEventListener，并用真实 PointerEvent 验证 tracker 数据流。
- [x] **Step 5:** `InteractiveBuilding.handleClick` 从 `event.nativeEvent.pointerId` 消费拖动；拖动时 stopPropagation 但不 `selectBuilding`。
- [x] **Step 6:** `CityScene` 挂载 `CityPointerGestures`。
- [x] **Step 7:** Canvas 默认 `cursor: grab`，活动拖动时 `grabbing`；建筑 hover 保持 pointer，优先级由 tracker/手势组件统一更新。
- [x] **Step 8:** 运行 scene、App、全套测试与静态检查。

### Task 5: 视觉、文档与发布验收

**Files:**

- Modify: `README.md`
- Modify: `session/requirements/gang-tree-idle-unlocks.md`
- Modify: `session/session.md`
- Create: `.superpowers/sdd/layout-pan-drag-report.md`
- Create: `.superpowers/sdd/layout-pan-drag-screenshot.png`

- [x] **Step 1:** 运行 format check、typecheck、lint、全部测试、build。
- [x] **Step 2:** 本地启动固定端口，HTTP 200 冒烟。
- [x] **Step 3:** 1440×900 截图，确认六个建筑地块都不压道路。
- [x] **Step 4:** 浏览器自动化执行左键拖动，读取相机/画面变化；执行建筑普通 click，确认面板打开；拖动后确认不打开面板。
- [x] **Step 5:** 更新 README 操作为“左键/右键/单指拖动平移”。
- [x] **Step 6:** 更新 session 与报告；除非用户明确要求，不提交或推送 Git。

## Final Verification

- [x] 六座建筑 footprint 与道路/河流满足 0.35 间距。
- [x] 六个 lot 与道路满足 0.35，lot 间满足 0.25。
- [x] 中央十字路与两条支路连通。
- [x] 左键、右键、单指拖动均 PAN，旋转保持禁用。
- [x] 6px 内普通点击，超过 6px 抑制随后的建筑 click。
- [x] 全套自动化、构建、HTTP、截图和浏览器手势验收通过。
