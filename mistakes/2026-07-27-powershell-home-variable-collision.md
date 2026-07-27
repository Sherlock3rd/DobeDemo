# PowerShell 变量名与只读 HOME 冲突

## 现象

GitHub Pages 公网验收脚本把首页响应保存到 `$home`。PowerShell 变量名不区分大小写，因此它与只读的 `$HOME` 是同一个变量，赋值立即失败；后续脚本错误地读取了系统主目录字符串，导致 JS/CSS 地址为空并产生无意义的 404。

## 原因

验收脚本使用了过于通用的变量名，没有遵守工程规则中“不得复用 `$HOME`、`$home` 或 `$CODEX_HOME`”的约束，也没有在脚本开头把错误设为立即终止。

## 修复

将变量改为任务专用的 `$pageResponse`、`$pageBaseUrl`、`$pageJsResponse` 等名称，并设置 `$ErrorActionPreference = 'Stop'`。重新执行后，公开首页、当前 JS/CSS 与头像图集均返回 HTTP 200，五项目标文案全部存在于线上 JS。

## 防呆

- PowerShell 变量名按不区分大小写处理，任何 `$home` 变体都视为 `$HOME`。
- 所有临时变量使用任务域前缀，例如 `$page*`、`$deploy*`、`$verify*`。
- 多步骤验收脚本必须设置 `$ErrorActionPreference = 'Stop'`，避免前置失败后继续输出误导性结果。
- 公网验收同时检查状态码、HTML 引用的实际资产路径和目标功能文案。
