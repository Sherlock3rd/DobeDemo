# Fragmented Building Upgrades — Task 2 Report

## 状态

Task 2「安全持久化城市进度」已按严格 TDD 完成。新增共享 `safeStorage`、城市进度
迁移模块与持久化后的 `useCityStore`，并把 `useGangStore` 迁移到共享 safe storage。
未改动 UI / 3D，未 commit / push。

每个任务保持独立可构建：在 Task 4/5 消费方改造前，`useCityStore` 暂时保留了带明确
注释的派生兼容字段 `buildingLevels` 与旧兼容动作 `upgradeBuilding`，使现有
`BuildingPanel` / `InteractiveBuilding` 及其旧测试继续通过。真源为 `buildingProgress`，
新逻辑为 `completeNextFragment` / `confirmBuildingLevelUp`；persist 只保存
`buildingProgress`，rehydrate/merge 后派生兼容字段同步重算，不产生双真源。

## 交付文件

- 新增 `src/store/safeStorage.ts`：共享 sticky in-memory fallback 的 `createSafeStorage`。
- 新增 `src/store/safeStorage.test.ts`：get/set/remove 任一异常后的 sticky fallback。
- 新增 `src/store/cityProgressMigration.ts`：`CITY_STORAGE_KEY`、`BuildingProgressById`、
  `createInitialBuildingProgress`、`normalizeBuildingProgressById`。
- 新增 `src/store/cityProgressMigration.test.ts`：迁移与归一化用例。
- 重写 `src/store/useCityStore.ts`：Zustand `persist`，真源 `buildingProgress`，
  派生 `buildingLevels`，动作 `completeNextFragment` / `confirmBuildingLevelUp`，
  临时兼容动作 `upgradeBuilding`。
- 重写 `src/store/useCityStore.test.ts`：默认值、目标隔离、未知 ID 引用不变、
  碎片到确认、reset、persist partialize、rehydrate 半完成/迁移/Lv.10 封顶、兼容视图同步。
- 修改 `src/store/useGangStore.ts`：`createSafeStorage` 实现移出并重导出，保持 API 兼容。
- 修改 `src/store/useGangStore.test.ts`：safe storage 用例迁至 `safeStorage.test.ts`，
  保留重导出一致性检查。

## 关键设计

- 真源单一：`buildingProgress: Record<BuildingId, { level, completedFragments }>`。
- 派生兼容：`buildingLevels` 由 `deriveBuildingLevels(buildingProgress)` 在每次变更、
  reset 与 `merge` 后重算，永不独立写入。
- persist：`name = 'dobe-city-progression-v1'`、`version = 1`、`partialize` 只输出
  `buildingProgress`；`selectedBuildingId`、动画/确认卡等 UI 态不持久化。
- `merge` 钩子对未信任持久化数据统一走 `normalizeBuildingProgressById`，覆盖旧数字等级、
  部分对象、缺失建筑、NaN/Infinity、碎片越界、Lv.10 清零、损坏/未知字段，并同步兼容视图。
- 动作在无变化时返回同一 `state` 引用（未知 ID、满级、已准备确认、旧动作到达 Lv.3 顶），
  满足引用不变约束。
- `useGangStore` 与 `useCityStore` 共用同一 `createSafeStorage`，localStorage 失败即
  sticky 切换内存存储。

## 覆盖对照（需求点 → 用例）

- sticky fallback：`safeStorage.test.ts` get/set/remove 任一异常后仍读到内存值。
- 旧数字/损坏数据迁移：`cityProgressMigration.test.ts` 与 `useCityStore.test.ts`
  「migrates legacy numeric and corrupt persisted structures on rehydrate」。
- 半完成重载：`useCityStore.test.ts`「rehydrates a half-completed upgrade」。
- selected 不持久化：「persists only buildingProgress and never the selection or derived levels」。
- 未知 ID 同引用：`completeNextFragment` / `confirmBuildingLevelUp` / `upgradeBuilding`
  三处「keeps the same state reference for an unknown building id」。
