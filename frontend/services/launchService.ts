/**
 * Launch Service - 启动页面服务
 * 封装启动页面相关的后端 API 调用，自动注入 Firebase ID Token
 * 
 * 注意：如果后端没有对应的端点，需要创建或使用现有逻辑
 */

import { auth } from '../firebaseConfig';

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
    timeout: number = 30000
): Promise<T> {
    const token = await getAuthToken();
    
    if (!token) {
        throw new Error('用户未登录，请先登录');
    }
    
    const url = `${API_BASE_URL}${endpoint}`;
    const method = options.method || 'GET';
    
    console.log(`[LaunchService] ${method} ${url}`);
    
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
            
            console.log(`[LaunchService] Response: ${response.status} (${duration}ms)`);
            
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
                    console.log(`[LaunchService] Retrying... (${attempt}/${retries})`);
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
                    console.log(`[LaunchService] Network error, retrying... (${attempt}/${retries})`);
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
 * 分析用户意图（路由到 SEO/Image/Video）
 * 
 * 注意：如果后端没有此端点，需要创建 `/api/launch/analyze-intent`
 * 或者暂时使用前端逻辑（不推荐，违反架构原则）
 */
export const analyzeUserIntent = async (prompt: string): Promise<{ 
    intent: string; 
    url: string | null; 
    query: string | null 
}> => {
    try {
        // 尝试调用后端 API
        return await apiRequest<{ intent: string; url: string | null; query: string | null }>(
            '/api/launch/analyze-intent',
            {
                method: 'POST',
                body: JSON.stringify({ prompt }),
            },
            3,
            30000
        );
    } catch (error: any) {
        // 如果后端端点不存在，使用前端 fallback 逻辑
        console.warn('[LaunchService] Backend endpoint not available, using fallback logic:', error);
        
        // Fallback: 简单的 URL 检测和关键词匹配
        const urlRegex = /((https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?)/i;
        const urlMatch = prompt.match(urlRegex);
        
        if (urlMatch) {
            return { intent: 'SEO', url: urlMatch[0], query: prompt };
        }
        
        // 视频关键词检测
        const videoKeywords = ['video', '视频', 'movie', 'clip', 'animation', 'motion', 'drone', '航拍', '运镜', '剪辑', '特效', '旋转', '展示', '动效'];
        const hasVideoKeyword = videoKeywords.some(keyword => prompt.toLowerCase().includes(keyword.toLowerCase()));
        
        if (hasVideoKeyword) {
            return { intent: 'VIDEO_GENERATION', url: null, query: prompt };
        }
        
        // 图片关键词检测
        const imageKeywords = ['image', '图片', 'photo', 'picture', 'draw', 'generate', 'logo', 'icon', '摄影', '画', '图', '风格'];
        const hasImageKeyword = imageKeywords.some(keyword => prompt.toLowerCase().includes(keyword.toLowerCase()));
        
        if (hasImageKeyword) {
            return { intent: 'IMAGE_GENERATION', url: null, query: prompt };
        }
        
        // SEO 关键词检测（但没有 URL）
        const seoKeywords = ['seo', 'audit', 'analysis', 'competitor', 'content strategy', 'blog', 'market research', 'audience'];
        const hasSeoKeyword = seoKeywords.some(keyword => prompt.toLowerCase().includes(keyword.toLowerCase()));
        
        if (hasSeoKeyword) {
            // 即使有 SEO 关键词，如果没有 URL，也返回 OTHER
            return { intent: 'OTHER', url: null, query: prompt };
        }
        
        return { intent: 'OTHER', url: null, query: prompt };
    }
};

/**
 * 生成灵感图片（fallback）
 * 
 * 注意：如果后端没有此端点，可以调用现有的图片生成 API
 * 或者暂时跳过（不推荐）
 */
export const generateInspirationImage = async (fullPrompt: string): Promise<string> => {
    try {
        // 尝试调用后端 API（如果存在）
        const response = await apiRequest<{ base64Image: string }>(
            '/api/launch/generate-inspiration-image',
            {
                method: 'POST',
                body: JSON.stringify({ prompt: fullPrompt }),
            },
            3,
            60000
        );
        return response.base64Image;
    } catch (error: any) {
        // 如果后端端点不存在，使用现有的图片生成 API
        console.warn('[LaunchService] Backend endpoint not available, using image generation API:', error);
        
        try {
            // 调用现有的图片生成 API
            const response = await apiRequest<{ base64Image: string }>(
                '/api/reel/reference-image',
                {
                    method: 'POST',
                    body: JSON.stringify({ 
                        prompt: fullPrompt.replace(/^创建AI图片\s*/, '').replace(/^创建AI视频\s*/, '')
                    }),
                },
                3,
                60000
            );
            return response.base64Image;
        } catch (e) {
            console.error('[LaunchService] Failed to generate inspiration image:', e);
            throw e;
        }
    }
};
