# 画布交互功能重构总结文档

## 一、重构概述

本次重构主要解决了 ReelCanvas 组件的画布交互功能问题，通过对比 ImageCanvas 的实现，修复了适配功能失效和对话区域显示异常的问题。

**重构时间**: 2024年
**涉及组件**: `ReelCanvas.tsx`, `useReelGeneration.ts`, `ReelGenerationPage.tsx`
**参考实现**: `ImageCanvas.tsx`, `useImageGeneration.ts`

---

## 二、核心问题诊断

### 2.1 问题1: 画布适配功能（fitToScreen）失效

**症状**: 点击"适配"按钮后，画布无法正确适配到视口，无法查看所有资源。

**根本原因**:
1. `ReelCanvas` 组件缺少 `canvasRef` prop 的接收和传递
2. transform 容器 div 没有绑定 `canvasRef`
3. `fitToScreen` 函数依赖 `canvasRef.current.parentElement` 获取容器尺寸，但 ref 未正确绑定导致获取失败

**对比发现**:
- ✅ `ImageCanvas`: 接收 `canvasRef` prop，并在 transform div 上绑定 ref
- ❌ `ReelCanvas`: 未接收 `canvasRef` prop，transform div 无 ref 绑定

### 2.2 问题2: 对话输入区域显示异常

**症状**: 点击"对话"工具后，对话输入框位置不正确、样式不统一、缩放时位置偏移。

**根本原因**:
1. 缺少 wrapper div (`on-canvas-chat-box-wrapper`)
2. 位置计算方式不一致：使用 Tailwind 类名而非 style 对象
3. transform 计算不完整：缺少 `translateY` 调整，导致缩放时位置偏移
4. 样式规格不一致：宽度、圆角、内边距、文字大小都与 ImageCanvas 不同

**对比发现**:
- ✅ `ImageCanvas`: 使用 wrapper + style 对象，完整的 transform 计算
- ❌ `ReelCanvas`: 直接使用 Tailwind 类名，transform 计算不完整

### 2.3 问题3: 缩放交互体验不一致

**症状**: 滚轮缩放和按钮缩放的行为与 ImageCanvas 不一致。

**根本原因**:
- `handleCanvasWheel`: 简化版本，不支持基于鼠标位置的缩放
- `zoom`: 不支持基于画布中心的缩放计算

---

## 三、核心修复逻辑

### 3.1 canvasRef 传递链路

**修复原理**: 建立完整的 ref 传递链路，使 hooks 中的函数能够访问 DOM 元素。

```
useReelGeneration (创建 canvasRef)
    ↓
ReelGenerationPage (接收并传递)
    ↓
ReelCanvas (接收并绑定到 DOM)
```

**关键代码位置**:

1. **hooks/useReelGeneration.ts** (line 96):
```typescript
const canvasRef = useRef<HTMLDivElement>(null);
```

2. **components/ReelGenerationPage.tsx** (line 29, 124):
```typescript
// 从 hook 解构
canvasRef,
// 传递给组件
<ReelCanvas canvasRef={canvasRef} ... />
```

3. **components/reel_gen/ReelCanvas.tsx** (line 16, 48, 115):
```typescript
// 接口定义
canvasRef: React.RefObject<HTMLDivElement>;

// 组件参数
canvasRef,

// DOM 绑定
<div ref={canvasRef} className="absolute top-0 left-0 w-full h-full ...">
```

### 3.2 fitToScreen 实现逻辑

**核心算法**:

1. **获取容器尺寸**: 通过 `canvasRef.current.parentElement` 获取视口尺寸
2. **计算内容边界**: 遍历所有 assets，计算最小包围盒（minX, minY, maxX, maxY）
3. **计算缩放比例**: 
   ```typescript
   const scaleX = availableW / contentWidth;
   const scaleY = availableH / contentHeight;
   const fitScale = Math.min(scaleX, scaleY); // 取较小值，确保内容完全可见
   ```
4. **计算居中位置**:
   ```typescript
   const contentCenterX = minX + contentWidth / 2;
   const viewportCenterX = viewportW / 2;
   const newX = viewportCenterX - (contentCenterX * fitScale);
   ```

