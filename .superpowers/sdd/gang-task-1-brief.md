# Gang Task 1：迁移建筑目录、布局与视觉

## 约束

工作区：`d:\charlie\dobe demo`。本任务只完成六建筑身份迁移，不实现帮派等级。严格测试先行；不初始化 Git。

## 新建筑序列

```ts
export const BUILDING_IDS = [
  'repair-shop',
  'recycling-yard',
  'commercial-street',
  'metalworking-plant',
  'gas-station',
  'clubhouse',
] as const
```

`BuildingKind`：

```ts
'repair' | 'recycling' | 'commercial' | 'metalworking' | 'gas' | 'clubhouse'
```

目录显示名称顺序：

1. 修车厂
2. 废车回收厂
3. 商业街
4. 金属加工厂
5. 加油站
6. Clubhouse

保留原 footprint 与工业配色：

- `commercial-street` 继承旧 commercial-district footprint/配色/商业模型语义，三级说明改为商业街。
- `metalworking-plant` 继承旧 logistics-center footprint/配色，但说明改为：
  - `低矮加工车间、基础熔炉与材料堆`
  - `扩建冲压车间、增加烟囱与吊装架`
  - `大型金属加工主楼、双炉体、重型天车与高烟囱`
- 废车名称改“废车回收厂”。

## 布局

所有中心位置不变：

- repair-shop：`[-11,0,0]`
- recycling-yard：`[-11,0,-8]`
- commercial-street：`[8,0,4]`
- metalworking-plant：`[-2,0,-9]`
- gas-station：`[-5,0,8]`
- clubhouse：`[7,0,-7]`

lot 和静态碰撞规则继续通过。

## 金属加工视觉

将 `buildingVisualConfig` 的 logistics key 改 `metalworking`。每级完整 stage 严格递增，并满足：

- L1：`main-building`、`furnace`、`material-stack`
- L2：保留 L1，并加入 `stamping-shop`、`smokestack`、`lifting-frame`
- L3：保留必要识别物，并加入 `metalworking-hall`、`second-furnace`、`gantry-crane`、`tall-smokestack`

更新 signature/level tag 测试。商业街继续使用 `storefront` 等 commercial 视觉。

## TDD 与范围

先更新 `buildingCatalog.test.ts`、`cityLayout.test.ts`、`buildingVisualConfig.test.ts`，运行确认旧 ID/旧 kind 导致 RED；再改生产代码。

全工作区搜索并替换生产/测试中的旧 ID：

- `logistics-center` 不得残留。
- `commercial-district` 不得残留。
- `kind: 'logistics'` 不得残留。

不要修改设计/计划/历史报告中的文字记录；检索范围以 `src/` 为准。

最终运行：

```powershell
npm.cmd test -- src/game src/scene/city/buildingVisualConfig.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
```

报告写入 `.superpowers/sdd/gang-task-1-report.md`，包含 RED/GREEN、迁移列表、测试数量、typecheck/lint、自审。最终仅返回状态、摘要、关注事项。
