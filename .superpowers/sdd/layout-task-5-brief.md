# Layout Task 5：完整回归、浏览器验收与记录

## 范围

工作区：`d:\charlie\dobe demo`。Task1–4 已完成。本任务只做最终自动化、真实浏览器手势验证、截图和文档记录；遇到真实验收失败可做最小修复并补测试。不得 commit/push/修改远端 Pages。

## 自动化

依次运行并记录完整结果：

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

预期当前基线至少 26 个测试文件、278 项测试。构建的 chunk size warning 不算失败，但必须记录。

## HTTP

- 启动前检查 terminals 与目标端口，禁止误杀用户进程。
- 使用空闲固定端口（优先 5177）：

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5177 --strictPort
```

- 验证 HTTP 200、`#root`、`/src/main.tsx`。
- 验收结束后停止本任务完整进程树，确认端口释放。

## Chrome/CDP 验收

使用独立临时 profile 和 DevTools 端口，不污染用户浏览器。

1. 1440×900 加载本地页面，清除 `gang-progression-v1` 并刷新。
2. 截图到 `.superpowers/sdd/layout-pan-drag-screenshot.png`。
3. 人工读取截图确认：
   - 六个建筑/锁定地块区域均在道路外。
   - 中央十字路和两条支路连续。
   - 河流、仓库、树、车辆无明显压房。
4. 左键 PAN：
   - 截图/像素证据记录 drag 前后画面变化。
   - 鼠标 down→move 大于6px→up。
5. 右键 PAN：同样证明画面变化。
6. 单指 PAN：
   - 启用触摸事件或通过 CDP `Input.dispatchTouchEvent`。
   - touchStart→touchMove→touchEnd 后画面必须变化。
7. Click 抑制：
   - 在 Canvas 上寻找一个可点击建筑坐标；普通 click 后 DOM 出现 `.building-panel`。
   - 关闭面板。
   - 从同一建筑区域拖动大于6px，结束后 `.building-panel` 不出现。
   - 如 3D 坐标因镜头变化，允许刷新恢复后再验证。

若 headless 环境确实无法生成触摸/真实 raycast，必须报告具体命令与限制；但左键拖动和截图是硬验收。

## 文档

修改 `README.md`：

- 操作改为“左键/右键按住拖动平移；单指拖动平移；滚轮/双指缩放”。

修改 `session/requirements/gang-tree-idle-unlocks.md`：

- 新增布局 AABB 间距矩阵验收。
- 新增长按拖动与误点击抑制验收。
- 更新测试文件/测试项实际数字。

修改 `session/session.md`：

- 新增城市严格重排和输入手势记录。

创建 `.superpowers/sdd/layout-pan-drag-report.md`：

- 根因
- 变更文件
- RED/GREEN
- 最终坐标和安全间距
- 自动化
- HTTP
- 浏览器手势证据
- 截图
- 未 commit/push，Pages 尚未更新

更新 `.superpowers/sdd/layout-progress.md` Task5。

## 最终检查

文档写完后重新运行：

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

最终只返回状态、真实命令结果、浏览器验收结果、关注事项。
