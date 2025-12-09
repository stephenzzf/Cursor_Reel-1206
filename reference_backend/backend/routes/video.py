"""
Video Generation 路由
处理所有视频生成相关的 API 端点
"""

from flask import Blueprint, request, jsonify
from services.gemini_service import get_gemini_service
from services.video_asset_service import get_video_asset_service
import json
import base64
import google.generativeai as genai
from google import genai as genai_new
from google.genai import types
import time
import os
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

video_bp = Blueprint('video', __name__, url_prefix='/api/video')


def upload_image_to_files_api(image_bytes, mime_type, api_key, display_name="image"):
    """
    上传图片到 Files API，返回文件 URI
    
    Args:
        image_bytes: 图片的二进制数据
        mime_type: 图片的 MIME 类型（如 'image/jpeg'）
        api_key: Google API Key
        display_name: 文件的显示名称
    
    Returns:
        文件 URI（如 'https://generativelanguage.googleapis.com/v1beta/files/file-id'）
    """
    import requests
    
    # 步骤1：初始化上传
    upload_init_url = "https://generativelanguage.googleapis.com/upload/v1beta/files"
    upload_init_headers = {
        'x-goog-api-key': api_key,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': str(len(image_bytes)),
        'X-Goog-Upload-Header-Content-Type': mime_type,
        'Content-Type': 'application/json'
    }
    upload_init_body = {
        'file': {
            'display_name': display_name
        }
    }
    
    init_response = requests.post(
        upload_init_url,
        headers=upload_init_headers,
        json=upload_init_body,
        timeout=30
    )
    init_response.raise_for_status()
    
    # 从响应头获取上传 URL
    upload_url = init_response.headers.get('X-Goog-Upload-URL')
    if not upload_url:
        raise Exception("Failed to get upload URL from Files API")
    
    # 步骤2：上传文件数据
    upload_headers = {
        'Content-Length': str(len(image_bytes)),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize'
    }
    
    upload_response = requests.put(
        upload_url,
        headers=upload_headers,
        data=image_bytes,
        timeout=60
    )
    upload_response.raise_for_status()
    
    # 从响应中获取文件 URI
    file_info = upload_response.json()
    file_uri = file_info.get('file', {}).get('uri')
    if not file_uri:
        raise Exception("Failed to get file URI from Files API response")
    
    return file_uri


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
        if text_to_parse.startswith('```'):
            # 移除开头的 ```json 或 ```
            if text_to_parse.startswith('```json'):
                text_to_parse = text_to_parse[7:].strip()
            elif text_to_parse.startswith('```'):
                text_to_parse = text_to_parse[3:].strip()
        
        return json.loads(text_to_parse)
    except Exception as e:
        print(f"Failed to parse JSON: {e}")
        print(f"Original string (first 500 chars): {json_string[:500]}")
        return fallback


@video_bp.route('/enhance-prompt', methods=['POST'])
def enhance_prompt():
    """
    优化提示词 (VEO 3.1 专家)
    
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
        
        system_instruction = """You are a Senior VEO 3.1 Prompt Specialist & Cinematic Director. Your task is to transform a user's basic idea into three distinct, professional creative directions for high-end video generation.

The Veo model requires specific prompt engineering to achieve the best results. You must strictly follow these VEO Golden Rules in your `fullPrompt`:
1.  **Subject & Action**: Describe fluid motion, physics, and specific activities clearly (not just who, but *what* they are doing dynamically).
2.  **Environment & Lighting**: Include atmospheric details (e.g., volumetric fog, golden hour, cinematic lighting, HDR, neon noir).
3.  **Camera Language**: MANDATORY. Use specific cinematic terms (e.g., Drone FPV, Low angle, Dolly zoom, Slow pan, Handheld shake, Bokeh, Rack focus).
4.  **Style & Aesthetics**: Specify film stock, render engine, or artistic style (e.g., 35mm film grain, Photorealistic, 8k, Unreal Engine 5 style).

Based on the user's idea, generate three distinct "Video Concept Cards" that tell a story:
- **Option A (Realistic/Cinematic)**: Focus on photorealism, movie-like quality, high-end production value (ARRI/IMAX aesthetics).
- **Option B (Creative/Stylized)**: Focus on unique art styles, animation (e.g., claymation, cyber-anime), or surreal visuals.
- **Option C (Dynamic/Action)**: Focus on speed, intense motion, fast cuts, and visual impact.

