/**
 * Video Service - 视频生成服务
 * 封装所有视频相关的后端 API 调用，自动注入 Firebase ID Token
 */

import { auth } from '../firebaseConfig';
import { VideoMessage, EnhancedPrompt, BrandVisualProfile } from '../types';

// 获取后端 API 基础 URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
    (import.meta.env.PROD ? '' : '');

/**
 * 获取 Firebase ID Token
 */
async function getAuthToken(): Promise<string | null> {
    if (!auth || !auth.currentUser) {
        return null;
    }
    try {
        const token = await auth.currentUser.getIdToken();
        return token;
    } catch (error) {
        console.error('Failed to get auth token:', error);
        return null;
    }
}

/**
 * 通用 API 请求函数
 */
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = 3,
    timeout: number = 300000 // 视频生成默认 5 分钟超时
): Promise<T> {
    const token = await getAuthToken();
    
    if (!token) {
        throw new Error('用户未登录，请先登录');
    }
    
    const url = `${API_BASE_URL}${endpoint}`;
    const method = options.method || 'GET';
    
    console.log(`[VideoService] ${method} ${url}`);
    
    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    ...options.headers,
                },
            });
            
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            
            console.log(`[VideoService] Response: ${response.status} (${duration}ms)`);
            
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
                }
                
                const errorMessage = errorData.error || errorData.message || `服务器错误: ${response.status}`;
                
                // 对于 5xx 错误，尝试重试
                if (response.status >= 500 && attempt < retries) {
                    console.log(`[VideoService] Retrying... (${attempt}/${retries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    continue;
                }
                
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error: any) {
            const duration = Date.now() - startTime;
            
            if (error.name === 'AbortError') {
                throw new Error(`请求超时（${Math.round(timeout / 1000)}秒），请检查网络连接或稍后重试`);
            }
            
            if (error.message?.includes('Failed to fetch') || 
                error.message?.includes('NetworkError')) {
                
                if (attempt < retries) {
                    console.log(`[VideoService] Network error, retrying... (${attempt}/${retries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    continue;
                }
                
                throw new Error(`无法连接到服务器 (${duration}ms)`);
            }
            
            throw error;
        }
    }
    
    throw new Error('请求失败：已达到最大重试次数');
}

/**
 * 安全解析 JSON
 */
function safeJsonParse(jsonString: string, fallback: any): any {
    try {
        let textToParse = jsonString;
        const jsonStartIndex = textToParse.indexOf('{');
        const arrayStartIndex = textToParse.indexOf('[');

        let startIndex = -1;
        let isArray = false;

        if (jsonStartIndex > -1 && arrayStartIndex > -1) {
            if (jsonStartIndex < arrayStartIndex) {
                startIndex = jsonStartIndex;
            } else {
                startIndex = arrayStartIndex;
                isArray = true;
            }
        } else if (jsonStartIndex > -1) {
            startIndex = jsonStartIndex;
        } else if (arrayStartIndex > -1) {
            startIndex = arrayStartIndex;
            isArray = true;
        }

        if (startIndex === -1) {
            throw new Error("No JSON object or array found in the string.");
        }
        
        textToParse = textToParse.substring(startIndex);
        
        const endChar = isArray ? ']' : '}';
        const lastIndex = textToParse.lastIndexOf(endChar);
        if (lastIndex > -1) {
            textToParse = textToParse.substring(0, lastIndex + 1);
        }

        textToParse = textToParse.trim();
        textToParse = textToParse.replace(/,(\s*[}\]])/g, '$1');

        return JSON.parse(textToParse);
    } catch (e) {
        console.error("Failed to parse JSON:", e);
        return fallback;
    }
}

/**
 * 优化提示词
 */
export const enhancePrompt = async (
    prompt: string, 
    model: 'veo_fast' | 'veo_gen',
    activeProfileId?: string
): Promise<EnhancedPrompt[]> => {
    return apiRequest<EnhancedPrompt[]>('/api/reel/enhance-prompt', {
        method: 'POST',
        body: JSON.stringify({ 
            prompt, 
            model,
            activeProfileId 
        }),
    }, 3, 60000); // 60 秒超时
};

/**
 * 获取设计灵感方案
 */
export const getDesignPlan = async (
    topic: string,
    model: 'veo_fast' | 'veo_gen',
    activeProfileId?: string
): Promise<Array<{
    title: string;
    description: string;
    prompt: string;
    referenceImagePrompt: string;
}>> => {
    return apiRequest('/api/reel/design-plan', {
        method: 'POST',
        body: JSON.stringify({ 
            topic, 
            model,
            activeProfileId 
        }),
    }, 3, 60000); // 60 秒超时
};

/**
 * 生成参考图片
 */
export const generateReferenceImage = async (
    prompt: string
): Promise<{ base64Image: string }> => {
    return apiRequest('/api/reel/reference-image', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
    }, 3, 60000); // 60 秒超时
};

/**
 * 获取视频创意总监决策
 */
export const getVideoCreativeDirectorAction = async (
    userPrompt: string,
    chatHistory: VideoMessage[],
    selectedVideoId: string | null,
    lastGeneratedVideoId: string | null,
    hasUploadedFiles?: boolean,
    selectedModel: 'veo_fast' | 'veo_gen' = 'veo_fast'
): Promise<{ 
    action: string; 
    prompt: string; 
    reasoning: string; 
    targetVideoId?: string; 
}> => {
    // 构建 assets 对象（仅包含视频）
    const assets: Record<string, any> = {};
    // 注意：这里需要从外部传入 videos，但为了简化，我们只传递必要的 ID 信息
    // 实际实现中，后端会根据这些 ID 来判断
    
    // 创意总监需要调用 Gemini API，可能需要较长时间，设置 60 秒超时
    return apiRequest('/api/reel/creative-director', {
        method: 'POST',
        body: JSON.stringify({
            userPrompt,
            selectedModel,
            assets,
            selectedAssetId: selectedVideoId,
            lastGeneratedAssetId: lastGeneratedVideoId,
            messages: chatHistory,
            hasUploadedFiles: hasUploadedFiles || false
        }),
    }, 3, 90000); // 90 秒超时
};

/**
 * 生成视频
 */
export const generateVideo = async (
    prompt: string, 
    images: { data: string; mimeType: string }[], 
    aspectRatio: '16:9' | '9:16', 
    modelName: 'veo_fast' | 'veo_gen'
): Promise<{ videoUri: string; rawRemoteUri: string }> => {
    // 调用后端 API
    const response = await apiRequest<{
        assetId: string;
        type: 'video';
        src: string;
        prompt: string;
        width: number;
        height: number;
        status: 'done';
        generationModel: string;
    }>('/api/reel/generate', {
        method: 'POST',
        body: JSON.stringify({
            prompt,
            model: modelName,
            images,
            aspectRatio,
        }),
    }, 3, 300000); // 5 分钟超时（视频生成需要较长时间）
    
    // 返回格式与 reference_AIS 保持一致
    return {
        videoUri: response.src, // 后端返回的 URL 可直接使用
        rawRemoteUri: response.src // 后端已处理持久化
    };
};

/**
 * 总结提示词（用于存档）
 */
export const summarizePrompt = async (prompt: string): Promise<string> => {
    // 简单实现：返回前 20 个字符
    return prompt.substring(0, 20);
};
