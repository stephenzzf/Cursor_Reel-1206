# Firebase 凭证快速配置指南

## 🚀 一键配置（推荐）

使用自动化脚本快速配置 Firebase 凭证到 Secret Manager：

```bash
# 运行脚本
./scripts/setup_firebase_secret.sh
```

脚本会自动：
1. ✅ 创建 Secret Manager Secret
2. ✅ 授予 Cloud Run 服务账户访问权限
3. ✅ 更新 Cloud Run 服务配置（如果服务已存在）

## 📋 手动配置步骤

### 1. 创建 Secret

```bash
# 设置项目
gcloud config set project ethereal-shine-436906-r5

# 创建 Secret
cat backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json | \
  gcloud secrets create firebase-credentials-json --data-file=-
```

### 2. 授予权限

```bash
# 获取服务账户
PROJECT_NUMBER=$(gcloud projects describe ethereal-shine-436906-r5 --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# 授予权限
gcloud secrets add-iam-policy-binding firebase-credentials-json \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. 在 Cloud Run 中引用

#### 使用 Console:
1. 访问 Cloud Run 服务页面
2. 点击 "EDIT & DEPLOY NEW REVISION"
3. 在 "Variables & Secrets" 部分
4. 点击 "REFERENCE A SECRET"
5. 选择: `firebase-credentials-json`
6. 变量名: `FIREBASE_CREDENTIALS_JSON`

#### 使用 CLI:
```bash
gcloud run services update ais-reel \
  --region us-central1 \
  --update-secrets FIREBASE_CREDENTIALS_JSON=firebase-credentials-json:latest \
  --set-env-vars FIREBASE_STORAGE_BUCKET=ethereal-shine-436906-r5.appspot.com
```

## ✅ 验证

```bash
# 查看服务日志
gcloud run services logs tail ais-reel --region us-central1

# 应该看到:
# ✅ Firebase Admin SDK initialized successfully
```

## 📚 详细文档

完整的配置指南和故障排查请参考：
- [FIREBASE_CLOUD_RUN_SETUP.md](./FIREBASE_CLOUD_RUN_SETUP.md) - 详细配置指南