- reset 新对象：「resets selection and progress with fresh objects」。
- Lv.10 封顶：`cityProgressMigration.test.ts`「forces level 10 to zero fragments」与
  `useCityStore.test.ts`「caps a rehydrated level-10 building」。

## TDD 证据

### RED

1. `npm.cmd test -- src/store/safeStorage.test.ts`
   - 因 `./safeStorage` 模块不存在，测试套件加载失败（有效 RED）。
2. `npm.cmd test -- src/store/cityProgressMigration.test.ts`
   - 首轮模块缺失导致套件失败（有效 RED）。实现后 1 例因测试断言过严失败
     （NaN 等级归一为 Lv.1 时合法碎片计数应保留），修正测试断言为按条目精确期望，
     未削弱实现。
3. `npm.cmd test -- src/store/useCityStore.test.ts`
   - 针对旧 store 16 例中 13 例失败（缺少 `buildingProgress`、`completeNextFragment`、
     `confirmBuildingLevelUp`、`persist.rehydrate`），符合预期。

### GREEN

- `npm.cmd test -- src/store/safeStorage.test.ts`：6/6 通过。
- `npm.cmd test -- src/store/cityProgressMigration.test.ts`：11/11 通过。
- `npm.cmd test -- src/store/useCityStore.test.ts`：16/16 通过。
- `npm.cmd test -- src/store/useGangStore.test.ts src/store/safeStorage.test.ts`：21/21 通过。

## 最终验证

- 定向消费方回归
  `npm.cmd test -- src/store src/ui/BuildingPanel.test.tsx src/scene/city/InteractiveBuilding.test.tsx src/scene/city/CityScene.test.tsx src/scene/city/dragClickSuppression.test.tsx src/App.test.tsx`
  - PASS，9 个文件、78 个测试。
- `npm.cmd test`
  - PASS，28 个文件、340 个测试（含审查修复新增的 2 个旧 action no-op 用例）。
- `npm.cmd run typecheck`
  - PASS。
- `npm.cmd run lint`
  - PASS。
- `npm.cmd run format:check`
  - PASS（新增/修改文件经 `prettier --write` 修复后复检通过）。
- 变更文件 IDE lint
  - PASS，无诊断。

## 审查修复（唯一 Important）

问题：旧 `upgradeBuilding` 兼容动作会把目标建筑重写为 `{ level: nextLevel,
completedFragments: 0 }`，若该建筑正处于半完成或 ready-to-confirm 状态，会丢弃/覆盖
其碎片进度，使过渡提交在 3D/面板混用旧入口时可能吞掉进度。

修复：

- `upgradeBuilding` 在 `current.completedFragments > 0` 时严格 no-op 并返回原 `state`
  引用（ready 意味着 `completedFragments === requiredFragments ≥ 1`，同样被此守卫覆盖），
  绝不丢弃/覆盖碎片进度。
- 仅当 `completedFragments === 0` 时保留旧 UI 的 1→2→3 直接升级行为，并在类型接口与
  动作实现处明确注释这是当前旧 UI 的临时入口，Task 5 删除。
- 新增测试：注入半完成（1/2）与 ready（2/2）后调用旧 action，`buildingProgress`、
  `buildingLevels` 与整个 `state` 引用均不变；正常 0 碎片旧升级测试与 BuildingPanel/App
  旧 UI 测试仍全部通过。

修复后验证：store 定向 50/50、全量 340/340、typecheck、lint、format:check 均 PASS。

## 关注事项 / 交接

- `buildingLevels` 派生字段与 `upgradeBuilding` 兼容动作是跨任务 shim，Task 5 重写
  `BuildingPanel` 改为消费 `buildingProgress` / `completeNextFragment` /
  `confirmBuildingLevelUp` 后应删除，并同步移除对应旧测试断言。
- `merge` 已覆盖版本差异下的归一化；若未来引入 `version 2`，可在保留 `merge` 归一化的
  同时补充 `migrate` 以处理结构性重命名。
