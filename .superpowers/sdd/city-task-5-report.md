# City Task 5 报告

## 状态

已完成 brief 指定的四个实现文件：六类建筑三级程序化配置、通用 `BuildingModel` 和统一 `InteractiveBuilding` 命中包装。未创建场景或 App，未加载外部模型，未初始化 Git。

## 配置 TDD

- RED：先创建 `buildingVisualConfig.test.ts`，执行定向测试；测试套件因 `./buildingVisualConfig` 模块缺失而失败（退出码 1），符合 brief 要求的模块缺失 RED。
- GREEN：实现 `buildingVisualConfig.ts` 后重新执行定向测试，1 个测试文件、5 个测试全部通过。
- 测试覆盖：六类 BuildingKind 的 1/2/3 级、阶段非空且数量严格递增、全部几何尺寸为正、各类三级 signature tag、精确阶段引用返回。

## 验证

- `npm.cmd test -- src/scene/city/buildingVisualConfig.test.ts`：通过，1 个测试文件、5 个测试。
- `npm.cmd test`：通过，10 个测试文件、48 个测试。
- `npm.cmd run typecheck`：通过，退出码 0。
- `npm.cmd run lint`：通过，退出码 0。
- 编辑文件 IDE lint：无诊断。

## 自审

- 每级配置均为完整渲染数组；六类三级均保留指定 signature tag。
- box/cylinder 分别使用对应 geometry；颜色角色映射、暖色高亮 emissive 和双向阴影符合要求。
- 互动包装从 catalog/store 读取定义、等级和选中状态；点击及 pointer over/out 均阻止冒泡。
- 透明命中盒覆盖完整 footprint；hover/selected 底座略高于地面；hover、离开及卸载时正确管理 cursor。
- 变更范围仅为 brief 指定四个文件及本报告。

## 关注事项

- brief 仅要求配置严格 TDD，因此互动命中没有新增组件测试；已由 TypeScript、ESLint 和自审覆盖。
- 本任务按约束未接入现有 App/场景，实际镜头下的视觉比例和命中手感需由后续场景集成任务验收。

## 审查修复（2026-07-22）

### 修复内容

- 配置测试改为逐 BuildingKind、逐等级断言摘要关键 tag，共覆盖 18 个完整 stage，不再只检查三级 signature。
- recycling 补齐一级抓机/吊臂、二级压块车间/双层货架、三级分拣楼/磁吸吊机。
- logistics 补齐一级两座装卸月台、二级分拣扩建/传送带雨棚、三级高位仓/装卸塔。
- gas 补齐一级双泵/顶棚、二级四泵/便利店/价格立柱、三级重型顶棚/加注区/高标识。
- repair 补齐一级维修棚/室外零件架、二级双工位/起重机/排气管、三级多跨大厅/屋顶机械平台。
- clubhouse 补齐一级门廊、二级二层露台/霓虹招牌、三级屋顶观景台。
- commercial 补齐一级后巷装卸、二级二层/连廊/广告牌、三级多栋楼/中央灯塔。
- cursor 改为模块级 hovered building ID Set 共享所有权；over 注册、out 与卸载移除，只有 Set 为空时才恢复 default，避免实例间竞争。

### 修复 TDD

- RED：新增逐级 tag 断言后，配置测试按预期失败于 `recycling level 1` 缺少 `grab-crane`、`crane-boom`（1 失败、4 通过）。
- GREEN：补齐所有等级配置后，定向配置测试 1 个文件、5 个测试全部通过。

### 最终三级部件数量

- recycling：4 / 7 / 9
- logistics：3 / 5 / 7
- gas：4 / 8 / 9
- repair：3 / 7 / 9
- clubhouse：3 / 5 / 7
- commercial：3 / 6 / 7

### 最终验证

- `npm.cmd test -- src/scene/city/buildingVisualConfig.test.ts`：通过，1 个测试文件、5 个测试。
- `npm.cmd test`：通过，10 个测试文件、48 个测试。
- `npm.cmd run typecheck`：通过，退出码 0。
- `npm.cmd run lint`：通过，退出码 0。

### 修复后关注事项

- 游标共享所有权由事件和卸载清理实现，未新增 R3F 组件交互测试；多实例实际 pointer 交接仍建议在后续场景集成时手动验收。
- 仍未创建或修改 App/场景，未初始化 Git。

## 复审最终结果（2026-07-22）

### 当前唯一有效部件数量

- recycling：4 / 7 / 9
- logistics：3 / 5 / 7
- gas：4 / 8 / 9
- repair：3 / 7 / 9
- clubhouse：3 / 5 / 7
- commercial：3 / 6 / 7

### 霓虹招牌修复

- `clubhouse-sign`（并兼容 `neon-sign` tag）在未 highlighted 时使用 Clubhouse accent 色作为 emissive，强度为 0.45，形成常亮霓虹感。
- 其他部件未 highlighted 时 emissive 保持关闭；highlighted 时仍使用暖黄色 0.22 轻微发光。
- 新增材质行为测试并完成 RED/GREEN：RED 精确失败于招牌 emissive 为黑色、强度为 0；GREEN 后招牌常亮及普通部件高亮逻辑均通过。

### 最终验证

- `npm.cmd test -- src/scene/city/buildingVisualConfig.test.ts`：通过，1 个测试文件、6 个测试。
- `npm.cmd test`：通过，10 个测试文件、49 个测试。
- `npm.cmd run typecheck`：通过，退出码 0。
- `npm.cmd run lint`：通过，退出码 0。
- 未引入动画、外部资源或 cursor 测试 API，未初始化 Git。

## 霓虹高亮优先级复审（2026-07-22）

- RED：先新增“霓虹招牌 + highlighted”组合测试；定向测试按预期 1 失败、6 通过，实际收到 accent emissive `#c66b43` / 0.45，而预期为统一暖黄色 `#ffcf70` / 0.22。
- 修复：材质分支改为 highlighted 优先；高亮时包括霓虹招牌在内统一使用暖黄色 emissive / 0.22，只有未高亮的霓虹招牌使用 accent 常亮 / 0.45。
- GREEN：定向配置与材质测试通过，1 个测试文件、7 个测试。
- 全套测试：通过，10 个测试文件、50 个测试。
- `npm.cmd run typecheck`：通过，退出码 0。
- `npm.cmd run lint`：通过，退出码 0。
- 未初始化 Git。
