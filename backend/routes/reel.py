"""
Reel Generation 路由
处理所有 Reel 生成相关的 API 端点（图片和视频）
"""

from flask import Blueprint, request, jsonify
from services.gemini_service import get_gemini_service_safe
from utils.auth import verify_firebase_token
import json
import base64
import os
import time
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
from google import genai as genai_new
from google.genai import types

reel_bp = Blueprint('reel', __name__, url_prefix='/api/reel')


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
            if text_to_parse.startswith('```json'):
                text_to_parse = text_to_parse[7:].strip()
            elif text_to_parse.startswith('```'):
                text_to_parse = text_to_parse[3:].strip()
        
        return json.loads(text_to_parse)
    except Exception as e:
        print(f"Failed to parse JSON: {e}")
        return fallback


def is_video_model(model: str) -> bool:
    """判断模型是否为视频模型"""
    return 'veo' in model.lower()


@reel_bp.route('/creative-director', methods=['POST'])
@verify_firebase_token
def creative_director():
    """
    创意总监：分析用户意图并决定下一步动作（统一处理图片和视频）
    
    Request: {
        "userPrompt": string,
        "selectedModel": string,
        "assets": Record<string, ReelAsset>,
        "selectedAssetId": string | null,
        "lastGeneratedAssetId": string | null,
        "messages": ReelMessage[],
        "hasUploadedFiles": boolean
    }
    Response: {
        "action": 'NEW_ASSET' | 'EDIT_ASSET' | 'ANSWER_QUESTION' | 'MODEL_MISMATCH',
        "prompt": string,
        "reasoning": string,
        "targetAssetId"?: string,
        "suggestedModel"?: string
    }
    """
    import time
    start_time = time.time()
    uid = getattr(request, 'uid', 'unknown')
    
    try:
        print(f"\n{'='*60}")
        print(f"[API] Creative Director Request")
        print(f"[API] User: {uid}")
        print(f"[API] Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}")
        
        data = request.get_json()
        if not data or 'userPrompt' not in data:
            print(f"[API] ❌ Error: Missing 'userPrompt' in request body")
            return jsonify({"error": "Missing 'userPrompt' in request body"}), 400
        
        user_prompt = data['userPrompt']
        selected_model = data.get('selectedModel', 'banana')
        assets = data.get('assets', {})
        selected_asset_id = data.get('selectedAssetId')
        last_generated_asset_id = data.get('lastGeneratedAssetId')
        messages = data.get('messages', [])
        has_uploaded_files = data.get('hasUploadedFiles', False)
        
        print(f"[API] Prompt: {user_prompt[:100]}..." if len(user_prompt) > 100 else f"[API] Prompt: {user_prompt}")
        print(f"[API] Model: {selected_model}")
        print(f"[API] Assets count: {len(assets)}")
        print(f"[API] Has uploaded files: {has_uploaded_files}")
        
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            print(f"[API] ❌ Error: Failed to get Gemini service")
            return error_response
        
        # 检查模型不匹配（仅在无上传文件时）
        if not has_uploaded_files:
            current_modality = 'VIDEO' if is_video_model(selected_model) else 'IMAGE'
            check_prompt = f"""
You are a specialized Intent Classifier for a creative AI tool.
Your ONLY job is to detect if the User's Prompt CONTRADICTS the Current Selected Model Modality.

Current Model Modality: {current_modality}
User Prompt: "{user_prompt}"

Rules:
1. If User Prompt clearly asks for VIDEO (e.g. "drone shot", "moving", "animation", "pan", "zoom", "video", "clip") AND Current Modality is IMAGE -> Mismatch = TRUE.
2. If User Prompt clearly asks for IMAGE (e.g. "logo", "icon", "poster", "picture", "photo", "static") AND Current Modality is VIDEO -> Mismatch = TRUE.
3. Otherwise (ambiguous or matching) -> Mismatch = FALSE.

Return JSON: {{ "mismatch": boolean, "suggestedModel": "veo_fast" | "banana", "reasoning": "string (in Chinese)" }}
"""
            try:
                check_response = gemini.generate_content(check_prompt, model='gemini-2.5-flash')
                check_text = safe_get_text(check_response)
                check_result = safe_json_parse(check_text, {})
                
                if check_result.get('mismatch') and check_result.get('suggestedModel'):
                    return jsonify({
                        'action': 'MODEL_MISMATCH',
                        'prompt': user_prompt,
                        'reasoning': check_result.get('reasoning', '检测到您的需求与当前模型不匹配。'),
                        'suggestedModel': check_result.get('suggestedModel')
                    })
            except Exception as e:
                print(f"Modality check failed, proceeding: {e}")
        
        # 根据模型类型选择处理逻辑
        if is_video_model(selected_model):
            # 视频模型逻辑
            safe_selected_id = (selected_asset_id and assets.get(selected_asset_id, {}).get('type') == 'video') if selected_asset_id else None
            safe_last_id = (last_generated_asset_id and assets.get(last_generated_asset_id, {}).get('type') == 'video') if last_generated_asset_id else None
            
            # 构建历史记录
            history_lines = []
            for msg in messages[-4:]:
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                if isinstance(content, str):
                    history_lines.append(f"{role}: {content}")
                else:
                    msg_type = msg.get('type', 'unknown')
                    history_lines.append(f"{role}: [{msg_type} message]")
            history_for_prompt = '\n'.join(history_lines)
            
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
- Explicitly Selected Video ID: {safe_selected_id or 'None'}
- Last Generated Video ID: {safe_last_id or 'None'}
- Recent Chat:
{history_for_prompt}
- User Request: "{user_prompt}"

