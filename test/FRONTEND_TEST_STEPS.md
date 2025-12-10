# 前端应用测试步骤 - 图生视频和首尾帧生视频

## 🚀 快速测试指南

### 1. 确认服务运行

**本地前端：**
```bash
# 检查前端是否运行
curl http://localhost:3000

# 如果未运行，启动前端
cd frontend
npm run dev
```

**Cloud Run 部署：**
- URL: `https://demo-reel-rhwvkpevsq-de.a.run.app`
- 后端健康检查: `https://demo-reel-518510771526.asia-east1.run.app/health`

### 2. 测试步骤

#### A. 图生视频测试

1. **打开应用**
   - 访问：`http://localhost:3000` 或 Cloud Run URL

2. **登录**
   - 点击登录按钮
   - 使用 Google 账号或其他认证方式登录
   - 等待登录完成

3. **上传图片**
   - 找到图片上传区域
   - 选择一张测试图片（JPG 或 PNG）
   - 确认图片已上传

4. **生成视频**
   - 输入提示词（例如："基于这张图片生成动态视频"）
   - 选择模型：`Veo Fast`
   - 点击"生成"或"创建视频"按钮

5. **观察结果**
   - 查看是否有上传进度
   - 查看生成状态（"正在生成..."）
   - 等待 30-60 秒
   - 检查是否显示生成的视频

#### B. 首尾帧生视频测试

1. **上传两张图片**
   - 上传第一张图片（首帧）
   - 上传第二张图片（尾帧）
   - 确认两张图片都已加载

2. **生成视频**
   - 输入提示词（例如："从第一张过渡到第二张"）
   - 选择模型：`Veo Fast`
   - 点击生成

3. **验证插值效果**
   - 检查视频是否包含平滑过渡
   - 验证首帧和尾帧都正确应用

#### C. 文生视频回归测试

1. **不上传图片**
   - 只输入文本提示词
   - 选择 `Veo Fast` 模型
   - 生成视频

2. **验证功能正常**
   - 确认文生视频仍然工作
   - 检查生成时间正常

### 3. 浏览器开发者工具检查

打开浏览器开发者工具（F12）：

**Console 标签：**
- 检查是否有 JavaScript 错误
- 查看 API 调用的日志

**Network 标签：**
- 过滤：`/api/reel/generate`
- 检查请求：
  - 请求方法：POST
  - 状态码：200（成功）或 500（失败）
  - 请求体：包含 `images` 数组
  - 响应：包含 `assetId` 和 `src`

**预期请求格式：**
```json
{
  "prompt": "基于图片生成视频",
  "model": "veo_fast",
  "images": [
    {
      "data": "base64_encoded_image_data",
      "mimeType": "image/jpeg"
    }
  ],
  "aspectRatio": "9:16"
}
```

### 4. 后端日志验证

在终端运行：
```bash
gcloud run services logs tail demo-reel \
  --region asia-east1 \
  --project stephen-poc \
  --format="value(textPayload)" \
  | grep -E "VideoAssetService|GCS URI|Using.*model|生成"
```

**应该看到：**
- `[VideoAssetService] 📤 Uploading image to Firebase Storage`
- `[VideoAssetService] ✅ Image uploaded successfully`
- `[VideoAssetService] GCS URI: gs://...`
- `[API] ✅ Using GCS URI for base image`
- `[API] ✅ Video generation completed successfully`

### 5. 常见问题

**Q: 图片上传后没有反应？**
- 检查浏览器控制台是否有错误
- 检查网络请求是否发送成功
- 查看后端日志确认收到请求

**Q: 视频生成失败？**
- 检查提示词是否有效
- 验证图片格式和大小
- 查看后端日志的错误信息

**Q: 生成时间过长？**
- Veo Fast 通常需要 30-60 秒
- 如果超过 2 分钟，检查后端日志
- 可能是 API 限流或网络问题

## 📊 测试结果记录

### 测试结果表格

| 测试场景 | 状态 | 响应时间 | 备注 |
|---------|------|---------|------|
| 图生视频（单张） | ⬜ | - | - |
| 首尾帧生视频 | ⬜ | - | - |
| 文生视频（回归） | ⬜ | - | - |

### 日志摘要

记录关键日志信息：
- 图片上传是否成功
- GCS URI 是否正确生成
- 视频生成是否完成
- 是否有错误信息

---

**测试完成后，请在应用中实际验证功能是否正常工作。**
