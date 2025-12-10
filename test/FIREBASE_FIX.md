# Firebase Admin SDK 初始化错误修复

## 问题描述

**错误信息：**
```
处理请求出错: Firebase Admin SDK not initialized. 
Please configure FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS_JSON in .env file.
```

## 根本原因

`.env` 文件中配置的 `FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json` 是相对路径。当应用从不同目录启动时，相对路径解析失败，导致无法找到凭证文件。

## 修复方案

### 修改文件
- `backend/utils/auth.py` - 增强路径解析逻辑

### 修复内容

1. **智能路径解析** (第 36-63 行)
   - 自动识别相对路径
   - 尝试多个可能的基准目录：
     - `backend/` 目录（基于 auth.py 的位置）
     - 当前工作目录
     - `utils/` 目录
   - 自动将相对路径转换为绝对路径

2. **增强错误日志** (第 96-112 行)
   - 提供详细的调试信息
   - 显示尝试的路径和当前工作目录
   - 帮助快速定位配置问题

## 验证

### 测试结果
```bash
✅ Firebase initialized successfully
Initializing Firebase with credentials from: /Users/stephen/.../backend/serviceAccountKey.json
```

### 手动验证步骤

1. **检查环境变量配置**
   ```bash
   cd backend
   cat .env | grep FIREBASE
   ```

2. **验证凭证文件存在**
   ```bash
   ls -la backend/serviceAccountKey.json
   ```

3. **测试初始化（Python）**
   ```python
   import sys, os
   sys.path.insert(0, 'backend')
   os.chdir('backend')
   from dotenv import load_dotenv
   load_dotenv()
   from utils.auth import _initialize_firebase
   result = _initialize_firebase()
   print("✅ Initialized" if result else "❌ Failed")
   ```

4. **重启应用并检查启动日志**
   ```bash
   cd backend
   python app.py
   ```
   
   应该看到：
   ```
   Initializing Firebase with credentials from: .../backend/serviceAccountKey.json
   ✅ Firebase Admin SDK initialized successfully
   ```

## 运行

### 启动应用
```bash
cd backend
python app.py
```

### 验证端点
```bash
# 健康检查（无需认证）
curl http://localhost:8787/health

# API 端点（需要 Firebase token）
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8787/api/reel/generate
```

## 回滚

如果修复导致问题，可以回滚：

```bash
cd backend
git checkout HEAD -- utils/auth.py
```

## 注意事项

- ✅ 修复保持了向后兼容性
- ✅ 支持相对路径和绝对路径
- ✅ 保留了原有的 fallback 机制
- ✅ 不影响 Docker/Cloud Run 部署（使用绝对路径或 JSON 环境变量）

## 后续建议

1. **生产环境**：使用 `FIREBASE_CREDENTIALS_JSON` 环境变量（避免文件路径问题）
2. **Docker 部署**：在 Dockerfile 中确保凭证文件路径正确
3. **Cloud Run**：使用 Secret Manager 配置 `FIREBASE_CREDENTIALS_JSON`
