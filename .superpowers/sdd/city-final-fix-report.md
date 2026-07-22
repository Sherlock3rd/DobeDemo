# 城市 Demo 最终 Minor 修复报告

## 修改

- 在 `cameraConstraints.ts` 导出只读常量 `CAMERA_CONTROL_FLAGS`，固定关闭旋转、开启平移和缩放，并关闭屏幕空间平移。
- `CityCameraControls.tsx` 通过属性展开消费 `CAMERA_CONTROL_FLAGS`，移除对应的重复硬编码。
- 在 `.city-hud` 添加 `pointer-events: none`，使 HUD 覆盖区域的指针事件穿透到画布。
- 未修改 `.building-panel` 及其子元素的指针事件，面板交互保持不变。

## TDD RED / GREEN

### RED

先在 `cameraConstraints.test.ts` 添加 `CAMERA_CONTROL_FLAGS` 的完整配置断言，再运行：

`npm test -- src/scene/city/cameraConstraints.test.ts`

结果：退出码 1；1 个测试失败、6 个测试通过。失败原因符合预期：`CAMERA_CONTROL_FLAGS` 尚未导出，收到 `undefined`。

### GREEN

实现常量并让 `CityCameraControls.tsx` 消费后，重新运行同一命令。

结果：退出码 0；1 个测试文件通过，7 个测试全部通过。

## 验证结果

- 定向相机测试：通过，1 个测试文件、7 个测试。
- 全套测试 `npm test`：通过，10 个测试文件、61 个测试。
- TypeScript `npm run typecheck`：通过，退出码 0。
- ESLint `npm run lint`：通过，退出码 0。
- Prettier 初次 `npm run format:check`：退出码 1，发现两个本次修改的 TypeScript 文件格式不符合；执行定向 Prettier 格式化后复查通过。
- Prettier 复查 `npm run format:check`：通过，所有文件符合格式。
- 生产构建 `npm run build`：通过，585 个模块完成转换并生成 `dist`。

## 关注事项

- 构建仍报告既有的大于 500 kB 分块警告；产物生成成功，本次 Minor 修复未扩大到代码拆分优化。
- 未初始化 Git，也未执行提交操作。
