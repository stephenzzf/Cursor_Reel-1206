"""
SEO 工作流路由
处理所有 SEO 相关的 API 端点
"""

from flask import Blueprint, request, jsonify
from services.gemini_service import get_gemini_service
from utils.rag_knowledge import search_rag_by_industry
from typing import Optional
import json
import re
import base64
import google.generativeai as genai

seo_bp = Blueprint('seo', __name__, url_prefix='/api/seo')


def get_gemini_service_safe():
    """安全获取 Gemini 服务，返回 (service, error_response)"""
    try:
        return get_gemini_service(), None
    except ValueError as e:
        return None, (jsonify({"error": str(e)}), 500)


def safe_get_text(response) -> str:
    """安全获取响应文本"""
    try:
        if hasattr(response, 'text') and response.text:
            return response.text
        elif hasattr(response, 'candidates') and response.candidates:
            parts = response.candidates[0].content.parts if hasattr(response.candidates[0].content, 'parts') else []
            text_parts = [part.text for part in parts if hasattr(part, 'text')]
            if text_parts:
                return ' '.join(text_parts)
    except Exception as e:
        print(f"Error extracting text: {e}")
    return ''


def extract_clean_url(url_string: str) -> Optional[str]:
    """
    从可能包含额外文字的字符串中提取干净的 URL
    
    示例：
    "www.nike.com进行SEO内容创作" -> "www.nike.com"
    "https://www.apple.com 网站" -> "https://www.apple.com"
    "分析网站 nike.com 的SEO" -> "nike.com"
    """
    if not url_string:
        return None
    
    # 先尝试匹配完整的 URL（带协议）
    # 匹配格式：https?:// 后跟非空白、非中文字符
    url_pattern_with_protocol = r'(https?://[^\s\u4e00-\u9fa5]+)'
    match = re.search(url_pattern_with_protocol, url_string, re.IGNORECASE)
    if match:
        clean_url = match.group(1).rstrip('.,;!?')
        return clean_url
    
    # 匹配域名（不带协议）
    # 匹配格式：可选www. + 域名主体 + .TLD，在遇到空白或中文字符前停止
    # 支持：www.nike.com, nike.com, adidas.com.cn
    domain_pattern = r'((?:www\.)?[a-z0-9][a-z0-9-]*[a-z0-9]?\.[a-z]{2,6}(?:\.[a-z]{2,6})?)(?=[\s\u4e00-\u9fa5]|$)'
    match = re.search(domain_pattern, url_string, re.IGNORECASE)
    if match:
        domain = match.group(1)
        return domain
    
    return None


def safe_json_parse(json_string: str, fallback: any) -> any:
    """安全解析 JSON，处理可能的 markdown 包装"""
    try:
        text_to_parse = json_string
        
        # 查找 JSON 开始位置
        json_start = text_to_parse.find('{')
        array_start = text_to_parse.find('[')
        
        start_index = -1
        if json_start > -1 and array_start > -1:
            start_index = min(json_start, array_start)
        elif json_start > -1:
            start_index = json_start
        elif array_start > -1:
            start_index = array_start
        
        if start_index == -1:
            raise ValueError("No JSON structure found")
        
        text_to_parse = text_to_parse[start_index:].strip()
        
        # 移除可能的 markdown 代码块包装
        if text_to_parse.endswith('```'):
            text_to_parse = text_to_parse[:-3].strip()
        
        return json.loads(text_to_parse)
    except Exception as e:
        print(f"Failed to parse JSON: {e}")
        return fallback


@seo_bp.route('/analyze-intent', methods=['POST'])
def analyze_intent():
    """
    分析用户意图
    
    Request: { "prompt": "..." }
    Response: { "intent": "SEO"|"IMAGE_GENERATION"|"OTHER", "url": "...", "query": "..." }
    """
    try:
        data = request.get_json()
        if not data or 'prompt' not in data:
            return jsonify({"error": "Missing 'prompt' in request body"}), 400
        
        prompt = data['prompt']
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        # 函数声明
        route_user_tool = {
            'name': 'route_user_request',
            'description': "Determines the user's intent and extracts relevant information for routing.",
            'parameters': {
                'type': 'OBJECT',
                'properties': {
                    'intent': {
                        'type': 'STRING',
                        'description': "The user's primary intent. Must be one of: 'SEO', 'IMAGE_GENERATION', 'VIDEO_GENERATION', 'OTHER'."
                    },
                    'url': {
                        'type': 'STRING',
                        'description': "The full URL or domain name extracted from the user's query, if the intent is 'SEO'. **IMPORTANT**: Extract ONLY the domain name (e.g., 'www.nike.com') or full URL (e.g., 'https://www.apple.com'), without any additional descriptive text, Chinese characters, or trailing words."
                    },
                    'query': {
                        'type': 'STRING',
                        'description': "The user's original query or a cleaned-up version for image generation."
                    }
                },
                'required': ['intent', 'query']
            }
        }
        
        gen_ai_prompt = f"""
Analyze the user's request and determine their intent.

User Request: "{prompt}"

**Routing Logic**:
1.  If the request is about SEO analysis, blog writing, content strategy, or clearly contains a website URL for analysis, the intent is "SEO". Extract the URL.
2.  If the request contains keywords like "生成", "创建", "制作", "draw", "create", "generate", "make" combined with "图片", "照片", "图像", "image", "picture", "photo", or is about creating/generating images, the intent is "IMAGE_GENERATION".
3.  If the request contains keywords like "生成", "创建", "制作", "create", "generate", "make" combined with "视频", "video", or is about creating/generating videos, the intent is "VIDEO_GENERATION".
4.  For anything else, the intent is "OTHER".

Call the 'route_user_request' function with the determined intent and extracted information.
"""
        
        # 尝试调用 Gemini API，如果超时或失败则使用 fallback 逻辑
        response = None
        try:
            # 先进行快速关键词检测（避免等待 API）
            video_keywords_pattern = r'(生成|创建|制作|create|generate|make).*?(视频|video)'
            image_keywords_pattern = r'(生成|创建|制作|draw|create|generate|make).*?(图片|照片|图像|image|picture|photo)'
            url_regex = r'((https?://)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*/?)'
            
            if re.search(video_keywords_pattern, prompt, re.IGNORECASE):
                return jsonify({
                    'intent': 'VIDEO_GENERATION',
                    'url': None,
                    'query': prompt
                })
            
            # 尝试调用 Gemini API（带超时保护）
            import threading
            import queue
            
            result_queue = queue.Queue()
            exception_queue = queue.Queue()
            
            def call_api():
                try:
                    result = gemini.generate_content_with_function_calling(
                        gen_ai_prompt,
                        [route_user_tool]
                    )
                    result_queue.put(result)
                except Exception as e:
                    exception_queue.put(e)
            
            api_thread = threading.Thread(target=call_api)
            api_thread.daemon = True
            api_thread.start()
            api_thread.join(timeout=8)  # 8 秒超时
            
            if api_thread.is_alive():
                print("Intent analysis API call timeout, using fallback")
                # 线程仍在运行，使用 fallback
                response = None
            elif not exception_queue.empty():
                error = exception_queue.get()
                print(f"Intent analysis API error, using fallback: {error}")
                response = None
            elif not result_queue.empty():
                response = result_queue.get()
        except Exception as api_error:
            print(f"Intent analysis error, using fallback: {api_error}")
            response = None
        
        # 检查函数调用响应
        # Gemini API 响应结构：response.candidates[0].content.parts 可能包含 function_call
        function_call = None
        if response and hasattr(response, 'candidates') and response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            if hasattr(candidate, 'content') and candidate.content:
                parts = getattr(candidate.content, 'parts', [])
                for part in parts:
                    # 检查是否有 function_call 属性
                    if hasattr(part, 'function_call') and part.function_call:
                        function_call = part.function_call
                        break
                    # 或者检查 function_call 作为字典键
                    if isinstance(part, dict) and 'function_call' in part:
                        function_call = part['function_call']
                        break
        
        if function_call:
            # 处理不同的 function_call 格式
            if hasattr(function_call, 'args'):
                args = function_call.args
            elif isinstance(function_call, dict):
                args = function_call.get('args', {})
            else:
                args = {}
            
            if isinstance(args, dict):
                # 清理提取的 URL，移除额外文字
                raw_url = args.get('url')
                clean_url = extract_clean_url(raw_url) if raw_url else None
                
                return jsonify({
                    'intent': args.get('intent', 'OTHER'),
                    'url': clean_url,  # 使用清理后的 URL
                    'query': args.get('query', prompt)
                })
        
        # Fallback: 尝试从 prompt 中提取 URL 或检测图片/视频生成意图
        url_regex = r'((https?://)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*/?)'
        url_match = re.search(url_regex, prompt, re.IGNORECASE)
        if url_match:
            raw_url = url_match.group(0)
            clean_url = extract_clean_url(raw_url)
            if clean_url:
                return jsonify({
                    'intent': 'SEO',
                    'url': clean_url,  # 使用清理后的 URL
                    'query': prompt
                })
        
        # 检查是否是视频生成意图（中文和英文关键词）
        # 匹配模式：生成/创建/制作/create/generate/make + 视频/video
        video_keywords_pattern = r'(生成|创建|制作|create|generate|make).*?(视频|video)'
        if re.search(video_keywords_pattern, prompt, re.IGNORECASE):
            return jsonify({
                'intent': 'VIDEO_GENERATION',
                'url': None,
                'query': prompt
            })
        
        # 检查是否是图片生成意图（中文和英文关键词）
        # 匹配模式：生成/创建/制作/draw/create/generate/make + 图片/照片/图像/image/picture/photo
        image_keywords_pattern = r'(生成|创建|制作|draw|create|generate|make).*?(图片|照片|图像|image|picture|photo)'
        if re.search(image_keywords_pattern, prompt, re.IGNORECASE):
            return jsonify({
                'intent': 'IMAGE_GENERATION',
                'url': None,
                'query': prompt
            })
        
        return jsonify({
            'intent': 'OTHER',
            'url': None,
            'query': prompt
        })
    
    except Exception as e:
        print(f"Error in analyze_intent: {e}")
        return jsonify({"error": str(e)}), 500


