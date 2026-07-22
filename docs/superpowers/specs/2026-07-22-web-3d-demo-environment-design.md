# Web 3D 游戏 Demo 工作环境设计

## 目标

为游戏策划/制作人建立一个可快速迭代的 Web 3D Demo 工作区。助手担任 Demo 技术负责人，将策划需求实现为可运行、可验证的浏览器 Demo。

## 范围

- 初始化 Vite、React 与 TypeScript 工程。
- 使用 React Three Fiber 构建 3D 场景，并使用 Drei 提供常用辅助能力。
- 使用 Zustand 管理确需跨模块共享的游戏状态。
- 建立代码质量、测试、构建与项目治理基础。
- 不初始化 Git。
- 不部署飞书 CLI，不执行飞书文档或电子表格写入。

## 工程架构

- `src/game/`：与渲染框架解耦的玩法规则和游戏逻辑。
- `src/scene/`：3D 场景、相机、灯光和场景对象。
- `src/ui/`：页面界面、HUD 和错误提示。
- `src/store/`：跨模块共享状态。
- `src/assets/`：模型、贴图和音频资源。
- `rules/`：项目规则与协作边界。
- `session/`：全局状态、提交总账和需求级记录。
- `mistakes/`：可复现错误及防呆经验。
- `spec/`：项目规范。
- `docs/`：术语表及其他项目文档。

React 负责应用外壳和 UI，React Three Fiber 负责 3D 渲染。玩法规则优先保持为独立 TypeScript 模块；只有需要跨组件共享的状态才进入 Zustand。

## 初始 Demo

初始页面提供：

- 可工作的透视相机、灯光和地面。
- 一个可旋转的示例 3D 物体，用于验证渲染循环。
- 基础 HUD，用于验证 3D 场景与 React UI 可同时工作。
- 资源加载状态和可读错误边界，避免加载失败时出现白屏。

初始内容仅用于验证工作环境，不定义具体游戏玩法或美术方向。

## 项目治理

根据 `rules-bootstrap-spec.md` 初始化：

- `rules/rules.md`
- `session/session.md`
- `session/requirements/web-3d-demo-environment.md`
- `mistakes/README.md`
- `docs/beagle_glossary.md`

规则中记录：

- 用户角色为游戏策划/制作人。
- 助手角色为 Demo 技术负责人。
- 所有回复以 `you majesty` 开头。
- 设计变更必须先获得用户书面确认。
- 开始新任务前检查相关错题记录。
- 非设计性的文档与脚手架变更可直接执行，但需记录到 session。

现有三份规范移动到 `spec/`，保留原始内容：

- `rules-bootstrap-spec.md`
- `feishu-cli-deployment-and-doc-ops-spec.md`
- `feishu-document-writing-special-flow-spec.md`

飞书规范仅在未来发生飞书操作时生效，不属于本次环境部署内容。

## 错误处理

- 资源加载过程显示明确的加载状态。
- React 渲染异常由错误边界捕获并显示可读提示。
- 异步资源加载失败不得导致整个页面静默白屏。
- 可复现的部署或运行错误修复后记录到 `mistakes/`。

## 工具与验证

- ESLint：静态检查。
- Prettier：统一格式。
- Vitest：单元测试。
- React Testing Library：React UI 行为测试。
- TypeScript：严格类型检查。
- Vite：开发服务器和生产构建。

环境部署完成必须满足：

1. 依赖可正常安装。
2. 开发服务器能够启动。
3. 浏览器可显示基础 3D 场景与 HUD。
4. 类型检查通过。
5. ESLint 检查通过。
6. 单元测试通过。
7. 生产构建通过。

## 非目标

- 不实现具体游戏机制。
- 不引入后端、账号系统、数据库或联网功能。
- 不制作正式模型、贴图、动画或音频。
- 不初始化或提交 Git 仓库。
- 不配置或授权飞书 CLI。
