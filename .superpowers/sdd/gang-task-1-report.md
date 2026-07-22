# Gang Task 1 报告：迁移建筑目录、布局与视觉

## 状态

已完成，并已修复视觉测试自审中的唯一 Minor。仅迁移六建筑身份（ID/kind/名称/视觉）及补强测试，未实现帮派等级规则，未初始化 Git。

## TDD 记录

### RED

先修改以下三个测试文件，改用新 ID/kind 断言，运行 `npm.cmd test -- src/game src/scene/city/buildingVisualConfig.test.ts`：

- `src/game/buildingCatalog.test.ts`：`EXPECTED_NAMES` 改为 `['修车厂','废车回收厂','商业街','金属加工厂','加油站','Clubhouse']`。
- `src/game/cityLayout.test.ts`：`EXPECTED_INTERACTIVE_BUILDINGS` 中 `logistics-center` → `metalworking-plant`，`commercial-district` → `commercial-street`。
- `src/scene/city/buildingVisualConfig.test.ts`：`buildingKinds` 与 `expectedLevelTags` 中 `logistics` → `metalworking`，并按新 stage 标签更新期望。

RED 结果：3 个测试文件、8 个用例失败（`buildingCatalog` 目录名称顺序、`cityLayout` 建筑位置断言、`buildingVisualConfig` 全部 6 项因 `metalworking` key 缺失而失败）。

### GREEN

依次修改生产代码：

- `src/game/cityTypes.ts`：`BUILDING_IDS` 改为 `['repair-shop','recycling-yard','commercial-street','metalworking-plant','gas-station','clubhouse']`；`BuildingKind` 改为 `'repair' | 'recycling' | 'commercial' | 'metalworking' | 'gas' | 'clubhouse'`。
- `src/game/buildingCatalog.ts`：按新目录顺序重写六条定义，`recycling-yard` 名称改“废车回收厂”，新增 `commercial-street`（继承旧 commercial-district footprint/配色，三级说明改为“商业街综合楼群配中央灯塔”）与 `metalworking-plant`（继承旧 logistics-center footprint/配色，三级说明按简报文案改写），其余（repair-shop/gas-station/clubhouse）保持不变。
- `src/game/cityLayout.ts`：`interactiveBuildingPlacements` 中心位置全部保留，仅将 `logistics-center` → `metalworking-plant`、`commercial-district` → `commercial-street`。
- `src/scene/city/buildingVisualConfig.ts`：`logistics` key 改 `metalworking`，重新设计三级 stage：
  - L1：`main-building`、`furnace`、`material-stack`（3 项）
  - L2：L1 全量 + `stamping-shop`、`smokestack`、`lifting-frame`（6 项，严格递增）
  - L3：L1 全量 + `metalworking-hall`、`second-furnace`、`gantry-crane`、`tall-smokestack`（7 项，严格递增）
  - 所有新增部件几何尺寸为正，缩放后顶部高度均低于 `BUILDING_HITBOX_HEIGHT`（5）。
- `src/store/useCityStore.test.ts`：清理残留旧 ID（`logistics-center`→`metalworking-plant`、`commercial-district`→`commercial-street`），此文件未直接涉及三个 RED 测试文件，仅做旧 ID 清理，不改变测试语义。

GREEN 结果：三个目标测试文件全部通过（4 个文件、32 个用例）。

### Minor 修复

- 仅修改 `src/scene/city/buildingVisualConfig.test.ts`，在 `metalworking` L3 的标签期望中显式加入 `main-building`、`furnace`、`material-stack`。
- 该断言确保 L3 除新增的 `metalworking-hall`、`second-furnace`、`gantry-crane`、`tall-smokestack` 外，继续保留三个基础识别物。
- 未修改生产代码。

## 全工作区旧 ID 检索

在 `src/` 范围内检索 `logistics-center`、`commercial-district`、`kind: 'logistics'`、`'logistics'`、`物流中心`、`商业区`、`废车回收站`，均无匹配，确认无残留（未检索/修改 `.superpowers` 等设计文档）。

## 最终验证

| 命令 | 结果 |
|---|---|
| `npm.cmd test -- src/game src/scene/city/buildingVisualConfig.test.ts` | 4 files / 32 tests 全部通过 |
| `npm.cmd test -- src/scene/city/buildingVisualConfig.test.ts`（Minor 修复后） | 1 file / 8 tests 全部通过 |
| `npm.cmd test` | 10 files / 61 tests 全部通过 |
| `npm.cmd run typecheck` | 通过（`tsc -b --pretty false` 无输出） |
| `npm.cmd run lint` | 通过（`eslint .` 无输出） |

## 迁移对照表

| 旧 ID | 新 ID | 旧 kind | 新 kind | 旧名称 | 新名称 |
|---|---|---|---|---|---|
| repair-shop | repair-shop | repair | repair | 修车厂 | 修车厂（不变） |
| recycling-yard | recycling-yard | recycling | recycling | 废车回收站 | 废车回收厂 |
| commercial-district | commercial-street | commercial | commercial | 商业区 | 商业街 |
| logistics-center | metalworking-plant | logistics | metalworking | 物流中心 | 金属加工厂 |
| gas-station | gas-station | gas | gas | 加油站 | 加油站（不变） |
| clubhouse | clubhouse | clubhouse | clubhouse | Clubhouse | Clubhouse（不变） |

布局中心位置均未变化，lot 与静态碰撞规则测试继续通过。

## 自审

- 六建筑 ID/kind/名称/顺序与简报一致，已用 `buildingCatalog.test.ts` 的目录顺序与名称断言验证。
- 布局中心位置逐一核对与简报一致，未改动任何坐标数值，仅替换 ID 字符串。
- `metalworking` 视觉三级严格递增（3 < 6 < 7），且 L1/L2/L3 标签集合满足简报列出的必需标签；L3 已显式断言保留 `main-building`、`furnace`、`material-stack` 三个基础识别物（用 `expect.arrayContaining` 断言验证）。
- 未触碰帮派等级/权限等规则代码，未执行任何 Git 操作。
- 未修改 `.superpowers/sdd` 下的设计/计划/历史报告文字（仅新增本报告文件）。

## 关注事项

- `commercial-street` 与 `metalworking-plant` 的三级视觉说明文案为本次迁移新写（`商业街综合楼群配中央灯塔`及金属加工厂三级文案），未来若有专门的美术/文案评审需求，可能需要二次润色，但当前满足简报字面要求与测试断言。
- `src/store/useCityStore.test.ts` 中旧 ID 的替换未在 RED/GREEN 主流程内单独验证（该文件测试逻辑与建筑身份无关，仅做字符串占位替换），已随全量测试一并跑通确认无回归。
