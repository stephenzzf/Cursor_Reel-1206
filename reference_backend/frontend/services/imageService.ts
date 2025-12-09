/**
 * Image Generation Service
 * 调用后端 API 进行图片生成相关操作
 */

import { EnhancedPrompt, ImageMessage } from '../types';

// DesignPlanWithImagePrompt 接口定义
export interface DesignPlanWithImagePrompt {
  title: string;
  description: string;
  prompt: string; // The prompt for the FINAL image
  referenceImagePrompt: string; // The prompt for the preview image
}

const API_BASE = '/api/image';

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
 * 创意总监：分析用户意图并决定下一步动作
 */
export const getCreativeDirectorAction = async (
    userPrompt: string,
    selectedImageId: string | null,
    lastGeneratedImageId: string | null,
    chatHistory: ImageMessage[]
): Promise<{ action: string; prompt: string; reasoning: string; targetImageId?: string; }> => {
    return fetchAPI('/creative-director', {
        userPrompt,
        selectedImageId,
        lastGeneratedImageId,
        chatHistory
    });
};

/**
 * 生成图片
 */
export const generateImage = async (
    prompt: string,
    images: { data: string; mimeType: string }[],
    aspectRatio: string = '1:1',
    modelLevel: 'banana' | 'banana_pro' = 'banana'
): Promise<{ base64Image: string }> => {
    return fetchAPI('/generate', {
        prompt,
        images,
        aspectRatio,
        modelLevel
    });
};

/**
 * 优化提示词
 */
export const enhancePrompt = async (prompt: string): Promise<EnhancedPrompt[]> => {
    return fetchAPI('/enhance-prompt', { prompt });
};

/**
 * 获取设计灵感方案
 */
export const getDesignPlan = async (topic: string): Promise<DesignPlanWithImagePrompt[]> => {
    return fetchAPI('/design-plan', { topic });
};

/**
 * 生成参考图片
 */
export const generateReferenceImage = async (prompt: string): Promise<{ base64Image: string }> => {
    return fetchAPI('/reference-image', { prompt });
};

/**
 * 高清放大图片
 */
export const upscaleImage = async (
    base64Data: string,
    mimeType: string,
    factor: number,
    prompt: string
): Promise<{ base64Image: string }> => {
    return fetchAPI('/upscale', {
        base64Data,
        mimeType,
        factor,
        prompt
    });
};

/**
 * 总结提示词为简短标题
 */
export const summarizePrompt = async (prompt: string): Promise<string> => {
    const result = await fetchAPI<{ summary: string }>('/summarize-prompt', { prompt });
    return result.summary;
};

/**
 * 去除背景
 */
export const removeBackground = async (
    base64Data: string,
    mimeType: string
): Promise<{ base64Image: string }> => {
    return fetchAPI('/remove-background', {
        base64Data,
        mimeType
    });
};

/**
 * 生成灵感图片
 */
export const generateInspirationImage = async (fullPrompt: string): Promise<string> => {
    const result = await fetchAPI<{ base64Image: string }>('/inspiration', { prompt: fullPrompt });
    return result.base64Image;
};

