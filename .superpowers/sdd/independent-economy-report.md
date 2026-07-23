# 独立子建筑与三资源经济 — Task 6 验收报告

**日期：** 2026-07-23
**范围：** 文档、可重复安全 CDP 浏览器验收与本地发布证据。
**发布状态：** 未 commit、未 push、未更新 GitHub Pages；分段提交、全分支终审与 Pages 发布均等待父代理。

## 1. Fresh 工程门禁

在干净工作区依次运行，全部退出码 0：

| 命令                     | 结果                                                    |
| ------------------------ | ------------------------------------------------------- |
| `npm.cmd run format:check` | 通过（All matched files use Prettier code style）        |
| `npm.cmd run typecheck`  | 通过（`tsc -b --pretty false`，退出码 0）               |
| `npm.cmd run lint`       | 通过（`eslint .`，退出码 0）                            |
| `npm.cmd test`           | 通过：**37 个测试文件、419 项测试**（vitest run）        |
| `npm.cmd run build`      | 通过（`tsc -b && vite build`，退出码 0）                 |

构建资产（`vite v8.1.5`）：

| 资产                              | 大小        | gzip      |
| --------------------------------- | ----------- | --------- |
| `dist/index.html`                 | 0.41 kB     | 0.27 kB   |
| `dist/assets/index-BSltOOxX.css`  | 15.13 kB    | 3.32 kB   |
| `dist/assets/index-BJ6q-ZtE.js`   | 1,156.65 kB | 319.65 kB |

`dist/index.html` 的资源引用均以 `/DobeDemo/` 开头：

- `/DobeDemo/assets/index-BJ6q-ZtE.js`
- `/DobeDemo/assets/index-BSltOOxX.css`

> 构建的 “chunks larger than 500 kB” 只是提示（stderr），构建退出码为 0，非错误。

## 2. 安全 CDP 脚本

脚本：`.superpowers/sdd/independent-economy-cdp.mjs`
结果 JSON：`.superpowers/sdd/independent-economy-results.json`（由脚本实际生成，未手写）。

进程与端口安全模型：

- **动态空闲端口**：从首选 dev `5199` / CDP `9245` 起探测，跳过占用端口，绝不连接或终止占用端口的未知进程（首选端口本轮均空闲，实际使用 dev 5199 / CDP 9245）。
- **`--strictPort`**：Vite 以 strictPort 启动，端口被占则直接失败而非漂移。
- **仅终止自建 PID**：只记录并 `taskkill /T /F` 本脚本 spawn 的 vite/chrome 进程树；对未拥有的 PID 抛 `SAFETY_ABORT`。本轮 `unknownProcessesTerminated: false`，全部 killAttempts `owned: true`。
- **临时 profile**：Chrome 使用 `os.tmpdir()` 下 `dobe-independent-economy-cdp-*` 独立 profile，删除前校验前缀，删除后确认不存在。
- **路径脱敏**：结果 JSON 只记录 `chrome.exe`、`dobe-independent-economy-cdp-…` 等 basename，不含盘符/家目录/用户名/安装路径。
- **错误脱敏**：只记录白名单化的 error `name`/`code`，原始 stack 仅打印到 stderr。
- **坏数据自测**：`assertionSelfTest` 对完整 good 数据全过、对空对象 `{}` 全败（23 项纯数据检查），并含错误路径脱敏自检（Windows/Unix 私密路径不外泄）。
- **失败非零退出**：任一断言或运行错误使 `process.exitCode = 1`。

本轮结果：`ASSERTION SELF-TEST: PASS (23 pure-data checks)`，脚本退出码 **0**。

## 3. 浏览器流程 — 12 项断言（全部 PASS）

真实 Chrome（headless，1440×900）经 CDP 驱动。允许注入合法 v2 `localStorage` 并 reload 加速场景，但下列真实交互均实际发生：真实等待 10 秒钱产出、真实鼠标点击第 5 个修车厂子建筑、真实点击 Clubhouse/修车厂主建筑升级、真实测量移动视口。

