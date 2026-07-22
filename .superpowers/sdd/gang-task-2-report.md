# Gang Task 2 实施报告

## 状态

已完成帮派等级、职位、挂机收益和建筑解锁纯规则，仅新增规则模块、规则测试与本报告；未创建或修改 store/UI，未初始化 Git。

## TDD 记录

- RED：先创建 `src/game/gangProgression.test.ts`，执行
  `npm.cmd test -- src/game/gangProgression.test.ts`。
- RED 结果：退出码 1，测试套件因 `./gangProgression` 模块不存在而失败，符合任务要求的模块缺失 RED。
- GREEN：随后创建 `src/game/gangProgression.ts`，实现测试要求的最小纯规则。
- 首次 GREEN 运行发现测试本身对 Lv1 修车厂的“前一级”断言与等级下限 clamp 冲突；修正测试边界后，专项 57 项测试全部通过。
- 全量验证时 TypeScript 编译目标不支持 `Array.findLast`；改为兼容的倒序查找后重新执行全部验证。
- 审查修复 RED：先为 4 个 level API 新增 `NaN`、`±Infinity` 和非整数输入测试；专项运行退出码 1，`getNextGangRole(NaN)`、`getTotalReputationForLevel(NaN)` 与 `isBuildingUnlocked(..., NaN)` 共 3 项按预期失败，确认现实现未满足规范。
- 审查修复 GREEN：统一引入 `normalizeLevel`，规定 `NaN`/`-Infinity` → 1、`+Infinity` → 50、有限值先 `floor` 再 clamp 到 1..50；专项 61 项测试全部通过。

## 覆盖范围

专项共 61 项测试，覆盖：

- 6 个固定常量。
- 7 个职位阈值、6 个中间等级区间、等级上下限 clamp。
- `getGangRole`、`getNextGangRole`、`getTotalReputationForLevel`、`isBuildingUnlocked` 对 `NaN`、`±Infinity`、1.9、8.9、50.9 的统一等级规范化。
- 当前职位与严格大于当前等级的下一职位，含 Lv50 `null`。
- 声望 0、29、30、1469、1470、超额、负数及非有限值。
- 各等级累计声望与等级进度，含满级 `{ current: 30, required: 30 }`。
- 6 个建筑的固定顺序、职位和逐项解锁阈值，含初始仅修车厂及未知 ID。
- 挂机完整秒、小数秒、逆向/相同时间、非有限时间及 8 小时上限。

## 最终验证

- `npm.cmd test -- src/game/gangProgression.test.ts`：通过，1 个文件、61 项测试。
- `npm.cmd test -- src/game`：通过，4 个文件、85 项测试。
- `npm.cmd run typecheck`：通过，退出码 0。
- `npm.cmd run lint`：通过，退出码 0。
- IDE 规则与测试文件诊断：无错误。

## 自审

- 与 brief 中常量、职位文案、建筑顺序和函数签名逐项核对，无遗漏。
- 实现只依赖 `BuildingId` 类型，无状态、时间读取或 UI 依赖。
- 4 个接收 level 的公开 API 均调用同一 `normalizeLevel`，未保留分叉的 clamp 行为。
- 未发现阻塞项；未初始化 Git。
