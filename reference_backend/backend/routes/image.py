"""
Image Generation 路由
处理所有图片生成相关的 API 端点
"""

from flask import Blueprint, request, jsonify
from services.gemini_service import get_gemini_service
import json
import base64
import google.generativeai as genai

image_bp = Blueprint('image', __name__, url_prefix='/api/image')


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


@image_bp.route('/creative-director', methods=['POST'])
def creative_director():
    """
    创意总监：分析用户意图并决定下一步动作
    
    Request: { 
        "userPrompt": string,
        "selectedImageId": string | null,
        "lastGeneratedImageId": string | null,
        "chatHistory": ImageMessage[]
    }
    Response: { 
        "action": string,
        "prompt": string,
        "reasoning": string,
        "targetImageId"?: string
    }
    """
    try:
        data = request.get_json()
        if not data or 'userPrompt' not in data:
            return jsonify({"error": "Missing 'userPrompt' in request body"}), 400
        
        user_prompt = data['userPrompt']
        selected_image_id = data.get('selectedImageId')
        last_generated_image_id = data.get('lastGeneratedImageId')
        chat_history = data.get('chatHistory', [])
        
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        # 构建历史记录文本
        history_lines = []
        for msg in chat_history[-4:]:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            if isinstance(content, str):
                history_lines.append(f"{role}: {content}")
            else:
                msg_type = msg.get('type', 'unknown')
                history_lines.append(f"{role}: [{msg_type} message]")
        history_for_prompt = '\n'.join(history_lines)
        
        # 函数声明
        creative_director_tool = {
            'name': 'creative_director_action',
            'description': 'Analyzes user intent in an image creation context and determines the next best action.',
            'parameters': {
                'type': 'OBJECT',
                'properties': {
                    'action': {
                        'type': 'STRING',
                        'description': 'The determined action. Must be one of: "EDIT_IMAGE", "NEW_CREATION", "ANSWER_QUESTION".'
                    },
                    'prompt': {
                        'type': 'STRING',
                        'description': 'The original or a refined prompt to be used for the next step. For ANSWER_QUESTION, this is the text response.'
                    },
                    'reasoning': {
                        'type': 'STRING',
                        'description': 'A brief, user-facing explanation in Chinese for why this action was chosen.'
                    },
                    'targetImageId': {
                        'type': 'STRING',
                        'description': 'If the action is "EDIT_IMAGE", this is the ID of the image that should be edited (either the explicitly selected one or the last one generated).'
                    }
                },
                'required': ['action', 'prompt', 'reasoning']
            }
        }
        
        prompt = f"""
You are an AI Creative Director. Your job is to analyze the user's request in the context of an image creation session and decide the next action.

**Current Context**:
- Explicitly Selected Image ID: {selected_image_id or 'None'}
- Most Recently Generated Image ID: {last_generated_image_id or 'None'}
- Recent Conversation History:
{history_for_prompt}
- User's Latest Request: "{user_prompt}"

**Your Logic & Rules**:
1.  **Prioritize Editing**: If an image is explicitly selected OR if the request is a clear follow-up modification to the last generated image (e.g., "change the background", "make it blue"), the action MUST be **EDIT_IMAGE**.
    - If an image was explicitly selected, `targetImageId` MUST be '{selected_image_id}'.
    - If it's a follow-up, `targetImageId` MUST be '{last_generated_image_id}'.
2.  **Answer Question**: If the user is asking a question or making a comment that doesn't seem to be an image request (e.g., "what can you do?", "that's cool"), the action is **ANSWER_QUESTION**. The 'prompt' field should contain your text response.
3.  **Default to New Creation**: For any other creative request that is not an edit or a question (e.g., "a cat astronaut", "social media images for a coffee shop"), the action is **NEW_CREATION**. `targetImageId` should not be set.

Based on this logic, call the 'creative_director_action' function with your decision. The 'reasoning' should be a short, friendly, and contextual message in Chinese to the user explaining your understanding. For example: "好的，为您创作一张关于'{user_prompt}'的新图片。", "好的，正在为您修改上一张图片。", "正在为您解答问题。".
"""
        
        response = gemini.generate_content_with_function_calling(prompt, [creative_director_tool], model='gemini-2.5-pro')
        
        # 检查函数调用响应
        function_call = None
        if hasattr(response, 'candidates') and response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            if hasattr(candidate, 'content') and candidate.content:
                parts = getattr(candidate.content, 'parts', [])
                for part in parts:
                    if hasattr(part, 'function_call') and part.function_call:
                        function_call = part.function_call
                        break
                    if isinstance(part, dict) and 'function_call' in part:
                        function_call = part['function_call']
                        break
        
        if function_call:
            if hasattr(function_call, 'args'):
                args = function_call.args
            elif isinstance(function_call, dict):
                args = function_call.get('args', {})
            else:
                args = {}
            
            if isinstance(args, dict):
                result = {
                    'action': args.get('action', 'NEW_CREATION'),
                    'prompt': args.get('prompt', user_prompt),
                    'reasoning': args.get('reasoning', f'好的，正在为您创作一张关于"{user_prompt}"的图片。')
                }
                if 'targetImageId' in args:
                    result['targetImageId'] = args['targetImageId']
                return jsonify(result)
        
        # Fallback
        return jsonify({
            'action': 'NEW_CREATION',
            'prompt': user_prompt,
            'reasoning': f'好的，正在为您创作一张关于"{user_prompt}"的图片。'
        })
    
    except Exception as e:
        print(f"Error in creative_director: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@image_bp.route('/generate', methods=['POST'])
def generate_image():
    """
    生成图片
    
    Request: {
        "prompt": string,
        "images": [{data: string, mimeType: string}],
        "aspectRatio": string,
        "modelLevel": "banana" | "banana_pro"
    }
    Response: { "base64Image": string }
    """
    try:
        data = request.get_json()
        if not data or 'prompt' not in data:
            return jsonify({"error": "Missing 'prompt' in request body"}), 400
        
        prompt = data['prompt']
        images = data.get('images', [])
        aspect_ratio = data.get('aspectRatio', '1:1')
        model_level = data.get('modelLevel', 'banana')
        
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        # 准备输入图片数据
        image_parts = []
        for img in images:
            image_parts.append({
                'data': img.get('data', ''),
                'mimeType': img.get('mimeType', 'image/jpeg')
            })
        
        base64_image = gemini.generate_image_with_aspect_ratio(
            prompt=prompt,
            images=image_parts if image_parts else None,
            aspect_ratio=aspect_ratio,
            model_level=model_level
        )
        
        return jsonify({"base64Image": base64_image})
    
    except Exception as e:
        print(f"Error in generate_image: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@image_bp.route('/enhance-prompt', methods=['POST'])
def enhance_prompt():
    """
    优化提示词
    
    Request: { "prompt": string }
    Response: EnhancedPrompt[] // Array of {title, description, tags, fullPrompt}
    """
    try:
        data = request.get_json()
        if not data or 'prompt' not in data:
            return jsonify({"error": "Missing 'prompt' in request body"}), 400
        
        prompt = data['prompt']
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        system_instruction = "You are an expert AI Art Director. Your task is to transform a user's basic idea into three distinct, professional creative directions. You must return a valid JSON array of objects."
        
        user_content = f"""
The user's idea is: "{prompt}"

Based on this idea, generate three distinct "Prompt Optimization Cards". For each card, provide:
1.  `title`: A short, catchy title for the creative direction (e.g., "Cinematic Portrait", "Retro Anime Style").
2.  `description`: A one-sentence summary of the style and mood.
3.  `tags`: An array of 3-4 relevant keyword tags (e.g., ["close-up", "golden hour", "shallow depth of field"]).
4.  `fullPrompt`: A complete, detailed, and enhanced prompt for the 'gemini-2.5-flash-image' model that fully realizes the creative direction.

IMPORTANT: Detect the language of the user's idea (it will be either Chinese or English). You MUST generate all content for the cards (titles, descriptions, tags, and full prompts) in that SAME language.

Your entire output must be a single, valid JSON array adhering to this TypeScript interface:
```typescript
interface EnhancedPrompt {{
  title: string;
  description: string;
  tags: string[];
  fullPrompt: string;
}}
```
"""
        
        response = gemini.generate_content(user_content, model='gemini-2.5-flash', system_instruction=system_instruction)
        text = safe_get_text(response)
        
        fallback_result = [{
            "title": "Original Prompt",
            "description": "Your original idea, ready to generate.",
            "tags": ["user-provided"],
            "fullPrompt": prompt
        }]
        
        result = safe_json_parse(text, fallback_result)
        if not isinstance(result, list):
            result = fallback_result
        
        return jsonify(result)
    
    except Exception as e:
        print(f"Error in enhance_prompt: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@image_bp.route('/design-plan', methods=['POST'])
def design_plan():
    """
    获取设计灵感方案
    
    Request: { "topic": string }
    Response: DesignPlanWithImagePrompt[] // Array of {title, description, prompt, referenceImagePrompt}
    """
    try:
        data = request.get_json()
        if not data or 'topic' not in data:
            return jsonify({"error": "Missing 'topic' in request body"}), 400
        
        topic = data['topic']
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        # Step 1: 研究阶段
        # 暂时不使用 Google Search 工具（API 版本限制），直接生成研究摘要
        research_prompt = f"""
As an AI Art Director and visual trend researcher, research current visual trends, popular aesthetics, color palettes, and best practices related to the topic: "{topic}".
Detect the language of the topic (Chinese or English) and provide your findings as a detailed text summary in that same language.
"""
        
        research_response = gemini.generate_content(research_prompt, model='gemini-2.5-flash')
        research_summary = safe_get_text(research_response)
        
        # Step 2: 结构化阶段
        structuring_prompt = f"""
Based on the following research summary about the topic "{topic}", create three distinct creative strategies.

**Research Summary**:
---
{research_summary}
---

**IMPORTANT**:
- You MUST detect the language from the research summary (it will be either Chinese or English).
- You MUST generate all parts of your response (title, description, and both prompts) exclusively in that SAME language. Do not mix languages.

**Output Format**:
Return a valid JSON array of three objects adhering to this TypeScript interface. Do not include any text outside the JSON.
```typescript
interface DesignPlanWithImagePrompt {{
  title: string; // A creative title for the design strategy.
  description: string; // A short explanation of the visual direction.
  prompt: string; // A detailed, ready-to-use prompt for the FINAL image creation if the user chooses this plan.
  referenceImagePrompt: string; // A separate, detailed prompt specifically for generating a high-quality REFERENCE image that visually represents this strategy's mood and style.
}}
```
"""
        
        structuring_response = gemini.generate_content(structuring_prompt, model='gemini-2.5-flash')
        text = safe_get_text(structuring_response)
        
        result = safe_json_parse(text, [])
        if not isinstance(result, list):
            result = []
        
        return jsonify(result)
    
    except Exception as e:
        print(f"Error in design_plan: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@image_bp.route('/reference-image', methods=['POST'])
def reference_image():
    """
    生成参考图片
    
    Request: { "prompt": string }
    Response: { "base64Image": string }
    """
    try:
        data = request.get_json()
        if not data or 'prompt' not in data:
            return jsonify({"error": "Missing 'prompt' in request body"}), 400
        
        prompt = data['prompt']
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        base64_image = gemini.generate_image_with_imagen(
            prompt=prompt,
            aspect_ratio='16:9',
            number_of_images=1
        )
        
        return jsonify({"base64Image": base64_image})
    
    except Exception as e:
        print(f"Error in reference_image: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@image_bp.route('/upscale', methods=['POST'])
def upscale_image():
    """
    高清放大图片
    
    Request: {
        "base64Data": string,
        "mimeType": string,
        "factor": number,
        "prompt": string
    }
    Response: { "base64Image": string }
    """
    try:
        data = request.get_json()
        if not data or 'prompt' not in data:
            return jsonify({"error": "Missing 'prompt' in request body"}), 400
        
        prompt = data['prompt']
        factor = data.get('factor', 2)
        # Note: factor is not directly used by Imagen, we regenerate with the prompt
        
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        # Use Imagen to regenerate high-quality version
        base64_image = gemini.generate_image_with_imagen(
            prompt=prompt,
            aspect_ratio='1:1',  # Default, ideally should match original
            number_of_images=1
        )
        
        return jsonify({"base64Image": base64_image})
    
    except Exception as e:
        print(f"Error in upscale_image: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@image_bp.route('/summarize-prompt', methods=['POST'])
def summarize_prompt():
    """
    总结提示词为简短标题
    
    Request: { "prompt": string }
    Response: { "summary": string }
    """
    try:
        data = request.get_json()
        if not data or 'prompt' not in data:
            return jsonify({"error": "Missing 'prompt' in request body"}), 400
        
        prompt = data['prompt']
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        api_prompt = f"""
Summarize the following image generation prompt into a very short, concise title (max 7 words). 
The summary should capture the main subject and style. Do not use quotation marks.
The summary should be in the same language as the original prompt.

Example 1:
Prompt: "A professional e-commerce product shot of a stylish black chronograph watch on a textured dark marble surface, dramatic studio lighting, macro details."
Summary: Stylish Black Chronograph Watch

Example 2:
Prompt: "为Ulanzi品牌设计的EDM邮件视觉图，呈现一个富有远见和未来感的高科技概念实验室，主视觉将Ulanzi产品——特别是F38快拆系统、一个流线型三脚架和一块先进的LED面板——展示在发光、半透明的平台上"
Summary: Ulanzi品牌EDM高科技视觉图

Your turn.
Prompt: "{prompt}"
Summary:
"""
        
        response = gemini.generate_content(api_prompt, model='gemini-2.5-flash')
        summary = safe_get_text(response).strip()
        
        if not summary:
            summary = prompt[:40] + '...'
        
        return jsonify({"summary": summary})
    
    except Exception as e:
        print(f"Error in summarize_prompt: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@image_bp.route('/remove-background', methods=['POST'])
def remove_background():
    """
    去除背景
    
    Request: { "base64Data": string, "mimeType": string }
    Response: { "base64Image": string } // PNG with transparency
    """
    try:
        data = request.get_json()
        if not data or 'base64Data' not in data:
            return jsonify({"error": "Missing 'base64Data' in request body"}), 400
        
        base64_data = data['base64Data']
        mime_type = data.get('mimeType', 'image/jpeg')
        
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        prompt = """
# System Role: High-Precision Computer Vision Engine
# Task: Zero-Shot Image Segmentation & Background Removal

# Input: [Uploaded Image]

# Processing Logic (Step-by-Step):
1. **Object Detection:** Identify the salient foreground object(s) with high confidence boundaries.
2. **Mask Generation:** Create a binary alpha mask where Foreground = 1 and Background = 0.
3. **Compositing:** Apply the mask to the original pixel data.
   $$Output_{pixel} = Input_{pixel} \times Mask_{value}$$

# STRICT CONSTRAINTS:
* **PRESERVE PIXELS:** Do NOT regenerate, repaint, or perform 'img2img' on the foreground.
* **NO HALLUCINATIONS:** The texture, lighting, and resolution of the subject must match the source bit-for-bit.
* **OUTPUT:** Return the image with a transparent PNG background.
"""
        
        base64_image = gemini.generate_image_with_modality(
            prompt=prompt,
            image_data=base64_data,
            mime_type=mime_type
        )
        
        return jsonify({"base64Image": base64_image})
    
    except Exception as e:
        print(f"Error in remove_background: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@image_bp.route('/inspiration', methods=['POST'])
def inspiration_image():
    """
    生成灵感图片
    
    Request: { "prompt": string }
    Response: { "base64Image": string }
    """
    try:
        data = request.get_json()
        if not data or 'prompt' not in data:
            return jsonify({"error": "Missing 'prompt' in request body"}), 400
        
        prompt = data['prompt']
        # 清理提示词
        prompt_for_image = prompt.replace('创建AI图片', '').replace('创建AI视频', '').strip()
        
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        try:
            # 尝试使用 flash-image 模型
            base64_image = gemini.generate_image_with_aspect_ratio(
                prompt=prompt_for_image,
                images=None,
                aspect_ratio='1:1',
                model_level='banana'
            )
            return jsonify({"base64Image": base64_image})
        except Exception as e:
            print(f"Flash Image failed for inspiration, trying pro model: {e}")
            # Fallback to pro model
            base64_image = gemini.generate_image_with_aspect_ratio(
                prompt=prompt_for_image,
                images=None,
                aspect_ratio='1:1',
                model_level='banana_pro'
            )
            return jsonify({"base64Image": base64_image})
    
    except Exception as e:
        print(f"Error in inspiration_image: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

