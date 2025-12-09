/**
 * Reel API Hook
 * 封装所有后端 API 调用，自动注入 Firebase ID Token
 */

import { auth } from '../firebaseConfig';
import { ReelMessage, ReelAsset, EnhancedPrompt } from '../types';

// 获取后端 API 基础 URL（开发环境或生产环境）
// 在生产环境中，如果前后端部署在同一域名，使用相对路径
// 在开发环境中，使用 localhost:8787
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
    (import.meta.env.PROD ? '' : 'http://localhost:8787');

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
 * 通用 API 请求函数（带重试和详细错误处理）
 * @param timeout 超时时间（毫秒），默认 30 秒
 */
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = 3,
    timeout: number = 30000 // 默认 30 秒，可配置
): Promise<T> {
    const token = await getAuthToken();
    
    if (!token) {
        const error = '用户未登录，请先登录';
        console.error(`[API] ${error}`);
        throw new Error(error);
    }
    
    const url = `${API_BASE_URL}${endpoint}`;
    const method = options.method || 'GET';
    const timeoutSeconds = Math.round(timeout / 1000);
    
    // 日志记录
    console.log(`[API] ${method} ${url} (timeout: ${timeoutSeconds}s)`);
    if (options.body) {
        try {
            const bodyData = JSON.parse(options.body as string);
            console.log(`[API] Request body:`, {
                ...bodyData,
                // 隐藏敏感数据
                images: bodyData.images ? `[${bodyData.images.length} images]` : undefined,
                base64Data: bodyData.base64Data ? `[${bodyData.base64Data.length} chars]` : undefined,
            });
        } catch (e) {
            console.log(`[API] Request body: [non-JSON]`);
        }
    }
    
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
            
            console.log(`[API] Response: ${response.status} ${response.statusText} (${duration}ms)`);
            
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
                }
                
                const errorMessage = errorData.error || errorData.message || `服务器错误: ${response.status}`;
                console.error(`[API] Error response:`, errorData);
                
                // 对于 5xx 错误，尝试重试
                if (response.status >= 500 && attempt < retries) {
                    console.log(`[API] Retrying... (${attempt}/${retries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 递增延迟
                    continue;
                }
                
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            console.log(`[API] Success:`, {
                ...data,
                // 隐藏敏感数据
                base64Image: data.base64Image ? `[${data.base64Image.length} chars]` : undefined,
            });
            
            return data;
            
        } catch (error: any) {
            const duration = Date.now() - startTime;
            
            if (error.name === 'AbortError') {
                const timeoutError = `请求超时（${timeoutSeconds}秒），请检查网络连接或稍后重试`;
                console.error(`[API] Timeout after ${duration}ms (limit: ${timeout}ms)`);
                throw new Error(timeoutError);
            }
            
            if (error.message?.includes('Failed to fetch') || 
                error.message?.includes('NetworkError') ||
                error.message?.includes('Network request failed')) {
                
                if (attempt < retries) {
                    console.log(`[API] Network error, retrying... (${attempt}/${retries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    continue;
                }
                
                const networkError = `无法连接到服务器 (${duration}ms)\n\n请检查：\n1. 后端服务是否运行在 ${API_BASE_URL}\n2. 网络连接是否正常\n3. 防火墙设置\n4. 浏览器控制台是否有 CORS 错误`;
                console.error(`[API] Network error after ${duration}ms:`, error);
                throw new Error(networkError);
            }
            
            // 其他错误直接抛出
            console.error(`[API] Request failed after ${duration}ms:`, error);
            throw error;
        }
    }
    
    // 如果所有重试都失败
    throw new Error('请求失败：已达到最大重试次数');
}

/**
 * 创意总监：分析用户意图并决定下一步动作
 */
export async function getReelCreativeDirectorAction(
    userPrompt: string,
    selectedModel: string,
    assets: Record<string, ReelAsset>,
    selectedAssetId: string | null,
    lastGeneratedAssetId: string | null,
    messages: ReelMessage[],
    hasUploadedFiles: boolean
): Promise<{
    action: 'NEW_ASSET' | 'EDIT_ASSET' | 'ANSWER_QUESTION' | 'MODEL_MISMATCH';
    prompt: string;
    reasoning: string;
    targetAssetId?: string;
    suggestedModel?: string;
}> {
    return apiRequest('/api/reel/creative-director', {
        method: 'POST',
        body: JSON.stringify({
            userPrompt,
            selectedModel,
            assets,
            selectedAssetId,
            lastGeneratedAssetId,
            messages,
            hasUploadedFiles,
        }),
    });
}

/**
 * 生成 Reel 资产（图片或视频）
 */
export async function generateReelAsset(
    prompt: string,
    model: 'banana' | 'banana_pro' | 'veo_fast' | 'veo_gen',
    images: { data: string; mimeType: string }[],
    aspectRatio: '9:16' = '9:16',
    sourceAssetId?: string
): Promise<ReelAsset> {
    // 根据模型类型设置不同的超时时间
    // 视频生成通常需要 30-60 秒，加上轮询时间，需要更长的超时
    // 图片生成通常需要 10-30 秒
    const isVideo = model.includes('veo');
    const timeout = isVideo ? 300000 : 120000; // 视频 5 分钟，图片 2 分钟
    
    console.log(`[API] Generating ${isVideo ? 'video' : 'image'} with timeout: ${timeout / 1000}s`);
    
    const response = await apiRequest<{
        assetId: string;
        type: 'image' | 'video';
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
            model,
            images,
            aspectRatio,
            sourceAssetId,
        }),
    }, 3, timeout); // 传递超时参数
    
    return {
        id: response.assetId,
        type: response.type,
        src: response.src,
        prompt: response.prompt,
        width: response.width,
        height: response.height,
        x: 0,
        y: 0,
        status: response.status,
        generationModel: response.generationModel,
        sourceAssetId,
    };
}

/**
 * 优化提示词
 */
export async function getReelEnhancement(
    prompt: string,
    model: string
): Promise<EnhancedPrompt[]> {
    // 提示词优化需要调用 Gemini API，设置 60 秒超时
    return apiRequest('/api/reel/enhance-prompt', {
        method: 'POST',
        body: JSON.stringify({ prompt, model }),
    }, 3, 60000); // 60 秒超时
}

/**
 * 获取设计灵感方案
 */
export async function getReelDesignPlan(
    topic: string,
    model: string
): Promise<Array<{
    title: string;
    description: string;
    prompt: string;
    referenceImagePrompt: string;
}>> {
    // 设计灵感需要调用 Gemini API，设置 60 秒超时
    return apiRequest('/api/reel/design-plan', {
        method: 'POST',
        body: JSON.stringify({ topic, model }),
    }, 3, 60000); // 60 秒超时
}

/**
 * 高清放大图片
 */
export async function upscaleImage(
    base64Data: string,
    mimeType: string,
    factor: 2 | 4,
    prompt: string
): Promise<{ base64Image: string }> {
    return apiRequest('/api/reel/upscale', {
        method: 'POST',
        body: JSON.stringify({ base64Data, mimeType, factor, prompt }),
    });
}

/**
 * 去除背景
 */
export async function removeBackground(
    base64Data: string,
    mimeType: string
): Promise<{ base64Image: string }> {
    return apiRequest('/api/reel/remove-background', {
        method: 'POST',
        body: JSON.stringify({ base64Data, mimeType }),
    });
}

/**
 * 生成参考图片
 */
export async function generateReferenceImage(
    prompt: string
): Promise<{ base64Image: string }> {
    return apiRequest('/api/reel/reference-image', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
    });
}

