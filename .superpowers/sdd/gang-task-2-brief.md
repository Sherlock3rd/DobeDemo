# Gang Task 2：帮派等级、职位、挂机与解锁纯规则

## 约束

工作区：`d:\charlie\dobe demo`。只创建纯规则及测试，不创建 store/UI。严格 TDD；不初始化 Git。

## 常量

```ts
export const GANG_MIN_LEVEL = 1
export const GANG_MAX_LEVEL = 50
export const REPUTATION_PER_LEVEL = 30
export const REPUTATION_PER_SECOND = 5
export const MAX_OFFLINE_SECONDS = 28_800
export const MAX_REPUTATION = 1_470
```

## 职位

```ts
export interface GangRole {
  threshold: number
  title: string
  chineseTitle: string
}
```

精确数组：

- 1 Prospect / 见习
- 8 Full Patch / 正式成员
- 16 Wrench / 技术骨干
- 24 Bar Liaison / 酒吧联络人
- 32 Road Captain / 路线队长
- 40 V. PRESIDENT / 副主席
- 50 PRESIDENT / 主席

## 建筑解锁

```ts
export interface BuildingUnlock {
  buildingId: BuildingId
  requiredLevel: number
  roleTitle: string
}
```

顺序与阈值：

- repair-shop 1 Prospect
- recycling-yard 8 Full Patch
- commercial-street 16 Wrench
- metalworking-plant 24 Bar Liaison
- gas-station 32 Road Captain
- clubhouse 40 V. PRESIDENT

50 PRESIDENT 无新建筑。

## 函数

```ts
export function getGangLevel(totalReputation: number): number
export function getGangRole(level: number): GangRole
export function getNextGangRole(level: number): GangRole | null
export function getTotalReputationForLevel(level: number): number
export function getLevelProgress(totalReputation: number): {
  current: number
  required: number
}
export function getBuildingUnlock(buildingId: string): BuildingUnlock | null
export function isBuildingUnlocked(buildingId: string, level: number): boolean
export function calculateIdleReputation(lastUpdatedAt: number, now: number): number
```

规则：

- 非有限、负声望按 0；超额 clamp 1470。
- level 输入 clamp 1–50。
- 0 rep→Lv1；29→Lv1；30→Lv2；1469→Lv49；1470/超额→Lv50。
- 满级 progress `{ current:30, required:30 }`，其余 current 为声望余数。
- 下一职位为严格大于当前等级的首项；Lv50 为 null。
- 未知建筑 unlock null/false。
- idle 使用完整秒数 `floor((now-last)/1000)`，clamp 0..28800，再乘 5。
- 时间非有限、now<=last 均返回 0。

## TDD

先写 `src/game/gangProgression.test.ts` 覆盖所有职位阈值与中间区间、声望边界、progress、next role、建筑顺序与逐阈值、初始仅修车厂、未知 ID、idle 正常/小数秒/负时间/8h cap。运行确认模块缺失 RED，再实现 `gangProgression.ts`。

最终：

```powershell
npm.cmd test -- src/game/gangProgression.test.ts
npm.cmd test -- src/game
npm.cmd run typecheck
npm.cmd run lint
```

报告写 `.superpowers/sdd/gang-task-2-report.md`，含 RED/GREEN、测试数量、边界、自审。最终仅返回状态、摘要、关注事项。
