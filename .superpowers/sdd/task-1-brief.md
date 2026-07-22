# Task 1：初始化项目治理文档

## 项目背景

这是一个用于游戏策划快速迭代的 Web 3D 游戏 Demo 工作区。用户角色为游戏策划/制作人，助手角色为 Demo 技术负责人。

## 全局约束

- 运行平台为 Windows PowerShell。
- 所有回复以 `you majesty` 开头。
- 不初始化 Git，不执行 Git 提交。
- 不配置飞书 CLI，不执行飞书写入。
- 不实现具体游戏机制或正式美术内容。

## 需要创建

- `rules/rules.md`
- `session/session.md`
- `session/requirements/web-3d-demo-environment.md`
- `mistakes/README.md`
- `docs/beagle_glossary.md`

## 需要移动

- `rules-bootstrap-spec.md` → `spec/rules-bootstrap-spec.md`
- `feishu-cli-deployment-and-doc-ops-spec.md` → `spec/feishu-cli-deployment-and-doc-ops-spec.md`
- `feishu-document-writing-special-flow-spec.md` → `spec/feishu-document-writing-special-flow-spec.md`

移动时必须保留原始内容，根目录不再保留旧副本。

## 内容要求

`rules/rules.md` 必须明确：

- 用户与助手角色。
- `you majesty` 回复前缀。
- 设计变更必须先获得用户书面确认。
- 开始新任务前检查相关错题记录。
- 非设计性文档与脚手架变更可直接执行，但必须更新 session。
- 发生飞书写入时，必须先读取项目规则、相关错题、两份飞书规范和对应 lark skill。

`session/session.md` 必须记录当前目标、当前状态“实施中”、角色和变更总账。

`session/requirements/web-3d-demo-environment.md` 必须记录已确认技术栈、范围、非目标、验收条件和当前状态“实施中”。

`mistakes/README.md` 必须提供包含“现象、原因、修复、防呆、验证”的记录模板。

`docs/beagle_glossary.md` 至少定义“Demo”“场景”“HUD”“游戏状态”，并说明新增术语时维护此文件。

## 验证

确认上述五份新文件与 `spec/` 下三份规范全部存在且非空，并确认根目录不再残留三份原始规范。不要修改设计文档和实施计划。

## 报告

将完整执行报告写入 `.superpowers/sdd/task-1-report.md`，包含：

- 状态：DONE、DONE_WITH_CONCERNS、NEEDS_CONTEXT 或 BLOCKED
- 创建和移动的文件
- 验证方法与结果
- 自审结论
- 关注事项

最终回复只返回状态、一行验证摘要和关注事项。
