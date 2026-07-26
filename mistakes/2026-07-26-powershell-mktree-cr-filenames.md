# PowerShell 管道向 Git mktree 注入回车文件名

## 现象

首次推送的新 `gh-pages` 提交构建状态为 `built`，但公开入口和新 JavaScript 资源返回 404；分支树中实际出现了 `"index.html\r"` 与 `"assets/index-ESOJcvxK.js\r"`。

## 原因

PowerShell 将拼接好的 `git mktree` 文本通过管道传入 Git 时使用 CRLF。每棵树的最后一条记录末尾回车没有被 `mktree` 当作行结束符剥离，而是进入了 Git 文件名。

## 修复

使用 Git Bash 的 `printf` 生成纯 LF 的 `mktree` 输入，重新创建根树和资源树并推送修复提交；随后先用 `git ls-tree -r --name-only origin/gh-pages` 核对三个路径，再等待 Pages 构建。

## 防呆

- Windows 下不得用 PowerShell 文本管道直接构造 `git mktree` 输入。
- `gh-pages` 推送后、等待 Pages 构建前，必须先执行 `git ls-tree -r --name-only origin/gh-pages`，确认路径不存在引号、`\r` 或其他异常字符。
- Pages 显示 `built` 不代表产物路径正确，仍需验证公开 HTML、JS 和 CSS 均为 HTTP 200。

## 验证

修复后的分支只包含 `index.html`、`assets/index-ESOJcvxK.js` 和 `assets/index-ClP-UoQ0.css` 三个规范路径；待新 Pages 构建完成后再次检查公开资源。
