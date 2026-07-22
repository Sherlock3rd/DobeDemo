# Task 4：以 TDD 实现 HUD 与基础 3D 场景

## 项目背景

共享 Zustand 状态 `useDemoStore` 已完成。该 hook 提供 `isPaused`、`togglePaused()` 与 `reset()`。本任务实现用户可操作的 HUD 和基础 R3F 场景组件，但不组装应用入口或全局样式。

## 全局约束

- 工作区：`d:\charlie\dobe demo`
- 不初始化 Git，不执行 Git 提交。
- 不配置飞书 CLI。
- HUD 必须严格执行 RED→GREEN；先运行并记录因模块缺失产生的失败，再创建实现。
- 不创建错误边界、`App.tsx`、`main.tsx` 或 CSS。

## 文件

- 创建 `src/ui/DemoHud.test.tsx`
- 创建 `src/ui/DemoHud.tsx`
- 创建 `src/scene/RotatingCube.tsx`
- 创建 `src/scene/DemoScene.tsx`

## 接口

- `DemoHud(): JSX.Element`
- `RotatingCube(): JSX.Element`
- `DemoScene(): JSX.Element`
- 消费 `useDemoStore`

## HUD RED

先创建：

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDemoStore } from '../store/useDemoStore'
import { DemoHud } from './DemoHud'

describe('DemoHud', () => {
  beforeEach(() => useDemoStore.getState().reset())

  it('toggles the demo pause state', async () => {
    const user = userEvent.setup()
    render(<DemoHud />)
    await user.click(screen.getByRole('button', { name: '暂停 Demo' }))
    expect(screen.getByRole('button', { name: '继续 Demo' })).toBeInTheDocument()
  })
})
```

运行 `npm test -- src/ui/DemoHud.test.tsx`，确认因 `DemoHud` 模块不存在而失败，记录退出码和核心错误。

## HUD GREEN

实现 HUD：

- 标题：`Web 3D Demo Workspace`
- 状态标签：未暂停时 `运行中`，暂停时 `已暂停`
- 按钮：未暂停时可见文本与 aria-label 均为 `暂停 Demo`；暂停时均为 `继续 Demo`
- 点击调用 `togglePaused`
- 使用语义明确的容器、标题、状态与 button；className 供 Task 6 样式使用

运行相同测试并确认通过。

## 基础 3D 场景

`RotatingCube.tsx`：

- 使用 `useRef<THREE.Mesh>` 引用 mesh。
- 使用 `useFrame`；仅当 `isPaused === false` 时更新 x/y rotation。
- 使用 delta 做帧率无关旋转。
- box geometry 和明亮黄色标准材质。

`DemoScene.tsx`：

- 环境光。
- 能照亮物体的方向光。
- 地面 plane，旋转为水平并可接收阴影。
- `RotatingCube`。
- Drei `OrbitControls`。
- 本组件不创建 Canvas；Canvas 和相机位置由 Task 6 的应用外壳配置为 `[4, 3, 6]`。

场景部分属于声明式渲染脚手架；本任务不新增 WebGL 测试依赖。必须通过 TypeScript 与 ESLint 静态验证。

## 验证

运行并记录：

```powershell
npm test -- src/ui/DemoHud.test.tsx
npm test
npm run typecheck
npm run lint
```

全部必须通过且无测试警告。

## 报告

写入 `.superpowers/sdd/task-4-report.md`：

- 状态和文件
- RED 命令、退出码、预期失败
- GREEN 与全套测试数量
- typecheck、lint 结果
- 场景实现摘要、自审和关注事项

最终回复只返回状态、一行验证摘要和关注事项。
