# 渐进式建筑升级流程 — 验收与发布报告

日期：2026-07-24
分支基线：`e97d593`（progressive 计划起点），实现完成于 `788ae75`（Task 1–5 已审查通过）。

本报告记录 Task 6 的**本地部分**：fresh 工程门禁、文档更新、安全可重复 Chrome CDP 全流程与本地缺陷修复。push `main`、`gh-pages` 发布、Pages `built` 等待与公开复验（计划 Step 7–12）尚未执行，由父代理负责，本报告不作任何 push/Pages 完成声明。

## 1. 本地缺陷与 TDD 修复

**缺陷（Critical，本地新发现）**：空 `localStorage` 首次 rehydrate 时，Zustand persist 会以 `merge(undefined, currentState)` 调用我们的 `merge`；旧实现无条件执行 `normalizeCityDurableState(undefined, …)`，把钱包规范化为全零，从而把新访客应有的初始 `钱 10000` 清零（表现为清空存档刷新后钱包 `{0,0,0}`）。

**TDD 过程**：

1. 在 `src/store/useCityStore.test.ts` 新增失败用例「keeps the initial 10000 wallet when hydrating with empty storage」：清空 `localStorage` → `persist.rehydrate()` → 断言 `resources === {money:10000,oil:0,materials:0}`、`repair-shop` 为 `{level:1, childLevels:[0,0,0,0,0]}`、`activeProducerIds === ['repair-shop']`。
   - RED：`AssertionError: expected {money:0,…} to deeply equal {money:10000,…}`（1 failed | 16 passed）。
2. 修复 `useCityStore.ts` 的 `merge`：`persistedState == null` 时直接返回 `currentState`，仅对真实持久化载荷执行规范化。
3. GREEN：`useCityStore.test.ts` 17/17 通过。

该修复不掩盖任何失败；除此之外本地未发现其他需修复缺陷。

## 2. Fresh 工程门禁（修复后）

| 命令 | 结果 |
|---|---|
| `npm.cmd run format:check` | 退出 0（All matched files use Prettier code style!） |
| `npm.cmd run typecheck` | 退出 0（`tsc -b`，无错误） |
| `npm.cmd run lint` | 退出 0（`eslint .`，无错误） |
| `npm.cmd test` | 退出 0，**38 个测试文件、479 项测试全部通过** |
| `npm.cmd run build` | 退出 0；产物 `dist/index.html` 0.41 kB、`dist/assets/index-WW1HS-D7.css` 17.82 kB、`dist/assets/index-BYWUWufE.js` 1,165.54 kB |

`dist/index.html` 的 JS/CSS 引用均以 `/DobeDemo/` 开头：`/DobeDemo/assets/index-BYWUWufE.js`、`/DobeDemo/assets/index-WW1HS-D7.css`。

## 3. 安全可重复 CDP 脚本

`.superpowers/sdd/progressive-building-upgrade-flow-cdp.mjs`，安全模型：

- 动态选择空闲 dev/CDP 端口（本次 dev `5312`、CDP `9361`），跳过被占用的首选端口，绝不连接/终止预检发现的监听者（如用户现有 5176/5177 dev server）。
- Vite 以 `--strictPort` 启动。
- 仅追踪并终止本脚本自建的子进程 PID（本次 `vite`、`chrome` 两个 owned PID），遇到非自建 PID 抛 `SAFETY_ABORT`。
- Chrome 独立 profile 通过 `fs.mkdtempSync(os.tmpdir()/'dobe-progressive-upgrade-cdp-')` 创建，删除前校验前缀。
- 结果 JSON 仅记录 basename、仓库相对路径与数值；错误只记录白名单化的 `name`/`code`，原始堆栈仅写 stderr。
- 纯数据 self-test（好数据全通过、空数据全不通过）+ Windows/Unix 路径脱敏 self-test。
- 任一断言失败、运行错误、清理失败、owned 端口占用不符或截图缺失都置非零退出码；`finally` 中清理进程/端口/临时 profile。

## 4. 本地 CDP 全流程结果

命令：`node .superpowers/sdd/progressive-building-upgrade-flow-cdp.mjs`

结果：退出码 0，`ASSERTION SELF-TEST: PASS (43 pure-data checks)`，`ALL ASSERTIONS PASSED`，**运行期断言 43/43 通过、0 失败**。结果 JSON 由脚本实际运行值生成：`progressive-building-upgrade-flow-results.json`（19,945 bytes）。

覆盖的编号断言（全部 PASS，关键实测值）：

