# Web 3D Demo Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一个可启动、可测试、可生产构建的 React Three Fiber Web 3D 游戏 Demo 工作区。

**Architecture:** Vite 提供开发与构建工具，React 负责应用外壳和 HUD，React Three Fiber 与 Drei 负责 3D 场景。玩法与状态保持为独立 TypeScript 单元；Zustand 仅管理跨组件状态，错误边界保护应用外壳。

**Tech Stack:** Vite、React、TypeScript、Three.js、React Three Fiber、Drei、Zustand、Vitest、React Testing Library、ESLint、Prettier

## Global Constraints

- 运行平台为 Windows PowerShell。
- 用户角色为游戏策划/制作人，助手角色为 Demo 技术负责人。
- 所有回复以 `you majesty` 开头。
- 不初始化 Git，不执行 Git 提交。
- 不配置飞书 CLI，不执行飞书写入。
- 不实现具体游戏机制或正式美术内容。
- 新依赖使用 npm 安装当前最新版，不手写虚构版本号。

---

## File Map

- `package.json`：依赖、开发、检查、测试与构建命令。
- `tsconfig.json`、`tsconfig.app.json`、`tsconfig.node.json`：严格 TypeScript 配置。
- `vite.config.ts`：Vite 与 Vitest 的浏览器模拟环境配置。
- `eslint.config.js`、`.prettierrc.json`、`.gitignore`：代码质量与本地产物规则。
- `index.html`、`src/main.tsx`：浏览器入口。
- `src/App.tsx`、`src/App.css`、`src/index.css`：应用外壳和视觉布局。
- `src/scene/DemoScene.tsx`：灯光、地面、相机控制和示例物体。
- `src/scene/RotatingCube.tsx`：独立的逐帧旋转示例对象。
- `src/store/useDemoStore.ts`：跨场景与 HUD 共享的暂停状态。
- `src/ui/DemoHud.tsx`：Demo 状态与暂停控制。
- `src/ui/AppErrorBoundary.tsx`：React 渲染错误回退。
- `src/test/setup.ts`：测试环境扩展。
- `src/store/useDemoStore.test.ts`：状态行为测试。
- `src/ui/DemoHud.test.tsx`：HUD 交互测试。
- `src/ui/AppErrorBoundary.test.tsx`：错误回退测试。
- `rules/rules.md`：项目执行规则。
- `session/session.md`：全局状态与变更总账。
- `session/requirements/web-3d-demo-environment.md`：本需求状态。
- `mistakes/README.md`：错题记录模板。
- `docs/beagle_glossary.md`：项目术语单点引用。
- `spec/*.md`：现有规范归档。

### Task 1: 初始化项目治理文档

**Files:**
- Create: `rules/rules.md`
- Create: `session/session.md`
- Create: `session/requirements/web-3d-demo-environment.md`
- Create: `mistakes/README.md`
- Create: `docs/beagle_glossary.md`
- Move: `rules-bootstrap-spec.md` → `spec/rules-bootstrap-spec.md`
- Move: `feishu-cli-deployment-and-doc-ops-spec.md` → `spec/feishu-cli-deployment-and-doc-ops-spec.md`
- Move: `feishu-document-writing-special-flow-spec.md` → `spec/feishu-document-writing-special-flow-spec.md`

**Interfaces:**
- Produces: 后续任务必须遵循的规则、状态记录和规范路径。

- [ ] **Step 1: 创建目录并移动现有规范**

先确认父目录，再创建 `rules`、`session/requirements`、`mistakes`、`spec`；使用 PowerShell `Move-Item` 保留三份规范原文。

- [ ] **Step 2: 写入规则**

`rules/rules.md` 明确角色、`you majesty` 回复前缀、设计变更确认、错题复盘、session 更新和飞书写入前置规则。

- [ ] **Step 3: 写入状态、需求、错题模板和术语表**

需求状态标记为“实施中”；术语表至少定义“Demo”“场景”“HUD”“游戏状态”；错题模板包含现象、原因、修复、防呆和验证。

- [ ] **Step 4: 验证治理文件**

检查上述五份文件和 `spec/` 下三份规范全部存在，并确认工作区根目录不再残留三份原始规范。

Expected: 8 个目标文件均可读取，内容非空。

### Task 2: 建立 Vite、TypeScript 与质量工具配置

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `eslint.config.js`
- Create: `.prettierrc.json`
- Create: `.gitignore`
- Create: `src/test/setup.ts`

**Interfaces:**
- Produces: `npm run dev`、`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`、`npm run build`。

- [ ] **Step 1: 初始化 npm 并安装运行依赖**

Run:

```powershell
npm init -y
npm install react react-dom three @react-three/fiber @react-three/drei zustand
```

Expected: 命令退出码为 0，依赖写入 `package.json`。

- [ ] **Step 2: 安装开发依赖**

Run:

```powershell
npm install -D vite typescript @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh prettier @types/react @types/react-dom @types/three
```

Expected: 命令退出码为 0。

- [ ] **Step 3: 配置 package scripts**

`package.json` scripts 必须为：

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "typecheck": "tsc -b --pretty false",
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: 配置 Vite 与测试环境**

`vite.config.ts`：

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

`src/test/setup.ts`：

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: 配置严格 TypeScript、ESLint、Prettier 和忽略项**

启用 `strict`、`noUnusedLocals`、`noUnusedParameters` 和 `noFallthroughCasesInSwitch`。ESLint 使用 typescript-eslint 推荐配置及 React Hooks、React Refresh 插件；Prettier 使用单引号、无分号、尾逗号；忽略 `node_modules/`、`dist/`、覆盖率和临时文件。

- [ ] **Step 6: 验证基础配置**

Run:

```powershell
npm run typecheck
```

