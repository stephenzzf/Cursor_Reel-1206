# HTTP 405 错误修复报告

## 🔍 问题分析

用户遇到 `HTTP 405: METHOD NOT ALLOWED` 错误，原因分析：

1. **问题根源**：前端在开发环境下没有配置代理，导致 API 请求发送到了前端开发服务器（端口 3001）而不是后端服务器（端口 8787）

2. **具体情况**：
   - 前端代码中 `API_BASE_URL` 在开发环境设置为 `http://localhost:8787`
   - 但如果使用相对路径（空字符串），请求会被发送到前端服务器
   - 前端 Vite 开发服务器没有 `/api` 路由处理，返回 405 错误

## ✅ 修复方案

### 1. 添加 Vite 代理配置

在 `frontend/vite.config.ts` 中添加了代理配置：

```typescript
server: {
  port: 3000,
  host: '0.0.0.0',
  // 代理 API 请求到后端服务器
  proxy: {
    '/api': {
      target: 'http://localhost:8787',
      changeOrigin: true,
      secure: false,
    }
  }
}
```

### 2. 更新 API_BASE_URL 逻辑

在 `frontend/hooks/useReelApi.ts` 中更新了 API_BASE_URL 配置：

```typescript
// 开发环境下使用空字符串（相对路径），利用 Vite 代理
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
    (import.meta.env.PROD ? '' : '');
```

## 📋 修复内容

1. ✅ **添加 Vite 代理配置** - 所有 `/api` 开头的请求自动代理到 `http://localhost:8787`
2. ✅ **更新 API_BASE_URL** - 开发环境使用相对路径，利用代理功能
3. ✅ **验证后端路由** - 确认所有 API 端点正确注册，支持 POST 方法

## 🚀 使用方法

### 重启前端服务

修复后需要重启前端开发服务器：

```bash
# 停止当前前端服务
pkill -f "vite"

# 重新启动
cd frontend
npm run dev
```

### 验证修复

1. 打开浏览器开发者工具（F12）
2. 查看 Network 标签
3. 提交一个提示词
4. 确认请求发送到正确的后端地址
5. 应该不再出现 405 错误

## 📝 技术说明

### Vite 代理工作原理

- 当浏览器发送请求到 `/api/reel/creative-director` 时
- Vite 开发服务器拦截该请求（匹配 `/api` 规则）
- 自动转发到 `target: 'http://localhost:8787'`
- 后端处理请求并返回响应
- Vite 将响应返回给前端

### 优势

1. **统一配置**：所有 API 请求自动代理，无需手动指定完整 URL
2. **跨域解决**：代理自动处理 CORS 问题
3. **开发体验**：前端可以使用相对路径，更接近生产环境

## ✅ 验证结果

- ✅ 后端路由正确注册
- ✅ 所有 API 端点支持 POST 方法
- ✅ Vite 代理配置已添加
- ✅ API_BASE_URL 逻辑已更新

**需要重启前端服务后生效！**
