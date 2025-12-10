# 图生视频和首尾帧生视频集成测试计划

## 测试目标

验证修复后的图生视频和首尾帧生视频功能：
1. ✅ 图生视频：上传一张图片，生成视频
2. ✅ 首尾帧生视频：上传两张图片，生成包含首尾帧插值的视频

## 测试环境

- 后端服务：`http://localhost:8787` 或 Cloud Run URL
- 需要有效的 Firebase Token（用于认证）

## 测试场景

### 场景 1: 图生视频（单张图片）

**请求**:
```bash
POST /api/reel/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "基于这张图片生成一个动态视频",
  "model": "veo_fast",
  "images": [
    {
      "data": "<base64_encoded_image>",
      "mimeType": "image/jpeg"
    }
  ],
  "aspectRatio": "9:16"
}
```

**预期结果**:
- ✅ 状态码: 200
- ✅ 图片已上传到 Firebase Storage
- ✅ 日志显示 GCS URI
- ✅ 视频生成成功
- ✅ 返回视频 URI

### 场景 2: 首尾帧生视频（两张图片）

**请求**:
```bash
POST /api/reel/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "从第一张图片过渡到第二张图片",
  "model": "veo_fast",
  "images": [
    {
      "data": "<base64_encoded_image_1>",
      "mimeType": "image/jpeg"
    },
    {
      "data": "<base64_encoded_image_2>",
      "mimeType": "image/jpeg"
    }
  ],
  "aspectRatio": "9:16"
}
```

**预期结果**:
- ✅ 状态码: 200
- ✅ 两张图片都已上传到 Firebase Storage
- ✅ 日志显示两个 GCS URI
- ✅ 日志显示 "Start/End Frame interpolation enabled"
- ✅ 视频生成成功

### 场景 3: 文生视频（验证不影响现有功能）

**请求**:
```bash
POST /api/reel/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "一个美丽的风景视频",
  "model": "veo_fast",
  "images": [],
  "aspectRatio": "9:16"
}
```

**预期结果**:
- ✅ 状态码: 200
- ✅ 视频生成成功（与之前一样）

## 检查点

### 日志检查
应该看到以下日志：
- `[VideoAssetService] 📤 Uploading image to Firebase Storage`
- `[VideoAssetService] ✅ Image uploaded successfully`
- `[VideoAssetService] GCS URI: gs://...`
- `[API] ✅ Using GCS URI for base image`
- `[API] ✅ Using GCS URI for last frame`（如果是首尾帧）

### 响应检查
- 包含 `assetId`
- `type: "video"`
- `src` 包含有效的视频 URL
- `status: "done"`

## 测试步骤

1. 确保后端服务运行
2. 获取有效的 Firebase Token
3. 准备测试图片（base64 编码）
4. 执行测试场景 1（图生视频）
5. 执行测试场景 2（首尾帧生视频）
6. 执行测试场景 3（文生视频，验证回归）
7. 检查日志和响应