**Logic**:
1. **EDIT_VIDEO**: If the user wants to change, modify, extend, or iterate on a video (e.g., "make it faster", "change style to claymation", "redo this"), the action is EDIT_VIDEO.
2. **NEW_VIDEO**: If the user wants a completely new subject or scene (e.g., "show me a cat instead", "create a video of space").
3. **ANSWER_QUESTION**: If it's a general question or conversational remark.

**Output**: Call 'video_creative_director_action'.
- `action`: "EDIT_VIDEO" | "NEW_VIDEO" | "ANSWER_QUESTION"
- `prompt`: The refined video generation prompt (or text answer).
- `reasoning`: Brief explanation in Chinese (e.g., "好的，基于上一条视频为您调整风格...").
- `targetVideoId`: The ID of the video to edit/reference (if action is EDIT_VIDEO).
"""
            
            try:
                response = gemini.generate_content_with_function_calling(prompt, [creative_director_tool], model='gemini-2.5-pro')
            except Exception as e:
                error_str = str(e)
                if 'location is not supported' in error_str.lower() or 'FailedPrecondition' in error_str:
                    return jsonify({
                        "error": "API location restriction",
                        "message": "Your location is not supported for this API.",
                        "action": "ANSWER_QUESTION",
                        "prompt": "抱歉，由于 API 的地理位置限制，视频生成功能在您所在的地区暂不可用。",
                        "reasoning": "检测到地理位置限制"
                    }), 200
                raise
            
            # 解析函数调用响应
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
                    action = args.get('action', 'NEW_VIDEO')
                    result = {
                        'action': 'NEW_ASSET' if action == 'NEW_VIDEO' else ('EDIT_ASSET' if action == 'EDIT_VIDEO' else 'ANSWER_QUESTION'),
                        'prompt': args.get('prompt', user_prompt),
                        'reasoning': args.get('reasoning', '好的，正在为您处理视频请求。')
                    }
                    if 'targetVideoId' in args:
                        result['targetAssetId'] = args['targetVideoId']
                    return jsonify(result)
            
            # Fallback
            return jsonify({
                'action': 'NEW_ASSET',
                'prompt': user_prompt,
                'reasoning': '好的，正在为您生成关于"{user_prompt}"的视频。'
            })
        else:
            # 图片模型逻辑
            safe_selected_id = (selected_asset_id and assets.get(selected_asset_id, {}).get('type') == 'image') if selected_asset_id else None
            safe_last_id = (last_generated_asset_id and assets.get(last_generated_asset_id, {}).get('type') == 'image') if last_generated_asset_id else None
            
            # 构建历史记录
            history_lines = []
            for msg in messages[-4:]:
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                if isinstance(content, str):
                    history_lines.append(f"{role}: {content}")
                else:
                    msg_type = msg.get('type', 'unknown')
                    history_lines.append(f"{role}: [{msg_type} message]")
            history_for_prompt = '\n'.join(history_lines)
            
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
                            'description': 'If the action is "EDIT_IMAGE", this is the ID of the image that should be edited.'
                        }
                    },
                    'required': ['action', 'prompt', 'reasoning']
                }
            }
            
            prompt = f"""
