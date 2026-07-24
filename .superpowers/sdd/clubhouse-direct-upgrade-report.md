# Clubhouse Direct Upgrade 本地与公开 CDP 验收报告

## 结论

- 功能基线：`5f909af feat: drive Clubhouse visuals from main level`
- 最终 CDP：self-test `23/23`，运行断言 `28/28`，exit `0`
- 工程基线：65 个测试文件、693 项测试；最终五门禁均 exit `0`
- 构建资产：`/DobeDemo/assets/index-781xcY6f.js`、`/DobeDemo/assets/index-CoMhGqEJ.css`
- 公开发布：`main` `9e063c8`；`gh-pages` `9f7844863443d084d23425d77a0940f99b5a61bc`，Pages 状态 `built`；公开 CDP self-test `27/27`、运行断言 `16/16`、exit `0`
- 范围：新增本地/公开 CDP、结果、报告及更新文档；未修改产品源码，未 commit、未 push；本轮只复验用户已发布的 Pages，没有执行发布

## 安全模型

- Vite 从 `5332` 起探测空闲端口，以 `--strictPort` 启动；接受 HTTP 前同时验证自建 PID 仍存活、`#root` 与 `/src/main.tsx` 应用特征。
- Chrome 使用 `--remote-debugging-port=0` 和独立临时 profile；只从该 profile 的 `DevToolsActivePort` 读取端口并校验 page WebSocket 属于该端口。
- 三处 HTTP 请求（CDP `/json`、Vite readiness、最终 HTTP 特征检查）统一经过 `fetchWithTimeout()`，每次都使用 Node 22 原生 `AbortSignal.timeout(10000)`。超时在 readiness/target 轮询中进入下一次有限重试；最终检查超时则抛出白名单 `HttpTimeoutError/HTTP_TIMEOUT`，由统一 catch/finally 脱敏并清理。
- WebSocket 建连的 `open/error/close` Promise 有 10 秒有限超时；无论 open、error、close 或 timeout 都统一清除 timer 及三个临时 listener。建连超时只产生白名单 `CdpConnectTimeoutError/CDP_CONNECT_TIMEOUT`，随后进入统一 `finally` 清理。
- 每个 CDP 请求都有 10 秒有限超时；超时会先从 pending map 删除再以白名单 `CdpTimeoutError/CDP_TIMEOUT` 拒绝。WebSocket `error`/`close` 会清除 timer 并拒绝全部 pending，使主流程进入 `finally`，不会永久等待。
- 所有可见交互均由 `Input.dispatchMouseEvent` 完成；两次 Clubhouse 升级均为真实指针点击，没有使用 `DOM.click()`。
- 注册 owned 进程时保存 `ChildProcess` 对象，`exit` 时移出 active child/PID 集合。cleanup 只有在对象仍登记、`exitCode/signalCode` 均为 null、`killed=false` 且 PID 仍 active-owned 时才执行终止；失活对象记录 `skipped`，不调用 taskkill。
- `registerOwnedProcess()` 在任何 PID/活性检查前立即注册 ChildProcess `error` listener；spawn 失败只保存白名单 name/code 到 `processSafety.childErrors`，同时移出 active-owned 集合。Vite 启动轮询与 Chrome `DevToolsActivePort`/target 等待均调用统一检测并抛出脱敏 `ChildProcessError`，进入 `main()` catch/finally；无 PID 的失败 child 在 cleanup 中安全跳过。
- 结果中的进程证据只含 `label/owned/active/skipped`，不写随机 PID。最终开发端口与 CDP 端口均释放，临时 profile 删除成功。
- `runAssertionSelfTest()`、浏览器主流程、teardown、断言汇总、JSON 序列化与结果写盘全部位于统一 `main()` 脱敏边界内；写盘 helper 捕获序列化/写文件异常并只返回 name/code。最外层 `main().catch` 也只调用白名单输出，防止 Node 默认打印栈。
- JSON 只记录相对路径、basename、数值和白名单错误分类；顶层 stderr 同样只输出 `toPublicErrorCategory()` 的 name/code JSON，不输出原始 message、stack 或绝对路径。
- self-test 额外真实覆盖：请求 timeout 会清 pending、socket close helper 会拒绝并清空全部 pending、inactive child 的纯决策为 owned 但 active=false（因此跳过 kill）、建连 timeout 会清理全部临时 listener、写盘异常脱敏、统一 `main()` 结构包含 self-test/finally/write boundary、ChildProcess error listener 会捕获并脱敏 ENOENT、Vite/Chrome 等待与 cleanup 均接入该边界、HTTP AbortSignal 会真实超时且三个 fetch 调用点均只使用统一 wrapper。
- 任一断言、运行、清理或截图缺失都会非零退出。

