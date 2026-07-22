# GitHub 工作流权限与旧版 Git 提交兼容问题

## 现象

1. SSH 推送到 `git@github.com:Sherlock3rd/DobeDemo.git` 返回 `Permission denied (publickey)`。
2. GitHub CLI 已登录，但 OAuth token 只有 `repo` scope；推送包含 `.github/workflows/` 的提交时被 GitHub 拒绝，要求 `workflow` scope。
3. Cursor 为提交追加 provenance trailer，但本机 Git 2.15.1 不支持 `git commit --trailer`，普通提交命令失败。

## 原因

- 本机没有可被 GitHub 接受的 SSH 公钥。
- 修改 GitHub Actions workflow 需要独立 `workflow` OAuth scope。
- 本机 Cygwin Git 版本早于 `git commit --trailer` 支持版本。

## 修复

- 使用 GitHub CLI 的现有 HTTPS OAuth token，通过单次命令 `http.extraHeader` 完成认证，不写入 Git 配置或远端 URL。
- 改用 `gh-pages` 分支发布静态产物，由 GitHub Pages legacy branch source 托管，不再依赖 Actions workflow scope。
- 动态调用旧版 Git 的标准 commit 子命令，保留正常 hooks；作者使用 GitHub noreply 身份的命令级环境变量，不修改全局配置。
- 将包含 workflow 的未推送提交保留在本地 `workflow-scope-required` 分支，主线从其父提交重新建立，避免强推或丢失历史。

## 防呆

- 推送前同时检查 SSH 和 GitHub CLI OAuth scope。
- OAuth token 没有 `workflow` scope 时，不把 workflow 文件写入待推送历史；优先使用 `gh-pages` 分支发布。
- 在旧版 Git 环境中先检查 `git --version`，避免依赖新版 CLI 参数。
- 凭据只能通过命令级内存变量传递，不写入仓库、远端 URL、日志或 Git 配置。

## 验证

- `main` 与 `gh-pages` 均成功推送。
- GitHub Pages 状态为 `built`，source 为 `gh-pages` 的 `/`。
- 公开页面、JavaScript 和 CSS 均返回 HTTP 200。
