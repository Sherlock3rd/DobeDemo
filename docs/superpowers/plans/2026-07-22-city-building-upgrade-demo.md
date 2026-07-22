# City Building Upgrade Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将基础 R3F 工作区改造成固定鸟瞰、可平移缩放、包含六座可点击并三级升级建筑的工业城市 Demo。

**Architecture:** 静态目录与布局数据驱动程序化 3D 城市；纯函数负责等级上限，Zustand 负责选择与建筑等级。场景组件只消费布局和状态，UI 面板通过稳定建筑 ID 与状态层交互。

**Tech Stack:** React 19、TypeScript、Three.js、React Three Fiber、Drei、Zustand、Vitest、React Testing Library、Vite

## Global Constraints

- 首要平台为桌面横屏浏览器，小屏幕保持可操作。
- 使用 `example/cityview.jpg` 的主要分区关系与 `example/citystyle.jpg` 的工业街区风格。
- 相机固定约 45 度角；允许有限平移与缩放，禁止旋转。
- 互动建筑仅包括：废车回收站、物流中心、加油站、修车厂、Clubhouse、商业区。
- 所有互动建筑初始 1 级，最高 3 级；升级必须产生可见外观变化。
- 不加入金币、产出、计时、存档、车辆移动、行人 AI、后端或外部 3D 模型。
- 不初始化 Git，不执行提交；不配置飞书 CLI。
- 新行为严格按 RED→GREEN→REFACTOR 实施。

---

## File Map

- `src/game/cityTypes.ts`：建筑 ID、类型、等级和布局类型。
- `src/game/buildingCatalog.ts`：六座互动建筑的稳定目录。
- `src/game/buildingCatalog.test.ts`：目录完整性与 ID 唯一性。
- `src/game/buildingUpgrade.ts`：纯升级规则。
- `src/game/buildingUpgrade.test.ts`：等级边界测试。
- `src/game/cityLayout.ts`：道路、河流、地块、互动建筑和环境物坐标。
- `src/game/cityLayout.test.ts`：六座建筑布局和镜头范围约束。
- `src/store/useCityStore.ts`：选择与等级状态。
- `src/store/useCityStore.test.ts`：选择、升级、未知 ID 与重置。
- `src/ui/BuildingPanel.tsx`：建筑详情与升级按钮。
- `src/ui/BuildingPanel.test.tsx`：面板交互与满级状态。
- `src/ui/CityHud.tsx`：城市标题和操作提示。
- `src/scene/city/CityCameraControls.tsx`：固定角度及平移缩放限制。
- `src/scene/city/cameraConstraints.ts`：可测试的镜头目标边界函数。
- `src/scene/city/cameraConstraints.test.ts`：镜头 clamp 边界测试。
- `src/scene/city/CityGround.tsx`：地面、道路、河流和地块。
- `src/scene/city/CityEnvironment.tsx`：填充建筑、车辆、树木与装饰。
- `src/scene/city/buildingVisualConfig.ts`：六类建筑三级程序化部件配置。
- `src/scene/city/buildingVisualConfig.test.ts`：三级差异与建筑识别部件测试。
- `src/scene/city/BuildingModel.tsx`：六类建筑的三级程序化外观。
- `src/scene/city/InteractiveBuilding.tsx`：hover、选中、点击命中。
- `src/scene/city/CityScene.tsx`：场景组合与空地清除选择。
- `src/App.tsx`、`src/App.css`：应用组装和响应式 UI。
- `session/session.md`、`session/requirements/city-building-upgrade-demo.md`：实施记录与验收。
- Delete: `src/scene/DemoScene.tsx`、`src/scene/RotatingCube.tsx`、`src/ui/DemoHud.tsx` 及其过时测试。

### Task 1: 建筑类型、目录与升级纯函数

**Files:**
- Create: `src/game/cityTypes.ts`
- Create: `src/game/buildingCatalog.ts`
- Create: `src/game/buildingCatalog.test.ts`
- Create: `src/game/buildingUpgrade.ts`
- Create: `src/game/buildingUpgrade.test.ts`

**Interfaces:**

```ts
export const BUILDING_IDS = [
  'recycling-yard',
  'logistics-center',
  'gas-station',
  'repair-shop',
  'clubhouse',
  'commercial-district',
] as const

export type BuildingId = (typeof BUILDING_IDS)[number]
export type BuildingLevel = 1 | 2 | 3
export type BuildingKind =
  | 'recycling'
  | 'logistics'
  | 'gas'
  | 'repair'
  | 'clubhouse'
  | 'commercial'

export interface BuildingDefinition {
  id: BuildingId
  name: string
  kind: BuildingKind
  footprint: readonly [number, number]
  primaryColor: string
  accentColor: string
  levelSummary: readonly [string, string, string]
}
```

