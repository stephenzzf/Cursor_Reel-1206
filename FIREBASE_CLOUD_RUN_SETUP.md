# 在 Google Cloud Run 上配置 Firebase 凭证

本指南详细说明如何在 Google Cloud Run 上安全地配置 Firebase Admin SDK 凭证。

## 📋 方法概览

在 Cloud Run 上配置 Firebase 凭证有三种方法：

1. **Secret Manager（推荐）** - 最安全，易于管理
2. **环境变量（FIREBASE_CREDENTIALS_JSON）** - 简单直接
3. **文件挂载（FIREBASE_CREDENTIALS_PATH）** - 需要将文件添加到镜像

**推荐使用方法 1（Secret Manager）**，因为它最安全且符合最佳实践。

## 🔐 方法一：使用 Secret Manager（推荐）

### 步骤 1: 创建 Secret

#### 方式 A: 使用 gcloud CLI

```bash
# 设置项目
gcloud config set project ethereal-shine-436906-r5

# 创建 Secret（从 JSON 文件）
gcloud secrets create firebase-credentials-json \
  --data-file=backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json \
  --replication-policy="automatic"

# 或者从标准输入创建
cat backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json | \
  gcloud secrets create firebase-credentials-json --data-file=-
```

#### 方式 B: 使用 GCP Console

