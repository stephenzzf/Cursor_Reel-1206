# MCP Playwright 自动化测试使用指南

## 概述

本测试套件使用 MCP Playwright 工具模拟多种业务场景，自动测试后端 API，找出潜在问题。

## 快速开始

### 1. 确保服务运行

```bash
# 终端 1: 启动后端
cd backend
python app.py
# 服务运行在 http://localhost:8787

# 终端 2: 启动前端（可选，用于获取 Firebase token）
cd frontend
npm run dev
# 服务运行在 http://localhost:5173
```

### 2. 执行测试

在 Cursor 中，使用 MCP Playwright 工具执行以下测试场景：

## 测试场景执行步骤

### 场景 1: 健康检查（无需认证）

**目标**: 验证服务是否正常运行

**执行步骤**:
1. 使用 `playwright_get` 工具
2. URL: `http://localhost:8787/health`
3. **预期结果**: 
   - 状态码: 200
   - 响应体: `{"status": "ok"}`

**MCP 工具调用示例**:
```
使用 playwright_get 工具
URL: http://localhost:8787/health
```

### 场景 2: 认证验证 - 缺少 Token

**目标**: 验证认证中间件是否正常工作

**执行步骤**:
1. 使用 `playwright_post` 工具
2. URL: `http://localhost:8787/api/reel/creative-director`
3. Headers: `{"Content-Type": "application/json"}` (不包含 Authorization)
4. Body:
   ```json
   {
     "userPrompt": "test"
   }
   ```
5. **预期结果**: 
   - 状态码: 401
   - 响应体包含错误信息

**MCP 工具调用示例**:
```
使用 playwright_post 工具
URL: http://localhost:8787/api/reel/creative-director
Headers: {"Content-Type": "application/json"}
Body: {"userPrompt": "test"}
```

### 场景 3: 认证验证 - 无效 Token

**目标**: 验证无效 token 的处理

**执行步骤**:
1. 使用 `playwright_post` 工具
2. URL: `http://localhost:8787/api/reel/creative-director`
3. Headers: 
   ```json
   {
     "Content-Type": "application/json",
     "Authorization": "Bearer invalid_token_12345"
   }
   ```
4. Body:
   ```json
   {
     "userPrompt": "test"
   }
   ```
5. **预期结果**: 
   - 状态码: 401
   - 响应体包含错误信息

### 场景 4: 获取 Firebase Token（用于后续测试）

**目标**: 通过浏览器登录获取有效的 Firebase token

**执行步骤**:
1. 使用 `playwright_navigate` 导航到前端页面
   - URL: `http://localhost:5173`
2. 等待页面加载（使用 `playwright_wait_for`）
3. 填写登录表单:
   - 使用 `playwright_fill` 填写邮箱
   - 使用 `playwright_fill` 填写密码
4. 点击登录按钮（使用 `playwright_click`）
5. 等待登录完成
6. 在浏览器控制台执行 JavaScript 获取 token:
   ```javascript
   firebase.auth().currentUser.getIdToken().then(token => {
       console.log('Token:', token);
       return token;
   });
   ```
   使用 `playwright_evaluate` 工具执行上述代码

**MCP 工具调用序列**:
```
1. playwright_navigate(url="http://localhost:5173")
2. playwright_wait_for(time=3)
3. playwright_fill(selector="input[type='email']", value="test@example.com")
4. playwright_fill(selector="input[type='password']", value="testpassword123")
5. playwright_click(selector="button[type='submit']")
6. playwright_wait_for(text="登录成功" 或等待特定元素)
7. playwright_evaluate(function="async () => { const user = firebase.auth().currentUser; if (user) { return await user.getIdToken(); } return null; }")
```

### 场景 5: 创意总监 API - 创建新图片

**目标**: 测试正常创建新图片的场景

**执行步骤**:
1. 使用 `playwright_post` 工具
2. URL: `http://localhost:8787/api/reel/creative-director`
3. Headers: 
   ```json
   {
     "Content-Type": "application/json",
     "Authorization": "Bearer <从场景4获取的token>"
   }
   ```
4. Body:
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
5. **预期结果**: 
   - 状态码: 200
   - 响应体: `{"action": "NEW_ASSET", "prompt": "...", "reasoning": "..."}`

### 场景 6: 创意总监 API - 编辑现有图片

**目标**: 测试编辑现有图片的场景

**执行步骤**:
1. 使用 `playwright_post` 工具
2. URL: `http://localhost:8787/api/reel/creative-director`
3. Headers: 包含有效的 Authorization token
4. Body:
   ```json
   {
     "userPrompt": "把背景改成蓝色",
     "selectedModel": "banana",
     "assets": {
       "img-1": {
         "type": "image",
         "id": "img-1"
       }
     },
     "selectedAssetId": "img-1",
     "lastGeneratedAssetId": "img-1",
     "messages": [
       {
         "role": "user",
         "content": "一只小猫"
       }
     ],
     "hasUploadedFiles": false
   }
   ```
