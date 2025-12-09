"""
SEO 竞争对手相关路由
由于文件较大，将竞争对手功能单独拆分
"""

from flask import Blueprint, request, jsonify
from services.gemini_service import get_gemini_service
from utils.rag_knowledge import search_rag_by_industry
from routes.seo import safe_json_parse
import json

seo_competitors_bp = Blueprint('seo_competitors', __name__, url_prefix='/api/seo')


def get_gemini_service_safe():
    """安全获取 Gemini 服务，返回 (service, error_response)"""
    try:
        return get_gemini_service(), None
    except ValueError as e:
        return None, (jsonify({"error": str(e)}), 500)


@seo_competitors_bp.route('/competitors', methods=['POST'])
def get_competitors():
    """
    获取竞争对手列表
    
    Request: { "url": "...", "profile": {...}, "userInstructions": "..." }
    Response: Competitor[]
    """
    try:
        data = request.get_json()
        if not data or 'url' not in data or 'profile' not in data:
            return jsonify({"error": "Missing required fields"}), 400
        
        url = data['url']
        profile = data['profile']
        user_instructions = data.get('userInstructions')
        brand_industry = profile.get('globalInfo', {}).get('brand_industry', '')
        
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        # Step 1: 研究竞争对手
        research_prompt = f"""
请使用Google搜索，为网站 {url}（行业：'{brand_industry}'）识别出3-5个主要的SEO竞争对手。
对于每个竞争对手，请分析他们的SEO实力，并简要说明为什么他们是竞争对手。
{f'用户具体指示: "{user_instructions}"' if user_instructions else ''}
请以列表形式总结你的发现。
"""
        
        # 暂时不使用 Google Search 工具（API 版本限制），直接生成分析
        research_response = gemini.generate_content(research_prompt, model='gemini-2.5-flash')
        research_summary = research_response.text or ''
        
        # Step 2: 结构化为 JSON
        structuring_prompt = f"""
根据以下竞争对手研究摘要，提取竞争对手信息并格式化为JSON数组。

研究摘要:
---
{research_summary}
---

请以一个遵循此TypeScript接口的有效JSON数组格式返回你的发现。不要在JSON数组之外包含任何文本。
```typescript
interface Competitor {{
  id: string; // a unique identifier for each competitor, e.g., 'comp-1'
  url: string;
  reasonText?: string;
}}
```
"""
        
        competitors = gemini.generate_json(structuring_prompt)
        
        # 确保是数组格式
        if not isinstance(competitors, list):
            competitors = [competitors] if competitors else []
        
        # 添加 ID
        result = []
        for i, comp in enumerate(competitors):
            if isinstance(comp, dict):
                comp['id'] = comp.get('id', f'comp-{i + 1}')
                result.append(comp)
        
        return jsonify(result)
    
    except Exception as e:
        print(f"Error in get_competitors: {e}")
        # Fallback
        fallback = [
            {'id': 'comp-1', 'url': 'www.example1.com', 'reasonText': '主要竞争对手'},
            {'id': 'comp-2', 'url': 'www.example2.com', 'reasonText': '次要竞争对手'},
        ]
        return jsonify(fallback)