You are an AI Creative Director. Your job is to analyze the user's request in the context of an image creation session and decide the next action.

**Current Context**:
- Explicitly Selected Image ID: {safe_selected_id or 'None'}
- Most Recently Generated Image ID: {safe_last_id or 'None'}
- Recent Conversation History:
{history_for_prompt}
- User's Latest Request: "{user_prompt}"

**Your Logic & Rules**:
1. **Prioritize Editing**: If an image is explicitly selected OR if the request is a clear follow-up modification to the last generated image (e.g., "change the background", "make it blue"), the action MUST be **EDIT_IMAGE**.
2. **Answer Question**: If the user is asking a question or making a comment that doesn't seem to be an image request (e.g., "what can you do?", "that's cool"), the action is **ANSWER_QUESTION**.
3. **Default to New Creation**: For any other creative request that is not an edit or a question, the action is **NEW_CREATION**.

Based on this logic, call the 'creative_director_action' function with your decision. The 'reasoning' should be a short, friendly, and contextual message in Chinese to the user explaining your understanding.
"""
            
            response = gemini.generate_content_with_function_calling(prompt, [creative_director_tool], model='gemini-2.5-pro')
            
            # 解析函数调用响应
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
                    action = args.get('action', 'NEW_CREATION')
                    result = {
                        'action': 'NEW_ASSET' if action == 'NEW_CREATION' else ('EDIT_ASSET' if action == 'EDIT_IMAGE' else 'ANSWER_QUESTION'),
                        'prompt': args.get('prompt', user_prompt),
                        'reasoning': args.get('reasoning', '好的，正在为您处理图片请求。')
                    }
                    if 'targetImageId' in args:
                        result['targetAssetId'] = args['targetImageId']
                    return jsonify(result)
            
            # Fallback
            result = {
                'action': 'NEW_ASSET',
                'prompt': user_prompt,
                'reasoning': '好的，正在为您创作一张关于"{user_prompt}"的图片。'
            }
            duration = time.time() - start_time
            print(f"[API] ✅ Success: {result['action']} (Fallback)")
            print(f"[API] Duration: {duration:.2f}s")
            print(f"{'='*60}\n")
            return jsonify(result)
    
    except Exception as e:
        duration = time.time() - start_time
        error_str = str(e)
        print(f"[API] ❌ Error in creative_director after {duration:.2f}s: {error_str}")
        import traceback
        traceback.print_exc()
        print(f"{'='*60}\n")
        
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


@reel_bp.route('/generate', methods=['POST'])
@verify_firebase_token
def generate():
    """
    生成 Reel 资产（图片或视频）
    
    Request: {
        "prompt": string,
        "model": 'banana' | 'banana_pro' | 'veo_fast' | 'veo_gen',
        "images": [{"data": string, "mimeType": string}],
        "aspectRatio": '9:16',
        "sourceAssetId"?: string
    }
    """
    import time
    start_time = time.time()
    uid = getattr(request, 'uid', 'unknown')
    
    try:
        print(f"\n{'='*60}")
        print(f"[API] Generate Asset Request")
        print(f"[API] User: {uid}")
        print(f"[API] Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}")
        
        data = request.get_json()
        if not data or 'prompt' not in data:
            print(f"[API] ❌ Error: Missing 'prompt' in request body")
            return jsonify({"error": "Missing 'prompt' in request body"}), 400
        
        prompt = data['prompt']
        model = data.get('model', 'banana')
        images = data.get('images', [])
        aspect_ratio = data.get('aspectRatio', '9:16')
        source_asset_id = data.get('sourceAssetId')
        
        print(f"[API] Prompt: {prompt[:100]}..." if len(prompt) > 100 else f"[API] Prompt: {prompt}")
        print(f"[API] Model: {model}")
        print(f"[API] Aspect Ratio: {aspect_ratio}")
        print(f"[API] Images count: {len(images)}")
        print(f"[API] Source Asset ID: {source_asset_id or 'None'}")
        
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            print(f"[API] ❌ Error: Failed to get Gemini service")
            return error_response
        
        # 判断是图片还是视频
        if is_video_model(model):
            print(f"[API] 🎬 Generating VIDEO with model: {model}")
            # 视频生成逻辑
            api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
            if not api_key:
                print(f"[API] ❌ Error: API Key is missing")
                return jsonify({"error": "API Key is missing"}), 500
            
            actual_model = 'veo-3.1-generate-preview'
            print(f"[API] Using Veo model: {actual_model}")
            
            try:
                client = genai_new.Client(api_key=api_key)
                print(f"[API] ✅ Gen AI client initialized")
            except Exception as e:
                print(f"[API] ❌ Failed to initialize Gen AI client: {e}")
                import traceback
                traceback.print_exc()
                return jsonify({"error": f"Failed to initialize SDK client: {str(e)}"}), 500
            
            # 处理图片输入
            base_interpol_image = None
            last_frame_image = None
            
            if images and len(images) > 0:
                print(f"[API] Processing {len(images)} input image(s)")
                image_data_str = images[0]['data']
                image_mime_type = images[0].get('mimeType', 'image/jpeg')
                
                try:
                    image_bytes = base64.b64decode(image_data_str)
                    print(f"[API] ✅ Decoded base image ({len(image_bytes)} bytes, {image_mime_type})")
                except Exception as e:
                    print(f"[API] ⚠️ Error decoding base image: {e}")
                    image_bytes = base64.b64decode(image_data_str) if isinstance(image_data_str, str) else image_data_str
                
                base_interpol_image = types.Image(
                    image_bytes=image_bytes,
                    mime_type=image_mime_type
                )
                
                # 处理尾帧
                if len(images) >= 2:
                    print(f"[API] Processing last frame image")
                    last_frame_data_str = images[1]['data']
                    last_frame_mime_type = images[1].get('mimeType', 'image/jpeg')
                    try:
                        last_frame_bytes = base64.b64decode(last_frame_data_str)
                        print(f"[API] ✅ Decoded last frame ({len(last_frame_bytes)} bytes, {last_frame_mime_type})")
                    except Exception as e:
                        print(f"[API] ⚠️ Error decoding last frame: {e}")
                        last_frame_bytes = base64.b64decode(last_frame_data_str) if isinstance(last_frame_data_str, str) else last_frame_data_str
                    
                    last_frame_image = types.Image(
                        image_bytes=last_frame_bytes,
                        mime_type=last_frame_mime_type
                    )
            else:
                print(f"[API] No input images, generating from text prompt only")
            
            config = types.GenerateVideosConfig(
                numberOfVideos=1,
                durationSeconds=8,
                aspectRatio=aspect_ratio,
                negativePrompt='',
            )
            
            if last_frame_image:
                config.last_frame = last_frame_image
            
            try:
                print(f"[API] 🚀 Starting video generation...")
                if base_interpol_image:
                    print(f"[API] Using image-based generation")
                    operation = client.models.generate_videos(
                        model=actual_model,
                        prompt=prompt,
                        image=base_interpol_image,
                        config=config
                    )
                else:
                    print(f"[API] Using text-only generation")
                    operation = client.models.generate_videos(
                        model=actual_model,
                        prompt=prompt,
                        config=config
                    )
                print(f"[API] ✅ Video generation operation started")
            except Exception as e:
                print(f"[API] ❌ Failed to start video generation: {e}")
                import traceback
                traceback.print_exc()
                return jsonify({"error": f"Failed to start video generation: {str(e)}"}), 500
            
            # 轮询操作直到完成
            print(f"[API] ⏳ Polling operation status...")
            poll_count = 0
            while not operation.done:
                poll_count += 1
                time.sleep(5)
                print(f"[API] Poll #{poll_count}... (waiting for completion)")
                try:
                    operation = client.operations.get(operation)
                except Exception as e:
                    print(f"[API] ❌ Failed to poll operation: {e}")
                    import traceback
                    traceback.print_exc()
                    return jsonify({"error": f"Failed to poll operation: {str(e)}"}), 500
            
            print(f"[API] ✅ Operation completed after {poll_count} polls")
            
            # 获取生成的视频
            if hasattr(operation, 'error') and operation.error:
                print(f"[API] ❌ Video generation error: {operation.error}")
                return jsonify({"error": f"Video generation failed: {operation.error}"}), 500
            
            if not hasattr(operation, 'response') or not operation.response:
                print(f"[API] ❌ No response from video generation")
                return jsonify({"error": "No response from video generation"}), 500
            
            generated_videos = operation.response.generated_videos
            if not generated_videos or len(generated_videos) == 0:
                print(f"[API] ❌ No videos generated in response")
                return jsonify({"error": "No videos generated"}), 500
            
            video = generated_videos[0].video
            video_uri = video.uri if hasattr(video, 'uri') else (video.url if hasattr(video, 'url') else str(video))
            
            if not video_uri:
                print(f"[API] ❌ No video URI in response")
                return jsonify({"error": "No video URI returned"}), 500
            
            print(f"[API] ✅ Video URI obtained: {video_uri[:100]}...")
            
            # 构建签名 URL
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
                separator = '&' if '?' in video_uri else '?'
                final_video_uri = f"{video_uri}{separator}key={api_key}"
            
            asset_id = f"reel-vid-{int(time.time() * 1000)}"
            duration = time.time() - start_time
            print(f"[API] ✅ Video generation completed successfully")
            print(f"[API] Asset ID: {asset_id}")
            print(f"[API] Duration: {duration:.2f}s")
            print(f"{'='*60}\n")
            return jsonify({
                "assetId": asset_id,
                "type": "video",
                "src": final_video_uri,
                "prompt": prompt,
                "width": 512,
                "height": 896,
                "status": "done",
                "generationModel": model
            })
        else:
            # 图片生成逻辑
            print(f"[API] 🖼️ Generating IMAGE with model: {model}")
            model_level = 'banana_pro' if model == 'banana_pro' else 'banana'
            print(f"[API] Model level: {model_level}")
            
            # 准备输入图片
            image_parts = []
            for img in images:
                image_parts.append({
                    'data': img.get('data', ''),
                    'mimeType': img.get('mimeType', 'image/jpeg')
                })
            
            if image_parts:
                print(f"[API] Using {len(image_parts)} input image(s)")
            else:
                print(f"[API] Generating from text prompt only")
            
            print(f"[API] 🚀 Starting image generation...")
            try:
                base64_image = gemini.generate_image_with_aspect_ratio(
                    prompt=prompt,
                    images=image_parts if image_parts else None,
                    aspect_ratio=aspect_ratio,
                    model_level=model_level
                )
                print(f"[API] ✅ Image generated successfully ({len(base64_image)} chars)")
            except Exception as e:
                print(f"[API] ❌ Image generation failed: {e}")
                import traceback
                traceback.print_exc()
                raise
            
            asset_id = f"reel-img-{int(time.time() * 1000)}"
            duration = time.time() - start_time
            print(f"[API] ✅ Image generation completed successfully")
            print(f"[API] Asset ID: {asset_id}")
            print(f"[API] Duration: {duration:.2f}s")
            print(f"{'='*60}\n")
            return jsonify({
                "assetId": asset_id,
                "type": "image",
                "src": f"data:image/jpeg;base64,{base64_image}",
                "prompt": prompt,
                "width": 512,
                "height": 896,
                "status": "done",
                "generationModel": model
            })
    
    except Exception as e:
        duration = time.time() - start_time
        error_str = str(e)
        print(f"[API] ❌ Error in generate after {duration:.2f}s: {error_str}")
        import traceback
        traceback.print_exc()
        print(f"{'='*60}\n")
        
        # 处理地理位置限制错误
        if 'location is not supported' in error_str.lower() or 'FailedPrecondition' in error_str:
            return jsonify({
                "error": "API location restriction",
                "message": "Your location is not supported for this API.",
                "action": "ANSWER_QUESTION",
                "prompt": "抱歉，由于 API 的地理位置限制，生成功能在您所在的地区暂不可用。",
                "reasoning": "检测到地理位置限制"
            }), 200
        
        return jsonify({"error": str(e)}), 500


@reel_bp.route('/enhance-prompt', methods=['POST'])
@verify_firebase_token
def enhance_prompt():
    """
    优化提示词
    
    Request: { "prompt": string, "model": string }
    Response: EnhancedPrompt[] // Array of {title, description, tags, fullPrompt}
    """
    try:
        data = request.get_json()
        if not data or 'prompt' not in data:
            return jsonify({"error": "Missing 'prompt' in request body"}), 400
        
        prompt = data['prompt']
        model = data.get('model', 'banana')
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        if is_video_model(model):
            # 视频提示词优化
            system_instruction = """You are a Senior VEO 3.1 Prompt Specialist & Cinematic Director. Your task is to transform a user's basic idea into three distinct, professional creative directions for high-end video generation.

