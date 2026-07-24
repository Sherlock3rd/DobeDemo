# 战役 / 英雄 / GlobalHud — 本地与公开 CDP 验收报告

日期：2026-07-24  
本地功能验收 HEAD：`600f2aa`  
公开发布账目：main HEAD `75f5b81`；gh-pages built `d7565826d5c11dabcfca63d8e46480e4a63dc225`。  
前置状态：最终产品测试 65 文件 / 655 项全绿，Task 6 终审 Approved，最终分支审查修复已完成。

本报告先记录 Task 7 的本地门禁与安全 CDP 证据；第 6 节追加对上述 gh-pages built 的真实公开站点复验。本次公开验收未执行 commit、push，也未修改产品源码。

## 1. Fresh 工程门禁

实现 CDP 前实际执行：

- `npm.cmd run format:check`：exit 0，`All matched files use Prettier code style!`
- `npm.cmd run typecheck`：exit 0，`tsc -b --pretty false` 无错误。
- `npm.cmd run lint`：exit 0，`eslint .` 无错误。
- `npm.cmd test`：exit 0，`65 passed (65)`、`655 passed (655)`。
- `npm.cmd run build`：exit 0，Vite 8.1.5 最终构建完成。

最终构建资产引用为 `/DobeDemo/assets/index-C010nH2x.js` 与 `/DobeDemo/assets/index-CoMhGqEJ.css`，均以 `/DobeDemo/` 开头。

## 2. 安全 CDP 实现

本地脚本：`.superpowers/sdd/campaign-heroes-global-hud-cdp.mjs`。

- dev 端口从首选值起动态探测，Vite 使用 `--strictPort`；接受 HTTP 前再次确认 owned Vite 未退出、PID 仍属本脚本，并校验 HTML 同时包含 `#root` 与 `/src/main.tsx`。
- Chrome 不再预选 CDP 端口，而以 `--remote-debugging-port=0` 启动；脚本只从独立 profile 的 `DevToolsActivePort` 读取 Chrome 实际分配的端口和 browser WS 路径，再校验 page target 仍属于该端口。最终成功运行的实际 CDP 端口为 `4404`，不会连接预检阶段的未知 CDP 监听者。
- 脚本只登记并终止自己 spawn 的 Vite/Chrome PID，最终 `unknownProcessesTerminated=false`。
- Chrome profile 由 `fs.mkdtempSync(path.join(os.tmpdir(), 'dobe-campaign-heroes-cdp-'))` 创建；创建后及递归删除前均校验精确前缀，Windows 文件占用清理最多重试 5 次。
- 可见控件均由 `Input.dispatchMouseEvent` 真实点击，没有使用 `DOM.click`；localStorage 仅用于 fresh 清理、昂贵状态预置与坏存档注入。
- JSON 只含脚本/截图 basename、仓库相对路径、端口/PID/尺寸/业务数值和白名单错误 `name`/`code`；扫描确认不含绝对路径、原始 stack、profile 路径或命令行。
- 纯数据 self-test 同时验证好数据全通过、空数据全失败、动态 CDP 所有权、战斗状态变化、截图差异，以及 Windows/Unix 路径错误脱敏。
- 任一 self-test、运行期断言、截图、清理、端口释放或 profile 删除失败都会得到非零退出码。

### 2.1 最终分支审查修复

- 退出确认进入冻结态并阻止发奖：确认框出现后战斗不再继续推进；中途退出不会提交胜利、首通或经验。
- BattleScene 改为真实 `useFrame` 表现：走位、lunge、死亡 tween，basic 枪火/命中，skill 金色齐射拖尾；`prefers-reduced-motion` 保留最终状态与事件语义但关闭非必要 tween。
- Adventure Store 拒绝锁定英雄与非法 `gangLevel`；配置解析与派生规则补齐 safe integer、`defaultSlot` 和数值溢出保护。
- Overlay 补齐标题初始聚焦、背景 `inert` 与关闭后的触发点焦点恢复。
- BattleEffects 的实际 mounted callback 回写 BattleScreen `data-presented-*`，同时 BattleScreen 通过 `data-*` 暴露累计 basic/skill/damage/death 事件计数；CDP 因而能区分“引擎已产生事件”和“表现层已实际挂载呈现”。
- GlobalHud 使用 `z-index:22` 在所有非 battle overlay 中保持常驻并可接收指针导航；对应非 battle dialog 移除不再成立的 `aria-modal`。进入 battle 后 HUD 仍隐藏并处于不可交互/inert 状态，退出后恢复。
- 以上终审修复完成后，format/typecheck/lint/build 均 exit 0，产品测试 65 文件 / 655 项全部通过。

## 3. 最终本地 CDP 结果

命令：`node .superpowers/sdd/campaign-heroes-global-hud-cdp.mjs`

最终分支审查修复并补齐真实战斗事件覆盖后的完整运行结果：exit 0，`ASSERTION SELF-TEST: PASS (11 pure-data checks)`；运行期断言 **50/50 PASS**，`ALL ASSERTIONS PASSED (50/50)`。实际运行生成最终脱敏 `.superpowers/sdd/campaign-heroes-global-hud-results.json`；产品测试基线为 65 文件 / 655 项。

