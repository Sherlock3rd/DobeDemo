# Settings Reset Task 3 本地验收报告

生成日期：2026-07-23  
执行范围：Task 3 Execution Boundaries 的本地 Step 1–3  
状态：DONE_WITH_CONCERNS  
公开发布：待父代理发布

## 边界与版本状态

- Task 1 产品提交：`d8d9940 feat: add account reset coordinator`
- Task 2 产品提交：`a999e5f feat: add guarded debug account reset`
- 本任务未修改 Task 1/2 产品代码；新增验收脚本/证据并修改 README、session、计划复选框和本报告。
- 未创建 commit，未 push，未切分支，未修改 Git 配置，未调用 GitHub API，未变更 GitHub Pages。
- 开始时分支为 `main...origin/main [ahead 4]`。工作区已有 101 个状态条目，但 `git diff --stat` 对这些条目显示 `0 insertions(+), 0 deletions(-)`；本任务未清理、覆盖或提交这些既有状态。

## 命令与精确结果

### 预检

1. 实时监听端口：

   ```powershell
   $listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Sort-Object LocalPort; $listeners | ForEach-Object { $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; [PSCustomObject]@{Address=$_.LocalAddress;Port=$_.LocalPort;PID=$_.OwningProcess;Process=$p.ProcessName} } | Format-Table -AutoSize
   ```

   结果：exit 0；未发现 Vite 常用端口 5173–5199 或 CDP 端口 9222–9273 的现有监听。未复用或终止任何用户服务。

2. 仓库状态：

   ```powershell
   git status --short --branch; git diff --stat; git log -5 --oneline
   ```

   结果：exit 0；`main...origin/main [ahead 4]`；最近产品提交为 `a999e5f`、`d8d9940`；开始时已有 101 个工作区状态条目、内容统计均为 0 行变化。

### fresh 工程门禁

1. `npm.cmd run format:check` → exit 0；`All matched files use Prettier code style!`
2. `npm.cmd run typecheck` → exit 0；TypeScript build check 无诊断。
3. `npm.cmd run lint` → exit 0；ESLint 无诊断。
4. `npm.cmd test` → exit 0；`34 passed (34)` 测试文件、`404 passed (404)` 测试，耗时 15.81s。
5. `npm.cmd run build` → exit 0；605 modules transformed，构建耗时 5.87s：
   - `dist/index.html` 0.41 kB（gzip 0.27 kB）
   - `dist/assets/index-D2tbbVLS.css` 15.92 kB（gzip 3.53 kB）
   - `dist/assets/index-CnCFOskQ.js` 1,145.39 kB（gzip 316.51 kB）
   - `dist/index.html` 精确引用 `/DobeDemo/assets/index-CnCFOskQ.js` 和 `/DobeDemo/assets/index-D2tbbVLS.css`。
   - 非阻塞警告：主 JS chunk 大于 500 kB。

文档和证据完成后再次执行最终门禁：

- 首次尝试用 PowerShell 复合命令
  `npm.cmd run format:check && npm.cmd run typecheck && npm.cmd run lint && npm.cmd test && npm.cmd run build`
  → exit 1；宿主 Windows PowerShell 版本不支持 `&&`，命令在解析阶段失败，未执行任何 npm 子命令。
- 随后按简报逐条执行：format check exit 0、typecheck exit 0、lint exit 0、test exit 0（34 文件/404 项，14.09s）、build exit 0（605 modules，586ms，产物文件名和体积不变，仍只有 >500 kB chunk 警告）。
- README 最后一处 Escape 文案更新后再次执行 `npm.cmd run format:check` → exit 0；`All matched files use Prettier code style!`。
- `ReadLints` 检查 README、session、计划、CDP 脚本和报告：无诊断。

### CDP 脚本静态检查

1. `node --check ".superpowers/sdd/settings-reset-cdp.mjs"` → exit 0。
2. `npm.cmd exec prettier -- --check ".superpowers/sdd/settings-reset-cdp.mjs"` → exit 0；格式匹配。
3. `npm.cmd exec eslint -- ".superpowers/sdd/settings-reset-cdp.mjs"` → exit 0；脚本命中仓库 ignore pattern，输出 1 条 ignored-file warning、0 errors。

### CDP 运行记录