The Veo model requires specific prompt engineering to achieve the best results. You must strictly follow these VEO Golden Rules in your `fullPrompt`:
1. **Subject & Action**: Describe fluid motion, physics, and specific activities clearly (not just who, but *what* they are doing dynamically).
2. **Environment & Lighting**: Include atmospheric details (e.g., volumetric fog, golden hour, cinematic lighting, HDR, neon noir).
3. **Camera Language**: MANDATORY. Use specific cinematic terms (e.g., Drone FPV, Low angle, Dolly zoom, Slow pan, Handheld shake, Bokeh, Rack focus).
4. **Style & Aesthetics**: Specify film stock, render engine, or artistic style (e.g., 35mm film grain, Photorealistic, 8k, Unreal Engine 5 style).

Based on the user's idea, generate three distinct "Video Concept Cards" that tell a story:
- **Option A (Realistic/Cinematic)**: Focus on photorealism, movie-like quality, high-end production value (ARRI/IMAX aesthetics).
- **Option B (Creative/Stylized)**: Focus on unique art styles, animation (e.g., claymation, cyber-anime), or surreal visuals.
- **Option C (Dynamic/Action)**: Focus on speed, intense motion, fast cuts, and visual impact.

For each card, provide:
1. `title`: A short, catchy title (e.g., "Neon Drift: Cyberpunk").
2. `description`: A one-sentence summary of the narrative and visual mood.
3. `tags`: An array of 3-4 relevant keyword tags.
4. `fullPrompt`: A comprehensive, detailed prompt using the VEO Golden Rules above.

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
        else:
            # 图片提示词优化
            system_instruction = "You are an expert AI Art Director. Your task is to transform a user's basic idea into three distinct, professional creative directions. You must return a valid JSON array of objects."
        
        user_content = f"""
The user's idea is: "{prompt}"

Based on this idea, generate three distinct "Prompt Optimization Cards". For each card, provide:
1. `title`: A short, catchy title for the creative direction (e.g., "Cinematic Portrait", "Retro Anime Style").
2. `description`: A one-sentence summary of the style and mood.
3. `tags`: An array of 3-4 relevant keyword tags (e.g., ["close-up", "golden hour", "shallow depth of field"]).
4. `fullPrompt`: A complete, detailed, and enhanced prompt for the 'gemini-2.5-flash-image' model that fully realizes the creative direction.

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


@reel_bp.route('/design-plan', methods=['POST'])
@verify_firebase_token
def design_plan():
    """
    获取设计灵感方案
    
    Request: { "topic": string, "model": string }
    Response: DesignPlan[] // Array of {title, description, prompt, referenceImagePrompt}
    """
    try:
        data = request.get_json()
        if not data or 'topic' not in data:
            return jsonify({"error": "Missing 'topic' in request body"}), 400
        
        topic = data['topic']
        model = data.get('model', 'banana')
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        if is_video_model(model):
            # 视频设计灵感
            research_prompt = f"""
