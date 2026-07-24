# Clubhouse 特殊直接升级设计

## 目标

Clubhouse 不再参与通用“子建筑逐项升级 → 阶段 100% → 主建筑确认页”流程，而是作为特殊建筑直接升级：

- 解锁条件仍为帮派 Lv.40。
- 主等级仍为 Lv.1–10。
- 继续使用现有主建筑升级成本与 `buildingPowerById.clubhouse` 战力。
- 详情页只有一个直接升级按钮；点击后立即结算生产、校验资源、扣费并提升主等级，不进入确认页。
- Clubhouse 不显示子建筑卡片、阶段进度、公用子升级按钮、主升级确认页。

## 规则

### 直接升级

目标等级为 `currentLevel + 1`。

按钮文案：

`直接升级 Clubhouse 至 Lv.N · 钱 A · 油 B · 物资 C`

零成本资源仍按现有格式隐藏。按钮点击调用既有 Store 主升级原子事务：

1. 结算截至点击时刻的资源生产。
2. 重新读取 Clubhouse 当前等级与最新钱包。
3. 校验帮派 Lv.40 解锁、Lv.10 上限和主升级成本。
4. 同一 `set` 内扣费并将主等级 +1。

不满足条件时不扣费、不升级；资源不足显示现有精确缺口文案。Clubhouse 不受修车厂或自身子建筑进度约束。

### 数据与迁移

为保持 `BuildingProgress` 统一结构，Clubhouse 仍保留长度 10 的 `childLevels` 字段，但运行期必须恒为全 0，且不能通过 Store 子升级 API 修改。

城市 persist 从 v3 升至 v4。v3→v4 时：

- 将旧 Clubhouse `childLevels` 全部归零。
- 按当前 `economy.config.json.childUpgradeCostByTargetLevel` 对旧 Clubhouse 已记录的每一级子升级一次性退款。
- 使用饱和加法，钱包不超过 `Number.MAX_SAFE_INTEGER`。
- v4 重新 hydrate 不重复退款。
- Clubhouse 主等级、城市资源时钟、生产者和其他建筑进度不变。

新账号、reset、坏存档规范化后的 Clubhouse `childLevels` 均为全 0。

### 3D 表现

Clubhouse 仍复用现有 10 份程序化几何蓝图作为“主等级视觉层”，但不再读取 `childLevels`：

- Clubhouse Lv.N 直接渲染前 N 份几何，状态均为完成态。
- 主等级提升后立即出现下一层视觉。
- 不显示脚手架，不播放子建筑升级动画。

其他五座建筑继续按各自 `childLevels` 渲染，行为不变。

### UI 与可访问性

Clubhouse 详情页保留：

- 名称、等级、资源余额。
- 当前战力、目标战力与增量。
- 下一等级主成本或资源缺口。
- 直接升级按钮 / Lv.10 满级状态。
- 关闭按钮和现有事件隔离。

不渲染任何 `radio`、`radiogroup`、`progressbar`、`升级「…」`、`升级主建筑至…` 或 `确认升级` 控件。直接升级按钮热区双轴不少于 44px，并保留焦点样式。

### 兼容边界

- 其他建筑的碎片化升级、阶段 100%、确认页和门槛不变。
- 非 Clubhouse 目标 Lv.6–10 仍受 Clubhouse 主等级约束。
- Clubhouse 战力仅展示，不参与门槛或战斗。
- 不新增依赖，不修改 Adventure/Gang 存档。

## 验收

自动测试与真实浏览器至少覆盖：

1. Clubhouse 无子建筑/进度/确认页。
2. 资源足够时一次点击精确扣费并升一级。
3. 资源不足、未解锁、满级均原子阻止。
4. Store 子升级 API 拒绝 Clubhouse。
5. v3→v4 退款一次且 v4 不重复。
6. Clubhouse Lv.N 3D 直接渲染 N 层，无脚手架。
7. 修车厂和其他建筑原流程无回归。
8. 本地门禁、CDP、Pages 发布和公开复验全绿。
