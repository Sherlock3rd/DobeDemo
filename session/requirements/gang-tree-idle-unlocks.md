# 帮派树挂机与建筑解锁系统

## 当前状态

已完成

## 目标

玩家通过在线与离线挂机获得帮派声望，在 1–50 级帮派树中提升职位，并按指定顺序解锁城市建筑。新玩家初始只拥有修车厂。

## 等级与职位

| 等级区间 | 职位 |
|---|---|
| 1–7 | Prospect（见习） |
| 8–15 | Full Patch（正式成员） |
| 16–23 | Wrench（技术骨干） |
| 24–31 | Bar Liaison（酒吧联络人） |
| 32–39 | Road Captain（路线队长） |
| 40–49 | V. PRESIDENT（Vice President，副主席） |
| 50 | PRESIDENT（主席） |

## 建筑解锁

| 所需等级 | 职位 | 建筑 |
|---:|---|---|
| 1 | Prospect | 修车厂 |
| 8 | Full Patch | 废车回收厂 |
| 16 | Wrench | 商业街 |
| 24 | Bar Liaison | 金属加工厂 |
| 32 | Road Captain | 加油站 |
| 40 | V. PRESIDENT | Clubhouse |
| 50 | PRESIDENT | 满级终点，无新增建筑 |

原物流中心已替换为金属加工厂；原商业区已改为商业街；原废车回收站已改为废车回收厂。

## 挂机规则

- 每级需要 30 声望。
- 在线每秒获得 5 声望。
- 0 声望为 1 级，1470 声望达到 50 级并封顶。
- 本地 `localStorage` 存储键为 `gang-progression-v1`。
- 页面加载、每秒 tick、标签页重新可见时结算。
- 离线收益最多累计 8 小时。
- 无效时间、系统时间倒退不产生收益。
- localStorage 不可用时回退为当前会话内存状态。

## 交互与视觉

- HUD 显示等级、职位、本级声望、挂机速率和帮派树入口。
- 帮派树 modal 展示完整 50 个等级节点、7 个职位里程碑和 6 个建筑解锁里程碑。
- 节点区分已完成、当前和未解锁状态；支持关闭按钮与 Escape。
- 未解锁建筑显示深色施工地基、警示条和程序化锁形标识。
- 锁定地块可点击查看所需等级和职位，但不显示升级按钮。
- 达到阈值后地块立即切换为对应建筑 Lv.1 模型，并开放 1–10 级碎片升级闭环（详见 `docs/superpowers/specs/2026-07-23-fragmented-building-upgrades-design.md`）。
- 桌面和小屏幕均提供响应式布局；HUD 仅按钮接收指针事件，其他区域不阻挡 3D 镜头操作。

## 验收条件

1. [x] 新玩家为 Lv.1 Prospect，只有修车厂完整显示。
2. [x] 1/8/16/24/32/40/50 对应七个指定职位。
3. [x] 建筑按修车厂→废车回收厂→商业街→金属加工厂→加油站→Clubhouse 解锁。
4. [x] 50 级 PRESIDENT 为满级终点，不新增第七座建筑。
5. [x] 声望按每秒 5 点自动获得，每 30 点提升一级，1470 封顶。
6. [x] 本地持久化、完整秒余量、离线 8 小时上限、系统时间异常和满级边界均有测试。
7. [x] 帮派树渲染恰好 50 个节点、7 个职位、6 个建筑里程碑。
8. [x] modal 关闭、Escape、事件不穿透和小屏全屏样式已实现。
9. [x] 锁定建筑面板显示解锁要求且绝不升级；解锁后恢复升级。
10. [x] 3D 场景使用真实帮派 store 在锁定地块与建筑模型间切换，并有组件级测试。
11. [x] 原物流中心已迁移为三级金属加工厂视觉，旧 ID 与旧 kind 在 `src/` 无残留。
12. [x] `npm.cmd run format:check`、`typecheck`、`lint`、`test`、`build` 全部退出码 0。
13. [x] 全量测试共 26 个文件、278 项，全部通过。
14. [x] `http://127.0.0.1:5176/` 返回 HTTP 200，HTML 含 `#root` 与 `/src/main.tsx`；验证后端口已释放。
15. [x] 已生成城市默认态和帮派树面板两张无头 Chrome 截图并人工检查。
16. [x] 已分段提交并推送到 `Sherlock3rd/DobeDemo`；`https://sherlock3rd.github.io/DobeDemo/` 及其 JS/CSS 资源返回 HTTP 200。

