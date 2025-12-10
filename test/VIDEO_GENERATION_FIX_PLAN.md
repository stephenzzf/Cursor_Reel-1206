# 图生视频和首尾帧生视频修复方案

## 🔍 问题诊断

### 当前状态
- ✅ **文生视频**：正常工作
- ❌ **图生视频**：失败
- ❌ **首尾帧生视频**：失败

### 根本原因

对比参考实现（`reference_backend`）和当前实现，发现关键区别：

**当前实现（backend/routes/reel.py）：**
```python
# 直接使用 base64 解码的 bytes
image_bytes = base64.b64decode(image_data_str)
base_interpol_image = types.Image(
    image_bytes=image_bytes,  # ❌ 直接使用 bytes
    mime_type=image_mime_type
)
```

**参考实现（reference_backend/backend/routes/video.py）：**
```python
# 1. 先上传到 Firebase Storage 获取 GCS URI
doc_ref, _, first_gcs_uri = asset_service.archive_and_prepare_reference(
    image_bytes, 
    image_mime_type, 
    prompt
)

# 2. 使用 GCS URI 而不是直接使用 bytes
base_interpol_image = types.Image(gcs_uri=first_gcs_uri)  # ✅ 使用 GCS URI
```

### 问题分析

Veo API 在处理图片输入时，**需要使用 Google Cloud Storage (GCS) URI** 而不是直接的图片字节流。这可能是 API 的要求，或者是使用 GCS URI 能提供更好的性能和可靠性。

## 📋 解决方案

### 步骤 1: 创建 VideoAssetService

需要创建 `backend/services/video_asset_service.py`，提供图片上传到 Firebase Storage 并获取 GCS URI 的功能。

**关键功能：**
- `archive_and_prepare_reference(image_bytes, mime_type, prompt)` 
  - 上传图片到 Firebase Storage
  - 创建 Firestore 记录（可选，用于追踪）
  - 返回 `(doc_ref, public_url, gcs_uri)`

### 步骤 2: 修改视频生成逻辑

在 `backend/routes/reel.py` 的 `generate()` 函数中：

**修改前：**
```python
if images and len(images) > 0:
    image_bytes = base64.b64decode(image_data_str)
    base_interpol_image = types.Image(
        image_bytes=image_bytes,
        mime_type=image_mime_type
    )
```

**修改后：**
```python
if images and len(images) > 0:
    image_bytes = base64.b64decode(image_data_str)
    
    # 上传到 Firebase Storage 并获取 GCS URI
    asset_service = get_video_asset_service()
    first_gcs_uri = None
    doc_ref = None
    
    try:
        doc_ref, _, first_gcs_uri = asset_service.archive_and_prepare_reference(
            image_bytes, 
            image_mime_type, 
            prompt
        )
        print(f"[API] ✅ Image uploaded to Firebase Storage")
        print(f"[API] GCS URI: {first_gcs_uri}")
    except Exception as e:
        print(f"[API] ⚠️ Failed to upload image to Firebase: {e}")
        # Fallback: 使用直接 bytes（可能会失败）
        first_gcs_uri = None
    
    # 使用 GCS URI 创建图片对象
    if first_gcs_uri:
        base_interpol_image = types.Image(gcs_uri=first_gcs_uri)
    else:
        # Fallback（不推荐，可能会失败）
        base_interpol_image = types.Image(
            image_bytes=image_bytes,
            mime_type=image_mime_type
        )
```

### 步骤 3: 处理首尾帧

对于首尾帧生视频（2 张图片的情况），需要分别上传两张图片：

