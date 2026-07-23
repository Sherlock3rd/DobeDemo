# Layout Task 3：OrbitControls 显式 PAN 映射

## 范围

工作区：`d:\charlie\dobe demo`。只实现镜头鼠标/触摸输入映射及测试，不实现拖动阈值，不改布局，不 commit/push。

## 接口

修改 `src/scene/city/cameraConstraints.ts`：

```ts
import { MOUSE, TOUCH } from 'three'

export const CAMERA_MOUSE_BUTTONS = {
  LEFT: MOUSE.PAN,
  MIDDLE: MOUSE.DOLLY,
  RIGHT: MOUSE.PAN,
} as const

export const CAMERA_TOUCHES = {
  ONE: TOUCH.PAN,
  TWO: TOUCH.DOLLY_PAN,
} as const
```

保留：

```ts
CAMERA_CONTROL_FLAGS.enableRotate === false
CAMERA_CONTROL_FLAGS.enablePan === true
CAMERA_CONTROL_FLAGS.enableZoom === true
CAMERA_CONTROL_FLAGS.screenSpacePanning === false
```

修改 `CityCameraControls.tsx`：

```tsx
<OrbitControls
  mouseButtons={CAMERA_MOUSE_BUTTONS}
  touches={CAMERA_TOUCHES}
  ...
/>
```

## TDD

1. 先修改 `cameraConstraints.test.ts`，断言三个 mouse button、ONE、TWO；导出缺失确认 RED。
2. 实现常量。
3. 新建或扩充 `CityCameraControls.test.tsx`：
   - mock OrbitControls 为可捕获 props 的组件。
   - 渲染 `CityCameraControls`。
   - 断言真实传入 `mouseButtons`、`touches`、`enableRotate=false`、min/max zoom。
   - 不只测试常量，必须证明组件消费了常量。
4. 保留 clamp tests。

验证：

```powershell
npm.cmd test -- src/scene/city/cameraConstraints.test.ts src/scene/city/CityCameraControls.test.tsx
npm.cmd run typecheck
npm.cmd run lint
```

报告写 `.superpowers/sdd/layout-task-3-report.md`，记录 RED/GREEN、props 集成、测试数量、自审。不要执行 Git 操作。
