# 部署指南 - GitHub 和 Google Cloud Run

本指南将帮助您将项目部署到 Google Cloud Run，并配置持续部署（Continuous Deployment）。

## 前置要求

1. **Google Cloud Platform (GCP) 账户**
   - 已创建 GCP 项目
   - 已启用 Cloud Run API
   - 已启用 Cloud Build API
   - 已启用 Container Registry API

2. **GitHub 账户**
   - 已创建 GitHub 仓库（或准备创建）

3. **本地环境**
   - 已安装 Git
   - 已安装 Google Cloud SDK (gcloud)（可选，用于本地测试）

## 步骤 1: 创建 GitHub 仓库

### 1.1 在 GitHub 创建新仓库

1. 登录 GitHub
2. 点击右上角 "+" → "New repository"
3. 填写仓库信息：
   - Repository name: `ais-image` (或您喜欢的名称)
   - Description: (可选)
   - Visibility: Public 或 Private
   - **不要**初始化 README、.gitignore 或 license（我们已经有了）
4. 点击 "Create repository"

### 1.2 初始化本地 Git 仓库

在项目根目录执行：

```bash
# 初始化 Git 仓库（如果还没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: Add Dockerfile and deployment configuration"

# 添加远程仓库（替换 YOUR_USERNAME 和 YOUR_REPO_NAME）
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 推送代码
git branch -M main
git push -u origin main
```

## 步骤 2: 配置 Google Cloud Run

### 2.1 启用必要的 API

在 GCP Console 中启用以下 API：

```bash
# 使用 gcloud CLI（推荐）
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com

# 或通过 GCP Console:
# https://console.cloud.google.com/apis/library
```

### 2.2 创建 Cloud Run 服务

#### 方式 A: 通过 GCP Console（推荐）

