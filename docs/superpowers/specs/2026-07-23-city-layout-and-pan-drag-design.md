# 城市布局避让与长按拖动设计

## 目标

修复互动建筑及其地块侵入道路的问题，并让鼠标左键按住、鼠标右键按住和单指按住拖动都能平移城市。普通点击建筑仍打开建筑面板，拖动结束不得误触建筑。

## 根因

现有布局测试只验证：

- 六座互动建筑彼此不重叠。
- 环境仓库与道路、河流、互动建筑、车辆和树木不重叠。

测试没有验证互动建筑 footprint 或 `lotPlacements` 与道路的关系。当前回收厂、金属加工厂、修车厂和商业街的 AABB 均与道路存在正面积重叠。

现有 `OrbitControls` 虽然启用了平移，但仍使用默认输入映射：

- 鼠标左键：旋转。
- 单指触摸：旋转。

场景同时禁用了旋转，因此左键按住和单指拖动不会执行任何操作；只有右键或双指组合可能触发平移。

## 布局方案

保留城市的中央十字主路和固定正交镜头，将建筑、地块和支路重新分区摆放。优先移动建筑区与支路，不缩小建筑模型。

### 安全间距

- 建筑地块与道路：至少 `0.35` 世界单位。
- 建筑实际 footprint 与道路、河流：至少 `0.35`。
- 不同建筑地块之间：至少 `0.25`。
- 建筑地块与环境仓库：至少 `0.35`。
- 建筑实际 footprint 与树木、静态车辆：至少 `0.2`。
- 所有建筑地块、建筑 footprint 和环境仓库必须完整处于 `CITY_BOUNDS` 内。

边界相切不视为合格；必须满足规定的正间距。

### 布局原则

- 六座建筑继续保留当前解锁顺序、尺寸、模型比例和三级视觉。
- 地块中心与对应建筑中心一致，并完整包住渲染 footprint。
- 中央十字主路保持连通。
- 至少两条支路连接主路，但支路不得穿过建筑地块。
- 河流继续位于城市右侧区域。
- 环境仓库、树木和车辆可随建筑区调整做最小位置迁移。
- 车辆允许位于道路上；道路之间允许相交。

## 几何约束架构

新增纯几何模块，生产数据与测试共用同一套旋转 AABB 计算，避免测试复制公式：

```ts
export interface PlacementAabb {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export function getPlacementAabb(placement: CityPlacement): PlacementAabb
export function getInteractiveBuildingPlacement(
  building: InteractiveBuildingPlacement,
): CityPlacement
export function aabbsOverlapWithClearance(
  first: PlacementAabb,
  second: PlacementAabb,
  clearance: number,
): boolean
export function isAabbInsideBounds(
  aabb: PlacementAabb,
  bounds: typeof CITY_BOUNDS,
): boolean
```

`cityLayout.test.ts` 建立碰撞矩阵：

1. 建筑 footprint ↔ 道路、河流、树木、车辆。
2. 地块 ↔ 道路、河流、其他地块、环境仓库。
3. 环境仓库 ↔ 道路、河流、建筑、其他仓库。
4. 建筑、地块、环境仓库 ↔ 城市边界。
5. 建筑 footprint ↔ 对应地块包含关系。

测试失败信息必须列出双方名称、索引和实际间距，便于后续继续调整城市。

## 长按拖动交互

“长按拖动”定义为按下后保持并移动，不增加等待时间。

### 输入映射

- 鼠标左键：PAN。
- 鼠标中键：DOLLY。
- 鼠标右键：PAN。
- 单指触摸：PAN。
- 双指触摸：DOLLY_PAN。
- 滚轮：保留缩放。
- 旋转：继续禁用。

导出不可变输入配置，由 `CityCameraControls` 使用并由单元测试锁定。

### 点击与拖动冲突

新增指针拖动跟踪器：

- `pointerdown` 记录 pointer ID 和起点。
- 移动距离超过 `6 CSS px` 后标记为拖动。
- `pointerup` 后短暂保留该 pointer ID 的拖动结果，供随后产生的 click 消费。
- `InteractiveBuilding` 收到 click 时先检查该 pointer 是否刚完成拖动：
  - 是：停止事件但不选择建筑。
  - 否：执行原有选择逻辑。
- 多指触摸分别跟踪，`pointercancel` 必须清理。
- 组件卸载时移除所有 DOM listener 和 timer。

### 光标

- 可平移画布默认显示 `grab`。
- 拖动中显示 `grabbing`。
- 悬停可点击建筑时显示 `pointer`。
- 优先级：`grabbing` > `pointer` > `grab`。
- UI 按钮继续使用自身指针样式，不受画布光标状态影响。

## 测试

### 布局

- 先为当前布局增加“互动建筑/地块不得侵入道路”测试，确认至少四处 RED。
- 加入完整碰撞矩阵后重新排布，直到所有对象满足明确间距。
- 保留道路连通、河流区域、相机边界和六建筑完整性测试。

### 拖动

- 左键和右键映射 PAN，单指映射 PAN，双指映射 DOLLY_PAN。
- 5px 移动仍视为点击，超过 6px 视为拖动。
- 拖动后的 click 被消费一次，下一次普通 click 正常。
- pointer cancel、多个 pointer 和卸载清理。
- 普通建筑 click 继续选择，拖动结束 click 不选择。

### 验收

- 自动化格式、类型、Lint、全部测试和生产构建通过。
- 桌面截图确认六个建筑区不压道路。
- 浏览器实测左键拖动、右键拖动和单指拖动均平移。
- GitHub Pages 更新后公开地址返回 200，并加载新的资源 hash。

## 非目标

- 不允许玩家拖动或重新摆放建筑。
- 不开放镜头旋转。
- 不改变建筑解锁等级、挂机公式、建筑升级规则或城市尺寸。
- 不引入物理引擎或运行时自动布局算法。
