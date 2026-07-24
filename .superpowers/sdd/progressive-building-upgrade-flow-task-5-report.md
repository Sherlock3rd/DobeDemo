# 渐进式建筑升级流程 Task 5 报告

## 状态

已完成 Task 5：设置面板新增可重复的“解锁帮派树”和“钱/油/物资各 +10000”即时动作，保留独立的账号重置二次确认流程。

## TDD 证据

### RED

- 协调器测试命令：
  `npm.cmd test -- src/game/debugActions.test.ts src/store/useGangStore.test.ts src/store/useCityStore.test.ts`
- 结果：退出码 1。`debugActions` 模块不存在，`unlockForDebug` 不存在；失败原因与待实现接口一致。
- 设置面板测试命令：
  `npm.cmd test -- src/ui/SettingsPanel.test.tsx src/App.test.tsx`
- 结果：退出码 1。三个测试均因找不到“解锁帮派树”或“钱/油/物资各 +10000”按钮而失败。

### GREEN

- Task 5 目标测试：
  `npm.cmd test -- src/game/debugActions.test.ts src/store/useGangStore.test.ts src/store/useCityStore.test.ts src/ui/SettingsPanel.test.tsx src/App.test.tsx`
- 结果：5 个测试文件、58 个测试全部通过。
- 完整门禁：
  - `npm.cmd test`：38 个测试文件、478 个测试全部通过。
  - `npm.cmd run typecheck`：退出码 0。
  - `npm.cmd run lint`：退出码 0。
  - `npm.cmd run format:check`：退出码 0。

## 变更文件

- `src/game/debugActions.ts`
- `src/game/debugActions.test.ts`
- `src/store/useGangStore.ts`
- `src/store/useGangStore.test.ts`
- `src/store/useCityStore.test.ts`
- `src/ui/SettingsPanel.tsx`
- `src/ui/SettingsPanel.test.tsx`
- `src/App.css`
- `src/App.test.tsx`

## 提交

- 实现提交：`a7ed3029132576b406f7def63175ce8d67017ff2`
- 提交说明：`feat: add repeatable debug progression controls`

## 自审

- 解锁协调器对合法调用只读取一次传入的 `now`，严格先执行
  `city.syncResourceProduction(now, 50)`，再执行
  `gang.unlockForDebug(now)`。
- 首次解锁只按旧生产者结算；新生产者从同一 `now` 开始，重复点击同一时刻不增加资源，帮派保持 Lv.50 对应的 1470 声望。
- 非有限时间在协调器入口返回 `false`，两个 Store 均不改变。
- 资源动作复用 City Store 单次原子 `set`，先结算再给三种资源各加 10000，并通过安全加法饱和至 `Number.MAX_SAFE_INTEGER`。
- 两个按钮即时执行、不关闭面板、不进入重置确认；成功文案由
  `aria-live="polite"` 发布。
- 调试反馈仅为 SettingsPanel 本地状态，未加入任何持久化对象。
- 重置账号仍要求第二次确认，并仅在确认后关闭面板。
- 未修改建筑升级规则、生产公式或 3D 渲染规则。

## Concerns

- 工作区在本任务开始前已有大量与 Task 5 无关的未提交修改；实现提交仅包含上述 9 个 Task 5 文件，未纳入其他改动。
- 当前 Git 版本不支持提交工具注入的 `--trailer` 选项；常规提交失败后未 amend，改用 Git plumbing 写入提交对象并原子更新 `HEAD`。