@seo_competitors_bp.route('/competitor-analysis', methods=['POST'])
def competitor_analysis():
    """
    运行竞对分析
    
    Request: { "competitors": [...], "seoReport": {...}, "profile": {...} }
    Response: CompetitorAnalysisReport
    """
    try:
        data = request.get_json()
        if not data or 'competitors' not in data or 'seoReport' not in data or 'profile' not in data:
            return jsonify({"error": "Missing required fields"}), 400
        
        competitors = data['competitors']
        seo_report = data['seoReport']
        profile = data['profile']
        brand_industry = profile.get('globalInfo', {}).get('brand_industry', '')
        
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        rag_articles = search_rag_by_industry(brand_industry)
        
        # 分析每个竞争对手
        analyzed_competitors = []
        for competitor in competitors:
            comp_url = competitor.get('url', '')
            try:
                # 查找顶级文章
                find_article_prompt = f'Using Google Search, find one of the single highest-quality, best-performing blog articles from the website "{comp_url}". The link MUST be a specific article, not a homepage or category page. Provide only its full URL and title. If you cannot find one, just say "No suitable article found."'
                
                # 暂时不使用 Google Search 工具（API 版本限制），直接生成分析
                article_search_response = gemini.generate_content(find_article_prompt, model='gemini-2.5-flash')
                # 安全获取响应文本
                if hasattr(article_search_response, 'text') and article_search_response.text:
                    article_search_result = article_search_response.text
                elif hasattr(article_search_response, 'candidates') and article_search_response.candidates:
                    parts = article_search_response.candidates[0].content.parts if hasattr(article_search_response.candidates[0].content, 'parts') else []
                    article_search_result = ' '.join([part.text for part in parts if hasattr(part, 'text')])
                else:
                    article_search_result = ''
                
                # 分析竞争对手
                analysis_prompt = f"""
You are an expert SEO analyst.
Competitor Website: "{comp_url}"
Top Article Search Result: "{article_search_result}"

Your tasks:
1.  Based on the search result, extract the article's full URL and title. If no article was found, the URL and title should be null.
2.  Evaluate the overall content quality of "{comp_url}" (considering its expertise, authoritativeness, trustworthiness, SEO, and user experience). Provide a single "contentSeoScore" from 0 to 100.
3.  If a top article was found, provide a brief "reason" explaining why it is a good, high-quality article. If not, this should be null.

Provide your final output as a single, valid JSON object adhering to this TypeScript interface. Do not include any other text or markdown.
```typescript
interface AnalyzedCompetitor {{
  url: string; // The competitor's URL
  contentSeoScore: number;
  topArticle?: {{
      title: string;
      url: string;
      reason: string;
  }};
}}
```
"""
                
                analysis_result = gemini.generate_json(analysis_prompt)
                analyzed_competitors.append({
                    **competitor,
                    **analysis_result
                })
            except Exception as e:
                print(f"Error analyzing competitor {comp_url}: {e}")
                analyzed_competitors.append({
                    **competitor,
                    'contentSeoScore': 70,
                    'topArticle': {
                        'title': 'Analysis Failed',
                        'url': f'https://{comp_url}',
                        'reason': 'Could not retrieve article due to an API error.'
                    }
                })
        
        # 生成竞争格局分析
        newline = '\n'
        competitor_data_text = newline.join([
            f"- {c.get('url', '')} (Content Score: {c.get('contentSeoScore', 0)}). Top article topic: {c.get('topArticle', {}).get('title', 'N/A')}"
            for c in analyzed_competitors
        ])
        
        landscape_prompt = f"""
You are a senior SEO strategist. Based on the following competitor data, provide a high-level analysis of the competitive landscape for the client "{seo_report.get('siteUrl', '')}".

**Competitor Data:**
{competitor_data_text}

**Client's Content Disadvantage:**
Based on their SEO report, their content score is low ({seo_report.get('contentSeoHealthScore', 0)}) and they struggle with content depth.

**Your Task:**
Generate a JSON object with three key insights.
**IMPORTANT**: The string values for the keys in the JSON object MUST be in **Chinese**.
1.  **overallTrend**: A 1-2 sentence summary of the content trends you see from the competitors.
2.  **yourDisadvantage**: A 1-2 sentence summary of the client's biggest content weakness compared to these competitors.
3.  **strategicOpportunity**: A 1-2 sentence actionable recommendation for a strategic opportunity.

Your output must be a single, valid JSON object adhering to this interface:
```typescript
interface CompetitiveLandscape {{
    overallTrend: string; // Must be in Chinese
    yourDisadvantage: string; // Must be in Chinese
    strategicOpportunity: string; // Must be in Chinese
}}
```
"""
        
        competitive_landscape = gemini.generate_json(landscape_prompt)
        
        return jsonify({
            'ragArticles': rag_articles,
            'competitiveLandscape': competitive_landscape,
            'competitors': analyzed_competitors
        })
    
    except Exception as e:
        print(f"Error in competitor_analysis: {e}")
        return jsonify({"error": str(e)}), 500

