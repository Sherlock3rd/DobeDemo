# Layout Task 3 报告

## 状态

已为 OrbitControls 增加显式鼠标与触摸 PAN 映射，并由
`CityCameraControls` 实际传入。未实现拖动阈值，未修改布局，未执行 Git
操作。

## TDD 记录

### RED：映射常量

- 先扩充 `cameraConstraints.test.ts`，覆盖 LEFT、MIDDLE、RIGHT、ONE、TWO。
- 首次运行得到 2 个预期失败：`CAMERA_MOUSE_BUTTONS` 与
  `CAMERA_TOUCHES` 均为 `undefined`。
- 随后添加最小常量实现，原有 clamp tests 保持不变。

### RED：组件 props 集成

- 新建 `CityCameraControls.test.tsx`，mock OrbitControls 并捕获真实 props。
- 首次运行得到 1 个预期失败：组件未传入 `mouseButtons` 和 `touches`；
  `enableRotate=false`、`minZoom`、`maxZoom` 已正常传入。
- 随后仅向 OrbitControls 添加 `mouseButtons` 和 `touches` props。

### GREEN

- 指定测试：2 个测试文件通过，10 个测试通过。
- `cameraConstraints.test.ts`：9 个测试，包括保留的 clamp tests。
- `CityCameraControls.test.tsx`：1 个 props 集成测试。

## 验证

- `npm.cmd test -- src/scene/city/cameraConstraints.test.ts src/scene/city/CityCameraControls.test.tsx`
  — 通过（2 files，10 tests）。
- `npm.cmd run typecheck` — 通过。
- `npm.cmd run lint` — 通过。
- 编辑文件的 IDE lint diagnostics — 0。

## 自审

- 鼠标映射为 LEFT=PAN、MIDDLE=DOLLY、RIGHT=PAN。
- 触摸映射为 ONE=PAN、TWO=DOLLY_PAN。
- 保留 enableRotate=false、enablePan=true、enableZoom=true、
  screenSpacePanning=false。
- 组件测试证明映射常量由 `CityCameraControls` 消费，并同时检查旋转禁用及
  min/max zoom。
- 改动仅涉及 cameraConstraints、CityCameraControls、对应测试和本报告；
  无阈值或布局改动。
