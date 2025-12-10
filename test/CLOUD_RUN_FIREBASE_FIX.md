# Cloud Run Firebase 配置修复指南

## 🔍 问题诊断

**错误信息：**
```
处理请求出错: Firebase Admin SDK not initialized. 
Please configure FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS_JSON in .env file.
```

**服务信息：**
- URL: `https://demo-reel-518510771526.asia-east1.run.app`
- 区域: `asia-east1`
- 项目号: `518510771526`

## ✅ 已完成的配置

1. ✅ Secret `firebase-credentials-json` 已创建并更新
2. ✅ Cloud Run 服务账户权限已授予
3. ⚠️ 服务配置需要手动更新（服务名称/区域可能不匹配）

## 🔧 解决方案：手动配置（推荐）

### 方法 1: 使用 GCP Console（最简单）

#### 步骤 1: 访问 Cloud Run Console
1. 打开浏览器，访问：
   ```
   https://console.cloud.google.com/run?project=ethereal-shine-436906-r5
   ```
   或使用项目号：
   ```
   https://console.cloud.google.com/run?project=518510771526
   ```

2. 在服务列表中找到 `demo-reel` 服务

#### 步骤 2: 编辑服务配置
1. 点击服务名称进入详情页
2. 点击 **"EDIT & DEPLOY NEW REVISION"** 按钮

#### 步骤 3: 配置 Firebase 凭证 Secret
1. 滚动到 **"Variables & Secrets"** 部分
2. 点击 **"REFERENCE A SECRET"** 按钮
3. 填写配置：
   - **Secret**: 选择 `firebase-credentials-json`
   - **Version**: 选择 `latest`
   - **Variable name**: 输入 `FIREBASE_CREDENTIALS_JSON`
   - 点击 **"ADD"**

#### 步骤 4: 添加 Firebase Storage Bucket 环境变量
1. 在 **"Variables & Secrets"** 部分，点击 **"ADD VARIABLE"**
2. 填写：
   - **Name**: `FIREBASE_STORAGE_BUCKET`
   - **Value**: `ethereal-shine-436906-r5.appspot.com`
3. 点击 **"ADD"**

#### 步骤 5: 检查其他必需的环境变量
确保以下环境变量已设置：
- `PORT`: `8080`（通常自动设置）
- `GEMINI_API_KEY`: 您的 Gemini API Key（如果未设置）

#### 步骤 6: 部署新版本
1. 滚动到页面底部
2. 点击 **"DEPLOY"** 按钮
3. 等待部署完成（通常 1-2 分钟）

### 方法 2: 使用 gcloud CLI

如果您知道正确的服务名称和区域，可以使用以下命令：

```bash
# 设置项目（如果需要）
gcloud config set project ethereal-shine-436906-r5

# 更新服务配置
gcloud run services update demo-reel \
  --region asia-east1 \
  --update-secrets FIREBASE_CREDENTIALS_JSON=firebase-credentials-json:latest \
  --set-env-vars FIREBASE_STORAGE_BUCKET=ethereal-shine-436906-r5.appspot.com
```

**注意：** 如果服务在不同的项目中，需要先切换项目：
```bash
# 列出所有项目
gcloud projects list

# 切换到正确的项目
gcloud config set project PROJECT_ID

# 然后运行更新命令
```

## ✅ 验证配置

### 1. 查看服务日志
```bash
gcloud run services logs tail demo-reel --region asia-east1 --limit 50
```

**期望看到的日志：**
```
Initializing Firebase with credentials from JSON string
✅ Firebase Admin SDK initialized successfully
```

### 2. 测试健康检查
```bash
curl https://demo-reel-518510771526.asia-east1.run.app/health
```

**期望响应：**
```json
{"status":"ok"}
```

### 3. 测试 API 端点
如果之前报错，现在应该不再出现 "Firebase Admin SDK not initialized" 错误。

## 🐛 故障排查

### 问题 1: Secret 访问被拒绝
**症状：** 日志显示 "Permission denied" 或 "Access denied"

**解决方案：**
```bash
# 获取项目号
PROJECT_NUMBER=$(gcloud projects describe ethereal-shine-436906-r5 --format="value(projectNumber)")

# 授予权限
gcloud secrets add-iam-policy-binding firebase-credentials-json \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 问题 2: 环境变量未设置
**症状：** 日志显示环境变量未找到

**解决方案：**
1. 检查 GCP Console 中的环境变量配置
2. 确保变量名拼写正确（区分大小写）
3. 重新部署服务

### 问题 3: JSON 解析错误
**症状：** 日志显示 "Failed to parse FIREBASE_CREDENTIALS_JSON"

**解决方案：**
1. 验证 Secret 中的 JSON 格式是否正确
2. 重新创建 Secret：
   ```bash
   cat backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json | \
     gcloud secrets versions add firebase-credentials-json --data-file=-
   ```

### 问题 4: 服务找不到
**症状：** `ERROR: (gcloud.run.services.update) Service [demo-reel] could not be found`

**可能原因：**
1. 服务在不同项目中
2. 区域不正确
3. 服务名称不同

**解决方案：**
```bash
# 列出所有 Cloud Run 服务
gcloud run services list --platform managed

# 查看特定区域的服务
gcloud run services list --region asia-east1
```

## 📋 配置检查清单

- [ ] Secret `firebase-credentials-json` 已创建
- [ ] Cloud Run 服务账户有 Secret Manager 访问权限
- [ ] 环境变量 `FIREBASE_CREDENTIALS_JSON` 已设置为引用 Secret
- [ ] 环境变量 `FIREBASE_STORAGE_BUCKET` 已设置
- [ ] 服务已重新部署
- [ ] 日志显示 Firebase 初始化成功
- [ ] API 端点不再报错

## 🔗 相关资源

- [Secret Manager 文档](https://cloud.google.com/secret-manager/docs)
- [Cloud Run 环境变量](https://cloud.google.com/run/docs/configuring/environment-variables)
- [Cloud Run Console](https://console.cloud.google.com/run)

## 📝 快速命令参考

```bash
# 查看服务配置
gcloud run services describe demo-reel --region asia-east1

# 查看环境变量
gcloud run services describe demo-reel --region asia-east1 \
  --format="value(spec.template.spec.containers[0].env)"

# 查看日志
gcloud run services logs tail demo-reel --region asia-east1

# 重新部署（如果修改了代码）
gcloud run deploy demo-reel \
  --source . \
  --region asia-east1
```

---

**提示：** 如果使用 Console 配置，通常是最可靠的方法，因为它提供了清晰的界面和验证。
