"""
Gemini API Service
封装 Google Gemini API 调用
"""

import os
import google.generativeai as genai
from typing import Optional, Dict, Any, List
from google.generativeai.types import GenerateContentResponse

# 配置 Gemini
# 确保加载 .env 文件
from dotenv import load_dotenv
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

# Support both GEMINI_API_KEY and GOOGLE_API_KEY for compatibility
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# 默认模型 - 使用 gemini-2.5-flash 作为默认（根据用户偏好）
DEFAULT_MODEL = 'gemini-2.5-flash'
PRO_MODEL = 'gemini-2.5-pro'


class GeminiService:
    """Gemini API 服务封装"""
    
    def __init__(self):
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not configured")
        try:
            # 不在初始化时设置 tools，tools 应该在每次调用时传递
            self.model = genai.GenerativeModel(DEFAULT_MODEL)
            self.pro_model = genai.GenerativeModel(PRO_MODEL)
        except Exception as e:
            raise ValueError(f"Failed to initialize Gemini models: {str(e)}")
    
    def generate_content(
        self,
        prompt: str,
        model: str = DEFAULT_MODEL,
        tools: Optional[List[Dict[str, Any]]] = None,
        response_mime_type: Optional[str] = None,
        system_instruction: Optional[str] = None
    ) -> GenerateContentResponse:
        """
        生成内容
        
        Args:
            prompt: 提示词
            model: 模型名称
            tools: 工具列表（如 Google Search）
            response_mime_type: 响应 MIME 类型（如 'application/json'）
            system_instruction: 系统指令
        
        Returns:
            GenerateContentResponse
        """
        # 根据测试，tools 参数在 generate_content 调用时传递会导致冲突
        # 解决方案：在模型初始化时设置 tools
        # 注意：当前版本的 google-generativeai 库不支持 system_instruction 参数
        # 解决方案：将 system_instruction 作为 prompt 的一部分传递
        model_name = PRO_MODEL if model == PRO_MODEL else DEFAULT_MODEL
        selected_model = self.pro_model if model == PRO_MODEL else self.model
        
        # 如果需要 tools，创建新的模型实例
        if tools:
            temp_model = genai.GenerativeModel(model_name, tools=tools)
        else:
            temp_model = selected_model
        
        # 将 system_instruction 添加到 prompt 开头（如果提供）
        final_prompt = prompt
        if system_instruction:
            final_prompt = f"{system_instruction}\n\n{prompt}"
        
        # 调用 generate_content
        # 注意：当前 API 版本不支持 response_mime_type 参数，暂时移除
        return temp_model.generate_content(final_prompt)
    
    def generate_content_with_function_calling(
        self,
        prompt: str,
        function_declarations: List[Dict[str, Any]],
        model: str = DEFAULT_MODEL
    ) -> GenerateContentResponse:
        """
        使用函数调用生成内容
        
        Args:
            prompt: 提示词
            function_declarations: 函数声明列表
            model: 模型名称
        
        Returns:
            GenerateContentResponse
        """
        # 根据 Gemini API，使用 function_declarations (下划线) 而不是 functionDeclarations
        tools = [{'function_declarations': function_declarations}]
        return self.generate_content(prompt, model=model, tools=tools)
    
    def generate_content_with_google_search(
        self,
        prompt: str,
        model: str = DEFAULT_MODEL
    ) -> GenerateContentResponse:
        """
        使用 Google Search 工具生成内容
        
        Args:
            prompt: 提示词
            model: 模型名称
        
        Returns:
            GenerateContentResponse
        """
        # 根据 Gemini API 文档，Google Search 工具的格式
        # 尝试使用 googleSearch (驼峰) 格式
        tools = [{'googleSearch': {}}]
        return self.generate_content(prompt, model=model, tools=tools)
    
    def generate_json(
        self,
        prompt: str,
        model: str = DEFAULT_MODEL
    ) -> Dict[str, Any]:
        """
        生成 JSON 响应
        
        Args:
            prompt: 提示词
            model: 模型名称
        
        Returns:
            JSON 对象
        """
        import json
        try:
            # 使用 response_mime_type 来确保返回 JSON
            response = self.generate_content(
                prompt, 
                model=model,
                response_mime_type='application/json'
            )
        except Exception as e:
            print(f"Error generating JSON with response_mime_type: {e}")
            # 回退到不使用 response_mime_type
            response = self.generate_content(prompt, model=model)
        
        # 安全获取响应文本
        text = ''
        try:
            if hasattr(response, 'text') and response.text:
                text = response.text
            elif hasattr(response, 'candidates') and response.candidates:
                parts = response.candidates[0].content.parts if hasattr(response.candidates[0].content, 'parts') else []
                text_parts = [part.text for part in parts if hasattr(part, 'text')]
                if text_parts:
                    text = ' '.join(text_parts)
        except Exception as e:
            print(f"Error extracting text from response: {e}")
            text = '{}'
        
        if not text:
            text = '{}'
        
        # 清理可能的 markdown 包装
        if text.startswith('```'):
            text = text.split('```')[1]
            if text.startswith('json'):
                text = text[4:]
        
        try:
            return json.loads(text.strip())
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}")
            print(f"Text content: {text[:500]}")
            return {}
    
    def generate_image_with_aspect_ratio(
        self,
        prompt: str,
        images: Optional[List[Dict[str, Any]]] = None,
        aspect_ratio: str = '1:1',
        model_level: str = 'banana'
    ) -> str:
        """
        使用 Gemini 图片生成模型生成图片（支持宽高比）
        
        Args:
            prompt: 文本提示词
            images: 输入图片列表 [{"data": base64_string, "mimeType": "image/jpeg"}]
            aspect_ratio: 宽高比 ('1:1', '16:9', '9:16', '4:3', '3:4', '4:5')
            model_level: 'banana' (gemini-2.5-flash-image) 或 'banana_pro' (gemini-3-pro-image-preview)
        
        Returns:
            base64 编码的图片字符串
        """
        model_name = 'gemini-3-pro-image-preview' if model_level == 'banana_pro' else 'gemini-2.5-flash-image'
        
        try:
            import base64
            
            # 构建 parts - Python SDK 使用不同的格式
            parts = []
            if images:
                for img in images:
                    # 使用 genai 的 Part 对象
                    parts.append({
                        'inline_data': {
                            'mime_type': img.get('mimeType', 'image/jpeg'),
                            'data': img.get('data', '')
                        }
                    })
            # 文本部分直接作为字符串
            parts.append(prompt)
            
            # 创建模型实例 - 尝试在初始化时设置配置
            try:
                # 某些版本的 SDK 可能支持在模型初始化时设置
                image_model = genai.GenerativeModel(
                    model_name,
                    generation_config={
                        'response_modalities': ['IMAGE'],
                        'image_config': {'aspect_ratio': aspect_ratio}
                    }
                )
                response = image_model.generate_content(parts)
            except (TypeError, AttributeError, ValueError) as e:
                # 如果初始化时设置失败，尝试直接调用（让模型自动返回图片）
                print(f"Model init with config failed: {e}, trying simple method")
                image_model = genai.GenerativeModel(model_name)
                # 直接调用，某些模型会自动返回图片
                response = image_model.generate_content(parts)
            
            # 提取图片数据
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'content') and candidate.content:
                    response_parts = getattr(candidate.content, 'parts', [])
                    for part in response_parts:
                        inline_data = None
                        if hasattr(part, 'inline_data') and part.inline_data:
                            inline_data = part.inline_data
                        elif hasattr(part, 'inlineData') and part.inlineData:
                            inline_data = part.inlineData
                        
                        if inline_data:
                            data = inline_data.data if hasattr(inline_data, 'data') else None
                            if data:
                                # 如果是 bytes，转换为 base64 字符串
                                if isinstance(data, bytes):
                                    return base64.b64encode(data).decode('utf-8')
                                elif isinstance(data, str):
                                    # 验证是否是 base64
                                    try:
                                        base64.b64decode(data)
                                        return data
                                    except:
                                        return base64.b64encode(data.encode('utf-8')).decode('utf-8')
            
            raise ValueError("No image data in response")
        except Exception as e:
            print(f"Error generating image with aspect ratio: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def generate_image_with_imagen(
        self,
        prompt: str,
        aspect_ratio: str = '1:1',
        number_of_images: int = 1
    ) -> str:
        """
        使用 Imagen 模型生成图片
        
        Args:
            prompt: 文本提示词
            aspect_ratio: 宽高比
            number_of_images: 生成图片数量
        
        Returns:
            base64 编码的图片字符串
        """
        try:
            import base64
            
            # Python SDK 可能使用不同的 API
            # 尝试使用 genai.GenerativeModel 的 generate_content 方法
            # 对于 Imagen，可能需要使用不同的模型名称或方法
            try:
                # 尝试使用 imagen 模型的 generate_content
                imagen_model = genai.GenerativeModel('imagen-4.0-generate-001')
                response = imagen_model.generate_content(
                    prompt,
                    generation_config={
                        'response_modalities': ['IMAGE'],
                        'image_config': {'aspect_ratio': aspect_ratio}
                    }
                )
                
                # 提取图片数据
                if hasattr(response, 'candidates') and response.candidates:
                    candidate = response.candidates[0]
                    if hasattr(candidate, 'content') and candidate.content:
                        response_parts = getattr(candidate.content, 'parts', [])
                        for part in response_parts:
                            inline_data = None
                            if hasattr(part, 'inline_data') and part.inline_data:
                                inline_data = part.inline_data
                            elif hasattr(part, 'inlineData') and part.inlineData:
                                inline_data = part.inlineData
                            
                            if inline_data:
                                data = inline_data.data if hasattr(inline_data, 'data') else None
                                if data:
                                    if isinstance(data, bytes):
                                        return base64.b64encode(data).decode('utf-8')
                                    elif isinstance(data, str):
                                        try:
                                            base64.b64decode(data)
                                            return data
                                        except:
                                            return base64.b64encode(data.encode('utf-8')).decode('utf-8')
                
                raise ValueError("No image data in response")
            except (TypeError, AttributeError, ValueError) as e:
                # 如果上述方法失败，回退到使用 gemini 图片模型
                print(f"Imagen method failed: {e}, falling back to gemini image model")
                return self.generate_image_with_aspect_ratio(
                    prompt=prompt,
                    images=None,
                    aspect_ratio=aspect_ratio,
                    model_level='banana_pro'  # 使用 pro 模型作为 fallback
                )
        except Exception as e:
            print(f"Error generating image with Imagen: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def generate_image_with_modality(
        self,
        prompt: str,
        image_data: str,
        mime_type: str = 'image/jpeg'
    ) -> str:
        """
        使用图片模态生成（用于背景去除等任务）
        
        Args:
            prompt: 文本提示词
            image_data: base64 编码的图片数据
            mime_type: 图片 MIME 类型
        
        Returns:
            base64 编码的图片字符串
        """
        try:
            import base64
            
            model_name = 'gemini-2.5-flash-image'
            image_model = genai.GenerativeModel(model_name)
            
            parts = [
                {
                    'inline_data': {
                        'mime_type': mime_type,
                        'data': image_data
                    }
                },
                prompt
            ]
            
            # 配置生成参数 - 尝试在模型初始化时设置
            try:
                image_model = genai.GenerativeModel(
                    model_name,
                    generation_config={
                        'response_modalities': ['IMAGE']
                    }
                )
                response = image_model.generate_content(parts)
            except (TypeError, AttributeError, ValueError) as e:
                # 如果初始化时设置失败，尝试直接调用
                print(f"Model init with config failed: {e}, trying simple method")
                image_model = genai.GenerativeModel(model_name)
                response = image_model.generate_content(parts)
            
            # 提取图片数据
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'content') and candidate.content:
                    response_parts = getattr(candidate.content, 'parts', [])
                    for part in response_parts:
                        inline_data = None
                        if hasattr(part, 'inline_data') and part.inline_data:
                            inline_data = part.inline_data
                        elif hasattr(part, 'inlineData') and part.inlineData:
                            inline_data = part.inlineData
                        
                        if inline_data:
                            data = inline_data.data if hasattr(inline_data, 'data') else None
                            if data:
                                if isinstance(data, bytes):
                                    return base64.b64encode(data).decode('utf-8')
                                elif isinstance(data, str):
                                    try:
                                        base64.b64decode(data)
                                        return data
                                    except:
                                        return base64.b64encode(data.encode('utf-8')).decode('utf-8')
            
            raise ValueError("No image data in response")
        except Exception as e:
            print(f"Error generating image with modality: {e}")
            import traceback
            traceback.print_exc()
            raise


# 全局实例
_gemini_service: Optional[GeminiService] = None

def get_gemini_service() -> GeminiService:
    """获取 Gemini 服务实例（单例）"""
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service

def get_gemini_service_safe():
    """安全获取 Gemini 服务，返回 (service, error_response)"""
    try:
        return get_gemini_service(), None
    except ValueError as e:
        from flask import jsonify
        return None, (jsonify({"error": str(e)}), 500)

