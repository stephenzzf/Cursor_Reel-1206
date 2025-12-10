# AIS Reel - AI 驱动的 Reel 生成平台

基于 Google Gemini API 的智能 Reel（图片和视频）生成应用，支持创意意图分析、提示词优化、设计灵感生成等功能。

## 🎯 核心功能

### 1. 智能 Reel 生成
- **图片生成**：支持 `banana` (gemini-2.5-flash-image) 和 `banana_pro` (gemini-3-pro-image-preview) 模型
- **视频生成**：支持 `veo_fast` (veo-3.1-fast-generate-preview) 和 `veo_gen` (veo-3.1-generate-preview) 模型
- **图片转视频**：支持基于参考图片生成视频（首尾帧插值）
- **宽高比支持**：默认 9:16（Reel 格式），支持多种比例

### 2. 创意总监（Creative Director）
- **智能意图分析**：自动判断用户意图（新建/编辑/问答）
- **模型匹配检测**：检测用户需求与当前模型是否匹配
- **上下文理解**：基于对话历史和资产状态进行决策

### 3. 提示词优化
- **多方案生成**：为每个提示词生成 3 个创意方向
- **视频专用优化**：遵循 VEO Golden Rules（主题+动作+环境+灯光+镜头+风格）
- **图片专用优化**：艺术风格和视觉趋势分析

### 4. 设计灵感方案
- **趋势研究**：基于 Google Search 进行视觉趋势研究
- **三套方案**：为每个主题生成 3 套不同的设计策略
- **参考图片生成**：为每个方案生成参考图片

### 5. 图片处理
- **高清放大**：使用 Imagen 模型提升图片质量
- **背景去除**：智能分割前景和背景
- **参考图片生成**：快速生成设计参考图

## 🏗️ 技术架构

### 后端技术栈
- **框架**：Flask 3.0.0
- **AI 服务**：
  - Google Gemini API (gemini-2.5-flash, gemini-2.5-pro)
  - Gemini Image Models (gemini-2.5-flash-image, gemini-3-pro-image-preview)
  - Veo 3.1 Video Models (veo-3.1-fast-generate-preview, veo-3.1-generate-preview)
- **认证与存储**：
  - Firebase Admin SDK (用户认证)
  - Firebase Storage (文件存储)
  - Firestore (元数据存储)
- **部署**：Google Cloud Run (Docker 容器化)

### 前端技术栈
- **框架**：React 19.2.0 + TypeScript 5.8
- **构建工具**：Vite 6.2
- **认证**：Firebase Authentication
- **UI 组件**：自定义组件库

### 项目结构
```
├── backend/              # Flask 后端
│   ├── app.py           # 应用入口
│   ├── routes/          # API 路由
│   │   └── reel.py     # Reel 生成 API
│   ├── services/        # 业务服务
│   │   ├── gemini_service.py      # Gemini API 封装
│   │   └── video_asset_service.py # 视频资源管理
│   └── utils/           # 工具函数
│       └── auth.py     # Firebase 认证中间件
├── frontend/            # React 前端
│   ├── components/     # React 组件
│   ├── hooks/          # 自定义 Hooks
│   └── services/       # 前端服务
├── scripts/            # 部署和配置脚本
├── test/               # 测试文档和脚本
└── Dockerfile          # Docker 构建配置
```

## 🚀 快速开始

### 环境要求
- Python 3.11+
- Node.js 18+
- Google Cloud SDK (用于部署)
- Firebase 项目

### 本地开发

#### 1. 后端设置
```bash
cd backend
pip install -r requirements.txt

# 创建 .env 文件
cat > .env << EOF
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json
FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com
PORT=8787
FLASK_DEBUG=false
EOF

# 运行后端
python app.py
```

#### 2. 前端设置
```bash
cd frontend
npm install

# 创建 .env.local 文件
echo "VITE_GEMINI_API_KEY=your_gemini_api_key" > .env.local

# 运行前端开发服务器
npm run dev
```