Expected: 若尚无应用入口，可只出现明确的入口缺失错误；不得出现配置语法错误。

### Task 3: 以测试驱动实现共享 Demo 状态

**Files:**
- Create: `src/store/useDemoStore.test.ts`
- Create: `src/store/useDemoStore.ts`

**Interfaces:**
- Produces: `useDemoStore`，状态接口 `{ isPaused: boolean; togglePaused(): void; reset(): void }`。

- [ ] **Step 1: 写失败测试**

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

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- src/store/useDemoStore.test.ts`

Expected: FAIL，原因是 `./useDemoStore` 尚不存在。

- [ ] **Step 3: 实现最小状态仓库**

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

- [ ] **Step 4: 运行测试并确认通过**

Run: `npm test -- src/store/useDemoStore.test.ts`

Expected: 1 test passed。

### Task 4: 以测试驱动实现 HUD 与基础 3D 场景

**Files:**
- Create: `src/ui/DemoHud.test.tsx`
- Create: `src/ui/DemoHud.tsx`
- Create: `src/scene/RotatingCube.tsx`
- Create: `src/scene/DemoScene.tsx`

**Interfaces:**
- Consumes: `useDemoStore`。
- Produces: `DemoHud(): JSX.Element`、`DemoScene(): JSX.Element`。

- [ ] **Step 1: 写 HUD 失败测试**

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

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- src/ui/DemoHud.test.tsx`

Expected: FAIL，原因是 `DemoHud` 尚不存在。

- [ ] **Step 3: 实现 HUD**

HUD 显示标题“Web 3D Demo Workspace”、状态“运行中/已暂停”和使用 `togglePaused` 的按钮；按钮的 aria-label 与可见文案保持一致。

- [ ] **Step 4: 实现示例场景**

`RotatingCube` 使用 `useFrame`，仅在 `isPaused === false` 时更新 mesh 的 x/y 旋转；材质使用明亮黄色。`DemoScene` 放置环境色光、方向光、地面、示例物体和 `OrbitControls`，相机位置为 `[4, 3, 6]`。

- [ ] **Step 5: 运行 HUD 测试**

Run: `npm test -- src/ui/DemoHud.test.tsx`

Expected: 1 test passed。

### Task 5: 以测试驱动实现应用错误边界

**Files:**
- Create: `src/ui/AppErrorBoundary.test.tsx`
- Create: `src/ui/AppErrorBoundary.tsx`

**Interfaces:**
- Produces: `AppErrorBoundary`，捕获子组件渲染错误并显示 `Demo 加载失败`。

- [ ] **Step 1: 写失败测试**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from './AppErrorBoundary'

function BrokenChild() {
  throw new Error('boom')
}

describe('AppErrorBoundary', () => {
  it('shows a readable fallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <AppErrorBoundary>
        <BrokenChild />
      </AppErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Demo 加载失败')
    vi.restoreAllMocks()
  })
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- src/ui/AppErrorBoundary.test.tsx`

Expected: FAIL，原因是错误边界尚不存在。

- [ ] **Step 3: 实现错误边界**

创建 React class component，状态为 `{ hasError: boolean }`；`getDerivedStateFromError()` 返回 `{ hasError: true }`；错误时渲染带 `role="alert"` 的回退区域，否则渲染 children。

- [ ] **Step 4: 运行测试并确认通过**

Run: `npm test -- src/ui/AppErrorBoundary.test.tsx`

Expected: 1 test passed。

### Task 6: 组装应用、样式与最终验证

**Files:**
- Create: `src/App.tsx`
- Create: `src/App.css`
- Create: `src/index.css`
- Create: `src/main.tsx`
- Modify: `session/session.md`
- Modify: `session/requirements/web-3d-demo-environment.md`

**Interfaces:**
- Consumes: `DemoScene`、`DemoHud`、`AppErrorBoundary`。
- Produces: 可在浏览器运行的完整 Demo 工作区。

- [ ] **Step 1: 创建应用入口**

`App` 使用 `AppErrorBoundary` 包裹全屏 `Canvas` 和 `DemoHud`；Canvas fallback 显示“正在加载 3D 场景…”。`main.tsx` 使用 `StrictMode` 和 `createRoot` 挂载 `App`。

- [ ] **Step 2: 创建响应式视觉样式**

页面采用深蓝黑背景、黄色强调色、全屏画布和左上角半透明 HUD；按钮必须有 hover、focus-visible 和 disabled 状态；小屏幕下 HUD 保持可读且不超出视口。

- [ ] **Step 3: 格式化代码**

Run: `npm run format`

Expected: Prettier 完成且退出码为 0。

- [ ] **Step 4: 运行自动化验证**

Run:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Expected: 所有命令退出码为 0，全部测试通过，`dist/` 成功生成。

- [ ] **Step 5: 启动开发服务器并做 HTTP 冒烟验证**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite 输出本地 URL；访问该 URL 返回 HTTP 200。确认后停止开发服务器。

- [ ] **Step 6: 更新项目状态**

在 `session/session.md` 记录全部创建内容和验证结果；在需求记录中将状态改为“已完成”，逐项登记 typecheck、lint、format、test、build 和 HTTP 冒烟结果。

## Final Verification

- [ ] `rules/`、`session/`、`mistakes/`、`spec/`、`docs/` 结构完整。
- [ ] 根目录没有误留旧规范副本。
- [ ] `npm run typecheck` 通过。
- [ ] `npm run lint` 通过。
- [ ] `npm run format:check` 通过。
- [ ] `npm test` 通过。
- [ ] `npm run build` 通过。
- [ ] 开发服务器返回 HTTP 200。
- [ ] 未初始化 `.git/`。
- [ ] 未安装、配置或调用飞书 CLI。