```python
# 处理首帧
if images and len(images) > 0:
    # ... 上传首帧获取 first_gcs_uri ...

# 处理尾帧
if len(images) >= 2:
    last_frame_bytes = base64.b64decode(last_frame_data_str)
    
    try:
        _, _, last_frame_gcs_uri = asset_service.archive_and_prepare_reference(
            last_frame_bytes,
            last_frame_mime_type,
            f"{prompt} (Last Frame)"
        )
        print(f"[API] ✅ Last frame uploaded to Firebase Storage")
        print(f"[API] Last Frame GCS URI: {last_frame_gcs_uri}")
    except Exception as e:
        print(f"[API] ⚠️ Failed to upload last frame: {e}")
        last_frame_gcs_uri = None
    
    # 使用 GCS URI 创建尾帧图片对象
    if last_frame_gcs_uri:
        last_frame_image = types.Image(gcs_uri=last_frame_gcs_uri)
        config.last_frame = last_frame_image
        print("[API] ✅ Start/End Frame interpolation enabled")
```

## 📝 需要创建/修改的文件

### 1. 新建文件：`backend/services/video_asset_service.py`

从 `reference_backend/backend/services/video_asset_service.py` 复制并适配：
- 初始化 Firebase Storage
- 提供 `archive_and_prepare_reference()` 方法
- 提供 `update_asset_status()` 方法（用于追踪生成状态）

### 2. 修改文件：`backend/routes/reel.py`

在视频生成部分：
- 导入 `get_video_asset_service`
- 在处理图片输入时先上传到 Firebase Storage
- 使用 GCS URI 创建 `types.Image` 对象

### 3. 检查依赖：`backend/requirements.txt`

确保包含：
- `firebase-admin`（应该已经有了）
- Firebase Storage 相关功能已启用

## 🔧 实现细节

### VideoAssetService 关键方法

```python
def archive_and_prepare_reference(self, image_bytes, mime_type, prompt):
    """
    上传图片到 Firebase Storage 并获取 GCS URI
    
    Args:
        image_bytes: 图片字节流
        mime_type: MIME 类型（如 'image/jpeg'）
        prompt: 提示词（用于 Firestore 记录）
    
    Returns:
        (doc_ref, public_url, gcs_uri)
        - doc_ref: Firestore 文档引用（用于追踪）
        - public_url: 公开访问 URL
        - gcs_uri: GCS URI（格式：gs://bucket-name/path/to/image.jpg）
    """
    # 1. 上传到 Firebase Storage
    # 2. 获取 GCS URI
    # 3. 创建 Firestore 记录（可选）
    # 4. 返回 URI
```

### GCS URI 格式

```
gs://{bucket-name}/veo_references/{timestamp}.{ext}
```

例如：
```
gs://ethereal-shine-436906-r5.appspot.com/veo_references/1702184400.jpg
```

## ✅ 验证步骤

修复后需要测试：

1. **图生视频**
   - 上传一张图片
   - 生成视频
   - 检查日志中的 GCS URI
   - 验证视频生成成功

2. **首尾帧生视频**
   - 上传两张图片
   - 生成视频
   - 检查日志中的两个 GCS URI
   - 验证视频生成成功并包含首尾帧插值

3. **文生视频**（确保不影响现有功能）
   - 不上传图片
   - 生成视频
   - 验证仍然正常工作

## 🚨 注意事项

1. **Firebase Storage 权限**
   - 确保 Cloud Run 服务账户有 Firebase Storage 写入权限
   - 可能需要配置存储桶的 CORS 规则

2. **错误处理**
   - 如果上传失败，可以有 fallback 到直接使用 bytes
   - 但要记录警告，因为可能会失败

3. **存储成本**
   - 上传的参考图片会占用 Firebase Storage 空间
   - 可以考虑定期清理旧的参考图片

4. **性能**
   - 上传图片会增加一点延迟
   - 但使用 GCS URI 可能会让 Veo API 处理更快

## 📊 预期改进

修复后应该：
- ✅ 图生视频成功生成
- ✅ 首尾帧生视频成功生成
- ✅ 文生视频仍然正常工作
- ✅ 更好的错误追踪（通过 Firestore 记录）

---

**请确认此方案后，我将开始实施修复。**
