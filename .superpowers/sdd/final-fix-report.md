# 最终整体审查修复报告

## 根因

- `tsconfig.app.json` 通过 `types: ["vitest/globals"]` 向 TypeScript 暴露了 Vitest 全局 API，但 `vite.config.ts` 未设置 `test.globals: true`。类型环境与实际测试运行时配置不一致。
- `src/test/setup.ts` 仅加载了 `@testing-library/jest-dom/vitest`，未显式注册 React Testing Library 的 `cleanup`。在未启用 Vitest 全局 API 的配置下，RTL 无法依赖全局 `afterEach` 自动清理，前一用例渲染的 DOM 会泄漏至后一用例。

## RED 证据

先新增 `src/test/cleanup.test.tsx`：第一条用例渲染唯一 marker，第二条用例在自身未 render 前断言该 marker 不存在。

- 命令：`npm.cmd test -- src/test/cleanup.test.tsx`
- 退出码：`1`
- 结果：2 项测试中 1 项通过、1 项失败。第二条用例实际找到了前一用例遗留的 `<div>cleanup-regression-marker</div>`，失败信息为 `expected document not to contain element`。这直接复现了 DOM 未隔离问题。

## 修改

- `tsconfig.app.json`：移除 `vitest/globals` 类型声明，保持显式 import 风格。
- `src/test/setup.ts`：从 `vitest` 导入 `afterEach`，从 `@testing-library/react` 导入 `cleanup`，注册 `afterEach(cleanup)`；未启用全局 API。
- `src/test/cleanup.test.tsx`：保留最小 DOM 清理回归测试。
- `index.html`：将根元素语言从 `en` 改为 `zh-CN`。
- `src/App.tsx`：Drei `Loader` 的 `dataInterpolation` 改为明确中文进度文案 `正在加载 3D 场景… N%`。
- `session/requirements/web-3d-demo-environment.md`：记录“加载态基础设施已接入；初始场景无异步资源，因此正常启动时不触发”，未添加假延时或 Canvas DOM fallback。
- 未初始化 Git。

## GREEN 与全量验证

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `npm.cmd test -- src/test/cleanup.test.tsx` | 0 | 回归测试 1 个文件、2 项测试全部通过 |
| `npm.cmd test` | 0 | 全套测试 4 个文件、8 项测试全部通过 |
| `npm.cmd run lint` | 0 | ESLint 通过，无错误 |
| `npm.cmd run format:check`（首次） | 1 | 检出新增回归测试格式不符合 Prettier |
| `npx.cmd prettier --write src/test/cleanup.test.tsx` | 0 | 已格式化新增测试 |
| `npm.cmd run typecheck` | 0 | TypeScript 项目检查通过 |
| `npm.cmd run format:check`（修正后） | 0 | 全部匹配文件符合 Prettier |
| `npm.cmd run build` | 0 | TypeScript 构建及 Vite 生产构建成功，574 个模块完成转换 |

## 关注事项

- Vite 构建成功，但报告主 JS chunk 为 `1,092.69 kB`（gzip `300.46 kB`），超过默认 500 kB 警告阈值。该警告不影响本次验收，后续引入更多资产时可考虑动态导入或代码拆分。
- 初始场景没有异步资产，因此正常启动时 Loader 不会出现；文案将在未来异步资源进入 Drei 加载管理流程时显示。

## 复审计数修正

- 将 `session/requirements/web-3d-demo-environment.md` 的测试验收记录从“3 个测试文件、6 项测试”修正为最终结果“4 个测试文件、8 项测试”。
- 检查同一文档后，未发现其他“3 个测试文件”或“6 项测试”旧计数。
- 运行 `npm.cmd run format:check`，退出码 `0`；全部匹配文件符合 Prettier 格式。
