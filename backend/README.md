# Reel Generation Backend

Flask 后端服务，提供安全的 Reel 生成 API（图片和视频）。

## 🏗️ 架构

- **Flask 3.0.0**: Web 框架
- **Firebase Admin SDK**: 用户认证和存储
- **Google Gemini API**: AI 生成服务
  - `gemini-2.5-flash`: 快速文本生成
  - `gemini-2.5-pro`: 复杂任务和函数调用
  - `gemini-2.5-flash-image`: 图片生成（banana）
  - `gemini-3-pro-image-preview`: 高质量图片生成（banana_pro）
  - `veo-3.1-fast-generate-preview`: 快速视频生成（veo_fast）
  - `veo-3.1-generate-preview`: 标准视频生成（veo_gen）
- **Blueprint 模式**: 模块化路由设计

## 📁 目录结构

```
backend/
├── app.py                    # Flask 应用入口
├── requirements.txt          # Python 依赖
├── Dockerfile               # Docker 构建配置（已迁移到根目录）
├── routes/
│   └── reel.py             # Reel API 路由
├── services/
│   ├── gemini_service.py   # Gemini API 封装
│   └── video_asset_service.py  # 视频资源管理（Firebase Storage）
└── utils/
    └── auth.py             # Firebase Auth 验证中间件
```

## 🔧 环境变量

创建 `backend/.env` 文件：

```bash
# Gemini API Key（必需）
GEMINI_API_KEY=your_gemini_api_key_here
# 或使用 GOOGLE_API_KEY（兼容）
GOOGLE_API_KEY=your_gemini_api_key_here

# Firebase 配置（二选一）
# 方式 1: 使用文件路径
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json
# 方式 2: 使用 JSON 字符串（推荐用于 Cloud Run）
FIREBASE_CREDENTIALS_JSON={"type":"service_account",...}

# Firebase Storage Bucket（必需）
FIREBASE_STORAGE_BUCKET=your-firebase-storage-bucket.appspot.com

# Flask 配置
FLASK_DEBUG=false
PORT=8080
```

## 🚀 安装和运行

### 开发环境

```bash
# 安装依赖
pip install -r requirements.txt

# 运行服务
python app.py
```

服务将在 `http://localhost:8787` 启动。

### Docker 构建

```bash
# 从项目根目录构建（Dockerfile 在根目录）
docker build -t reel-backend .

# 运行容器
docker run -p 8080:8080 --env-file backend/.env reel-backend
```

## 📡 API 端点

所有端点都需要 Firebase ID Token（在 `Authorization: Bearer <token>` header 中）。

### POST /api/reel/creative-director

分析用户意图并决定下一步动作（新建/编辑/问答/模型不匹配）。

**Request:**
```json
{
  "userPrompt": "make it blue",
  "selectedModel": "banana",
  "assets": {},
  "selectedAssetId": null,
  "lastGeneratedAssetId": null,
  "messages": [],
  "hasUploadedFiles": false
}
```

**Response:**
```json
{
  "action": "EDIT_ASSET",
  "prompt": "make it blue",
  "reasoning": "好的，正在为您调整颜色。",
  "targetAssetId": "reel-img-1234567890"
}
```

### POST /api/reel/generate

生成 Reel 资产（图片或视频）。

**Request (图片):**
```json
{
  "prompt": "A cinematic portrait of a cat",
  "model": "banana",
  "images": [],
  "aspectRatio": "9:16"
}
```

**Request (视频):**
```json
{
  "prompt": "Drone FPV shot of a mountain landscape",
  "model": "veo_fast",
  "images": [{"data": "base64_image_data", "mimeType": "image/jpeg"}],
  "aspectRatio": "9:16"
}
```

**Response (图片):**
```json
{
  "assetId": "reel-img-1234567890",
  "type": "image",
  "src": "data:image/jpeg;base64,...",
  "prompt": "A cinematic portrait of a cat",
  "width": 512,
  "height": 896,
  "status": "done",
  "generationModel": "banana"
}
```