Act as an AI Cinematography & Motion Trend Researcher.
Conduct a deep dive search on Google for the topic: "{topic}".

Do NOT just search for general definitions. You must find:
1. **Cinematic Lighting Trends** relevant to this topic (e.g., Volumetric lighting, Rembrandt, Neon noir).
2. **Camera Movement Trends** (e.g., FPV Drone, Dolly Zoom, Orbit shot, Handheld).
3. **Motion Aesthetics** (e.g., Slow motion fluid, Hyper-lapse, Morphing).
4. **Render/Visual Styles** (e.g., Unreal Engine 5, Analog film grain, Claymation).

Detect the language of the topic (Chinese or English). Provide a concise but technical summary in that same language, focusing on "How to shoot it" rather than just "What it is".
"""
            try:
                research_response = gemini.generate_content_with_google_search(research_prompt, model='gemini-2.5-flash')
            except Exception:
                research_response = gemini.generate_content(research_prompt, model='gemini-2.5-flash')
            
            research_summary = safe_get_text(research_response)
            
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
1. `title`: Creative title.
2. `description`: Brief visual summary.
3. `referenceImagePrompt`: **CRITICAL**: This must describe a single **KEYFRAME** (First Frame) composition. Use terms like "A still shot of...", "Hyper-realistic photography of...", "Golden ratio composition". Do not describe motion here, only the static visual start point.
4. `prompt`: The video generation prompt. Must follow the **[Subject + Action + Environment + Lighting + Camera + Style]** formula. Include specific camera moves (e.g., "Slow dolly in") and temporal details.

Output: A valid JSON array of 3 objects. Use the same language as the input topic.
"""
        else:
            # 图片设计灵感
            research_prompt = f"""
As an AI Art Director and visual trend researcher, research current visual trends, popular aesthetics, color palettes, and best practices related to the topic: "{topic}".
Detect the language of the topic (Chinese or English) and provide your findings as a detailed text summary in that same language.
"""
            research_response = gemini.generate_content(research_prompt, model='gemini-2.5-flash')
            research_summary = safe_get_text(research_response)
            
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


@reel_bp.route('/upscale', methods=['POST'])
@verify_firebase_token
def upscale():
    """
    高清放大图片
    
    Request: { "base64Data": string, "mimeType": string, "factor": 2 | 4, "prompt": string }
    Response: { "base64Image": string }
    """
    try:
        data = request.get_json()
        if not data or 'base64Data' not in data or 'prompt' not in data:
            return jsonify({"error": "Missing required fields"}), 400
        
        base64_data = data['base64Data']
        mime_type = data.get('mimeType', 'image/jpeg')
        prompt = data['prompt']
        factor = data.get('factor', 2)
        
        gemini, error_response = get_gemini_service_safe()
        if error_response:
            return error_response
        
        # 使用 Imagen 重新生成高质量版本
        base64_image = gemini.generate_image_with_imagen(
            prompt=prompt,
            aspect_ratio='9:16',  # Reel 固定比例
            number_of_images=1
        )
        
        return jsonify({"base64Image": base64_image})
    
    except Exception as e:
        print(f"Error in upscale: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@reel_bp.route('/remove-background', methods=['POST'])
@verify_firebase_token
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


@reel_bp.route('/reference-image', methods=['POST'])
@verify_firebase_token
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
        
        # 使用 Imagen 生成参考图片
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

