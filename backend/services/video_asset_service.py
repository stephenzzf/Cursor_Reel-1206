"""
Video Asset Service
处理视频生成相关的资源管理（上传参考图片到 Firebase Storage，获取 GCS URI）
"""

import sys
import os

# 处理 firebase_admin 导入路径问题
try:
    import firebase_admin
except ImportError:
    user_site = os.path.expanduser('~/Library/Python/3.9/lib/site-packages')
    if os.path.exists(user_site) and user_site not in sys.path:
        sys.path.append(user_site)
    try:
        import firebase_admin
    except ImportError:
        print("WARNING: firebase_admin module not found. Video asset features will be disabled.")

from firebase_admin import credentials, firestore, storage
import io
import datetime
import json
import logging

logger = logging.getLogger(__name__)


class VideoAssetService:
    """管理视频生成资源的服务（上传图片到 Firebase Storage）"""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(VideoAssetService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.db = None
        self.bucket = None
        
        try:
            # 检查 Firebase 是否已初始化
            if not firebase_admin._apps:
                # 尝试从环境变量获取凭证
                cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH')
                cred_json = os.getenv('FIREBASE_CREDENTIALS_JSON')

                cred = None
                if cred_path and os.path.exists(cred_path):
                    print(f"[VideoAssetService] Initializing Firebase with credentials from: {cred_path}")
                    cred = credentials.Certificate(cred_path)
                elif cred_json:
                    print(f"[VideoAssetService] Initializing Firebase with credentials from JSON string")
                    try:
                        cred_dict = json.loads(cred_json)
                        cred = credentials.Certificate(cred_dict)
                    except Exception as e:
                        print(f"[VideoAssetService] Failed to parse FIREBASE_CREDENTIALS_JSON: {e}")
                else:
                    # Fallback: 查找默认凭证文件
                    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                    default_paths = [
                        os.path.join(backend_dir, 'serviceAccountKey.json'),
                        'serviceAccountKey.json',
                        'backend/serviceAccountKey.json'
                    ]
                    for p in default_paths:
                        if os.path.exists(p):
                            print(f"[VideoAssetService] Initializing Firebase with default credentials file: {p}")
                            cred = credentials.Certificate(p)
                            break
                
                if cred:
                    storage_bucket = os.getenv('FIREBASE_STORAGE_BUCKET')
                    if not storage_bucket:
                        print("[VideoAssetService] WARNING: FIREBASE_STORAGE_BUCKET not set in .env")
                    
                    firebase_admin.initialize_app(cred, {
                        'storageBucket': storage_bucket
                    })
                    print("[VideoAssetService] ✅ Firebase initialized successfully")
                else:
                    print("[VideoAssetService] WARNING: No Firebase credentials found. Asset archiving will be disabled.")
            
            # 初始化客户端（如果 Firebase 已初始化）
            if firebase_admin._apps:
                self.db = firestore.client()
                try:
                    self.bucket = storage.bucket()
                    print("[VideoAssetService] ✅ Storage bucket initialized")
                except Exception as e:
                    print(f"[VideoAssetService] ⚠️ Failed to initialize Storage bucket: {e}")
            
        except Exception as e:
            print(f"[VideoAssetService] ❌ Error initializing VideoAssetService: {e}")
            import traceback
            traceback.print_exc()

        self._initialized = True

    def is_available(self):
        """检查服务是否可用"""
        return self.db is not None and self.bucket is not None

    def archive_and_prepare_reference(self, image_bytes, mime_type, prompt):
        """
        上传图片到 Firebase Storage 并获取 GCS URI
        
        Args:
            image_bytes: 图片字节流
            mime_type: MIME 类型（如 'image/jpeg', 'image/png'）
            prompt: 提示词（用于 Firestore 记录）
        
        Returns:
            (doc_ref, public_url, gcs_uri)
            - doc_ref: Firestore 文档引用（用于追踪，可能为 None）
            - public_url: 公开访问 URL（可能为 None）
            - gcs_uri: GCS URI（格式：gs://bucket-name/path/to/image.jpg）
        """
        if not self.is_available():
            print("[VideoAssetService] ⚠️ Firebase service not available, skipping archive.")
            return None, None, None

        try:
            timestamp = int(datetime.datetime.now().timestamp() * 1000)  # 使用毫秒时间戳避免冲突
            # 根据 MIME 类型确定文件扩展名
            ext = '.jpg'
            if 'png' in mime_type.lower():
                ext = '.png'
            elif 'webp' in mime_type.lower():
                ext = '.webp'
            
            file_name = f"veo_references/{timestamp}{ext}"
            
            # 1. 上传到 Firebase Storage
            print(f"[VideoAssetService] 📤 Uploading image to Firebase Storage: {file_name}")
            blob = self.bucket.blob(file_name)
            
            # upload_from_file 需要一个文件类对象
            blob.upload_from_file(io.BytesIO(image_bytes), content_type=mime_type)
            
            # 获取公开 URL
            public_url = blob.media_link
            
            # 构造 GCS URI（gs:// 格式，用于 Veo API）
            bucket_name = self.bucket.name
            gcs_uri = f"gs://{bucket_name}/{file_name}"
            
            print(f"[VideoAssetService] ✅ Image uploaded successfully")
            print(f"[VideoAssetService] GCS URI: {gcs_uri}")
            
            # 2. 创建 Firestore 记录（可选，用于追踪）
            doc_ref = None
            try:
                doc_ref = self.db.collection("veo_assets").document()
                doc_data = {
                    "type": "reference_image",
                    "storage_path": file_name,
                    "public_url": public_url,
                    "gcs_uri": gcs_uri,
                    "prompt": prompt[:500] if prompt else "",  # 限制长度
                    "uploaded_at": datetime.datetime.now(),
                    "veo_status": "processing",
                    "gemini_file_uri": None
                }
                doc_ref.set(doc_data)
                print(f"[VideoAssetService] ✅ Firestore record created")
            except Exception as e:
                print(f"[VideoAssetService] ⚠️ Failed to create Firestore record (non-blocking): {e}")
            
            return doc_ref, public_url, gcs_uri

        except Exception as e:
            print(f"[VideoAssetService] ❌ Error in archive_and_prepare_reference: {e}")
            import traceback
            traceback.print_exc()
            return None, None, None

    def update_asset_status(self, doc_ref, status, video_uri=None, error=None):
        """
        更新 Firestore 中的资源状态
        
        Args:
            doc_ref: Firestore 文档引用
            status: 状态（如 'processing', 'completed', 'failed'）
            video_uri: 生成的视频 URI（可选）
            error: 错误信息（可选）
        """
        if not doc_ref:
            return

        try:
            update_data = {"veo_status": status}
            if video_uri:
                update_data["generated_video_uri"] = video_uri
            if error:
                update_data["error"] = str(error)[:1000]  # 限制错误信息长度
            
            doc_ref.update(update_data)
            print(f"[VideoAssetService] ✅ Updated asset status to {status}")
        except Exception as e:
            print(f"[VideoAssetService] ⚠️ Failed to update asset status: {e}")


def get_video_asset_service():
    """获取 VideoAssetService 单例"""
    return VideoAssetService()
