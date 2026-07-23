# Layout Pan/Drag 报告：城市严格重排 + 输入手势最终验收（Task 5）

## 状态

完成。Task1–4 交付的城市 AABB 重排与输入手势（左键/右键/单指 PAN、误点击抑制）在本任务通过完整自动化、本地 HTTP 与 Chrome/CDP 真机手势验收。本任务未发现需要修复的真机缺陷，因此未改动任何源码，仅更新文档与生成浏览器证据。**未执行任何 commit/push，GitHub Pages 未更新。**

审查跟进（2 Important + 2 Minor）已处理：
- 自动化原始 stdout/stderr 与 exit code 持久化到 `.superpowers/sdd/layout-task-5-verification.log`。
- 提供可重复的 `.superpowers/sdd/layout-task-5-cdp.mjs` 与结果 `.superpowers/sdd/layout-task-5-browser-results.json`（含 HTTP、viewport/window、三种手势像素计数、误点击抑制、端口释放、截图文件名）。
- 变更文件清单仅保留本 epic 真实修改的源码（移除未内容修改的 `LockedBuildingPlot`/`CityEnvironment`/`CityGround`/`BuildingModel`/`BuildingVisual`）。
- 截图口径统一为“1440×900 窗口、1424×805 视口”。

## 根因（本 epic 要解决的问题）

- 旧布局中建筑/地块与十字道路、河流、树木存在压盖与误重叠，视觉“压房”。
- 镜头仅默认拖拽平移，缺少显式的左键/右键/单指手势映射；且拖动结束后的 click 会误触发建筑选中面板。

## 变更文件（Task1–4 累计，Task5 未改源码）

新增：

- `src/game/placementGeometry.ts`(+ test)：共享 AABB 几何工具（`getPlacementAabb`/`aabbsOverlapWithClearance`/`aabbContains`/`isAabbInsideBounds`，含旋转投影）。
- `src/scene/city/pointerDragTracker.ts`(+ test)：指针拖动跟踪，阈值 `POINTER_DRAG_THRESHOLD_PX=6`。
- `src/scene/city/pointerDragClick.ts`(+ test)：拖动后 click 消费与原生事件认领。
- `src/scene/city/CityPointerGestures.tsx`(+ test)：画布指针事件接线与光标同步。
- `src/scene/city/cityCursorController.ts`(+ test)：光标归属（hover/dragging）。
- `src/scene/city/{CityCameraControls,CityScene,InteractiveBuilding}.test.tsx`、`dragClickSuppression.test.tsx`。

修改：

- `src/game/cityLayout.ts`：六座建筑坐标、地块/道路/河流/树/车辆/环境楼重排；`LOT_ROAD_CLEARANCE=0.35`、`LOT_CLEARANCE=0.25`、`BUILDING_STATIC_CLEARANCE=0.2`。
- `src/game/cityLayout.test.ts`：AABB 碰撞矩阵校验（建筑↔道路/河流/树/车辆、地块↔地块/道路/河流/环境楼、环境楼零正重叠、边界内、建筑同心含于地块）。
- `src/scene/city/cameraConstraints.ts`：显式 `MOUSE.PAN`(左/右)、`MOUSE.DOLLY`(中)、`TOUCH.PAN`(单指)、`TOUCH.DOLLY_PAN`(双指)、禁旋转、pan 边界钳制。
- `src/scene/city/cameraConstraints.test.ts`：鼠标三键/单指/双指映射与 `enableRotate=false`、pan clamp 定向测试。
- `src/scene/city/CityCameraControls.tsx`：使用 `cameraConstraints` 的显式手势映射与 pan 边界钳制。
- `src/scene/city/CityScene.tsx`：挂载 `CityPointerGestures`，背景 click 走 `consumePointerDrag`/`isPointerEventHandled`。
- `src/scene/city/InteractiveBuilding.tsx`：click 前 `markPointerEventHandled` 并 `consumePointerDrag`，拖动后不误选。
- `src/App.css`：Canvas `cursor: grab`，拖动中切换 `grabbing`。

（`LockedBuildingPlot`、`CityEnvironment`、`CityGround`、`BuildingModel`、`BuildingVisual` 在本 epic 未发生内容修改，故不列入。）

## RED / GREEN

- Task2 RED：旧布局在新增“建筑/地块↔道路 ≥0.35 间距”与“环境楼零正重叠”校验下报告道路冲突，确认失败；GREEN 后 25 项 cityLayout 测试全绿。
- Task4 RED：新增 `dragClickSuppression` 用例在无拖动跟踪时“拖动后仍弹面板”失败；GREEN 后拖动 >6px 的 click 被消费，指针捕获丢失序列（pointerup→lostpointercapture→click）也正确处理。
- Task5：全量回归通过，无新 RED（未发现真机缺陷）。

## 最终坐标与安全间距

六座交互建筑中心（x,z）：

| 建筑 | 坐标 | 解锁等级 |
|---|---|---:|
| repair-shop 修车厂 | (-8, 4) | 1 |
| recycling-yard 废车回收厂 | (-6, -4) | 8 |
| commercial-street 商业街 | (6.8, 6) | 16 |
| metalworking-plant 金属加工厂 | (-6, -10.5) | 24 |
| gas-station 加油站 | (-12, 10.5) | 32 |
| clubhouse Clubhouse | (7, -7) | 40 |

