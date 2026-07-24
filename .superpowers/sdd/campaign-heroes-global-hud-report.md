# 战役 / 英雄 / GlobalHud — 本地 CDP 验收报告

日期：2026-07-24  
功能 HEAD：`600f2aa`  
前置状态：产品测试 63 文件 / 599 项全绿，Task 6 终审 Approved。

本报告只记录 Task 7 的本地门禁、安全 CDP、真实运行 JSON 与文档证据。未执行 commit、push、gh-pages 发布或公开站点复验，也不作相关完成声明。

## 1. Fresh 工程门禁

实现 CDP 前实际执行：

- `npm.cmd run format:check`：exit 0，`All matched files use Prettier code style!`
- `npm.cmd run typecheck`：exit 0，`tsc -b --pretty false` 无错误。
- `npm.cmd run lint`：exit 0，`eslint .` 无错误。
- `npm.cmd test`：exit 0，`63 passed (63)`、`599 passed (599)`。
- `npm.cmd run build`：exit 0，Vite 8.1.5 构建完成；`dist/index.html` 0.41 kB、CSS 25.47 kB、JS 1,210.00 kB。

构建后的资产引用为 `/DobeDemo/assets/index-BB1A0lcc.js` 与 `/DobeDemo/assets/index-SZSw_Pb1.css`，均以 `/DobeDemo/` 开头。

## 2. 安全 CDP 实现

本地脚本：`.superpowers/sdd/campaign-heroes-global-hud-cdp.mjs`。

- dev 端口从首选值起动态探测，Vite 使用 `--strictPort`；接受 HTTP 前再次确认 owned Vite 未退出、PID 仍属本脚本，并校验 HTML 同时包含 `#root` 与 `/src/main.tsx`。
- Chrome 不再预选 CDP 端口，而以 `--remote-debugging-port=0` 启动；脚本只从独立 profile 的 `DevToolsActivePort` 读取 Chrome 实际分配的端口和 browser WS 路径，再校验 page target 仍属于该端口。最终成功运行的实际 CDP 端口为 `11673`，不会连接预检阶段的未知 CDP 监听者。
- 脚本只登记并终止自己 spawn 的 Vite/Chrome PID，最终 `unknownProcessesTerminated=false`。
- Chrome profile 由 `fs.mkdtempSync(path.join(os.tmpdir(), 'dobe-campaign-heroes-cdp-'))` 创建；创建后及递归删除前均校验精确前缀，Windows 文件占用清理最多重试 5 次。
- 可见控件均由 `Input.dispatchMouseEvent` 真实点击，没有使用 `DOM.click`；localStorage 仅用于 fresh 清理、昂贵状态预置与坏存档注入。
- JSON 只含脚本/截图 basename、仓库相对路径、端口/PID/尺寸/业务数值和白名单错误 `name`/`code`；扫描确认不含绝对路径、原始 stack、profile 路径或命令行。
- 纯数据 self-test 同时验证好数据全通过、空数据全失败、动态 CDP 所有权、战斗状态变化、截图差异，以及 Windows/Unix 路径错误脱敏。
- 任一 self-test、运行期断言、截图、清理、端口释放或 profile 删除失败都会得到非零退出码。

## 3. 最终本地 CDP 结果

命令：`node .superpowers/sdd/campaign-heroes-global-hud-cdp.mjs`

产品热区根因修复并补齐英雄入口互斥覆盖后的最终完整运行结果：exit 0，`ASSERTION SELF-TEST: PASS (11 pure-data checks)`；运行期断言 **48/48 PASS**，`ALL ASSERTIONS PASSED (48/48)`。实际运行生成最终脱敏 `.superpowers/sdd/campaign-heroes-global-hud-results.json`；产品测试基线仍为 63 文件 / 599 项。

关键实测：

1. fresh：钱包 `{10000,0,0}`、帮派语义 Lv.1/声望 0、`sharedExp=0`、`highestClearedStage=0`、仅 `foreman` 位于 `back[1]`；GlobalHud 显示钱/油/物资/英雄经验四资源和推关红点。
2. fresh DOM 无编队/战斗直达入口；Adventure `Escape` 关闭回城市，Formation `Escape` 只回 Adventure。真实点击推关 → 1-1 → 编队 → 开始后，编队为 2 前 3 后五阵位，显示双方战力 `730 / 369`。
3. 战斗出现 `START`，GlobalHud 不存在、无 Auto/手动施法；初始 HP `[800]`、冷却 `[68]` 被保存，随后至少一项真机值发生变化，最终 `VICTORY`。
4. `campaign-battle.png` 仅在 running 阶段截取一次（200,871 bytes），`campaign-victory.png` 在 resolved 阶段截取（218,814 bytes）；两者 SHA-256 不同、字节数不同、逐字节变化 180,581。
5. 首通事务：`highestClearedStage=1`、`sharedExp=500`，挂机时钟初始化；继续按钮返回推关。
6. 挂机宝箱预置 25.5 秒后显示可领 4，真实领取使共享经验 `500→504`、UI 立即归零、时钟保留不足 10 秒余量；合法再推进一个 tick 后 UI 显示可领 2，证明继续累计。
7. 建筑详情打开时点击英雄入口会关闭建筑详情并清空选择；随后按 `Escape` 关闭英雄面板后，旧建筑详情不会恢复。合法帮派 Lv.2 预置下真实升级陈锤：等级 `1→2`、共享经验 `504→404`，`role="status"` 显示 `已升级 陈锤 至 Lv.2`。
8. 设置中真实点击“解锁帮派树”：声望 1470/Lv.50；帮派树同时显示 Lv.12 岳峰·铁砧、Lv.28 秦岚·长空已解锁，培养页三英雄均可升级。快速部署草稿为岳峰前排、秦岚与陈锤后排；开始后三英雄阵容持久化。
9. 打开推关会关闭建筑详情并清空选择；adventure → formation → battle 状态链成立。战斗中 GlobalHud 不存在；第一次点退出只出现“确认退出/取消”，第二次确认后才回 adventure，且 `highest/sharedExp` 均未变化。
10. 合法完成态修车厂 Lv.2 显示进度 `100`、文案 `100%`，并保留 `升级主建筑至 Lv.3` 按钮。
11. 注入 `{state:null,version:1}` 后 Adventure 保留初始 `1/1/1`、0 经验、0 关与 foreman 阵容。另一个坏存档 reload 后夹紧为 `50/1/1`、负经验归 0、最高关卡 20、仅合法 anvil 阵位保留。二次确认 reset 恢复三 store 初始态并对齐三时钟。
12. 桌面 1440×900 与移动 390×844 的核心面板均无横向溢出且可滚动/容纳；键盘焦点可见。严格 `width >= 44 && height >= 44` 检查全部通过，桌面/移动所有被测面板的 `undersizedControls` 均为空。

