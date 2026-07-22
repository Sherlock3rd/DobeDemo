# GitHub Pages 发布设计

## 目标

将完整工业城市帮派树 Demo 提交到 `git@github.com:Sherlock3rd/DobeDemo.git`，通过 GitHub Pages 提供可直接访问的公开体验地址：

`https://sherlock3rd.github.io/DobeDemo/`

## 发布方案

- 使用 GitHub Actions 官方 Pages 流程部署 `dist/`。
- `main` 分支 push 或手动触发工作流时执行：
  1. checkout
  2. Node.js 22 + `npm ci`
  3. `npm run build`
  4. 上传 `dist/`
  5. 部署 GitHub Pages
- Vite 在 build 命令中使用 `/DobeDemo/` base，本地开发继续使用 `/`。
- README 使用简体中文，包含在线地址、截图、功能、操作、挂机规则、技术栈、本地开发、测试与部署说明。

## Git 提交策略

为避免单次提交过大并提高可审查性，首次提交拆为：

1. 工程配置与项目治理文档。
2. 游戏规则、store 与测试。
3. 3D 场景、UI、应用样式与测试。
4. 示例图片、验收截图与 SDD 报告。
5. README、Pages 工作流与发布配置。

`node_modules/`、`dist/`、覆盖率、日志和临时文件继续由 `.gitignore` 排除。

## 验证

- 本地完整执行 format check、typecheck、lint、182 项测试和普通 build。
- 构建并确认 `dist/index.html` 的资源 URL 带 `/DobeDemo/`。
- 推送后检查 GitHub Actions Pages workflow 成功。
- 请求公开地址并确认 HTTP 200 与页面标题/入口存在。
