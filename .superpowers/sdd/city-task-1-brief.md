# City Task 1：建筑类型、目录与升级纯函数

## 背景与约束

工作区：`d:\charlie\dobe demo`。这是工业城市 3D Demo 的数据基础。不要初始化 Git，不配置飞书 CLI，不实现本任务之外的 store、UI 或场景。严格执行测试先行并记录 RED→GREEN。

## 创建文件

- `src/game/cityTypes.ts`
- `src/game/buildingCatalog.ts`
- `src/game/buildingCatalog.test.ts`
- `src/game/buildingUpgrade.ts`
- `src/game/buildingUpgrade.test.ts`

## 精确接口

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

`buildingCatalog` 必须按 `BUILDING_IDS` 顺序包含恰好六项，显示名称逐字为（`Clubhouse` 保持用户指定的英文名称）：

- 废车回收站
- 物流中心
- 加油站
- 修车厂
- Clubhouse
- 商业区

每项具有不同的合理 footprint、工业配色和三条明确等级外观说明。导出：

```ts
export const buildingCatalog: readonly BuildingDefinition[]
export const buildingCatalogById: Readonly<Record<BuildingId, BuildingDefinition>>
export function isBuildingId(value: string): value is BuildingId
```

升级函数：

```ts
export function upgradeBuildingLevel(level: BuildingLevel): BuildingLevel {
  return level === 3 ? 3 : ((level + 1) as BuildingLevel)
}
```

## TDD

先写目录测试并确认模块缺失失败。测试目录恰好六项、顺序、中文名、ID 唯一、三级说明。随后实现目录并通过。

再先写升级测试，覆盖 1→2、2→3、3→3，确认 RED 后实现。

最终运行：

```powershell
npm.cmd test -- src/game
npm.cmd run typecheck
npm.cmd run lint
```

## 报告

写入 `.superpowers/sdd/city-task-1-report.md`，包含状态、文件、RED/GREEN 证据、测试数量、typecheck/lint、自审与关注事项。最终回复仅返回状态、验证摘要、关注事项。