**关键约束**:
- `fitScale` 限制在 `[0.1, 1.0]` 范围内（ReelCanvas）或 `[0.1, 1.2]`（ImageCanvas）
- 添加 padding（通常 100px）确保内容不完全贴边

### 3.3 对话区域定位逻辑

**Wrapper 结构**:
```typescript
<div className="on-canvas-chat-box-wrapper absolute z-20"
     style={{
         left: '50%',           // 相对于 asset 的左边缘
         top: '100%',           // 相对于 asset 的底部
         transformOrigin: 'top center',
         transform: `translate(-50%, 0) translateY(${16 / transform.scale}px) scale(${1 / transform.scale})`
     }}>
```

**Transform 分解**:
1. `translate(-50%, 0)`: 水平居中（相对于 asset 宽度）
2. `translateY(${16 / transform.scale}px)`: 垂直偏移，根据缩放比例调整间距
3. `scale(${1 / transform.scale})`: 反向缩放，保持对话框在视觉上大小不变

**为什么需要反向缩放**:
- 画布整体被 `transform.scale` 缩放
- 对话框位于画布坐标系内，会被同比例缩放
- 通过 `scale(${1 / transform.scale})` 抵消缩放，保持对话框固定大小

### 3.4 基于鼠标位置的缩放

**原理**: 以鼠标位置为缩放中心点，而不是画布中心。

**算法步骤**:

1. **获取鼠标在画布中的相对位置**:
   ```typescript
   const rect = canvasRef.current.getBoundingClientRect();
   const mouseX = e.clientX - rect.left;
   const mouseY = e.clientY - rect.top;
   ```

2. **计算新缩放比例**:
   ```typescript
   const delta = -e.deltaY * sensitivity; // 0.001
   const newScale = Math.min(Math.max(0.1, 5.0), prev.scale + delta);
   ```

3. **调整位置以保持鼠标点不变**:
   ```typescript
   const scaleRatio = newScale / prev.scale;
   // 鼠标点在缩放前后应该在同一屏幕位置
   const newX = mouseX - (mouseX - prev.x) * scaleRatio;
   const newY = mouseY - (mouseY - prev.y) * scaleRatio;
   ```

**数学原理**:
- 缩放前：鼠标点在画布坐标系的位置 = `(mouseX - prev.x) / prev.scale`
- 缩放后：该点在屏幕上的位置 = `prev.x + (鼠标点画布坐标) * newScale`
- 为保持鼠标点在同一屏幕位置：`newX = mouseX - (鼠标点画布坐标) * newScale`

---

## 四、关键提示词（Prompt Patterns）

### 4.1 对比分析提示词

```
对比 @reference_AIS 中的 @hooks 或其他文件夹中的文件，
找到差异进行修复；先给出解决方案，等我人工确认
```

**要点**:
- 明确指定参考源：`@reference_AIS`
- 指定对比范围：`@hooks` 或其他文件夹
- 强调"找到差异"而非重新实现
- 要求先提供方案，等待确认

### 4.2 问题描述提示词

```
画布有些能力比如适配等还是没有起作用，100%复刻交互逻辑
```

**要点**:
- 明确问题：适配功能不起作用
- 强调目标：100% 复刻（完全一致）
- 聚焦点：交互逻辑

### 4.3 验证要求提示词

```
如图所示和检查最新日志，选择图片的功能区和点击对话显示的对话区域的显示都有问题
```

**要点**:
- 结合视觉证据（截图）
- 结合日志分析
- 具体描述问题区域
- 双重验证（视觉 + 日志）

---

## 五、注意事项（Critical Notes）

### 5.1 代码一致性原则

⚠️ **重要**: 当存在参考实现时，优先保持与参考实现的一致性，而非独立优化。

**示例**:
- ✅ 对话框样式：完全对齐 ImageCanvas（宽度 300px，圆角 rounded-2xl）
- ❌ 独立设计：可能导致用户体验不统一

### 5.2 ref 传递完整性

⚠️ **关键检查点**:
1. Hook 中创建 ref
2. Hook 返回 ref
3. 组件接收 ref prop
4. 组件绑定 ref 到 DOM

