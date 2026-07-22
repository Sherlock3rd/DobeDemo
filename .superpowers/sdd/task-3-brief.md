# Task 3：以 TDD 实现共享 Demo 状态

## 项目背景

Vite、TypeScript、Vitest 与 Zustand 已安装配置。本任务只实现跨场景与 HUD 共享的暂停状态。

## 全局约束

- 工作区：`d:\charlie\dobe demo`
- 不初始化 Git，不执行 Git 提交。
- 不配置飞书 CLI。
- 严格执行红—绿—重构：生产代码之前先写测试并亲眼确认测试因模块缺失而失败。
- 不创建 HUD、3D 场景、错误边界或应用入口。

## 文件

- 创建 `src/store/useDemoStore.test.ts`
- 创建 `src/store/useDemoStore.ts`

## 接口

导出 Zustand hook：

```ts
interface DemoState {
  isPaused: boolean
  togglePaused: () => void
  reset: () => void
}

export const useDemoStore
```

初始 `isPaused` 为 `false`；`togglePaused()` 每次反转状态；`reset()` 恢复 `false`。

## RED

先只创建测试：

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useDemoStore } from './useDemoStore'

describe('useDemoStore', () => {
  beforeEach(() => useDemoStore.getState().reset())

  it('toggles the paused state', () => {
    expect(useDemoStore.getState().isPaused).toBe(false)
    useDemoStore.getState().togglePaused()
    expect(useDemoStore.getState().isPaused).toBe(true)
  })
})
```

运行：

```powershell
npm test -- src/store/useDemoStore.test.ts
```

确认失败原因是 `./useDemoStore` 不存在。报告中记录 RED 的命令、退出码和核心失败消息。

## GREEN

然后创建最小实现：

```ts
import { create } from 'zustand'

interface DemoState {
  isPaused: boolean
  togglePaused: () => void
  reset: () => void
}

export const useDemoStore = create<DemoState>((set) => ({
  isPaused: false,
  togglePaused: () => set((state) => ({ isPaused: !state.isPaused })),
  reset: () => set({ isPaused: false }),
}))
```

再次运行同一测试，必须通过。随后运行 `npm run typecheck` 和 `npm run lint`，均须通过。

## 报告

写入 `.superpowers/sdd/task-3-report.md`：

- 状态
- 创建文件
- RED 命令、退出码、预期失败证据
- GREEN 命令、退出码、通过数量
- typecheck 与 lint 结果
- 自审及关注事项

最终回复只返回状态、一行测试摘要和关注事项。
