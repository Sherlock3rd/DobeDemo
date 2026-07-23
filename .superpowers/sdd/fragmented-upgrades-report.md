# Fragmented Building Upgrades — Task 6 集成、存档与浏览器验收报告

## 状态

Task 6「集成、存档和浏览器验收」已完成。fresh 全量工程门槛（format / typecheck / lint / test / build）
全绿，生产构建资源以 `/DobeDemo/` 为 base；新建可重复的安全模式 Chrome/CDP 验收脚本
覆盖了设计与计划要求的碎片升级全链路（Lv.1 → 逐碎片 → 确认 Lv.2 → 注入 Lv.10 满级）、
持久化刷新恢复、桌面/移动面板边界，并逐张人工检查了 3D 截图。**未 commit / push，Pages 未更新。**

## 一、fresh 工程门槛（原始 log）

原始输出持久化于 `.superpowers/sdd/fragmented-upgrades-verification.log`。

| 命令 | 结果 |
|---|---|
| `npm.cmd run format:check` | PASS（All matched files use Prettier code style） |
| `npm.cmd run typecheck`（`tsc -b --pretty false`） | PASS，退出码 0 |
| `npm.cmd run lint`（`eslint .`） | PASS，退出码 0 |
| `npm.cmd test`（`vitest run`） | PASS，**32 个文件 / 391 项** |
| `npm.cmd run build`（`tsc -b && vite build`） | PASS，产出 `dist/`（index.html 0.41 kB、CSS 12.65 kB、JS 1,143.18 kB；仅超大 chunk 提示，非错误） |

`dist/index.html` 资源引用：`/DobeDemo/assets/index-*.js`、`/DobeDemo/assets/index-*.css`，均以 `/DobeDemo/` 开头。

## 二、可重复验收脚本

`.superpowers/sdd/fragmented-upgrades-cdp.mjs`，运行：`node .superpowers/sdd/fragmented-upgrades-cdp.mjs`。

安全模式（沿用 `layout-task-5-cdp.mjs` 约束）：

- **端口 preflight**：dev 端口 5188 与 CDP 端口 9234 必须同时空闲；任一被占用则抛错、退出 1，
  **绝不连接或终止任何既有进程**。
- **只杀自有进程**：仅 `killTree` 本脚本 spawn 的 dev server 与 headless Chrome 进程树。
- **失败非零**：任何 run error / 断言失败 / 自检失败都 `process.exitCode = 1` 并打印失败项。
- **临时 profile 清理**：Chrome 用户目录在 `os.tmpdir()` 下 `mkdtemp` 创建，teardown 中 `rmSync` 删除；
  脚本不含任何用户敏感硬编码路径。
- **纯数据断言自检**：每次运行都用 good/bad 两组合成数据校验断言函数（bad 全部命中失败、good 全部通过），
  证明校验器本身有效，且不触碰任何进程。
- 端口/URL/Chrome 路径均可用环境变量覆盖（`DEV_PORT` / `DEV_URL` / `CDP_PORT` / `CHROME_PATH`）。

结果与截图：`.superpowers/sdd/fragmented-upgrades-results.json`、`fragmented-upgrades-{lv1,partial,lv10,mobile}.png`
（另有 `canvas-before` 中间帧用于像素差）。

## 三、验收结果（全部通过，30/30 断言 + 自检 ok）

真机视口 1424×805（`--window-size=1440,900` headless，`--hide-scrollbars`，dpr 1）。

1. **preflight**：5188 / 9234 空闲，ok。
2. **HTTP**：`http://127.0.0.1:5188/` status 200，HTML 含 `#root` 与 `/src/main.tsx`。
3. **dist base**：`dist/index.html` 全部 `/assets/` 引用以 `/DobeDemo/` 开头。
4. **清空 city + gang storage**：`localStorage.removeItem` 两键 + `clear()` 后 city 存档为 `null`。
5. **点击修车厂（Lv.1）**：真机 CDP 逐格点击 3D 场景，命中未锁定的「修车厂」面板：
   - 标题「修车厂」、`等级 1 / 10`、`0 / 2 个子建筑`。
   - 具名 progressbar `role="progressbar"` + `aria-label="修车厂升级进度"`、`aria-valuemax=2`。
   - 碎片格 `cellCount=2`。当前设施卡「基础维修棚」。截图 `fragmented-upgrades-lv1.png`。