1. 访问 [Secret Manager Console](https://console.cloud.google.com/security/secret-manager)
2. 点击 **"CREATE SECRET"**
3. 填写信息：
   - **Name**: `firebase-credentials-json`
   - **Secret value**: 粘贴完整的 JSON 内容（从 `ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json`）
4. 点击 **"CREATE SECRET"**

### 步骤 2: 授予 Cloud Run 访问权限

```bash
# 获取 Cloud Run 服务账户
PROJECT_NUMBER=$(gcloud projects describe ethereal-shine-436906-r5 --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# 授予 Secret Manager 访问权限
gcloud secrets add-iam-policy-binding firebase-credentials-json \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

### 步骤 3: 在 Cloud Run 服务中引用 Secret

#### 方式 A: 使用 GCP Console

1. 访问 [Cloud Run Console](https://console.cloud.google.com/run)
2. 选择您的服务（例如：`ais-reel`）
3. 点击 **"EDIT & DEPLOY NEW REVISION"**
4. 滚动到 **"Variables & Secrets"** 部分
5. 点击 **"REFERENCE A SECRET"**
6. 配置：
   - **Secret**: 选择 `firebase-credentials-json`
   - **Version**: `latest`
   - **Variable name**: `FIREBASE_CREDENTIALS_JSON`
7. 点击 **"DEPLOY"**

#### 方式 B: 使用 gcloud CLI

```bash
gcloud run services update ais-reel \
  --region us-central1 \
  --update-secrets FIREBASE_CREDENTIALS_JSON=firebase-credentials-json:latest
```

### 步骤 4: 配置其他必需的环境变量

还需要配置 Firebase Storage Bucket：

```bash
gcloud run services update ais-reel \
  --region us-central1 \
  --set-env-vars FIREBASE_STORAGE_BUCKET=ethereal-shine-436906-r5.appspot.com
```

或在 Console 中：
- **Variable name**: `FIREBASE_STORAGE_BUCKET`
- **Value**: `ethereal-shine-436906-r5.appspot.com`

## 🔑 方法二：使用环境变量（简单但不推荐用于生产）

### 步骤 1: 准备 JSON 字符串

将 Firebase 凭证 JSON 文件转换为单行字符串：

```bash
# 使用 jq（如果已安装）
cat backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json | jq -c .

# 或使用 Python
python3 -c "import json; print(json.dumps(json.load(open('backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json'))))"
```

### 步骤 2: 在 Cloud Run 中设置环境变量

#### 方式 A: 使用 GCP Console

1. 访问 Cloud Run 服务页面
2. 点击 **"EDIT & DEPLOY NEW REVISION"**
3. 在 **"Variables & Secrets"** 部分，点击 **"ADD VARIABLE"**
4. 配置：
   - **Name**: `FIREBASE_CREDENTIALS_JSON`
   - **Value**: 粘贴 JSON 字符串（单行）
5. 添加另一个变量：
   - **Name**: `FIREBASE_STORAGE_BUCKET`
   - **Value**: `ethereal-shine-436906-r5.appspot.com`
6. 点击 **"DEPLOY"**

#### 方式 B: 使用 gcloud CLI

```bash
# 读取 JSON 文件并转换为单行
FIREBASE_JSON=$(cat backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json | tr -d '\n' | tr -d ' ')

gcloud run services update ais-reel \
  --region us-central1 \
  --set-env-vars \
    FIREBASE_CREDENTIALS_JSON="${FIREBASE_JSON}",\
    FIREBASE_STORAGE_BUCKET=ethereal-shine-436906-r5.appspot.com
```

**⚠️ 注意**: 环境变量在 Cloud Run 控制台和日志中可见，安全性较低。建议仅用于开发/测试环境。

## 📁 方法三：使用文件挂载（不推荐）

此方法需要将凭证文件添加到 Docker 镜像中，不推荐用于生产环境。

### 步骤 1: 修改 Dockerfile

在 Dockerfile 中添加：

```dockerfile
# 复制 Firebase 凭证文件
COPY backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json /app/firebase-credentials.json
```

### 步骤 2: 设置环境变量

```bash
gcloud run services update ais-reel \
  --region us-central1 \
  --set-env-vars FIREBASE_CREDENTIALS_PATH=/app/firebase-credentials.json
```

**⚠️ 注意**: 此方法会将凭证文件包含在镜像中，存在安全风险。

## ✅ 验证配置

### 1. 检查环境变量

```bash
# 查看服务配置
gcloud run services describe ais-reel --region us-central1 --format="value(spec.template.spec.containers[0].env)"
```

### 2. 查看服务日志

```bash
# 查看实时日志
gcloud run services logs tail ais-reel --region us-central1

# 应该看到：
# ✅ Firebase Admin SDK initialized successfully
```

### 3. 测试 API

```bash
# 测试健康检查
curl https://YOUR_SERVICE_URL/health

# 测试需要认证的端点（应该返回 401，说明认证中间件工作正常）
curl -X POST https://YOUR_SERVICE_URL/api/reel/creative-director \
  -H "Content-Type: application/json" \
  -d '{"userPrompt": "test"}'
```

## 🔄 更新凭证

如果需要更新 Firebase 凭证：

### 使用 Secret Manager

```bash
# 更新 Secret
cat new-firebase-credentials.json | \
  gcloud secrets versions add firebase-credentials-json --data-file=-

# Cloud Run 会自动使用最新版本（如果配置为 latest）
# 或者需要重新部署服务以使用新版本
```

### 使用环境变量

需要更新服务配置并重新部署。

## 🛡️ 安全最佳实践

1. **✅ 使用 Secret Manager**
   - 最安全的方法
   - 支持版本控制
   - 可以轻松轮换凭证

2. **✅ 限制访问权限**
   - 只授予必要的服务账户访问权限
   - 定期审查权限

3. **❌ 不要将凭证提交到 Git**
   - 确保 `.gitignore` 包含 `*-firebase-adminsdk-*.json`
   - 不要在代码中硬编码凭证

4. **✅ 使用最小权限原则**
   - 只授予必要的 Firebase 权限

5. **✅ 定期轮换凭证**
   - 定期更新 Firebase 服务账户密钥
   - 使用 Secret Manager 可以轻松管理版本

## 📝 完整配置示例

### 使用 Secret Manager 的完整命令

```bash
# 1. 创建 Secret
cat backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json | \
  gcloud secrets create firebase-credentials-json --data-file=-

# 2. 授予权限
PROJECT_NUMBER=$(gcloud projects describe ethereal-shine-436906-r5 --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding firebase-credentials-json \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

# 3. 部署或更新服务
gcloud run services update ais-reel \
  --region us-central1 \
  --update-secrets FIREBASE_CREDENTIALS_JSON=firebase-credentials-json:latest \
  --set-env-vars FIREBASE_STORAGE_BUCKET=ethereal-shine-436906-r5.appspot.com
```

## 🐛 故障排查

### 问题 1: Firebase 初始化失败

**症状**: 日志显示 "No Firebase credentials found"

**解决方案**:
1. 检查环境变量是否正确设置
2. 验证 Secret Manager 权限
3. 检查 JSON 格式是否正确

### 问题 2: Secret Manager 访问被拒绝

**症状**: 日志显示 "Permission denied" 或 "Access denied"

**解决方案**:
```bash
# 重新授予权限
PROJECT_NUMBER=$(gcloud projects describe ethereal-shine-436906-r5 --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding firebase-credentials-json \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

### 问题 3: JSON 解析错误

**症状**: 日志显示 "Failed to parse FIREBASE_CREDENTIALS_JSON"

**解决方案**:
1. 验证 JSON 格式是否正确
2. 确保 JSON 是单行字符串（如果使用环境变量）
3. 检查是否有特殊字符需要转义

### 问题 4: 认证验证失败

**症状**: API 请求返回 401 错误

**解决方案**:
1. 检查 Firebase 凭证是否有效
2. 验证服务账户是否有正确的权限
3. 检查 Firebase 项目 ID 是否匹配

## 📚 参考资源

- [Secret Manager 文档](https://cloud.google.com/secret-manager/docs)
- [Cloud Run 环境变量](https://cloud.google.com/run/docs/configuring/environment-variables)
- [Firebase Admin SDK 文档](https://firebase.google.com/docs/admin/setup)
- [Cloud Run 安全最佳实践](https://cloud.google.com/run/docs/securing/service-identity)

---

**提示**: 推荐使用 Secret Manager 方法，它提供了最佳的安全性和可管理性！
