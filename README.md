# DobeDemo：工业城市帮派树 Demo

一个基于 React、Three.js 与 React Three Fiber 的浏览器 3D 游戏 Demo。玩家通过挂机获得帮派声望，在 1–50 级职位树中晋升，逐步解锁工业城市建筑，并经营钱、油、物资三种资源来自由升级每座建筑的独立子建筑。

## 在线体验

**GitHub Pages：<https://sherlock3rd.github.io/DobeDemo/>**

> 首次发布完成后即可直接访问。进度保存在浏览器本地，不需要账号。

![工业城市默认场景](.superpowers/sdd/gang-tree-demo-screenshot.png)

## 核心玩法

- 固定俯视正交镜头，支持左键/右键/单指拖动平移与滚轮/双指缩放。
- 在线每 10 秒获得 1 点声望，支持最多 8 小时离线收益，HUD 显示 `+1 声望/10秒`。
- 1–50 级帮派树，共 7 个职位。
- 初始仅拥有修车厂。
- 建筑依次解锁：
  1. Lv.1 修车厂
  2. Lv.8 废车回收厂
  3. Lv.16 商业街
  4. Lv.24 金属加工厂
  5. Lv.32 加油站
  6. Lv.40 Clubhouse

### 渐进式子建筑升级

- 六类建筑主等级统一为 `1…10`，最高 Lv.10（不再区分 Clubhouse 与其他建筑）。
- 子建筑等级为 `0…10`，Lv.0 表示已解锁但尚未建设，任何子建筑永不高于所属主建筑。
- 槽位随主等级逐槽解锁：修车厂使用前 5 个槽（主 Lv.1–5 解锁 1–5 个，Lv.6–10 保持 5 个），其余五座各使用 10 个槽（主 Lv.1–10 解锁 1–10 个）。
- 未解锁槽位在建筑面板与 3D 场景中完全不存在：不显示卡片、脚手架、占位或标签，也无法被键盘或程序化升级；只有已解锁的 Lv.0 槽才显示脚手架。
- 详情页只有一个「选中项 + 公用升级按钮」，按钮文案为 `升级「名称」至 Lv.N · 钱 A · 油 B · 物资 C`（零成本项省略），一次只升当前选中槽一级。
- 进度区带 `role="progressbar"` 与整数百分比文案；每次子升级完成步数 +1，只有精确 100% 才显示 `100%`。
- 已解锁槽全部追平主等级时，进度区仍显示精确 `100%`，公用子升级按钮隐藏，并在下方显示 `升级主建筑至 Lv.N` 按钮。
- 点击主升级按钮不扣费、不升级，只进入同一面板内的独立确认页；确认页展示目标等级、钱/油/物资完整成本、`当前建筑战力 P` / `本次战力 +D` / `升级后战力 Q`、阻止原因与「返回 / 确认升级」。战力仅用于展示，不参与生产、解锁或门槛判定。
- 主升级门槛只判断即将到达的目标等级：修车厂目标 Lv.2–5 无外部门槛、Lv.6–10 不得高于 Clubhouse 当前等级；其余四类目标 Lv.2–5 不得高于修车厂当前等级、Lv.6–10 不得高于 Clubhouse 当前等级；Clubhouse 只受自身 Lv.40 解锁/进度/资源/上限约束。
- 阻止原因按固定优先级短路：`building-locked` → `已达到最高等级 Lv.10` → 子建筑未追平 → `需要先将修车厂提升至 Lv.N` → `需要先将帮派树提升至 Lv.40 解锁 Clubhouse` → `需要先将 Clubhouse 提升至 Lv.N` → `资源不足，还需 …`。
- 确认成功后一次性扣费、主等级 +1，并按 blueprint 顺序自动选中新解锁的 Lv.0 槽（修车厂 Lv.5→6 无新槽时选择首个未追平槽）。
- 子建筑升级会按其自身等级重建 3D 部件，仅本次点击升级的子建筑播放 400ms 绿色入场动画；主升级解锁新槽、刷新/rehydrate、迁移与重置都不重播。

### 资源经济