- [ ] **Step 1: 写目录失败测试**

测试必须断言目录恰好包含六个指定 ID、中文名称、唯一 ID 和三条等级说明。

```ts
expect(buildingCatalog.map((item) => item.id)).toEqual(BUILDING_IDS)
expect(new Set(buildingCatalog.map((item) => item.id)).size).toBe(6)
expect(buildingCatalog.every((item) => item.levelSummary.length === 3)).toBe(true)
```

- [ ] **Step 2: 运行目录测试确认 RED**

Run: `npm test -- src/game/buildingCatalog.test.ts`

Expected: FAIL，模块尚不存在。

- [ ] **Step 3: 创建类型与六建筑目录**

六个显示名称必须逐字为：`废车回收站`、`物流中心`、`加油站`、`修车厂`、`Clubhouse`、`商业区`。其中 `Clubhouse` 保持用户指定的英文名称；每项提供不同的 footprint、工业配色和三级外观说明。

- [ ] **Step 4: 写升级失败测试**

```ts
expect(upgradeBuildingLevel(1)).toBe(2)
expect(upgradeBuildingLevel(2)).toBe(3)
expect(upgradeBuildingLevel(3)).toBe(3)
```

- [ ] **Step 5: 实现升级纯函数并验证**

```ts
export function upgradeBuildingLevel(level: BuildingLevel): BuildingLevel {
  return level === 3 ? 3 : ((level + 1) as BuildingLevel)
}
```

Run: `npm test -- src/game`

Expected: 全部通过。

### Task 2: 城市布局与镜头配置

**Files:**
- Create: `src/game/cityLayout.ts`
- Create: `src/game/cityLayout.test.ts`

**Interfaces:**

```ts
export interface CityPlacement {
  position: readonly [number, number, number]
  size: readonly [number, number]
  rotation?: number
}

export const CITY_BOUNDS = { minX: -18, maxX: 18, minZ: -14, maxZ: 14 } as const
export const CAMERA_CONFIG = {
  position: [24, 28, 30] as const,
  target: [0, 0, 0] as const,
  minZoom: 16,
  maxZoom: 34,
  panBounds: { minX: -8, maxX: 8, minZ: -6, maxZ: 6 },
} as const
```

- [ ] **Step 1: 写布局失败测试**

测试六个互动建筑 ID 各出现一次、位置落在 `CITY_BOUNDS` 内、道路和河流数组非空、相机 minZoom 小于 maxZoom、平移范围位于城市范围内。

- [ ] **Step 2: 运行确认 RED**

Run: `npm test -- src/game/cityLayout.test.ts`

- [ ] **Step 3: 实现参考图布局**

互动建筑位置采用：

```ts
export const interactiveBuildingPlacements = [
  { id: 'recycling-yard', position: [-11, 0, -8], rotation: 0 },
  { id: 'logistics-center', position: [-2, 0, -9], rotation: 0 },
  { id: 'clubhouse', position: [7, 0, -7], rotation: 0 },
  { id: 'repair-shop', position: [-11, 0, 0], rotation: 0 },
  { id: 'gas-station', position: [-5, 0, 8], rotation: 0 },
  { id: 'commercial-district', position: [8, 0, 4], rotation: 0 },
] satisfies readonly InteractiveBuildingPlacement[]
```

道路形成横纵主干道，河流位于右上边缘；填充建筑不得遮挡六座互动建筑。

- [ ] **Step 4: 验证布局**

Run: `npm test -- src/game/cityLayout.test.ts`

Expected: PASS。

### Task 3: 城市 Zustand 状态

**Files:**
- Create: `src/store/useCityStore.ts`
- Create: `src/store/useCityStore.test.ts`

**Interfaces:**

```ts
export type BuildingLevels = Record<BuildingId, BuildingLevel>

interface CityState {
  selectedBuildingId: BuildingId | null
  buildingLevels: BuildingLevels
  selectBuilding: (id: BuildingId) => void
  clearSelection: () => void
  upgradeBuilding: (id: string) => void
  reset: () => void
}
```

- [ ] **Step 1: 写状态失败测试**

覆盖初始六建筑均为 1 级、选择/切换/清除、单建筑升级、满级、未知 ID 不变、reset。

- [ ] **Step 2: 运行确认 RED**