## 布局 AABB 间距矩阵验收

城市重排后，所有静态与交互对象均以轴对齐包围盒（AABB）参与碰撞校验（`src/game/placementGeometry.ts` + `src/game/cityLayout.test.ts`）。安全间距常量：

| 间距常量 | 值（世界单位） | 适用关系 |
|---|---:|---|
| `LOT_ROAD_CLEARANCE` | 0.35 | 交互建筑↔道路、地块↔道路、建筑↔河流、地块↔河流、地块↔环境楼 |
| `LOT_CLEARANCE` | 0.25 | 地块↔地块 |
| `BUILDING_STATIC_CLEARANCE` | 0.20 | 建筑↔树、建筑↔车辆 |
| 0（正重叠禁止） | 0 | 环境楼↔道路/河流/建筑/其它环境楼 |

验收条件：

17. [x] 六座交互建筑坐标固定为 `recycling-yard(-6,-4)`、`metalworking-plant(-6,-10.5)`、`clubhouse(7,-7)`、`repair-shop(-8,4)`、`gas-station(-12,10.5)`、`commercial-street(6.8,6)`，每座按 `BUILDING_RENDER_SCALE=0.4` 缩放后完整落在同心地块内且互不重叠。
18. [x] 全部交互建筑/地块与四段道路（横主路 36×1.5、竖主路 1.5×28、两条支路 1.5×6）保持 ≥0.35 间距；主路十字交叉、两条支路各自与主路相接。
19. [x] 河流、树、车辆、8 座环境楼均通过 AABB 校验：建筑↔河流/道路 ≥0.35、建筑↔树/车辆 ≥0.2、地块↔地块 ≥0.25、环境楼与其它对象零正重叠，且所有 AABB 均在 `CITY_BOUNDS`(x∈[-18,18], z∈[-14,14]) 内。

## 长按拖动与误点击抑制验收

输入手势通过显式映射（`cameraConstraints.ts`）与指针拖动跟踪（`pointerDragTracker.ts`，阈值 `POINTER_DRAG_THRESHOLD_PX=6`）实现：

- 左键 = PAN，右键 = PAN，中键 = DOLLY；单指 = PAN，双指 = DOLLY_PAN；禁用旋转。
- 指针在画布上移动超过 6px 即标记为拖动；随后的 `click` 被 `consumeDraggedClick` 消费，不会触发建筑选中。
- 触摸合成的 click 使用不同 pointerId，通过“当前手势内已完成拖动”回退逻辑消费。
- 失去指针捕获（Chrome 的 pointerup→lostpointercapture→click 序列）不会丢弃已完成的拖动标记。

验收条件：

20. [x] 左键、右键、单指拖动均可平移镜头（Chrome/CDP 真机手势前后画面像素差 26%–29%）。
21. [x] 建筑区域上普通 click（无位移）出现 `.building-panel`；从同一坐标拖动 >6px 后松开不出现 `.building-panel`。
22. [x] 输入手势、拖动跟踪、误点击抑制均有组件级/单元测试（`CityPointerGestures.test.tsx`、`CityCameraControls.test.tsx`、`dragClickSuppression.test.tsx` 等）。

## 视觉证据

- `.superpowers/sdd/gang-tree-demo-screenshot.png`：Lv.1 城市默认态；修车厂完整显示，其余五座为锁定地块。
- `.superpowers/sdd/gang-tree-panel-screenshot.png`：帮派树 modal；可见等级时间线、职位和建筑解锁 badge。
- `.superpowers/sdd/layout-pan-drag-screenshot.png`：重排后默认态（1440×900 窗口、1424×805 视口）；六座地块/建筑均在道路外、十字主路与两条支路连续、河流/树/车辆无压房。
- `.superpowers/sdd/layout-{left,right,touch}pan-{before,after}.png`：左键/右键/单指拖动前后画面变化的像素证据。

## 交付边界

- 不包含手动领取、付费加速、广告奖励、服务器校时、防作弊或云存档。
- 不包含帮派成员、任务、战斗或分支技能点。
- 建筑升级已由旧 1–3 级即时升级演进为 1–10 级碎片闭环：升到 Lv.N 需逐个完成 N 个子建筑再确认，仍无货币/材料/付费加速；碎片进度持久化于 `dobe-city-progression-v1`。
- Git 源代码位于 `main`，Pages 产物位于 `gh-pages`。
- 未配置或授权飞书 CLI。