1. `node ".superpowers/sdd/settings-reset-cdp.mjs"` → exit 1。前 24 条业务/持久化断言通过；脚本在 `Page.reload` 后误把旧文档识别为新文档，移动步骤找不到设置按钮。进程、端口和 profile 均安全清理。
2. 同命令复验 → exit 1。刷新竞态已用 `performance.timeOrigin` 条件等待修复，完整八步流程通过；仅“注入声望必须精确等于 330”断言失败，实际为 335，原因是允许的当秒挂机 +5。进程、端口和 profile 均安全清理。
3. 隐私修复后同命令最终运行 → exit 0；生成时间 `2026-07-23T10:33:49.738Z`，`ASSERTION SELF-TEST: PASS (32 pure-data checks)`、`ALL ASSERTIONS PASSED`，33/33 运行时断言通过。公开 JSON 仅记录 `chromeExecutable="chrome.exe"` 与 `tempProfileName="dobe-settings-reset-cdp-kK6puo"`。

### Important 隐私修复验证

1. `node --check ".superpowers/sdd/settings-reset-cdp.mjs"` → exit 0。
2. `npm.cmd exec prettier -- --check --ignore-path NUL ".superpowers/sdd/settings-reset-cdp.mjs"` → exit 0；`All matched files use Prettier code style!`。
3. 运行前端口复检 → 5188/9234 均未监听；首次 PowerShell 表达式因旧版解析器不接受该管道写法而 exit 1，改为先收集 `$rows` 后重试 exit 0。
4. `node ".superpowers/sdd/settings-reset-cdp.mjs"` → exit 0；33/33 断言、32 项纯数据 self-test 全部通过。
5. Node JSON 脱敏扫描 → exit 0；`C:\\Users\\`、`/Users/`、`AppData`、Windows 盘符绝对路径、Chrome 安装目录模式全部为 false，解析后的字符串值中绝对路径数量为 0。

## 真实浏览器八步流程

1. 写入 gang 基线 330 声望（Lv.12）及修车厂 `{ level: 6, completedFragments: 3 }`；加载后 GangIdleController 合法结算 +5，持久化为 335，时间戳从 `1784802833060` 前进至 `1784802834060`。
2. 真实 CDP 场景点击 `(455, 280)` 打开修车厂，显示“等级 6 / 10”“3 / 7 个子建筑”。
3. 真实点击 `aria-label="打开调试设置"`，得到具名“调试设置”的 `role="dialog"`，帮派树不存在。
4. 首次点击“重置账号”后，城市持久化 JSON 完全未变；gang 仍为 Lv.12 且仅允许按 +5/秒推导；HUD 与修车厂面板不变，出现“确认重置账号”与永久重置警告。
5. 点击“确认重置账号”后立即读取原始持久化 JSON：六建筑全部 Lv.1/0，gang 声望精确为 0，`lastUpdatedAt=1784802835647`，且落在 Node 点击区间 `[1784802835624, 1784802835651]`；设置 dialog 和建筑面板关闭，HUD 为 Lv.1。
6. 再次真实点击修车厂，显示“等级 1 / 10”“0 / 2 个子建筑”。
7. 刷新后，城市双存档仍为六建筑 Lv.1/0；gang 为 `{ totalReputation: 0, lastUpdatedAt: 1784802835647 }`，精确满足“重置基线 + 按整秒 5 点挂机收益”的公式，HUD 仍为 Lv.1。
8. 设备指标切换为 390×844 后真实打开设置：抽屉矩形为 `left=0, top=567.5625, right=390, bottom=844, width=390, height=276.4375`；panel `scrollWidth/clientWidth=389/389`，document `scrollWidth=390`，无横向溢出。

## CDP 逐条断言

以下 33 条最终均为 PASS：

