# Phase 0: 深度差异审计报告 (Deep Impact Analysis)

## 执行时间
生成日期: 2025-01-XX

## 1. Schema Evolution (数据进化)

### 1.1 Firestore 集合变更

#### 新增集合: `visual_profiles`
**位置**: `frontend/services/brandProfileService.ts` (reference_AIS)

**必需字段**:
```typescript
{
  id: string;                    // Document ID
  uid: string;                   // User ID (所有者)
  name: string;                  // 品牌名称 (e.g., "Nike Style")
  description: string;           // 品牌描述
  logoUrl?: string;              // Logo 图片 URL (可选)
  styleReferenceUrl?: string;    // 风格参考图片 URL (可选)
  
  // AI 提取的视觉基因
  visualStyle: string;           // 视觉风格描述
  colorPalette: string;          // 核心配色
  mood: string;                  // 情感氛围
  negativeConstraint: string;    // 避讳元素
  
  // Reel/Video 专用字段
  videoRefs?: string[];          // YouTube URL 数组 (最多 3 个)
  motionStyle?: string;          // 运镜风格 (e.g., "Slow pan, drone FPV")
  
  isActive: boolean;             // 是否激活
  createdAt: number;             // 创建时间戳
}
```

**索引需求**:
- `uid` (单字段索引，已默认)
- 限制：每个用户最多 2 个 Brand DNA

#### 现有集合: `gallery`
**无需修改** - 现有结构已支持 Reel 资产（`type: 'image' | 'video'`）

### 1.2 数据类型扩展

#### `BrandVisualProfile` (新增)
- **位置**: `frontend/types.ts`
- **来源**: `reference_AIS/types.ts` (lines 262-284)
- **变更**: 完整复制该类型定义

#### `ReelAsset` (现有，需验证)
- **现有字段**: 已包含 `sourceAssetId` (用于连线)
- **无需修改**

---

## 2. Logic Migration (逻辑下沉)

### 2.1 需要迁移到后端的 AI 逻辑

#### A. Brand DNA 提取 (`extractBrandDNA`)
**来源**: `reference_AIS/services/geminiService.ts` (lines 349-445)

**功能**: 
- 分析 Logo 图片提取品牌配色
- 分析参考图片提取视觉风格
- (可选) 通过 Google Search 分析 YouTube 视频提取运镜风格

**迁移目标**: `backend/services/brand_dna_service.py` (新建)

**API 端点**: 
- `POST /api/brand-dna/extract`
- Request: `{ logoImage?: {data, mimeType}, referenceImages: [{data, mimeType}], description: string, videoUrls?: string[] }`
- Response: `{ visualStyle, colorPalette, mood, negativeConstraint, motionStyle? }`

**实现要点**:
- 复用 `services/gemini_service.py` 中的 GeminiService
- 支持 Google Search 工具调用（用于视频分析）
- 需要处理图片输入（base64）

#### B. 模态自动检测 (`detectReelModality`)
**来源**: `reference_AIS/services/geminiService_reel.ts` (lines 15-44)

**功能**: 根据用户提示词自动判断是图片还是视频需求

**迁移目标**: `backend/services/gemini_service.py` (新增方法)

**API 端点**:
- `POST /api/reel/detect-modality`
- Request: `{ prompt: string }`
- Response: `{ modality: 'image' | 'video' }`

**实现要点**:
- 使用 `gemini-2.5-flash` 轻量模型
- 返回 JSON 格式

#### C. Brand DNA 注入逻辑
**来源**: `reference_AIS/services/geminiService_reel.ts` (lines 245-296)

**功能**: 在生成提示词时自动注入 Brand DNA 约束

**迁移目标**: `backend/services/gemini_service.py` 或 `backend/routes/reel.py`

**实现要点**:
- 在 `/api/reel/generate` 和 `/api/reel/enhance-prompt` 中接收 `activeProfileId?: string`
- 从 Firestore 读取 Brand DNA 配置
- 根据模型类型（图片/视频）注入不同的约束文本

---

### 2.2 前端逻辑保留（无需迁移）

以下逻辑保留在前端，因为它们主要是 UI 状态管理：

- `useBrandVisualProfiles` Hook: Firestore 订阅和状态管理
- `BrandProfileManagerModal` 组件: UI 交互
- 画布拖拽和连线逻辑: 纯前端交互

---

## 3. API Retrofit (接口改造)

### 3.1 现有接口修改

#### `/api/reel/generate` (修改)
**当前**: `backend/routes/reel.py` (line 417)

**新增参数**:
```python
{
  "prompt": string,
  "model": string,
  "images": [...],
  "aspectRatio": "9:16",
  "sourceAssetId"?: string,
  "activeProfileId"?: string  # 新增：Brand DNA ID
}
```

**修改逻辑**:
1. 如果 `activeProfileId` 存在，从 Firestore 读取 Brand DNA
2. 在生成前将 Brand DNA 约束注入到 prompt
3. 图片模式：如果有 `styleReferenceUrl`，作为输入图片之一
4. 视频模式：只注入文本约束，不使用参考图片

