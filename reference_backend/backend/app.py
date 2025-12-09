"""
Flask backend for Brand Profile Analysis
Provides secure API endpoint for analyzing websites and generating brand profiles.
"""

import os
import json
import re
from urllib.parse import urlparse
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import requests
import google.generativeai as genai
from google.cloud import storage
from googleapiclient.discovery import build

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

# Initialize Google services
# Support both GEMINI_API_KEY and GOOGLE_API_KEY for compatibility
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
JINA_API_KEY = os.getenv('JINA_API_KEY')
GCP_PROJECT_ID = os.getenv('GCP_PROJECT_ID')
GCP_CSE_API_KEY = os.getenv('GCP_CSE_API_KEY')
GCP_CSE_ID = os.getenv('GCP_CSE_ID')
GCP_STORAGE_BUCKET_NAME = os.getenv('GCP_STORAGE_BUCKET_NAME')

# Configure Gemini
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Environment Variables Check (on startup)
print("=" * 50)
print("Environment Variables Check:")
print(f"  GEMINI_API_KEY: {'✅ SET' if GEMINI_API_KEY else '❌ NOT SET'}")
if GEMINI_API_KEY:
    print(f"    Length: {len(GEMINI_API_KEY)} chars")
print(f"  JINA_API_KEY: {'✅ SET' if JINA_API_KEY else '❌ NOT SET'}")
if JINA_API_KEY:
    print(f"    Length: {len(JINA_API_KEY)} chars")
print(f"  GCP_PROJECT_ID: {'✅ SET' if GCP_PROJECT_ID else '❌ NOT SET'}")
print(f"  GCP_STORAGE_BUCKET_NAME: {'✅ SET' if GCP_STORAGE_BUCKET_NAME else '❌ NOT SET'}")
print(f"  GCP_CSE_API_KEY: {'✅ SET' if GCP_CSE_API_KEY else '❌ NOT SET'}")
print(f"  GCP_CSE_ID: {'✅ SET' if GCP_CSE_ID else '❌ NOT SET'}")
print("=" * 50)

# Initialize Google Cloud Storage client
storage_client = None
if GCP_PROJECT_ID and GCP_STORAGE_BUCKET_NAME:
    try:
        storage_client = storage.Client(project=GCP_PROJECT_ID)
    except Exception as e:
        print(f"Warning: Could not initialize GCS client: {e}")

# Initialize Google Custom Search client
cse_service = None
if GCP_CSE_API_KEY and GCP_CSE_ID:
    try:
        cse_service = build("customsearch", "v1", developerKey=GCP_CSE_API_KEY)
    except Exception as e:
        print(f"Warning: Could not initialize CSE client: {e}")


def extract_domain(url: str) -> str:
    """Extract domain from URL."""
    try:
        parsed = urlparse(url)
        return parsed.netloc or parsed.path.split('/')[0]
    except:
        return url


