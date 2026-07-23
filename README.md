# DobeDemo：工业城市帮派树 Demo

一个基于 React、Three.js 与 React Three Fiber 的浏览器 3D 游戏 Demo。玩家通过挂机获得帮派声望，在 1–50 级职位树中晋升，并逐步解锁和升级工业城市建筑。

## 在线体验

**GitHub Pages：<https://sherlock3rd.github.io/DobeDemo/>**

> 首次发布完成后即可直接访问。进度保存在浏览器本地，不需要账号。

![工业城市默认场景](.superpowers/sdd/gang-tree-demo-screenshot.png)

## 核心玩法

- 固定俯视正交镜头，支持左键/右键/单指拖动平移与滚轮/双指缩放。
- 在线每秒获得 5 点声望，支持最多 8 小时离线收益。
- 1–50 级帮派树，共 7 个职位。
- 初始仅拥有修车厂。
- 建筑依次解锁：
  1. Lv.1 修车厂
  2. Lv.8 废车回收厂
  3. Lv.16 商业街
  4. Lv.24 金属加工厂
  5. Lv.32 加油站
  6. Lv.40 Clubhouse
- 每座已解锁建筑可从 1 级升级到 10 级：升级到 Lv.N 需要逐个完成 N 个目标级子建筑（碎片），进度满后再确认主建筑升级。
- 子建筑逐个建成时会播放 3D 入场动画并在面板上显示绿色扫光；Lv.10 满级后显示 10 个永久子建筑且不再升级。
- 未解锁建筑显示施工地块和锁定标识，点击后可查看解锁条件。
- 帮派声望与城市建筑碎片进度均通过 `localStorage` 持久化（城市存档键 `dobe-city-progression-v1`），刷新后恢复。

## 职位等级

| 等级  | 职位                      |
| ----- | ------------------------- |
| 1–7   | Prospect（见习）          |
| 8–15  | Full Patch（正式成员）    |
| 16–23 | Wrench（技术骨干）        |
| 24–31 | Bar Liaison（酒吧联络人） |
| 32–39 | Road Captain（路线队长）  |
| 40–49 | V. PRESIDENT（副主席）    |
| 50    | PRESIDENT（主席）         |

## 操作

- 左键 / 右键按住拖动：平移城市。
- 单指拖动：平移城市。
- 鼠标滚轮 / 双指捏合：缩放城市。
- 点击建筑或锁定地块：查看建筑信息与升级面板（拖动超过 6px 后松开不会误触发选中）。
- 在升级面板点击“升级子建筑 k/N”逐个完成碎片，满进度后点击“完成 Lv.N 升级”确认升级。
- 点击“打开帮派树”：查看 50 级完整进度。
- Escape：关闭帮派树。

## 技术栈

- React 19 + TypeScript
- Three.js
- React Three Fiber + Drei
- Zustand
- Vite
- Vitest + React Testing Library
- ESLint + Prettier
- GitHub Pages

## 本地运行

环境要求：Node.js 22 或兼容版本。

```bash
npm install
npm run dev
```

浏览器访问 Vite 输出的本地地址。

## 验证命令

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

当前验收基线：32 个测试文件、391 项测试。

碎片升级的可重复浏览器验收脚本为 `.superpowers/sdd/fragmented-upgrades-cdp.mjs`（安全模式：端口 preflight、仅终止自建进程、临时 profile、失败非零退出），结果与截图见 `.superpowers/sdd/fragmented-upgrades-*`。

## GitHub Pages 部署

生产构建会把 Vite base 自动切换为 `/DobeDemo/`。发布时将 `dist/` 内容提交到 `gh-pages` 分支，GitHub Pages 从该分支根目录提供公开体验；本地开发服务器继续使用根路径。

## 项目结构

```text
src/
├─ game/        帮派等级、挂机、建筑目录和城市布局
├─ scene/city/  3D 城市、建筑模型和锁定地块
├─ store/       城市与帮派 Zustand 状态
├─ ui/          HUD、建筑面板和帮派树
└─ test/        测试环境
```

详细设计、实施计划和验收记录位于 `docs/`、`session/` 与 `.superpowers/sdd/`。

## 当前边界

- 本地 Demo，无后端、账号或云存档。
- 不包含服务器校时或防作弊。
- 帮派声望与城市建筑碎片进度均会持久化，刷新后恢复；无服务器校时。
- 3D 资产均为程序化基础几何体，不是正式美术资源。