For each card, provide:
1.  `title`: A short, catchy title (e.g., "Neon Drift: Cyberpunk").
2.  `description`: A one-sentence summary of the narrative and visual mood.
3.  `tags`: An array of 3-4 relevant keyword tags.
4.  `fullPrompt`: A comprehensive, detailed prompt using the VEO Golden Rules above.

IMPORTANT: Detect the language of the user's idea (it will be either Chinese or English). You MUST generate all content for the cards (titles, descriptions, tags, and full prompts) in that SAME language (or Chinese mixed with English technical terms if the input is Chinese).

Your entire output must be a single, valid JSON array adhering to this TypeScript interface:
```typescript
interface EnhancedPrompt {
  title: string;
  description: string;
  tags: string[];
  fullPrompt: string;
}
```"""

        user_content = f'The user\'s idea is: "{prompt}"'
        
        response = gemini.generate_content(
            user_content,
            model='gemini-2.5-flash',
            system_instruction=system_instruction
        )
        
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


@video_bp.route('/design-plan', methods=['POST'])
def design_plan():
    """
    获取设计灵感方案 (两阶段：研究 + 结构化)
    
    Request: { "topic": string }
    Response: DesignPlan[] // Array of {title, description, referenceImagePrompt, prompt}
    """
    try:
        data = request.get_json()
        if not data or 'topic' not in data:
            return jsonify({"error": "Missing 'topic' in request body"}), 400
        
        topic = data['topic']
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        # Phase 1: Deep Visual Intelligence Search
        research_prompt = f"""
Act as an AI Cinematography & Motion Trend Researcher.
Conduct a deep dive search on Google for the topic: "{topic}".

Do NOT just search for general definitions. You must find:
1.  **Cinematic Lighting Trends** relevant to this topic (e.g., Volumetric lighting, Rembrandt, Neon noir).
2.  **Camera Movement Trends** (e.g., FPV Drone, Dolly Zoom, Orbit shot, Handheld).
3.  **Motion Aesthetics** (e.g., Slow motion fluid, Hyper-lapse, Morphing).
4.  **Render/Visual Styles** (e.g., Unreal Engine 5, Analog film grain, Claymation).

Detect the language of the topic (Chinese or English). Provide a concise but technical summary in that same language, focusing on "How to shoot it" rather than just "What it is".
"""
        
        # 尝试使用 Google Search tool，如果失败则直接生成
        try:
            research_response = gemini.generate_content_with_google_search(research_prompt, model='gemini-2.5-flash')
        except Exception as e:
            print(f"Google Search tool failed, using direct generation: {e}")
            research_response = gemini.generate_content(research_prompt, model='gemini-2.5-flash')
        
        research_summary = safe_get_text(research_response)
        
        # Phase 2: VEO Director Level Scheme Construction
        structuring_prompt = f"""
Act as a VEO 3.1 Creative Director.
Based on the following Visual Research Summary about "{topic}", create three distinct video production schemes.

Research Summary:
{research_summary}

Create these 3 schemes:
- **Scheme A: Cinematic Masterpiece** (Realistic, Physical Light, High-end Camera).
- **Scheme B: Avant-Garde / Stylized** (Unique Art Style, Animation, Mixed Media).
- **Scheme C: Commercial / Dynamic** (High Impact, Fast Paced, Product Showcase).

For each scheme, provide a JSON object with:
1.  `title`: Creative title.
2.  `description`: Brief visual summary.
3.  `referenceImagePrompt`: **CRITICAL**: This must describe a single **KEYFRAME** (First Frame) composition. Use terms like "A still shot of...", "Hyper-realistic photography of...", "Golden ratio composition". Do not describe motion here, only the static visual start point.
4.  `prompt`: The video generation prompt. Must follow the **[Subject + Action + Environment + Lighting + Camera + Style]** formula. Include specific camera moves (e.g., "Slow dolly in") and temporal details.

Output: A valid JSON array of 3 objects. Use the same language as the input topic.
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


