# 配件部位改名遗漏挂机控制器测试夹具

## 现象

将配件部位从 `engine/armor/tires/turbo` 重构为固定的
`tires/engine/bumper/suspension` 后，配件进度、Store、迁移和英雄界面定向测试均通过，
但全量测试中的 `PartSalvageController.test.tsx` 仍期望首个确定性掉落为 `engine`，
实际新序列首件已是 `tires`。

## 原因

首轮检索只覆盖了旧的 `armor/turbo` 字段和主要配件测试，没有同时检索所有
`part-1` 确定性掉落夹具。挂机控制器通过 Store 间接消费掉落序列，因此未出现在旧部位名
的重点检索结果中。

## 修复

将挂机控制器首件掉落断言同步为 `tires`，随后重新执行全量测试。

## 防呆

- 调整确定性生成序列时，同时检索序列值、实例 ID（如 `part-1`）和所有消费该生成器的控制器测试。
- 定向测试通过后必须继续执行全量测试，不能用核心模块测试替代。

## 验证

`PartSalvageController.test.tsx` 与全量 Vitest 均通过。
