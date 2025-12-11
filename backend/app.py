"""
Flask backend for Reel Generation
Provides secure API endpoints for generating reels (images and videos).
"""

import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
# Try to load from backend/.env first, then current directory
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

# 配置静态文件目录（前端构建产物）
# 在 Docker 容器中：
#   - 工作目录是 /app
#   - app.py 在 /app/app.py（因为 backend/ 被复制到 /app）
#   - 前端构建产物在 /app/frontend/dist
# 在开发环境中：
#   - app.py 在 backend/app.py
#   - 前端构建产物在 frontend/dist（相对于项目根目录）
FRONTEND_DIST = None
FRONTEND_DIST_EXISTS = False

# 尝试多个可能的路径
possible_paths = [
    '/app/frontend/dist',  # Docker 容器中的路径
    os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist'),  # 开发环境相对路径
    os.path.join(os.getcwd(), 'frontend', 'dist'),  # 当前工作目录
]

for path in possible_paths:
    if os.path.exists(path):
        FRONTEND_DIST = path
        FRONTEND_DIST_EXISTS = True
        print(f"Found frontend dist at: {FRONTEND_DIST}")
        break

if not FRONTEND_DIST_EXISTS:
    print(f"Warning: Frontend dist not found. Checked paths: {possible_paths}")
    print(f"Current working directory: {os.getcwd()}")
    print(f"App file location: {os.path.dirname(__file__)}")

# 如果前端构建目录存在，配置静态文件服务
if FRONTEND_DIST_EXISTS:
    app = Flask(__name__, static_folder=FRONTEND_DIST, static_url_path='')
else:
    # 开发环境：前端可能单独运行，不提供静态文件
    app = Flask(__name__)
    print("Warning: Frontend dist directory not found. Static file serving disabled.")

CORS(app)

# Environment Variables Check (on startup)
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
FIREBASE_CREDENTIALS_PATH = os.getenv('FIREBASE_CREDENTIALS_PATH')
FIREBASE_CREDENTIALS_JSON = os.getenv('FIREBASE_CREDENTIALS_JSON')
FIREBASE_STORAGE_BUCKET = os.getenv('FIREBASE_STORAGE_BUCKET')

print("=" * 50)
print("Environment Variables Check:")
print(f"  GEMINI_API_KEY: {'✅ SET' if GEMINI_API_KEY else '❌ NOT SET'}")
if GEMINI_API_KEY:
    print(f"    Length: {len(GEMINI_API_KEY)} chars")
print(f"  FIREBASE_CREDENTIALS_PATH: {'✅ SET' if FIREBASE_CREDENTIALS_PATH else '❌ NOT SET'}")
print(f"  FIREBASE_CREDENTIALS_JSON: {'✅ SET' if FIREBASE_CREDENTIALS_JSON else '❌ NOT SET'}")
print(f"  FIREBASE_STORAGE_BUCKET: {'✅ SET' if FIREBASE_STORAGE_BUCKET else '❌ NOT SET'}")
print("=" * 50)

# Initialize Firebase Admin SDK on startup
print("\n" + "=" * 50)
print("Initializing Firebase Admin SDK...")
try:
    from utils.auth import _initialize_firebase
    firebase_admin = _initialize_firebase()
    if firebase_admin and firebase_admin._apps:
        print("✅ Firebase Admin SDK initialized successfully")
    else:
        print("⚠️  WARNING: Firebase Admin SDK not initialized. Auth verification will fail.")
        print("   Please configure FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS_JSON in .env file")
except Exception as e:
    print(f"❌ ERROR: Failed to initialize Firebase Admin SDK: {e}")
    print("   Auth verification will fail. Please check your Firebase configuration.")
print("=" * 50 + "\n")

# Register blueprints
from routes.reel import reel_bp
from routes.brand_dna import brand_dna_bp
app.register_blueprint(reel_bp)
app.register_blueprint(brand_dna_bp)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return {"status": "ok"}

# SPA 路由处理：所有非 API 请求返回 index.html
# 这必须在所有蓝图注册之后，以确保 API 路由优先级更高
# 注意：只处理 GET 请求，避免拦截 POST/PUT/DELETE 等 API 请求
@app.route('/', defaults={'path': ''}, methods=['GET'])
@app.route('/<path:path>', methods=['GET'])
def serve_frontend(path):
    """
    提供前端静态文件服务（SPA 路由）
    所有非 /api 开头的 GET 请求都返回 index.html，让前端路由处理
    """
    # 如果路径以 api/ 开头，说明是 API 请求但未匹配到路由，返回 404
    if path.startswith('api/'):
        from flask import jsonify
        return jsonify({"error": "Not found"}), 404
    
    # 如果前端构建目录不存在（开发环境），返回提示信息
    if not FRONTEND_DIST_EXISTS:
        from flask import jsonify
        return jsonify({
            "error": "Frontend not built",
            "message": "Please run 'npm run build' in the frontend directory or start the frontend dev server separately.",
            "debug_info": {
                "frontend_dist": FRONTEND_DIST,
                "current_dir": os.getcwd(),
                "app_file_dir": os.path.dirname(__file__),
                "checked_paths": [
                    '/app/frontend/dist',
                    os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')
                ]
            }
        }), 503
    
    # 尝试提供静态文件（CSS、JS、图片等）
    try:
        return send_from_directory(FRONTEND_DIST, path)
    except Exception as e:
        # 如果文件不存在，返回 index.html（SPA 路由回退）
        print(f"Error serving static file {path}: {e}")
        try:
            return send_from_directory(FRONTEND_DIST, 'index.html')
        except Exception as e2:
            print(f"Error serving index.html: {e2}")
            from flask import jsonify
            return jsonify({
                "error": "Frontend files not found",
                "message": f"Could not find frontend files in {FRONTEND_DIST}",
                "error_details": str(e2)
            }), 503


if __name__ == '__main__':
    # Cloud Run 使用 PORT 环境变量，默认为 8080
    # 开发环境可以使用 8787
    port = int(os.getenv('PORT', 8787))
    # Use debug=False to avoid watchdog import issues in some environments
    debug_mode = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug_mode)