## 实测结果

1. v4 合法预置注入声望 1170（帮派 Lv.40）；扫描期间按设计增长到 1171。真实打开 Clubhouse 后，`radio/radiogroup/progressbar/child/confirm` 数量均为 `0`。
2. Lv.1 面板显示战力 `250 / +60 / 310`、主成本 `钱25/油0/物资0`，按钮为 `直接升级 Clubhouse 至 Lv.2 · 钱 25`。
3. 第一次真实点击：钱包 `100003/1/1 → 99978/1/1`，精确扣除 `25/0/0`；主等级 `1→2`，10 个 children 全 0，无确认页。刷新后仍为 Lv.2；刷新窗口只出现合法生产 `+3/+1/+1`。
4. 第二次真实点击：钱包 `99981/2/2 → 99921/2/2`，精确扣除 target 3 成本 `60/0/0`；主等级 `2→3`，仍无确认页且 children 全 0。
5. 钱为 0 时按钮 disabled，精确提示 `资源不足，还需 钱 25`；Lv.10 显示满级且无按钮；帮派 Lv.39 显示锁定且无按钮。
6. v3 Clubhouse children `[1,2,3,0,0,0,0,0,0,0]` 从钱包 `100/7/9` 迁移到 v4 后退款 `55`，得到 `155/7/9`，children 清零；第二次 reload 仍为 `155/7/9`，未重复退款。
7. 无 Clubhouse 子控件，且 fresh、两次真实升级、迁移首次与再次 reload 的持久 children 均为 10 个 0，交叉证明 UI/持久路径没有 Clubhouse child 升级入口。
8. 3D 纯状态探针为 `1 layer → 2 layers`，全部 `current`，scaffold 与 animated 数量均为 0；Clubhouse ROI 改变 282 像素（0.375%），排除 ROI/HUD/面板后的对照区变化 0%。
9. 修车厂回归仍有 2 个 radio、1 个 radiogroup、1 个 progressbar、`升级主建筑至 Lv.3`；真实点击后出现返回与确认升级按钮。
10. 桌面按钮 `270×44`；移动 390×844 面板无横向溢出、`overflow-y` 可滚动，按钮 `324×44` 且完整位于视口。

## 截图证据

- `clubhouse-desktop-before.png`：1440×900，124949 bytes
- `clubhouse-desktop-after.png`：1440×900，129076 bytes
- `clubhouse-consecutive.png`：1440×900，130067 bytes
- `clubhouse-insufficient.png`：1440×900，126505 bytes
- `clubhouse-maxed.png`：1440×900，124982 bytes
- `clubhouse-locked.png`：1440×900，118455 bytes
- `clubhouse-migration.png`：1440×900，94997 bytes
- `clubhouse-repair-regression.png`：1440×900，123073 bytes
- `clubhouse-mobile.png`：390×844，70738 bytes

每张截图的 basename、尺寸、bytes 与 SHA-256 均写入 `clubhouse-direct-upgrade-results.json`。

## 真实失败与重试

