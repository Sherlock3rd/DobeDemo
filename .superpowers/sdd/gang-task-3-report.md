# Gang Task 3 实施报告

## 状态

已完成持久帮派 store（`useGangStore`）与挂机控制器（`GangIdleController`），并按 brief 要求在 `gangProgression.ts` 新增可复用的 `calculateIdleSettlement`。仅新增/修改规则模块、store、controller 及对应测试文件与本报告；未改动 UI/场景/App，未初始化 Git。

## TDD 记录

### 第一组：规则增量 + Store（`useGangStore`）

- RED（规则增量）：在 `gangProgression.test.ts` 追加 `calculateIdleSettlement` 相关用例（5 秒结算、1.5 秒保留余量、8 小时封顶与超封顶 lastUpdatedAt 归位、非正/非有限时间不变、`calculateIdleReputation` 委托），执行
  `npm.cmd test -- src/game/gangProgression.test.ts`。
  结果：退出码 1，6 项新用例因 `calculateIdleSettlement is not a function` 失败，符合模块缺失 RED。
- GREEN（规则增量）：在 `gangProgression.ts` 新增 `IdleSettlement` 接口与 `calculateIdleSettlement`，`calculateIdleReputation` 改为委托其 `earnedReputation`。重新执行同一命令，67 项全部通过。
- RED（Store）：创建 `useGangStore.test.ts`（尚无 `useGangStore.ts`），覆盖初始状态、5 秒结算、1.5 秒跨调用保留余量、8 小时封顶、未来/NaN `now` 不变、满级后继续 sync 仍前移 `lastUpdatedAt`、`reset`、持久化字段与 key、`createSafeStorage` 的 storage 抛错回退。执行
  `npm.cmd test -- src/store/useGangStore.test.ts`。
  结果：退出码 1，因 `./useGangStore` 模块无法解析而整套失败，符合模块缺失 RED。
- GREEN（Store）：创建 `useGangStore.ts`，用 Zustand `persist` 只持久化 `totalReputation`/`lastUpdatedAt`，`syncIdleProgress` 委托 `calculateIdleSettlement` 并对满级情形做 `lastUpdatedAt` 直接归位到 `now` 的短路处理；`reset` 对非有限 `now` 回退 `Date.now()`；实现 `createSafeStorage` 内存回退工厂并注入 `createJSONStorage`。重新执行同一命令，14 项全部通过。

### 第二组：挂机控制器（`GangIdleController`）

- RED：创建 `GangIdleController.test.tsx`（尚无 `GangIdleController.tsx`），用 Vitest fake timers 与 spy 替换 store 的 `syncIdleProgress`，覆盖不渲染 DOM、挂载立即 sync、每 1000ms 再 sync、`visibilitychange` 为 `hidden` 时不触发、为 `visible` 时触发、卸载后 interval 与事件监听均失效。执行
  `npm.cmd test -- src/game/GangIdleController.test.tsx`。
  结果：退出码 1，因 `./GangIdleController` 模块无法解析而整套失败，符合模块缺失 RED。
- GREEN：创建 `GangIdleController.tsx`，通过 `useGangStore((state) => state.syncIdleProgress)` 选择稳定 action，在 `useEffect` 中立即 sync、设置 `window.setInterval`、监听 `document` 的 `visibilitychange`（仅 `visible` 时触发），卸载时清理 interval 与监听。重新执行同一命令，首次因测试内 `vi.setSystemTime` 与 `vi.advanceTimersByTime` 叠加使用导致断言时间点错误（测试自身问题，非实现问题），修正测试后 6 项全部通过。

## 持久化 / 时间边界说明

- **结算粒度**：`calculateIdleSettlement` 只结算完整秒（`Math.floor(elapsedMs / 1000)`），不足 1 秒时返回原 `lastUpdatedAt`（不前移），从而在多次调用间保留亚秒余量；恢复到 ≥1 秒后按累计余量一次性结算。
- **8 小时封顶**：`elapsedSeconds >= MAX_OFFLINE_SECONDS`（28 800）时固定发放 `144000`（`28800 * 5`）声望，并将 `nextUpdatedAt` 直接设为 `now`，丢弃超出 8 小时上限之后的时间，避免离线时间无限累积。
- **非法输入**：`lastUpdatedAt`/`now` 非有限，或 `now <= lastUpdatedAt` 时，`earnedReputation` 为 0 且 `nextUpdatedAt` 保持 `lastUpdatedAt` 不变（`useGangStore.syncIdleProgress` 对此直接 `return`，不触发 `set`）。
- **满级封顶**：`totalReputation >= MAX_REPUTATION`（1470）时，`syncIdleProgress` 跳过按秒结算，直接将 `lastUpdatedAt` 前移到合法的 `now`（仍需 `now > lastUpdatedAt` 才生效），防止满级后继续积压未结算的秒数；`totalReputation` 始终以 `Math.min(..., MAX_REPUTATION)` 兜底。
- **持久化字段**：`persist` 的 `partialize` 只写出 `{ totalReputation, lastUpdatedAt }`，storage key 为常量 `GANG_STORAGE_KEY = 'gang-progression-v1'`；已验证 `localStorage` 中该 key 下 JSON 的 `state` 只含这两个字段。
- **安全 Storage**：`createSafeStorage(getStorage)` 默认包装 `window.localStorage`，对 `getStorage()` 本身抛错、以及 `getItem`/`setItem`/`removeItem` 抛错均在同一 `try/catch` 内兜底。任一底层操作首次失败后，该 storage 实例会 sticky 切换到同一个 `Map`，后续所有读写删均不再访问底层 storage，避免“写入内存、读取却回到底层”的分裂状态；工厂函数可通过注入自定义 `getStorage` 独立单元测试。

