# 1–10 级碎片化城建升级设计

## 目标

把当前“点击一次直接切换整级模型”的 1–3 级升级，改造成参考 `example/levelupExample.mp4` 的两层升级闭环：

1. 逐个完成目标等级的子建筑碎片。
2. 总进度达到 100% 后确认主建筑升级。
3. 主建筑最高 10 级，目标等级 N 恰好需要完成 N 个子建筑任务。
4. 六类建筑保留独立的程序化工业视觉。

参考视频的 0.5 秒时间轴见 `.superpowers/sdd/2026-07-23-levelup-video-0.5s-analysis.md`。

## 已确认规则

- 六座建筑默认保持 Lv.1 已完成。
- Lv.1 的完整模型由 1 个逻辑子建筑组成。
- 从 Lv.1 升到 Lv.2，需要完成 2 个目标级子建筑。
- 从 Lv.2 升到 Lv.3，需要完成 3 个目标级子建筑。
- 依次递增，Lv.9 升到 Lv.10 需要完成 10 个目标级子建筑。
- Lv.10 显示 10 个永久子建筑，不能继续升级。
- 帮派等级只负责建筑解锁；建筑等级与碎片进度仍由城市状态负责。
- 不加入货币、材料、付费加速或施工倒计时，因为当前 Demo 没有相应经济系统。

## 方案选择

采用程序化子建筑蓝图，不手工维护 6×10 套完整快照：

- 每个 `BuildingKind` 定义 10 个稳定的逻辑子建筑。
- 每个逻辑子建筑可以包含多个 box/cylinder 几何部件。
- 目标 Lv.N 取前 N 个子建筑。
- 每次碎片升级把一个子建筑从当前级形态切换为目标级形态。
- 共享布局生成器控制位置、缩放和升级强化，避免包体随 60 套模型线性增长。

## 视频模式映射

| 参考视频 | 本项目 |
|---|---|
| Setup 总进度条 | 当前目标等级碎片进度 |
| Packager/Screener 等设施 | 六类建筑各自的子建筑 |
| 底部设施缩略格 | N 个碎片状态格 |
| 绿色扫光与设备回弹 | 目标子建筑绿色扫光、抬升和缩放回弹 |
| Setup 100% | `completedFragments === targetLevel` |
| Upgrade Effect 确认 | “完成 Lv.N 升级”确认卡 |
| 主建筑 Level Up | 原子提交等级并清空碎片进度 |

## 领域模型

```ts
export const BUILDING_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
export type BuildingLevel = (typeof BUILDING_LEVELS)[number]

export interface BuildingProgress {
  level: BuildingLevel
  completedFragments: number
}

export type BuildingProgressById = Record<BuildingId, BuildingProgress>
```

派生值：

```ts
targetLevel = level === 10 ? 10 : level + 1
requiredFragments = level === 10 ? 10 : targetLevel
progressPercent =
  level === 10 ? 100 : completedFragments / requiredFragments * 100
readyToLevelUp =
  level < 10 && completedFragments === requiredFragments
```

状态操作：

```ts
completeNextFragment(id: string): void
confirmBuildingLevelUp(id: string): void
reset(): void
```

`completeNextFragment`：

- 未知建筑、满级建筑或已准备确认时保持同一个 state 对象。
- 否则只把目标建筑的 `completedFragments` 加一。
- 不直接提升主建筑等级。

`confirmBuildingLevelUp`：

- 仅在碎片数等于目标等级时生效。
- 原子更新为 `{ level: targetLevel, completedFragments: 0 }`。
- Lv.10 封顶。

所有归一化和边界判断位于纯函数模块，UI 不自行计算状态变更。

## 子建筑蓝图

```ts
export interface BuildingFragmentBlueprint {
  id: string
  name: string
  description: string
  parts: readonly BuildingVisualPart[]
}

export type BuildingFragmentCatalog = Readonly<
  Record<BuildingKind, readonly [
    BuildingFragmentBlueprint,
    BuildingFragmentBlueprint,
    BuildingFragmentBlueprint,
    BuildingFragmentBlueprint,
    BuildingFragmentBlueprint,
    BuildingFragmentBlueprint,
    BuildingFragmentBlueprint,
    BuildingFragmentBlueprint,
    BuildingFragmentBlueprint,
    BuildingFragmentBlueprint,
  ]>
>
```