#### `/api/reel/enhance-prompt` (修改)
**当前**: `backend/routes/reel.py` (line 818)

**新增参数**:
```python
{
  "prompt": string,
  "model": string,
  "activeProfileId"?: string  # 新增
}
```

**修改逻辑**: 在优化提示词时考虑 Brand DNA 约束

#### `/api/reel/design-plan` (修改)
**当前**: `backend/routes/reel.py` (line 919)

**新增参数**: `activeProfileId?: string`

**修改逻辑**: 在设计灵感生成时考虑 Brand DNA

### 3.2 新增接口

#### `/api/brand-dna/extract` (新建)
**文件**: `backend/routes/brand_dna.py` (新建)

**功能**: 提取 Brand DNA

**实现**:
- 创建 `backend/services/brand_dna_service.py`
- 复用 `GeminiService` 调用 Gemini API
- 支持多模态输入（Logo + 参考图）
- 支持 Google Search 分析视频 URL

#### `/api/reel/detect-modality` (新建)
**文件**: `backend/routes/reel.py` (新增路由)

**功能**: 自动检测用户意图是图片还是视频

---

## 4. UI Components 迁移清单

### 4.1 必须复制的组件

#### A. Brand DNA 管理系统
1. **`components/image_gen/BrandProfileManagerModal.tsx`**
   - 功能: Brand DNA 创建、编辑、删除、激活 UI
   - 位置: `reference_AIS/components/image_gen/BrandProfileManagerModal.tsx`
   - 目标: `frontend/components/reel_gen/BrandProfileManagerModal.tsx`
   - **注意**: 保持 JSX 结构 100% 不变，只修改 API 调用

2. **`hooks/useBrandVisualProfiles.ts`**
   - 功能: Brand DNA 状态管理 Hook
   - 位置: `reference_AIS/hooks/useBrandVisualProfiles.ts`
   - 目标: `frontend/hooks/useBrandVisualProfiles.ts`
   - **修改点**: 保持 Firestore 订阅逻辑，无需修改

#### B. 服务层
3. **`services/brandProfileService.ts`**
   - 位置: `reference_AIS/services/brandProfileService.ts`
   - 目标: `frontend/services/brandProfileService.ts`
   - **修改点**: 
     - 保留 Firestore 操作部分（无需修改）
     - 移除 `extractBrandDNA` 函数（迁移到后端）
     - 新增 API 调用：`extractBrandDNAFromAPI()`

### 4.2 需要修改的现有组件

#### A. `components/ReelGenerationPage.tsx`
**当前**: `frontend/components/ReelGenerationPage.tsx`
**参考**: `reference_AIS/components/ReelGenerationPage.tsx`

**新增功能**:
1. 导入 `BrandProfileManagerModal`
2. 导入 `useBrandVisualProfiles`
3. 添加 Header 中的 "Brand DNA" 按钮（参考 line 44）
4. 添加 DNA Manager Modal 渲染（参考 lines 49-57）
5. 传递 `activeProfile` 到 `useReelGeneration`

#### B. `components/reel_gen/ReelGenAssets.tsx`
**当前**: `frontend/components/reel_gen/ReelGenAssets.tsx`
**参考**: `reference_AIS/components/reel_gen/ReelGenAssets.tsx`

**修改 Header 组件**:
- 添加 `onOpenBrandDNA?: () => void` prop
- 添加 `activeDNA?: string | null` prop
- 添加 Brand DNA 按钮 UI（参考 lines 53-68）

#### C. `hooks/useReelGeneration.ts`
**当前**: `frontend/hooks/useReelGeneration.ts`
**参考**: `reference_AIS/hooks/useReelGeneration.ts`

**新增功能**:
1. 集成 `useBrandVisualProfiles` (参考 lines 47-53)
2. 在 `executeGeneration` 中传递 `activeProfile` (参考 line 237)
3. 在 `executeEnhancePrompt` 中传递 `activeProfile` (参考 line 264)
4. 在 `executeGetDesignPlan` 中传递 `activeProfile` (参考 line 280)
5. 支持模态自动检测（参考 lines 310-322）
6. 返回 Brand DNA 相关状态（参考 lines 948-950）

#### D. `hooks/useReelApi.ts` (或新建 `services/geminiService_reel.ts`)
**当前**: `frontend/hooks/useReelApi.ts`
**参考**: `reference_AIS/services/geminiService_reel.ts`

**新增函数**:
1. `detectReelModality(prompt: string)` - 调用后端 `/api/reel/detect-modality`
2. `extractBrandDNA(...)` - 调用后端 `/api/brand-dna/extract`

**修改现有函数**:
- `generateReelAsset`: 添加 `activeProfileId?: string` 参数
- `getReelEnhancement`: 添加 `activeProfileId?: string` 参数
- `getReelDesignPlan`: 添加 `activeProfileId?: string` 参数

---

## 5. 关键架构差异总结

### 5.1 API 调用方式差异

