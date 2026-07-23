# Layout Task 1 报告

## 状态

已完成共享布局几何纯函数、单元测试，以及 `cityLayout.test.ts` 的 AABB 公式迁移。未修改 `cityLayout.ts` 内容或 placements，未实现拖动，未执行 Git commit 或 push。

## TDD 记录

- RED：先新增 `placementGeometry.test.ts`，运行 `npm.cmd test -- src/game/placementGeometry.test.ts`。
- RED 结果：1 个测试文件失败，`0 test`；失败原因是预期的 `./placementGeometry` 模块不存在。
- GREEN：实现 `placementGeometry.ts` 后再次运行同一命令。
- GREEN 结果：首轮 1 个测试文件通过，12 个测试全部通过。
- 审查补强先新增 Z 轴相切及 gap 小于、等于、大于 clearance 的测试，再用仅检查 X 轴的临时变异验证 RED：18 个测试中 3 个按预期失败；恢复双轴实现后 18/18 通过。
- 迁移验证：运行 `npm.cmd test -- src/game/placementGeometry.test.ts src/game/cityLayout.test.ts`，2 个测试文件、33 个测试全部通过。

## 边界规则

- AABB 按旋转后的投影宽度和深度计算，覆盖 0°、90° 和 45°。
- interactive building 使用 catalog footprint × `BUILDING_RENDER_SCALE`，保留 position 和 rotation。
- clearance 为负数或 NaN 时按 0 处理。
- 正面积重叠判冲突；clearance 为 0 时相切不冲突。
- X、Z 两轴必须同时满足间距规则；实际轴向间距小于 clearance 时冲突，等于或大于时不冲突。
- `aabbContains` 与 `isAabbInsideBounds` 均允许边界相等，并分别覆盖 minX、maxX、minZ、maxZ 越界。
- 使用 footprint 尺寸不同的 `recycling-yard` 与 `gas-station`，验证 building id 对应的 catalog 查询。

## 验证

- `npm.cmd test -- src/game/placementGeometry.test.ts src/game/cityLayout.test.ts`：通过，33/33。
- `npm.cmd run typecheck`：通过。
- `npm.cmd run lint`：通过。
- IDE 诊断：本任务修改的 TypeScript 文件无 lint 错误。

## 自审

- 变更范围仅包括共享几何模块、对应测试、`cityLayout.test.ts` 公式迁移和本报告。
- `cityLayout.test.ts` 已删除本地 `getPlacementAabb`，正面积重叠判断改用共享函数且 clearance 固定为 0，保持原有测试语义。
- 未修改 `cityLayout.ts` 内容或 placements，因此当前坐标与 expected positions 均保持不变。
- Cygwin 工作树中的 file mode 观测属于文件元数据，不属于内容变更；本轮审查修复未执行 `chmod`、Git config、Git commit 或 push。
- 工作区原先已有大量与本任务无关的修改和未跟踪文件；本任务未清理或覆盖这些内容。