**Response (视频):**
```json
{
  "assetId": "reel-vid-1234567890",
  "type": "video",
  "src": "https://generativelanguage.googleapis.com/...",
  "prompt": "Drone FPV shot of a mountain landscape",
  "width": 512,
  "height": 896,
  "status": "done",
  "generationModel": "veo_fast"
}
```

### POST /api/reel/enhance-prompt

优化提示词，生成 3 个创意方向。

**Request:**
```json
{
  "prompt": "a cat",
  "model": "banana"
}
```

**Response:**
```json
[
  {
    "title": "Cinematic Portrait",
    "description": "A professional portrait style",
    "tags": ["close-up", "golden hour", "shallow depth of field"],
    "fullPrompt": "A cinematic close-up portrait of a cat..."
  },
  ...
]
```

### POST /api/reel/design-plan

获取设计灵感方案（3 套策略）。

**Request:**
```json
{
  "topic": "cyberpunk city",
  "model": "banana"
}
```

**Response:**
```json
[
  {
    "title": "Neon Noir",
    "description": "A dark cyberpunk aesthetic",
    "prompt": "A detailed prompt for generation",
    "referenceImagePrompt": "A still shot of..."
  },
  ...
]
```

### POST /api/reel/upscale

高清放大图片。

**Request:**
```json
{
  "base64Data": "base64_image_data",
  "mimeType": "image/jpeg",
  "factor": 2,
  "prompt": "original prompt"
}
```

### POST /api/reel/remove-background

去除背景。

**Request:**
```json
{
  "base64Data": "base64_image_data",
  "mimeType": "image/jpeg"
}
```

### POST /api/reel/reference-image

生成参考图片。

**Request:**
```json
{
  "prompt": "A reference image for design inspiration"
}
```

### GET /health

健康检查端点。

**Response:**
```json
{
  "status": "ok"
}
```

## 🔐 认证

所有 API 端点使用 `@verify_firebase_token` 装饰器保护。前端需要传递有效的 Firebase ID Token：

```javascript
const token = await user.getIdToken();
fetch('/api/reel/generate', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## 🎬 视频生成流程

1. **图片上传**：参考图片上传到 Firebase Storage
2. **获取 GCS URI**：转换为 `gs://bucket/path` 格式
3. **调用 Veo API**：使用 GCS URI 或直接 bytes
4. **轮询状态**：等待视频生成完成
5. **返回结果**：返回视频 URI 和签名 URL

## 🧪 测试

```bash
# 运行所有测试
pytest backend/tests/ -v

# 运行特定测试
pytest backend/tests/test_reel_api.py -v
```

## 🐛 错误处理

- **地理位置限制**：自动检测并返回友好错误信息
- **模型不匹配**：创意总监自动检测并建议切换模型
- **API 错误**：完善的错误日志和异常处理

## 📊 日志

后端提供详细的请求日志：
- 请求时间戳
- 用户 ID
- 模型类型
- 处理时长
- 错误信息

## 🚀 部署到 Cloud Run

详细部署指南请参考：
- [CLOUD_RUN_DEPLOYMENT.md](../CLOUD_RUN_DEPLOYMENT.md)
- [FIREBASE_CLOUD_RUN_SETUP.md](../FIREBASE_CLOUD_RUN_SETUP.md)

### 快速部署

```bash
# 配置 Firebase Secret
./scripts/setup_firebase_secret.sh

# 部署服务
gcloud run deploy ais-reel \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=your_key,FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com" \
  --update-secrets FIREBASE_CREDENTIALS_JSON=firebase-credentials-json:latest
```

## 📝 注意事项

- 所有 API 端点都使用 `@verify_firebase_token` 装饰器保护
- 前端需要传递有效的 Firebase ID Token
- 在生产环境中，确保设置正确的 CORS 配置
- 视频生成可能需要较长时间（5-10 分钟），建议设置合理的超时时间
- 使用 Secret Manager 存储敏感凭证（推荐）