teardown：只终止本次自建 Chrome/Vite PID；dev/CDP 两端口均释放；临时 profile 已删除；9 张预期截图均为非空有效 PNG。

## 4. 截图证据

截图保存在 `.superpowers/sdd/`，由现有 ignore 规则保持本地，不纳入提交：

- `campaign-fresh.png`：1440×900，119,575 bytes
- `campaign-formation.png`：1440×900，107,873 bytes
- `campaign-battle.png`：1440×900，200,871 bytes（running）
- `campaign-victory.png`：1440×900，218,814 bytes
- `campaign-idle-heroes.png`：1440×900，128,098 bytes
- `campaign-unlocks.png`：1440×900，126,995 bytes
- `campaign-building-100.png`：1440×900，136,556 bytes
- `campaign-mobile.png`：390×844，82,181 bytes
- `campaign-reset.png`：1440×900，119,575 bytes

## 5. 失败、修正与产品缺陷

首次完整 CDP exit 1，35 项通过、5 项失败。失败均定位为验收脚本观测假设，不是产品缺陷：

1. fresh gang store 尚未产生持久键时被脚本当成非初始；改为把缺失持久键解释为 Zustand 初始声望 0，并由 HUD Lv.1 交叉验证。
2. 战斗 Canvas 只在过晚采样，短战已结束导致差异为 0；改为前 9 个轮询窗口连续采样并取最大差异。
3. 脚本把 `skyline` 的中文名误写为“林霄·天际线”；按权威英雄配置改为“秦岚·长空”。
4. 移动视口中建筑抽屉覆盖 HUD，坐标点击未打开推关；先真实关闭建筑面板再打开推关。
5. 设置移动抽屉虽无横向溢出且自身可滚动，但脚本额外要求整个 panel rect 垂直落在视口内；按计划实际要求改为无横向溢出、可滚动与 44px 热区，同时保留测量值。

第二次完整运行 exit 0、39/39 全绿，但 Chrome `--window-size=1440,900` 的内容区截图实测为 1424×805。为提供精确验收尺寸，脚本增加 CDP `Emulation.setDeviceMetricsOverride`；第三、第四次从 fresh 状态完整复跑均为 39/39。

安全审查修复后第五次完整运行新增动态 CDP、状态机、null payload、宝箱后续 tick、截图 hash 和严格热区断言；self-test 11/11，通过 45 项，失败 2 项，构成产品热区修复的 RED 复现：

1. `10b. desktop key controls are at least 44x44`：Adventure、Building、Settings 面板失败。源码证据中 `.adventure-panel__stage` 没有 `min-width/min-height:44px`；`.building-panel__close` 仅 `2.5rem`（40px）；设置面板至少一个真实控件未达到严格双轴 44px。
2. `10e. mobile key controls are at least 44x44`：Building 面板失败，和 40×40 的 `.building-panel__close` 一致。

根因与 RED→GREEN 修复：

- Adventure/Formation 公共按钮及关卡按钮统一提高为 `min-height:45px`，为真实布局和像素取整保留余量。
- Building 关闭按钮由 40px 修正为严格 44×44；Settings 关闭、调试与 reset/confirm/cancel 控件补齐 44px 双轴下限。
- `panel-pop-enter` 的初始 `scale(0.98)` 会把名义 44px 控件在动画测量期缩成 43.12px；移除 scale，只保留位移与透明度动画。
- 第五次 CDP 的 45/47 是 RED；父代理完成上述产品 CSS 修复后从 fresh 状态运行完整 CDP，原有 47 项全部 GREEN；随后补充“英雄入口关闭建筑详情且 Escape 后不恢复”的单 overlay 互斥断言并再次完整复跑，最终 exit 0、self-test 11/11、运行断言 48/48。最终 JSON 中桌面和移动全部核心面板 `controls44=true`、`undersizedControls=[]`，进程/端口/profile 清理继续全部 PASS。

最终本地证据尚未 commit、未 push、未发布 Pages。未触碰或纳入 `example/5v5example.mp4`、`example/ux/`、`dist` 或截图。
