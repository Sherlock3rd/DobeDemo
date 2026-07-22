# City Task 5：程序化建筑与互动命中

## 背景与约束

工作区：`d:\charlie\dobe demo`。目录、布局、城市 store 已完成。本任务创建六类建筑三级程序化外观和统一互动包装，不创建地面、环境、相机或 App，不加载外部模型，不初始化 Git。配置行为严格 TDD。

## 文件

- 创建 `src/scene/city/buildingVisualConfig.ts`
- 创建 `src/scene/city/buildingVisualConfig.test.ts`
- 创建 `src/scene/city/BuildingModel.tsx`
- 创建 `src/scene/city/InteractiveBuilding.tsx`

## 声明式部件接口

```ts
export type BuildingColorRole = 'primary' | 'accent' | 'roof' | 'dark' | 'glass'

export interface BoxVisualPart {
  shape: 'box'
  tag: string
  position: readonly [number, number, number]
  size: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  colorRole: BuildingColorRole
}

export interface CylinderVisualPart {
  shape: 'cylinder'
  tag: string
  position: readonly [number, number, number]
  radius: number
  height: number
  rotation?: readonly [number, number, number]
  colorRole: BuildingColorRole
}

export type BuildingVisualPart = BoxVisualPart | CylinderVisualPart
export type BuildingVisualStages = Readonly<Record<BuildingLevel, readonly BuildingVisualPart[]>>

export const buildingVisualConfig: Readonly<Record<BuildingKind, BuildingVisualStages>>
export function getBuildingVisualStage(kind: BuildingKind, level: BuildingLevel): readonly BuildingVisualPart[]
```

每一级数组为完整渲染结果，不是增量。每个 kind 的 1、2、3 级部件数量严格递增。所有 size/radius/height 大于 0。

各类独有 tag 必须存在于至少一个等级，并在 3 级保留：

- recycling：`scrap-car`
- logistics：`loading-bay`
- gas：`fuel-pump`
- repair：`garage-door`
- clubhouse：`clubhouse-sign`
- commercial：`storefront`

1 级必须有主体；2 级增加扩建和附属件；3 级增加更多独立体块/设备/标识。颜色通过 colorRole 映射，不硬编码定义之外的远程纹理。

## 配置 TDD

先写测试并确认模块缺失 RED，覆盖：

- 六个 BuildingKind 均有 1/2/3 级。
- 每级非空，2 级部件数 > 1 级，3 级 > 2 级。
- 所有几何尺寸为正。
- 每类 3 级包含对应 signature tag。
- getBuildingVisualStage 返回精确阶段。

实现后先通过该测试。

## BuildingModel

Props：

```ts
interface BuildingModelProps {
  definition: BuildingDefinition
  level: BuildingLevel
  highlighted: boolean
}
```

- 从配置获取当前 stage。
- box 使用 boxGeometry；cylinder 使用 cylinderGeometry。
- 主色/强调色来自 definition；roof 为浅灰、dark 为深灰、glass 为低饱和蓝。
- highlighted 时材质增加轻微暖黄色 emissive，不改变布局。
- mesh 开启 castShadow/receiveShadow。
- 组件只负责模型，不处理点击。

## InteractiveBuilding

Props：

```ts
interface InteractiveBuildingProps {
  id: BuildingId
  position: readonly [number, number, number]
  rotation?: number
}
```

- 从 `buildingCatalogById` 取得 definition。
- 从 store 读取 selectedBuildingId、该 id 的 level、selectBuilding。
- 本地 hover state。
- 点击时 `event.stopPropagation()` 后选择建筑。
- pointer over/out 均 stopPropagation；hover 时 cursor 为 pointer，离开或卸载恢复 default。
- 用完整 footprint 的透明 box 作为命中区域。
- hover 或 selected 时显示 footprint 大小的暖黄色半透明底座，高于地面避免 z-fighting。
- BuildingModel 的 highlighted 为 hover || selected。

## 验证

```powershell
npm.cmd test -- src/scene/city/buildingVisualConfig.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
```

## 报告

写入 `.superpowers/sdd/city-task-5-report.md`，包含 RED/GREEN、配置测试数量、全套测试、typecheck/lint、各建筑三级部件数量、自审和关注事项。最终仅返回状态、验证摘要、关注事项。