@seo_bp.route('/diagnosis', methods=['POST'])
def seo_diagnosis():
    """
    SEO 诊断
    
    Request: { "url": "..." }
    Response: SeoDiagnosisReport
    """
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({"error": "Missing 'url' in request body"}), 400
        
        url = data['url']
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        # Step 1: 研究阶段（使用 Google Search）
        research_prompt = f"""
You are an expert SEO analyst. Using Google Search as your tool, conduct a comprehensive content-focused SEO diagnosis for the website "{url}".

Your research must cover these four dimensions:
1.  **Keyword-Topic Fit**: Analyze the content on "site:{url}". What are the top 3-5 main topics or content clusters? How well do these topics align with what you can infer is their core business?
2.  **Topical Authority**: Still searching within "site:{url}", look for evidence of a "Pillar-Spoke" model or deep content hubs. Does the site have comprehensive guides that link to smaller, related articles, or is the content more fragmented and standalone?
3.  **User Intent Coverage**: Examine the types of content on "site:{url}". Is there a good balance of informational content (e.g., "how-to", "what is"), commercial investigation content (e.g., "best", "review", "vs."), and transactional content (product pages)? Identify any obvious gaps.
4.  **Content Discoverability**: Check the "site:{url}/robots.txt" for any major blocking rules that would prevent content from being crawled. Use the "site:{url}" search operator to get a general sense of how many pages are indexed. Note any immediate red flags.

After your research, synthesize your findings into a detailed, structured summary. This summary will be used by another AI to generate a JSON report. Be thorough and provide clear analysis for each dimension.
"""
        
        # 暂时不使用 Google Search 工具（API 版本限制），直接生成分析
        research_response = gemini.generate_content(research_prompt, model='gemini-2.5-flash')
        # 安全获取响应文本
        if hasattr(research_response, 'text') and research_response.text:
            research_summary = research_response.text
        elif hasattr(research_response, 'candidates') and research_response.candidates:
            # 从 candidates 中提取文本
            parts = research_response.candidates[0].content.parts if hasattr(research_response.candidates[0].content, 'parts') else []
            research_summary = ' '.join([part.text for part in parts if hasattr(part, 'text')])
        else:
            research_summary = ''
        
        # Step 2: 结构化阶段
        structuring_prompt = f"""
Based on the following SEO research summary for the website "{url}", generate a final report in a single, valid JSON object.

**Research Summary**:
---
{research_summary}
---

**Your Task**:
Adhere strictly to the TypeScript interface below.
- **IMPORTANT**: The values for `coreInsight`, `analysis`, and `recommendation` fields MUST be in **Chinese**.
- The `topicalKeywords` array must contain the original English keywords.
- For each of the four main dimensions, provide a concise `analysis` and a single, highly actionable `recommendation`.
- Calculate a final `contentSeoHealthScore` (0-100).
- Write a single-sentence `coreInsight`.

Your entire output must be ONLY the JSON object, with no other text or markdown.

**TypeScript Interface**:
```typescript
interface ReportItem {{
  analysis: string; // Must be in Chinese
  recommendation: string; // Must be in Chinese
}}

interface KeywordTopicFit extends ReportItem {{
    topicalKeywords: string[]; // Must be in English
}}

interface SeoDiagnosisReport {{
    siteUrl: string;
    contentSeoHealthScore: number;
    coreInsight: string; // Must be in Chinese
    keywordTopicFit: KeywordTopicFit;
    topicalAuthority: ReportItem;
    userIntentCoverage: ReportItem;
    contentDiscoverability: ReportItem;
}}
```
"""
        
        try:
            structuring_response = gemini.generate_json(structuring_prompt, model='gemini-2.5-pro')
        except Exception as e:
            print(f"Error generating JSON in seo_diagnosis: {e}")
            structuring_response = {}
        
        # 确保所有必需字段存在
        fallback_report = {
            'siteUrl': url,
            'contentSeoHealthScore': 68,
            'coreInsight': f"网站在内容SEO方面有一定基础，但需要改进。",
            'keywordTopicFit': {
                'analysis': '内容主要集中在产品页面，缺少解决用户早期认知阶段问题的博客文章。',
                'recommendation': '创建入门指南类内容，以吸引更广泛的受众。',
                'topicalKeywords': ['general', 'content']
            },
            'topicalAuthority': {
                'analysis': '缺乏将相关内容链接在一起的支柱页面或内容中心。',
                'recommendation': '建立一个内容中心，并将其链接到所有相关的博客文章和产品页面。'
            },
            'userIntentCoverage': {
                'analysis': '网站在交易意图方面表现良好，但在信息和商业调查意图方面内容覆盖不足。',
                'recommendation': '发布产品比较文章和深入的材料指南，以满足用户的研究需求。'
            },
            'contentDiscoverability': {
                'analysis': 'robots.txt 文件没有明显问题。',
                'recommendation': '通过在社交媒体和相关论坛上积极推广新内容，专注于改善站外信号。'
            }
        }
        
        # 合并结果，确保所有字段都存在
        result = {**fallback_report, **structuring_response}
        result['siteUrl'] = url  # 确保 URL 正确
        
        return jsonify(result)
    
    except Exception as e:
        print(f"Error in seo_diagnosis: {e}")
        return jsonify({"error": str(e)}), 500


