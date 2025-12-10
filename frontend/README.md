# Reel Generation Frontend

基于 React 19 + TypeScript 的现代化前端应用，提供直观的 Reel 生成界面。

## 🏗️ 技术栈

- **React 19.2.0**: UI 框架
- **TypeScript 5.8**: 类型安全
- **Vite 6.2**: 构建工具
- **Firebase 12.6.0**: 用户认证
- **@google/genai 1.28.0**: Gemini API 客户端（前端直接调用，部分功能）

## 📁 目录结构

```
frontend/
├── components/              # React 组件
│   ├── common/             # 通用组件
│   │   ├── LogoIcon.tsx
│   │   └── UserStatusChip.tsx
│   ├── reel_gen/          # Reel 生成相关组件
│   │   ├── ReelCanvas.tsx
│   │   ├── ReelChatSidebar.tsx
│   │   ├── ReelGenAssets.tsx
│   │   └── ConnectionLinesLayer.tsx
│   ├── image_gen/          # 图片生成组件
│   │   └── ImageGenAssets.tsx
│   ├── launch/             # 启动页组件
│   │   └── LaunchIcons.tsx
│   ├── LaunchPage.tsx      # 启动页
│   ├── LoginPage.tsx      # 登录页
│   ├── WorkspacePage.tsx   # 工作区
│   ├── ImageGenerationPage.tsx
│   ├── VideoGenerationPage.tsx
│   └── ReelGenerationPage.tsx  # 主页面
├── hooks/                  # 自定义 Hooks
│   ├── useReelApi.ts      # Reel API 调用
│   ├── useReelGeneration.ts
│   └── useUserProfile.ts
├── services/              # 前端服务
│   ├── geminiService_reel.ts
│   ├── galleryService.ts
│   └── userService.ts
├── firebaseConfig.ts       # Firebase 配置
├── types.ts               # TypeScript 类型定义
├── App.tsx                # 应用入口
└── index.tsx              # 渲染入口
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 环境变量

创建 `.env.local` 文件：

```bash
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:5173` 启动。

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

### 预览生产构建

```bash
npm run preview
```

## 🎨 主要功能

### 1. Reel 生成页面

**组件**: `ReelGenerationPage.tsx`

**功能**:
- 智能对话式界面
- 图片和视频生成
- 实时预览和编辑
- 资产管理和组织

**关键组件**:
- `ReelCanvas`: 画布展示生成的资产
- `ReelChatSidebar`: 对话侧边栏
- `ReelGenAssets`: 资产列表和管理
- `ConnectionLinesLayer`: 资产关联可视化

### 2. 用户认证

**组件**: `LoginPage.tsx`

**功能**:
- Firebase Authentication 集成
- 自动登录状态管理
- 用户信息显示

### 3. 启动页

**组件**: `LaunchPage.tsx`

**功能**:
- 应用介绍
- 快速入口
- 功能导航

## 🔌 API 集成

### 使用 useReelApi Hook

```typescript
import { useReelApi } from './hooks/useReelApi';

function MyComponent() {
  const { generateAsset, enhancePrompt } = useReelApi();
  
  const handleGenerate = async () => {
    const result = await generateAsset({
      prompt: 'A cat',
      model: 'banana',
      aspectRatio: '9:16'
    });
    console.log(result);
  };
}
```

### 直接调用 API

```typescript
import { callReelApi } from './services/geminiService_reel';

const response = await callReelApi('/api/reel/generate', {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'A cat',
    model: 'banana'
  })
});
```

## 🔐 Firebase 认证

### 配置

在 `firebaseConfig.ts` 中配置 Firebase：

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-auth-domain",
  projectId: "your-project-id",
  // ...
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

### 使用认证

```typescript
import { auth } from './firebaseConfig';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

// 登录
const user = await signInWithEmailAndPassword(auth, email, password);

// 获取 ID Token（用于 API 调用）
const token = await user.user.getIdToken();

// 登出
await signOut(auth);
```

## 📦 类型定义

主要类型定义在 `types.ts`：

```typescript
interface ReelAsset {
  assetId: string;
  type: 'image' | 'video';
  src: string;
  prompt: string;
  width: number;
  height: number;
  status: 'pending' | 'generating' | 'done' | 'error';
  generationModel: string;
}

interface ReelMessage {
  role: 'user' | 'assistant';
  content: string;
  type?: string;
}
```

## 🎯 状态管理

应用使用 React Hooks 进行状态管理：

- **useState**: 组件本地状态
- **useEffect**: 副作用处理
- **useCallback**: 函数记忆化
- **自定义 Hooks**: 业务逻辑封装

## 🧪 开发建议

### 组件设计

- 保持组件小而专注
- 使用 TypeScript 类型约束
- 提取可复用逻辑到 Hooks

### 性能优化

- 使用 `React.memo` 避免不必要的重渲染
- 使用 `useCallback` 和 `useMemo` 优化性能
- 图片和视频懒加载

### 错误处理

- 使用 try-catch 处理异步错误
- 提供友好的错误提示
- 记录错误日志

## 📱 响应式设计

应用支持多种屏幕尺寸：
- 桌面端：完整功能界面
- 移动端：适配触摸操作

## 🔄 与后端集成

### API 调用流程

1. 用户操作触发前端事件
2. 获取 Firebase ID Token
3. 调用后端 API（携带 Token）
4. 处理响应并更新 UI

### 错误处理

```typescript
try {
  const result = await generateAsset({...});
  // 处理成功
} catch (error) {
  if (error.status === 401) {
    // 认证失败，重新登录
  } else if (error.status === 500) {
    // 服务器错误
  }
}
```

## 🚀 部署

### 构建

```bash
npm run build
```

### 部署到静态托管

构建产物在 `dist/` 目录，可以部署到：
- Firebase Hosting
- Cloud Run（与后端一起部署）
- 其他静态托管服务

### 与后端一起部署

如果使用 Cloud Run，前端构建产物会被包含在 Docker 镜像中，由 Flask 提供静态文件服务。

## 📝 注意事项

- 确保 Firebase 配置正确
- API 调用需要有效的 Firebase ID Token
- 生产环境使用环境变量管理敏感信息
- 注意 CORS 配置（如果前后端分离部署）

## 🔗 相关文档

- [后端文档](../backend/README.md)
- [主 README](../README.md)
- [部署文档](../CLOUD_RUN_DEPLOYMENT.md)