- 第 1 次运行：self-test 13/13；运行期 26/28，通过产品行为与全部安全清理，但 exit `1`。失败来自脚本错误假设：把扫描期间合法声望 `1170→1171` 视为失败，并要求刷新后钱包完全不增长，忽略了合法 `3/1/1` 生产 tick。
- 修正只涉及验收断言：声望验证改为仍处于 Lv.40 区间；升级扣费继续在点击前后精确验证，刷新阶段只允许符合生产比例的非负增量。
- 第 2 次完整运行：self-test 13/13、运行期 28/28、9 张截图、端口释放与 profile 清理全部通过，exit `0`。
- 父流程独立复跑时，首次命中验收脚本的注入竞态：localStorage 写入与后续 `Page.reload` 分属两个 CDP 命令，1 秒生产定时器可在其间用旧内存状态覆盖 Lv.10 预置，造成 Maxed 场景误判。脚本改为同一页面执行中同步写入后立即 `location.reload()`，消除覆盖窗口。
- 修正后父流程再次从 fresh profile 完整运行：self-test 13/13、运行期 28/28、全部截图及 teardown 全绿，exit `0`。产品源码无需修改。
- 本次安全审查先加入 timeout/close/inactive-child 三项自测。首个 RED 运行暴露了测试夹具自身的 1 秒 reject timer 未被消费，修正夹具后得到干净 RED：self-test `FAIL (16)`，并同时复现顶层日志会输出原始栈路径。
- 随后实现 10 秒 CDP timeout、socket 全 pending 拒绝、ChildProcess 活性登记/退出移除/失活跳过、无 PID 结果与白名单 stderr。最终完整重跑 self-test `16/16`、运行期 `28/28`、9 张截图与 teardown 全绿，exit `0`。
- 第二轮安全复审新增建连 timeout/listener cleanup、写盘脱敏与顶层入口结构三项自测；实现前得到预期 RED：self-test `FAIL (19)`、exit `1`，stderr 仍保持白名单 `{"name":"Error"}`，没有默认栈。
- 实现 `waitForSocketOpen()` 的 10 秒超时与 listener/timer cleanup，并把 self-test、主流程、teardown、结果序列化/写盘收口到统一 `main()`；外层 Promise catch 使用固定脱敏输出。最终完整运行 self-test `19/19`、运行期 `28/28`、9 张截图与 teardown 全绿，exit `0`。
- 最终复审新增 ChildProcess error 捕获与调用结构两项自测；实现前得到预期 RED：self-test `FAIL (21)`、exit `1`，无 Node 默认栈。
- 随后在 PID 检查前立即挂载 error listener，保存白名单 category，并让 Vite/Chrome 启动等待主动检测后进入统一脱敏 catch/finally；spawn 无 PID 的 cleanup 只记录 skipped。最终完整运行 self-test `21/21`、运行期 `28/28`、9 张截图与 teardown 全绿，exit `0`，正常运行的 `childErrors` 为 `[]`。
- HTTP 超时复审新增真实 AbortSignal timeout 与三调用点结构两项自测；实现前得到预期 RED：self-test `FAIL (23)`、exit `1`。
- 首次 GREEN 尝试发现自测假 fetch 没有活动句柄，而 `AbortSignal.timeout()` 内部 timer 为 unref，导致 Node 在 790ms 提前 exit `0` 且未执行断言/写结果。修正仅限自测夹具：增加 1 秒保活 timer，并在 abort 时清除。
- 最终将三处 fetch 全部替换为 10 秒 `fetchWithTimeout()` 后完整重跑：self-test `23/23`、运行期 `28/28`、9 张截图、端口/profile cleanup 全绿，exit `0`；结果记录 `http.fetchTimeoutMs: 10000`。

## 公开发布复验

