# HTTP 405 错误修复总结

## ✅ 问题已解决

### 问题描述
用户提交提示词后收到错误：`HTTP 405: METHOD NOT ALLOWED`

### 根本原因
前端在开发环境下没有配置代理，导致 API 请求被发送到前端开发服务器而不是后端服务器。前端服务器无法处理 `/api/reel/creative-director` 的 POST 请求，返回 405 错误。

### 修复方案

#### 1. 添加 Vite 代理配置
在 `frontend/vite.config.ts` 中添加了代理配置：

```typescript
server: {
  port: 3000,
  host: '0.0.0.0',
  proxy: {
    '/api': {
      target: 'http://localhost:8787',
      changeOrigin: true,
      secure: false,
    }
  }
}
```

#### 2. 更新 API_BASE_URL 配置
在 `frontend/hooks/useReelApi.ts` 中更新配置：

```typescript
// 开发环境使用相对路径，利用 Vite 代理
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
    (import.meta.env.PROD ? '' : '');
```

### 工作原理

1. 前端发送请求到 `/api/reel/creative-director`（相对路径）
2. Vite 开发服务器拦截 `/api` 开头的请求
3. 自动转发到 `http://localhost:8787/api/reel/creative-director`
4. 后端处理请求并返回响应
5. Vite 将响应返回给前端

### 验证结果

- ✅ 后端路由正确注册
- ✅ 所有 API 端点支持 POST 方法
- ✅ Vite 代理配置已添加
- ✅ API_BASE_URL 已更新
- ✅ 前端服务已重启并生效

### 使用方法

前端现在会自动将 API 请求代理到后端，无需手动配置完整 URL。

**测试步骤**：
1. 打开浏览器访问 http://localhost:3000
2. 输入提示词并提交
3. 检查浏览器 Network 标签
4. 确认请求被正确代理到后端
5. 不应再出现 405 错误