- 三种资源：钱、油、物资，均为非负整数，HUD 常驻显示余额与每 10 秒产量。
- 每 10 秒结算一个生产 tick，离线最多结算 8 小时；不足一个 tick 的时间余量保留到下次。
- 生产建筑：修车厂与商业街产钱、加油站产油、金属加工厂产物资；废车回收厂与 Clubhouse 本版不产出。
- 生产只来自已解锁且已激活的建筑，新解锁建筑不会追溯上线前的收益。
- 新账号与重置账号后钱包固定为 `钱 10000、油 0、物资 0`。
- 子建筑与主建筑升级都在同一次原子操作中先结算生产、再用最新钱包重查门槛并扣费；余额不足或任一门槛不满足时严格不升级、不扣费。
- 可调数值（生产速率、离线上限、各级升级成本、各建筑 Lv.1–10 战力）集中在 `src/config/economy.config.json`（schema 版本 2），由带校验的解析器加载；战力必须严格递增、非负、安全整数。
- 未解锁建筑显示施工地块和锁定标识，点击后可查看解锁条件。
- 城市存档（子建筑等级、资源钱包、生产时间、激活生产建筑）与帮派声望均通过 `localStorage` 持久化（城市存档键 `dobe-city-progression-v1`，Zustand persist 版本 3），刷新后恢复；选中子槽、详情/确认页与动画属于本次面板会话，不持久化。
- 存档从 v2 升级到 v3 时，对被新逐槽规则隐藏的旧子建筑等级按 v2 冻结价格一次性退款并清零，v3 rehydrate 不重复退款；v1 存档只做形态映射与隐藏槽清零、不退款。

### 战役、英雄与全局 HUD

- 战役共 2 章 20 关；每关敌人从 1 名递增到 5 名，编队固定为前排 2 个、后排 3 个阵位。
- 战斗由确定性的 100ms tick 引擎预演；走位、普攻与技能施放全部自动完成，没有 `Auto` 开关或手动施法按钮，同一输入始终得到同一结果。真实 `useFrame` 表现覆盖走位、lunge、死亡 tween、basic 枪火/命中和 skill 金色齐射拖尾；reduced motion 关闭非必要 tween 但不改变事件与结果。
- 首版三名英雄分别在帮派 Lv.1、Lv.12、Lv.28 解锁；英雄等级最高 Lv.50 且不能超过当前帮派等级。首通奖励与挂机收益进入共享英雄经验池，培养页从共享池扣费升级。
- 通关后开启英雄经验挂机：每 10 秒结算一次，离线最多累计 8 小时；推关页宝箱按已通关进度派生可领取经验，领取时保留不足一个 tick 的时间余量。
- `PROGRESSION_UNLOCKS` 是建筑、英雄和玩法入口的统一解锁来源；`解锁帮派树` 调试动作升至 Lv.50 后，英雄与建筑 UI 都从同一规则即时派生解锁。
- 全局 `GlobalHud` 以 `z-index:22` 在所有非 battle overlay 上方常驻显示钱、油、物资、英雄经验及推关/英雄红点，并保持可指针导航；这些非 battle dialog 不声明 `aria-modal`。进入 battle 后 HUD 隐藏并 inert，退出后恢复。应用只允许一个 `activeOverlay`，推关、编队、英雄、战斗和建筑详情互斥。
- 战斗退出需要二次确认；确认态会冻结战斗并阻止胜利/首通/经验发奖。Overlay 打开时标题获得焦点、背景变为 `inert`，关闭后焦点恢复到触发点。
- 英雄战役存档键为 `dobe-adventure-progression-v1`（persist v1），保存英雄等级、共享经验、阵容、最高通关与挂机时钟；坏存档在 rehydrate 时夹紧并丢弃非法阵位。
- Store 拒绝锁定英雄和非法帮派等级请求；配置及派生计算校验 safe integer、英雄 `defaultSlot` 与数值溢出。
- 建筑进度表示“当前主建筑等级这一阶段”的完成度；阶段完成后仍保留精确 `100%` 进度，并同时显示主建筑升级按钮。

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
- 在升级面板选中一个已解锁子建筑，点击唯一的公用按钮“升级「名称」至 Lv.N”逐级建设；全部已解锁子建筑追平主等级后，进度区保留 `100%`，并出现“升级主建筑至 Lv.N”。
- 点击“升级主建筑至 Lv.N”进入确认页（不扣费）；在确认页查看成本与战力后点击“确认升级”才真正扣费并把主建筑 +1，或点击“返回”不做任何更改。
- 点击“打开帮派树”：查看 50 级完整进度。
- 点击“推关”：选择 2 章 20 关中的已解锁关卡，进入 2 前 3 后的五阵位编队并开始全自动战斗；胜利后领取首通与挂机英雄经验。
- 点击“英雄”或玩家头像：查看三名英雄、共享经验和当前帮派等级上限，并真实扣除经验升级英雄。
- 点击“设置”：打开调试设置。设置面板提供两个点击即执行、无需二次确认的调试按钮——“解锁帮派树”（声望直接置为 1470/Lv.50 并同步生产者，可重复且幂等）与“钱/油/物资各 +10000”（可重复累加、饱和不溢出），执行后面板保持打开并以 `aria-live` 提示。“重置账号”后还需点击“确认重置账号”，才会把帮派声望、挂机时间、建筑解锁、主/子建筑等级和资源钱包恢复为初始账号（钱 10000 / 油 0 / 物资 0）。
- Escape：关闭已打开的帮派树或调试设置。

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