5. **预期结果**: 
   - 状态码: 200
   - 响应体: `{"action": "EDIT_ASSET", "targetAssetId": "img-1", ...}`

### 场景 7: 创意总监 API - 回答问题

**目标**: 测试回答问题的场景

**执行步骤**:
1. 使用 `playwright_post` 工具
2. URL: `http://localhost:8787/api/reel/creative-director`
3. Headers: 包含有效的 Authorization token
4. Body:
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
5. **预期结果**: 
   - 状态码: 200
   - 响应体: `{"action": "ANSWER_QUESTION", "prompt": "...", ...}`

### 场景 8: 创意总监 API - 模型不匹配检测

**目标**: 测试模型不匹配检测功能

**执行步骤**:
1. 使用 `playwright_post` 工具
2. URL: `http://localhost:8787/api/reel/creative-director`
3. Headers: 包含有效的 Authorization token
4. Body:
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
5. **预期结果**: 
   - 状态码: 200
   - 响应体: `{"action": "MODEL_MISMATCH", "suggestedModel": "veo_fast", ...}`

### 场景 9: 生成图片 API

**目标**: 测试图片生成功能

**执行步骤**:
1. 使用 `playwright_post` 工具
2. URL: `http://localhost:8787/api/reel/generate`
3. Headers: 包含有效的 Authorization token
4. Body:
   ```json
   {
     "prompt": "一只可爱的小猫，坐在窗台上，阳光洒进来",
     "model": "banana",
     "images": [],
     "aspectRatio": "9:16"
   }
   ```
5. **预期结果**: 
   - 状态码: 200
   - 响应体包含: `{"assetId": "...", "type": "image", "src": "...", ...}`
   - **注意**: 生成可能需要一些时间

### 场景 10: 生成视频 API

**目标**: 测试视频生成功能

**执行步骤**:
1. 使用 `playwright_post` 工具
2. URL: `http://localhost:8787/api/reel/generate`
3. Headers: 包含有效的 Authorization token
4. Body:
   ```json
   {
     "prompt": "一个无人机航拍场景，缓慢飞过城市上空",
     "model": "veo_fast",
     "images": [],
     "aspectRatio": "9:16"
   }
   ```
5. **预期结果**: 
   - 状态码: 200
   - 响应体包含: `{"assetId": "...", "type": "video", "src": "...", ...}`
   - **注意**: 视频生成可能需要较长时间（可能需要轮询）

### 场景 11: 边界场景 - 空提示词

**目标**: 测试空输入的处理

**执行步骤**:
1. 使用 `playwright_post` 工具
2. URL: `http://localhost:8787/api/reel/creative-director`
3. Headers: 包含有效的 Authorization token
4. Body:
   ```json
   {
     "userPrompt": "",
     "selectedModel": "banana",
     "assets": {},
     "selectedAssetId": null,
     "lastGeneratedAssetId": null,
     "messages": [],
     "hasUploadedFiles": false
   }
   ```
5. **预期结果**: 
   - 应该返回错误或正确处理空输入

### 场景 12: 边界场景 - 缺失必填字段

**目标**: 测试缺失必填字段的处理

**执行步骤**:
1. 使用 `playwright_post` 工具
2. URL: `http://localhost:8787/api/reel/creative-director`
3. Headers: 包含有效的 Authorization token
4. Body:
   ```json
   {
     "selectedModel": "banana"
     // 缺少 userPrompt
   }
   ```
5. **预期结果**: 
   - 状态码: 400
   - 响应体包含错误信息

## 测试结果记录

执行每个测试场景后，记录以下信息：

1. **请求信息**:
   - URL
   - Method
   - Headers
   - Body

2. **响应信息**:
   - 状态码
   - 响应时间
   - 响应体
   - 错误信息（如果有）

3. **问题发现**:
   - 是否与预期不符
   - 潜在问题描述
   - 建议修复方案

## 潜在问题检查清单

在执行测试时，注意检查：

- [ ] **认证问题**: Token 过期、格式错误、缺失处理
- [ ] **输入验证**: 空值、超长输入、特殊字符处理
- [ ] **响应格式**: JSON 结构、错误信息清晰度
- [ ] **业务逻辑**: 模型不匹配检测、编辑 vs 新建判断
- [ ] **性能问题**: 响应时间、超时处理
- [ ] **错误处理**: 网络错误、API 限制、地理位置限制

## 生成测试报告

测试完成后，整理测试结果并生成报告：

1. 统计测试通过/失败数量
2. 列出发现的问题
3. 提供修复建议
4. 记录响应时间等性能指标

## 注意事项

1. **API 配额**: 注意 Gemini API 的调用限制
2. **测试环境**: 确保在测试环境中运行
3. **测试数据**: 使用测试账号，避免影响真实数据
4. **清理**: 测试完成后清理测试数据
