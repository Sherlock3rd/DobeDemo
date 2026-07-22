# PowerShell 与旧版 Git 初始化命令不兼容

## 现象

在 Windows PowerShell 中执行包含 `&&` 的 Git 初始化命令时，PowerShell 报告 `&&` 不是有效语句分隔符。改为顺序执行后，`git init -b main` 又报告 `unknown switch 'b'`。

## 原因

- 当前 Windows PowerShell 版本不支持 `&&`。
- 当前 Git 版本较旧，不支持 `git init -b`。

## 修复

- 使用 `$LASTEXITCODE` 在每条命令后显式检查退出码。
- 使用 `git init` 初始化，再执行 `git symbolic-ref HEAD refs/heads/main` 设置默认分支。

## 防呆

- 本项目 PowerShell 命令不得使用 `&&`。
- 初始化仓库前先考虑旧版 Git 兼容性；默认使用 `git init` + `git symbolic-ref`。
- 不修改全局 Git 配置来绕过版本问题。

## 验证

仓库成功初始化，`main` 正确跟踪 `origin/main`，远端历史被保留。