@video_bp.route('/creative-director', methods=['POST'])
def creative_director():
    """
    创意总监：分析用户意图并决定下一步动作
    
    Request: { 
        "userPrompt": string,
        "chatHistory": VideoMessage[],
        "selectedVideoId": string | null,
        "lastGeneratedVideoId": string | null
    }
    Response: { 
        "action": string,
        "prompt": string,
        "reasoning": string,
        "targetVideoId"?: string
    }
    """
    try:
        data = request.get_json()
        if not data or 'userPrompt' not in data:
            return jsonify({"error": "Missing 'userPrompt' in request body"}), 400
        
        user_prompt = data['userPrompt']
        selected_video_id = data.get('selectedVideoId')
        last_generated_video_id = data.get('lastGeneratedVideoId')
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
            'name': 'video_creative_director_action',
            'description': 'Determines the next action for video creation.',
            'parameters': {
                'type': 'OBJECT',
                'properties': {
                    'action': {
                        'type': 'STRING',
                        'description': '"EDIT_VIDEO", "NEW_VIDEO", or "ANSWER_QUESTION"'
                    },
                    'prompt': {
                        'type': 'STRING',
                        'description': 'Refined prompt or text answer'
                    },
                    'reasoning': {
                        'type': 'STRING',
                        'description': 'Explanation in Chinese'
                    },
                    'targetVideoId': {
                        'type': 'STRING',
                        'description': 'ID of the video to act upon'
                    }
                },
                'required': ['action', 'prompt', 'reasoning']
            }
        }
        
        prompt = f"""
You are an AI Video Director. Analyze the user's request in the context of a video creation session.

**Context**:
- Explicitly Selected Video ID: {selected_video_id or 'None'}
- Last Generated Video ID: {last_generated_video_id or 'None'}
- Recent Chat:
{history_for_prompt}
- User Request: "{user_prompt}"

**Logic**:
1.  **EDIT_VIDEO**: If the user wants to change, modify, extend, or iterate on a video (e.g., "make it faster", "change style to claymation", "redo this"), the action is EDIT_VIDEO.
    - **Infer Target**: If a video is selected, use `selectedVideoId`. If not, but the user implies the previous one (e.g. "change it"), use `lastGeneratedVideoId`.
2.  **NEW_VIDEO**: If the user wants a completely new subject or scene (e.g., "show me a cat instead", "create a video of space").
3.  **ANSWER_QUESTION**: If it's a general question or conversational remark.

**Output**: Call 'video_creative_director_action'.
- `action`: "EDIT_VIDEO" | "NEW_VIDEO" | "ANSWER_QUESTION"
- `prompt`: The refined video generation prompt (or text answer).
- `reasoning`: Brief explanation in Chinese (e.g., "好的，基于上一条视频为您调整风格...").
- `targetVideoId`: The ID of the video to edit/reference (if action is EDIT_VIDEO).
"""
        
        try:
            response = gemini.generate_content_with_function_calling(prompt, [creative_director_tool], model='gemini-2.5-pro')
        except Exception as api_error:
            error_str = str(api_error)
            # 处理地理位置限制错误
            if 'location is not supported' in error_str.lower() or 'FailedPrecondition' in error_str:
                return jsonify({
                    "error": "API location restriction",
                    "message": "Your location is not supported for this API. Veo video generation may not be available in your region.",
                    "action": "ANSWER_QUESTION",
                    "prompt": "I apologize, but video generation is currently not available in your region due to API restrictions. Please try again later or contact support.",
                    "reasoning": "Location restriction detected by API"
                }), 200  # 返回 200 以便前端正常处理
            raise  # 重新抛出其他错误
        
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
                    'action': args.get('action', 'NEW_VIDEO'),
                    'prompt': args.get('prompt', user_prompt),
                    'reasoning': args.get('reasoning', f'好的，正在为您生成关于"{user_prompt}"的视频。')
                }
                if 'targetVideoId' in args:
                    result['targetVideoId'] = args['targetVideoId']
                return jsonify(result)
        
        # Fallback
        return jsonify({
            'action': 'NEW_VIDEO',
            'prompt': user_prompt,
            'reasoning': f'好的，正在为您生成关于"{user_prompt}"的视频。'
        })
    
    except Exception as e:
        error_str = str(e)
        print(f"Error in creative_director: {e}")
        import traceback
        traceback.print_exc()
        
        # 处理地理位置限制错误 - 返回友好的错误信息
        if 'location is not supported' in error_str.lower() or 'FailedPrecondition' in error_str:
            return jsonify({
                "error": "API location restriction",
                "message": "Your location is not supported for this API. Veo video generation may not be available in your region.",
                "action": "ANSWER_QUESTION",
                "prompt": "抱歉，由于 API 的地理位置限制，视频生成功能在您所在的地区暂不可用。请稍后再试或联系支持。",
                "reasoning": "检测到地理位置限制"
            }), 200  # 返回 200 以便前端正常处理
        
        return jsonify({"error": str(e)}), 500


