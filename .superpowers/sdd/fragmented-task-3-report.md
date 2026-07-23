# Fragmented Building Upgrades — Task 3 Report

## 状态

Task 3「六类十槽子建筑蓝图」已按严格 TDD 完成，并针对审查的 6 个 Important 与相关
Minor 全部修复。改动仅涉及：

- 重写 `src/scene/city/buildingFragmentCatalog.ts` 与
  `src/scene/city/buildingFragmentCatalog.test.ts`；
- 更新计划 `docs/superpowers/plans/2026-07-23-fragmented-building-upgrades.md`
  （Task 3 明确保留 legacy 到 Task 4、不勾选删除 legacy；Task 4 增加删除步骤）；
- 更新本报告。

未改动 `BuildingModel` / `BuildingVisual` / `InteractiveBuilding`、任何 UI 或 store；
按指示保留旧 `buildingVisualConfig` / `getBuildingVisualStage` 及其测试为**过渡 API**
（Task 4 迁移后删除）。未 commit / push。全量测试 / typecheck / lint / format 全绿。

## 审查修复对照

### Important 1 — 显式局部动画锚点

- `BuildingFragmentBlueprint` 与 `RenderedBuildingFragment` 新增
  `anchor: readonly [number, number, number]`（槽心，y=0）。
- 所有 part 改为**相对 anchor 的局部坐标**（origin-relative），不再内嵌槽位偏移。
- envelope 测试组合 `anchor + part transform + BUILDING_RENDER_SCALE` 验证。
- Task 4 可直接 `<group position={anchor}>` 原地 scale，升级动画不会向建筑原点滑动。

### Important 2 — 十槽语义可见差异

- 每个 kind 的 10 个槽位不再复用同一模板改高度，而是按设计名称**各自专属几何**：
  形状（box/cylinder）、排列、part 数量与语义 tag 均不同。例如修车厂含
  `repair-shed` / `repair-parts-shelf`×3 / `repair-lift-post`+平台+车体 /
  `repair-paint-booth` / `repair-control-room`+天线+卫星盘 等。
- 测试断言每个 kind 的 10 个槽 `${shape}:${tag}` 签名唯一、part 数量至少 2 种；并抽查
  语义 tag：喷漆间 `paint-booth`、控制室 `control-room`、磁吸吊机 `magnet`、
  中央灯塔 `beacon`、街区广告牌 `billboard`、主烟囱 `chimney`、洗车间 `wash`、
  霓虹标识 `neon`、回收控制塔 `control`。

### Important 3 — 相邻级 target(L+1) 强于 current(L)

- 新增测试：对每个 kind，L1–L9 各抽查同一已有 fragment，断言其 target(L+1) 的几何
  顶部（含 marker）显著高于 current(L)（`> current + 0.1`），同时仍在 footprint / hitbox 内。

### Important 4 — 附件不再沉入主体

- `enhancePart` 改为**绕 fragment 局部地面 (y=0) 统一 Y 缩放**：`position.y` 与
  `size.y` / `height` 同乘 `growth`。地面部件仍贴地并长高；坐落于主体顶的附件
  （vent / sign / chimney / lantern 等）随主体顶等比上移，不下沉。
- 测试：Lv.10 下抽查 `repair-paint-filter`、`commercial-central-beacon`、
  `metalworking-main-chimney`、`gas-store-sign`、`clubhouse-beacon-lantern`，
  断言其底面不低于所属主体（parts[0]）顶（容差 0.05）。

### Important 5 — 解析 AABB 空间测试

- 空间不变量测试改为**不分配 Geometry**：box 用 8 角点经 `Matrix4` 旋转求 AABB；
  cylinder 用旋转后轴向的保守精确边界
  `h·|a·e| + r·√(1−(a·e)²)`。
- 覆盖 `rotation`、`anchor`、`BUILDING_RENDER_SCALE`；**恢复 Vitest 默认 5s 超时**
  （不再需要 30s 覆写）。

### Important 6 — 对齐计划

- 计划 Task 3：文件项标注保留 `buildingVisualConfig` 为过渡 legacy；Step 5 改为
  「保留 legacy 三快照 API 到 Task 4，不删除」，未勾选任何删除动作；接口块补上
  `anchor` 与 `animatedFragmentId`；Task 3 步骤按实际完成勾选。
- 计划 Task 4：新增「Delete (legacy…)」文件项与 Step 7「删除 Task 3 保留的 legacy」，
  明确由 Task 4 删除。

