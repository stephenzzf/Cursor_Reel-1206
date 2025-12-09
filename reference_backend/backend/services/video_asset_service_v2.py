import sys
import os

# Dirty fix for environment path issues in some setups
try:
    import firebase_admin
except ImportError:
    # Common path for macOS user installs
    user_site = os.path.expanduser('~/Library/Python/3.9/lib/python/site-packages')
    if os.path.exists(user_site) and user_site not in sys.path:
        sys.path.append(user_site)
    try:
        import firebase_admin
    except ImportError:
        print("CRITICAL: firebase_admin module not found even after path adjustment.")
        # We don't raise here to allow the app to start, but the service will be broken
        pass

from firebase_admin import credentials, firestore, storage
import io
import datetime
import logging
import json

# Configure logging
logger = logging.getLogger(__name__)

class VideoAssetService:
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
            # Check if Firebase is already initialized
            if not firebase_admin._apps:
                # Priority 1: Service Account JSON path from env
                cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH')
                
                # Priority 2: Service Account JSON content from env
                cred_json = os.getenv('FIREBASE_CREDENTIALS_JSON')

                cred = None
                if cred_path and os.path.exists(cred_path):
                    print(f"Initializing Firebase with credentials from: {cred_path}")
                    cred = credentials.Certificate(cred_path)
                elif cred_json:
                    print(f"Initializing Firebase with credentials from JSON string")
                    try:
                        cred_dict = json.loads(cred_json)
                        cred = credentials.Certificate(cred_dict)
                    except Exception as e:
                        print(f"Failed to parse FIREBASE_CREDENTIALS_JSON: {e}")
                else:
                    # Fallback/Default: Look for serviceAccountKey.json in current or backend dir
                    default_paths = ['serviceAccountKey.json', 'backend/serviceAccountKey.json']
                    for p in default_paths:
                        if os.path.exists(p):
                            print(f"Initializing Firebase with default credentials file: {p}")
                            cred = credentials.Certificate(p)
                            break
                
                if cred:
                    storage_bucket = os.getenv('FIREBASE_STORAGE_BUCKET')
                    if not storage_bucket:
                        print("WARNING: FIREBASE_STORAGE_BUCKET not set in .env")
                    
                    firebase_admin.initialize_app(cred, {
                        'storageBucket': storage_bucket
                    })
                    print("Firebase initialized successfully")
                else:
                    print("WARNING: No Firebase credentials found. Firebase features will be disabled or fail.")
            
            # Initialize clients if app exists (initialized by us or elsewhere)
            if firebase_admin._apps:
                self.db = firestore.client()
                try:
                    self.bucket = storage.bucket()
                except Exception as e:
                    print(f"Failed to initialize Storage bucket: {e}")
            
        except Exception as e:
            print(f"Error initializing VideoAssetService: {e}")

        self._initialized = True

    def is_available(self):
        return self.db is not None and self.bucket is not None

    def archive_and_prepare_reference(self, image_bytes, mime_type, prompt):
        """
        Uploads image to Firebase Storage and creates a Firestore record.
        Returns: (doc_ref, public_url, storage_path)
        """
        if not self.is_available():
            print("Firebase service not available, skipping archive.")
            return None, None, None

        try:
            timestamp = int(datetime.datetime.now().timestamp())
            # Simple sanitization for filename
            ext = '.jpg'
            if 'png' in mime_type.lower(): ext = '.png'
            elif 'webp' in mime_type.lower(): ext = '.webp'
            
            file_name = f"veo_references/{timestamp}{ext}"
            
            # 1. Upload to Firebase Storage
            print(f"Uploading asset to Firebase Storage: {file_name}")
            blob = self.bucket.blob(file_name)
            
            # upload_from_file expects a file-like object
            blob.upload_from_file(io.BytesIO(image_bytes), content_type=mime_type)
            
            # Use public URL or media link
            public_url = blob.media_link
            
            # 2. Create Firestore Record
            print("Creating Firestore asset record")
            doc_ref = self.db.collection("veo_assets").document()
            doc_data = {
                "type": "reference_image",
                "storage_path": file_name,
                "public_url": public_url,
                "prompt": prompt,
                "uploaded_at": datetime.datetime.now(),
                "veo_status": "processing",
                "gemini_file_uri": None
            }
            doc_ref.set(doc_data)
            
            return doc_ref, public_url, file_name

        except Exception as e:
            print(f"Error in archive_and_prepare_reference: {e}")
            return None, None, None

    def update_asset_status(self, doc_ref, status, video_uri=None, error=None):
        """Updates the status of the asset in Firestore."""
        if not doc_ref:
            return

        try:
            update_data = {"veo_status": status}
            if video_uri:
                update_data["generated_video_uri"] = video_uri
            if error:
                update_data["error"] = str(error)
            
            doc_ref.update(update_data)
            print(f"Updated asset status to {status}")
        except Exception as e:
            print(f"Failed to update asset status: {e}")

# Global getter
def get_video_asset_service():
    return VideoAssetService()