关键实测：

1. fresh：钱包 `{10000,0,0}`、帮派语义 Lv.1/声望 0、`sharedExp=0`、`highestClearedStage=0`、仅 `foreman` 位于 `back[1]`；GlobalHud 显示钱/油/物资/英雄经验四资源和推关红点。
2. fresh DOM 无编队/战斗直达入口；Adventure `Escape` 关闭回城市，Formation `Escape` 只回 Adventure。真实点击推关 → 1-1 → 编队 → 开始后，编队为 2 前 3 后五阵位，显示双方战力 `730 / 369`。
3. GlobalHud 在 Adventure、Formation、Heroes、Settings 等非 battle overlay 上方常驻且可真实指针导航；这些 dialog 不再错误声明 `aria-modal`。战斗出现 `START` 后 HUD 隐藏且 inert，无 Auto/手动施法。stage 1 从累计事件与 presented 标记全零推进到 basic 7、damage 7、death 1、`presentedBasic=true`，并最终 `VICTORY`。另一个 stage 20 真机流程观察到 basic 30、skill-main 5、skill-splash 11、damage 46、death 1，且 `presentedBasic=true`、`presentedSkill=true`、`currentPresentedSkill=true`。
4. `campaign-battle.png` 在 stage 1 running-basic-hit 阶段截取（206,212 bytes），`campaign-skill.png` 在 stage 20 running-skill-effect 阶段截取（243,444 bytes），两者 SHA-256 不同；`campaign-victory.png` 在 resolved 阶段截取（230,188 bytes），也与 running 截图不同。
5. 首通事务：`highestClearedStage=1`、`sharedExp=500`，挂机时钟初始化；继续按钮返回推关。
6. 挂机宝箱预置 25.5 秒后显示可领 4，真实领取使共享经验 `500→504`、UI 立即归零、时钟保留不足 10 秒余量；合法再推进一个 tick 后 UI 显示可领 2，证明继续累计。
7. 建筑详情打开时点击英雄入口会关闭建筑详情并清空选择；随后按 `Escape` 关闭英雄面板后，旧建筑详情不会恢复。合法帮派 Lv.2 预置下真实升级陈锤：等级 `1→2`、共享经验 `504→404`，`role="status"` 显示 `已升级 陈锤 至 Lv.2`。
8. 设置中真实点击“解锁帮派树”：声望 1470/Lv.50；帮派树同时显示 Lv.12 岳峰·铁砧、Lv.28 秦岚·长空已解锁，培养页三英雄均可升级。快速部署草稿为岳峰前排、秦岚与陈锤后排；开始后三英雄阵容持久化。
9. 打开推关会关闭建筑详情并清空选择；adventure → formation → battle 状态链成立。战斗中 GlobalHud 不存在；第一次点退出只出现“确认退出/取消”，第二次确认后才回 adventure，且 `highest/sharedExp` 均未变化。
10. 合法完成态修车厂 Lv.2 显示进度 `100`、文案 `100%`，并保留 `升级主建筑至 Lv.3` 按钮。
11. 注入 `{state:null,version:1}` 后 Adventure 保留初始 `1/1/1`、0 经验、0 关与 foreman 阵容。另一个坏存档 reload 后夹紧为 `50/1/1`、负经验归 0、最高关卡 20、仅合法 anvil 阵位保留。二次确认 reset 恢复三 store 初始态并对齐三时钟。
12. 桌面 1440×900 与移动 390×844 的核心面板均无横向溢出且可滚动/容纳；键盘焦点可见。严格 `width >= 44 && height >= 44` 检查全部通过，桌面/移动所有被测面板的 `undersizedControls` 均为空。

teardown：只终止本次自建 Chrome/Vite PID；dev/CDP 两端口均释放；临时 profile 已删除；10 张预期截图均为非空有效 PNG。

## 4. 截图证据

截图保存在 `.superpowers/sdd/`，由现有 ignore 规则保持本地，不纳入提交：

- `campaign-fresh.png`：1440×900，119,575 bytes
- `campaign-formation.png`：1440×900，130,395 bytes
- `campaign-battle.png`：1440×900，206,212 bytes（running-basic-hit）
- `campaign-victory.png`：1440×900，230,188 bytes（resolved）
- `campaign-idle-heroes.png`：1440×900，122,190 bytes
- `campaign-unlocks.png`：1440×900，127,515 bytes
- `campaign-skill.png`：1440×900，243,444 bytes（running-skill-effect）
- `campaign-building-100.png`：1440×900，129,856 bytes
- `campaign-mobile.png`：390×844，77,040 bytes
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
- 第五次 CDP 的 45/47 是 RED；父代理完成上述产品 CSS 修复后从 fresh 状态运行完整 CDP，原有 47 项全部 GREEN；随后补充英雄入口互斥断言，原有 48 项全部 GREEN。最终分支审查又修复退出冻结、真实 `useFrame` 战斗表现、Store/配置边界与 Overlay 可访问性，并通过 BattleEffects mounted callback → BattleScreen `data-presented-*` 与累计事件计数新增 stage 1 basic/damage/death 和 stage 20 basic+skill 表现层断言；新增 `campaign-skill.png` 并确认其 hash 与 basic 截图不同。最后修正 GlobalHud 层级与 dialog 语义，使 HUD 在非 battle overlay 上可指针导航、battle 仍 hidden/inert；最终完整复跑 exit 0、self-test 11/11、运行断言 50/50。最终 JSON 中全部热区 `controls44=true`、`undersizedControls=[]`，进程/端口/profile 清理继续全部 PASS。

