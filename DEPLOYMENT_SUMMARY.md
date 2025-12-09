# Cloud Run 部署配置总结

## ✅ 已完成的优化

### 1. Dockerfile 优化

**位置**: `/Dockerfile` (项目根目录)

**主要改进**:
- ✅ 多阶段构建，优化镜像大小
- ✅ 添加健康检查
- ✅ 优化 Python 依赖安装（升级 pip）
- ✅ 添加 `PYTHONDONTWRITEBYTECODE` 环境变量
- ✅ 改进错误处理和调试信息

**关键特性**:
- 前端构建阶段：使用 `node:20-alpine` 构建 React 应用
- 后端运行阶段：使用 `python:3.11-slim` 运行 Flask 应用
- 端口配置：8080（Cloud Run 标准端口）
- 健康检查：自动检查 `/health` 端点

### 2. .dockerignore 文件

**位置**: `/.dockerignore`

**作用**: 排除不需要的文件，减少构建上下文大小，加快构建速度

**排除的内容**:
- 环境变量文件（.env）
- 缓存文件（__pycache__, node_modules）
- 构建产物（dist, build）
- IDE 配置文件
- Git 文件
- 测试文件
- 参考代码目录

### 3. cloudbuild.yaml 配置文件

**位置**: `/cloudbuild.yaml`

**功能**: 自定义 Cloud Build 构建流程

**特性**:
- 构建 Docker 镜像
- 推送到 Container Registry
- 自动部署到 Cloud Run
- 可配置的资源参数（内存、CPU、超时等）
- 高性能构建机器（E2_HIGHCPU_8）

**可配置变量**:
- `_SERVICE_NAME`: 服务名称
- `_REGION`: 部署区域
- `_MEMORY`: 内存配置（默认：1Gi）
- `_CPU`: CPU 配置（默认：1）
- `_TIMEOUT`: 请求超时（默认：600 秒）
- `_MAX_INSTANCES`: 最大实例数（默认：10）
- `_MIN_INSTANCES`: 最小实例数（默认：0）

### 4. 部署文档

**位置**: `/CLOUD_RUN_DEPLOYMENT.md`

**内容**:
- 详细的部署步骤指南
- 环境变量配置说明
- Secret Manager 使用方法
- 持续部署配置
- 故障排查指南
- 成本优化建议

## 📁 文件结构

```
项目根目录/
├── Dockerfile                    # 主 Dockerfile（用于 Cloud Run 部署）
├── .dockerignore                 # Docker 构建忽略文件
├── cloudbuild.yaml               # Cloud Build 配置文件
├── CLOUD_RUN_DEPLOYMENT.md       # 详细部署指南
├── DEPLOYMENT_SUMMARY.md         # 本文件
├── backend/
│   ├── Dockerfile               # 已更新为指向根目录的说明
│   └── ...
└── frontend/
    └── ...
```

## 🚀 快速开始

### 1. 本地测试构建

```bash
# 在项目根目录
docker build -t ais-reel:local .
docker run -p 8080:8080 -e GEMINI_API_KEY=your_key ais-reel:local
```

### 2. 部署到 Cloud Run

#### 方式 A: 使用 GCP Console（推荐）

1. 访问 [Cloud Run Console](https://console.cloud.google.com/run)
2. 点击 "CREATE SERVICE"
3. 选择 "Deploy one revision from a source repository"
4. 连接 GitHub 仓库：`stephenzzf/Cursor_Reel-1206`
5. 按照 `CLOUD_RUN_DEPLOYMENT.md` 中的详细步骤配置

#### 方式 B: 使用 gcloud CLI

```bash
# 设置项目
gcloud config set project YOUR_PROJECT_ID

# 部署（使用 Cloud Build）
gcloud run deploy ais-reel \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=your_key,PORT=8080" \
  --memory 1Gi \
  --timeout 600
```

#### 方式 C: 使用 cloudbuild.yaml

```bash
# 提交构建任务
gcloud builds submit --config cloudbuild.yaml \
  --substitutions _SERVICE_NAME=ais-reel,_REGION=us-central1
```

## 🔐 环境变量配置

### 必需的环境变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `GEMINI_API_KEY` | Gemini API 密钥 | `AIza...` |
| `PORT` | 服务端口 | `8080` |
| `FLASK_DEBUG` | Flask 调试模式 | `false` |

### Firebase 配置（二选一）

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `FIREBASE_CREDENTIALS_JSON` | Firebase 凭证 JSON 字符串 | `{"type":"service_account",...}` |
| `FIREBASE_CREDENTIALS_PATH` | Firebase 凭证文件路径 | `/app/firebase-credentials.json` |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | `ethereal-shine-436906-r5.appspot.com` |

### 推荐：使用 Secret Manager

对于敏感信息，建议使用 Secret Manager：

```bash
# 创建 Secret
echo -n "your-api-key" | gcloud secrets create gemini-api-key --data-file=-

# 在 Cloud Run 中引用
# 在服务配置中选择 "Reference a secret"
```

## 🔄 持续部署

配置完成后，每次 `git push` 到 `main` 分支都会：

1. ✅ 自动触发 Cloud Build
2. ✅ 构建 Docker 镜像
3. ✅ 推送到 Container Registry
4. ✅ 部署新版本到 Cloud Run

## 📊 资源建议

### 开发/测试环境

- **CPU**: 1 vCPU
- **Memory**: 1 GiB
- **Timeout**: 600 秒
- **Min Instances**: 0
- **Max Instances**: 5

### 生产环境

- **CPU**: 1-2 vCPU
- **Memory**: 2 GiB（视频生成需要更多内存）
- **Timeout**: 600 秒
- **Min Instances**: 1（减少冷启动）
- **Max Instances**: 10-20

## 🐛 常见问题

### 构建失败

- 检查 Dockerfile 路径是否正确
- 确认所有依赖文件存在
- 查看 Cloud Build 日志

### 服务无法启动

- 检查环境变量配置
- 验证端口设置（8080）
- 查看 Cloud Run 日志

### Firebase 认证失败

- 确认 `FIREBASE_CREDENTIALS_JSON` 配置正确
- 检查 Secret Manager 权限
- 验证服务账户权限

## 📚 参考文档

- [CLOUD_RUN_DEPLOYMENT.md](./CLOUD_RUN_DEPLOYMENT.md) - 详细部署指南
- [Cloud Run 文档](https://cloud.google.com/run/docs)
- [Cloud Build 文档](https://cloud.google.com/build/docs)

## ✅ 下一步

1. ✅ Dockerfile 已优化并移动到根目录
2. ✅ .dockerignore 已创建
3. ✅ cloudbuild.yaml 已创建
4. ✅ 部署文档已创建
5. ⏳ 配置 Cloud Run 服务（按照 CLOUD_RUN_DEPLOYMENT.md）
6. ⏳ 设置环境变量和 Secret Manager
7. ⏳ 测试部署和持续集成

---

**最后更新**: 2024-12-19
