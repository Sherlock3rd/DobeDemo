# City Task 2 报告

## 状态

完成。已按要求以 TDD 方式创建静态城市布局数据与测试，未初始化 Git。

## 文件

- `src/game/cityLayout.ts`
- `src/game/cityLayout.test.ts`
- `.superpowers/sdd/city-task-2-report.md`

## RED / GREEN

- RED：先创建测试，执行 `npm.cmd test -- src/game/cityLayout.test.ts`，因 `./cityLayout` 模块不存在而失败（1 个失败测试文件，0 个测试被执行），符合预期。
- GREEN：创建最小完整布局后再次执行同一命令，1 个测试文件、9 个测试全部通过。

## 数组数量

- 互动建筑：6
- 道路：4（横纵主干道各 1 段、支路 2 段）
- 地块：6
- 河流：3
- 环境建筑：8
- 静态车辆：8
- 树木：10

## 验证

- `npm.cmd test -- src/game/cityLayout.test.ts`：通过，1 个测试文件、9 个测试。
- `npm.cmd test -- src/game`：通过，3 个测试文件、18 个测试。
- `npm.cmd run typecheck`：通过，退出码 0。
- `npm.cmd run lint`：通过，退出码 0。

## 自审

- 六座互动建筑使用需求给定的精确位置，ID 与 `BUILDING_IDS` 完全一致且无重复。
- 互动建筑均位于城市边界内；镜头缩放顺序和移动边界满足约束。
- 道路包含十字主干道与两条支路；河流全部位于正 x、负 z 的右上区域。
- 环境建筑中心未占用互动建筑中心；所有静态分类均非空且车辆、树木满足最小数量。
- 仅修改了任务指定的两个源码文件与本报告。

## 关注事项

- 当前验证覆盖中心点不重合，未做所有建筑 footprint 之间的几何碰撞检测。
- 静态布局是数据配置，最终视觉间距与镜头观感仍需在后续 R3F 场景集成时实机确认。

## 审查修复（2026-07-22）

### 修复内容

- 将道路数量断言升级为拓扑断言：识别跨越城市中心、长宽比至少 2:1 的横向和纵向主干道。
- 将主干道之外的道路识别为支路，要求至少两条，并逐条验证其轴对齐范围与任一主干道相交或接触。
- 增加 `panBounds` 的 x、z 轴最小值不大于最大值断言，同时保留四个端点位于 `CITY_BOUNDS` 内的检查。
- 锁定镜头初始 `position`、`target` 和 `initialZoom` 精确值。
- 生产布局数据未修改。

### 审查后验证

- `npm.cmd test -- src/game/cityLayout.test.ts`：通过，1 个测试文件、11 个测试。
- `npm.cmd test -- src/game`：通过，3 个测试文件、20 个测试。
- `npm.cmd run typecheck`：通过，退出码 0。
- `npm.cmd run lint`：通过，退出码 0。

### 审查后关注事项

- 道路拓扑检查按当前未旋转、轴对齐的道路数据计算范围；若后续道路启用非零 rotation，测试中的相交算法需要同步支持旋转矩形。