| 功能 | reference_AIS | 现有 frontend | 迁移策略 |
|------|---------------|---------------|----------|
| Gemini API 调用 | 前端直接调用 (`@google/genai`) | 后端 API (`/api/reel/*`) | ✅ **保持后端 API 架构** |
| Brand DNA 提取 | 前端调用 Gemini | 需迁移到后端 | ⚠️ **新建后端 API** |
| 模态检测 | 前端调用 Gemini | 需迁移到后端 | ⚠️ **新建后端 API** |

### 5.2 数据流对比

**reference_AIS 数据流**:
```
User Input → Frontend (Gemini SDK) → Gemini API → Response
                ↓
        Firestore (Brand DNA)
```

**现有架构数据流**:
```
User Input → Frontend → Backend API → Gemini Service → Gemini API → Response
                                            ↓
                                    Firestore (Brand DNA - 待添加)
```

**迁移后目标数据流**:
```
User Input → Frontend → Backend API (带 Brand DNA) → Gemini Service → Gemini API → Response
                                            ↓
                                    Firestore (Brand DNA)
```

---

## 6. 实施优先级

### Phase 1: 核心后端升级（必须）
1. ✅ 创建 `backend/services/brand_dna_service.py`
2. ✅ 创建 `backend/routes/brand_dna.py`
3. ✅ 修改 `backend/routes/reel.py`：
   - 添加 `/api/reel/detect-modality` 端点
   - 修改 `/api/reel/generate` 支持 Brand DNA
   - 修改 `/api/reel/enhance-prompt` 支持 Brand DNA
   - 修改 `/api/reel/design-plan` 支持 Brand DNA
4. ✅ 在 `backend/services/gemini_service.py` 中添加 Brand DNA 注入逻辑

### Phase 2: 前端视觉移植（必须）
1. ✅ 复制 `BrandProfileManagerModal.tsx`
2. ✅ 复制 `useBrandVisualProfiles.ts`
3. ✅ 复制 `brandProfileService.ts`（修改 API 调用）
4. ✅ 更新 `ReelGenerationPage.tsx`
5. ✅ 更新 `ReelGenAssets.tsx` Header
6. ✅ 更新 `useReelGeneration.ts`
7. ✅ 更新 `useReelApi.ts`（或新建服务文件）

### Phase 3: 类型定义同步（必须）
1. ✅ 更新 `frontend/types.ts` 添加 `BrandVisualProfile`

### Phase 4: Firestore 安全规则（必须）
1. ✅ 配置 `visual_profiles` 集合的 Firestore Security Rules
2. ✅ 确保每个用户最多 2 个 Brand DNA

---

## 7. 风险评估与兼容性

### 7.1 向后兼容性
- ✅ **现有 API 保持兼容**: 所有新参数都是可选的（`activeProfileId?`）
- ✅ **旧 UI 继续工作**: 如果用户不使用 Brand DNA，行为与现在完全一致

### 7.2 数据迁移
- ⚠️ **无需迁移**: Brand DNA 是新功能，现有用户数据不受影响

### 7.3 性能影响
- ✅ **最小影响**: Brand DNA 读取是 Firestore 单文档查询（快速）
- ✅ **可选功能**: 用户可以选择不使用 Brand DNA

---

## 8. 测试清单

### 后端测试
- [ ] `/api/brand-dna/extract` - Logo + 参考图提取
- [ ] `/api/brand-dna/extract` - 包含 YouTube URL 的视频分析
- [ ] `/api/reel/detect-modality` - 图片意图检测
- [ ] `/api/reel/detect-modality` - 视频意图检测
- [ ] `/api/reel/generate` - 带 Brand DNA 的图片生成
- [ ] `/api/reel/generate` - 带 Brand DNA 的视频生成
- [ ] `/api/reel/enhance-prompt` - 带 Brand DNA 的提示词优化

### 前端测试
- [ ] Brand DNA 创建流程（Logo + 参考图）
- [ ] Brand DNA 创建流程（包含视频 URL）
- [ ] Brand DNA 激活/停用
- [ ] Brand DNA 编辑
- [ ] Brand DNA 删除
- [ ] 模态自动检测 UI
- [ ] 生成时 Brand DNA 生效验证

---

## 9. 部署检查清单

### 后端部署
- [ ] Firestore 索引创建（`visual_profiles` 集合的 `uid` 索引）
- [ ] Firestore 安全规则更新（允许用户读写自己的 `visual_profiles`）
- [ ] 环境变量确认（`GEMINI_API_KEY`, Firebase credentials）

### 前端部署
- [ ] 构建通过（`npm run build`）
- [ ] 类型检查通过（`tsc --noEmit`）

---

## 10. 已知问题与限制

1. **Brand DNA 数量限制**: 每个用户最多 2 个（UI 中硬编码）
2. **视频 URL 分析**: 依赖 Google Search 工具，可能在某些地区不可用
3. **Firestore 权限**: 需要确保 `visual_profiles` 集合的安全规则正确配置

---

## 下一步

**确认此 Plan 后，开始 Phase 1 实施。**
