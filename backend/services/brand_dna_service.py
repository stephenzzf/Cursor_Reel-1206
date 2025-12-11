"""
Brand DNA Service
提取品牌视觉规范（Brand DNA）的服务
分析 Logo、参考图片和视频 URL，提取视觉风格、配色、氛围等基因
"""

import json
import os
from typing import Optional, Dict, Any, List
from services.gemini_service import get_gemini_service_safe
import google.generativeai as genai


def safe_json_parse(json_string: str, fallback: Dict[str, Any]) -> Dict[str, Any]:
    """安全解析 JSON，处理可能的 markdown 包装"""
    try:
        text_to_parse = json_string.strip()
        
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
        if text_to_parse.startswith('```'):
            if text_to_parse.startswith('```json'):
                text_to_parse = text_to_parse[7:].strip()
            elif text_to_parse.startswith('```'):
                text_to_parse = text_to_parse[3:].strip()
        
        # 移除尾随逗号（LLM 输出常见问题）
        text_to_parse = text_to_parse.rstrip()
        if text_to_parse.endswith(',}'):
            text_to_parse = text_to_parse[:-2] + '}'
        elif text_to_parse.endswith(',]'):
            text_to_parse = text_to_parse[:-2] + ']'
        
        # 找到最后一个匹配的括号
        if text_to_parse.startswith('{'):
            last_brace = text_to_parse.rfind('}')
            if last_brace > -1:
                text_to_parse = text_to_parse[:last_brace + 1]
        
        return json.loads(text_to_parse)
    except Exception as e:
        print(f"Failed to parse JSON: {e}")
        print(f"Original string (first 500 chars): {json_string[:500]}")
        return fallback