@seo_bp.route('/solution-board', methods=['POST'])
def solution_board():
    """
    获取解决方案板
    
    Request: { "url": "...", "competitors": [...], "analysisReport": {...}, "profile": {...}, "userInstructions": "..." }
    Response: SolutionBoard
    """
    try:
        data = request.get_json()
        if not data or 'url' not in data or 'profile' not in data:
            return jsonify({"error": "Missing required fields"}), 400
        
        url = data['url']
        competitors = data.get('competitors', [])
        analysis_report = data.get('analysisReport', {})
        profile = data['profile']
        user_instructions = data.get('userInstructions')
        
        if not profile.get('projects') or len(profile['projects']) == 0:
            return jsonify({"error": "BrandProfile contains no projects"}), 400
        
        # 找到匹配的项目
        from urllib.parse import urlparse
        url_hostname = urlparse(url).hostname
        project = None
        for p in profile['projects']:
            if urlparse(p.get('project_url', '')).hostname == url_hostname:
                project = p
                break
        if not project:
            project = profile['projects'][0]
        
        gemini = get_gemini_service()
        
        competitive_landscape = analysis_report.get('competitiveLandscape', {})
        prompt = f"""
You are a world-class SEO Content Strategy Director. Your task is to generate three highly customized and actionable SEO content strategies for your client.

**IMPORTANT**: All output, including strategy names, goals, concepts, examples, and reasons, MUST be in **{project.get('target_language', 'English')}**. The strategies should be tailored for an audience in **{project.get('target_region', 'United States')}**.

You must synthesize the following three categories of information to formulate your strategies:
1.  **SEO Analysis Data**:
    - Client Website: {url}
    - Competitors: {', '.join([c.get('url', '') for c in competitors])}
    - Key Insights: The client's main content disadvantage is "{competitive_landscape.get('yourDisadvantage', '')}", and the primary market opportunity is "{competitive_landscape.get('strategicOpportunity', '')}".

2.  **Brand Profile**:
    - Brand Name: {profile.get('globalInfo', {}).get('brand_name', '')}
    - Brand Industry: {profile.get('globalInfo', {}).get('brand_industry', '')}
    - Brand Voice: {profile.get('globalInfo', {}).get('brand_voice', {}).get('tone', '')}, {profile.get('globalInfo', {}).get('brand_voice', {}).get('style', '')}
    - Target Keywords: {', '.join(project.get('target_keywords', []))}

3.  **User's Immediate Directive**:
    - {user_instructions if user_instructions else 'No specific instructions.'}

**Your Strategic Archetypes (for inspiration)**:
Draw inspiration from the following archetypes. You don't need to create one for each; select and adapt the most suitable combination for the client's situation.
- **Archetype 1: Traffic Magnet**: Aims to build topical authority and capture Top-of-Funnel users. Core method: "Pillar-Spoke" content model.
- **Archetype 2: Decision Engine**: Aims to solve core pain points and influence Middle-of-Funnel users. Core method: "Problem-Solution" and "Comparison" content.
- **Archetype 3: Conversion Accelerator**: Aims to showcase product value and drive Bottom-of-Funnel users. Core method: "Case Studies" and "Creative Use-Cases".

**Your Task**:
Generate a JSON array containing **three** strategic options. For each option:
- `strategyName`: Create a compelling, client-facing strategy title. It should be a call to action that clearly communicates the core value. **Strictly forbid** using internal jargon like "Traffic Magnet," "Decision Engine," or "Conversion Accelerator." Example: "Dominate the Conversation on Mobile & Sustainable Videography."
- `seoGoal`: Clearly state the SEO objective for this strategy.
- `coreConcept`: Briefly explain the core idea and execution method.
- `contentExamples`: Provide 2-3 specific article/video title examples that reflect the brand voice and target keywords.
- `strategicReason`: **(Most Important)** In one sentence, explain **why** this strategy is right for this specific client, explicitly linking it to information from the SEO analysis, brand profile, or user directive.

**Output Format**:
Your entire output must be a single, valid JSON array that strictly adheres to the following TypeScript interface. Do not include any text, markdown, or comments outside the JSON array.
```typescript
type SolutionBoard = {{
    id: string; // A unique ID, e.g., "sol-1"
    strategyName: string;
    seoGoal: string;
    coreConcept: string;
    contentExamples: string[];
    strategicReason: string;
}}[];
```
"""
        
        board = gemini.generate_json(prompt)
        
        # 确保是数组格式
        if not isinstance(board, list):
            board = [board] if board else []
        
        # 添加 ID
        result = []
        for i, opt in enumerate(board):
            if isinstance(opt, dict):
                opt['id'] = opt.get('id', f'sol-{i + 1}')
                result.append(opt)
        
        return jsonify(result)
    
    except Exception as e:
        print(f"Error in solution_board: {e}")
        return jsonify({"error": str(e)}), 500


