# Cloud Run 部署架构与流程文档

## 📋 目录

1. [部署架构概览](#部署架构概览)
2. [构建流程详解](#构建流程详解)
3. [运行时架构](#运行时架构)
4. [持续部署机制](#持续部署机制)
5. [配置管理](#配置管理)
6. [请求处理流程](#请求处理流程)
7. [监控与日志](#监控与日志)
8. [故障处理与优化](#故障处理与优化)

---

## 部署架构概览

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub 仓库                                │
│         https://github.com/stephenzzf/Cursor_Image1206      │
│                        │                                     │
│                        │ git push                            │
│                        ▼                                     │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ Webhook 触发
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Google Cloud Build (构建服务)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  步骤 1: 检出代码 (git clone)                        │  │
│  │  步骤 2: 多阶段 Docker 构建                           │  │
│  │    - 阶段 1: Node.js 构建前端                         │  │
│  │    - 阶段 2: Python 运行环境 + 复制前端产物           │  │
│  │  步骤 3: 推送镜像到 Container Registry                │  │
│  │  步骤 4: 部署到 Cloud Run                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ 部署镜像
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Google Cloud Run (运行时服务)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Docker 容器实例                                      │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │  Flask 应用 (app.py)                           │ │  │
│  │  │  - API 路由 (/api/*)                           │ │  │
│  │  │  - 静态文件服务 (/frontend/dist/*)             │ │  │
│  │  │  - SPA 路由处理 (/* → index.html)              │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │  前端构建产物 (/app/frontend/dist)              │ │  │
│  │  │  - index.html                                  │ │  │
│  │  │  - assets/* (JS, CSS, 图片)                    │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│  端口: 8080 (通过 PORT 环境变量)                            │
│  自动扩缩容: 0-N 个实例                                     │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ HTTP/HTTPS 请求
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    用户浏览器/客户端                          │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

1. **GitHub 仓库**: 源代码存储和版本控制
2. **Cloud Build**: 自动化构建和部署服务
3. **Container Registry**: Docker 镜像存储
4. **Cloud Run**: 无服务器容器运行平台
5. **Secret Manager**: 敏感信息管理（可选）

---

## 构建流程详解

### 多阶段 Docker 构建

#### 阶段 1: 前端构建 (Builder Stage)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
```

**步骤**:
1. **复制依赖文件**
   ```dockerfile
   COPY frontend/package*.json ./
   ```
   - 仅复制 `package.json` 和 `package-lock.json`
   - 利用 Docker 层缓存，依赖未变化时跳过安装

2. **安装依赖**
   ```dockerfile
   RUN npm ci
   ```
   - 使用 `npm ci` 而非 `npm install`，确保可重现构建
   - 基于 `package-lock.json` 精确安装版本

3. **复制源代码**
   ```dockerfile
   COPY frontend/ ./
   ```
   - 复制所有前端源代码文件

4. **构建生产版本**
   ```dockerfile
   RUN npm run build
   ```
   - 执行 Vite 构建命令
   - 生成优化后的静态文件到 `/app/dist`
   - 包含：HTML、JS、CSS、图片等资源

**构建产物**:
- `/app/dist/index.html` - 主 HTML 文件
- `/app/dist/assets/*` - 打包后的 JS 和 CSS
- `/app/dist/*` - 其他静态资源

#### 阶段 2: 运行时环境 (Runtime Stage)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
```

**步骤**:
1. **安装系统依赖**
   ```dockerfile
   RUN apt-get update && apt-get install -y --no-install-recommends \
       curl \
       && rm -rf /var/lib/apt/lists/*
   ```
   - 安装必要的系统工具
   - 清理 apt 缓存以减小镜像大小

2. **安装 Python 依赖**
   ```dockerfile
   COPY backend/requirements.txt ./
   RUN pip install --no-cache-dir -r requirements.txt
   ```
   - 复制依赖清单
   - 安装所有 Python 包
   - `--no-cache-dir` 减小镜像大小

3. **复制后端代码**
   ```dockerfile
   COPY backend/ ./
   ```
   - 复制所有后端源代码
   - 包括：`app.py`、`routes/`、`services/`、`utils/`

4. **复制前端构建产物**
   ```dockerfile
   RUN mkdir -p ./frontend
   COPY --from=builder /app/dist ./frontend/dist
   RUN ls -la ./frontend/dist/ || echo "Warning: frontend/dist not found"
   ```
   - 从构建阶段复制前端构建产物
   - 验证文件已正确复制

5. **配置环境**
   ```dockerfile
   ENV PORT=8080
   ENV PYTHONUNBUFFERED=1
   EXPOSE 8080
   ```

6. **启动应用**
   ```dockerfile
   CMD ["python", "app.py"]
   ```

### 构建优化策略

1. **层缓存优化**
   - 依赖文件单独复制，利用 Docker 缓存
   - 源代码变化不影响依赖安装层

2. **多阶段构建**
   - 最终镜像不包含 Node.js 和构建工具
   - 显著减小镜像大小（从 ~500MB 降至 ~200MB）

3. **构建时间优化**
   - 并行安装依赖（如果可能）
   - 使用 Alpine 基础镜像减小下载时间

---

## 运行时架构

### 容器启动流程

```
1. Cloud Run 启动容器
   ↓
2. 执行 CMD: python app.py
   ↓
3. Flask 应用初始化
   ├─ 加载环境变量
   ├─ 初始化 Gemini API
   ├─ 初始化 GCS/Firebase 客户端
   └─ 查找前端构建产物
   ↓
4. 注册路由
   ├─ API 路由 (/api/*)
   ├─ 健康检查 (/health)
   └─ SPA 路由 (/*)
   ↓
5. 监听端口 8080
   ↓
6. 就绪，接收请求
```

### 应用结构

```
/app/                          # 工作目录
├── app.py                     # Flask 主应用
├── routes/                    # API 路由模块
│   ├── seo.py                # SEO 工作流路由
│   ├── image.py              # 图片生成路由
│   ├── video.py              # 视频生成路由
│   └── seo_competitors.py   # 竞争对手分析路由
├── services/                  # 服务层
│   ├── gemini_service.py     # Gemini API 封装
│   └── video_asset_service_v2.py  # 视频资源管理
├── utils/                     # 工具函数
│   └── rag_knowledge.py      # RAG 知识库
└── frontend/                  # 前端构建产物
    └── dist/                  # Vite 构建输出
        ├── index.html
        └── assets/
            ├── *.js
            ├── *.css
            └── *.png/jpg
```

### 路径查找逻辑

Flask 应用启动时会尝试多个路径查找前端构建产物：

```python
possible_paths = [
    '/app/frontend/dist',  # Docker 容器中的路径（生产环境）
    os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist'),  # 开发环境
    os.path.join(os.getcwd(), 'frontend', 'dist'),  # 备用路径
]
```

**优先级**:
1. `/app/frontend/dist` - Docker 容器中的标准路径
2. 相对路径 - 开发环境兼容
3. 当前工作目录 - 备用方案

---

## 持续部署机制

### 触发流程

```
开发者推送代码
    ↓
git push origin main
    ↓
GitHub Webhook 触发
    ↓
Cloud Build 接收事件
    ↓
开始构建流程
    ↓
构建 Docker 镜像
    ↓
推送到 Container Registry
    ↓
部署到 Cloud Run
    ↓
流量切换到新版本
```

### Cloud Build 配置

#### 自动构建配置

当通过 Cloud Run Console 配置持续部署时，Cloud Build 会自动：

1. **检出代码**
   - 从 GitHub 仓库克隆指定分支
   - 使用最新提交的代码

2. **执行构建**
   - 使用项目根目录的 `Dockerfile`
   - 执行多阶段构建

3. **推送镜像**
   - 构建成功后推送到 `gcr.io/PROJECT_ID/SERVICE_NAME`
   - 使用 commit SHA 作为标签

4. **部署服务**
   - 自动部署到 Cloud Run
   - 创建新版本（Revision）
   - 默认将 100% 流量切换到新版本

#### 自定义构建配置 (cloudbuild.yaml)

如果需要自定义构建流程，可以使用 `cloudbuild.yaml`:

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/${_SERVICE_NAME}:$SHORT_SHA', '.']
  
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/${_SERVICE_NAME}:$SHORT_SHA']
  
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args: ['run', 'deploy', '${_SERVICE_NAME}', ...]
```

### 部署策略

#### 默认策略（蓝绿部署）

- 创建新版本（Revision）
- 立即将 100% 流量切换到新版本
- 旧版本保留但无流量

#### 流量分流（可选）

可以配置多个版本同时运行，按比例分配流量：

```
Revision 1 (旧版本): 10% 流量
Revision 2 (新版本): 90% 流量
```

---

## 配置管理

### 环境变量配置

#### 必需环境变量

```bash
GEMINI_API_KEY=your_gemini_api_key      # Gemini API 密钥
PORT=8080                                # 服务端口（Cloud Run 自动设置）
FLASK_DEBUG=false                        # 生产环境禁用调试
```

#### 可选环境变量

```bash
JINA_API_KEY=your_jina_api_key          # Jina Reader API（可选）
GCP_PROJECT_ID=your_project_id           # GCP 项目 ID
GCP_STORAGE_BUCKET_NAME=your_bucket      # GCS 存储桶（可选）
GCP_CSE_API_KEY=your_cse_key            # Custom Search API（可选）
GCP_CSE_ID=your_cse_id                  # Custom Search Engine ID（可选）
FIREBASE_STORAGE_BUCKET=your_bucket      # Firebase Storage（可选）
```

### Secret Manager 集成

对于敏感信息，推荐使用 Secret Manager：

#### 创建 Secret

```bash
# 使用 gcloud CLI
echo -n "your-api-key" | gcloud secrets create gemini-api-key --data-file=-
```

#### 授予访问权限

```bash
PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

#### 在 Cloud Run 中引用

在服务配置中：
- 选择 "Reference a secret"
- 选择 Secret 名称
- 设置环境变量名称

### 配置优先级

1. **Cloud Run 环境变量** - 最高优先级
2. **Secret Manager** - 通过环境变量引用
3. **代码中的默认值** - 最低优先级

---

## 请求处理流程

### 请求路由逻辑

```
HTTP 请求到达 Cloud Run
    ↓
Flask 应用接收请求
    ↓
路由匹配
    ├─ /health → 健康检查端点
    ├─ /api/* → API 路由处理
    │   ├─ /api/seo/* → SEO 工作流
    │   ├─ /api/image/* → 图片生成
    │   ├─ /api/video/* → 视频生成
    │   └─ /api/analyze → 品牌分析
    └─ /* → 静态文件/SPA 路由
        ├─ 尝试提供静态文件 (CSS, JS, 图片)
        └─ 文件不存在 → 返回 index.html (SPA 路由)
```

### API 请求处理

```python
@app.route('/api/seo/diagnosis', methods=['POST'])
def seo_diagnosis():
    # 1. 验证请求数据
    # 2. 调用 Gemini API
    # 3. 处理响应
    # 4. 返回 JSON
```

### 静态文件服务

```python
@app.route('/<path:path>')
def serve_frontend(path):
    # 1. 检查是否为 API 请求
    # 2. 尝试提供静态文件
    # 3. 文件不存在 → 返回 index.html (SPA 回退)
```

### SPA 路由处理

React Router 使用客户端路由，所有非 API 请求都应返回 `index.html`：

```python
# 所有路径（除了 /api/*）都返回 index.html
# React Router 在客户端处理路由
return send_from_directory(FRONTEND_DIST, 'index.html')
```

---

## 监控与日志

### Cloud Run 指标

#### 自动收集的指标

1. **请求指标**
   - 请求数量（Requests）
   - 请求延迟（Latency）
   - 错误率（Error Rate）
   - 4xx/5xx 错误数量

2. **资源指标**
   - CPU 使用率
   - 内存使用率
   - 实例数量

3. **成本指标**
   - 请求处理时间
   - CPU 分配时间
   - 内存分配

#### 查看指标

- **Cloud Run Console**: 服务详情页的 "METRICS" 标签
- **Cloud Monitoring**: 更详细的指标和告警

### 日志管理

#### 日志输出

Flask 应用使用标准输出（stdout）和标准错误（stderr）：

```python
print("Application started")  # 输出到 stdout
print(f"Error: {error}")      # 错误信息
```

#### 日志查看

1. **Cloud Run Console**
   - 服务详情页 → "LOGS" 标签
   - 实时查看日志流

2. **Cloud Logging**
   - 更强大的日志查询和分析
   - 支持日志导出和告警

#### 日志级别

- **INFO**: 一般信息（应用启动、请求处理）
- **WARNING**: 警告信息（配置缺失、降级处理）
- **ERROR**: 错误信息（API 调用失败、异常）

### 健康检查

#### 健康检查端点

```python
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})
```

#### Cloud Run 健康检查

Cloud Run 自动监控：
- 容器启动状态
- 健康检查端点响应
- 请求处理能力

---

## 故障处理与优化

### 常见问题

#### 1. 构建失败

**症状**: Cloud Build 日志显示错误

**可能原因**:
- Dockerfile 语法错误
- 依赖安装失败
- 构建超时

**解决方案**:
- 检查构建日志中的具体错误
- 验证 `requirements.txt` 和 `package.json`
- 增加构建超时时间
- 本地测试构建：`docker build -t test .`

#### 2. 服务无法启动

**症状**: 部署成功但服务不可用

**可能原因**:
- 端口配置错误
- 环境变量缺失
- 应用启动错误

**解决方案**:
- 检查 Cloud Run 日志
- 确认端口为 8080
- 验证所有必需环境变量
- 测试健康检查端点

#### 3. 前端页面空白

**症状**: 访问服务 URL 显示空白或错误

**可能原因**:
- 前端构建失败
- 路径查找失败
- 静态文件未正确复制

**解决方案**:
- 检查构建日志，确认前端构建成功
- 查看应用日志中的路径查找信息
- 验证 `/app/frontend/dist` 目录存在
- 检查 Dockerfile 中的复制步骤

#### 4. API 请求失败

**症状**: 前端无法调用后端 API

**可能原因**:
- CORS 配置问题
- API 路由未正确注册
- 环境变量缺失（API keys）

**解决方案**:
- 检查 CORS 配置
- 验证 API 路由前缀为 `/api`
- 检查环境变量配置
- 查看 API 请求日志

### 性能优化

#### 1. 冷启动优化

**问题**: 首次请求延迟高（冷启动）

**解决方案**:
- 设置最小实例数为 1（持续运行，无冷启动）
- 优化应用启动时间
- 使用 "Always allocate CPU" 选项

#### 2. 内存优化

**问题**: 内存使用率高

**解决方案**:
- 监控实际内存使用
- 根据需求调整内存配置
- 优化代码减少内存占用

#### 3. 成本优化

**策略**:
- 最小实例数设为 0（按需启动）
- CPU 仅在请求处理时分配
- 设置合理的请求超时
- 监控和优化请求处理时间

#### 4. 构建优化

**策略**:
- 利用 Docker 层缓存
- 优化 Dockerfile 顺序
- 使用多阶段构建减小镜像大小
- 并行构建（如果可能）

### 扩展性考虑

#### 自动扩缩容

Cloud Run 自动根据请求量调整实例数：

- **最小实例数**: 0（节省成本）或 1（减少冷启动）
- **最大实例数**: 根据预期流量设置
- **并发数**: 每个实例可处理的并发请求数（默认 80）

#### 流量管理

- **负载均衡**: Cloud Run 自动处理
- **区域分布**: 可选择多区域部署
- **版本管理**: 支持流量分流和回滚

---

## 部署检查清单

### 部署前检查

- [ ] Dockerfile 语法正确
- [ ] 所有依赖文件存在（requirements.txt, package.json）
- [ ] 环境变量已准备
- [ ] GitHub 仓库已连接
- [ ] Cloud Run API 已启用
- [ ] Cloud Build API 已启用

### 部署后验证

- [ ] 服务状态为 "Active"
- [ ] 健康检查端点响应正常
- [ ] 前端页面可以访问
- [ ] API 端点可以调用
- [ ] 日志输出正常
- [ ] 环境变量正确加载

### 持续部署验证

- [ ] 推送代码后自动触发构建
- [ ] 构建成功完成
- [ ] 新版本自动部署
- [ ] 流量正确切换到新版本

---

## 架构优势

### 1. 无服务器架构

- **自动扩缩容**: 根据流量自动调整
- **按使用付费**: 只为实际使用的资源付费
- **零运维**: 无需管理服务器

### 2. 容器化部署

- **环境一致性**: 开发、测试、生产环境一致
- **依赖隔离**: 所有依赖打包在镜像中
- **易于迁移**: 可在任何支持 Docker 的环境运行

### 3. 持续部署

- **自动化**: 代码推送即部署
- **快速迭代**: 缩短开发到部署的时间
- **版本控制**: 每次部署都有版本记录

### 4. 高可用性

- **自动重启**: 容器崩溃自动重启
- **健康检查**: 自动监控服务状态
- **流量管理**: 支持蓝绿部署和流量分流

---

## 参考资源

- [Cloud Run 文档](https://cloud.google.com/run/docs)
- [Cloud Build 文档](https://cloud.google.com/build/docs)
- [Container Registry 文档](https://cloud.google.com/container-registry/docs)
- [Secret Manager 文档](https://cloud.google.com/secret-manager/docs)
- [Docker 多阶段构建](https://docs.docker.com/build/building/multi-stage/)

---

**文档版本**: 1.0  
**最后更新**: 2024-12-06  
**维护者**: AIS_Image 开发团队