1. selected dev port free：5188。
2. selected CDP port free：9234。
3. dist assets use `/DobeDemo/`：JS/CSS 均匹配。
4. HTTP status：200。
5. HTTP contains root and `/src/main.tsx`：true/true。
6. injected gang is Lv.12 seed plus exact idle earnings：330 → 335，时间戳 +1000ms。
7. injected repair shop is Lv.6 with 3 fragments：`6/3`。
8. non-initial repair panel shown：修车厂、等级 6/10、3/7。
9. settings dialog accessible name：`调试设置`。
10. settings and gang tree mutually exclusive：gang tree false。
11. first click preserves city durable store：JSON 完全相等。
12. first click preserves gang progression except valid idle tick：335 → 335。
13. first click preserves HUD Lv.12：`Lv. 12`。
14. first click preserves repair panel：等级 6/10、3/7。
15. first click enters confirmation state：确认按钮与警告均存在。
16. reset moment city persistence is initial：六建筑全部 Lv.1/0。
17. reset moment gang persistence is zero：0 声望。
18. reset uses confirmation `Date.now()`：时间戳 1784802835647 落在点击区间内。
19. confirmation closes settings dialog：false。
20. confirmation closes building panel：false。
21. HUD resets to Lv.1：`Lv. 1`。
22. repair shop reopens at Lv.1 0/2：通过。
23. refresh city persistence remains initial：六建筑全部 Lv.1/0。
24. refresh gang is reset baseline plus exact idle earnings：0，时间戳保持 reset 基线。
25. refresh HUD remains Lv.1：`Lv. 1`。
26. mobile settings dialog present：具名 `调试设置`。
27. mobile drawer within viewport：true。
28. mobile drawer has no horizontal overflow：true。
29. all three screenshots written：true。
30. only owned PIDs targeted：true。
31. dev port released：true。
32. CDP port released：true。
33. temporary Chrome profile removed：true。

机器可读完整结果：`.superpowers/sdd/settings-reset-results.json`。

## 截图与人工自审

- `.superpowers/sdd/settings-reset-confirm.png`：桌面居中设置 modal，二次确认警告、确认和取消按钮清晰；背景 HUD 保持 Lv.12，右侧修车厂保持 Lv.6/3 碎片状态。
- `.superpowers/sdd/settings-reset-complete.png`：无需刷新即回到 HUD Lv.1；修车厂重新打开为 Lv.1/10、0/2。
- `.superpowers/sdd/settings-reset-mobile.png`：390×844 底部抽屉贴合左右边界，按钮和文案完整，无肉眼可见横向裁切。
- 自审结论：截图与 JSON 断言一致；确认态、完成态和移动态均可读，没有发现产品代码回归证据。

## 进程与端口安全

- 最终运行预检选择空闲 dev 5188、CDP 9234；策略为跳过占用端口，绝不连接或终止未知 PID。
- 脚本自建并记录：Vite PID 58960、Chrome PID 62064。
- teardown 仅对上述 owned PID 执行树终止；`unknownProcessesTerminated=false`。
- 最终确认 dev 5188 与 CDP 9234 均释放。
- 运行时仍使用原始绝对 Chrome/profile 路径启动与清理，但这些路径只存在于脚本局部变量；公开 `processSafety` 仅保留 basename：`chromeExecutable="chrome.exe"`、`tempProfileName="dobe-settings-reset-cdp-kK6puo"`。
- 临时 profile 仅清理脚本自身创建、精确匹配前缀和内部绝对路径的目录，最终 `tempProfileRemoved=true`；公开 JSON 不记录该内部绝对路径。
- 最终证据文件大小：确认态 149,648 bytes、完成态 155,461 bytes、移动端 74,432 bytes、结果 JSON 23,493 bytes。

## 脱敏扫描

- 原始 JSON 正则扫描：`C:\\Users\\` false、`/Users/` false、`AppData` false、`[A-Za-z]:\\` false。
- Chrome 安装目录扫描：`Program Files`/`Google\\Chrome` false。
- 递归解析所有 JSON 字符串后，Windows 或 macOS 用户目录绝对路径共 0 项。
- 公开字段已从 `chromePath`/`tempProfile` 改为 `chromeExecutable`/`tempProfileName`；值均为 basename，不含盘符、用户名、系统临时目录或安装目录。

## 关注事项

- 构建仍有既有的主 JS chunk 大于 500 kB 警告，不阻塞本任务。
- 工作区开始时已有大量非本任务状态条目；父代理提交前应按简报检查 status/diff/log，仅暂存 Task 3 指定文件和证据。
- `git diff --numstat -- src` 对既有产品代码状态仅显示 `0 0`，本任务没有产品内容差异。
- `.superpowers/sdd/.gitignore:1` 的 `*` 会忽略六个新增验收文件；`git check-ignore -v` 已确认脚本、JSON、三张截图和报告均命中该规则。父代理提交验收证据时需显式纳入这些指定文件，不能依赖普通 `git add` 自动发现。
- 公开 GitHub Pages 尚未发布或复验；状态必须保持“待父代理发布”。
