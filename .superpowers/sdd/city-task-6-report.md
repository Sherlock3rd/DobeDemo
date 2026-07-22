# City Task 6 实施报告

## 状态

已完成比例修正、城市地面与静态环境、镜头平移边界和城市场景组合。未修改 `App.tsx`，未删除旧 Demo 文件或 store，未初始化 Git。

## 文件

- 修改 `src/game/cityLayout.ts`
- 修改 `src/game/cityLayout.test.ts`
- 修改 `src/scene/city/InteractiveBuilding.tsx`
- 修改 `src/scene/city/buildingVisualConfig.test.ts`
- 创建 `src/scene/city/cameraConstraints.ts`
- 创建 `src/scene/city/cameraConstraints.test.ts`
- 创建 `src/scene/city/CityGround.tsx`
- 创建 `src/scene/city/CityEnvironment.tsx`
- 创建 `src/scene/city/CityCameraControls.tsx`
- 创建 `src/scene/city/CityScene.tsx`
- 创建 `.superpowers/sdd/city-task-6-report.md`

## TDD 记录

### 比例约束

- RED：先增加同中心 lot、缩放后 footprint 可容纳、建筑 AABB 不重叠测试。
- 首次运行结果：`cityLayout.test.ts` 共 13 项，12 项通过、1 项失败；失败原因为 `BUILDING_RENDER_SCALE` 尚未导出，收到 `undefined` 而非 `0.4`。
- 实现常量与 lot 尺寸后，测试进一步捕获浮点边界：`5.6` 小于计算值 `5.6000000000000005`。最终给受影响 lot 增加 `0.1` 城市单位余量，避免依赖浮点恰好相等。
- GREEN：与镜头测试合并运行，2 个测试文件、19 项测试全部通过。

### 镜头边界函数

- RED：先创建测试，覆盖边界内点、四边越界与输入对象不变。
- 首次运行结果：测试模块因 `cameraConstraints.ts` 尚不存在而按预期无法解析。
- GREEN：实现基于 `CAMERA_CONFIG.panBounds` 的纯函数 clamp 后，相关 6 项测试全部通过；合并定向测试共 19 项通过。

## 比例结果

`BUILDING_RENDER_SCALE = 0.4`。

- `recycling-yard`：缩放 footprint `7.2 × 5.6`；lot `7.3 × 5.7`
- `logistics-center`：缩放 footprint `9.6 × 6.4`；lot `9.7 × 6.5`
- `clubhouse`：缩放 footprint `5.2 × 4.4`；lot `7 × 6`
- `repair-shop`：缩放 footprint `6.4 × 4.8`；lot `7 × 5`
- `gas-station`：缩放 footprint `5.6 × 4`；lot `6 × 6`
- `commercial-district`：缩放 footprint `11.2 × 8`；lot `11.3 × 8.1`

六座建筑中心位置未改变，缩放后的轴对齐 footprint 互不重叠。`BuildingModel` 使用统一 group scale；高亮底座与透明命中盒采用缩放 footprint，命中盒高度收紧为 5。

## 场景摘要

- `CityGround` 按 `CITY_BOUNDS` 渲染低饱和草地基底，并按不同 y 层渲染混凝土 lot、深灰道路和不透明蓝绿色河流，全部接收阴影。
- `CityEnvironment` 从现有布局渲染灰白仓库、静态车辆和树木；未增加动画、随机布局或外部资源。
- `CityCameraControls` 使用禁止旋转的 `OrbitControls`，启用平移与缩放；缩放范围、初始 target 来自 `CAMERA_CONFIG`。越界时同步修正 target 与 camera x/z，并在无变化时直接返回，避免 update 递归。
- `CityScene` 组合背景、雾、半球光、带阴影方向光、地面、环境、六座互动建筑与镜头控制；根场景 group 点击清空选择。

## 审查修复

### 环境建筑 AABB