当前验收基线：65 个测试文件、655 项测试。最终本地构建资产为 `/DobeDemo/assets/index-C010nH2x.js` 与 `/DobeDemo/assets/index-CoMhGqEJ.css`。

渐进式建筑升级的可重复浏览器验收脚本为 `.superpowers/sdd/progressive-building-upgrade-flow-cdp.mjs`（安全模式：动态选择空闲端口、`--strictPort`、仅终止脚本自建 PID、临时 profile 删除前校验 `dobe-progressive-upgrade-cdp-` 前缀、结果 JSON 只记录 basename、错误脱敏、坏数据/路径脱敏自测、失败非零退出）。它以真实鼠标点击覆盖：fresh v3 存档 10000 钱与仅首槽可见、公用按钮连续升级与对应 3D ROI 变化、手选保持与追平后循环选择、完成态 100% 与主升级按钮、主按钮进入确认页不扣费、完整成本/战力/资源不足禁用、确认一次扣费与新槽自动选中、全部阻止原因优先级、修车厂 Lv.5→6 的 Clubhouse 门槛、Clubhouse 不受修车厂门槛、两个调试动作重复执行、二次确认重置、代表性 v2 一次退款且刷新不重复、桌面 1440×900 与 390×844 布局；结果与截图见 `.superpowers/sdd/progressive-building-upgrade-flow-*`。

战役/英雄/GlobalHud 的本地验收脚本为 `.superpowers/sdd/campaign-heroes-global-hud-cdp.mjs`。Chrome 使用 `--remote-debugging-port=0`，脚本只从隔离 profile 的 `DevToolsActivePort` 读取并校验自有实际端口/WS；Vite 以 `--strictPort` 启动，并在接受 HTTP 前验证 owned 进程存活及应用 HTML 特征。真实 `Input.dispatchMouseEvent` 覆盖 fresh 无非法直达入口、Adventure/Formation Escape、英雄入口关闭建筑详情且 Escape 后不恢复、非 battle HUD 常驻可导航与 battle hidden/inert、1-1 编队/START/自动战斗状态变化/VICTORY/首通、宝箱领取归零及后续 tick、英雄升级、Lv.50 派生解锁、三英雄快速编队、战斗二次确认退出无奖励、建筑完成态 100%、Adventure `state:null`/坏存档、三 store reset，以及 1440×900/390×844 的布局和严格双轴 44×44 热区。严格热区 RED 曾暴露 44px 控件被 `panel-pop-enter scale(0.98)` 缩成 43.12px，以及 Adventure/Building/Settings 尺寸下限不完整；终审又补齐退出冻结和真实战斗表现。BattleEffects 的 mounted callback 写回 BattleScreen `data-presented-*`，配合累计 basic/skill/damage/death 计数，使 CDP 能证明表现层已挂载而非只证明引擎有事件：stage 1 实测 basic 7、damage 7、death 1 与 `presentedBasic`，stage 20 实测 basic 30、skill-main 5、splash 11、damage 46、death 1 与 `currentPresentedSkill`。`campaign-skill.png` 和 running-basic 截图 hash 不同；最终 self-test 11/11、运行期 50/50，本地证据尚未 push 或发布 Pages。

`example/5v5example.mp4` 与 `example/ux/` 中的视频、抽帧和参考图仅用于视觉分析，不属于产品或验收交付，禁止加入仓库提交。

历史验收脚本：独立子建筑经济 `.superpowers/sdd/independent-economy-cdp.mjs`、碎片升级 `.superpowers/sdd/fragmented-upgrades-cdp.mjs`、设置重置 `.superpowers/sdd/settings-reset-cdp.mjs`，结果与截图分别见对应前缀文件。

### 配置契约

`src/config/economy.config.json`（schema 版本 2）冻结了后续独立“配置 EXE”读写的稳定 JSON 契约（版本、tick、离线上限、各生产建筑速率、1–10 子建筑成本、2–10 主建筑成本，以及各建筑 Lv.1–10 的仅展示战力 `buildingPowerById`）。第一版所有升级成本仅消耗钱，但结构与 UI 已支持三资源；战力必须严格递增、非负、安全整数。本次仅冻结该契约与校验器，不实现配置 EXE。

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
- 帮派声望、子建筑等级与资源钱包均会持久化，刷新后恢复；无服务器校时。
- 第一版不实际消耗油或物资（成本结构保留三资源），也不为废车回收厂/Clubhouse 配置产出。
- 不制作配置 EXE，仅冻结其未来读写的 JSON 契约。
- 3D 资产均为程序化基础几何体，不是正式美术资源。
