# Fragmented Building Upgrades — Task 1 Report

## 状态

Task 1 领域规则及审查修复已按严格 TDD 完成。除计划列出的
`cityTypes`、`buildingUpgrade`、`buildingCatalog` 及其测试外，仅按审查要求在
`buildingVisualConfig` 及其测试中加入最小临时兼容层，并新增本报告；未修改
store 或 UI，未 commit/push。

已实现：

- `BuildingLevel` 与 `BUILDING_LEVELS` 扩展为 Lv.1–10。
- 新增 `{ level, completedFragments }` 领域进度。
- 当前 Lv.L 的目标等级为 Lv.L+1，目标 Lv.N 需要 N 个碎片。
- 每次只完成一个碎片；完成全部碎片后保持当前等级并等待确认。
- 确认后原子升级并将碎片数清零。
- Lv.10 封顶、进度为 100%，不再完成碎片或确认升级。
- 等级与进度归一化覆盖越界值、小数、非有限数、非对象、旧数字等级和未知字段。
- 六类建筑的 `levelSummary` 均扩展为 10 项 readonly tuple。
- 每栋建筑的 10 条等级文案均非空且组内唯一；原 Lv.1–3 文案保持兼容。
- 临时保留 `upgradeBuildingLevel` 兼容入口，供 Task 2 改写前的旧 city store 使用。
- 旧 3D 快照类型临时允许 1–10 级 Partial 配置，未定义的 Lv.4–10 均通过
  `getBuildingVisualStage` 回退到当前最高快照 Lv.3，绝不返回 `undefined`。

## TDD 证据

### RED

1. `npm.cmd test -- src/game/buildingUpgrade.test.ts`
   - 首轮因旧实现没有 `BUILDING_LEVELS` 导致测试定义错误；调整测试数据源后重新运行。
   - 有效 RED：35/35 失败。
   - 失败原因符合预期：缺少 1–10 等级常量和新的碎片升级纯函数。
2. `npm.cmd test -- src/game/buildingCatalog.test.ts`
   - 1 个测试失败、5 个通过。
   - 失败原因符合预期：`levelSummary` 实际长度为 3，期望为 10。
3. 审查修复：
   `npm.cmd test -- src/scene/city/buildingVisualConfig.test.ts src/game/buildingUpgrade.test.ts src/game/buildingCatalog.test.ts`
   - 1 个测试失败、52 个通过。
   - Lv.10 回退测试按预期收到 `undefined`，验证 Important 可复现。
   - 部分进度 1/2=50%、数组输入归一化、目录文案组内唯一属于现有行为的覆盖补强，
     测试先写后直接通过，未人为破坏实现制造失败。

### GREEN

`npm.cmd test -- src/game/buildingUpgrade.test.ts src/game/buildingCatalog.test.ts`

- 2 个测试文件通过。
- 41/41 测试通过。
- 审查修复后定向测试：3 个测试文件、53/53 测试通过。

## 最终验证

- `npm.cmd test -- src/game/buildingUpgrade.test.ts src/game/buildingCatalog.test.ts`
  - PASS，2 个文件、41 个测试。
- `npm.cmd test -- src/game`
  - PASS，6 个文件、158 个测试。
- `npm.cmd test -- src/game src/store/useCityStore.test.ts`
  - PASS，7 个文件、165 个测试；确认临时兼容入口没有破坏旧 store。
- `npm.cmd test`
  - PASS，26 个文件、314 个测试。
- `npm.cmd run typecheck`
  - PASS。
- `npm.cmd run lint`
  - PASS。
- `npm.cmd run format:check`
  - PASS。
- Task 1 文件 IDE lint
  - PASS，无诊断。

## 关注事项

`BuildingVisualStages` 的 Partial 类型与 Lv.3 回退仅是跨任务兼容 shim，不是
十槽蓝图实现。Task 3 必须删除该回退并用程序化碎片目录替换旧三快照 API；
在此之前，Lv.4–10 会安全显示 Lv.3 外观，但不会体现真实十级视觉差异。