### Minor — animatedFragmentId / marker / 纯 API

- `getRenderedBuildingFragments(kind, progress, animatedFragmentId?)`：`animate` 仅在
  **`state === 'target'` 且 `blueprint.id === animatedFragmentId`** 时为真；**缺省不
  animate**，刷新不会重播入场；传入 current / scaffold 槽的 id 也不会动画。Task 4 依据
  前后 progress 传入刚完成（target）的 fragment id。测试覆盖：缺省不 animate、指定
  target id 精确命中、未渲染 id 不 animate、current 槽 id 不 animate、scaffold 槽 id 不 animate。
- marker 不再把 `parts[0]` 强转为 box：改由 fragment 的**真实顶部**（最高的 enhanced
  part）计算位置与横向尺寸。
- API 为**纯且确定性**函数：相同 `(kind, progress, animatedFragmentId)` 始终产出等价结果，
  适合渲染层按这些输入 `useMemo`（每次调用仍返回新数组，不声称返回引用稳定）。已在代码注释中说明。

## 渲染规则（不变）

设当前级 `L`、目标级 `N = getTargetBuildingLevel(L)`、已完成 `p`：

- `p === 0`：显示前 `L` 个子建筑，全部 `current`。
- `p > 0`（仅 `L < 10`）：显示 `N` 个 —— `i < p` → `target`(渲染于 N)；`p ≤ i < L` →
  `current`(渲染于 L)；`i ≥ L` → `scaffold`(低矮施工基座)。
- `p === N`（ready）：`N` 个全 `target`。
- Lv.10：`completedFragments` 视为 0，显示 10 个 `current`（最高强化形态）。
- `completedFragments` 经 `trunc` + clamp 到 `[0, N]`。

## 等级强化（可见但受控）

- 高度按 `1 + 0.04·(level − 1)` 绕局部地面统一放大（Lv.10 = 1.36×）。
- marker：`level ≥ 2` 时在 fragment 真实顶部叠加 accent 标志，高度
  `0.3 + 0.15·(level − 1)` 递增。
- 因此同一子建筑 `target`(N) 明显高于 `current`(L)；同时 Lv.10 缩放后最高点仍 ≤
  `BUILDING_HITBOX_HEIGHT`（实测各 kind 最高约 4.3 < 5）。

## TDD 证据

### RED（本次修复迭代）

先重写 `buildingFragmentCatalog.test.ts`（anchor、每槽签名唯一 + 语义 tag 抽查、
相邻级 target>current、Lv.10 附件不沉、`animatedFragmentId`、解析 AABB envelope）。
在旧实现下这些用例必然失败：旧 blueprint / rendered 无 `anchor` 字段、
`getRenderedBuildingFragments` 无 `animatedFragmentId` 形参、无专属语义 tag、
附件采用保底而非统一缩放——即接口与断言均与旧实现不符（有效 RED）。

### GREEN

`npm.cmd test -- src/scene/city/buildingFragmentCatalog.test.ts`

- 25/25 通过（解析 AABB，用时约 3.5s，默认 5s 超时内）。含后续两个 animate 守卫用例：
  先写测试（传 current / scaffold 槽 id 期望不 animate）得到 2 例 RED，再收紧
  `animate` 到「target 且 id 命中」后转 GREEN。

## 最终验证

- `npm.cmd test`
  - PASS，29 个文件、363 个测试。
- `npm.cmd run typecheck`
  - PASS。
- `npm.cmd run lint`
  - PASS。
- `npm.cmd run format:check`
  - PASS。
- 变更文件 IDE lint
  - PASS，无诊断。

## 关注事项 / 交接（Task 4）

- `BuildingModel` 迁移到 `getRenderedBuildingFragments`：以稳定 `fragment.id` 为 key，
  每 fragment 用 `<group position={fragment.anchor}>` 原地 scale；由前后 progress 计算
  `animatedFragmentId` 只让刚变化的 fragment 播放入场动画。
- 迁移完成后删除本任务保留的 legacy `buildingVisualConfig` / `getBuildingVisualStage`
  及其测试（计划 Task 4 Step 7）。
- `getBuildingFragments` 返回的 `parts` 为 Lv.1 基础局部形态；等级强化与 marker 仅在
  `getRenderedBuildingFragments` 内生成，动画由渲染层依据 `animate` 触发。