六类建筑的固定顺序：

| 序号 | 修车厂 | 废车回收厂 | 商业街 | 金属加工厂 | 加油站 | Clubhouse |
|---:|---|---|---|---|---|---|
| 1 | 基础维修棚 | 废车堆场 | 主街商铺 | 基础加工车间 | 一号泵岛 | 主会所 |
| 2 | 零件货架 | 抓机 | 装卸后巷 | 熔炉 | 二号泵岛 | 门廊 |
| 3 | 举升工位 | 压块车间 | 二号商铺 | 材料堆 | 金属顶棚 | 会所招牌 |
| 4 | 排气设施 | 分拣货架 | 街区广告牌 | 冲压车间 | 便利店 | 二层露台 |
| 5 | 诊断工位 | 打包机 | 餐饮摊位 | 主烟囱 | 价格立柱 | 二层会馆 |
| 6 | 轮胎工位 | 磁吸吊机 | 商业连廊 | 龙门吊架 | 三号泵岛 | 霓虹标识 |
| 7 | 小型起重机 | 破碎机 | 转角商铺 | 二号炉体 | 洗车间 | 车库 |
| 8 | 喷漆间 | 输送分选线 | 中央广场 | 切割线 | 卡车加注区 | 休息室 |
| 9 | 调校工位 | 金属分离器 | 综合塔楼 | 重型天车 | 储油标识 | 屋顶观景台 |
| 10 | 控制室 | 控制塔 | 中央灯塔 | 生产控制塔 | 综合服务楼 | 会馆灯塔 |

每种蓝图必须满足：

- 10 个唯一、稳定的 fragment ID。
- 几何尺寸均为有限正数。
- 经过 `BUILDING_RENDER_SCALE` 后位于对应建筑 footprint 内。
- 最高点不超过 `BUILDING_HITBOX_HEIGHT`。
- Lv.N 完整状态恰好渲染前 N 个逻辑子建筑。

## 部分升级渲染

当前级为 L、目标级为 N=L+1 时：

1. `completedFragments === 0`：只显示完整 Lv.L。
2. 第 k 次碎片完成后：
   - 前 k 个子建筑显示目标 Lv.N 的强化形态。
   - 其余已有子建筑继续显示 Lv.L 形态。
   - 新增的第 N 个槽位在轮到它前显示低矮施工基座。
3. `completedFragments === N`：场景已完整展示目标 Lv.N，但 store 仍保持 Lv.L，等待用户确认。
4. 确认后 store 提交 Lv.N，碎片进度归零；模型外观不跳变。

目标级强化由共享规则产生：

- 主体高度和标志部件随目标等级小幅增加。
- accent 部件数量或尺寸逐级增加。
- 位置保持稳定，避免升级时整栋模型横跳。
- 第 10 级强化保持在原 footprint 和命中盒内。

## 动画

新增 `AnimatedBuildingFragment`：

- 仅刚完成的 fragment 播放动画，其他 fragment 保持稳定。
- 时长 400ms。
- `scale` 从 0.78 到 1。
- Y 偏移从 -0.35 到目标位置。
- emissive 从亮绿色衰减到正常材质。
- 使用 `useFrame` 更新 ref，不把每帧状态写回 Zustand/React。
- 组件 key 使用稳定 `fragment.id`，避免整个建筑重播。
- `prefers-reduced-motion: reduce` 时立即落位。

面板使用 CSS 扫光：

- 每次完成碎片时，当前设施卡播放约 300ms 绿色斜向扫光。
- 进度条平滑增长。
- 最新完成的碎片格短暂放大。

## UI

解锁建筑的 `BuildingPanel` 改为 Setup 工作台：

