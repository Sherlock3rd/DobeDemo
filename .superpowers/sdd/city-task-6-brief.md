# City Task 6：城市地面、环境与镜头

## 背景与约束

工作区：`d:\charlie\dobe demo`。布局、store、程序化互动建筑已完成。本任务创建城市环境与镜头，并修正集成前发现的城市单位比例。不要修改 App，不删除旧 DemoScene/RotatingCube/useDemoStore（App 尚未切换），不初始化 Git。

## 文件

- 修改 `src/game/cityLayout.ts`
- 修改 `src/game/cityLayout.test.ts`
- 修改 `src/scene/city/InteractiveBuilding.tsx`
- 创建 `src/scene/city/cameraConstraints.ts`
- 创建 `src/scene/city/cameraConstraints.test.ts`
- 创建 `src/scene/city/CityGround.tsx`
- 创建 `src/scene/city/CityEnvironment.tsx`
- 创建 `src/scene/city/CityCameraControls.tsx`
- 创建 `src/scene/city/CityScene.tsx`

## 建筑比例修正（测试先行）

当前程序化部件以较大模型单位定义，而互动建筑中心间距较小。先在 `cityLayout.test.ts` 增加集成约束并确认 RED：

- 在 `cityLayout.ts` 导出 `BUILDING_RENDER_SCALE = 0.4`。
- 每座互动建筑在同中心必须有一个 lot。
- lot 的 x/z size 必须分别不小于 `buildingCatalogById[id].footprint * BUILDING_RENDER_SCALE`。
- 六座建筑按缩放后 footprint 形成的轴对齐矩形不得互相重叠（边缘接触允许）。

调整六个 `lotPlacements` 尺寸满足约束，但不改变已确认的建筑中心位置。道路、河流等其他布局不变。

`InteractiveBuilding`：

- 用 group `scale={BUILDING_RENDER_SCALE}` 包裹 `BuildingModel`。
- highlight 底座与透明命中盒使用缩放后的 footprint。
- 命中盒高度也按合理比例收紧，仍覆盖最高模型（可用固定 5 城市单位高度），不再使用未缩放的 12。

## 镜头边界 TDD

`cameraConstraints.ts`：

```ts
export interface PanPoint {
  x: number
  z: number
}

export function clampPanTarget(point: PanPoint): PanPoint
```

使用 `CAMERA_CONFIG.panBounds` 将 x/z clamp；输入对象不得原地修改。先写测试覆盖边界内、四边越界和不修改输入，确认 RED 后实现。

## CityCameraControls

- 使用 Drei `OrbitControls`。
- `enableRotate={false}`、`enablePan`、`enableZoom`。
- `minZoom/maxZoom` 使用 CAMERA_CONFIG。
- `screenSpacePanning={false}`。
- 初始 target 使用 CAMERA_CONFIG.target。
- onChange 调用 clampPanTarget；若 target 被修正，同步给 camera.position.x/z 相同 delta，保持固定观察方向。
- 防止无变化时重复 update 递归。
- Canvas 将在 Task 7 配置 orthographic camera。

## CityGround

- 大地基底覆盖 CITY_BOUNDS，草地低饱和绿色。
- lot 使用旧混凝土灰。
- road 使用深灰，略高于地面。
- river 使用蓝绿色，略高于地面且不透明。
- 各平面 y 错层避免 z-fighting。
- 可加入简洁路缘/停车线，但不增加新数据系统。
- 所有平面 receiveShadow。

## CityEnvironment

从布局渲染：

- environment buildings：灰白工业仓库，主体+浅色屋顶。
- vehicles：静态小车/货车 box 组合，按 rotation。
- trees：树干 cylinder + 树冠 sphere。
- 可按道路添加少量路灯；不得创建动画、随机布局或外部资源。
- 避免环境对象遮挡互动建筑中心。

## CityScene

- 根 group onClick 调用 `clearSelection()`；InteractiveBuilding 已 stopPropagation。
- 使用 `<color attach="background" args={['#6f7c7b']} />` 与适度 fog。
- hemisphereLight + directionalLight，方向光 castShadow，合理 shadow map/camera 范围。
- 渲染 CityGround、CityEnvironment、六个 InteractiveBuilding、CityCameraControls。
- 六座建筑直接 map `interactiveBuildingPlacements`。

## 验证

```powershell
npm.cmd test -- src/game/cityLayout.test.ts src/scene/city/cameraConstraints.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
```

必须记录比例约束 RED、镜头函数 RED、GREEN、测试数量。旧 Demo 文件继续存在，确保当前 App 类型检查仍通过。

## 报告

写入 `.superpowers/sdd/city-task-6-report.md`，包含文件、两组 RED/GREEN、最终 lot 尺寸、缩放后 footprint、测试/typecheck/lint、场景摘要、自审与关注事项。最终只返回状态、验证摘要、关注事项。