### 部署到 Cloud Run

详细部署指南请参考：
- [CLOUD_RUN_DEPLOYMENT.md](./CLOUD_RUN_DEPLOYMENT.md) - 完整部署指南
- [FIREBASE_CLOUD_RUN_SETUP.md](./FIREBASE_CLOUD_RUN_SETUP.md) - Firebase 配置指南
- [scripts/README.md](./scripts/README.md) - 自动化脚本使用指南

#### 快速部署命令
```bash
# 使用自动化脚本配置 Firebase Secret
./scripts/setup_firebase_secret.sh

# 部署到 Cloud Run
gcloud run deploy ais-reel \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated
```

## 📡 API 端点

所有 API 端点都需要 Firebase ID Token（在 `Authorization: Bearer <token>` header 中）。

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/reel/creative-director` | POST | 分析用户意图并决定下一步动作 |
| `/api/reel/generate` | POST | 生成 Reel 资产（图片或视频） |
| `/api/reel/enhance-prompt` | POST | 优化提示词（生成 3 个创意方向） |
| `/api/reel/design-plan` | POST | 获取设计灵感方案（3 套策略） |
| `/api/reel/upscale` | POST | 高清放大图片 |
| `/api/reel/remove-background` | POST | 去除背景 |
| `/api/reel/reference-image` | POST | 生成参考图片 |
| `/health` | GET | 健康检查 |

### API 示例

#### 生成图片
```bash
curl -X POST http://localhost:8787/api/reel/generate \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A cinematic portrait of a cat",
    "model": "banana",
    "aspectRatio": "9:16"
  }'
```

#### 生成视频
```bash
curl -X POST http://localhost:8787/api/reel/generate \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Drone FPV shot of a mountain landscape at golden hour",
    "model": "veo_fast",
    "aspectRatio": "9:16",
    "images": [{"data": "base64_image_data", "mimeType": "image/jpeg"}]
  }'
```

## 🔐 环境变量配置

### 后端环境变量
```bash
# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key

# Firebase 配置（二选一）
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json
# 或
FIREBASE_CREDENTIALS_JSON={"type":"service_account",...}
FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com

# Flask 配置
PORT=8080
FLASK_DEBUG=false
```

### 前端环境变量
```bash
# .env.local
VITE_GEMINI_API_KEY=your_gemini_api_key
```

## 🧪 测试

### 后端测试
```bash
cd backend
pytest tests/ -v
```

### 集成测试
```bash
# 运行完整集成测试
cd test
./test_integration.sh
```

## 📚 文档

- [后端文档](./backend/README.md) - 后端 API 详细文档
- [前端文档](./frontend/README.md) - 前端开发指南
- [部署文档](./CLOUD_RUN_DEPLOYMENT.md) - Cloud Run 部署指南
- [Firebase 配置](./FIREBASE_CLOUD_RUN_SETUP.md) - Firebase 详细配置
- [脚本使用](./scripts/README.md) - 自动化脚本说明

## 🔄 持续部署

项目已配置 Cloud Build 持续部署：
- 推送到 `main` 分支自动触发构建
- 自动部署到 Cloud Run
- 支持多环境配置

## 🛠️ 开发规范

- **KISS 原则**：保持简单，避免过度抽象
- **YAGNI 原则**：只实现当前需要的功能
- **模块化设计**：路由、服务、工具分层清晰
- **错误处理**：完善的异常处理和日志记录
- **安全第一**：所有 API 使用 Firebase 认证保护

## 📝 更新日志

### 最新功能
- ✅ 支持 Veo 3.1 视频生成（文本和图片转视频）
- ✅ 智能创意总监（意图分析和模型匹配）
- ✅ 提示词优化（多方案生成）
- ✅ 设计灵感方案（趋势研究和策略生成）
- ✅ Firebase Storage 集成（视频资源管理）
- ✅ Cloud Run 部署支持（Docker 容器化）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
