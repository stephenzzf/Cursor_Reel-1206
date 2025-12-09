# 多阶段构建 Dockerfile
# 阶段 1: 构建前端 React 应用
FROM node:20-alpine AS builder

WORKDIR /app

# 复制前端依赖文件
COPY frontend/package*.json ./

# 安装依赖（使用 npm ci 以获得可重现的构建）
RUN npm ci

# 复制前端源代码
COPY frontend/ ./

# 构建生产版本
RUN npm run build

# 阶段 2: 运行 Python Flask 后端
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖（如果需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制 Python 依赖文件
COPY backend/requirements.txt ./

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端源代码
COPY backend/ ./

# 从构建阶段复制前端构建产物
# 确保 frontend 目录存在
RUN mkdir -p ./frontend
COPY --from=builder /app/dist ./frontend/dist

# 验证前端构建产物已复制（用于调试）
RUN ls -la ./frontend/dist/ || echo "Warning: frontend/dist not found"

# 设置环境变量
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# 暴露端口（Cloud Run 会通过 PORT 环境变量设置）
EXPOSE 8080

# 运行 Flask 应用
CMD ["python", "app.py"]