6. **第一个碎片**：点击「升级子建筑 1/2」后 `1 / 2 个子建筑`（`aria-valuenow=1`）；
   在**修车厂屏幕坐标周围的动态 ROI**（由 `findRepairShop` 返回坐标推出：中心 (455,280)，
   向左/上更大以容纳等距视角的上左生长，裁剪到视口后 `roiClipped={x:255,y:60,w:350,h:350}`）内做像素差，
   HUD/面板矩形额外遮罩以防裁进 ROI。结果：`consideredPixels=100966`、`changedPixels=299`、
   `changedPct=0.296%`（≥阈值 40 px），证明变化定域在建筑本体、与环境其它区域无关。
   截图 `fragmented-upgrades-partial.png`（中间帧 `fragmented-upgrades-canvas-before.png`）。
7. **刷新持久**：`Page.reload` 后重新点开修车厂，仍为 `1 / 2 个子建筑`、`等级 1 / 10`
   （`dobe-city-progression-v1` 持久化生效；`selectedBuildingId` 不持久，符合设计）。
8. **第二个碎片 → 就绪**：点击「升级子建筑 2/2」后进入确认态（`.building-panel__confirm` 出现），
   **主等级仍为 `等级 1 / 10`**、`2 / 2 个子建筑`。
9. **确认升级**：点击「完成 Lv.2 升级」后 `等级 2 / 10`、`0 / 3 个子建筑`、碎片格数变为 3。
10. **注入合法 Lv.10 存档**：写入 `{state:{buildingProgress:{...repair-shop:{level:10,completedFragments:0}...}},version:1}`
    后刷新，重新点开修车厂：`等级 10 / 10`、`cellCount=10`、升级按钮 `disabled`、
    文案「已满级 · 10 个子建筑」。截图 `fragmented-upgrades-lv10.png`。
11. **桌面 1440×900 面板边界**：面板矩形在视口内（`withinBounds`），无横向溢出
    （`scrollWidth<=clientWidth` 且 `documentElement.scrollWidth<=innerWidth`），`overflow-y:auto` 可纵向滚动。
12. **移动 390×844**：以 `Emulation.setDeviceMetricsOverride` 将已打开的 Lv.10 面板重排为底部抽屉
    （无 reload、同一面板，直接测响应式边界）：在视口内、无横向溢出、可滚动。
    截图 `fragmented-upgrades-mobile.png`（10 个碎片格自适应换行为 8+2 两行）。
13. **teardown**：仅终止自建进程树，5188 / 9234 均释放，临时 profile 已删除。

## 四、人工截图检查（新建筑不压道路）

- `lv1`：修车厂地块为浅色施工基面，仅「基础维修棚」低矮体量，四周十字主路与支路清晰。
- `partial`：完成第一个碎片后碎片格 1 变绿、当前卡切到「零件货架」，3D 侧有细微增建（像素差 299）。
- `lv10`：修车厂地块已建成完整十子建筑工业综合体（多彩金属结构），**完全落在原 footprint 地块内，
  未越界压到任何一段道路**；周边锁定地块与道路网络保持原状。
- `mobile`：底部抽屉面板宽度贴合 390 视口，无横向溢出；HUD 顶部、面板底部各自独立。

## 五、边界与关注事项

- 单个碎片在 1440 视口下的 3D 变化较小（ROI 内 299 px / 0.296%），因为修车厂体量小、屏占比低；
  累计到 Lv.10 时变化显著（见 lv10 截图）。像素差已限制在**基于建筑坐标的动态 ROI**（350×350，
  裁剪到视口）内计算，不再统计环境其它区域；HUD/面板仅作遮罩、非主证明。脚本阈值 40 px 既能证明
  「有变化」又避免抗锯齿噪声误判；ROI 半径由 `ROI_LEFT/RIGHT/UP/DOWN` 常量控制，阈值为 `CANVAS_MIN_CHANGED`。
- 移动视口验收改为「对已打开面板做 metrics 覆盖重排」，而非在 390×844 上重新逐格点击 3D 选中建筑——
  小视口 + 正交相机重投影后建筑屏幕坐标不确定，点击扫描不稳定；重排方案更稳、且直接测的就是同一面板的
  响应式边界。桌面选中仍是真机 CDP 点击 3D 建筑。
- Task 7（分段 Git 提交与 GitHub Pages 发布）仍待父代理执行；本任务**未 commit / push、未更新 Pages**。
- 参考视频 0.5s 时间轴分析见 `.superpowers/sdd/2026-07-23-levelup-video-0.5s-analysis.md`。

## 六、复现实令

```bash
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
node .superpowers/sdd/fragmented-upgrades-cdp.mjs   # 退出码 0 = 全部断言通过
```