1. fresh v3 存档 `{money:10000,oil:0,materials:0}`、六座主建筑 Lv.1、修车厂 `childLevels [0,0,0,0,0]`；面板仅首槽可见（childCount 1、`Lv.0 / Lv.1`）；HUD `+1 声望/10秒`。
2. 公用按钮把首槽升到 Lv.1、进度 `0% → 25%`；目标 3D ROI 变化 1071 px，控制区变化 0%。
3. 手选第二槽后经真实资源 tick（`99995 → 99996`）保持选中；追平后选择循环回槽 0。
4. 100% 时进度/公用按钮整块被 `升级主建筑至 Lv.3` 替换。
5. 点主按钮进入确认页且钱包/等级不变；成本 `钱 60 / 油 0 / 物资 0`、战力 `当前 130 / 本次 +35 / 升级后 165`；焦点移到确认页标题。
6. `返回` 回详情且无状态变化。
7. `确认升级` 只扣 60 一次、修车厂 → Lv.3、新 `Lv.0 / Lv.3` 槽出现并自动选中（index 2）。
8. 资源不足显示 `资源不足，还需 钱 60` 且确认按钮禁用。
9. 阻止原因优先级与文案：`building-locked`（尚未解锁、无升级控件）、`已达到最高等级 Lv.10`、子建筑未追平（进度 25%、无主按钮）、`需要先将修车厂提升至 Lv.2`（优先于资源不足）、`需要先将帮派树提升至 Lv.40 解锁 Clubhouse`、`需要先将 Clubhouse 提升至 Lv.6`。
10. 修车厂 Lv.5→6 由 Clubhouse 放行，成功后仍为 5 槽并选中 `Lv.5 / Lv.6` 首槽。
11. Clubhouse 在修车厂仍 Lv.1 时升到 Lv.2（不受修车厂门槛）。
12. `解锁帮派树`：声望 1470 / Lv.50、生产者同步为四个 Lv.50 生产者、moneyJump 0（无历史追溯）、二次点击幂等（仍 1470）。
13. `钱/油/物资各 +10000` 点两次：油/物资各累计 +20000、钱 ≥ +20000、面板保持打开、`钱、油、物资各增加 10000`。
14. 二次确认重置恢复 `10000/0/0`、全 Lv.1、修车厂 `[0,0,0,0,0]`、声望 0、生产者仅 `repair-shop`、两时钟相等、面板与设置均关闭。
15. 代表性 v2 存档一次退款：钱 `100 → 140`、修车厂 `[2,1,0,0,0]`、商业街 `[3,2,1,0,0,0,0,0,0,0]`、版本 3；再次刷新仍版本 3、钱仍 140（不重复退款）。
16. 桌面 1440×900 与 390×844：详情/确认/移动面板均在视口内、无横向溢出、可滚动、44px 控件可触达。

进程/清理断言：仅 owned PID 被终止、`unknownProcessesTerminated=false`、dev 端口与 CDP 端口均已释放、临时 profile 已删除。

无重试：本次 CDP 一次通过；此前一次运行在修复 `merge` 前于断言 1 失败（钱包 0），修复后重跑全绿。

## 5. 生成的截图证据（本地，按计划保持 gitignore）

`.superpowers/sdd/` 下 10 张非空 PNG（`.superpowers/sdd/.gitignore` 为 `*`，图片不进入提交）：

| 文件 | 字节 |
|---|---|
| progressive-initial.png | 158,920 |
| progressive-slot-before.png | 164,891 |
| progressive-slot-after.png | 167,918 |
| progressive-confirm.png | 158,102 |
| progressive-new-slot.png | 169,827 |
| progressive-gate.png | 149,300 |
| progressive-debug.png | 120,937 |
| progressive-reset.png | 130,155 |
| progressive-migration.png | 131,226 |
| progressive-mobile.png | 97,008 |

## 6. 文档更新

- `README.md`：改写「渐进式子建筑升级」「资源经济」章节与操作说明——所有建筑 max10、修车厂 5 槽/其余 10 槽逐槽解锁、未解锁槽完全隐藏、单选项 + 公用升级按钮 + 进度条 + 独立确认页、修车厂 Lv.2–5 无外部门槛 / Lv.6–10 与其余四类目标 Lv.2–5 受修车厂门槛 / 全体 Lv.6–10 受 Clubhouse 门槛、阻止原因优先级、初始/重置 10000、persist 版本 3 与 v2→v3 一次性退款、仅展示战力、两个调试动作与二次确认重置；测试基线更新为 38 文件/479 项；验收脚本指向本脚本。
- `session/requirements/gang-tree-idle-unlocks.md`：更新升级闭环与交付边界描述为渐进式规则、版本 3、退款、调试动作、10000。
- `session/requirements/city-building-upgrade-demo.md`：新增「后续演进（现行规则）」小节并标注最初「满 3 级/无经济/无持久化/未初始化 Git」条目已被取代。
- `session/session.md`：更新当前目标；追加两条 2026-07-24 总账（渐进式升级实现 Task 1–5、渐进式升级本地验收 Task 6 本地）。
- `docs/superpowers/plans/2026-07-24-progressive-building-upgrade-flow.md`：勾选 Task 1–5 全部步骤与 Task 6 Step 1–6；Step 7–12（终审、push、发布、Pages built、公开复验、最终证据）保持未勾。

## 7. 待父代理执行（未完成，未声明完成）

- 计划 Step 7 全分支终审并修复所有 Critical/Important。
- 计划 Step 8 普通 push `main`（禁止 force）。
- 计划 Step 9 用 fresh `dist` 经独立临时 index 发布 `gh-pages`。
- 计划 Step 10 等待精确 `gh-pages` 提交 Pages 状态 `built`。
- 计划 Step 11 公开 HTTP + `progressive-building-upgrade-flow-public-cdp.mjs` 复验。
- 计划 Step 12 记录最终证据并再次普通 push。