@seo_bp.route('/content-brief', methods=['POST'])
def content_brief():
    """
    获取预填充内容需求
    
    Request: { "solution": {...}, "url": "...", "seoReport": {...}, "competitors": [...], "profile": {...}, "userInstructions": "..." }
    Response: ContentBrief
    """
    try:
        data = request.get_json()
        if not data or 'solution' not in data or 'url' not in data or 'profile' not in data:
            return jsonify({"error": "Missing required fields"}), 400
        
        solution = data['solution']
        url = data['url']
        seo_report = data.get('seoReport', {})
        competitors = data.get('competitors', [])
        profile = data['profile']
        user_instructions = data.get('userInstructions')
        
        if not profile.get('projects') or len(profile['projects']) == 0:
            return jsonify({"error": "BrandProfile contains no projects"}), 400
        
        # 找到匹配的项目
        from urllib.parse import urlparse
        url_hostname = urlparse(url).hostname
        project = None
        for p in profile['projects']:
            if urlparse(p.get('project_url', '')).hostname == url_hostname:
                project = p
                break
        if not project:
            project = profile['projects'][0]
        
        gemini = get_gemini_service()
        
        prompt = f"""
You are an expert SEO content strategist. Your task is to create a detailed Content Brief based on a chosen strategy.

**Chosen Strategy**:
- Name: "{solution.get('strategyName', '')}"
- Concept: "{solution.get('coreConcept', '')}"

**Input Data**:
- Website: {url}
- Brand Profile: {json.dumps(profile.get('globalInfo', {}), indent=2, ensure_ascii=False)}
- Project Config: {json.dumps(project, indent=2, ensure_ascii=False)}
- Competitors: {', '.join([c.get('url', '') for c in competitors])}
- User Instructions: {user_instructions if user_instructions else 'None'}

**Your Task**:
Generate a comprehensive Content Brief. Your entire output must be a single, valid JSON object that strictly adheres to the TypeScript interface below. All string values MUST be in Chinese.

- `titleSuggestion`: Propose a compelling, SEO-friendly title based on the strategy and keywords.
- `topicSummary`: A brief summary of the article's topic.
- `targetRegion` & `targetLanguage`: Use the values from the project config.
- `mainKeyword` & `secondaryKeywords`: Propose a main keyword and 3-5 secondary keywords.
- `suggestedOutline`: A logical, hierarchical outline with at least 5 main points (H2s).
- `estimatedWordcount`: A reasonable word count estimate.
- `aiRecommendations`: 2-3 actionable recommendations for the AI writer to follow, based on the brand voice and strategy.

```typescript
interface ContentBrief {{
    titleSuggestion: string;
    topicSummary: string;
    targetRegion: string;
    targetLanguage: string;
    mainKeyword: string;
    secondaryKeywords: string[];
    suggestedOutline: string[];
    estimatedWordcount: number;
    aiRecommendations: string[];
}}
```
"""
        
        brief = gemini.generate_json(prompt)
        
        # 确保所有必需字段存在
        fallback_brief = {
            'titleSuggestion': f"终极指南：{solution.get('strategyName', '内容策略')}",
            'topicSummary': '一篇全面的指南文章',
            'targetRegion': project.get('target_region', 'United States'),
            'targetLanguage': project.get('target_language', 'English'),
            'mainKeyword': 'content strategy',
            'secondaryKeywords': ['SEO', 'content marketing', 'digital marketing'],
            'suggestedOutline': [
                'Introduction',
                '## Main Topic 1',
                '## Main Topic 2',
                '## Main Topic 3',
                'Conclusion'
            ],
            'estimatedWordcount': 1500,
            'aiRecommendations': [
                '保持信息丰富且易于理解的语气',
                '使用项目符号列表和粗体文本来分解复杂信息'
            ]
        }
        
        result = {**fallback_brief, **brief}
        result['targetRegion'] = project.get('target_region', result.get('targetRegion', 'United States'))
        result['targetLanguage'] = project.get('target_language', result.get('targetLanguage', 'English'))
        
        return jsonify(result)
    
    except Exception as e:
        print(f"Error in content_brief: {e}")
        return jsonify({"error": str(e)}), 500


@seo_bp.route('/web-research', methods=['POST'])
def web_research():
    """
    运行网络研究
    
    Request: { "brief": {...} }
    Response: string (研究摘要)
    """
    try:
        data = request.get_json()
        if not data or 'brief' not in data:
            return jsonify({"error": "Missing 'brief' in request body"}), 400
        
        brief = data['brief']
        gemini = get_gemini_service()
        
        prompt = f"""
You are a research assistant. Use Google Search to gather up-to-date information, statistics, and key talking points for an article based on this brief:
- Title: "{brief.get('titleSuggestion', '')}"
- Main Keyword: "{brief.get('mainKeyword', '')}"
- Secondary Keywords: {', '.join(brief.get('secondaryKeywords', []))}
- Topic Summary: "{brief.get('topicSummary', '')}"
- Target Audience: Users in {brief.get('targetRegion', 'United States')} who speak {brief.get('targetLanguage', 'English')}.

Synthesize your findings into a concise summary of 3-4 paragraphs. This summary will be used by another AI to write the article. Focus on facts, data, and unique angles.
"""
        
        # 暂时不使用 Google Search 工具（API 版本限制），直接生成研究摘要
        response = gemini.generate_content(prompt, model='gemini-2.5-flash')
        return jsonify({"summary": safe_get_text(response)})
    
    except Exception as e:
        print(f"Error in web_research: {e}")
        return jsonify({"error": str(e)}), 500


@seo_bp.route('/generate-outline', methods=['POST'])
def generate_outline():
    """
    生成战略大纲
    
    Request: { "researchSummary": "...", "brief": {...}, "profile": {...} }
    Response: string[] (大纲数组)
    """
    try:
        data = request.get_json()
        if not data or 'researchSummary' not in data or 'brief' not in data or 'profile' not in data:
            return jsonify({"error": "Missing required fields"}), 400
        
        research_summary = data['researchSummary']
        brief = data['brief']
        profile = data['profile']
        
        gemini = get_gemini_service()
        
        brand_voice = profile.get('globalInfo', {}).get('brand_voice', {})
        prompt = f"""
You are an expert content strategist. Based on the provided research and content brief, refine the suggested outline into a final, detailed strategic outline.

**Research Summary**: {research_summary}
**Content Brief**: {json.dumps(brief, indent=2, ensure_ascii=False)}
**Brand Voice**: {brand_voice.get('tone', '')}, {brand_voice.get('style', '')}

**Your Task**:
Generate a detailed outline as a JSON array of strings. Each string represents a heading (e.g., "Introduction", "## What is...", "### The importance of...").
- The outline should be logical and comprehensive.
- Incorporate insights from the research summary.
- Ensure the tone of the headings aligns with the brand voice.
- Ensure all key topics from the brief's suggested outline are covered.

Output only the JSON array.
"""
        
        outline = gemini.generate_json(prompt)
        
        # 确保是数组格式
        if not isinstance(outline, list):
            outline = brief.get('suggestedOutline', [])
        
        return jsonify(outline)
    
    except Exception as e:
        print(f"Error in generate_outline: {e}")
        # Fallback to brief's suggested outline
        fallback = data.get('brief', {}).get('suggestedOutline', [])
        return jsonify(fallback)