**遗漏检查**: 任何一个环节缺失都会导致功能失效，但不会报错！

### 5.3 Transform 坐标系理解

⚠️ **核心概念**: 
- CSS transform 的坐标系是**相对于元素本身**的
- `left: '50%'` 是相对于父元素宽度的 50%
- `translate(-50%, 0)` 是相对于元素自身宽度的 -50%
- 组合使用实现居中：`left: 50%` + `translateX(-50%)`

### 5.4 缩放时的位置补偿

⚠️ **常见错误**: 只应用 `scale()` 而不调整 `translate()`，导致内容位置偏移。

**正确做法**:
```typescript
// ❌ 错误：只缩放
transform: `scale(${scale})`

// ✅ 正确：缩放 + 位置补偿
transform: `translate(${x}px, ${y}px) scale(${scale})`
// 或者使用反向缩放保持大小
transform: `scale(${1 / scale})` // 在已被缩放的容器内
```

### 5.5 Z-index 层级管理

⚠️ **层级顺序** (从底到顶):
- `z-0`: 背景网格
- `z-10`: 普通 assets
- `z-20`: Toolbar、对话框 wrapper
- `z-30`: 选中的 assets（包含 ring）
- `z-40`: Snap guides
- `z-50`: 临时弹窗（如菜单）

**注意**: 对话框的 wrapper 使用 `z-20`，内容使用更高的 z-index 层级。

### 5.6 事件传播控制

⚠️ **关键**: 对话框和工具栏需要阻止事件冒泡，避免触发画布的拖拽或选择。

```typescript
onMouseDown={e => e.stopPropagation()}
onClick={e => e.stopPropagation()}
```

### 5.7 性能考虑

⚠️ **优化点**:
- `handleCanvasWheel` 使用 `useCallback` 避免重复创建函数
- Transform 计算在状态更新时进行，避免在 render 中计算
- 缩放限制范围：`[0.1, 5.0]` 防止极端值

---

## 六、修复清单（Checklist）

### 6.1 canvasRef 传递检查

- [ ] Hook 中创建 `const canvasRef = useRef<HTMLDivElement>(null)`
- [ ] Hook 返回中包含 `canvasRef`
- [ ] 组件接口定义 `canvasRef: React.RefObject<HTMLDivElement>`
- [ ] 组件参数解构包含 `canvasRef`
- [ ] DOM 元素绑定 `ref={canvasRef}`

### 6.2 对话区域检查

- [ ] 使用 `on-canvas-chat-box-wrapper` wrapper
- [ ] 使用 style 对象而非 Tailwind 类名定位
- [ ] transform 包含 `translateY(${16 / transform.scale}px)`
- [ ] transform 包含反向缩放 `scale(${1 / transform.scale})`
- [ ] 样式规格与参考实现一致（宽度、圆角、内边距）

### 6.3 缩放功能检查

- [ ] `handleCanvasWheel` 获取鼠标位置
- [ ] 缩放时计算位置补偿
- [ ] `zoom` 函数基于画布中心计算
- [ ] `setZoomLevel` 正确处理位置调整

### 6.4 适配功能检查

- [ ] `fitToScreen` 检查 `canvasRef.current`
- [ ] 获取 `parentElement` 作为容器
- [ ] 计算所有 assets 的边界
- [ ] 应用 padding 和缩放限制

---

## 七、测试验证方法

### 7.1 适配功能测试

1. 生成多个 assets（图片/视频）
2. 缩放画布到任意比例
3. 点击"适配"按钮
4. **预期**: 所有 assets 可见，居中显示，有适当边距

### 7.2 对话区域测试

1. 切换到"对话"工具（按 C 或点击按钮）
2. 点击任意 asset
3. **预期**: 
   - 对话框出现在 asset 下方
   - 位置居中
   - 缩放画布时，对话框保持相对位置
   - 样式与 ImageCanvas 一致

### 7.3 缩放交互测试

1. 鼠标悬停在画布某位置
2. 滚动鼠标滚轮
3. **预期**: 以鼠标位置为中心缩放，鼠标点保持在同一屏幕位置

