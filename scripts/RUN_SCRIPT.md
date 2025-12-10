# 如何运行 setup_firebase_secret.sh 脚本

## 🎯 快速开始

### 步骤 1: 打开终端

在 macOS 上：
- 按 `Cmd + Space` 打开 Spotlight
- 输入 "Terminal" 并回车
- 或使用 Finder → 应用程序 → 实用工具 → 终端

### 步骤 2: 进入项目目录

```bash
cd /Users/stephen/Documents/11_Dev/Cursor/AIS_Reel_1-Cursor
```

### 步骤 3: 运行脚本

```bash
./scripts/setup_firebase_secret.sh
```

## 📋 详细步骤说明

### 方法 A: 使用相对路径（推荐）

```bash
# 1. 确保在项目根目录
cd /Users/stephen/Documents/11_Dev/Cursor/AIS_Reel_1-Cursor

# 2. 运行脚本
./scripts/setup_firebase_secret.sh
```

### 方法 B: 使用 bash 命令

如果脚本没有执行权限，可以使用：

```bash
bash scripts/setup_firebase_secret.sh
```

### 方法 C: 使用完整路径

```bash
bash /Users/stephen/Documents/11_Dev/Cursor/AIS_Reel_1-Cursor/scripts/setup_firebase_secret.sh
```

## ⚙️ 前置条件检查

在运行脚本之前，请确保：

### 1. 检查 gcloud 是否安装

```bash
which gcloud
```

如果显示路径（如 `/usr/local/bin/gcloud`），说明已安装。

如果显示 `gcloud not found`，需要安装：

```bash
# macOS 使用 Homebrew
brew install google-cloud-sdk

# 或访问官网下载安装
# https://cloud.google.com/sdk/docs/install
```

### 2. 检查是否已登录

```bash
gcloud auth list
```

如果看到您的账户，说明已登录。

如果未登录，运行：

```bash
gcloud auth login
```

### 3. 检查凭证文件

```bash
ls -la backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json
```

如果文件存在，可以继续。

## 🚀 执行示例

### 成功执行的输出示例

```
========================================
Firebase 凭证 Secret Manager 设置脚本
========================================

1. 设置 GCP 项目...
Updated property [core/project].
✅ 项目已设置为: ethereal-shine-436906-r5

2. 检查 Secret 是否已存在...
创建新 Secret...
✅ Secret 已创建

3. 获取 Cloud Run 服务账户...
✅ 服务账户: 123456789-compute@developer.gserviceaccount.com

4. 授予 Secret Manager 访问权限...
✅ 权限已授予

5. 检查 Cloud Run 服务...
服务不存在，请先创建服务
创建服务后，运行以下命令：

gcloud run services update ais-reel \
  --region us-central1 \
  --update-secrets FIREBASE_CREDENTIALS_JSON=firebase-credentials-json:latest \
  --set-env-vars FIREBASE_STORAGE_BUCKET=ethereal-shine-436906-r5.appspot.com

6. 验证配置...
✅ Secret 名称: firebase-credentials-json
✅ 服务账户: 123456789-compute@developer.gserviceaccount.com

========================================
✅ Firebase 凭证配置完成！
========================================

下一步：
1. 如果服务已存在，配置已自动更新
2. 如果服务不存在，请先创建 Cloud Run 服务
3. 查看服务日志验证 Firebase 初始化：
   gcloud run services logs tail ais-reel --region us-central1
```

## 🔧 故障排查

### 错误 1: `--data-file is the empty string`

**错误信息**: 
```
ERROR: (gcloud.secrets.create) The value provided for --data-file is the empty string.
```

**原因**: 脚本使用了管道方式传递数据，在某些情况下可能失败。

**解决方案**: 
- ✅ **已修复**: 脚本已更新为直接使用文件路径
- 如果仍遇到问题，确保在项目根目录运行脚本：
  ```bash
  cd /Users/stephen/Documents/11_Dev/Cursor/AIS_Reel_1-Cursor
  ./scripts/setup_firebase_secret.sh
  ```

### 如果脚本无法运行

1. **检查执行权限**:
   ```bash
   chmod +x scripts/setup_firebase_secret.sh
   ```

2. **检查文件路径**:
   ```bash
   # 确认在项目根目录
   pwd
   # 应该显示: /Users/stephen/Documents/11_Dev/Cursor/AIS_Reel_1-Cursor
   
   # 检查凭证文件是否存在
   ls -la backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json
   ```

3. **使用 bash 显式运行**:
   ```bash
   bash scripts/setup_firebase_secret.sh
   ```

4. **检查文件内容**:
   ```bash
   # 验证文件不为空
   test -s backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json && echo "文件不为空" || echo "文件为空"
   
   # 验证 JSON 格式
   python3 -m json.tool backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json > /dev/null && echo "JSON 有效" || echo "JSON 无效"
   ```

### 如果遇到权限错误

```bash
# 检查 gcloud 权限
gcloud projects get-iam-policy ethereal-shine-436906-r5

# 确保您有必要的权限
```

### 如果 Secret 创建失败

```bash
# 手动创建 Secret
cat backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json | \
  gcloud secrets create firebase-credentials-json --data-file=-
```

## 📝 注意事项

1. **首次运行**: 如果 Secret 不存在，脚本会创建它
2. **更新 Secret**: 如果 Secret 已存在，脚本会添加新版本
3. **服务不存在**: 如果 Cloud Run 服务不存在，脚本会提示您先创建服务
4. **权限要求**: 需要 Secret Manager Admin 和 Cloud Run Admin 权限

## 🔗 相关命令

### 查看 Secret

```bash
gcloud secrets describe firebase-credentials-json
```

### 查看 Secret 版本

```bash
gcloud secrets versions list firebase-credentials-json
```

### 查看服务配置

```bash
gcloud run services describe ais-reel --region us-central1
```

### 查看服务日志

```bash
gcloud run services logs tail ais-reel --region us-central1
```

## 📚 更多帮助

- 详细配置指南: [FIREBASE_CLOUD_RUN_SETUP.md](../FIREBASE_CLOUD_RUN_SETUP.md)
- 快速配置指南: [QUICK_FIREBASE_SETUP.md](../QUICK_FIREBASE_SETUP.md)
- 脚本说明: [scripts/README.md](./README.md)
