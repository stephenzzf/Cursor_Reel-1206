# 脚本使用指南

## 📋 前置条件

在运行脚本之前，请确保：

1. **已安装 Google Cloud SDK (gcloud)**
   ```bash
   # 检查是否已安装
   which gcloud
   
   # 如果未安装，请访问：
   # https://cloud.google.com/sdk/docs/install
   ```

2. **已登录 Google Cloud**
   ```bash
   # 登录
   gcloud auth login
   
   # 设置应用默认凭据（可选，用于本地开发）
   gcloud auth application-default login
   ```

3. **已启用必要的 API**
   ```bash
   gcloud services enable secretmanager.googleapis.com
   gcloud services enable run.googleapis.com
   ```

4. **凭证文件存在**
   - 文件路径: `backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json`
   - 确保文件在项目根目录下

## 🚀 运行脚本

### 方法 1: 从项目根目录运行（推荐）

```bash
# 1. 进入项目根目录
cd /Users/stephen/Documents/11_Dev/Cursor/AIS_Reel_1-Cursor

# 2. 确保脚本有执行权限
chmod +x scripts/setup_firebase_secret.sh

# 3. 运行脚本
./scripts/setup_firebase_secret.sh
```

### 方法 2: 使用 bash 直接运行

```bash
# 如果脚本没有执行权限，可以使用 bash 运行
bash scripts/setup_firebase_secret.sh
```

### 方法 3: 使用完整路径

```bash
bash /Users/stephen/Documents/11_Dev/Cursor/AIS_Reel_1-Cursor/scripts/setup_firebase_secret.sh
```

## 📝 脚本执行步骤

脚本会自动执行以下步骤：

1. ✅ **检查凭证文件** - 验证 Firebase 凭证文件是否存在
2. ✅ **设置 GCP 项目** - 设置为 `ethereal-shine-436906-r5`
3. ✅ **创建/更新 Secret** - 在 Secret Manager 中创建或更新 Secret
4. ✅ **获取服务账户** - 获取 Cloud Run 服务账户
5. ✅ **授予权限** - 授予服务账户访问 Secret 的权限
6. ✅ **更新服务配置** - 如果 Cloud Run 服务已存在，自动更新配置

## 🔧 配置参数

如果需要修改配置，可以编辑脚本中的以下变量：

```bash
PROJECT_ID="ethereal-shine-436906-r5"        # GCP 项目 ID
SECRET_NAME="firebase-credentials-json"      # Secret 名称
CREDENTIALS_FILE="backend/..."               # 凭证文件路径
SERVICE_NAME="ais-reel"                      # Cloud Run 服务名称
REGION="us-central1"                         # 部署区域
```

## ⚠️ 常见问题

### 问题 1: gcloud 命令未找到

**错误信息**: `gcloud: command not found`

**解决方案**:
1. 安装 Google Cloud SDK:
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # 或访问: https://cloud.google.com/sdk/docs/install
   ```

2. 初始化 gcloud:
   ```bash
   gcloud init
   ```

### 问题 2: 权限不足

**错误信息**: `Permission denied` 或 `Access denied`

**解决方案**:
```bash
# 检查当前用户是否有权限
gcloud projects get-iam-policy ethereal-shine-436906-r5

# 确保您有以下角色之一：
# - Owner
# - Editor
# - Secret Manager Admin
# - Cloud Run Admin
```

### 问题 3: 凭证文件不存在

**错误信息**: `错误: 找不到凭证文件`

**解决方案**:
1. 确认文件路径正确
2. 检查文件是否在 `backend/` 目录下
3. 确认文件名正确

### 问题 4: Secret 已存在但更新失败

**解决方案**:
```bash
# 手动添加新版本
cat backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json | \
  gcloud secrets versions add firebase-credentials-json --data-file=-
```

## ✅ 验证脚本执行结果

### 1. 检查 Secret 是否创建

```bash
gcloud secrets describe firebase-credentials-json
```

### 2. 检查权限

```bash
PROJECT_NUMBER=$(gcloud projects describe ethereal-shine-436906-r5 --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud secrets get-iam-policy firebase-credentials-json
```

### 3. 检查 Cloud Run 服务配置

```bash
gcloud run services describe ais-reel --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

### 4. 查看服务日志

```bash
gcloud run services logs tail ais-reel --region us-central1
```

应该看到：
```
✅ Firebase Admin SDK initialized successfully
```

## 📚 相关文档

- [FIREBASE_CLOUD_RUN_SETUP.md](../FIREBASE_CLOUD_RUN_SETUP.md) - 详细配置指南
- [QUICK_FIREBASE_SETUP.md](../QUICK_FIREBASE_SETUP.md) - 快速配置指南
- [CLOUD_RUN_DEPLOYMENT.md](../CLOUD_RUN_DEPLOYMENT.md) - 部署文档

## 🆘 需要帮助？

如果遇到问题：
1. 查看脚本输出的错误信息
2. 检查 [FIREBASE_CLOUD_RUN_SETUP.md](../FIREBASE_CLOUD_RUN_SETUP.md) 中的故障排查部分
3. 查看 Google Cloud 日志
