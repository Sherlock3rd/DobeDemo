# 旧版 Git 不支持 `branch --show-current`

## 现象

在本仓库执行 `git branch --show-current` 时返回 `error: unknown option 'show-current'`。

## 原因

当前环境使用 Git 2.15；`git branch --show-current` 是后续版本才提供的参数。

## 修复

改用兼容旧版 Git 的 `git symbolic-ref --short HEAD` 读取当前分支。

## 防呆

- 本仓库的发布脚本和人工检查不要使用 `git branch --show-current`。
- 需要读取当前分支时统一使用 `git symbolic-ref --short HEAD`。

## 验证

`git symbolic-ref --short HEAD` 正常输出 `main`。
