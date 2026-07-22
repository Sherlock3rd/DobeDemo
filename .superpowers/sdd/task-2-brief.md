# Task 2：建立 Vite、TypeScript 与质量工具配置

## 项目背景

Task 1 已完成治理文件与规范归档。本任务只建立可供后续源码使用的 npm、Vite、TypeScript、测试、ESLint 和 Prettier 基础。

## 全局约束

- 工作区：`d:\charlie\dobe demo`
- Windows PowerShell。
- 不初始化 Git，不执行 Git 提交。
- 不配置飞书 CLI，不执行飞书写入。
- 新依赖使用 npm 安装当前最新版，不手写依赖版本。
- 不创建 Task 3–6 的业务组件。

## 需要创建或配置

- `package.json`
- `package-lock.json`（npm 自动生成）
- `index.html`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `vite.config.ts`
- `eslint.config.js`
- `.prettierrc.json`
- `.gitignore`
- `src/test/setup.ts`

## 安装命令

运行依赖：

```powershell
npm install react react-dom three @react-three/fiber @react-three/drei zustand
```

开发依赖：

```powershell
npm install -D vite typescript @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh prettier @types/react @types/react-dom @types/three
```

可以先用 `npm init -y` 初始化 package。

## package scripts

必须提供：

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

项目应为 ESM。

## Vite 与测试

`vite.config.ts` 使用 `@vitejs/plugin-react` 和 `defineConfig`（来自 `vitest/config`），测试环境为 `jsdom`，setup 文件为 `./src/test/setup.ts`。

`src/test/setup.ts`：

```ts
import '@testing-library/jest-dom/vitest'
```

## TypeScript

- 使用 project references：根配置引用 app 与 node 配置。
- app 覆盖 `src`，node 覆盖 `vite.config.ts`。
- 启用 `strict`、`noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch`。
- 使用适配现代 Vite/React 的 module、moduleResolution、jsx 和 lib 设置。
- 配置必须能让 `npm run typecheck` 在当前任务末通过。

## ESLint、Prettier 与忽略

- ESLint 使用 flat config。
- 使用 `@eslint/js`、`typescript-eslint` 推荐配置、React Hooks 和 React Refresh。
- 忽略 `dist`、`node_modules`、coverage、`.superpowers`。
- Prettier：单引号、无分号、尾逗号。
- `.gitignore` 至少忽略 `node_modules/`、`dist/`、`coverage/`、日志和临时文件；不要创建 `.git/`。

## index.html

提供 `#root` 挂载节点，并通过 `/src/main.tsx` 加载后续入口。入口此时可以尚不存在，但 typecheck 必须通过。

## 验证

至少运行并记录：

```powershell
npm run typecheck
npm run lint
npm run format:check
```

全部退出码必须为 0。如果格式检查失败，先运行 `npm run format` 再复查。不要运行或实现后续任务。

## 报告

写入 `.superpowers/sdd/task-2-report.md`：

- 状态：DONE、DONE_WITH_CONCERNS、NEEDS_CONTEXT 或 BLOCKED
- 创建/修改文件
- 实际安装命令
- 每个验证命令、退出码和摘要
- 自审与关注事项

最终回复只返回状态、一行验证摘要和关注事项。