| # | 断言 | 证据 |
| --- | --- | --- |
| 1 | fresh v2 存档：修车厂 Lv.1、5 子建筑全 0、资源全 0 | `city.version=2`，`repair-shop {level:1, childLevels:[0,0,0,0,0]}`，`resources {0,0,0}` |
| 1b | HUD 显示 `+1 声望/10秒` 与 `钱 +1/10秒` | HUD rate `+1 声望/10秒`，资源含 `钱 +1/10秒` |
| 2 | 10 秒后钱精确 +1 | `moneyBefore=0` → `moneyAfter=1`（9.999 秒无收益由纯单测覆盖） |
| 3 | 真实点击第 5 个修车厂子建筑（诊断工位），数组变 `[0,0,0,0,1]` 并扣 5 钱 | `childLevelsBefore=[0,0,0,0,0]`，`childLevelsAfter=[0,0,0,0,1]`，`moneySpent=5` |
| 4 | 第 5 槽 3D ROI 变化，其余子建筑数据不变 | ROI 变化 **650/125320 px**（阈值 40），其余 index 保持 0 |
| 5 | 五子建筑全 Lv.1 后 Clubhouse 未解锁精确提示 | `需要先将帮派树提升至 Lv.40 解锁 Clubhouse` |
| 6 | 注入帮派 Lv.40、Clubhouse Lv.1 后门槛提示 | `需要先将 Clubhouse 提升至 Lv.2` |
| 7 | 真实升级 Clubhouse 10 子建筑→Lv.2，再升修车厂→Lv.2 | Clubhouse `等级 1/10`→`等级 2/10`（存档 2）；修车厂 `等级 1/5`→`等级 2/5`（存档 2，childLevels `[1,1,1,1,1]`） |
| 8 | 刷新后钱包、active producers、主/子等级持久 | 刷新后 repair Lv.2 `[1,1,1,1,1]`、clubhouse Lv.2、producers `[repair-shop, commercial-street, metalworking-plant, gas-station]`、钱包 `99954`→`99954` |
| 9 | 激活商业街/加油站/金属加工厂后三资源按配置增长 | 一个 tick 后 `money=3, oil=1, materials=1`（钱=油×3、物资=油），HUD `钱 +3/10秒`、`油 +1/10秒`、`物资 +1/10秒` |
| 10 | 非 Clubhouse Lv.5、Clubhouse Lv.10 上限注入后按钮禁用 | 修车厂 `等级 5/5` 无主升级按钮、`已达到最高等级 Lv.5`；Clubhouse `等级 10/10` 无主升级按钮、`已达到最高等级 Lv.10` |
| 11 | 390×844 无横向溢出且可滚动 | `withinBounds=true`、`noHorizontalOverflow=true`、`scrollableOrFits=true` |
| 12 | dev/CDP 端口释放、临时 profile 删除、仅 owned PID 被 targeting | `devPortReleased/cdpPortReleased/tempProfileRemoved=true`，`unknownProcessesTerminated=false`，killAttempts 全 owned |

## 4. 截图（均由脚本生成、非空）

| 文件 | 内容 | 大小 |
| --- | --- | --- |
| `independent-economy-initial.png` | fresh v2：修车厂 Lv.1、5 子建筑全脚手架、三资源 HUD 归零 | 133 KB |
| `independent-economy-free-choice.png` | 真实点击后第 5 子建筑（诊断工位）Lv.1，其余为脚手架，三资源 HUD | 182 KB |
| `independent-economy-gate.png` | Clubhouse 未解锁门槛文本 | 182 KB |
| `independent-economy-resources.png` | Lv.40 下 `钱 +3/10秒`、`油 +1/10秒`、`物资 +1/10秒`，全城建筑解锁 | 148 KB |
| `independent-economy-mobile.png` | 390×844 建筑面板底部抽屉，无横向溢出 | 98 KB |

> 另有中间证据 `independent-economy-free-choice-before.png`（点击前脚手架态），用于 ROI 前后像素差比对。

## 5. 失败与重试记录

首次运行暴露两处真实缺陷并已修复（非脚本伪造）：

1. **子建筑/主建筑按钮点击落空**：建筑面板子建筑网格与主升级按钮在可滚动容器内，`getBoundingClientRect` 中心点可能位于视口外，CDP 鼠标点击落空导致升级不触发（断言 3/4 失败、断言 7 因主按钮未找到而中止）。修复：`clickSelector` 在点击前 `scrollIntoView({block:'center'})` 并重新测量坐标，确保真实点击命中。
2. **闭环阶段脆弱中止**：主升级按钮缺失时脚本直接抛错中止后续阶段。修复：闭环阶段改为先读取面板、记录诊断信息（`clubhouseBefore`/`repairLoopBefore`），仅在 `mainButtonPresent` 时真实点击。

修复后重跑：12 项断言 + 基础设施 + 自测全部 PASS，退出码 0。

## 6. 文档更新

- `README.md`：改写核心玩法为独立子建筑（修车厂 5/其余 10、Lv.0 自由升级）、三资源生产与 8 小时离线、每 10 秒 +1 声望、Clubhouse 上限/门槛、`economy.config.json` 配置 EXE 契约；测试基线更新为 37 文件/419 项；新增本验收脚本引用；删除旧固定顺序碎片与每秒 5 声望表述。
- `session/requirements/gang-tree-idle-unlocks.md`：删除“每秒 5 声望”“固定顺序碎片闭环”矛盾文本，改为每 10 秒 +1 与独立子建筑三资源闭环，注明配置 JSON 契约。
- `session/session.md`：更新当前目标，新增独立经济与 Task6 本地验收两条变更总账。
- `docs/superpowers/plans/2026-07-23-independent-subbuilding-economy.md`：勾选 Task 1–5 全部步骤与 Task 6 Step 1–4；Step 5（分段提交与终审）、Step 6（推送和 Pages）保持未勾，待父代理。

## 7. 待父代理发布步骤（本次未执行）

1. 按审查通过的逻辑分段提交到 `main`（config+纯规则 → v2 迁移+原子 Store → idle+HUD → 独立 3D → 自由选择面板 → 验收+文档）。
2. 运行全分支审查，修复所有 Critical/Important，再跑一次 fresh 全门禁。
3. 普通推送 `main`（禁止 force push）。
4. fresh `dist`（`/DobeDemo/` base）经独立临时 index 快进更新 `gh-pages`。
5. 等待最新 Pages build 的 commit 精确匹配且 `status=built`，校验公开 HTML 与当前 JS/CSS HTTP 200。
6. 真实 Chrome 加载公开 URL 截图（三资源 HUD + 修车厂五子建筑面板），更新发布报告与 session，再次普通推送 `main`。

## 8. 复现命令

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
node .superpowers/sdd/independent-economy-cdp.mjs
```

可选环境变量：`DEV_PORT`、`CDP_PORT`、`CHROME_PATH`（占用的首选端口会被自动跳过）。
