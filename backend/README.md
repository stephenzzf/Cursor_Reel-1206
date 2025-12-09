# Reel Generation Backend

Flask 后端服务，提供安全的 Reel 生成 API（图片和视频）。

## 架构

- **Flask**: Web 框架
- **Firebase Admin**: 用户认证和存储
- **Google Gemini API**: AI 生成服务
- **Blueprint 模式**: 模块化路由

## 目录结构

```
backend/
├── app.py                 # Flask 应用入口
├── requirements.txt       # Python 依赖
├── Dockerfile            # Docker 构建配置
├── routes/
│   └── reel.py          # Reel API 路由
├── services/
│   └── gemini_service.py # Gemini API 封装
└── utils/
    └── auth.py          # Firebase Auth 验证中间件
```

## 环境变量

创建 `.env` 文件（参考 `.env.example`）：

```bash
# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase Configuration
FIREBASE_CREDENTIALS_PATH=path/to/serviceAccountKey.json
# 或使用 JSON 字符串
# FIREBASE_CREDENTIALS_JSON={"type":"service_account",...}
FIREBASE_STORAGE_BUCKET=your-firebase-storage-bucket.appspot.com

# Flask Configuration
FLASK_DEBUG=false
PORT=8080
```

## 安装和运行

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
# 从项目根目录构建
docker build -t reel-backend .

# 运行容器
docker run -p 8080:8080 --env-file backend/.env reel-backend
```

## API 端点

所有端点都需要 Firebase ID Token（在 `Authorization: Bearer <token>` header 中）。

### POST /api/reel/creative-director
分析用户意图并决定下一步动作。

### POST /api/reel/generate
生成 Reel 资产（图片或视频）。

### POST /api/reel/enhance-prompt
优化提示词。

### POST /api/reel/design-plan
获取设计灵感方案。

### POST /api/reel/upscale
高清放大图片。

### POST /api/reel/remove-background
去除背景。

### POST /api/reel/reference-image
生成参考图片。

## 测试

```bash
# 运行测试
pytest backend/tests/test_reel_api.py -v
```

## 部署到 Cloud Run

1. 确保 Dockerfile 正确配置
2. 设置环境变量（在 Cloud Run 控制台或通过 gcloud CLI）
3. 构建并部署：

```bash
gcloud run deploy reel-service \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## 注意事项

- 所有 API 端点都使用 `@verify_firebase_token` 装饰器保护
- 前端需要传递有效的 Firebase ID Token
- 在生产环境中，确保设置正确的 CORS 配置

