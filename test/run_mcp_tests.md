# MCP Playwright 自动化测试执行指南

本文档说明如何使用 MCP Playwright 工具执行自动化测试，模拟多种业务场景并找出潜在问题。

## 前置条件

1. **后端服务运行中**
   ```bash
   cd backend
   python app.py
   # 服务应在 http://localhost:8787 运行
   ```

2. **前端服务运行中**（可选，用于获取 Firebase token）
   ```bash
   cd frontend
   npm run dev
   # 服务应在 http://localhost:5173 运行
   ```

3. **环境变量配置**
   - 确保 `.env` 文件配置正确
   - 确保 Firebase 凭证已配置

## 测试场景列表

### 1. 基础测试（无需认证）

#### 1.1 健康检查
- **端点**: `GET /health`
- **预期**: 返回 `{"status": "ok"}`，状态码 200
- **目的**: 验证服务是否正常运行

#### 1.2 认证验证 - 缺少 Token
- **端点**: `POST /api/reel/creative-director`
- **请求**: 无 `Authorization` header
- **预期**: 返回 401 错误
- **目的**: 验证认证中间件是否正常工作

#### 1.3 认证验证 - 无效 Token
- **端点**: `POST /api/reel/creative-director`
- **请求**: `Authorization: Bearer invalid_token_12345`
- **预期**: 返回 401 错误
- **目的**: 验证无效 token 的处理

### 2. 创意总监 API 测试（需要认证）

#### 2.1 创建新图片
- **请求**:
  ```json
  {
    "userPrompt": "一只可爱的小猫",
    "selectedModel": "banana",
    "assets": {},
    "selectedAssetId": null,
    "lastGeneratedAssetId": null,
    "messages": [],
    "hasUploadedFiles": false
  }
  ```
- **预期**: `action: "NEW_ASSET"`

#### 2.2 编辑现有图片
- **请求**:
  ```json
  {
    "userPrompt": "把背景改成蓝色",
    "selectedModel": "banana",
    "assets": {"img-1": {"type": "image", "id": "img-1"}},
    "selectedAssetId": "img-1",
    "lastGeneratedAssetId": "img-1",
    "messages": [{"role": "user", "content": "一只小猫"}],
    "hasUploadedFiles": false
  }
  ```
- **预期**: `action: "EDIT_ASSET"`

#### 2.3 回答问题
- **请求**:
  ```json
  {
    "userPrompt": "你能做什么？",
    "selectedModel": "banana",
    "assets": {},
    "selectedAssetId": null,
    "lastGeneratedAssetId": null,
    "messages": [],
    "hasUploadedFiles": false
  }
  ```
- **预期**: `action: "ANSWER_QUESTION"`

#### 2.4 创建新视频
- **请求**:
  ```json
  {
    "userPrompt": "一个无人机航拍场景",
    "selectedModel": "veo_fast",
    "assets": {},
    "selectedAssetId": null,
    "lastGeneratedAssetId": null,
    "messages": [],
    "hasUploadedFiles": false
  }
  ```
- **预期**: `action: "NEW_ASSET"`

#### 2.5 模型不匹配检测
- **请求**:
  ```json
  {
    "userPrompt": "一个动态的无人机航拍视频",
    "selectedModel": "banana",
    "assets": {},
    "selectedAssetId": null,
    "lastGeneratedAssetId": null,
    "messages": [],
    "hasUploadedFiles": false
  }
  ```
- **预期**: `action: "MODEL_MISMATCH"`，包含 `suggestedModel`

### 3. 边界场景测试

#### 3.1 空提示词
- **请求**: `userPrompt: ""`
- **预期**: 应该处理空输入或返回错误

#### 3.2 超长提示词
- **请求**: `userPrompt: "A" * 5000`
- **预期**: 应该处理长输入或返回错误

#### 3.3 特殊字符
- **请求**: `userPrompt: "!@#$%^&*()_+-=[]{}|;:,.<>?"`
- **预期**: 应该正确处理特殊字符

#### 3.4 缺失必填字段
- **请求**: 缺少 `userPrompt` 字段
- **预期**: 返回 400 错误

#### 3.5 无效模型名称
- **请求**: `selectedModel: "invalid_model_name"`
- **预期**: 应该处理无效模型或返回错误

### 4. 生成资产 API 测试

#### 4.1 纯文本生成图片
- **请求**:
  ```json
  {
    "prompt": "一只可爱的小猫，坐在窗台上，阳光洒进来",
    "model": "banana",
    "images": [],
    "aspectRatio": "9:16"
  }
  ```
- **预期**: 返回生成的图片（base64 或 URL）

#### 4.2 使用 banana_pro 模型
- **请求**:
  ```json
  {
    "prompt": "一幅精美的风景画",
    "model": "banana_pro",
    "images": [],
    "aspectRatio": "9:16"
  }
  ```
- **预期**: 返回高质量图片

#### 4.3 带输入图片生成
- **请求**:
  ```json
  {
    "prompt": "把这张图片的风格改成水彩画",
    "model": "banana",
    "images": [{"data": "<base64>", "mimeType": "image/png"}],
    "aspectRatio": "9:16"
  }
  ```