def fetch_text_content(url: str) -> str:
    """
    Stage 1: Fetch text content using Jina Reader API.
    """
    try:
        jina_url = f"https://r.jina.ai/{url}"
        headers = {
            "Accept": "text/plain"
        }
        
        if JINA_API_KEY:
            # Jina Reader API 使用 Authorization Bearer token
            headers["Authorization"] = f"Bearer {JINA_API_KEY}"
        
        print(f"[Jina] Fetching content from: {jina_url}")
        print(f"[Jina] Using API key: {'Yes' if JINA_API_KEY else 'No'}")
        
        response = requests.get(jina_url, headers=headers, timeout=30)
        response.raise_for_status()
        
        content = response.text
        print(f"[Jina] Success! Content length: {len(content)} chars")
        
        # 验证响应内容
        if not content or len(content) < 100:
            print(f"[Jina] Warning: Very short content returned: {len(content)} chars")
        
        # 检查是否是 403/Forbidden 错误页面
        is_error_page = (
            '403' in content or 
            'Forbidden' in content or 
            'access denied' in content.lower() or
            'unable to give you access' in content.lower() or
            'security issue' in content.lower()
        )
        
        if is_error_page:
            print(f"[Jina] ⚠️  Warning: Content appears to be an error page (403/Forbidden)")
            print(f"[Jina] The target website may be blocking Jina Reader access")
            print(f"[Jina] Continuing with error page content - Gemini will handle it")
        
        return content
    except requests.exceptions.HTTPError as e:
        print(f"[Jina] HTTP Error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"[Jina] Response status: {e.response.status_code}")
            print(f"[Jina] Response body: {e.response.text[:500]}")
        return ""
    except Exception as e:
        print(f"[Jina] Error fetching content: {e}")
        import traceback
        traceback.print_exc()
        return ""


def generate_brand_profile_markdown(text_content: str, url: str) -> str:
    """
    Use Gemini to summarize text content into a Brand Profile (Markdown format).
    """
    if not GEMINI_API_KEY:
        error_msg = "ERROR: GEMINI_API_KEY not configured"
        print(f"[Gemini] {error_msg}")
        return f"# Brand Profile\n\nError: {error_msg}"
    
    try:
        print(f"[Gemini] Starting brand profile generation for: {url}")
        print(f"[Gemini] Input content length: {len(text_content)} chars")
        print(f"[Gemini] Using API key: Yes (length: {len(GEMINI_API_KEY)})")
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # 检查内容是否是错误页面
        is_error_page = (
            '403' in text_content or 
            'Forbidden' in text_content or 
            'access denied' in text_content.lower() or
            'unable to give you access' in text_content.lower() or
            'security issue' in text_content.lower() or
            'Warning: Target URL returned error' in text_content
        )
        
        if is_error_page:
            print(f"[Gemini] ⚠️  Warning: Input content appears to be an error page")
            print(f"[Gemini] Will attempt to extract brand information from error page and URL")
        
        prompt = f"""
Analyze the following website content and create a comprehensive Brand Profile in Markdown format.

Website URL: {url}
Content:
---
{text_content[:10000]}  # Limit to first 10k chars to avoid token limits
---

{"⚠️ IMPORTANT NOTE: The content above appears to be an error page (403 Forbidden) from the target website. The website may be blocking automated access. Please:" if is_error_page else ""}
{"1. Extract any brand information available from the error page (brand name, security policies, product mentions)" if is_error_page else ""}
{"2. Use the URL and domain name to infer brand information" if is_error_page else ""}
{"3. If the error page mentions products (like 'sneakers'), security measures, or brand values, include those in the profile" if is_error_page else ""}
{"4. Clearly indicate in the profile that this analysis is based on limited information from an error page" if is_error_page else ""}

Generate a Brand Profile that includes:
1. **Brand Overview**: Company name, industry, and core business description
2. **Brand Values**: Key values and principles
3. **Target Audience**: Primary customer segments
4. **Brand Voice**: Tone and style characteristics
5. **Key Products/Services**: Main offerings
6. **Market Position**: Competitive positioning

Format the output as clean Markdown with proper headings and structure.
"""
        
        print(f"[Gemini] Calling generate_content...")
        response = model.generate_content(prompt)
        
        if not response:
            error_msg = "ERROR: Gemini returned None response"
            print(f"[Gemini] {error_msg}")
            return f"# Brand Profile\n\nError: {error_msg}"
        
        if not hasattr(response, 'text') or not response.text:
            error_msg = "ERROR: Gemini returned empty text"
            print(f"[Gemini] {error_msg}")
            return f"# Brand Profile\n\nError: {error_msg}"
        
        result = response.text
        print(f"[Gemini] Success! Response length: {len(result)} chars")
        print(f"[Gemini] Response preview: {result[:200]}...")
        
        return result
    except Exception as e:
        error_msg = f"Error generating brand profile: {e}"
        print(f"[Gemini] {error_msg}")
        import traceback
        traceback.print_exc()
        return f"# Brand Profile\n\nError: {str(e)}"


def search_images(domain: str, search_type: str = "image") -> list:
    """
    Stage 2: Search for images/logos using Google Custom Search API.
    Returns list of image URLs.
    """
    if not cse_service:
        print("CSE service not initialized")
        return []
    
    try:
        # Search for images from the specific domain
        query = f"site:{domain}"
        
        results = cse_service.cse().list(
            q=query,
            cx=GCP_CSE_ID,
            searchType=search_type,
            num=10,  # Get up to 10 results
            safe="active"
        ).execute()
        
        images = []
        if 'items' in results:
            for item in results['items']:
                image_url = item.get('link') or item.get('image', {}).get('src')
                if image_url:
                    images.append(image_url)
        
        return images
    except Exception as e:
        print(f"Error searching images: {e}")
        return []


def upload_to_gcs(image_url: str, bucket_name: str, destination_blob_name: str) -> str:
    """
    Stage 3: Download image from URL and upload to Google Cloud Storage.
    Returns public URL of uploaded image.
    """
    if not storage_client:
        print("Storage client not initialized")
        return image_url  # Return original URL as fallback
    
    try:
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(destination_blob_name)
        
        # Download image from URL
        response = requests.get(image_url, timeout=30)
        response.raise_for_status()
        
        # Upload to GCS
        blob.upload_from_string(response.content, content_type=response.headers.get('Content-Type', 'image/jpeg'))
        
        # Make blob publicly accessible
        blob.make_public()
        
        # Return public URL
        return blob.public_url
    except Exception as e:
        print(f"Error uploading to GCS: {e}")
        return image_url  # Return original URL as fallback


def categorize_images(image_urls: list, domain: str) -> dict:
    """
    Categorize images into logos and general images.
    Simple heuristic: check if URL contains 'logo' or similar keywords.
    """
    logos = []
    images = []
    
    for url in image_urls:
        url_lower = url.lower()
        # Simple heuristic: if URL or path contains 'logo', it's likely a logo
        if 'logo' in url_lower or '/logo' in url_lower:
            logos.append(url)
        else:
            images.append(url)
    
    return {
        "logos": logos[:5],  # Limit to 5 logos
        "images": images[:10]  # Limit to 10 images
    }


@app.route('/api/analyze', methods=['POST'])
def analyze():
    """
    Main API endpoint for brand profile analysis.
    
    Input: { "url": "https://example.com" }
    Output: {
        "text_profile": "Markdown string...",
        "assets": {
            "logos": [{ "stored_url_public": "..." }],
            "images": [{ "stored_url_public": "..." }]
        }
    }
    """
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({"error": "Missing 'url' in request body"}), 400
        
        url = data['url']
        domain = extract_domain(url)
        
        # Stage 1: Fetch and summarize text content
        print(f"\n{'='*60}")
        print(f"Stage 1: Fetching content for {url}...")
        print(f"{'='*60}")
        text_content = fetch_text_content(url)
        
        if not text_content:
            print(f"[ERROR] Failed to fetch content from URL")
            return jsonify({"error": "Failed to fetch content from URL"}), 500
        
        print(f"\n{'='*60}")
        print(f"Stage 1: Generating brand profile markdown...")
        print(f"{'='*60}")
        text_profile = generate_brand_profile_markdown(text_content, url)
        
        # Stage 2: Search for images
        print(f"Stage 2: Searching for images from {domain}...")
        image_urls = search_images(domain, search_type="image")
        
        # Categorize images
        categorized = categorize_images(image_urls, domain)
        
        # Stage 3: Upload to GCS (if configured)
        logos_with_urls = []
        images_with_urls = []
        
        if storage_client and GCP_STORAGE_BUCKET_NAME:
            print(f"Stage 3: Uploading assets to GCS...")
            
            # Upload logos
            for idx, logo_url in enumerate(categorized['logos']):
                try:
                    blob_name = f"brand-assets/{domain}/logos/logo_{idx}.jpg"
                    public_url = upload_to_gcs(logo_url, GCP_STORAGE_BUCKET_NAME, blob_name)
                    logos_with_urls.append({"stored_url_public": public_url})
                except Exception as e:
                    print(f"Error uploading logo {logo_url}: {e}")
                    logos_with_urls.append({"stored_url_public": logo_url})  # Fallback to original
            
            # Upload images
            for idx, img_url in enumerate(categorized['images']):
                try:
                    blob_name = f"brand-assets/{domain}/images/img_{idx}.jpg"
                    public_url = upload_to_gcs(img_url, GCP_STORAGE_BUCKET_NAME, blob_name)
                    images_with_urls.append({"stored_url_public": public_url})
                except Exception as e:
                    print(f"Error uploading image {img_url}: {e}")
                    images_with_urls.append({"stored_url_public": img_url})  # Fallback to original
        else:
            # If GCS not configured, return original URLs
            print("Stage 3: GCS not configured, using original URLs")
            logos_with_urls = [{"stored_url_public": url} for url in categorized['logos']]
            images_with_urls = [{"stored_url_public": url} for url in categorized['images']]
        
        # Return response
        return jsonify({
            "text_profile": text_profile,
            "assets": {
                "logos": logos_with_urls,
                "images": images_with_urls
            }
        })
    
    except Exception as e:
        print(f"Error in /api/analyze: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


# Register blueprints
from routes.seo import seo_bp
from routes.seo_competitors import seo_competitors_bp
from routes.image import image_bp
from routes.video import video_bp
app.register_blueprint(seo_bp)
app.register_blueprint(seo_competitors_bp)
app.register_blueprint(image_bp)
app.register_blueprint(video_bp)


# SPA 路由处理：所有非 API 请求返回 index.html
# 这必须在所有蓝图注册之后，以确保 API 路由优先级更高
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """
    提供前端静态文件服务（SPA 路由）
    所有非 /api 开头的请求都返回 index.html，让前端路由处理
    """
    # 如果路径以 api/ 开头，说明是 API 请求但未匹配到路由，返回 404
    if path.startswith('api/'):
        return jsonify({"error": "Not found"}), 404
    
    # 如果前端构建目录不存在（开发环境），返回提示信息
    if not FRONTEND_DIST_EXISTS:
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

