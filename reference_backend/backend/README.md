# Backend API - Brand Profile Analysis

Flask backend service for secure brand profile analysis.

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment variables:**
   - Copy `.env.example` to `.env`
   - Fill in all required API keys:
     - `GEMINI_API_KEY`: Google Gemini API key
     - `JINA_API_KEY`: Jina Reader API key (optional, but recommended)
     - `GCP_PROJECT_ID`: Google Cloud Project ID
     - `GCP_STORAGE_BUCKET_NAME`: GCS bucket name for storing assets
     - `GCP_CSE_API_KEY`: Google Custom Search Engine API key
     - `GCP_CSE_ID`: Custom Search Engine ID
     - `PORT`: Server port (default: 8787)

3. **Run the server:**
   ```bash
   python app.py
   ```
   The server will start on `http://localhost:8787`

4. **Test the API (optional):**
   ```bash
   # In another terminal
   python test_api.py
   ```
   This will test both the health endpoint and the analyze endpoint.

## API Endpoints

### POST /api/analyze

Analyzes a website and generates a brand profile with assets.

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "text_profile": "# Brand Profile\n\nMarkdown content...",
  "assets": {
    "logos": [
      { "stored_url_public": "https://storage.googleapis.com/..." }
    ],
    "images": [
      { "stored_url_public": "https://storage.googleapis.com/..." }
    ]
  }
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## LaunchPage API Endpoints

The following endpoints are used by the LaunchPage component for user intent analysis and inspiration image generation.

### POST /api/seo/analyze-intent

Analyzes user input to determine their intent (SEO, Image Generation, or Other) and extracts relevant information.

**Request:**
```json
{
  "prompt": "分析网站 www.nike.com 的 SEO"
}
```

**Response:**
```json
{
  "intent": "SEO",
  "url": "www.nike.com",
  "query": "分析网站 www.nike.com 的 SEO"
}
```

**Intent Types:**
- `SEO`: User wants to analyze a website for SEO purposes
- `IMAGE_GENERATION`: User wants to generate an image
- `OTHER`: Other intent or unclear request

### POST /api/image/inspiration

Generates an inspiration image thumbnail for the LaunchPage inspiration cards.

**Request:**
```json
{
  "prompt": "A cute samoyed dog sitting in a lush green garden"
}
```

**Response:**
```json
{
  "base64Image": "base64_encoded_image_string"
}
```

**Notes:**
- The image is returned as a base64-encoded string
- Used as fallback when inspiration card images fail to load
- Optimized for thumbnail generation (fast, low cost)

## Architecture

> 📖 **完整技术架构文档**: 请查看项目根目录的 [TECHNICAL_ARCHITECTURE.md](../TECHNICAL_ARCHITECTURE.md) 获取详细的系统架构、数据流、API 接口等信息。

The `/api/analyze` endpoint performs three stages:

1. **Text Analysis**: Fetches website content via Jina Reader, then uses Gemini to generate a Markdown brand profile
2. **Asset Discovery**: Uses Google Custom Search to find logos and images from the domain
3. **Asset Storage**: Uploads discovered assets to Google Cloud Storage and returns public URLs

### 后端架构概览

- **路由模块化**: `routes/` 目录包含 SEO、图片、视频等路由蓝图
- **服务层**: `services/` 目录封装 Gemini API、视频资源管理等核心服务
- **工具层**: `utils/` 目录提供 RAG 知识库等工具函数
- **主要功能模块**:
  - SEO 内容创作工作流（多步骤流程）
  - 图片生成（Gemini Flash Image）
  - 视频生成（VEO 3.1）
  - 品牌分析

## Notes

- If GCS is not configured, the API will return original image URLs as fallback
- The service gracefully handles missing API keys and returns partial results
- All API keys are kept server-side for security

## Testing

### Backend API Tests

Run backend tests using pytest:

```bash
# Test SEO API endpoints
pytest tests/test_seo_api.py -v

# Test Image API endpoints
pytest tests/test_image_api.py -v

# Test all LaunchPage-related endpoints
pytest tests/test_seo_api.py tests/test_image_api.py::test_inspiration_image -v
```

### E2E Tests

E2E tests use Playwright to test the complete user workflow:

```bash
# Ensure both backend and frontend are running
# Backend: cd backend && python app.py
# Frontend: cd frontend && npm run dev

# Run LaunchPage E2E test
python e2e_test_launch_page.py
```