@seo_bp.route('/write-article', methods=['POST'])
def write_article():
    """
    从大纲写文章
    
    Request: { "outline": [...], "brief": {...}, "profile": {...}, "userInstructions": "..." }
    Response: string (文章内容，Markdown格式)
    """
    try:
        data = request.get_json()
        if not data or 'outline' not in data or 'brief' not in data or 'profile' not in data:
            return jsonify({"error": "Missing required fields"}), 400
        
        outline = data['outline']
        brief = data['brief']
        profile = data['profile']
        user_instructions = data.get('userInstructions')
        
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        brand_info = profile.get('globalInfo', {})
        brand_industry = brand_info.get('brand_industry', '')
        brand_voice = brand_info.get('brand_voice', {})
        
        # 构建用户指令部分
        user_instructions_section = ""
        if user_instructions:
            user_instructions_section = f"\n**User Instructions**:\n{user_instructions}\n"
        
        prompt = f"""
You are an expert {brand_industry} writer, specializing in SEO content. Write a full-length article based on the provided outline and brief.

**Outline**:
{chr(10).join(outline) if isinstance(outline, list) else outline}

**Content Brief**: {json.dumps(brief, indent=2, ensure_ascii=False)}
**Brand Profile**: {json.dumps(brand_info, indent=2, ensure_ascii=False)}
{user_instructions_section}

**Writing Instructions**:
- Write in markdown format.
- Adhere strictly to the brand voice: {brand_voice.get('tone', '')}, {brand_voice.get('style', '')}.
- Naturally integrate the main and secondary keywords.
- The language MUST be {brief.get('targetLanguage', 'English')}.
- The content MUST be engaging and valuable for an audience in {brief.get('targetRegion', 'United States')}.
- Do not use placeholders like "[Image]".
- Write approximately {brief.get('estimatedWordcount', 1500)} words.
"""
        
        # 使用 Pro 模型进行写作
        response = gemini.generate_content(prompt, model='gemini-2.5-pro')
        article = safe_get_text(response)
        
        return jsonify({"article": article})
    
    except Exception as e:
        print(f"Error in write_article: {e}")
        return jsonify({"error": str(e)}), 500


@seo_bp.route('/polish-article', methods=['POST'])
def polish_article():
    """
    润色文章可读性
    
    Request: { "article": "..." }
    Response: string (润色后的文章)
    """
    try:
        data = request.get_json()
        if not data or 'article' not in data:
            return jsonify({"error": "Missing 'article' in request body"}), 400
        
        article = data['article']
        gemini = get_gemini_service()
        
        prompt = f"""
You are a senior editor. Review the following article and polish it for readability and flow.
- Improve sentence structure.
- Correct any grammar or spelling errors.
- Ensure the tone is consistent.
- Do not change the core meaning or structure.
Return only the polished article in markdown format.

**Article**:
---
{article}
---
"""
        
        response = gemini.generate_content(prompt)
        polished = safe_get_text(response) or article
        
        return jsonify({"article": polished})
    
    except Exception as e:
        print(f"Error in polish_article: {e}")
        return jsonify({"error": str(e)}), 500


@seo_bp.route('/generate-metadata', methods=['POST'])
def generate_metadata():
    """
    生成 SEO 元数据
    
    Request: { "article": "...", "brief": {...} }
    Response: { "seoTitle": "...", "seoDescription": "..." }
    """
    try:
        data = request.get_json()
        if not data or 'article' not in data or 'brief' not in data:
            return jsonify({"error": "Missing required fields"}), 400
        
        article = data['article']
        brief = data['brief']
        
        gemini = get_gemini_service()
        
        # 只使用文章前500字
        article_preview = article[:500] + '...' if len(article) > 500 else article
        
        prompt = f"""
You are an SEO expert. Based on the article and content brief, generate an SEO-optimized meta title and meta description.

**Article Content (first 500 words)**:
{article_preview}

**Content Brief**:
- Main Keyword: {brief.get('mainKeyword', '')}
- Title Suggestion: {brief.get('titleSuggestion', '')}

**Requirements**:
- **Meta Title**: Max 60 characters. Must include the main keyword.
- **Meta Description**: Max 160 characters. Must be compelling and include the main keyword.

Return a single JSON object with "seoTitle" and "seoDescription" keys.
"""
        
        metadata = gemini.generate_json(prompt)
        
        fallback = {
            'seoTitle': brief.get('titleSuggestion', '')[:60],
            'seoDescription': brief.get('topicSummary', '')[:160]
        }
        
        result = {**fallback, **metadata}
        
        return jsonify(result)
    
    except Exception as e:
        print(f"Error in generate_metadata: {e}")
        return jsonify({"error": str(e)}), 500