### 7.4 选择状态测试

1. 点击 asset 选择
2. **预期**: 
   - 显示紫色 ring 边框（`ring-4 ring-indigo-500`）
   - Toolbar 出现在上方
   - Z-index 正确（选中 asset 在上层）

---

## 八、文件变更清单

### 8.1 核心修改文件

1. **frontend/components/reel_gen/ReelCanvas.tsx**
   - 添加 `canvasRef` prop 定义和接收
   - 绑定 ref 到 transform div
   - 修复对话输入区域结构和样式

2. **frontend/components/ReelGenerationPage.tsx**
   - 传递 `canvasRef` 给 ReelCanvas

3. **frontend/hooks/useReelGeneration.ts**
   - 优化 `handleCanvasWheel`（基于鼠标位置缩放）
   - 优化 `zoom`（基于中心缩放）

### 8.2 参考实现文件

1. **frontend/components/image_gen/ImageCanvas.tsx**
   - 作为参考实现的标准
   - line 19, 58: canvasRef 绑定
   - line 116-146: 对话区域实现

2. **frontend/hooks/useImageGeneration.ts**
   - line 665-681: handleCanvasWheel 实现
   - line 713-779: fitToScreen 实现

---

## 九、经验总结

### 9.1 调试技巧

1. **添加日志**: 在关键函数中添加 `console.log` 检查 ref 是否为 null
2. **React DevTools**: 检查组件 props 是否正确传递
3. **浏览器调试**: 检查 DOM 元素的 ref 是否正确绑定

### 9.2 常见陷阱

1. **ref 传递链断裂**: 中间组件忘记传递 prop
2. **transform 叠加**: 多层 transform 导致计算复杂
3. **坐标系混淆**: 屏幕坐标 vs 画布坐标 vs 元素坐标

### 9.3 最佳实践

1. **保持一致性**: 同一功能的多个实现应保持一致
2. **注释说明**: 复杂的 transform 计算添加注释
3. **类型安全**: TypeScript 类型定义要完整
4. **渐进修复**: 先修复核心问题，再优化细节

---

## 十、后续优化建议

### 10.1 代码重构

- [ ] 提取通用的画布交互逻辑到共享 hook
- [ ] 统一 ImageCanvas 和 ReelCanvas 的实现
- [ ] 添加 TypeScript 类型定义文件

### 10.2 功能增强

- [ ] 添加键盘快捷键支持（如 Space 拖拽画布）
- [ ] 支持多选 assets
- [ ] 添加撤销/重做功能

### 10.3 性能优化

- [ ] 使用 `requestAnimationFrame` 优化动画
- [ ] 虚拟滚动（如果 assets 数量很多）
- [ ] 防抖处理频繁的缩放操作

---

## 附录：关键代码片段

### A.1 canvasRef 绑定

```tsx
// ReelCanvas.tsx
<div ref={canvasRef} 
     className="absolute top-0 left-0 w-full h-full origin-top-left transition-transform duration-75 ease-linear" 
     style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}>
```

### A.2 对话区域定位

```tsx
// ReelCanvas.tsx
<div className="on-canvas-chat-box-wrapper absolute z-20"
     style={{
         left: '50%',
         top: '100%',
         transformOrigin: 'top center',
         transform: `translate(-50%, 0) translateY(${16 / transform.scale}px) scale(${1 / transform.scale})`
     }}>
```

### A.3 基于鼠标位置的缩放

```typescript
// useReelGeneration.ts
const handleCanvasWheel = useCallback((e: React.WheelEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const sensitivity = 0.001;
    const delta = -e.deltaY * sensitivity;

    setTransform(prev => {
        const targetScale = prev.scale + delta;
        const newScale = Math.min(Math.max(0.1, 5.0), targetScale);
        const scaleRatio = newScale / prev.scale;
        const newX = mouseX - (mouseX - prev.x) * scaleRatio;
        const newY = mouseY - (mouseY - prev.y) * scaleRatio;
        return { scale: newScale, x: newX, y: newY };
    });
}, []);
```

---

**文档版本**: 1.0  
**最后更新**: 2024年  
**维护者**: 开发团队