Run: `npm test -- src/store/useCityStore.test.ts`

- [ ] **Step 3: 实现最小 store**

初始等级由 `BUILDING_IDS` 生成；`upgradeBuilding(id: string)` 先通过建筑 ID guard 验证，再不可变更新目标等级；未知 ID直接返回原状态。

- [ ] **Step 4: 验证城市 store**

Run: `npm test -- src/store/useCityStore.test.ts`

Expected: 全部通过。旧 Demo store 暂时保留，供尚未在 Task 6 删除的旋转方块通过类型检查。

### Task 4: 建筑信息面板与城市 HUD

**Files:**
- Create: `src/ui/BuildingPanel.tsx`
- Create: `src/ui/BuildingPanel.test.tsx`
- Create: `src/ui/CityHud.tsx`

**Interfaces:**
- `BuildingPanel(): JSX.Element | null`
- `CityHud(): JSX.Element`

- [ ] **Step 1: 写面板失败测试**

测试：

```tsx
useCityStore.getState().selectBuilding('gas-station')
render(<BuildingPanel />)
expect(screen.getByRole('heading', { name: '加油站' })).toBeInTheDocument()
expect(screen.getByText('等级 1 / 3')).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: '升级到 2 级' }))
expect(screen.getByText('等级 2 / 3')).toBeInTheDocument()
```

另一个测试连续升级到 3 级，断言按钮文案 `已满级` 且 disabled；关闭按钮清除选择。

- [ ] **Step 2: 运行确认 RED**

Run: `npm test -- src/ui/BuildingPanel.test.tsx`

- [ ] **Step 3: 实现面板与 HUD**

面板根节点处理 `onPointerDown` 和 `onClick` 的 `stopPropagation()`；无选择或目录缺失时返回 null。HUD 文案为“工业城改造计划”，提示“拖拽平移 · 滚轮缩放 · 点击建筑升级”。

- [ ] **Step 4: 验证 UI**

Run: `npm test -- src/ui/BuildingPanel.test.tsx`

Expected: 全部通过。

### Task 5: 程序化建筑与互动命中

**Files:**
- Create: `src/scene/city/buildingVisualConfig.ts`
- Create: `src/scene/city/buildingVisualConfig.test.ts`
- Create: `src/scene/city/BuildingModel.tsx`
- Create: `src/scene/city/InteractiveBuilding.tsx`

**Interfaces:**

```ts
interface BuildingModelProps {
  definition: BuildingDefinition
  level: BuildingLevel
  highlighted: boolean
}

interface InteractiveBuildingProps {
  id: BuildingId
  position: readonly [number, number, number]
  rotation?: number
}
```

- [ ] **Step 1: 先测试三级可见配置**

每类建筑提供 1/2/3 级完整部件数组；测试每级部件数量严格增加，并包含该类型独有 tag：废车、装卸口、油泵、车库门、Clubhouse 招牌、商业店面。先确认配置模块缺失 RED。

- [ ] **Step 2: 实现声明式部件配置**

- 1 级：主体。
- 2 级：主体高度或宽度增加，并增加至少一种附属件。
- 3 级：再增加独立体块、设备或标识。

每个 kind 必须提供独有识别物：废车堆、装卸口、油站顶棚、车库门、深色招牌、商业店面。

- [ ] **Step 3: 实现通用模型渲染**

`BuildingModel` 将当前 kind/level 的 box、cylinder 部件映射为 mesh；根据 colorRole 使用定义的主色、强调色、屋顶色或深色。所有 mesh 支持阴影，不加载外部模型。

- [ ] **Step 4: 实现互动包装**

`InteractiveBuilding` 本地保存 hover；读取选中 ID 与自身 level；点击时 `event.stopPropagation()` 并选择建筑；pointer over/out 设置 `document.body.style.cursor`；卸载时恢复 cursor。建筑底部使用透明命中 mesh 覆盖完整 footprint；hover/selected 时显示暖黄色底座高亮。

- [ ] **Step 5: 测试与静态验证**

Run:

```powershell
npm.cmd test -- src/scene/city/buildingVisualConfig.test.ts
npm.cmd run typecheck
npm.cmd run lint
```

Expected: PASS。

### Task 6: 城市地面、环境与镜头

**Files:**
- Modify: `src/game/cityLayout.ts`
- Modify: `src/game/cityLayout.test.ts`
- Modify: `src/scene/city/InteractiveBuilding.tsx`
- Create: `src/scene/city/cameraConstraints.ts`
- Create: `src/scene/city/cameraConstraints.test.ts`
- Create: `src/scene/city/CityGround.tsx`
- Create: `src/scene/city/CityEnvironment.tsx`
- Create: `src/scene/city/CityCameraControls.tsx`
- Create: `src/scene/city/CityScene.tsx`