## 测试数量

- `src/game/gangProgression.test.ts`：67 项（原 61 项 + 新增 6 项 `calculateIdleSettlement`/委托用例）。
- `src/store/useGangStore.test.ts`：17 项。
- `src/game/GangIdleController.test.tsx`：7 项。
- 专项联合运行 `npm.cmd test -- src/store/useGangStore.test.ts src/game/GangIdleController.test.tsx`：2 个文件、24 项，全部通过。
- 全量 `npm.cmd test`：13 个文件、152 项，全部通过。

## 最终验证

- `npm.cmd test -- src/store/useGangStore.test.ts src/game/GangIdleController.test.tsx`：通过，2 个文件、24 项，退出码 0。
- `npm.cmd test`：通过，13 个文件、152 项，退出码 0。
- `npm.cmd run typecheck`：通过，退出码 0（首次因 controller 测试中 `vi.fn()` 未标注类型导致的类型不匹配失败，补充 `vi.fn<(now: number) => void>()` 类型参数后通过）。
- `npm.cmd run lint`：通过，退出码 0。
- IDE 对本任务新增/修改的 6 个文件的诊断：无错误。

## 自审

- Store 接口字段、`GANG_STORAGE_KEY` 常量、`calculateIdleSettlement` 签名与 brief 逐项核对一致。
- `syncIdleProgress`/`reset` 均只依赖注入的 `now`，未直接读取 `Date.now()`（`reset` 仅在 `now` 非有限时兜底调用一次），未引入隐藏的实时时钟依赖，便于测试确定性。
- `GangIdleController` 不渲染任何 DOM（返回 `null`），挂载/卸载对 interval 与事件监听严格配对清理；使用 selector 获取的 action 引用稳定，不会因声望变化触发 effect 重新执行。
- 未修改任何 UI、场景或 `App` 相关文件；未执行任何 Git 操作。
- 未发现阻塞项。

## 关注事项

- 后续若有 UI/App 任务需要挂载 `GangIdleController` 并读取 `useGangStore` 展示声望/等级，可直接复用本任务产出，无需改动本次实现。
- `createSafeStorage` 的内存回退仅在当前会话内有效（不跨刷新持久化），是 brief 明确要求的"当前会话仍工作"范围，非缺陷。

## 审查收敛补充

- **Sticky fallback RED**：先加入“底层 `setItem` 抛错、`getItem` 正常”的非对称故障用例；执行 store 专项时 15 项中 1 项按预期失败，实际结果为写入内存后读取得到 `null`。根因确认是原 `withFallback` 每次操作都重新尝试底层 storage，回退状态未在实例内锁定。
- **Sticky fallback GREEN**：加入实例级 `useMemoryStore` 标志；首次访问或任一 get/set/remove 抛错时先切换标志，再执行对应 Map 操作。随后 store 专项 15/15 通过；加入其余覆盖后 store 专项最终 17/17 通过。
- **StrictMode + 真实 store 集成**：在 fake system time 下 reset 到 1000ms，以 React `StrictMode` 挂载真实 `GangIdleController`；双 effect 挂载阶段因时间未前进不产生声望，推进 1 秒后仅得到一次 5 声望；卸载后再推进 2 秒，声望与 `lastUpdatedAt` 均不再变化。
- **持久化恢复 + 离线补发集成**：手工写入 Zustand persist JSON（10 声望、旧 `lastUpdatedAt`），调用 `useGangStore.persist.rehydrate()` 后先验证旧时间被恢复，再 sync 5 秒验证声望从 10 正确增至 35；测试在前后均重置 store 并清空 localStorage，避免跨用例污染。
- **超过 8 小时 store 边界**：新增 10 小时 sync 用例，验证声望仍受 8 小时收益/1470 总上限约束，且 `lastUpdatedAt` 直接推进到 10 小时后的 `now`，超 cap 时间不会留待后续结算。
- **审查后最终验证**：专项 24/24、全量 152/152、typecheck 与 lint 均通过，退出码均为 0；未修改 UI/场景/App，未执行 Git 初始化或其他 Git 操作。
