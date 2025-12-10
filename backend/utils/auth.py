"""
Firebase Auth Token 验证中间件
"""

from functools import wraps
from flask import request, jsonify
import os
import json

# 延迟导入 firebase_admin，避免在模块加载时初始化
_firebase_admin = None
_firebase_initialized = False


def _initialize_firebase():
    """初始化 Firebase Admin SDK"""
    global _firebase_admin, _firebase_initialized
    
    if _firebase_initialized:
        return _firebase_admin
    
    try:
        import firebase_admin
        from firebase_admin import credentials, auth
        
        # 检查是否已经初始化
        if not firebase_admin._apps:
            # Priority 1: Service Account JSON path from env
            cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH')
            
            # Priority 2: Service Account JSON content from env
            cred_json = os.getenv('FIREBASE_CREDENTIALS_JSON')
            
            cred = None
            
            # 解析相对路径：如果是相对路径，尝试基于 backend 目录解析
            if cred_path:
                # 如果路径是相对路径，尝试多个可能的基准目录
                if not os.path.isabs(cred_path):
                    # 可能的基准目录：backend 目录、当前工作目录、auth.py 所在目录的父目录
                    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                    possible_bases = [
                        backend_dir,  # backend/ 目录
                        os.getcwd(),  # 当前工作目录
                        os.path.dirname(os.path.abspath(__file__)),  # utils/ 目录
                    ]
                    
                    resolved_path = None
                    for base in possible_bases:
                        candidate = os.path.join(base, cred_path.lstrip('./'))
                        if os.path.exists(candidate):
                            resolved_path = candidate
                            break
                    
                    if resolved_path:
                        cred_path = resolved_path
                    else:
                        # 如果仍然找不到，尝试直接用原始路径（可能是相对于当前工作目录）
                        if not os.path.exists(cred_path):
                            cred_path = None  # 标记为未找到
                elif not os.path.exists(cred_path):
                    # 绝对路径不存在
                    cred_path = None
            
            if cred_path and os.path.exists(cred_path):
                print(f"Initializing Firebase with credentials from: {cred_path}")
                cred = credentials.Certificate(cred_path)
            elif cred_json:
                print("Initializing Firebase with credentials from JSON string")
                try:
                    cred_dict = json.loads(cred_json)
                    cred = credentials.Certificate(cred_dict)
                except Exception as e:
                    print(f"Failed to parse FIREBASE_CREDENTIALS_JSON: {e}")
            else:
                # Fallback/Default: Look for serviceAccountKey.json in current or backend dir
                default_paths = [
                    'serviceAccountKey.json',
                    'backend/serviceAccountKey.json',
                    os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json')
                ]
                for p in default_paths:
                    if os.path.exists(p):
                        print(f"Initializing Firebase with default credentials file: {p}")
                        cred = credentials.Certificate(p)
                        break
            
            if cred:
                try:
                    firebase_admin.initialize_app(cred)
                    print("✅ Firebase Admin SDK initialized successfully")
                except Exception as init_error:
                    print(f"❌ ERROR: Failed to initialize Firebase Admin SDK: {init_error}")
                    raise
            else:
                # 详细错误信息，帮助调试
                error_details = []
                env_path = os.getenv('FIREBASE_CREDENTIALS_PATH')
                if env_path:
                    error_details.append(f"FIREBASE_CREDENTIALS_PATH='{env_path}' (not found)")
                if not os.getenv('FIREBASE_CREDENTIALS_JSON'):
                    error_details.append("FIREBASE_CREDENTIALS_JSON not set")
                
                error_msg = (
                    "❌ ERROR: No Firebase credentials found.\n"
                    f"  Details: {'; '.join(error_details)}\n"
                    f"  Current working directory: {os.getcwd()}\n"
                    f"  Backend directory: {os.path.dirname(os.path.dirname(os.path.abspath(__file__)))}\n"
                    "  Please set FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS_JSON in .env file.\n"
                    "  Auth verification will fail."
                )
                print(error_msg)
                # 不抛出异常，允许应用启动，但在验证时会返回错误
        
        _firebase_admin = firebase_admin
        _firebase_initialized = True
        return _firebase_admin
    except ImportError:
        print("WARNING: firebase_admin not installed. Auth verification will fail.")
        return None
    except Exception as e:
        print(f"WARNING: Failed to initialize Firebase: {e}")
        return None


def verify_firebase_token(f):
    """
    Firebase Auth Token 验证装饰器
    
    使用方法:
    @reel_bp.route('/api/reel/endpoint')
    @verify_firebase_token
    def my_endpoint():
        # request.uid 包含已验证的用户 ID
        uid = request.uid
        ...
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 初始化 Firebase（如果尚未初始化）
        firebase_admin = _initialize_firebase()
        
        if not firebase_admin:
            return jsonify({"error": "Firebase not configured"}), 500
        
        # 获取 Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        
        try:
            # 检查 Firebase 是否已初始化
            if not firebase_admin._apps:
                error_msg = (
                    "Firebase Admin SDK not initialized. "
                    "Please configure FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS_JSON in .env file."
                )
                print(f"❌ {error_msg}")
                return jsonify({"error": error_msg}), 500
            
            # 提取 token
            token = auth_header.split('Bearer ')[1]
            
            # 验证 token
            from firebase_admin import auth
            decoded_token = auth.verify_id_token(token)
            
            # 将用户 ID 注入到 request 对象
            request.uid = decoded_token['uid']
            request.user_email = decoded_token.get('email', '')
            
            return f(*args, **kwargs)
        except Exception as e:
            print(f"Firebase token verification failed: {e}")
            # 清理错误信息，移除二进制表示，使其对用户更友好
            error_msg = str(e)
            # 移除 Python 二进制字符串表示（如 b'...'）
            if error_msg.startswith("b'") and error_msg.endswith("'"):
                error_msg = error_msg[2:-1]
            # 移除其他可能的二进制表示格式
            import re
            error_msg = re.sub(r"b'([^']+)'", r"\1", error_msg)
            return jsonify({"error": f"Invalid token: {error_msg}"}), 401
    
    return decorated_function