- **预期**: 返回基于输入图片的生成结果

#### 4.4 纯文本生成视频
- **请求**:
  ```json
  {
    "prompt": "一个无人机航拍场景，缓慢飞过城市上空",
    "model": "veo_fast",
    "images": [],
    "aspectRatio": "9:16"
  }
  ```
- **预期**: 返回视频 URL（可能需要轮询）

#### 4.5 带输入图片生成视频
- **请求**:
  ```json
  {
    "prompt": "从这张图片开始，创建一个动态场景",
    "model": "veo_fast",
    "images": [{"data": "<base64>", "mimeType": "image/png"}],
    "aspectRatio": "9:16"
  }
  ```
- **预期**: 返回基于输入图片的视频

### 5. 其他 API 测试

#### 5.1 提示词优化
- **端点**: `POST /api/reel/enhance-prompt`
- **请求**:
  ```json
  {
    "prompt": "一只猫",
    "model": "banana"
  }
  ```
- **预期**: 返回 3 个优化后的提示词选项

#### 5.2 设计灵感
- **端点**: `POST /api/reel/design-plan`
- **请求**:
  ```json
  {
    "topic": "未来科技",
    "model": "banana"
  }
  ```
- **预期**: 返回 3 个设计灵感方案

#### 5.3 图片放大
- **端点**: `POST /api/reel/upscale`
- **请求**:
  ```json
  {
    "base64Data": "<base64_image>",
    "mimeType": "image/png",
    "prompt": "一只可爱的小猫",
    "factor": 2
  }
  ```
- **预期**: 返回放大后的图片

#### 5.4 去除背景
- **端点**: `POST /api/reel/remove-background`
- **请求**:
  ```json
  {
    "base64Data": "<base64_image>",
    "mimeType": "image/png"
  }
  ```
- **预期**: 返回透明背景的 PNG 图片

#### 5.5 生成参考图片
- **端点**: `POST /api/reel/reference-image`
- **请求**:
  ```json
  {
    "prompt": "一幅精美的风景画，夕阳西下"
  }
  ```
- **预期**: 返回参考图片

## 使用 MCP Playwright 执行测试

### 步骤 1: 启动浏览器并导航

```python
# 使用 MCP Playwright 工具
playwright_navigate(url="http://localhost:8787/health")
```

### 步骤 2: 执行 HTTP 请求测试

```python
# 健康检查
playwright_get(url="http://localhost:8787/health")

# 测试缺少认证
playwright_post(
    url="http://localhost:8787/api/reel/creative-director",
    value=json.dumps({
        "userPrompt": "test"
    }),
    headers={"Content-Type": "application/json"}
)
```

### 步骤 3: 获取 Firebase Token（如果需要）

1. 导航到前端页面
2. 填写登录表单
3. 点击登录按钮
4. 在浏览器控制台执行 JavaScript 获取 token

```javascript
firebase.auth().currentUser.getIdToken().then(token => {
    console.log('Token:', token);
});
```

### 步骤 4: 使用 Token 测试需要认证的 API

```python
playwright_post(
    url="http://localhost:8787/api/reel/creative-director",
    value=json.dumps({
        "userPrompt": "一只可爱的小猫",
        "selectedModel": "banana",
        "assets": {},
        "selectedAssetId": None,
        "lastGeneratedAssetId": None,
        "messages": [],
        "hasUploadedFiles": False
    }),
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
)
```

## 潜在问题检查清单

在执行测试时，注意检查以下潜在问题：

### 1. 认证相关
- [ ] Token 过期处理
- [ ] Token 格式验证
- [ ] 缺少 Token 的错误信息
- [ ] 无效 Token 的错误信息

### 2. 输入验证
- [ ] 空值处理
- [ ] 超长输入处理
- [ ] 特殊字符处理
- [ ] 缺失必填字段的错误信息

### 3. API 响应
- [ ] 响应时间（是否超时）
- [ ] 响应格式（JSON 结构）
- [ ] 错误信息清晰度
- [ ] 状态码正确性

### 4. 业务逻辑
- [ ] 模型不匹配检测
- [ ] 编辑 vs 新建判断
- [ ] 图片 vs 视频判断
- [ ] 历史消息上下文处理

### 5. 性能问题
- [ ] 长时间运行的请求（视频生成）
- [ ] 并发请求处理
- [ ] 资源清理（内存泄漏）

### 6. 错误处理
- [ ] 网络错误
- [ ] API 错误（Gemini API 限制）
- [ ] 地理位置限制
- [ ] 服务不可用

## 测试报告

测试完成后，会生成以下报告：

1. **JSON 报告**: `test/mcp_test_report.json`
   - 包含所有测试的详细结果
   - 包括响应时间、状态码、错误信息等

2. **Markdown 报告**: `test/MCP_TEST_REPORT.md`
   - 人类可读的测试报告
   - 包含测试摘要和详细结果

## 注意事项

1. **测试环境**: 确保在测试环境中运行，避免影响生产数据
2. **API 配额**: 注意 Gemini API 的调用限制
3. **测试数据**: 使用测试账号，避免使用真实用户数据
4. **清理**: 测试完成后清理测试数据