- 发布身份：`main` `9e063c8`；`gh-pages` 完整提交 `9f7844863443d084d23425d77a0940f99b5a61bc`，用户确认 Pages build 为 `built`；复验 URL 为 `https://sherlock3rd.github.io/DobeDemo/?release=9f78448`。
- 无缓存真实 HTTP：HTML `200`（415 bytes）、当前 JS `/DobeDemo/assets/index-781xcY6f.js` `200`（1,220,278 bytes）、当前 CSS `/DobeDemo/assets/index-CoMhGqEJ.css` `200`（25,511 bytes）；HTML 中仅有这两个 `/DobeDemo/` asset 引用且名称精确匹配。
- `.superpowers/sdd/clubhouse-direct-upgrade-public-cdp.mjs` 使用独立 fresh profile、Chrome port 0 与该 profile 的 `DevToolsActivePort`；HTTP/CDP 请求和 WebSocket 建连均为 10 秒有限超时，socket 失败拒绝并清空 pending。
- spawn `error` listener 在 PID/活性检查前注册；cleanup 只允许终止本轮登记且仍 active 的 Chrome `ChildProcess`，失活或无 PID 对象安全跳过；临时 profile 只在完整前缀校验后有限重试删除。
- self-test 真实覆盖 CDP timeout 清 pending、socket close、WebSocket 建连 timeout/listener 清理、HTTP AbortSignal timeout、inactive child 跳过、spawn error 脱敏、写盘失败脱敏、统一顶层 catch/finally/write 边界及 HTTP/child 调用结构。
- JSON 与 stderr 统一只保留白名单 error name/code；结果不含绝对路径、raw message 或 stack。截图证据只记录 basename、尺寸、bytes、SHA-256；任一断言、截图、运行、写盘或 teardown 失败均非零退出。
- fresh profile 通过 document-start seed 预置 city persist v4、钱包 `100000/0/0`、帮派声望 `1170`。真实扫描开 Clubhouse 时仅出现合法挂机增量 `3/1/1` 和声望 `+1`；面板 `radio/radiogroup/progressbar/child/shared/confirm` 全为 `0`。
- 第一次真实 `Input.dispatchMouseEvent` 点击使 Clubhouse `Lv.1→Lv.2`，钱包 `100003/1/1→99978/1/1`，精确扣 `25/0/0`，10 个 children 全 0，无确认页；刷新后仍为 v4/Lv.2、children 全 0、钱包保持 `99978/1/1`。
- 移动 `390×844` 无页面或面板横向溢出，面板可滚动/可容纳；直接升级按钮 `324×44`，双轴均不小于 44px 且完整位于视口。
- 三张真实 PNG 均非空且结果脱敏：desktop-before `1440×900 / 128457 bytes`、desktop-after `1440×900 / 129076 bytes`、mobile `390×844 / 70613 bytes`；对应 SHA-256 已写入公开结果 JSON。

### 公开运行与重试记录

- 第 1 次真实公开 CDP：self-test `27/27`；运行 `14/16`，exit `1`。HTTP、资产、真实点击精确扣费、无确认、children、移动布局、截图与全部 teardown 均通过；两项失败来自验收断言错误地要求扫描和刷新期间钱包/声望绝对不增长，忽略合法 `3/1/1` 生产 tick 与 `+1` 声望。
- 修正只涉及验收证据：显式记录 seed 的 v4/1170/`100000/0/0`，fresh 观察值只允许符合 `钱=油×3、物资=油` 的非负生产；点击扣费仍用点击前后钱包精确断言 `25/0/0`；刷新只允许同样比例的合法非负生产。
- 一次复跑组合命令在 Windows PowerShell 解析阶段因不支持 `&&` 退出 `1`，脚本未启动、没有 Chrome 或 CDP 副作用；随后将格式化、语法检查与运行拆为独立命令。
- 第 2 次真实公开 CDP：self-test `27/27`、运行 `16/16`、三张截图、CDP 端口释放与临时 profile 删除全部通过，exit `0`。父流程随后用独立 fresh profile 再完整复跑一次，同样为 `27/27`、`16/16`、exit `0`；产品源码无需修改。

## 命令

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
node .superpowers/sdd/clubhouse-direct-upgrade-cdp.mjs
node .superpowers/sdd/clubhouse-direct-upgrade-public-cdp.mjs
```

本报告记录用户提供的已发布 commit/build 身份与本轮公开站点真实复验；本轮没有执行 commit、push 或 GitHub Pages 发布。