- RED：先增加环境建筑 AABB 与六座缩放后互动建筑 footprint 的全配对测试。`cityLayout.test.ts` 共 14 项，13 项通过、1 项失败。
- RED 捕获 6 处冲突：环境建筑 0 与 `recycling-yard`，环境建筑 1 与 `recycling-yard`、`logistics-center`，环境建筑 2 与 `logistics-center`，环境建筑 4、5 与 `commercial-district`。
- 根因：旧测试只检查环境建筑中心是否等于互动建筑中心，没有把环境建筑自身 size 与缩放 footprint 纳入空间占用计算。
- GREEN：调整 5 个冲突位置后，布局测试 15 项全部通过；新增测试同时固定环境建筑数量为 8，并验证每个环境 AABB（含尺寸边缘）完整位于 `CITY_BOUNDS` 内。
- 最终环境建筑位置与尺寸：
  - `[-9, 0, -12.5]`，`3 × 3`
  - `[7, 0, -12.5]`，`3 × 2`
  - `[7, 0, 12]`，`3 × 3`
  - `[-15, 0, 5]`，`3 × 4`
  - `[-16.5, 0, 12.5]`，`2.5 × 2.5`
  - `[16, 0, 5]`，`3 × 4`
  - `[-4, 0, 12]`，`4 × 3`
  - `[11, 0, 12]`，`4 × 4`

### 命中盒高度

- 从布局导出 `BUILDING_HITBOX_HEIGHT = 5`；`InteractiveBuilding` 的命中盒高度使用该常量，中心 y 使用 `BUILDING_HITBOX_HEIGHT / 2` 推导。
- 在 `buildingVisualConfig.test.ts` 增加高度不变量，遍历六类建筑的 1/2/3 级全部部件。测试按 Three.js `XYZ` Euler 规则变换与渲染一致的 box geometry 和 16 段 cylinder geometry，再从旋转后 bounding box 取最高点；结果乘 `BUILDING_RENDER_SCALE` 后必须不超过命中盒高度。
- 该防回归测试在现有视觉配置上首次运行即 GREEN：`buildingVisualConfig.test.ts` 8 项全部通过，证明 5 城市单位命中盒当前可覆盖所有模型部件。

### 完整静态布局复审

- 原因：上一轮环境测试仅覆盖互动建筑，没有把道路、旋转河流、车辆、树木和仓库彼此纳入同一个空间模型。
- 新测试统一将 `CityPlacement` 按 rotation 投影为保守且精确的平面 AABB：旋转后宽度为 `|width cos θ| + |depth sin θ|`，深度为 `|width sin θ| + |depth cos θ|`。正面积相交判定使用严格不等式，因此边缘接触允许。
- 测试覆盖环境仓库与缩放后互动 footprint、其他环境仓库、道路、河流、车辆、树木的全部配对，并继续验证 8 个仓库完整位于 `CITY_BOUNDS`。
- RED：`cityLayout.test.ts` 15 项中 1 项失败，捕获 7 处遗漏冲突：
  - 环境仓库 1 与树木 4
  - 环境仓库 4 与道路 0、河流 2
  - 环境仓库 6 与道路 1、树木 8
  - 环境仓库 7 与道路 3、车辆 7
- GREEN：采用上述最终 8 个安全位置后，布局测试 15 项全部通过。
- 视觉高度测试同步升级为旋转后真实几何包围盒计算；未修改任何当前视觉模型，单文件 8 项测试全部通过。

### 仓库可见投影修正

- `CityEnvironment` 的仓库浅色屋顶保留 `0.2` 高度与原有材质颜色，x/z 尺寸从 `width/depth + 0.12` 改为与 `placement.size` 的 `width/depth` 完全相等。
- 修正后仓库主体和屋顶的可见平面投影均不超出布局碰撞 AABB，避免渲染几何越过已验证的静态布局边界。
- 全量 61 项测试、typecheck 与 lint 均通过。

## 验证

- 布局与视觉配置定向测试：2 个测试文件，23 项全部通过。
- 全量测试：11 个测试文件，61 项全部通过。
- `npm.cmd run typecheck`：通过。
- `npm.cmd run lint`：通过。
- `App.tsx` 仍引用 `DemoScene`，没有接入 `CityScene`。
- `DemoScene.tsx`、`RotatingCube.tsx`、`useDemoStore.ts` 均继续存在。

## 自审与关注事项

- 已逐项复核任务文件清单、比例公式、镜头边界行为、场景组合和“不修改 App/不删除旧 Demo”约束。
- 由于本任务明确不接入 App，当前验证覆盖测试、类型与 lint，未进行浏览器中的最终正交镜头视觉验收；Task 7 接入 orthographic camera 后应重点检查初始构图、阴影范围、雾距离和环境物体遮挡。
- `CityCameraControls` 依赖最终 Canvas 使用正交相机，`minZoom/maxZoom` 对当前 App 的透视相机不构成有效的最终展示验证。