1. 标题：建筑名、`Lv.L / 10`。
2. 总进度：`升级至 Lv.N`、`k / N 个子建筑`、可访问的 `role="progressbar"`。
3. 当前设施卡：名称、说明、序号。
4. 碎片网格：N 个格子，区分待升级、当前、已完成。
5. 主按钮：
   - 未满：`升级子建筑 k/N`。
   - 准备完成：`完成 Lv.N 升级`。
   - 满级：`已满级 · 10 个子建筑`，禁用。
6. 确认卡：展示 `Lv.L → Lv.N` 和新增/强化的 N 个子建筑，用户点击后提交主等级。

锁定建筑面板保持现有帮派等级要求，不暴露升级按钮。

桌面面板允许纵向滚动；小屏继续使用底部抽屉，碎片格使用自适应网格。

## 持久化

城市进度使用 Zustand `persist`：

- storage key：`dobe-city-progression-v1`
- version：1
- 只持久化 `buildingProgress`。
- 不持久化 `selectedBuildingId`、动画 ID 或确认卡 UI 状态。
- 使用与帮派存档相同的 sticky memory fallback。

共享存储实现移动到 `src/store/safeStorage.ts`，`useGangStore` 继续重导出 `createSafeStorage`，保持现有测试和 API 兼容。

迁移与归一化：

- 旧数字等级 `1 | 2 | 3` 转为 `{ level, completedFragments: 0 }`。
- 缺失建筑补 Lv.1。
- 等级 clamp 到 1–10 并取整。
- 碎片 clamp 到 0–targetLevel 并取整。
- Lv.10 强制 `completedFragments = 0`。
- 非对象、NaN、Infinity 和未知字段安全忽略。

## 测试

### 纯逻辑

- `BUILDING_LEVELS` 完整为 1–10。
- 每个目标等级需要与等级相同的碎片数。
- 每次只完成一个碎片。
- 未完成全部碎片不能确认。
- 准备确认后不能继续增加。
- Lv.10 封顶。
- 非法输入归一化。

### Store

- 六座建筑默认 Lv.1 / 0 碎片。
- 只修改目标建筑。
- 未知 ID 保持 state 引用。
- reset 创建新对象。
- persist 只保存进度。
- 重载恢复半完成升级。
- 旧数字结构和损坏结构迁移。
- localStorage 失败时切换内存存储。

### 蓝图与 3D

- 六种 kind 都有 10 个唯一 fragment。
- Lv.N 恰好 N 个 fragment。
- 部分升级按 completed 数量选择目标形态。
- footprint、AABB 和最高点不变量。
- 仅最新 fragment 标记动画。
- 锁定建筑仍渲染 `LockedBuildingPlot`。

### UI

- 显示 Lv.1 / 10 和 0 / 2。
- 两次点击后进入确认态，但未直接升到 Lv.2。
- 确认后升到 Lv.2，并显示 0 / 3。
- Lv.9 需要 10 次碎片点击。
- Lv.10 显示满级并禁用。
- 锁定建筑无碎片按钮。
- 面板事件不传递给场景。

### 浏览器

- 默认修车厂显示一个完整子建筑。
- 连续完成 Lv.2 的两个碎片，逐次截图显示 3D 变化。
- 确认后等级为 2。
- 刷新恢复等级和碎片进度。
- 使用测试入口或存档注入验证 Lv.10 有 10 个子建筑。
- 桌面与移动视口面板不溢出。

## 发布

1. 先提交当前尚未发布的城市布局与拖动改动。
2. 设计、纯规则、状态、3D、UI/样式、文档分别形成小提交。
3. 每个提交避免加入拆帧产生的临时大文件；只保留压缩总览和分析文档。
4. 推送 `main`。
5. 使用生产 base `/DobeDemo/` 构建。
6. 更新独立 `gh-pages` 分支根目录。
7. 验证公开首页、JS、CSS 均为 HTTP 200，并在公开页面完成一次碎片升级冒烟测试。

## 非目标

- 不增加货币消耗、材料库存、付费加速。
- 不增加真实时间施工队列。
- 不改变帮派树等级、职位和建筑解锁顺序。
- 不重新调整已通过严格碰撞矩阵的城市坐标。
- 不引入外部 3D 模型资源。
