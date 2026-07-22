# GitHub Pages 发布报告

## 仓库与在线地址

- 仓库：`https://github.com/Sherlock3rd/DobeDemo`
- 主分支：`main`
- Pages 分支：`gh-pages`
- 在线体验：`https://sherlock3rd.github.io/DobeDemo/`

## 主线分段提交

1. `cdecdfa chore: establish project tooling`
2. `911abe4 feat: add gang progression and city rules`
3. `05304b4 feat: build the interactive industrial city`
4. `2d12234 docs: record design and verification history`
5. `d34d654 assets: add visual references and demo captures`
6. `157ff8a ci: prepare the demo for GitHub Pages`

远端原有 `7161fc0 Initial commit` 被完整保留。

## 文件大小控制

- `node_modules/`、`dist/`、coverage、日志和临时文件均被忽略。
- 二进制图片独立提交。
- 最大单文件为 `example/cityview.jpg`，约 2.75 MB，远低于 GitHub 100 MB 单文件限制。
- 生产 JS 只存在于独立 `gh-pages` 产物分支，不混入主线源码提交。

## 发布方式

本机 SSH 公钥不可用，GitHub CLI OAuth token 又缺少修改 workflow 所需的 `workflow` scope，因此采用不需要额外授权的标准分支发布：

1. Vite build base 为 `/DobeDemo/`。
2. 使用独立 Git index 将 `dist/` 生成一个只含 `index.html`、CSS 和 JS 的 Pages 提交。
3. 推送 `gh-pages`。
4. GitHub Pages source 自动识别为 `gh-pages` 根目录。

没有把 token 写入远端 URL、Git 配置、文件或日志。

## 验证

- format check：通过。
- typecheck：通过。
- ESLint：通过。
- Vitest：17 个文件、182 项通过。
- Vite build：通过，592 个模块转换完成。
- `dist/index.html` 资源路径：
  - `/DobeDemo/assets/index-DrVa3SMQ.js`
  - `/DobeDemo/assets/index-DuBiQJJE.css`
- GitHub Pages 状态：`built`。
- 公开页面：HTTP 200。
- 公开 JavaScript：HTTP 200。
- 公开 CSS：HTTP 200。
- 远程页面实际渲染 Lv.1、Prospect（见习）、声望进度与帮派树入口。

## 关注事项

- `workflow-scope-required` 是本地保留的未推送诊断分支，不影响 `main` 或 Pages。
- 构建存在单个 JS chunk 大于 500 kB 的非阻断警告。