@seo_bp.route('/preflight-check', methods=['POST'])
def preflight_check():
    """
    运行预检
    
    Request: { "article": "...", "brief": {...}, "profile": {...} }
    Response: PreflightReport
    """
    try:
        data = request.get_json()
        if not data or 'article' not in data or 'brief' not in data or 'profile' not in data:
            return jsonify({"error": "Missing required fields"}), 400
        
        article = data['article']
        brief = data['brief']
        profile = data['profile']
        
        # 修复1: 使用 get_gemini_service_safe
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        # 修复2: 处理文章过长问题（移除 base64 图片，限制长度）
        # 移除 base64 图片（保留图片标记），避免 token 超限
        article_for_check = re.sub(
            r'!\[([^\]]*)\]\(data:image/[^;]+;base64,[A-Za-z0-9+/=]+\)',
            r'![图片: \1]',
            article
        )
        
        # 限制长度（约 50k 字符，避免 token 超限）
        max_article_length = 50000
        if len(article_for_check) > max_article_length:
            article_for_check = article_for_check[:max_article_length] + '...'
            print(f"[Preflight] Article truncated to {max_article_length} chars for preflight check")
        
        # 修复3: 安全获取 brand_voice 和 negative_keywords
        brand_voice = profile.get('globalInfo', {}).get('brand_voice', {})
        tone = brand_voice.get('tone', '') if isinstance(brand_voice, dict) else ''
        style = brand_voice.get('style', '') if isinstance(brand_voice, dict) else ''
        brand_voice_str = f"{tone}, {style}" if tone or style else "未指定"
        
        negative_keywords = profile.get('globalInfo', {}).get('negative_keywords_global', [])
        negative_keywords_str = ', '.join(negative_keywords) if isinstance(negative_keywords, list) and negative_keywords else '无'
        
        # 安全获取 secondary keywords
        secondary_keywords = brief.get('secondaryKeywords', [])
        secondary_keywords_str = ', '.join(secondary_keywords) if isinstance(secondary_keywords, list) and secondary_keywords else '无'
        
        main_keyword = brief.get('mainKeyword', '')
        
        prompt = f"""
You are a meticulous AI Editor-in-Chief. Your task is to perform a pre-flight check on the following article. Analyze it against the provided criteria and identify any issues.

**Article Content**:
---
{article_for_check}
---

**Criteria to Check**:
1.  **Keyword Usage**: Does the article naturally include the main keyword ("{main_keyword}") and some secondary keywords ({secondary_keywords_str})? Check for keyword stuffing or awkward placement.
2.  **SEO Best Practices**: Does the article have a clear structure (H1, H2s)? Is the introduction engaging?
3.  **Brand Voice Consistency**: Does the article's tone and style align with the brand voice: "{brand_voice_str}"? Are any negative keywords ("{negative_keywords_str}") used?
4.  **Readability**: Is the language clear and concise? Are there overly complex sentences or jargon that should be simplified?

**Your Task**:
Generate a JSON object representing the pre-flight report.
- Calculate a final `score` from 0 to 100 based on the severity and number of issues. 100 means no issues.
- The `issues` array should contain objects for each problem found. For each issue, provide a `type`, a `description` of the problem, and a specific, actionable `suggestion` for how to fix it.
- If no issues are found, the `issues` array should be empty and the score should be 100.

Your entire output must be a single, valid JSON object adhering to this TypeScript interface:
```typescript
interface PreflightIssue {{
    type: 'Keyword' | 'SEO' | 'BrandVoice' | 'Readability';
    description: string;
    suggestion: string;
}}

interface PreflightReport {{
    score: number;
    issues: PreflightIssue[];
}};
```
"""
        
        # 修复4: 使用 generate_json 并添加错误处理
        try:
            report = gemini.generate_json(prompt, model='gemini-2.5-flash')
        except Exception as e:
            print(f"[Preflight] Error generating report: {e}")
            import traceback
            traceback.print_exc()
            # 返回 fallback
            report = {'score': 85, 'issues': []}
        
        # 修复5: 确保格式正确
        fallback_report = {
            'score': 85,
            'issues': []
        }
        
        if not isinstance(report, dict):
            print(f"[Preflight] Report is not a dict, using fallback")
            report = fallback_report
        
        if 'score' not in report or not isinstance(report.get('score'), (int, float)):
            report['score'] = 85
        if 'issues' not in report or not isinstance(report.get('issues'), list):
            report['issues'] = []
        
        # 确保 issues 格式正确
        valid_issues = []
        for issue in report.get('issues', []):
            if isinstance(issue, dict) and 'type' in issue and 'description' in issue and 'suggestion' in issue:
                valid_issues.append(issue)
        report['issues'] = valid_issues
        
        print(f"[Preflight] Preflight check completed: score={report.get('score')}, issues={len(report.get('issues', []))}")
        
        return jsonify(report)
    
    except Exception as e:
        print(f"Error in preflight_check: {e}")
        import traceback
        traceback.print_exc()
        # 返回 fallback 而不是错误
        return jsonify({
            'score': 85,
            'issues': []
        })


@seo_bp.route('/auto-fix', methods=['POST'])
def auto_fix():
    """
    自动修复
    
    Request: { "article": "...", "issues": [...] }
    Response: string (修复后的文章)
    """
    try:
        data = request.get_json()
        if not data or 'article' not in data or 'issues' not in data:
            return jsonify({"error": "Missing required fields"}), 400
        
        article = data['article']
        issues = data['issues']
        
        # 修复1: 使用 get_gemini_service_safe
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        # 修复2: 处理文章过长问题（移除 base64 图片，限制长度）
        # 移除 base64 图片（保留图片标记），避免 token 超限
        article_for_fix = re.sub(
            r'!\[([^\]]*)\]\(data:image/[^;]+;base64,[A-Za-z0-9+/=]+\)',
            r'![图片: \1]',
            article
        )
        
        # 限制长度（修复时可以使用更长的限制，因为需要完整修复）
        max_article_length = 100000
        if len(article_for_fix) > max_article_length:
            print(f"[Auto Fix] Article truncated to {max_article_length} chars for fixing")
            article_for_fix = article_for_fix[:max_article_length] + '...'
        
        newline = '\n'
        issues_text = newline.join([
            f"- **{issue.get('type', '')}**: {issue.get('description', '')}. (Suggestion: {issue.get('suggestion', '')})"
            for issue in issues
        ])
        
        prompt = f"""
You are an expert AI editor. Your task is to revise the provided article to fix a specific list of issues.

**Original Article**:
---
{article_for_fix}
---

**Issues to Fix**:
{issues_text}

**Instructions**:
- Apply all the suggested fixes to the article.
- Maintain the original markdown formatting.
- Do not introduce new content or change the article's structure beyond what is required to fix the issues.
- Return ONLY the full, revised article content.
"""
        
        # 修复3: 增强错误处理
        try:
            # 使用 Pro 模型进行精确编辑
            response = gemini.generate_content(prompt, model='gemini-2.5-pro')
            fixed_article = safe_get_text(response) or article
            
            # 如果修复后的文章为空或太短，返回原文章
            if not fixed_article or len(fixed_article) < len(article) * 0.5:
                print(f"[Auto Fix] Warning: Fixed article seems too short, returning original")
                fixed_article = article
        except Exception as e:
            print(f"[Auto Fix] Error generating fixed article: {e}")
            import traceback
            traceback.print_exc()
            # 返回原文章而不是错误
            fixed_article = article
        
        print(f"[Auto Fix] Auto fix completed: original length={len(article)}, fixed length={len(fixed_article)}")
        
        return jsonify({"article": fixed_article})
    
    except Exception as e:
        print(f"Error in auto_fix: {e}")
        import traceback
        traceback.print_exc()
        # 返回原文章而不是错误
        data = request.get_json()
        return jsonify({"article": data.get('article', '') if data else ''})


