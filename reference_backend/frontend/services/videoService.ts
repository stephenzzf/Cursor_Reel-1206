/**
 * Video Generation Service
 * 调用后端 API 进行视频生成相关操作
 */

import { EnhancedPrompt, VideoMessage } from '../types';

const API_BASE = '/api/video';

async function fetchAPI<T>(endpoint: string, body: any): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

/**
 * 优化提示词 (VEO 3.1 专家)
 */
export const enhancePrompt = async (prompt: string): Promise<EnhancedPrompt[]> => {
    return fetchAPI('/enhance-prompt', { prompt });
};

/**
 * 获取设计灵感方案
 */
export const getDesignPlan = async (topic: string): Promise<any[]> => {
    return fetchAPI('/design-plan', { topic });
};

/**
 * 创意总监：分析用户意图并决定下一步动作
 */
export const getVideoCreativeDirectorAction = async (
    userPrompt: string,
    chatHistory: VideoMessage[],
    selectedVideoId: string | null,
    lastGeneratedVideoId: string | null
): Promise<{ action: string; prompt: string; reasoning: string; targetVideoId?: string; }> => {
    return fetchAPI('/creative-director', {
        userPrompt,
        chatHistory,
        selectedVideoId,
        lastGeneratedVideoId
    });
};

/**
 * 生成视频
 */
export const generateVideo = async (
    prompt: string,
    images: { data: string; mimeType: string }[],
    aspectRatio: '16:9' | '9:16',
    modelName: 'veo_fast' | 'veo_gen' = 'veo_fast'
): Promise<{ videoUri: string }> => {
    const result = await fetchAPI<{ videoUri: string }>('/generate', {
        prompt,
        images,
        aspectRatio,
        modelName
    });

    // 尝试将 URL 转换为 blob 以避免 CORS 问题
    if (result.videoUri && result.videoUri.startsWith('http')) {
        try {
            const videoRes = await fetch(result.videoUri, {
                referrerPolicy: 'no-referrer'
            });
            if (videoRes.ok) {
                const blob = await videoRes.blob();
                return { videoUri: URL.createObjectURL(blob) };
            }
        } catch (error) {
            console.warn("CORS/Fetch failed for video, using raw URI.", error);
        }
    }

    return result;
};

/**
 * 总结提示词为简短标题
 */
export const summarizePrompt = async (prompt: string): Promise<string> => {
    const result = await fetchAPI<{ summary: string }>('/summarize-prompt', { prompt });
    return result.summary;
};

/**
 * 生成参考图片
 */
export const generateReferenceImage = async (prompt: string): Promise<{ base64Image: string }> => {
    return fetchAPI('/reference-image', { prompt });
};

