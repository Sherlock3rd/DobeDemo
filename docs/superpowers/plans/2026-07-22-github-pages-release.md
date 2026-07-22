# GitHub Pages Release Implementation Plan

**Goal:** 将工业城市帮派树 Demo 分段提交到 GitHub，并发布为可直接体验的 GitHub Pages。

**Architecture:** Vite 根据 GitHub Actions 环境切换仓库子路径 base；官方 Pages workflow 构建并发布 `dist/`。首次仓库历史按配置、逻辑、界面、证据、发布五组提交。

## Task 1：发布配置与 README

- 创建根目录 `README.md`。
- 修改 `vite.config.ts`，Actions 构建使用 `/DobeDemo/`。
- 创建 `.github/workflows/deploy-pages.yml`。
- 更新 session 发布记录。

## Task 2：本地验证

- 运行格式、类型、Lint、测试、普通构建。
- 执行生产构建。
- 确认生成资源路径含 `/DobeDemo/`。

## Task 3：分段 Git 提交

- 初始化 `main` 分支。
- 添加 SSH remote。
- 检查 ignored/untracked 文件与大文件风险。
- 分五组提交，每组提交后检查状态。

## Task 4：推送与 Pages 验证

- 推送 `main` 到 `origin`。
- 使用 GitHub CLI 检查仓库、workflow 与 Pages 配置。
- 等待 deploy workflow 完成。
- 验证公开 URL HTTP 200。
