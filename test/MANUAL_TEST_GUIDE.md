# 图生视频和首尾帧生视频功能 - 手动测试指南

## 🎯 测试目标

验证修复后的图生视频和首尾帧生视频功能是否正常工作。

## 📋 前置条件

1. ✅ 后端服务已部署到 Cloud Run
2. ✅ 前端服务可访问（本地或 Cloud Run）
3. ✅ 已登录并获取 Firebase Token

## 🧪 测试步骤

### 测试 1: 图生视频（单张图片）

#### 步骤 1: 访问应用
1. 打开浏览器，访问：
   - 本地：`http://localhost:3000`
   - 或 Cloud Run：`https://demo-reel-rhwvkpevsq-de.a.run.app`

#### 步骤 2: 登录
1. 如果未登录，点击登录按钮
2. 使用有效的账号登录
3. 确认已成功登录

#### 步骤 3: 上传图片并生成视频
1. 导航到视频生成页面
2. 上传一张参考图片
3. 输入提示词（例如："基于这张图片生成动态视频"）
4. 选择模型：`Veo Fast`
5. 点击生成按钮

#### 步骤 4: 验证结果
- ✅ 查看是否有上传进度提示
- ✅ 查看是否显示"正在生成..."状态
- ✅ 等待生成完成（通常 30-60 秒）
- ✅ 检查是否成功生成视频
- ✅ 验证视频可以播放

#### 步骤 5: 检查日志
打开浏览器开发者工具（F12）→ Console 标签：
- 检查是否有错误信息
- 查看网络请求（Network 标签）：
  - 检查 `/api/reel/generate` 请求
  - 验证请求包含图片数据
  - 检查响应状态码（应为 200）

### 测试 2: 首尾帧生视频（两张图片）

#### 步骤 1: 上传两张图片
1. 在视频生成页面
2. 上传第一张图片（首帧）
3. 上传第二张图片（尾帧）
4. 输入提示词（例如："从第一张图片平滑过渡到第二张"）

#### 步骤 2: 生成视频
1. 选择模型：`Veo Fast`
2. 点击生成按钮

#### 步骤 3: 验证结果
- ✅ 确认两张图片都已上传
- ✅ 查看生成状态
- ✅ 等待生成完成
- ✅ 验证视频包含首尾帧插值效果

#### 步骤 4: 检查日志
查看浏览器控制台和网络请求，确认：
- 两张图片都已发送
- 响应成功
- 视频 URI 有效

### 测试 3: 文生视频（回归测试）

#### 步骤 1: 不上传图片
1. 在视频生成页面
2. 不选择任何图片
3. 输入文本提示词（例如："一个美丽的风景视频"）

#### 步骤 2: 生成视频
1. 选择模型：`Veo Fast`
2. 点击生成按钮

#### 步骤 3: 验证结果
- ✅ 确认文生视频功能仍然正常工作
- ✅ 生成时间在预期范围内
- ✅ 视频质量符合预期

## 📊 后端日志检查

### 查看 Cloud Run 日志

```bash
gcloud run services logs tail demo-reel --region asia-east1 --project stephen-poc
```

### 关键日志检查点

#### 图生视频成功时应看到：
```
[VideoAssetService] 📤 Uploading image to Firebase Storage: veo_references/...
[VideoAssetService] ✅ Image uploaded successfully
[VideoAssetService] GCS URI: gs://ethereal-shine-436906-r5.appspot.com/veo_references/...
[API] ✅ Using GCS URI for base image
[API] Using Veo model: veo-3.1-fast-generate-preview (requested: veo_fast)
[API] 🚀 Starting video generation...
[API] ✅ Video generation completed successfully
```

#### 首尾帧生视频成功时应看到：
```
[VideoAssetService] GCS URI: gs://.../veo_references/... (首帧)
[VideoAssetService] GCS URI: gs://.../veo_references/... (尾帧)
[API] ✅ Using GCS URI for base image
[API] ✅ Using GCS URI for last frame
[API] ✅ Start/End Frame interpolation enabled
[API] ✅ Video generation completed successfully
```

## 🐛 故障排查

### 问题 1: 图片上传失败

**症状：** 日志显示 "Failed to upload image to Firebase Storage"

**可能原因：**
- Firebase Storage 权限问题
- Storage Bucket 配置不正确

**解决方案：**
```bash
# 检查 Firebase Storage 配置
gcloud run services describe demo-reel --region asia-east1 --project stephen-poc \
  --format="get(spec.template.spec.containers[0].env)"
```

### 问题 2: GCS URI 未生成

**症状：** 日志显示 "Failed to get GCS URI"

**检查：**
1. Firebase Storage Bucket 是否正确设置
2. 服务账户是否有 Storage 写入权限

### 问题 3: 视频生成失败

**症状：** 返回错误 "No videos generated"

**检查：**
1. Veo API 是否正常工作
2. 模型名称是否正确
3. API Key 是否有效

## ✅ 测试检查清单

### 功能检查
- [ ] 图生视频功能正常
- [ ] 首尾帧生视频功能正常
- [ ] 文生视频仍然正常工作（回归测试）
- [ ] 错误处理正确（上传失败等情况）

### 日志检查
- [ ] 图片上传日志出现
- [ ] GCS URI 正确显示
- [ ] 使用 GCS URI 的确认日志
- [ ] 视频生成成功日志

### 用户体验检查
- [ ] 上传进度提示清晰
- [ ] 生成状态显示准确
- [ ] 错误信息用户友好
- [ ] 视频播放正常

## 📝 测试报告模板

完成测试后，记录以下信息：

```
测试日期: YYYY-MM-DD
测试人员: [姓名]
环境: [本地/Cloud Run]

测试结果:
- 图生视频: ✅ 通过 / ❌ 失败
- 首尾帧生视频: ✅ 通过 / ❌ 失败
- 文生视频: ✅ 通过 / ❌ 失败

发现问题:
- [描述问题]

日志摘要:
- [关键日志信息]
```

## 🔗 相关资源

- Cloud Run 服务: `demo-reel` (asia-east1)
- 服务 URL: `https://demo-reel-rhwvkpevsq-de.a.run.app`
- 日志查看: `gcloud run services logs tail demo-reel --region asia-east1 --project stephen-poc`

---

**提示：** 如果遇到问题，请查看后端日志获取详细的错误信息。
