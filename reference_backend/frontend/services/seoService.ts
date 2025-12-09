/**
 * SEO Service
 * 调用后端 API 进行 SEO 相关操作
 */

import {
    SeoDiagnosisReport,
    Competitor,
    CompetitorAnalysisReport,
    SolutionBoard,
    ContentBrief,
    PreflightReport,
    PreflightIssue
} from '../types';

const API_BASE = '/api/seo';

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
 * 分析用户意图
 */
export const analyzeUserIntent = async (
    prompt: string
): Promise<{ intent: string; url: string | null; query: string | null }> => {
    return fetchAPI('/analyze-intent', { prompt });
};

/**
 * SEO 诊断
 */
export const getSeoDiagnosis = async (url: string): Promise<SeoDiagnosisReport> => {
    return fetchAPI('/diagnosis', { url });
};

/**
 * 获取竞争对手列表
 */
export const getCompetitors = async (
    url: string,
    profile: any,
    userInstructions?: string
): Promise<Competitor[]> => {
    return fetchAPI('/competitors', {
        url,
        profile,
        userInstructions,
    });
};

/**
 * 运行竞对分析
 */
export const runCompetitorAnalysis = async (
    competitorsToAnalyze: Competitor[],
    userSiteReport: SeoDiagnosisReport,
    profile: any
): Promise<CompetitorAnalysisReport> => {
    return fetchAPI('/competitor-analysis', {
        competitors: competitorsToAnalyze,
        seoReport: userSiteReport,
        profile,
    });
};

/**
 * 获取解决方案板
 */
export const getSolutionBoard = async (
    url: string,
    competitors: Competitor[],
    analysisReport: CompetitorAnalysisReport,
    profile: any,
    userInstructions?: string
): Promise<SolutionBoard> => {
    return fetchAPI('/solution-board', {
        url,
        competitors,
        analysisReport,
        profile,
        userInstructions,
    });
};

/**
 * 获取预填充内容需求
 */
export const getPrefilledBrief = async (
    solution: any,
    url: string,
    seoReport: SeoDiagnosisReport,
    competitors: Competitor[],
    profile: any,
    userInstructions?: string
): Promise<ContentBrief> => {
    return fetchAPI('/content-brief', {
        solution,
        url,
        seoReport,
        competitors,
        profile,
        userInstructions,
    });
};

/**
 * 运行网络研究
 */
export const runWebResearch = async (brief: ContentBrief): Promise<string> => {
    const result = await fetchAPI<{ summary: string }>('/web-research', { brief });
    return result.summary;
};

/**
 * 生成战略大纲
 */
export const generateStrategicOutline = async (
    researchSummary: string,
    brief: ContentBrief,
    profile: any
): Promise<string[]> => {
    return fetchAPI('/generate-outline', {
        researchSummary,
        brief,
        profile,
    });
};

/**
 * 从大纲写文章
 */
export const writeArticleFromOutline = async (
    outline: string[],
    brief: ContentBrief,
    profile: any,
    userInstructions?: string
): Promise<string> => {
    const result = await fetchAPI<{ article: string }>('/write-article', {
        outline,
        brief,
        profile,
        userInstructions,
    });
    return result.article;
};

/**
 * 润色文章可读性
 */
export const polishArticleReadability = async (article: string): Promise<string> => {
    const result = await fetchAPI<{ article: string }>('/polish-article', { article });
    return result.article;
};

/**
 * 生成 SEO 元数据
 */
export const generateSeoMetadata = async (
    article: string,
    brief: ContentBrief
): Promise<{ seoTitle: string; seoDescription: string }> => {
    return fetchAPI('/generate-metadata', {
        article,
        brief,
    });
};

/**
 * 生成并嵌入图片
 */
export const generateAndEmbedImages = async (article: string): Promise<string> => {
    const result = await fetchAPI<{ article: string }>('/generate-images', { article });
    return result.article;
};

/**
 * 运行预检
 */
export const runPreflightCheck = async (
    article: string,
    brief: ContentBrief,
    profile: any
): Promise<PreflightReport> => {
    return fetchAPI('/preflight-check', {
        article,
        brief,
        profile,
    });
};

/**
 * 自动修复
 */
export const runAutoFix = async (
    article: string,
    issues: PreflightIssue[]
): Promise<string> => {
    try {
        const result = await fetchAPI<{ article: string }>('/auto-fix', {
            article,
            issues,
        });
        
        // 验证返回数据
        if (!result || typeof result !== 'object') {
            console.error('Invalid response from auto-fix API:', result);
            return article; // 返回原文章
        }
        
        // 确保 article 字段存在且是字符串
        if (!result.article || typeof result.article !== 'string') {
            console.warn('Auto-fix returned invalid article, using original');
            return article; // 返回原文章
        }
        
        return result.article;
    } catch (error) {
        console.error('Auto fix API call failed:', error);
        // 返回原文章而不是抛出错误
        return article;
    }
};

/**
 * 获取代理动作
 */
export const getAgentAction = async (
    userText: string,
    currentStep: number,
    chatHistory: any[]
): Promise<{ name: string; args: any; text?: string }> => {
    return fetchAPI('/agent-action', {
        userText,
        currentStep,
        chatHistory,
    });
};

/**
 * 获取新内容想法
 */
export const getNewContentIdea = async (
    profile: any,
    previousBrief: ContentBrief
): Promise<ContentBrief> => {
    return fetchAPI('/new-content-idea', {
        profile,
        previousBrief,
    });
};

