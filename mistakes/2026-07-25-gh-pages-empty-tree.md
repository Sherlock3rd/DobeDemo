# 临时 Git index 发布出空的 gh-pages 树

## 现象

使用独立 `GIT_INDEX_FILE` 和临时发布目录生成 `gh-pages` 提交时，命令全部返回成功，GitHub Pages 构建也显示 `built`，但公开站点返回 404；检查发布提交发现其 tree 为空，不包含根目录 `index.html`。

## 原因

旧版 Cygwin Git 在仓库根目录执行 `git --work-tree=<临时目录> add -A` 时，当前路径前缀仍按原工作区解析，没有把临时工作树中的文件加入独立 index。由于空 index 仍可成功执行 `write-tree` 和 `commit-tree`，发布流程没有在推送前发现缺失文件。

## 修复

进入临时发布目录后，将 `GIT_DIR` 指向原仓库 `.git`、`GIT_WORK_TREE` 指向当前目录、`GIT_INDEX_FILE` 指向工作区内的相对临时 index，再执行 `read-tree --empty` 和 `git add -A -- .`。生成提交前强制检查 index 必须包含 `index.html`、预期 JS 与 CSS 资产；随后以空树提交为父节点追加纠正提交并推送。

## 防呆

- 临时 index 发布必须从临时工作树目录内执行 `git add -A -- .`。
- 推送前使用 `git ls-files` 或 `git ls-tree` 明确验证根 `index.html` 和当前构建资产存在。
- Pages 显示 `built` 不代表站点内容完整；还必须检查公开 HTML、JS、CSS 均返回 HTTP 200，且 HTML 引用了预期资产。
- 临时目录和 index 仅在验证目标位于工作区后删除。

## 验证

纠正提交 `312ac281e4f24b99a341a1c85d64582c48cdbffe` 的发布 index 包含 `index.html`、`assets/index-0UEHpLsB.js` 和 `assets/index-CoMhGqEJ.css`。GitHub Pages 构建状态为 `built`，公开首页及两项资产均返回 HTTP 200。