截至本地验收结束时，该批本地证据尚未 commit、push 或发布；后续发布与公开复验见第 6 节。未触碰或纳入 `example/5v5example.mp4`、`example/ux/`、`dist` 或截图。

## 6. GitHub Pages 公开发布验收

公开 URL：`https://sherlock3rd.github.io/DobeDemo/?release=d756582`  
公开脚本：`.superpowers/sdd/campaign-heroes-global-hud-public-cdp.mjs`  
脱敏结果：`.superpowers/sdd/campaign-heroes-global-hud-public-results.json`

实际执行：

- `node --check .superpowers/sdd/campaign-heroes-global-hud-public-cdp.mjs`：exit 0。
- `node .superpowers/sdd/campaign-heroes-global-hud-public-cdp.mjs`：exit 0。
- assertion self-test：**19/19 PASS**，覆盖好数据、空数据失败、动态 CDP 所有权和 Windows/Unix 路径错误脱敏。
- 公开运行断言：**18/18 PASS**，`ALL ASSERTIONS PASSED (18/18)`。
- 公开浏览器验收由实现代理与父流程各完整运行 1 次，两次均全绿、产品重试 0 次。此前有 1 次 PowerShell `&&` 解析失败，Node 与 Chrome 均未启动，不计公开产品运行或重试。

### 6.1 公开 HTTP 与业务链路

1. 首页、当前 JS、当前 CSS 均实测 HTTP 200；HTML 精确引用 `/DobeDemo/assets/index-C010nH2x.js` 与 `/DobeDemo/assets/index-CoMhGqEJ.css`，且所有资产路径均以 `/DobeDemo/` 开头。
2. 隔离 profile 的 fresh storage 实测钱包 `{money:10000,oil:0,materials:0}`、`sharedExp=0`、`highestClearedStage=0`、初始 foreman 阵容；GlobalHud 显示钱/油/物资/英雄经验四资源及推关红点。
3. 真实指针依次点击推关 → 1-1 → 编队 → 开始。战斗起始显示 `START`、GlobalHud 隐藏；战斗状态实际变化，最终累计 `basicHits=7`、`damageEvents=7`、`deaths=1`、`presentedBasic=true`，并在 running basic 表现窗口成功截图。
4. 战斗结果实测 `VICTORY · 胜利首通奖励 英雄经验 500`；持久状态为 `highestClearedStage=1`、`sharedExp=500`。点击继续后回到 Adventure。
5. GlobalHud 在 fresh、Adventure、Formation 等非 battle 状态均保持可见；battle 中隐藏。移动战斗真实点击退出并确认后回到 Adventure，GlobalHud 恢复。
6. 1440×900 与 390×844 下，HUD、Adventure、Battle 均无横向溢出；被测可用按钮全部满足 `width >= 44 && height >= 44`，`undersizedControls=[]`。

### 6.2 公开 CDP 安全与脱敏

- Chrome 以 `--remote-debugging-port=0` 启动，只从本次隔离 profile 的 `DevToolsActivePort` 读取动态端口，并校验 page target 的 host/port 所有权。
- profile 使用精确前缀 `dobe-campaign-heroes-public-cdp-`；只登记并终止本脚本 spawn 的 Chrome PID。结果中不记录 PID、动态端口或 profile 随机目录名。
- teardown 实测只对 owned Chrome 执行终止；CDP 端口释放、临时 profile 删除均为 `true`，`unknownProcessesTerminated=false`。
- JSON 脱敏扫描未发现绝对路径、`stack`、原始错误消息或用户目录；运行错误若发生只允许写入白名单 `name`/`code`。
- 任一运行断言、self-test、截图、端口释放或 profile 删除失败都会非零退出。

### 6.3 公开截图证据

以下截图均为本次公开站点真实运行生成的非空 PNG，保存在 `.superpowers/sdd/` 且继续由 ignore 规则排除，不提交：

- `campaign-public-fresh-desktop.png`：1440×900，119,575 bytes
- `campaign-public-adventure-desktop.png`：1440×900，148,527 bytes
- `campaign-public-formation-desktop.png`：1440×900，130,395 bytes
- `campaign-public-battle-desktop.png`：1440×900，197,153 bytes（running-basic-hit）
- `campaign-public-victory-desktop.png`：1440×900，230,104 bytes（resolved）
- `campaign-public-hud-mobile.png`：390×844，66,244 bytes
- `campaign-public-adventure-mobile.png`：390×844，85,772 bytes
- `campaign-public-battle-mobile.png`：390×844，36,795 bytes（start）

本次公开复验未发现公开产品缺陷；未改产品源码，未 commit、未 push。
