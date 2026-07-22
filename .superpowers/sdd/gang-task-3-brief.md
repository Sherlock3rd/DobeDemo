# Gang Task 3：持久帮派 Store 与挂机控制器

## 约束

工作区：`d:\charlie\dobe demo`。Task2 纯规则已完成。本任务只创建 store/controller 及测试，不改 UI/场景/App。严格 TDD；不初始化 Git。

## Store

创建：

- `src/store/useGangStore.ts`
- `src/store/useGangStore.test.ts`

接口：

```ts
interface GangState {
  totalReputation: number
  lastUpdatedAt: number
  syncIdleProgress: (now: number) => void
  reset: (now: number) => void
}

export const GANG_STORAGE_KEY = 'gang-progression-v1'
export const useGangStore
```

使用 Zustand `persist`，只持久化 `totalReputation` 与 `lastUpdatedAt`。

行为：

- 初始 reputation=0，lastUpdatedAt 为创建时有效时间。
- sync 只结算完整秒，使用每秒5、最多8h、1470封顶。
- 小于1秒不改变 lastUpdatedAt，以保留余量。
- 正常结算后 lastUpdatedAt 前移已结算完整秒。
- 超过8h时只给8h收益，并把 lastUpdatedAt 设为 now，丢弃超 cap 时间。
- now 非有限或 <= last 时完全不变。
- 满级时 reputation 保持1470，并在合法向前 sync 时把 lastUpdatedAt 更新到 now，避免继续积压。
- reset(now) 将 reputation 归0；now 无效时使用 Date.now()。

为了避免 store 复制时间数学，可在 `gangProgression.ts` 新增并测试：

```ts
export interface IdleSettlement {
  earnedReputation: number
  nextUpdatedAt: number
}
export function calculateIdleSettlement(lastUpdatedAt: number, now: number): IdleSettlement
```

`calculateIdleReputation()` 委托 settlement 的 earned 字段。

## 安全 Storage

实现内存 `StateStorage` fallback。访问 `window.localStorage` 或读写抛错时，当前会话仍工作。将安全 storage 工厂设计成可测试函数，测试失败 storage 回退后 set/get/remove。

## Controller

创建：

- `src/game/GangIdleController.tsx`
- `src/game/GangIdleController.test.tsx`

组件不渲染 DOM，返回 null。

挂载：

- 立即 `syncIdleProgress(Date.now())`。
- `window.setInterval` 每1000ms sync。
- document `visibilitychange` 且 visibilityState 为 `visible` 时 sync。

卸载清除 interval 和事件监听。使用 store selector 获取稳定 action。

## TDD

Store 先测试模块不存在 RED，覆盖：

- 5秒=25声望。
- 1.5秒只结算1秒且保留0.5秒时间余量。
- 8h cap与超 cap lastUpdatedAt。
- 未来/NaN now。
- 满级封顶并推进时间。
- reset。
- persist partial字段与 key。
- storage throw fallback。

Controller 使用 fake timers，测试挂载立即、每秒、visible、hidden不触发、卸载后不再调用。可通过 spy store action或真实声望变化验证，不要只测 timer mock 自身。

最终：

```powershell
npm.cmd test -- src/store/useGangStore.test.ts src/game/GangIdleController.test.tsx
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
```

报告写 `.superpowers/sdd/gang-task-3-report.md`，含两组 RED/GREEN、持久化/时间边界、测试数量、自审。最终仅返回状态、摘要、关注事项。
