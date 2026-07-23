# Layout Task 2 报告

## 状态

已完成严格碰撞矩阵与城市重排。仅修改 `src/game/cityLayout.ts`（新增三个间距常量与重排全部 placement 坐标）与 `src/game/cityLayout.test.ts`（新增收集式矩阵测试）。未实现拖动，未改 catalog/建筑尺寸/视觉，未执行 Git commit 或 push。

## TDD 记录

### RED（旧布局，building/lot ↔ road）

先在 `cityLayout.ts` 增加 `LOT_ROAD_CLEARANCE = 0.35`、`LOT_CLEARANCE = 0.25`、`BUILDING_STATIC_CLEARANCE = 0.2` 三个常量（未改坐标），并在测试中新增两个收集式用例：`building footprint ↔ road`、`lot ↔ road`，在旧坐标上运行 `npm.cmd test -- src/game/cityLayout.test.ts`。

RED 结果（2 个测试失败，完整标签列表，未在首个失败处中止）：

- `building recycling-yard vs road 2`
- `building metalworking-plant vs road 1`
- `building repair-shop vs road 0`
- `building repair-shop vs road 2`
- `building commercial-street vs road 0`
- `building commercial-street vs road 3`
- `lot 0 vs road 2`
- `lot 1 vs road 1`
- `lot 3 vs road 0`
- `lot 3 vs road 2`
- `lot 5 vs road 0`
- `lot 5 vs road 3`

与任务简报预期的冲突方（recycling-yard、metalworking-plant、repair-shop、commercial-street）完全一致，确认 RED 成立。

### GREEN（重排 + 完整矩阵）

确认 RED 后，按候选坐标重排 `interactiveBuildingPlacements`、`lotPlacements`、`roadPlacements`、`environmentBuildingPlacements`、`treePlacements`、`vehiclePlacements`，并新增覆盖简报全部 9 类规则的收集式测试（每类均遍历全部组合、收集完整错误标签后再一次性断言为空数组，不在首个失败处中止）。首轮运行即全部通过（25/25），未出现二次 RED。

## 最终坐标

### Interactive buildings / lots（同中心）

| id | position | lot size |
| --- | --- | --- |
| recycling-yard | [-6, 0, -4] | [7.3, 5.7] |
| metalworking-plant | [-6, 0, -10.5] | [9.7, 6.5] |
| clubhouse | [7, 0, -7] | [7, 6] |
| repair-shop | [-8, 0, 4] | [7, 5] |
| gas-station | [-12, 0, 10.5] | [6, 6] |
| commercial-street | [6.8, 0, 6] | [11.3, 8.1] |

### 道路

- `{ position: [0, 0, 0], size: [36, 1.5] }`（水平主路）
- `{ position: [0, 0, 0], size: [1.5, 28] }`（垂直主路）
- `{ position: [-15, 0, -3], size: [1.5, 6] }`（左侧支路，与水平主路相交）
- `{ position: [14, 0, 3], size: [1.5, 6] }`（右侧支路，与水平主路相交）

### 河流

沿用简报建议，仅将第一段河流 `position[0]` 由 `13` 微调为 `13.7`（其余不变）：

- `{ position: [13.7, -0.1, -12], size: [5, 4], rotation: -0.12 }`
- `{ position: [15, -0.1, -8], size: [4, 5], rotation: -0.35 }`
- `{ position: [16, -0.1, -4], size: [3, 5], rotation: -0.18 }`

### 环境仓库 / 车辆 / 树木

环境仓库 8 个、树木 10 个均按简报建议坐标原样采用。车辆保留原有 5 个安全项（`[-14,0,-1]`、`[-6,0,1]`、`[5,0,-1]`、`[12,0,1]`、`[-1,0,-6]`），将 `[1,0,5]`、`[5,0,7]`、`[12,0,9]` 三个改到新主路/支路：`[14,0,2]`（右支路）、`[-15,0,-3]`（左支路）、`[0,0,-10]`（垂直主路），均已在完整矩阵测试中验证不与任何建筑 footprint 冲突。

## 矩阵覆盖

新增测试逐条对应简报 9 类规则，均为收集全部标签后再断言为空数组：

1. building footprint ↔ road（clearance 0.35）
2. building footprint ↔ river（clearance 0.35）
3. building footprint ↔ tree / vehicle（clearance 0.2）
4. lot ↔ road（clearance 0.35）、lot ↔ river（clearance 0.35，各一条独立用例）
5. lot ↔ lot（clearance 0.25）
6. lot ↔ environment building（clearance 0.35）
7. environment ↔ road / river / building / other environment（clearance 0，仅要求无正面积重叠）
8. building / lot / environment AABB 全部在 `CITY_BOUNDS` 内
9. 每个 interactive building 对应 lot `aabbContains`，且中心 x、z 均一致

以上均直接从 `cityLayout.ts` 导入 `LOT_ROAD_CLEARANCE`、`LOT_CLEARANCE`、`BUILDING_STATIC_CLEARANCE`，未在测试中复制不同数字；车辆与道路重叠、道路彼此相交、tree 与 road 均未纳入错误判定，与简报一致。

## 测试数

- `src/game/cityLayout.test.ts`：25 个测试（含原有 17 个保留测试 + 新增 8 个矩阵测试，其中前 2 个在 RED 阶段已存在并转为 GREEN），全部通过。
- `src/game`（含 `placementGeometry.test.ts` 等 6 个文件）：126 个测试全部通过。
- `npm.cmd run typecheck`：通过。
- `npm.cmd run lint`：通过。
- IDE 诊断：本任务修改的两个文件无 lint 错误。

## 自审

- 手工逐项核算了全部 6 栋建筑、6 个 lot、4 条道路、3 段河流、8 个环境仓库、10 棵树、8 辆车之间的相关 AABB 间距，确认候选坐标本身满足矩阵要求；唯一发现的问题是 `clubhouse` 地块（坐标未变，沿用原值 `[7,0,-7]` size `[7,6]`）与原 `river 0`（`position.x = 13`）存在真实正面积重叠（x 方向重叠约 0.22，z 方向重叠约 0.29），这是仓库中已存在但此前未被任何测试捕获的问题；简报未冻结河流坐标（"候选重排"未列出河流新坐标，"保留测试"只要求维持"右侧河流规则"），因此按矩阵做了最小化处理：仅将该河流 `position[0]` 从 `13` 调整为 `13.7`，使 lot/building 与该河流的 X 轴间距 ≥0.35，未改其 `size`、`rotation`、`position[2]`，也未触及另外两段河流。
- 除该处最小河流调整外，其余全部坐标严格按简报"候选重排"章节给出的数值采用，未做进一步微调。
- 未修改 `buildingCatalog.ts`、`cityTypes.ts` 或任何视觉/模型代码；未实现拖动交互；未执行任何 Git 操作。
- 变更范围仅包括 `src/game/cityLayout.ts`、`src/game/cityLayout.test.ts` 与本报告文件。