1. 访问 [Cloud Run Console](https://console.cloud.google.com/run)
2. 点击 "CREATE SERVICE"
3. 选择 "Deploy one revision from a source repository"
4. 点击 "SET UP WITH CLOUD BUILD"
5. 连接 GitHub：
   - 点击 "CONNECT REPOSITORY"
   - 选择 GitHub 账户
   - 授权 Google Cloud Build
   - 选择您的仓库
   - 选择分支（通常是 `main`）
6. 配置服务：
   - **Service name**: `ais-image` (或您喜欢的名称)
   - **Region**: 选择离您最近的区域（例如：`us-central1`）
   - **Authentication**: 选择 "Allow unauthenticated invocations"（如果需要公开访问）
7. 点击 "NEXT"
8. 配置构建：
   - **Build type**: "Dockerfile"
   - **Dockerfile location**: `Dockerfile` (根目录)
   - **Docker context**: `.` (当前目录)
9. 点击 "NEXT"
10. 配置容器：
    - **Container port**: `8080`
    - **CPU allocation**: 根据需要选择（1 vCPU 通常足够）
    - **Memory**: 512MB - 2GB（根据需求调整）
    - **Request timeout**: 300 秒（视频生成可能需要更长时间）
    - **Maximum number of instances**: 根据需要设置
    - **Minimum number of instances**: 0（节省成本）或 1（减少冷启动）
11. 点击 "NEXT"
12. 配置环境变量（重要！）：
    
    添加以下环境变量（从您的 `.env` 文件中获取值）：
    
    ```
    GEMINI_API_KEY=your_gemini_api_key
    JINA_API_KEY=your_jina_api_key (可选)
    GCP_PROJECT_ID=your_gcp_project_id
    GCP_STORAGE_BUCKET_NAME=your_bucket_name (可选)
    GCP_CSE_API_KEY=your_cse_api_key (可选)
    GCP_CSE_ID=your_cse_id (可选)
    FIREBASE_CREDENTIALS_PATH=/path/to/serviceAccountKey.json (如果使用 Firebase)
    FIREBASE_STORAGE_BUCKET=your-firebase-bucket (如果使用 Firebase)
    PORT=8080
    FLASK_DEBUG=false
    ```
    
    **安全提示**: 对于敏感信息（如 API keys），建议使用 [Secret Manager](https://cloud.google.com/secret-manager)：
    
    1. 在 Secret Manager 中创建密钥
    2. 在 Cloud Run 服务配置中，选择 "Reference a secret"
    3. 选择对应的密钥
    
13. 点击 "CREATE" 或 "DEPLOY"

#### 方式 B: 使用 gcloud CLI

```bash
# 设置项目
gcloud config set project YOUR_PROJECT_ID

# 提交代码到 GitHub 后，使用 Cloud Build 构建和部署
gcloud run deploy ais-image \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=your_key,PORT=8080" \
  --memory 1Gi \
  --timeout 300
```

### 2.3 配置持续部署

1. 在 Cloud Run 服务页面，点击 "SET UP CONTINUOUS DEPLOYMENT"
2. 选择您的 GitHub 仓库和分支
3. 配置构建设置：
   - **Dockerfile location**: `Dockerfile`
   - **Docker context**: `.`
4. 配置部署设置：
   - 选择 "Deploy to Cloud Run"
   - 选择服务名称
5. 点击 "SAVE"

现在，每次您 `git push` 代码到 GitHub，Cloud Run 会自动：
1. 触发 Cloud Build
2. 构建 Docker 镜像
3. 部署新版本到 Cloud Run

## 步骤 3: 验证部署

### 3.1 检查服务状态

1. 在 Cloud Run 服务页面，等待部署完成
2. 查看服务 URL（例如：`https://ais-image-xxxxx-uc.a.run.app`）
3. 点击 URL 访问应用

### 3.2 测试 API

```bash
# 健康检查
curl https://YOUR_SERVICE_URL/health

# 应该返回: {"status":"ok"}
```

### 3.3 查看日志

在 Cloud Run 服务页面，点击 "LOGS" 标签查看实时日志。

## 步骤 4: 环境变量管理

### 4.1 使用 Secret Manager（推荐）

对于敏感信息（API keys），使用 Secret Manager：

```bash
# 创建密钥
gcloud secrets create gemini-api-key --data-file=- <<< "your_api_key"

# 授予 Cloud Run 访问权限
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
```

在 Cloud Run 服务配置中：
1. 添加环境变量
2. 选择 "Reference a secret"
3. 选择对应的密钥

### 4.2 直接配置环境变量

在 Cloud Run 服务配置中直接添加环境变量（适合非敏感信息）。

## 故障排查

### 问题 1: 构建失败

**症状**: Cloud Build 日志显示构建错误

**解决方案**:
- 检查 Dockerfile 语法
- 确认所有依赖文件存在（requirements.txt, package.json）
- 查看构建日志中的具体错误信息

### 问题 2: 服务无法启动

**症状**: 服务部署成功但无法访问

**解决方案**:
- 检查环境变量是否正确配置
- 查看 Cloud Run 日志
- 确认端口设置为 8080
- 检查健康检查端点 `/health`

### 问题 3: 前端页面空白

**症状**: 访问服务 URL 显示空白页面

**解决方案**:
- 确认前端构建成功（检查 Docker 构建日志）
- 确认 `frontend/dist` 目录被正确复制到镜像
- 检查浏览器控制台错误
- 确认 Flask 静态文件路由配置正确

### 问题 4: API 请求失败

**症状**: 前端无法调用后端 API

**解决方案**:
- 检查 CORS 配置
- 确认 API 路由前缀为 `/api`
- 查看网络请求日志
- 检查环境变量（特别是 API keys）

### 问题 5: 冷启动时间过长

**症状**: 首次请求响应很慢

**解决方案**:
- 设置最小实例数为 1（在服务配置中）
- 使用 Cloud Run 的 "Always allocate CPU" 选项
- 优化应用启动时间

## 成本优化

1. **最小实例数**: 设置为 0（按需启动，节省成本）
2. **CPU 分配**: 仅在请求处理时分配 CPU（节省成本）
3. **内存配置**: 根据实际需求调整（不要过度配置）
4. **请求超时**: 设置合理的超时时间
5. **并发数**: 根据应用特性调整（默认 80）

## 监控和维护

### 查看指标

在 Cloud Run 服务页面，可以查看：
- 请求数量
- 延迟
- 错误率
- CPU 和内存使用率

### 设置告警

1. 在 Cloud Run 服务页面，点击 "ALERTS"
2. 创建告警策略
3. 设置阈值（例如：错误率 > 5%）

### 更新服务

每次 `git push` 到 GitHub 会自动触发部署。也可以手动触发：

1. 在 Cloud Run 服务页面
2. 点击 "EDIT & DEPLOY NEW REVISION"
3. 修改配置
4. 点击 "DEPLOY"

## 回滚

如果需要回滚到之前的版本：

1. 在 Cloud Run 服务页面
2. 点击 "REVISIONS"
3. 选择要回滚的版本
4. 点击 "MANAGE TRAFFIC"
5. 将流量分配到旧版本

## 参考资源

- [Cloud Run 文档](https://cloud.google.com/run/docs)
- [Cloud Build 文档](https://cloud.google.com/build/docs)
- [Secret Manager 文档](https://cloud.google.com/secret-manager/docs)
- [Docker 多阶段构建](https://docs.docker.com/build/building/multi-stage/)

## 支持

如果遇到问题：
1. 查看 Cloud Run 日志
2. 查看 Cloud Build 日志
3. 检查 GCP 文档
4. 联系 GCP 支持

---

**最后更新**: 2024-12-06