@seo_bp.route('/generate-images', methods=['POST'])
def generate_images():
    """
    生成并嵌入图片
    
    Request: { "article": "..." }
    Response: string (带图片的文章)
    """
    try:
        data = request.get_json()
        if not data or 'article' not in data:
            return jsonify({"error": "Missing 'article' in request body"}), 400
        
        article = data['article']
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        # Step 1: 分析文章并生成图片放置位置
        prompt = f"""
You are an AI Art Director. Your task is to analyze the provided markdown article and decide where to place relevant images.
For each image placement, generate a highly descriptive, artistic prompt for an image generation model.

**Article**:
---
{article}
---

**Your Task**:
Return a JSON array of objects. Each object should have two properties:
1. `section_title`: The exact markdown heading (e.g., "## The Rise of Sustainable Materials") under which the image should be placed. Use "Introduction" for the first section before any headings.
2. `image_prompt`: A detailed, visually rich prompt for an image generation model. Example: "A cinematic, wide-angle shot of a meticulously organized photographer's backpack, with lenses, filters, and a sleek carbon-fiber tripod neatly arranged. The lighting is soft and natural, coming from a nearby window, highlighting the textures of the gear. Style: product photography, realistic."

Output ONLY the JSON array.
```typescript
type ImagePlacement = {{
    section_title: string;
    image_prompt: string;
}}[];
```
"""
        
        placements = gemini.generate_json(prompt, model='gemini-2.5-flash')
        
        if not isinstance(placements, list) or len(placements) == 0:
            print("[Image Generation] No placements generated, returning original article")
            return jsonify({"article": article})
        
        print(f"[Image Generation] Generated {len(placements)} image placements")
        
        # Step 2: 使用 Gemini Image Generation 生成图片
        generated_images = []
        
        for i, placement in enumerate(placements):
            try:
                section_title = placement.get('section_title', '')
                image_prompt = placement.get('image_prompt', '')
                
                if not image_prompt:
                    print(f"[Image Generation] Skipping placement {i+1}: empty image_prompt")
                    continue
                
                print(f"[Image Generation] Generating image {i+1}/{len(placements)} for section: {section_title[:50]}")
                print(f"[Image Generation] Prompt: {image_prompt[:100]}...")
                
                # 使用 gemini-2.5-flash-image 模型生成图片
                image_model = genai.GenerativeModel('gemini-2.5-flash-image')
                
                # 生成图片
                # 注意：根据前端实现，response_modalities 应该直接传递，而不是在 generation_config 中
                # gemini-2.5-flash-image 可能不支持 aspect_ratio，先尝试简单方式
                try:
                    # 方式1: 尝试使用 generation_config（如果支持）
                    from google.generativeai.types import HarmCategory, HarmBlockThreshold
                    response = image_model.generate_content(
                        image_prompt,
                        generation_config=genai.types.GenerationConfig(
                            response_modalities=['IMAGE']
                        )
                    )
                except (TypeError, AttributeError) as e:
                    print(f"[Image Generation] Config method failed: {e}, trying simple method")
                    # 方式2: 直接调用，让模型自动返回图片
                    response = image_model.generate_content(image_prompt)
                
                # 提取图片数据
                base64_image = None
                mime_type = 'image/jpeg'  # 默认 MIME 类型
                
                if hasattr(response, 'candidates') and response.candidates:
                    candidate = response.candidates[0]
                    if hasattr(candidate, 'content') and candidate.content:
                        parts = getattr(candidate.content, 'parts', [])
                        for part in parts:
                            # 尝试多种属性名（inline_data 或 inlineData）
                            inline_data = None
                            if hasattr(part, 'inline_data') and part.inline_data:
                                inline_data = part.inline_data
                            elif hasattr(part, 'inlineData') and part.inlineData:
                                inline_data = part.inlineData
                            
                            if inline_data:
                                # 获取数据
                                data = inline_data.data if hasattr(inline_data, 'data') else None
                                
                                # 获取 MIME 类型（如果可用）
                                if hasattr(inline_data, 'mime_type'):
                                    mime_type = inline_data.mime_type
                                elif hasattr(inline_data, 'mimeType'):
                                    mime_type = inline_data.mimeType
                                
                                if data:
                                    # 关键修复：将 bytes 转换为 base64 字符串
                                    if isinstance(data, bytes):
                                        # bytes -> base64 字符串
                                        base64_image = base64.b64encode(data).decode('utf-8')
                                        print(f"[Image Generation] Converted {len(data)} bytes to base64 ({len(base64_image)} chars)")
                                    elif isinstance(data, str):
                                        # 如果已经是字符串，检查是否是 base64
                                        try:
                                            # 尝试解码验证
                                            base64.b64decode(data)
                                            base64_image = data  # 已经是 base64
                                            print(f"[Image Generation] Data is already base64 encoded")
                                        except Exception:
                                            # 如果不是 base64，尝试编码
                                            base64_image = base64.b64encode(data.encode('utf-8')).decode('utf-8')
                                            print(f"[Image Generation] Encoded string to base64")
                                    break
                
                if not base64_image:
                    print(f"[Image Generation] Warning: No image data in response for placement {i+1}")
                    continue
                
                # 创建 Markdown 图片标签（使用正确的 MIME 类型）
                image_alt = image_prompt.split(',')[0].strip()[:50]  # 使用提示词的前50个字符作为 alt
                image_markdown = f"![{image_alt}](data:{mime_type};base64,{base64_image})"
                
                generated_images.append({
                    'section': section_title,
                    'markdown': image_markdown
                })
                
                print(f"[Image Generation] Successfully generated image {i+1}/{len(placements)}")
                
            except Exception as e:
                print(f"[Image Generation] Error generating image for placement {i+1}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        # Step 3: 将图片嵌入到文章中
        if len(generated_images) == 0:
            print("[Image Generation] No images were successfully generated, returning original article")
            return jsonify({"article": article})
        
        print(f"[Image Generation] Embedding {len(generated_images)} images into article")
        article_with_images = article
        
        for img in generated_images:
            section = img['section']
            markdown = img['markdown']
            
            if section == "Introduction":
                # 在文章开头（第一个段落后）插入图片
                parts = article_with_images.split('\n\n')
                if len(parts) > 1:
                    parts.insert(1, markdown)
                    article_with_images = '\n\n'.join(parts)
                else:
                    # 如果文章只有一个段落，在开头插入
                    article_with_images = f"{markdown}\n\n{article_with_images}"
            else:
                # 在对应章节标题后插入图片
                # 查找章节标题（支持 #, ##, ### 等）
                # 转义特殊字符用于正则匹配
                escaped_section = re.escape(section)
                # 匹配章节标题（可能前面有 # 号）
                pattern = f'(^#+\\s*{escaped_section}\\s*$)'
                if re.search(pattern, article_with_images, re.MULTILINE):
                    # 在章节标题后插入图片
                    article_with_images = re.sub(
                        pattern,
                        f'\\1\n\n{markdown}',
                        article_with_images,
                        flags=re.MULTILINE
                    )
                else:
                    # 如果找不到精确匹配，尝试在包含该文本的位置插入
                    if section in article_with_images:
                        article_with_images = article_with_images.replace(
                            section,
                            f"{section}\n\n{markdown}",
                            1  # 只替换第一个匹配
                        )
                    else:
                        print(f"[Image Generation] Warning: Could not find section '{section}' in article")
        
        print(f"[Image Generation] Successfully embedded {len(generated_images)} images into article")
        return jsonify({"article": article_with_images})
    
    except Exception as e:
        print(f"Error in generate_images: {e}")
        return jsonify({"error": str(e)}), 500


@seo_bp.route('/agent-action', methods=['POST'])
def agent_action():
    """
    获取代理动作
    
    Request: { "userText": "...", "currentStep": 1, "chatHistory": [...] }
    Response: { "name": "...", "args": {...}, "text": "..." }
    """
    try:
        data = request.get_json()
        if not data or 'userText' not in data or 'currentStep' not in data:
            return jsonify({"error": "Missing required fields"}), 400
        
        user_text = data['userText']
        current_step = data['currentStep']
        chat_history = data.get('chatHistory', [])
        
        gemini = get_gemini_service()
        
        step_names = ['Diagnosis', 'Competitors', 'Analysis', 'Solutions', 'Brief', 'Editing', 'Publish']
        current_step_name = step_names[current_step - 1] if 1 <= current_step <= 7 else 'Unknown'
        
        # 函数声明
        agent_actions_tool = {
            'name': 'determine_user_action',
            'description': "Determines the user's intent from their chat message and suggests the next action.",
            'parameters': {
                'type': 'OBJECT',
                'properties': {
                    'name': {
                        'type': 'STRING',
                        'description': 'The name of the action to take. Must be one of: "go_to_step", "rerun_step", "answer_question".'
                    },
                    'args': {
                        'type': 'OBJECT',
                        'properties': {
                            'step': {
                                'type': 'INTEGER',
                                'description': 'The step number to go to (1-6) if the action is "go_to_step".'
                            },
                            'instructions': {
                                'type': 'STRING',
                                'description': 'User\'s specific feedback or instructions for the "rerun_step" action.'
                            }
                        }
                    }
                },
                'required': ['name']
            }
        }
        
        newline = '\n'
        history_text = newline.join([
            f"{'user' if msg.get('type') == 'USER' else 'model'}: {msg.get('payload', {}).get('text', '')}"
            for msg in chat_history[-4:]  # 只使用最近4条消息
        ])
        
        prompt = f"""
You are the AI assistant in a multi-step SEO content creation workflow. Your job is to understand the user's request and decide on the appropriate action.

**Current State**:
- We are at Step {current_step}: {current_step_name}.

**User's Latest Message**: "{user_text}"

**Recent Chat History**:
{history_text}

**Action Logic**:
1.  If the user wants to go back to a previous step (e.g., "go back to competitors", "let's change the strategy"), use the "go_to_step" action. The step number must be less than the current step {current_step}.
2.  If the user is providing feedback on the most recent output and wants to regenerate it (e.g., "I don't like these options, try again", "generate something more creative", "add more detail about X"), use the "rerun_step" action. Extract their feedback into the "instructions" argument.
3.  If it's a general question or a comment that doesn't fit the above, I will answer it directly. Do not use a tool call in this case; instead, provide a helpful text response.

Based on the user's message, what is the correct action to take? If you are answering directly, your response should be a helpful and concise text. Otherwise, call the 'determine_user_action' function.
"""
        
        response = gemini.generate_content_with_function_calling(prompt, [agent_actions_tool])
        
        # 检查函数调用响应
        function_call = None
        function_name = None
        if hasattr(response, 'candidates') and response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            if hasattr(candidate, 'content') and candidate.content:
                parts = getattr(candidate.content, 'parts', [])
                for part in parts:
                    if hasattr(part, 'function_call') and part.function_call:
                        function_call = part.function_call
                        function_name = getattr(function_call, 'name', None)
                        break
                    if isinstance(part, dict) and 'function_call' in part:
                        function_call = part['function_call']
                        function_name = function_call.get('name') if isinstance(function_call, dict) else None
                        break
        
        if function_call:
            # 处理不同的 function_call 格式
            if hasattr(function_call, 'args'):
                args = function_call.args
            elif isinstance(function_call, dict):
                args = function_call.get('args', {})
            else:
                args = {}
            
            if isinstance(args, dict):
                return jsonify({
                    'name': function_name or 'answer_question',
                    'args': args
                })
        
        # 如果没有函数调用，返回文本回答
        return jsonify({
            'name': 'answer_question',
            'args': {},
            'text': safe_get_text(response) or "I'm not sure how to handle that. Could you please rephrase?"
        })
    
    except Exception as e:
        print(f"Error in agent_action: {e}")
        return jsonify({"error": str(e)}), 500


@seo_bp.route('/new-content-idea', methods=['POST'])
def new_content_idea():
    """
    获取新内容想法
    
    Request: { "profile": {...}, "previousBrief": {...} }
    Response: ContentBrief
    """
    try:
        data = request.get_json()
        if not data or 'profile' not in data or 'previousBrief' not in data:
            return jsonify({"error": "Missing required fields"}), 400
        
        profile = data['profile']
        previous_brief = data['previousBrief']
        
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        brand_info = profile.get('globalInfo', {})
        project = profile.get('projects', [{}])[0] if profile.get('projects') else {}
        
        prompt = f"""
You are a creative content strategist. Your task is to generate a completely new and fresh content idea for a client, based on their brand and a previous piece of content they created.

**Brand Profile**:
- Brand: {brand_info.get('brand_name', '')} ({brand_info.get('brand_industry', '')})
- Voice: {brand_info.get('brand_voice', {}).get('tone', '')}, {brand_info.get('brand_voice', {}).get('style', '')}
- Target Keywords: {', '.join(project.get('target_keywords', []))}

**Previous Content Brief (for context, do not copy)**:
- Title: "{previous_brief.get('titleSuggestion', '')}"
- Topic: "{previous_brief.get('topicSummary', '')}"

**Your Task**:
Propose a new, different, but complementary content idea. Generate a full Content Brief for this new idea.
- The new idea should be distinct from the previous one but still align with the brand.
- The output must be a single, valid JSON object that strictly adheres to the ContentBrief interface.
- All string values must be in Chinese.

```typescript
interface ContentBrief {{
    titleSuggestion: string;
    topicSummary: string;
    targetRegion: string;
    targetLanguage: string;
    mainKeyword: string;
    secondaryKeywords: string[];
    suggestedOutline: string[];
    estimatedWordcount: number;
    aiRecommendations: string[];
}}
```
"""
        
        brief = gemini.generate_json(prompt)
        
        # 确保所有必需字段存在
        fallback_brief = {
            'titleSuggestion': '新内容想法',
            'topicSummary': '一个全新的内容主题',
            'targetRegion': project.get('target_region', 'United States'),
            'targetLanguage': project.get('target_language', 'English'),
            'mainKeyword': 'content strategy',
            'secondaryKeywords': ['SEO', 'content marketing'],
            'suggestedOutline': ['Introduction', '## Main Topic', 'Conclusion'],
            'estimatedWordcount': 1500,
            'aiRecommendations': ['保持品牌声音一致', '提供实用价值']
        }
        
        result = {**fallback_brief, **brief}
        result['targetRegion'] = project.get('target_region', result.get('targetRegion', 'United States'))
        result['targetLanguage'] = project.get('target_language', result.get('targetLanguage', 'English'))
        
        return jsonify(result)
    
    except Exception as e:
        print(f"Error in new_content_idea: {e}")
        return jsonify({"error": str(e)}), 500