**Interfaces:**
- `CityGround(): JSX.Element`
- `CityEnvironment(): JSX.Element`
- `CityCameraControls(): JSX.Element`
- `CityScene(): JSX.Element`

- [ ] **Step 1: 实现地面与布局**

`CityGround` 根据布局数组渲染草地基底、道路、停车区、河流和地块。所有平面略微错开 y 值避免 z-fighting。城市空地/地面点击调用 `clearSelection()`。

- [ ] **Step 2: 实现环境**

`CityEnvironment` 使用可复用 box/cylinder 组合填充仓库、静态车辆、货车、树木和路灯；对象数量保持适中，不创建逐帧动画。

- [ ] **Step 3: 实现镜头控制**

使用 `OrbitControls`：

```tsx
<OrbitControls
  ref={controlsRef}
  enableRotate={false}
  enablePan
  enableZoom
  minZoom={CAMERA_CONFIG.minZoom}
  maxZoom={CAMERA_CONFIG.maxZoom}
  screenSpacePanning={false}
  target={CAMERA_CONFIG.target}
  onChange={clampTarget}
/>
```

`clampTarget` 将 target.x/z 限制在 panBounds，并同步修正 camera position 的相同偏移，保持固定观察方向。

- [ ] **Step 4: 组合场景**

加入半球光、方向光、环境雾、六个 `InteractiveBuilding`、地面、环境和镜头控制。场景根背景为低饱和蓝灰色。

- [ ] **Step 5: 静态验证**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
```

Expected: PASS。

### Task 7: 应用集成、样式与完整验收

**Files:**
- Modify: `src/App.tsx`
- Replace: `src/App.css`
- Delete: `src/scene/DemoScene.tsx`
- Delete: `src/scene/RotatingCube.tsx`
- Delete: `src/store/useDemoStore.ts`
- Delete: `src/store/useDemoStore.test.ts`
- Delete: `src/ui/DemoHud.tsx`
- Delete: `src/ui/DemoHud.test.tsx`
- Create: `session/requirements/city-building-upgrade-demo.md`
- Modify: `session/session.md`

**Interfaces:**
- Consumes: `CityScene`、`CityHud`、`BuildingPanel`、`AppErrorBoundary`。

- [ ] **Step 1: 替换应用内容**

Canvas 使用 orthographic camera：

```tsx
<Canvas
  shadows
  orthographic
  camera={{
    position: CAMERA_CONFIG.position,
    zoom: 22,
    near: 0.1,
    far: 200,
  }}
>
  <Suspense fallback={null}>
    <CityScene />
  </Suspense>
</Canvas>
```

Canvas 外叠加 `CityHud`、`BuildingPanel` 和现有 Loader；保留 `AppErrorBoundary`。

- [ ] **Step 2: 重做响应式样式**

桌面：HUD 左上、面板右侧、Canvas 全屏。小于 720px：面板固定底部且限制高度。为互动按钮提供 hover、active、focus-visible、disabled。面板和 HUD 使用深色半透明底与暖黄色强调。

- [ ] **Step 3: 全量格式与验证**

Run:

```powershell
npm.cmd run format
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run build
```

Expected: 全部退出码 0。

- [ ] **Step 4: HTTP 冒烟**

Run: `npm.cmd run dev -- --host 127.0.0.1`

访问实际 URL必须返回 200 且 HTML 包含 `#root`；验证后停止服务器并确认端口释放。

- [ ] **Step 5: 更新项目记录**

需求记录写入六座建筑、三级升级、镜头限制、测试数量、构建和 HTTP 结果。`session/session.md` 当前目标改为城市 Demo、状态改为已完成，并追加变更总账。

## Final Verification

- [ ] 六座指定建筑均存在且 ID 唯一。
- [ ] 所有建筑可选中并从 1 级升到 3 级。
- [ ] 每类建筑三级外观存在可见差异。
- [ ] 右侧面板升级、满级、关闭行为正确。
- [ ] 镜头可平移缩放、不可旋转且有边界。
- [ ] 旧旋转方块、旧 HUD 与旧 store 已移除。
- [ ] typecheck、lint、format check、全部测试和 build 通过。
- [ ] HTTP 200，冒烟服务器停止。
- [ ] 无 `.git/`，未配置飞书 CLI。