@video_bp.route('/generate', methods=['POST'])
def generate_video():
    """
    生成视频 (Veo API) - 使用新版 Google Gen AI SDK
    
    Request: {
        "prompt": string,
        "images": [{"data": "base64", "mimeType": "string"}],
        "aspectRatio": "16:9" | "9:16",
        "modelName": "veo_fast" | "veo_gen"
    }
    Response: { "videoUri": string }
    """
    try:
        data = request.get_json()
        if not data or 'prompt' not in data:
            return jsonify({"error": "Missing 'prompt' in request body"}), 400
        
        prompt = data['prompt']
        images = data.get('images', [])
        aspect_ratio = data.get('aspectRatio', '16:9')
        model_name = data.get('modelName', 'veo_fast')
        
        # 获取 API key
        api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
        if not api_key:
            return jsonify({"error": "API Key is missing. Please configure GEMINI_API_KEY in .env"}), 500
        
        # 模型映射
        actual_model = 'veo-3.1-generate-preview'
        
        # 初始化新版 SDK 客户端
        try:
            client = genai_new.Client(api_key=api_key)
        except Exception as e:
            print(f"❌ Failed to initialize Gen AI client: {e}")
            return jsonify({"error": f"Failed to initialize SDK client: {str(e)}"}), 500
        
        # 初始化资产追踪引用
        doc_ref = None
        asset_service = get_video_asset_service()
        
        # 处理图片输入
        if images and len(images) > 0:
            # 解码第一张图片
            image_data_str = images[0]['data']
            image_mime_type = images[0].get('mimeType', 'image/jpeg')
            
            try:
                base64.b64decode(image_data_str, validate=True)
                image_bytes = base64.b64decode(image_data_str)
            except Exception:
                image_bytes = base64.b64decode(image_data_str) if isinstance(image_data_str, str) else image_data_str
            
            # 归档到 Firebase 并获取 GCS URI
            first_gcs_uri = None
            try:
                doc_ref, _, first_gcs_uri = asset_service.archive_and_prepare_reference(
                    image_bytes, 
                    image_mime_type, 
                    prompt
                )
                if doc_ref:
                    print(f"✅ Image archived to Firebase and tracking started.")
                    print(f"ℹ️ Start Frame GCS URI: {first_gcs_uri}")
            except Exception as e:
                print(f"⚠️ Failed to archive to Firebase (non-blocking): {e}")
            
            # 检查是否有尾帧（用于首尾帧插值）
            last_frame_gcs_uri = None
            last_frame_mime_type = None
            if len(images) >= 2:
                last_frame_data_str = images[1]['data']
                last_frame_mime_type = images[1].get('mimeType', 'image/jpeg')
                
                try:
                    base64.b64decode(last_frame_data_str, validate=True)
                    last_frame_bytes = base64.b64decode(last_frame_data_str)
                except Exception:
                    last_frame_bytes = base64.b64decode(last_frame_data_str) if isinstance(last_frame_data_str, str) else last_frame_data_str
                
                # 归档尾帧到 Firebase 以获取 GCS URI
                try:
                    _, _, last_frame_gcs_uri = asset_service.archive_and_prepare_reference(
                        last_frame_bytes,
                        last_frame_mime_type,
                        f"{prompt} (Last Frame)"
                    )
                    print(f"ℹ️ End Frame GCS URI: {last_frame_gcs_uri}")
                except Exception as e:
                    print(f"⚠️ Failed to archive End Frame to Firebase: {e}")
            
            # 构建配置对象（使用驼峰命名）
            # 注意：enhancePrompt 参数在某些模型（如 veo-3.1-generate-preview）中不支持，已移除
            # 注意：personGeneration 和 resolution 参数在当前 API 版本中不支持，已移除
            config = types.GenerateVideosConfig(
                numberOfVideos=1,
                durationSeconds=8,
                aspectRatio=aspect_ratio,
                negativePrompt='',
            )
            
            # 创建首帧图片对象
            if first_gcs_uri:
                base_interpol_image = types.Image(gcs_uri=first_gcs_uri)
            else:
                # 如果没有 GCS URI，使用 imageBytes (bytes 类型，驼峰命名)
                base_interpol_image = types.Image(
                    image_bytes=image_bytes,
                    mime_type=image_mime_type
                )
            
            # 如果有尾帧，设置 last_frame
            if len(images) >= 2 and last_frame_gcs_uri:
                last_frame_image = types.Image(gcs_uri=last_frame_gcs_uri)
                config.last_frame = last_frame_image
                print("ℹ️ Start/End Frame interpolation enabled")
            
            # 生成视频（异步操作）
            try:
                print(f"ℹ️ Starting video generation with model: {actual_model}")
                operation = client.models.generate_videos(
                    model=actual_model,
                    prompt=prompt,
                    image=base_interpol_image,
                    config=config
                )
            except Exception as e:
                error_msg = f"Failed to start video generation: {str(e)}"
                print(f"❌ {error_msg}")
                if doc_ref:
                    asset_service.update_asset_status(doc_ref, "failed", error=error_msg)
                return jsonify({"error": error_msg}), 500

        else:
            # 纯文本输入（无图片）
            # 注意：enhancePrompt 参数在某些模型（如 veo-3.1-generate-preview）中不支持，已移除
            # 注意：personGeneration 和 resolution 参数在当前 API 版本中不支持，已移除
            config = types.GenerateVideosConfig(
                numberOfVideos=1,
                durationSeconds=8,
                aspectRatio=aspect_ratio,
                negativePrompt='',
            )
            
            try:
                print(f"ℹ️ Starting text-only video generation with model: {actual_model}")
                operation = client.models.generate_videos(
                    model=actual_model,
                    prompt=prompt,
                    config=config
                )
            except Exception as e:
                error_msg = f"Failed to start video generation: {str(e)}"
                print(f"❌ {error_msg}")
                return jsonify({"error": error_msg}), 500
        
        # 轮询操作直到完成（带重试机制处理 SSL/网络错误）
        print("ℹ️ Polling operation status...")
        max_poll_retries = 10  # 最大轮询重试次数
        poll_retry_count = 0
        consecutive_errors = 0
        max_consecutive_errors = 3  # 连续错误次数阈值
        
        while not operation.done:
            time.sleep(5)  # 每 5 秒轮询一次
            try:
                operation = client.operations.get(operation)
                print(f"ℹ️ Operation status: {operation.name} (done: {operation.done})")
                consecutive_errors = 0  # 重置连续错误计数
                poll_retry_count = 0  # 重置重试计数
            except Exception as e:
                error_str = str(e).lower()
                # 检查是否为可重试的错误（SSL、网络、超时等）
                is_retriable_error = (
                    'eof' in error_str or
                    'ssl' in error_str or
                    'connection' in error_str or
                    'timeout' in error_str or
                    'network' in error_str or
                    'broken pipe' in error_str
                )
                
                consecutive_errors += 1
                poll_retry_count += 1
                
                if is_retriable_error and poll_retry_count < max_poll_retries:
                    # 指数退避：第一次重试等待 2 秒，第二次 4 秒，第三次 8 秒...
                    retry_delay = min(2 ** poll_retry_count, 30)  # 最多等待 30 秒
                    print(f"⚠️ Polling error (attempt {poll_retry_count}/{max_poll_retries}): {str(e)}")
                    print(f"ℹ️ Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    continue
                elif consecutive_errors >= max_consecutive_errors:
                    # 连续多次错误，可能操作已失败
                    error_msg = f"Failed to poll operation after {consecutive_errors} consecutive errors: {str(e)}"
                    print(f"❌ {error_msg}")
                    if doc_ref:
                        asset_service.update_asset_status(doc_ref, "failed", error=error_msg)
                    return jsonify({"error": error_msg}), 500
                else:
                    # 不可重试的错误或超过最大重试次数
                    error_msg = f"Failed to poll operation: {str(e)}"
                    print(f"❌ {error_msg}")
                    if doc_ref:
                        asset_service.update_asset_status(doc_ref, "failed", error=error_msg)
                    return jsonify({"error": error_msg}), 500
        
        # 操作完成，获取生成的视频
        try:
            # 首先检查操作是否有错误（操作可能完成但失败）
            if hasattr(operation, 'error') and operation.error:
                error_msg = f"Video generation operation failed: {operation.error}"
                print(f"❌ {error_msg}")
                print(f"ℹ️ Operation name: {operation.name if hasattr(operation, 'name') else 'unknown'}")
                if doc_ref:
                    asset_service.update_asset_status(doc_ref, "failed", error=error_msg)
                return jsonify({"error": error_msg}), 500
            
            # 检查响应是否存在
            if not hasattr(operation, 'response') or not operation.response:
                # 添加详细调试信息以便诊断问题
                operation_attrs = [attr for attr in dir(operation) if not attr.startswith('_')]
                print(f"⚠️ Operation completed but no response. Available attributes: {operation_attrs}")
                print(f"ℹ️ Operation details:")
                print(f"   - name: {getattr(operation, 'name', 'N/A')}")
                print(f"   - done: {getattr(operation, 'done', 'N/A')}")
                print(f"   - has response: {hasattr(operation, 'response')}")
                print(f"   - has error: {hasattr(operation, 'error')}")
                
                # 尝试获取更多错误信息
                error_details = {}
                if hasattr(operation, 'error') and operation.error:
                    error_details['error'] = str(operation.error)
                if hasattr(operation, 'metadata'):
                    try:
                        error_details['metadata'] = str(operation.metadata)
                    except:
                        pass
                
                # 构建更详细的错误消息
                if error_details:
                    error_msg = f"Operation completed but no response available. Details: {error_details}"
                else:
                    error_msg = "Operation completed but no response available. This may indicate an API issue or operation failure."
                
                print(f"❌ {error_msg}")
                if doc_ref:
                    asset_service.update_asset_status(doc_ref, "failed", error=error_msg)
                return jsonify({"error": error_msg}), 500
            
            generated_videos = operation.response.generated_videos
            if not generated_videos or len(generated_videos) == 0:
                error_msg = "Video generation completed but no videos returned"
                print(f"❌ {error_msg}")
                if doc_ref:
                    asset_service.update_asset_status(doc_ref, "failed", error=error_msg)
                return jsonify({"error": error_msg}), 500
            
            # 获取第一个生成的视频
            video = generated_videos[0].video
            
            # 获取视频 URI
            if hasattr(video, 'uri'):
                video_uri = video.uri
            elif hasattr(video, 'url'):
                video_uri = video.url
            else:
                # 尝试从对象中获取
                video_uri = str(video) if video else None
            
            if not video_uri:
                error_msg = "Video generation completed but no URI returned"
                print(f"❌ {error_msg}")
                if doc_ref:
                    asset_service.update_asset_status(doc_ref, "failed", error=error_msg)
                return jsonify({"error": error_msg}), 500
            
            # 构建签名 URL（如果需要）
            try:
                parsed_url = urlparse(video_uri)
                query_params = parse_qs(parsed_url.query)
                query_params['key'] = [api_key]
                new_query = urlencode(query_params, doseq=True)
                final_video_uri = urlunparse((
                    parsed_url.scheme,
                    parsed_url.netloc,
                    parsed_url.path,
                    parsed_url.params,
                    new_query,
                    parsed_url.fragment
                ))
            except Exception as e:
                print(f"⚠️ Failed to parse video URI, using original: {e}")
                separator = '&' if '?' in video_uri else '?'
                final_video_uri = f"{video_uri}{separator}key={api_key}"
            
            # 更新 Firestore 状态为完成
            if doc_ref:
                asset_service.update_asset_status(doc_ref, "completed", video_uri=final_video_uri)
            
            print(f"✅ Video generation completed: {final_video_uri}")
            return jsonify({"videoUri": final_video_uri})
            
        except Exception as e:
            error_msg = f"Failed to retrieve generated video: {str(e)}"
            print(f"❌ {error_msg}")
            import traceback
            traceback.print_exc()
            if doc_ref:
                asset_service.update_asset_status(doc_ref, "failed", error=error_msg)
            return jsonify({"error": error_msg}), 500
        
    except ImportError:
        return jsonify({"error": "requests library is required for video generation"}), 500
    except Exception as e:
        print(f"Error in generate_video: {e}")
        import traceback
        traceback.print_exc()
        # 尝试更新状态（如果 doc_ref 在作用域内且已定义）
        try:
            if 'doc_ref' in locals() and doc_ref:
                asset_service.update_asset_status(doc_ref, "failed", error=str(e))
        except:
            pass
        return jsonify({"error": str(e)}), 500


@video_bp.route('/summarize-prompt', methods=['POST'])
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
        
        api_prompt = f'Summarize: "{prompt}" into max 5 words.'
        response = gemini.generate_content(api_prompt, model='gemini-2.5-flash')
        summary = safe_get_text(response).strip()
        
        if not summary:
            summary = prompt[:20] if len(prompt) > 20 else prompt
        
        return jsonify({"summary": summary})
    
    except Exception as e:
        print(f"Error in summarize_prompt: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@video_bp.route('/reference-image', methods=['POST'])
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
        
        # 复用图片生成服务
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
