# 🚀 快速启动指南

## 当前服务状态

✅ **后端服务**: 已启动并运行在 `http://localhost:8787`  
✅ **前端服务**: 已启动并运行在 `http://localhost:3000`

## 📍 访问地址

- **前端应用**: http://localhost:3000
- **后端 API**: http://localhost:8787
- **健康检查**: http://localhost:8787/health

## 🛠️ 服务管理

### 方式一：使用启动脚本（推荐）

```bash
# 启动所有服务
./start_services.sh

# 停止所有服务
./stop_services.sh
```

### 方式二：手动启动

**启动后端：**
```bash
cd backend
python3 app.py
# 后端将在 http://localhost:8787 运行
```

**启动前端：**
```bash
cd frontend
npm run dev
# 前端将在 http://localhost:3000 运行
```

## 📋 服务信息

### 后端服务 (Flask)
- **端口**: 8787
- **日志文件**: `backend.log`
- **配置文件**: `backend/.env`
- **主要功能**:
  - 视频生成 API (VEO 3.1)
  - SEO 分析 API
  - 图片生成 API
  - 品牌分析 API

### 前端服务 (Vite + React)
- **端口**: 3000
- **日志文件**: `frontend.log`
- **代理配置**: `/api` 请求自动代理到 `http://localhost:8787`
- **主要功能**:
  - 视频生成页面
  - SEO 诊断页面
  - 图片生成页面
  - 工作空间页面

## 🔍 检查服务状态

```bash
# 检查后端健康状态
curl http://localhost:8787/health

# 检查前端是否运行
curl http://localhost:3000

# 查看后端日志
tail -f backend.log

# 查看前端日志
tail -f frontend.log
```

## 🛑 停止服务

### 使用脚本
```bash
./stop_services.sh
```

### 手动停止
```bash
# 停止后端 (端口 8787)
lsof -ti:8787 | xargs kill

# 停止前端 (端口 3000)
lsof -ti:3000 | xargs kill
```

## ⚙️ 环境配置

### 后端环境变量
确保 `backend/.env` 文件包含：
```bash
GEMINI_API_KEY=your_api_key
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json  # 可选
FIREBASE_STORAGE_BUCKET=your-bucket-name           # 可选
PORT=8787                                           # 可选，默认 8787
```

### 前端配置
前端使用 Vite 代理，无需额外配置 API 地址。

## 🐛 故障排查

### 端口被占用
```bash
# 查看端口占用情况
lsof -i:8787  # 后端端口
lsof -i:3000  # 前端端口

# 停止占用端口的进程
lsof -ti:8787 | xargs kill
lsof -ti:3000 | xargs kill
```

### 服务无法启动
1. **检查依赖是否安装**:
   ```bash
   # 后端依赖
   cd backend && pip install -r requirements.txt
   
   # 前端依赖
   cd frontend && npm install
   ```

2. **检查环境变量**:
   ```bash
   # 查看后端环境变量
   cat backend/.env
   ```

3. **查看日志**:
   ```bash
   tail -50 backend.log
   tail -50 frontend.log
   ```

## 📚 相关文档

- **VEO 3.1 后端分析**: `test/VEO_3.1_BACKEND_ANALYSIS.md`
- **接口快速参考**: `test/VEO_3.1_接口总结.md`
- **架构总结**: `test/VEO_3.1_架构总结.md`
- **后端文档**: `backend/README.md`
- **前端文档**: `frontend/README.md`

## 🎯 下一步

1. 访问 http://localhost:3000 开始使用应用
2. 查看 API 文档了解可用接口
3. 参考测试文档进行功能验证

---

**提示**: 如果遇到任何问题，请查看日志文件或联系开发团队。


