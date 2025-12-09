# Google Cloud Run 自动化部署指南

本指南详细说明如何将 Reel 生成应用部署到 Google Cloud Run 并配置持续部署（Continuous Deployment）。

## 📋 前置准备

### 1. 确保已启用必要的 API

在 GCP Console 中启用以下 API：

```bash
# 使用 gcloud CLI
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com  # 如果使用 Secret Manager
```

或访问 [API Library](https://console.cloud.google.com/apis/library) 手动启用。

### 2. 准备 GitHub 仓库

确保您的代码已推送到 GitHub：
- 仓库地址：`https://github.com/stephenzzf/Cursor_Reel-1206`
- 分支：`main`
- 包含 `Dockerfile` 在根目录

## 🚀 方法一：通过 GCP Console 配置（推荐）

### 步骤 1: 创建 Cloud Run 服务

1. **访问 Cloud Run Console**
   - 打开 [Cloud Run Console](https://console.cloud.google.com/run)
   - 确保选择了正确的 GCP 项目

2. **创建新服务**
   - 点击页面顶部的 **"CREATE SERVICE"** 按钮

3. **选择部署方式**
   - 在 "Deploy" 部分，选择 **"Deploy one revision from a source repository"**
   - 点击 **"SET UP WITH CLOUD BUILD"** 按钮

### 步骤 2: 连接 GitHub 仓库

1. **连接仓库**
   - 点击 **"CONNECT REPOSITORY"** 按钮
   - 如果这是第一次连接，会看到授权页面

2. **授权 Google Cloud Build**
   - 选择 **"GitHub"** 作为源代码提供者
   - 点击 **"AUTHORIZE CLOUD BUILD"** 或 **"CONNECT TO GITHUB"**
   - 登录您的 GitHub 账户
   - 授权 Google Cloud Build 访问您的仓库

3. **选择仓库和分支**
   - 在仓库列表中找到：`stephenzzf/Cursor_Reel-1206`
   - 选择分支：`main`
   - 点击 **"SELECT"** 或 **"NEXT"**

### 步骤 3: 配置服务基本信息

1. **服务名称**
   - **Service name**: `ais-reel` (或您喜欢的名称)

2. **区域选择**
   - **Region**: 选择离您最近的区域
     - 推荐：`us-central1` (美国中部)
     - 或：`asia-east1` (台湾)、`asia-northeast1` (日本)

3. **身份验证**
   - **Authentication**: 
     - 选择 **"Allow unauthenticated invocations"** (如果需要公开访问)
     - 或选择 **"Require authentication"** (如果需要限制访问)

4. 点击 **"NEXT"** 继续

### 步骤 4: 配置构建设置

1. **构建类型**
   - **Build type**: 选择 **"Dockerfile"**

2. **Dockerfile 配置**
   - **Dockerfile location**: `Dockerfile` (确保路径正确)
   - **Docker context**: `.` (当前目录，即项目根目录)

3. **构建选项**（可选）
   - **Build timeout**: 默认 600 秒（10 分钟）通常足够
   - **Machine type**: 默认即可

4. 点击 **"NEXT"** 继续

### 步骤 5: 配置容器设置

1. **端口配置**
   - **Container port**: `8080` (必须与 Dockerfile 中的 EXPOSE 端口一致)

2. **资源分配**
   - **CPU allocation**: 
     - **CPU**: 选择 `1` vCPU（通常足够）
     - **CPU allocation**: 选择 "CPU is only allocated during request processing"（节省成本）
   - **Memory**: 选择 `1 GiB` 到 `2 GiB`（根据需求调整）
     - 推荐：`1 GiB` 用于一般应用
     - 如果视频生成需要更多内存，选择 `2 GiB`

3. **超时设置**
   - **Request timeout**: `600` 秒（10 分钟）
     - 视频生成可能需要较长时间

4. **实例配置**
   - **Maximum number of instances**: `10` (或根据需求调整)
   - **Minimum number of instances**: 
     - `0` - 节省成本，但首次请求会有冷启动延迟
     - `1` - 减少冷启动，但会产生持续成本

5. **并发设置**
   - **Maximum requests per container**: `80` (默认值通常足够)

6. 点击 **"NEXT"** 继续

### 步骤 6: 配置环境变量

这是**关键步骤**，需要配置所有必要的 API keys 和配置。

#### 方式 A: 直接添加环境变量

1. 在 "Variables & Secrets" 部分，点击 **"ADD VARIABLE"**

2. 逐个添加以下环境变量：

   ```
   名称: GEMINI_API_KEY
   值: [您的 Gemini API Key]
   ```

   ```
   名称: PORT
   值: 8080
   ```

   ```
   名称: FLASK_DEBUG
   值: false
   ```

   ```
   名称: FIREBASE_STORAGE_BUCKET
   值: [您的 Firebase Storage Bucket，例如：ethereal-shine-436906-r5.appspot.com]
   ```

   **Firebase 凭证配置**（二选一）：

   **选项 1: 使用 JSON 字符串**
   ```
   名称: FIREBASE_CREDENTIALS_JSON
   值: [完整的 Firebase Service Account JSON 字符串]
   ```

   **选项 2: 使用文件路径**（需要将文件添加到镜像中，不推荐）
   ```
   名称: FIREBASE_CREDENTIALS_PATH
   值: /app/firebase-credentials.json
   ```

#### 方式 B: 使用 Secret Manager（推荐用于敏感信息）

对于敏感信息（如 API keys），建议使用 Secret Manager：

1. **创建 Secret**
   ```bash
   # 使用 gcloud CLI
   echo -n "your-gemini-api-key" | gcloud secrets create gemini-api-key --data-file=-
   
   # 创建 Firebase 凭证 Secret
   cat backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json | \
     gcloud secrets create firebase-credentials-json --data-file=-
   ```

   或在 [Secret Manager Console](https://console.cloud.google.com/security/secret-manager) 中：
   - 点击 "CREATE SECRET"
   - 输入 Secret 名称：`gemini-api-key`
   - 输入 Secret 值
   - 点击 "CREATE SECRET"

2. **授予 Cloud Run 访问权限**
   ```bash
   # 获取 Cloud Run 服务账户
   PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")
   SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
   
   # 授予权限
   gcloud secrets add-iam-policy-binding gemini-api-key \
     --member="serviceAccount:${SERVICE_ACCOUNT}" \
     --role="roles/secretmanager.secretAccessor"
   
   gcloud secrets add-iam-policy-binding firebase-credentials-json \
     --member="serviceAccount:${SERVICE_ACCOUNT}" \
     --role="roles/secretmanager.secretAccessor"
   ```

3. **在 Cloud Run 中引用 Secret**
   - 在环境变量配置中，点击 **"REFERENCE A SECRET"**
   - 选择 Secret 名称（如 `gemini-api-key`）
   - 输入环境变量名称（如 `GEMINI_API_KEY`）

### 步骤 7: 部署服务

1. 检查所有配置
2. 点击 **"CREATE"** 或 **"DEPLOY"** 按钮
3. 等待构建和部署完成（通常需要 5-10 分钟）

### 步骤 8: 验证部署

1. **查看构建日志**
   - 在部署过程中，可以点击 "View logs" 查看构建进度
   - 或访问 [Cloud Build History](https://console.cloud.google.com/cloud-build/builds)

2. **检查服务状态**
   - 部署完成后，在服务列表中查看服务状态
   - 点击服务名称进入详情页

3. **测试服务**
   - 复制服务 URL（例如：`https://ais-reel-xxxxx-uc.a.run.app`）
   - 在浏览器中访问，应该能看到前端页面
   - 测试健康检查：`https://YOUR_SERVICE_URL/health`
   - 应该返回：`{"status":"ok"}`

## 🔄 方法二：为现有服务配置持续部署

如果已经创建了 Cloud Run 服务，可以后续添加持续部署：

### 步骤 1: 进入服务配置

1. 在 [Cloud Run Console](https://console.cloud.google.com/run) 中
2. 点击您的服务名称
3. 点击顶部的 **"SET UP CONTINUOUS DEPLOYMENT"** 标签

### 步骤 2: 连接 GitHub

1. 点击 **"CONNECT REPOSITORY"**
2. 授权并选择仓库：`stephenzzf/Cursor_Reel-1206`
3. 选择分支：`main`

### 步骤 3: 配置构建触发器

1. **触发条件**
   - 选择 **"Push to a branch"**
   - 分支：`main`
   - 或选择 **"Pull request"** 如果需要在 PR 时触发

2. **构建设置**
   - **Dockerfile location**: `Dockerfile`
   - **Docker context**: `.`

3. **部署设置**
   - 选择 **"Deploy to Cloud Run"**
   - 选择服务名称
   - 选择区域

4. 点击 **"SAVE"**

## ✅ 验证持续部署

### 测试自动部署

1. **修改代码**
   ```bash
   # 在本地修改代码
   echo "# Test update" >> README.md
   git add README.md
   git commit -m "Test continuous deployment"
   git push origin main
   ```

2. **观察构建**
   - 访问 [Cloud Build History](https://console.cloud.google.com/cloud-build/builds)
   - 应该能看到新的构建任务自动启动

3. **检查部署**
   - 在 Cloud Run 服务页面，点击 "REVISIONS" 标签
   - 应该能看到新的版本正在部署

4. **验证更新**
   - 等待部署完成后，访问服务 URL
   - 验证更改已生效

## 🔧 使用 Cloud Build 配置文件（高级）

如果需要更复杂的构建流程，可以使用 `cloudbuild.yaml`：

1. 在服务配置中，选择 **"Use a build configuration file"**
2. 指定文件路径：`cloudbuild.yaml`
3. 配置替换变量：
   - `_SERVICE_NAME`: 服务名称（例如：`ais-reel`）
   - `_REGION`: 区域（例如：`us-central1`）
   - `_MEMORY`: 内存（例如：`1Gi`）
   - `_CPU`: CPU 数量（例如：`1`）
   - `_TIMEOUT`: 超时时间（例如：`600`）
   - `_MAX_INSTANCES`: 最大实例数（例如：`10`）
   - `_MIN_INSTANCES`: 最小实例数（例如：`0`）

## 🐛 常见问题排查

### 问题 1: 构建失败

**症状**: Cloud Build 日志显示错误

**可能原因**:
- Dockerfile 路径不正确
- 依赖安装失败
- 构建超时

**解决方案**:
1. 检查 Cloud Build 日志中的具体错误
2. 确认 Dockerfile 在根目录
3. 检查 `requirements.txt` 和 `package.json` 是否存在
4. 增加构建超时时间

### 问题 2: 服务无法启动

**症状**: 部署成功但服务无法访问

**可能原因**:
- 端口配置错误
- 环境变量缺失
- 应用启动错误

**解决方案**:
1. 检查 Cloud Run 日志
2. 确认端口设置为 `8080`
3. 验证所有必需的环境变量已配置
4. 测试健康检查端点：`/health`

### 问题 3: Firebase 认证失败

**症状**: API 请求返回 401 错误

**可能原因**:
- Firebase 凭证未正确配置
- Secret Manager 权限不足

**解决方案**:
1. 检查 `FIREBASE_CREDENTIALS_JSON` 环境变量
2. 验证 Secret Manager 权限
3. 检查 Cloud Run 服务账户权限

### 问题 4: 前端页面空白

**症状**: 访问服务 URL 显示空白页面

**解决方案**:
1. 确认前端构建成功（检查 Docker 构建日志）
2. 确认 `frontend/dist` 目录被正确复制到镜像
3. 检查浏览器控制台错误
4. 确认 Flask 静态文件路由配置正确

## 💰 成本优化建议

1. **最小实例数**: 设置为 0（按需启动）
2. **CPU 分配**: 仅在请求处理时分配
3. **内存配置**: 根据实际需求调整，不要过度配置
4. **请求超时**: 设置合理的超时时间
5. **最大实例数**: 根据预期流量设置上限

## 📊 监控和维护

### 查看指标

在 Cloud Run 服务页面，可以查看：
- 请求数量
- 延迟
- 错误率
- CPU 和内存使用率

### 设置告警

1. 在 Cloud Run 服务页面，点击 **"ALERTS"** 标签
2. 创建告警策略：
   - 错误率 > 5%
   - 延迟 > 1 秒
   - CPU 使用率 > 80%

## 📚 参考资源

- [Cloud Run 文档](https://cloud.google.com/run/docs)
- [Cloud Build 文档](https://cloud.google.com/build/docs)
- [持续部署指南](https://cloud.google.com/run/docs/continuous-deployment)
- [Secret Manager 文档](https://cloud.google.com/secret-manager/docs)

---

**提示**: 配置完成后，每次 `git push` 到 `main` 分支都会自动触发构建和部署！