def extract_brand_dna(
    logo_image: Optional[Dict[str, str]] = None,  # {"data": base64_string, "mimeType": "image/jpeg"}
    reference_images: List[Dict[str, str]] = None,  # [{"data": base64_string, "mimeType": "image/jpeg"}]
    description: str = "",
    video_urls: Optional[List[str]] = None  # YouTube URLs
) -> Dict[str, Any]:
    """
    提取 Brand DNA
    
    Args:
        logo_image: Logo 图片 (base64, mimeType)
        reference_images: 参考图片列表
        description: 品牌描述
        video_urls: YouTube 视频 URL 列表（可选，用于提取运镜风格）
    
    Returns:
        {
            "visualStyle": str,
            "colorPalette": str,
            "mood": str,
            "negativeConstraint": str,
            "motionStyle": str  # 可选，仅在 video_urls 提供时返回
        }
    """
    if reference_images is None:
        reference_images = []
    
    system_instruction = """You are a Senior Art Director and Brand Specialist. 
Your task is to analyze brand visual assets (Logo, Reference Images, and potentially Video URLs) along with a description to extract precise, structured visual guidelines (Brand DNA).

ROLE:
- Analyze the **Logo** (if provided) for Brand Color Palette.
- Analyze the **Reference Images** for Visual Style, Photography Direction, Lighting, and Mood.
- If **Video URLs** are provided, use Google Search to find information about their visual style (cinematography, camera movement, pace) to extract "Motion Style".
- Synthesize these into a cohesive "Visual System"."""
    
    # 构建分析提示词
    logo_section = "Asset 1 is the BRAND LOGO. Use it to determine the primary brand colors." if logo_image else "No Logo provided."
    ref_section = f"The remaining {len(reference_images)} images are STYLE REFERENCES. Use them to determine lighting, composition, and mood." if reference_images else ""
    
    video_section = ""
    if video_urls and len(video_urls) > 0:
        video_section = f"""
**VIDEO ANALYSIS TASK:**
The user provided these video references: {', '.join(video_urls)}.
Since you cannot watch them directly, use your **Google Search tool** to find descriptions, reviews, or technical breakdowns of these videos or the channel's general style.
Look for keywords related to: Camera Movement (e.g., handheld, drone, stable), Pacing (e.g., fast cut, slow motion), and Atmosphere.
Summarize this into a "Motion Style" string suitable for video generation prompts.
"""
    else:
        video_section = "No video references provided."
    
    analysis_prompt = f"""Analyze the provided assets and brand description: "{description}".

{logo_section}
{ref_section}

{video_section}

Extract the following "Brand DNA" components:

1. **Visual Style**: Describe composition, lighting, texture, and rendering style. (e.g., "Matte finish, soft diffused lighting, centered composition, minimalist").
2. **Color Palette**: Describe key colors and tonal balance. (e.g., "Primary Purple #6366F1, Dark Background, high key").
3. **Mood**: Describe the emotional atmosphere. (e.g., "Serene, organic, trustworthy, futuristic").
4. **Negative Constraints**: What visual elements MUST be avoided? (e.g., "No neon, no grunge, no dark shadows").
5. **Motion Style**: (If videos provided) Describe the movement/pace. If no videos, infer a safe default based on Visual Style (e.g. if 'Serene' -> 'Slow smooth pan').

Return result as JSON:
{{
    "visualStyle": "string",
    "colorPalette": "string",
    "mood": "string",
    "negativeConstraint": "string",
    "motionStyle": "string"
}}"""
    
    # 构建完整的多模态 parts
    full_prompt = f"{system_instruction}\n\n{analysis_prompt}"
    
    # 使用 genai SDK 直接调用，支持多模态输入
    api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    if not api_key:
        raise ValueError("GEMINI_API_KEY not configured")
    
    # 构建多模态 parts
    multimodal_parts = []
    if logo_image:
        multimodal_parts.append({
            'inline_data': {
                'mime_type': logo_image.get('mimeType', 'image/jpeg'),
                'data': logo_image.get('data', '')
            }
        })
    for img in reference_images:
        multimodal_parts.append({
            'inline_data': {
                'mime_type': img.get('mimeType', 'image/jpeg'),
                'data': img.get('data', '')
            }
        })
    multimodal_parts.append(full_prompt)
    
    # 根据是否有视频 URL 决定是否使用 Google Search 工具
    try:
        if video_urls and len(video_urls) > 0:
            # 使用 Google Search 工具（需要创建带 tools 的模型实例）
            # Python SDK 中，Google Search 工具格式可能不同，尝试多种格式
            try:
                model_with_tools = genai.GenerativeModel(
                    'gemini-2.5-flash',
                    tools=[{'googleSearch': {}}]  # 驼峰格式（与 gemini_service.py 保持一致）
                )
                response = model_with_tools.generate_content(multimodal_parts)
            except Exception as e1:
                print(f"Failed to create model with googleSearch tools: {e1}")
                try:
                    model_with_tools = genai.GenerativeModel(
                        'gemini-2.5-flash',
                        tools=[{'google_search': {}}]  # 下划线格式
                    )
                    response = model_with_tools.generate_content(multimodal_parts)
                except Exception as e2:
                    print(f"Failed to create model with google_search tools: {e2}")
                    # 如果都不行，回退到无工具模式
                    print("Falling back to model without tools")
                    model_no_tools = genai.GenerativeModel('gemini-2.5-flash')
                    response = model_no_tools.generate_content(multimodal_parts)
        else:
            # 不使用工具，直接生成
            model = genai.GenerativeModel('gemini-2.5-flash')
            response = model.generate_content(multimodal_parts)
        
        # 提取响应文本
        text = ""
        if hasattr(response, 'text') and response.text:
            text = response.text
        elif hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'content') and candidate.content:
                parts_list = getattr(candidate.content, 'parts', [])
                text_parts = [part.text for part in parts_list if hasattr(part, 'text')]
                if text_parts:
                    text = ' '.join(text_parts)
        
        if not text:
            raise ValueError("No text response from model")
        
        # 安全解析 JSON
        fallback_result = {
            "visualStyle": "Clean and professional",
            "colorPalette": "Neutral tones",
            "mood": "Trustworthy",
            "negativeConstraint": "Distorted visuals",
            "motionStyle": "Smooth and steady"
        }
        
        result = safe_json_parse(text, fallback_result)
        return result
        
    except Exception as e:
        print(f"Error in extract_brand_dna: {e}")
        import traceback
        traceback.print_exc()
        # 返回默认值
        return {
            "visualStyle": "Clean and professional",
            "colorPalette": "Neutral tones",
            "mood": "Trustworthy",
            "negativeConstraint": "Distorted visuals",
            "motionStyle": "Smooth and steady"
        }