道路：横主路 36×1.5、竖主路 1.5×28、支路 (-15,-3) 1.5×6、支路 (14,3) 1.5×6，十字交叉且两支路各与主路相接。

安全间距：建筑/地块↔道路、建筑↔河流、地块↔河流/环境楼 = 0.35；地块↔地块 = 0.25；建筑↔树/车辆 = 0.20；环境楼↔道路/河流/建筑/环境楼 = 0（禁止正重叠）。渲染缩放 `BUILDING_RENDER_SCALE=0.4`，城市边界 x∈[-18,18]、z∈[-14,14]。

## 自动化（原始日志见 `.superpowers/sdd/layout-task-5-verification.log`）

日志逐条持久化每个命令的原始 stdout/stderr 与 `exit_code`。汇总：

```
npm.cmd run format:check  → All matched files use Prettier code style! (exit 0)
npm.cmd run typecheck     → tsc -b 无错误 (exit 0)
npm.cmd run lint          → eslint . 无错误/警告 (exit 0)
npm.cmd test              → Test Files 26 passed (26) | Tests 278 passed (278) (exit 0)
npm.cmd run build         → tsc -b && vite build 成功；596 modules；dist/assets/index-*.js 1,121.67 kB (gzip 309.19 kB) (exit 0)
```

关注：构建报告 chunk >500 kB 警告（单一 JS chunk 约 1.12 MB），非失败，符合 brief 记录要求。

## HTTP / CDP 可复核证据

- 可重复脚本：`.superpowers/sdd/layout-task-5-cdp.mjs`（`node .superpowers/sdd/layout-task-5-cdp.mjs`）。结果快照：`.superpowers/sdd/layout-task-5-browser-results.json`。
- **端口安全模型**：启动前用 TCP 连接探测 `9224`(CDP) 与 `5177`(dev)，两者必须均空闲；任一被占用立即抛 `PREFLIGHT_ABORT` 并 `exit 1`，**绝不连接或终止任何既有进程**。仅关闭脚本自己启动的 dev + Chrome 进程树。临时 profile 由 `os.tmpdir()` 生成（无硬编码用户敏感路径），结束时删除。
- **结果断言**：`finally` 清理并确认端口释放后，对每一项结果逐条断言（见 `assertions[]`）；任一失败会打印具体项并 `process.exitCode=1`。断言函数另有内置纯数据负例自检（`assertionSelfTest`）：对 12 项全部注入坏数据应全部检出、对好数据应零失败，证明检查器有效且不触碰任何真实进程。

关键结果（`exit 0`，`ALL ASSERTIONS PASSED`）：

```
preflight: { cdpPortFree: true, devPortFree: true, ok: true }
http: { status: 200, ok: true, hasRoot: true, hasMainTsx: true }
window: { requested 1440×900, outer 1440×900 }  viewport: { 1424×805, dpr 1 }  hasCanvas: true
ports: { cdpPortReleased: true, devPortReleased: true }  tempProfileRemoved: true
assertions: 12/12 pass
assertionSelfTest: { ok: true, totalChecks: 12, detectedFailuresOnBadData: 12, failuresOnGoodData: 0 }
```

## 浏览器手势证据（Chrome headless=new + CDP，独立临时 profile）

- 视口：innerWidth×innerHeight = 1424×805，dpr=1（窗口以 --window-size=1440,900 启动）。
- 清除 `gang-progression-v1` 并刷新后为全新默认态（`storageClearedThenReseededFresh.showsLevel1=true`，仅重新累计数秒在线声望）。

真机手势（`Input.dispatchMouseEvent` / `Input.dispatchTouchEvent`，down→move(>6px, 10 步)→up），前后截图解码为 RGBA 逐像素比对（容差 12）：

| 手势 | 变化像素 | 占比 | 阈值 |
|---|---:|---:|---:|
| 左键 PAN | 305,006 / 1,146,320 | 26.61% | ≥1% |
| 右键 PAN | 337,569 / 1,146,320 | 29.45% | ≥1% |
| 单指 PAN（touch）| 314,922 / 1,146,320 | 27.47% | ≥1% |

（像素占比逐次运行略有浮动，均远超 ≥1% 阈值；以 `layout-task-5-browser-results.json` 为准。）

误点击抑制：

- 在建筑区域坐标普通 click（无位移）→ `.building-panel` 出现（panelAfterClick=true），随后关闭。
- 同一坐标拖动 >6px 后松开 → `.building-panel` 未出现（panelAfterDrag=false）。

## 截图

- `.superpowers/sdd/layout-pan-drag-screenshot.png`：主验收截图（1424×805 默认态）。人工读图确认：六座地块/建筑均在道路外；中央十字主路与两条支路连续；河流（右侧青色）、树、车辆、环境楼无明显压房。
- `.superpowers/sdd/layout-leftpan-{before,after}.png`、`layout-rightpan-{before,after}.png`、`layout-touchpan-{before,after}.png`：三种拖动前后对照像素证据。

## Final Verification 状态

实施计划 `docs/superpowers/plans/2026-07-23-city-layout-and-pan-drag.md` 中 Task1–Task5 及 Final Verification 已全部勾选 `[x]`。最终整体审查结论为 Ready，无 Critical 或 Important finding。

## 交付边界

- 未 commit / 未 push；GitHub Pages（`gh-pages`）尚未更新，公开地址仍为上一版本。
- headless 环境成功支持真实鼠标与触摸事件，无需降级；所有硬验收（左键拖动 + 截图）均已满足。
