# 服务启动说明

## 🚀 快速启动

### 方法一：使用启动脚本（推荐）

```bash
# 启动后端
cd backend
python3 app.py

# 启动前端（新终端）
cd frontend
npm run dev
```

### 方法二：后台运行

```bash
# 启动后端（后台）
cd backend
python3 app.py > /tmp/backend.log 2>&1 &

# 启动前端（后台）
cd frontend
npm run dev > /tmp/frontend.log 2>&1 &
```

## 📍 服务地址

- **后端 API**: http://localhost:8787
- **前端应用**: http://localhost:5173

## 🔍 健康检查

```bash
# 检查后端
curl http://localhost:8787/health

# 检查前端
curl http://localhost:5173
```

## 🛑 停止服务

```bash
# 停止后端
pkill -f "python.*app.py"

# 停止前端
pkill -f "vite"

# 或使用 PID 文件
kill $(cat /tmp/backend.pid)
kill $(cat /tmp/frontend.pid)
```

## 📝 查看日志

```bash
# 后端日志
tail -f /tmp/backend.log

# 前端日志
tail -f /tmp/frontend.log
```

## ✅ 验证服务状态

```bash
# 检查端口占用
lsof -i:8787  # 后端
lsof -i:5173  # 前端

# 检查进程
ps aux | grep -E "(app.py|vite)" | grep -v grep
```
