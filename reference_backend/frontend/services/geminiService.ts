
import { GoogleGenAI, Type, Modality, GenerateContentResponse, FunctionDeclaration } from "@google/genai";
import { SeoDiagnosisReport, Competitor, SolutionBoard, SolutionOption, ContentBrief, PreflightReport, PreflightIssue, ChatMessage, MessageType, BrandProfile, CompetitorAnalysisReport, RagArticle, KeywordTopicFit, ReportItem, ImageMessage, EnhancedPrompt } from '../types';

// Note: This service still uses client-side API keys (for SEO/Image features not yet migrated)
// Brand Profile creation has been migrated to backend API
// In browser environment, process.env is replaced by Vite at build time
// Since we removed API_KEY from vite.config.ts define, it will be undefined
const API_KEY = (typeof process !== 'undefined' && process.env && (process.env as any).API_KEY) || '';
if (!API_KEY) {
    console.warn('[geminiService] API_KEY not found. SEO and Image Generation features will not work until migrated to backend.');
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;
const model = 'gemini-2.5-flash';

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null) return JSON.stringify(error);
    return String(error);
}

// Helper to check if AI service is available
const ensureAIService = (): GoogleGenAI => {
    if (!ai) {
        throw new Error('Gemini API key not configured. This feature requires backend migration or API key configuration.');
    }
    return ai;
}

// --- RAG Knowledge Base ---
const ragKnowledgeBase: RagArticle[] = [
    {
        industryKeywords: ['photography', 'camera accessories', 'videography', '摄影', '相机配件', '摄像设备'],
        title: '2024年摄影师必备的12款相机配件',
        url: 'https://www.dpreview.com/reviews/buying-guide-best-accessories-for-your-new-dslr',
        reason: '文章通过全面的清单和实用建议，有效覆盖了从入门到专业的广泛用户群体，是典型的“指南类”高流量内容。'
    },
    {
        industryKeywords: ['photography', 'camera accessories', 'videography', '摄影', '相机配件', '摄像设备'],
        title: '相机三脚架深度评测：Manfrotto vs. Gitzo，谁是王者？',
        url: 'https://www.bhphotovideo.com/explora/photography/buying-guide/a-guide-to-tripods',
        reason: '通过深度对比评测，直接影响高意向用户的购买决策，精准捕获了具有商业价值的关键词。'
    },
    {
        industryKeywords: ['photography', 'camera accessories', 'videography', '摄影', '相机配件', '摄像设备'],
        title: '如何清洁你的相机传感器？（附分步图解）',
        url: 'https://photographylife.com/how-to-clean-dslr-sensor',
        reason: '这种“How-to”类型的内容精准解决了用户的核心痛点，极易获得长尾流量和社交媒体分享。'
    },
];

const searchRagByIndustry = (industry: string): RagArticle[] => {
    if (!industry) return [];
    const lowerIndustry = industry.toLowerCase();
    return ragKnowledgeBase
        .filter(article => 
            article.industryKeywords.some(keyword => lowerIndustry.includes(keyword.toLowerCase()))
        )
        .slice(0, 3); // Return max 3 articles
};


// Helper to parse JSON safely
function safeJsonParse(jsonString: string, fallback: any) {
    try {
        let textToParse = jsonString;

        // The Gemini API sometimes returns text before the JSON, especially when using tools like Google Search.
        // Find the start of the actual JSON content by looking for the first '{' or '['.
        const jsonStartIndex = textToParse.indexOf('{');
        const arrayStartIndex = textToParse.indexOf('[');

        let startIndex = -1;

        if (jsonStartIndex > -1 && arrayStartIndex > -1) {
            // If both are found, take the one that appears first.
            startIndex = Math.min(jsonStartIndex, arrayStartIndex);
        } else if (jsonStartIndex > -1) {
            startIndex = jsonStartIndex;
        } else {
            startIndex = arrayStartIndex;
        }

        if (startIndex === -1) {
            // No JSON structure found in the string.
            throw new Error("No JSON object or array found in the string.");
        }
        
        // Slice the string from the start of the JSON content.
        textToParse = textToParse.substring(startIndex);
        
        // The API might also wrap the JSON in markdown ```json ... ```. 
        // The start is handled by slicing, now we handle the end.
        // A simple trim of trailing whitespace and ``` should be safe enough.
        textToParse = textToParse.trim();
        if (textToParse.endsWith('```')) {
            textToParse = textToParse.slice(0, -3).trim();
        }

        return JSON.parse(textToParse);
    } catch (e) {
        console.error("Failed to parse JSON:", getErrorMessage(e));
        console.error("Original string:", jsonString);
        return fallback;
    }
}

async function callApiWithRetry<T>(apiCall: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
    let attempt = 0;
    while (true) {
        try {
            return await apiCall();
        } catch (e: any) {
            attempt++;
            
            // More robustly extract status code from the error object
            const status = e?.httpStatus || e?.status;

            const isRetriable = status === 429 || (status && status >= 500 && status < 600);

            if (!isRetriable || attempt >= maxRetries) {
                const errorMessage = getErrorMessage(e);
                // Provide more detailed logging when the error is not a standard HTTP error
                if (typeof status === 'undefined') {
                    console.error(`API call failed after ${attempt} attempts with a non-retriable error.`, errorMessage);
                    // console.error("Full error object:", e); // Uncomment for debugging
                } else {
                    console.error(`API call failed after ${attempt} attempts with a non-retriable error status ${status}.`, errorMessage);
                }
                throw e;
            }
            
            let delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
            
            const errorDetails = e?.error?.details;
            if (Array.isArray(errorDetails)) {
                const retryInfo = errorDetails.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
                if (retryInfo && retryInfo.retryDelay) {
                    const seconds = parseInt(retryInfo.retryDelay.replace('s', ''), 10);
                    if (!isNaN(seconds)) {
                        delay = seconds * 1000 + 500;
                    }
                }
            }
            
            console.log(`API call failed with retriable status ${status} (attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(delay)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// --- NEW LAUNCH PAGE INTENT ANALYSIS ---
const routeUserTool: FunctionDeclaration = {
    name: 'route_user_request',
    description: 'Determines the user\'s intent and extracts relevant information for routing.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            intent: {
                type: Type.STRING,
                description: 'The user\'s primary intent. Must be one of: "SEO", "IMAGE_GENERATION", "OTHER".'
            },
            url: {
                type: Type.STRING,
                description: 'The full URL extracted from the user\'s query, if the intent is "SEO".'
            },
            query: {
                type: Type.STRING,
                description: 'The user\'s original query or a cleaned-up version for image generation.'
            }
        },
        required: ['intent', 'query']
    }
};

/**
 * @deprecated This function has been migrated to backend API.
 * Please use `analyzeUserIntent` from '../services/seoService' instead.
 * This is kept for backward compatibility only.
 */
export const analyzeUserIntent = async (prompt: string): Promise<{ intent: string; url: string | null; query: string | null }> => {
    console.warn('[DEPRECATED] analyzeUserIntent in geminiService.ts is deprecated. Use seoService.ts instead.');
    return callApiWithRetry(async () => {
        const genAIPrompt = `
            Analyze the user's request and determine their intent.

            User Request: "${prompt}"

            **Routing Logic**:
            1.  If the request is about SEO analysis, blog writing, content strategy, or clearly contains a website URL for analysis, the intent is "SEO". Extract the URL.
            2.  If the request is about creating, generating, or drawing an image or picture, the intent is "IMAGE_GENERATION".
            3.  For anything else, the intent is "OTHER".

            Call the 'route_user_request' function with the determined intent and extracted information.
        `;

        try {
            const aiService = ensureAIService();
            const response: GenerateContentResponse = await aiService.models.generateContent({
                model: model,
                contents: genAIPrompt,
                config: {
                    tools: [{ functionDeclarations: [routeUserTool] }]
                }
            });

            if (response.functionCalls && response.functionCalls.length > 0) {
                const args = response.functionCalls[0].args as { intent: string; url: string | null; query: string | null };
                return { intent: args.intent, url: args.url || null, query: args.query || prompt };
            }

            // Fallback if no function call
            const urlRegex = /((https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?)/i;
            const urlMatch = prompt.match(urlRegex);
            if (urlMatch) {
                return { intent: 'SEO', url: urlMatch[0], query: prompt };
            }
            
            return { intent: 'OTHER', url: null, query: prompt };

        } catch (error) {
            console.error("Error in analyzeUserIntent, using fallback logic.", getErrorMessage(error));
            const urlRegex = /((https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?)/i;
            const urlMatch = prompt.match(urlRegex);
            if (urlMatch) {
                return { intent: 'SEO', url: urlMatch[0], query: prompt };
            }
            return { intent: 'OTHER', url: null, query: prompt };
        }
    });
};


// --- 1. SEO DIAGNOSIS ---
export const getSeoDiagnosis = async (url: string): Promise<SeoDiagnosisReport> => {
    return callApiWithRetry(async () => {
        const researchPrompt = `
            You are an expert SEO analyst. Using Google Search as your tool, conduct a comprehensive content-focused SEO diagnosis for the website "${url}".

            Your research must cover these four dimensions:
            1.  **Keyword-Topic Fit**: Analyze the content on "site:${url}". What are the top 3-5 main topics or content clusters? How well do these topics align with what you can infer is their core business?
            2.  **Topical Authority**: Still searching within "site:${url}", look for evidence of a "Pillar-Spoke" model or deep content hubs. Does the site have comprehensive guides that link to smaller, related articles, or is the content more fragmented and standalone?
            3.  **User Intent Coverage**: Examine the types of content on "site:${url}". Is there a good balance of informational content (e.g., "how-to", "what is"), commercial investigation content (e.g., "best", "review", "vs."), and transactional content (product pages)? Identify any obvious gaps.
            4.  **Content Discoverability**: Check the "site:${url}/robots.txt" for any major blocking rules that would prevent content from being crawled. Use the "site:${url}" search operator to get a general sense of how many pages are indexed. Note any immediate red flags.

            After your research, synthesize your findings into a detailed, structured summary. This summary will be used by another AI to generate a JSON report. Be thorough and provide clear analysis for each dimension.
        `;

        const researchResponse: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: researchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });
        const researchSummary = researchResponse.text ?? '';

        const structuringPrompt = `
            Based on the following SEO research summary for the website "${url}", generate a final report in a single, valid JSON object.

            **Research Summary**:
            ---
            ${researchSummary}
            ---

            **Your Task**:
            Adhere strictly to the TypeScript interface below.
            - **IMPORTANT**: The values for \`coreInsight\`, \`analysis\`, and \`recommendation\` fields MUST be in **Chinese**.
            - The \`topicalKeywords\` array must contain the original English keywords.
            - For each of the four main dimensions, provide a concise \`analysis\` and a single, highly actionable \`recommendation\`.
            - Calculate a final \`contentSeoHealthScore\` (0-100).
            - Write a single-sentence \`coreInsight\`.
            
            Your entire output must be ONLY the JSON object, with no other text or markdown.

            **TypeScript Interface**:
            \`\`\`typescript
            interface ReportItem {
              analysis: string; // Must be in Chinese
              recommendation: string; // Must be in Chinese
            }

            interface KeywordTopicFit extends ReportItem {
                topicalKeywords: string[]; // Must be in English
            }

            interface SeoDiagnosisReport {
                siteUrl: string;
                contentSeoHealthScore: number;
                coreInsight: string; // Must be in Chinese
                keywordTopicFit: KeywordTopicFit;
                topicalAuthority: ReportItem;
                userIntentCoverage: ReportItem;
                contentDiscoverability: ReportItem;
            }
            \`\`\`
        `;

        const structuringResponse: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: structuringPrompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        return safeJsonParse(structuringResponse.text ?? '{}', fallbackSeoReport(url));
    });
};

// --- 2. COMPETITOR ANALYSIS ---
export const getCompetitors = async (url: string, profile: BrandProfile, userInstructions?: string): Promise<Competitor[]> => {
     return callApiWithRetry(async () => {
        // Step 1: Research competitors
        const researchPrompt = `
            请使用Google搜索，为网站 ${url}（行业：'${profile.globalInfo.brand_industry}'）识别出3-5个主要的SEO竞争对手。
            对于每个竞争对手，请分析他们的SEO实力，并简要说明为什么他们是竞争对手。
            ${userInstructions ? `用户具体指示: "${userInstructions}"` : ''}
            请以列表形式总结你的发现。
        `;
        const researchResponse: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: researchPrompt,
            config: { tools: [{ googleSearch: {} }] }
        });
        const researchSummary = researchResponse.text ?? '';
        
        // Step 2: Structure the findings into JSON
        const structuringPrompt = `
            根据以下竞争对手研究摘要，提取竞争对手信息并格式化为JSON数组。

            研究摘要:
            ---
            ${researchSummary}
            ---
            
            请以一个遵循此TypeScript接口的有效JSON数组格式返回你的发现。不要在JSON数组之外包含任何文本。
            \`\`\`typescript
            interface Competitor {
              id: string; // a unique identifier for each competitor, e.g., 'comp-1'
              url: string;
              reasonText?: string;
            }
            \`\`\`
        `;
        const structuringResponse: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: structuringPrompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        const competitors = safeJsonParse(structuringResponse.text ?? '[]', fallbackCompetitors);
        return competitors.map((c: Competitor, i: number) => ({ ...c, id: `comp-${i + 1}` }));
    });
}

export const runCompetitorAnalysis = async (competitorsToAnalyze: Competitor[], userSiteReport: SeoDiagnosisReport, profile: BrandProfile): Promise<CompetitorAnalysisReport> => {
    const ragArticles = searchRagByIndustry(profile.globalInfo.brand_industry);

    const competitorAnalysisPromises = competitorsToAnalyze.map(competitor =>
        callApiWithRetry(async () => {
            const findArticlePrompt = `Using Google Search, find one of the single highest-quality, best-performing blog articles from the website "${competitor.url}". The link MUST be a specific article, not a homepage or category page. Provide only its full URL and title. If you cannot find one, just say "No suitable article found."`;
            
            const articleSearchResponse: GenerateContentResponse = await ai.models.generateContent({
                model: model,
                contents: findArticlePrompt,
                config: { tools: [{ googleSearch: {} }] },
            });
            const articleSearchResult = articleSearchResponse.text ?? '';
            
            const analysisPrompt = `
                You are an expert SEO analyst.
                Competitor Website: "${competitor.url}"
                Top Article Search Result: "${articleSearchResult}"

                Your tasks:
                1.  Based on the search result, extract the article's full URL and title. If no article was found, the URL and title should be null.
                2.  Evaluate the overall content quality of "${competitor.url}" (considering its expertise, authoritativeness, trustworthiness, SEO, and user experience). Provide a single "contentSeoScore" from 0 to 100.
                3.  If a top article was found, provide a brief "reason" explaining why it is a good, high-quality article. If not, this should be null.

                Provide your final output as a single, valid JSON object adhering to this TypeScript interface. Do not include any other text or markdown.
                \`\`\`typescript
                interface AnalyzedCompetitor {
                  url: string; // The competitor's URL
                  contentSeoScore: number;
                  topArticle?: {
                      title: string;
                      url: string;
                      reason: string;
                  };
                }
                \`\`\`
            `;
            
            const analysisResponse: GenerateContentResponse = await ai.models.generateContent({
                model: model,
                contents: analysisPrompt,
                config: { responseMimeType: "application/json" }
            });

            const parsedResult = safeJsonParse(analysisResponse.text ?? '{}', { url: competitor.url, contentSeoScore: 70 });

            if (parsedResult.topArticle && (!parsedResult.topArticle.url || !parsedResult.topArticle.title || !parsedResult.topArticle.reason)) {
                delete parsedResult.topArticle;
            }
            return parsedResult;

        }).catch(error => {
            console.error(`Failed to analyze competitor ${competitor.url}:`, getErrorMessage(error));
            return {
                url: competitor.url,
                contentSeoScore: 70, // Fallback score
                topArticle: {
                    title: "Analysis Failed",
                    url: `https://${competitor.url}`,
                    reason: "Could not retrieve article due to an API error."
                }
            };
        })
    );

    const analyzedCompetitorData = await Promise.all(competitorAnalysisPromises);

    const finalCompetitors = competitorsToAnalyze.map(originalComp => {
        const analyzedData = analyzedCompetitorData.find(d => d.url === originalComp.url);
        return { ...originalComp, ...analyzedData };
    });

    const landscapePrompt = `
        You are a senior SEO strategist. Based on the following competitor data, provide a high-level analysis of the competitive landscape for the client "${userSiteReport.siteUrl}".

        **Competitor Data:**
        ${finalCompetitors.map(c => `- ${c.url} (Content Score: ${c.contentSeoScore}). Top article topic: ${c.topArticle?.title || 'N/A'}`).join('\n')}

        **Client's Content Disadvantage:**
        Based on their SEO report, their content score is low (${userSiteReport.contentSeoHealthScore}) and they struggle with content depth.

        **Your Task:**
        Generate a JSON object with three key insights.
        **IMPORTANT**: The string values for the keys in the JSON object MUST be in **Chinese**.
        1.  **overallTrend**: A 1-2 sentence summary of the content trends you see from the competitors.
        2.  **yourDisadvantage**: A 1-2 sentence summary of the client's biggest content weakness compared to these competitors.
        3.  **strategicOpportunity**: A 1-2 sentence actionable recommendation for a strategic opportunity.

        Your output must be a single, valid JSON object adhering to this interface:
        \`\`\`typescript
        interface CompetitiveLandscape {
            overallTrend: string; // Must be in Chinese
            yourDisadvantage: string; // Must be in Chinese
            strategicOpportunity: string; // Must be in Chinese
        }
        \`\`\`
    `;

    const landscapeResponse: GenerateContentResponse = await ai.models.generateContent({
        model: model,
        contents: landscapePrompt,
        config: { responseMimeType: "application/json" }
    });

    const competitiveLandscape = safeJsonParse(landscapeResponse.text ?? '{}', {
        overallTrend: "竞争对手正大力投入视频内容和YouTube教程，以展示产品用例。",
        yourDisadvantage: "您的网站缺乏强大的教育中心来吸引渠道顶层的用户。",
        strategicOpportunity: "可以创建一个“创作者聚焦”系列，展示用户生成的内容，以建立社区并有机地展示产品。"
    });

    return {
        ragArticles,
        competitiveLandscape,
        competitors: finalCompetitors,
    };
};


// --- 3. SOLUTION BOARD ---
export const getSolutionBoard = async (url: string, competitors: Competitor[], analysisReport: CompetitorAnalysisReport, profile: BrandProfile, userInstructions?: string): Promise<SolutionBoard> => {
    return callApiWithRetry(async () => {
        if (!profile.projects || profile.projects.length === 0) {
            throw new Error("BrandProfile contains no projects, cannot generate solution board.");
        }
        const project = profile.projects.find(p => new URL(p.project_url).hostname === new URL(url).hostname) || profile.projects[0];
        const prompt = `
            You are a world-class SEO Content Strategy Director. Your task is to generate three highly customized and actionable SEO content strategies for your client.

            **IMPORTANT**: All output, including strategy names, goals, concepts, examples, and reasons, MUST be in **${project.target_language}**. The strategies should be tailored for an audience in **${project.target_region}**.

            You must synthesize the following three categories of information to formulate your strategies:
            1.  **SEO Analysis Data**:
                - Client Website: ${url}
                - Competitors: ${competitors.map(c => c.url).join(', ')}
                - Key Insights: The client's main content disadvantage is "${analysisReport.competitiveLandscape.yourDisadvantage}", and the primary market opportunity is "${analysisReport.competitiveLandscape.strategicOpportunity}".

            2.  **Brand Profile**:
                - Brand Name: ${profile.globalInfo.brand_name}
                - Brand Industry: ${profile.globalInfo.brand_industry}
                - Brand Voice: ${profile.globalInfo.brand_voice.tone}, ${profile.globalInfo.brand_voice.style}
                - Target Keywords: ${project.target_keywords.join(', ')}

            3.  **User's Immediate Directive**:
                - ${userInstructions ? `"${userInstructions}"` : 'No specific instructions.'}

            **Your Strategic Archetypes (for inspiration)**:
            Draw inspiration from the following archetypes. You don't need to create one for each; select and adapt the most suitable combination for the client's situation.
            - **Archetype 1: Traffic Magnet**: Aims to build topical authority and capture Top-of-Funnel users. Core method: "Pillar-Spoke" content model.
            - **Archetype 2: Decision Engine**: Aims to solve core pain points and influence Middle-of-Funnel users. Core method: "Problem-Solution" and "Comparison" content.
            - **Archetype 3: Conversion Accelerator**: Aims to showcase product value and drive Bottom-of-Funnel users. Core method: "Case Studies" and "Creative Use-Cases".

            **Your Task**:
            Generate a JSON array containing **three** strategic options. For each option:
            - \`strategyName\`: Create a compelling, client-facing strategy title. It should be a call to action that clearly communicates the core value. **Strictly forbid** using internal jargon like "Traffic Magnet," "Decision Engine," or "Conversion Accelerator." Example: "Dominate the Conversation on Mobile & Sustainable Videography."
            - \`seoGoal\`: Clearly state the SEO objective for this strategy.
            - \`coreConcept\`: Briefly explain the core idea and execution method.
            - \`contentExamples\`: Provide 2-3 specific article/video title examples that reflect the brand voice and target keywords.
            - \`strategicReason\`: **(Most Important)** In one sentence, explain **why** this strategy is right for this specific client, explicitly linking it to information from the SEO analysis, brand profile, or user directive.

            **Output Format**:
            Your entire output must be a single, valid JSON array that strictly adheres to the following TypeScript interface. Do not include any text, markdown, or comments outside the JSON array.
            \`\`\`typescript
            type SolutionBoard = {
                id: string; // A unique ID, e.g., "sol-1"
                strategyName: string;
                seoGoal: string;
                coreConcept: string;
                contentExamples: string[];
                strategicReason: string;
            }[];
            \`\`\`
        `;
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const board = safeJsonParse(response.text ?? '[]', fallbackSolutionBoard);
        return board.map((opt: SolutionOption, i: number) => ({...opt, id: `sol-${i + 1}`}));
    });
};

// --- 4. CONTENT BRIEF ---
export const getPrefilledBrief = async (solution: SolutionOption, url: string, seoReport: SeoDiagnosisReport, competitors: Competitor[], profile: BrandProfile, userInstructions?: string): Promise<ContentBrief> => {
    return callApiWithRetry(async () => {
        if (!profile.projects || profile.projects.length === 0) {
            throw new Error("BrandProfile contains no projects, cannot generate content brief.");
        }
        const project = profile.projects.find(p => new URL(p.project_url).hostname === new URL(url).hostname) || profile.projects[0];
        
        const prompt = `
            You are an expert SEO content strategist. Your task is to create a detailed Content Brief based on a chosen strategy.

            **Chosen Strategy**:
            - Name: "${solution.strategyName}"
            - Concept: "${solution.coreConcept}"

            **Input Data**:
            - Website: ${url}
            - Brand Profile: ${JSON.stringify(profile.globalInfo, null, 2)}
            - Project Config: ${JSON.stringify(project, null, 2)}
            - Competitors: ${competitors.map(c => c.url).join(', ')}
            - User Instructions: ${userInstructions ? `"${userInstructions}"` : 'None'}

            **Your Task**:
            Generate a comprehensive Content Brief. Your entire output must be a single, valid JSON object that strictly adheres to the TypeScript interface below. All string values MUST be in Chinese.
            
            - \`titleSuggestion\`: Propose a compelling, SEO-friendly title based on the strategy and keywords.
            - \`topicSummary\`: A brief summary of the article's topic.
            - \`targetRegion\` & \`targetLanguage\`: Use the values from the project config.
            - \`mainKeyword\` & \`secondaryKeywords\`: Propose a main keyword and 3-5 secondary keywords.
            - \`suggestedOutline\`: A logical, hierarchical outline with at least 5 main points (H2s).
            - \`estimatedWordcount\`: A reasonable word count estimate.
            - \`aiRecommendations\`: 2-3 actionable recommendations for the AI writer to follow, based on the brand voice and strategy.

            \`\`\`typescript
            interface ContentBrief {
                titleSuggestion: string;
                topicSummary: string;
                targetRegion: string;
                targetLanguage: string;
                mainKeyword: string;
                secondaryKeywords: string[];
                suggestedOutline: string[];
                estimatedWordcount: number;
                aiRecommendations: string[];
            }
            \`\`\`
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        return safeJsonParse(response.text ?? '{}', fallbackContentBrief(solution));
    });
};

// --- 5. ARTICLE GENERATION ---
export const runWebResearch = async (brief: ContentBrief): Promise<string> => {
    return callApiWithRetry(async () => {
        const prompt = `
            You are a research assistant. Use Google Search to gather up-to-date information, statistics, and key talking points for an article based on this brief:
            - Title: "${brief.titleSuggestion}"
            - Main Keyword: "${brief.mainKeyword}"
            - Secondary Keywords: ${brief.secondaryKeywords.join(', ')}
            - Topic Summary: "${brief.topicSummary}"
            - Target Audience: Users in ${brief.targetRegion} who speak ${brief.targetLanguage}.
            
            Synthesize your findings into a concise summary of 3-4 paragraphs. This summary will be used by another AI to write the article. Focus on facts, data, and unique angles.
        `;
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
        });
        return response.text ?? '';
    });
};

export const generateStrategicOutline = async (researchSummary: string, brief: ContentBrief, profile: BrandProfile): Promise<string[]> => {
    return callApiWithRetry(async () => {
        const prompt = `
            You are an expert content strategist. Based on the provided research and content brief, refine the suggested outline into a final, detailed strategic outline.

            **Research Summary**: ${researchSummary}
            **Content Brief**: ${JSON.stringify(brief, null, 2)}
            **Brand Voice**: ${profile.globalInfo.brand_voice.tone}, ${profile.globalInfo.brand_voice.style}

            **Your Task**:
            Generate a detailed outline as a JSON array of strings. Each string represents a heading (e.g., "Introduction", "## What is...", "### The importance of...").
            - The outline should be logical and comprehensive.
            - Incorporate insights from the research summary.
            - Ensure the tone of the headings aligns with the brand voice.
            - Ensure all key topics from the brief's suggested outline are covered.
            
            Output only the JSON array.
        `;
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        return safeJsonParse(response.text ?? '[]', brief.suggestedOutline);
    });
};

export const writeArticleFromOutline = async (outline: string[], brief: ContentBrief, profile: BrandProfile, userInstructions?: string): Promise<string> => {
     return callApiWithRetry(async () => {
        const prompt = `
            You are an expert ${profile.globalInfo.brand_industry} writer, specializing in SEO content. Write a full-length article based on the provided outline and brief.

            **Outline**:
            ${outline.join('\n')}

            **Content Brief**: ${JSON.stringify(brief, null, 2)}
            **Brand Profile**: ${JSON.stringify(profile.globalInfo, null, 2)}
            ${userInstructions ? `**User's Additional Instructions**: "${userInstructions}"\n` : ''}

            **Writing Instructions**:
            - Write in markdown format.
            - Adhere strictly to the brand voice: ${profile.globalInfo.brand_voice.tone}, ${profile.globalInfo.brand_voice.style}.
            - Naturally integrate the main and secondary keywords.
            - The language MUST be ${brief.targetLanguage}.
            - The content MUST be engaging and valuable for an audience in ${brief.targetRegion}.
            - Do not use placeholders like "[Image]".
            - Write approximately ${brief.estimatedWordcount} words.
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-pro', // Use a more powerful model for writing
            contents: prompt,
        });
        return response.text ?? fallbackArticle(brief);
    });
};

export const polishArticleReadability = async (article: string): Promise<string> => {
    return callApiWithRetry(async () => {
        const prompt = `
            You are a senior editor. Review the following article and polish it for readability and flow.
            - Improve sentence structure.
            - Correct any grammar or spelling errors.
            - Ensure the tone is consistent.
            - Do not change the core meaning or structure.
            Return only the polished article in markdown format.

            **Article**:
            ---
            ${article}
            ---
        `;
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });
        return response.text ?? article;
    });
};

export const generateAndEmbedImages = async (article: string): Promise<string> => {
    return callApiWithRetry(async () => {
        const prompt = `
            You are an AI Art Director. Your task is to analyze the provided markdown article and decide where to place relevant images.
            For each image placement, generate a highly descriptive, artistic prompt for an image generation model.
            
            **Article**:
            ---
            ${article}
            ---

            **Your Task**:
            Return a JSON array of objects. Each object should have two properties:
            1. \`section_title\`: The exact markdown heading (e.g., "## The Rise of Sustainable Materials") under which the image should be placed. Use "Introduction" for the first section before any headings.
            2. \`image_prompt\`: A detailed, visually rich prompt for an image generation model. Example: "A cinematic, wide-angle shot of a meticulously organized photographer's backpack, with lenses, filters, and a sleek carbon-fiber tripod neatly arranged. The lighting is soft and natural, coming from a nearby window, highlighting the textures of the gear. Style: product photography, realistic."

            Output ONLY the JSON array.
            \`\`\`typescript
            type ImagePlacement = {
                section_title: string;
                image_prompt: string;
            }[];
            \`\`\`
        `;

        const placementResponse: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const placements = safeJsonParse(placementResponse.text ?? '[]', []);
        
        if (placements.length === 0) return article;

        const imagePromises = placements.map(async (p: any) => {
            try {
                const imgResponse = await ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: p.image_prompt,
                    config: {
                        numberOfImages: 1,
                        aspectRatio: '16:9',
                        outputMimeType: 'image/jpeg',
                    }
                });
                const base64Image = imgResponse.generatedImages[0].image.imageBytes;
                return { 
                    section: p.section_title, 
                    markdown: `![${p.image_prompt.split(',')[0]}](data:image/jpeg;base64,${base64Image})` 
                };
            } catch (err) {
                console.error(`Failed to generate image for prompt: ${p.image_prompt}`, getErrorMessage(err));
                return null;
            }
        });

        const generatedImages = (await Promise.all(imagePromises)).filter(Boolean);
        
        let articleWithImages = article;
        generatedImages.forEach(img => {
            if (img) {
                if (img.section === "Introduction") {
                    // Split article into first paragraph and the rest
                    const parts = articleWithImages.split('\n\n');
                    parts.splice(1, 0, img.markdown); // Insert image after first paragraph
                    articleWithImages = parts.join('\n\n');
                } else {
                    articleWithImages = articleWithImages.replace(img.section, `${img.section}\n\n${img.markdown}`);
                }
            }
        });
        
        return articleWithImages;
    });
};

export const generateSeoMetadata = async (article: string, brief: ContentBrief): Promise<{ seoTitle: string; seoDescription: string }> => {
    return callApiWithRetry(async () => {
        const prompt = `
            You are an SEO expert. Based on the article and content brief, generate a an SEO-optimized meta title and meta description.

            **Article Content (first 500 words)**:
            ${article.substring(0, 500)}...

            **Content Brief**:
            - Main Keyword: ${brief.mainKeyword}
            - Title Suggestion: ${brief.titleSuggestion}

            **Requirements**:
            - **Meta Title**: Max 60 characters. Must include the main keyword.
            - **Meta Description**: Max 160 characters. Must be compelling and include the main keyword.
            
            Return a single JSON object with "seoTitle" and "seoDescription" keys.
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        return safeJsonParse(response.text ?? '{}', { seoTitle: brief.titleSuggestion, seoDescription: "..." });
    });
};

// --- 6. PRE-FLIGHT ---
export const runPreflightCheck = async (article: string, brief: ContentBrief, profile: BrandProfile): Promise<PreflightReport> => {
     return callApiWithRetry(async () => {
        const prompt = `
            You are a meticulous AI Editor-in-Chief. Your task is to perform a pre-flight check on the following article. Analyze it against the provided criteria and identify any issues.

            **Article Content**:
            ---
            ${article}
            ---

            **Criteria to Check**:
            1.  **Keyword Usage**: Does the article naturally include the main keyword ("${brief.mainKeyword}") and some secondary keywords (${brief.secondaryKeywords.join(', ')})? Check for keyword stuffing or awkward placement.
            2.  **SEO Best Practices**: Does the article have a clear structure (H1, H2s)? Is the introduction engaging?
            3.  **Brand Voice Consistency**: Does the article's tone and style align with the brand voice: "${profile.globalInfo.brand_voice.tone}, ${profile.globalInfo.brand_voice.style}"? Are any negative keywords ("${profile.globalInfo.negative_keywords_global.join(', ')}") used?
            4.  **Readability**: Is the language clear and concise? Are there overly complex sentences or jargon that should be simplified?

            **Your Task**:
            Generate a JSON object representing the pre-flight report.
            - Calculate a final \`score\` from 0 to 100 based on the severity and number of issues. 100 means no issues.
            - The \`issues\` array should contain objects for each problem found. For each issue, provide a \`type\`, a \`description\` of the problem, and a specific, actionable \`suggestion\` for how to fix it.
            - If no issues are found, the \`issues\` array should be empty and the score should be 100.

            Your entire output must be a single, valid JSON object adhering to this TypeScript interface:
            \`\`\`typescript
            interface PreflightIssue {
                type: 'Keyword' | 'SEO' | 'BrandVoice' | 'Readability';
                description: string;
                suggestion: string;
            }

            interface PreflightReport {
                score: number;
                issues: PreflightIssue[];
            };
            \`\`\`
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        return safeJsonParse(response.text ?? '{}', fallbackPreflightReport);
    });
};


export const runAutoFix = async (article: string, issues: PreflightIssue[]): Promise<string> => {
     return callApiWithRetry(async () => {
        const prompt = `
            You are an expert AI editor. Your task is to revise the provided article to fix a specific list of issues.

            **Original Article**:
            ---
            ${article}
            ---

            **Issues to Fix**:
            ${issues.map(i => `- **${i.type}**: ${i.description}. (Suggestion: ${i.suggestion})`).join('\n')}

            **Instructions**:
            - Apply all the suggested fixes to the article.
            - Maintain the original markdown formatting.
            - Do not introduce new content or change the article's structure beyond what is required to fix the issues.
            - Return ONLY the full, revised article content.
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-pro', // Use a more powerful model for precise editing
            contents: prompt,
        });

        return response.text ?? article;
    });
};

// --- AGENT ACTIONS ---
const agentActionsTool: FunctionDeclaration = {
    name: 'determine_user_action',
    description: "Determines the user's intent from their chat message and suggests the next action.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            name: {
                type: Type.STRING,
                description: 'The name of the action to take. Must be one of: "go_to_step", "rerun_step", "answer_question".'
            },
            args: {
                type: Type.OBJECT,
                properties: {
                    step: {
                        type: Type.INTEGER,
                        description: 'The step number to go to (1-6) if the action is "go_to_step".'
                    },
                    instructions: {
                        type: Type.STRING,
                        description: 'User\'s specific feedback or instructions for the "rerun_step" action.'
                    }
                }
            }
        },
        required: ['name']
    }
};

export const getAgentAction = async (userText: string, currentStep: number, chatHistory: ChatMessage[]): Promise<{ name: string; args: any; text?: string; }> => {
    return callApiWithRetry(async () => {
        const history = chatHistory.map(msg => ({
            role: msg.type === MessageType.USER ? 'user' : 'model',
            parts: [{ text: (msg.payload as { text: string }).text }]
        }));

        const prompt = `
            You are the AI assistant in a multi-step SEO content creation workflow. Your job is to understand the user's request and decide on the appropriate action.

            **Current State**:
            - We are at Step ${currentStep}: ${['Diagnosis', 'Competitors', 'Analysis', 'Solutions', 'Brief', 'Editing', 'Publish'][currentStep - 1]}.

            **User's Latest Message**: "${userText}"
            
            **Action Logic**:
            1.  If the user wants to go back to a previous step (e.g., "go back to competitors", "let's change the strategy"), use the "go_to_step" action. The step number must be less than the current step ${currentStep}.
            2.  If the user is providing feedback on the most recent output and wants to regenerate it (e.g., "I don't like these options, try again", "generate something more creative", "add more detail about X"), use the "rerun_step" action. Extract their feedback into the "instructions" argument.
            3.  If it's a general question or a comment that doesn't fit the above, I will answer it directly. Do not use a tool call in this case; instead, provide a helpful text response.

            Based on the user's message, what is the correct action to take? If you are answering directly, your response should be a helpful and concise text. Otherwise, call the 'determine_user_action' function.
        `;
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                tools: [{ functionDeclarations: [agentActionsTool] }]
            }
        });

        if (response.functionCalls && response.functionCalls.length > 0) {
            return {
                name: response.functionCalls[0].name,
                args: response.functionCalls[0].args as { step?: number; instructions?: string },
            };
        }
        
        return {
            name: 'answer_question',
            args: {},
            text: response.text ?? "I'm not sure how to handle that. Could you please rephrase?"
        };
    });
};

export const getNewContentIdea = async (profile: BrandProfile, previousBrief: ContentBrief): Promise<ContentBrief> => {
     return callApiWithRetry(async () => {
        // This function will generate a new brief, so it's similar to getPrefilledBrief but with a different prompt focus.
        const prompt = `
            You are a creative content strategist. Your task is to generate a completely new and fresh content idea for a client, based on their brand and a previous piece of content they created.

            **Brand Profile**:
            - Brand: ${profile.globalInfo.brand_name} (${profile.globalInfo.brand_industry})
            - Voice: ${profile.globalInfo.brand_voice.tone}, ${profile.globalInfo.brand_voice.style}
            - Target Keywords: ${profile.projects[0].target_keywords.join(', ')}

            **Previous Content Brief (for context, do not copy)**:
            - Title: "${previousBrief.titleSuggestion}"
            - Topic: "${previousBrief.topicSummary}"

            **Your Task**:
            Propose a new, different, but complementary content idea. Generate a full Content Brief for this new idea.
            - The new idea should be distinct from the previous one but still align with the brand.
            - The output must be a single, valid JSON object that strictly adheres to the ContentBrief interface.
            - All string values must be in Chinese.

            \`\`\`typescript
            interface ContentBrief {
                titleSuggestion: string;
                topicSummary: string;
                targetRegion: string;
                targetLanguage: string;
                mainKeyword: string;
                secondaryKeywords: string[];
                suggestedOutline: string[];
                estimatedWordcount: number;
                aiRecommendations: string[];
            }
            \`\`\`
        `;
        
         const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        // We can reuse the fallback brief logic but need to pass a "solution" object. We can mock one.
        const mockSolution: SolutionOption = {
            id: 'mock-sol',
            strategyName: 'New Creative Idea',
            coreConcept: 'A fresh angle based on brand profile.',
            seoGoal: 'Expand content footprint.',
            contentExamples: ['Example 1', 'Example 2'],
            strategicReason: 'To provide variety.'
        };
        
        return safeJsonParse(response.text ?? '{}', fallbackContentBrief(mockSolution));
    });
};

// --- BRAND PROFILE CREATION ---
export const createInitialBrandProfile = async (url: string): Promise<{ brand_name: string; brand_industry: string }> => {
    return callApiWithRetry(async () => {
        const researchPrompt = `
            Analyze the website "${url}" using Google Search to determine the brand's name and primary industry.
            Provide your findings as a simple text summary.
        `;

        const researchResponse: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: researchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });
        const researchSummary = researchResponse.text ?? '';

        const structuringPrompt = `
            Based on the following research summary for "${url}", extract the brand name and primary industry.
            Return the result as a single, valid JSON object with "brand_name" and "brand_industry" keys.

            Research Summary:
            ---
            ${researchSummary}
            ---
        `;
        
        const structuringResponse: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: structuringPrompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        return safeJsonParse(structuringResponse.text ?? '{}', { brand_name: "Unknown Brand", brand_industry: "General E-commerce" });
    });
};

// --- NEW IMAGE GENERATION ---

// --- AI Creative Director ---
const creativeDirectorTool: FunctionDeclaration = {
    name: 'creative_director_action',
    description: 'Analyzes user intent in an image creation context and determines the next best action.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            action: {
                type: Type.STRING,
                description: 'The determined action. Must be one of: "EDIT_IMAGE", "NEW_CREATION", "ANSWER_QUESTION".'
            },
            prompt: {
                type: Type.STRING,
                description: 'The original or a refined prompt to be used for the next step. For ANSWER_QUESTION, this is the text response.'
            },
            reasoning: {
                type: Type.STRING,
                description: 'A brief, user-facing explanation in Chinese for why this action was chosen.'
            },
            targetImageId: {
                type: Type.STRING,
                description: 'If the action is "EDIT_IMAGE", this is the ID of the image that should be edited (either the explicitly selected one or the last one generated).'
            }
        },
        required: ['action', 'prompt', 'reasoning']
    }
};

export const getCreativeDirectorAction = async (
    userPrompt: string,
    selectedImageId: string | null,
    lastGeneratedImageId: string | null,
    chatHistory: ImageMessage[]
): Promise<{ action: string; prompt: string; reasoning: string; targetImageId?: string; }> => {
    return callApiWithRetry(async () => {
        const historyForPrompt = chatHistory
            .slice(-4)
            .map(msg => `${msg.role}: ${typeof msg.content === 'string' ? msg.content : `[${msg.type} message]`}`)
            .join('\n');

        const prompt = `
            You are an AI Creative Director. Your job is to analyze the user's request in the context of an image creation session and decide the next action.

            **Current Context**:
            - Explicitly Selected Image ID: ${selectedImageId || 'None'}
            - Most Recently Generated Image ID: ${lastGeneratedImageId || 'None'}
            - Recent Conversation History:
            ${historyForPrompt}
            - User's Latest Request: "${userPrompt}"

            **Your Logic & Rules**:
            1.  **Prioritize Editing**: If an image is explicitly selected OR if the request is a clear follow-up modification to the last generated image (e.g., "change the background", "make it blue"), the action MUST be **EDIT_IMAGE**.
                - If an image was explicitly selected, \`targetImageId\` MUST be '${selectedImageId}'.
                - If it's a follow-up, \`targetImageId\` MUST be '${lastGeneratedImageId}'.
            2.  **Answer Question**: If the user is asking a question or making a comment that doesn't seem to be an image request (e.g., "what can you do?", "that's cool"), the action is **ANSWER_QUESTION**. The 'prompt' field should contain your text response.
            3.  **Default to New Creation**: For any other creative request that is not an edit or a question (e.g., "a cat astronaut", "social media images for a coffee shop"), the action is **NEW_CREATION**. \`targetImageId\` should not be set.

            Based on this logic, call the 'creative_director_action' function with your decision. The 'reasoning' should be a short, friendly, and contextual message in Chinese to the user explaining your understanding. For example: "好的，为您创作一张关于'${userPrompt}'的新图片。", "好的，正在为您修改上一张图片。", "正在为您解答问题。".
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-pro', // A smarter model is needed for this reasoning task
            contents: prompt,
            config: {
                tools: [{ functionDeclarations: [creativeDirectorTool] }]
            }
        });

        if (response.functionCalls && response.functionCalls.length > 0) {
            const args = response.functionCalls[0].args as { action: string; prompt: string; reasoning: string; targetImageId?: string };
            return args;
        }

        // Fallback if no function call: assume it's a new creation request.
        return {
            action: 'NEW_CREATION',
            prompt: userPrompt,
            reasoning: `好的，正在为您创作一张关于“${userPrompt}”的图片。`,
        };
    });
};


export const generateImage = async (
    prompt: string, 
    images: {data: string, mimeType: string}[], 
    aspectRatio: string = '1:1',
    modelLevel: 'banana' | 'banana_pro' = 'banana'
): Promise<{ base64Image: string }> => {
    return callApiWithRetry(async () => {
        const modelName = modelLevel === 'banana_pro' 
            ? 'gemini-3-pro-image-preview' 
            : 'gemini-2.5-flash-image';

        const parts: any[] = [];
        images.forEach(img => {
            parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
        });
        parts.push({ text: prompt });

        // Determine aspect ratio config based on model support
        const config: any = {
            responseModalities: [Modality.IMAGE],
            imageConfig: { aspectRatio: aspectRatio }
        };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName,
            contents: { parts: parts },
            config: config,
        });
        
        const candidate = response.candidates?.[0];
        if (!candidate) {
             throw new Error("No candidates returned from model.");
        }

        let textOutput = '';
        for (const part of candidate.content?.parts || []) {
            if (part.inlineData) {
                return { base64Image: part.inlineData.data };
            }
            if (part.text) {
                textOutput += part.text;
            }
        }
        
        const finishReason = candidate.finishReason;
        let errorMsg = `No image was generated.`;
        if (textOutput) errorMsg += ` Model response: ${textOutput}`;
        if (finishReason) errorMsg += ` Finish Reason: ${finishReason}`;

        throw new Error(errorMsg);
    });
};

// --- NEW INSPIRATION IMAGE FALLBACK ---
/**
 * @deprecated This function has been migrated to backend API.
 * Please use `generateInspirationImage` from '../services/imageService' instead.
 * This is kept for backward compatibility only.
 */
export const generateInspirationImage = async (fullPrompt: string): Promise<string> => {
    console.warn('[DEPRECATED] generateInspirationImage in geminiService.ts is deprecated. Use imageService.ts instead.');
    // If API key is not available, return empty string (image will use fallback URL)
    if (!ai) {
        console.warn('[generateInspirationImage] API key not available, skipping image generation');
        return '';
    }
    
    return callApiWithRetry(async () => {
        // Use gemini-2.5-flash-image for thumbnails/inspiration to be more robust and faster.
        // It doesn't support aspectRatio in config, but default square is fine for thumbnails.
        const promptForImage = fullPrompt.replace(/^创建AI图片\s*/, '').replace(/^创建AI视频\s*/, '');
        
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: promptForImage }] },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    return part.inlineData.data;
                }
            }
            throw new Error("No image generated");
        } catch (error) {
            // Fallback to generateImage (Imagen) if Flash Image fails, though unlikely.
            console.warn("Flash Image failed for inspiration, falling back to Imagen.", error);
            // For fallback, we just use a standard gen call which defaults to Gemini now anyway, 
            // so let's just error out or return a placeholder if needed, but retrying generateImage
            // with 'banana' model is equivalent to the above call.
            // Let's try the pro model as fallback if flash failed.
            try {
                 const response = await ai.models.generateContent({
                    model: 'gemini-3-pro-image-preview',
                    contents: { parts: [{ text: promptForImage }] },
                    config: { responseModalities: [Modality.IMAGE] },
                });
                 for (const part of response.candidates?.[0]?.content?.parts || []) {
                    if (part.inlineData) { return part.inlineData.data; }
                }
            } catch(e) {
                 console.error("Fallback image generation failed", e);
            }
            throw error;
        }
    });
};

// --- NEW IMAGE UPSCALE/ENHANCE ---
export const upscaleImage = async (base64Data: string, mimeType: string, factor: number, prompt: string): Promise<{ base64Image: string }> => {
    return callApiWithRetry(async () => {
        // Use Imagen for "HD Upscale" (High quality regeneration based on prompt)
        // Imagen generateImages is text-to-image primarily. 
        // We use the prompt to generate a high-quality version.
        // The input image data is currently not used by generateImages in this SDK version for upscaling.
        
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: '1:1', // Default square, or ideally we should match original aspect ratio but we don't track it easily here without input
                outputMimeType: 'image/jpeg',
            }
        });

        const base64Image = response.generatedImages?.[0]?.image?.imageBytes;
        if (!base64Image) {
            throw new Error("No image returned from Imagen model.");
        }
        return { base64Image };
    });
};

export const enhancePrompt = async (prompt: string): Promise<EnhancedPrompt[]> => {
    return callApiWithRetry(async () => {
        const systemInstruction = `You are an expert AI Art Director. Your task is to transform a user's basic idea into three distinct, professional creative directions. You must return a valid JSON array of objects.`;
        
        const userContent = `
        The user's idea is: "${prompt}"

        Based on this idea, generate three distinct "Prompt Optimization Cards". For each card, provide:
        1.  \`title\`: A short, catchy title for the creative direction (e.g., "Cinematic Portrait", "Retro Anime Style").
        2.  \`description\`: A one-sentence summary of the style and mood.
        3.  \`tags\`: An array of 3-4 relevant keyword tags (e.g., ["close-up", "golden hour", "shallow depth of field"]).
        4.  \`fullPrompt\`: A complete, detailed, and enhanced prompt for the 'gemini-2.5-flash-image' model that fully realizes the creative direction.

        IMPORTANT: Detect the language of the user's idea (it will be either Chinese or English). You MUST generate all content for the cards (titles, descriptions, tags, and full prompts) in that SAME language.

        Your entire output must be a single, valid JSON array adhering to this TypeScript interface:
        \`\`\`typescript
        interface EnhancedPrompt {
          title: string;
          description: string;
          tags: string[];
          fullPrompt: string;
        }
        \`\`\`
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: userContent,
            config: {
                systemInstruction,
                responseMimeType: "application/json"
            }
        });
        
        const fallbackResult: EnhancedPrompt[] = [{
            title: "Original Prompt",
            description: "Your original idea, ready to generate.",
            tags: ["user-provided"],
            fullPrompt: prompt
        }];

        return safeJsonParse(response.text ?? '[]', fallbackResult);
    });
};

export interface DesignPlanWithImagePrompt {
  title: string;
  description: string;
  prompt: string; // The prompt for the FINAL image
  referenceImagePrompt: string; // The prompt for the preview image
}

export const generateReferenceImage = async (prompt: string): Promise<{ base64Image: string }> => {
    return callApiWithRetry(async () => {
        const imgResponse = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: '16:9',
                outputMimeType: 'image/jpeg',
            }
        });
        const base64Image = imgResponse.generatedImages[0].image.imageBytes;
        return { base64Image };
    });
};

export const getDesignPlan = async (topic: string): Promise<DesignPlanWithImagePrompt[]> => {
    return callApiWithRetry(async () => {
        const researchPrompt = `
            As an AI Art Director and visual trend researcher, use Google Search to research current visual trends, popular aesthetics, color palettes, and best practices related to the topic: "${topic}".
            Detect the language of the topic (Chinese or English) and provide your findings as a detailed text summary in that same language.
        `;
        const researchResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: researchPrompt,
            config: { 
                tools: [{ googleSearch: {} }],
            }
        });
        const researchSummary = researchResponse.text ?? '';

        const structuringPrompt = `
            Based on the following research summary about the topic "${topic}", create three distinct creative strategies.
            
            **Research Summary**:
            ---
            ${researchSummary}
            ---

            **IMPORTANT**:
            - You MUST detect the language from the research summary (it will be either Chinese or English).
            - You MUST generate all parts of your response (title, description, and both prompts) exclusively in that SAME language. Do not mix languages.

            **Output Format**:
            Return a valid JSON array of three objects adhering to this TypeScript interface. Do not include any text outside the JSON.
            \`\`\`typescript
            interface DesignPlanWithImagePrompt {
              title: string; // A creative title for the design strategy.
              description: string; // A short explanation of the visual direction.
              prompt: string; // A detailed, ready-to-use prompt for the FINAL image creation if the user chooses this plan.
              referenceImagePrompt: string; // A separate, detailed prompt specifically for generating a high-quality REFERENCE image that visually represents this strategy's mood and style.
            }
            \`\`\`
        `;

        const structuringResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: structuringPrompt,
            config: { 
                responseMimeType: "application/json",
            }
        });
        
        return safeJsonParse(structuringResponse.text ?? '[]', []);
    });
};

export const summarizePrompt = async (prompt: string): Promise<string> => {
    return callApiWithRetry(async () => {
        const apiPrompt = `
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
            Prompt: "${prompt}"
            Summary:
        `;
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: apiPrompt });
        return response.text?.trim() || prompt.substring(0, 40) + '...';
    });
};

export const removeBackground = async (base64Data: string, mimeType: string): Promise<{ base64Image: string }> => {
    return callApiWithRetry(async () => {
        const modelName = 'gemini-2.5-flash-image';
        
        const prompt = `
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
`;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: base64Data } },
                    { text: prompt }
                ]
            },
            config: {
                responseModalities: [Modality.IMAGE],
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return { base64Image: part.inlineData.data };
            }
        }
        throw new Error("Background removal failed: No image returned.");
    });
};

// --- FALLBACKS for robustness ---
export const fallbackSeoReport = (url: string): SeoDiagnosisReport => ({
    siteUrl: url,
    contentSeoHealthScore: 68,
    coreInsight: "网站在 'eco-friendly accessories' 领域有一定内容基础，但缺乏深度和权威性来与顶级竞争对手抗衡。",
    keywordTopicFit: {
        analysis: "内容主要集中在产品页面，缺少解决用户早期认知阶段问题的博客文章。",
        recommendation: "创建 '什么是可持续时尚？' 或 '如何选择环保钱包？' 等主题的入门指南，以吸引更广泛的受众。",
        topicalKeywords: ["sustainable fashion", "eco-friendly wallet", "vegan leather"]
    },
    topicalAuthority: {
        analysis: "缺乏将相关内容链接在一起的支柱页面或内容中心，导致权重分散。",
        recommendation: "建立一个 '可持续生活方式' 的内容中心，并将其链接到所有相关的博客文章和产品页面。"
    },
    userIntentCoverage: {
        analysis: "网站在交易意图方面表现良好，但在信息和商业调查意图方面内容覆盖不足。",
        recommendation: "发布产品比较文章（例如，'我们的纯素皮革 vs. 传统皮革'）和深入的材料指南，以满足用户的研究需求。"
    },
    contentDiscoverability: {
        analysis: "robots.txt 文件没有明显问题，网站地图似乎已提交。",
        recommendation: "通过在社交媒体和相关论坛上积极推广新内容，专注于改善站外信号。"
    }
});

export const fallbackCompetitors: Competitor[] = [
    { id: 'comp-fb-1', url: 'www.corkor.com', reasonText: '专注于软木等环保材料的钱包和配饰。' },
    { id: 'comp-fb-2', url: 'www.mattandnat.com', reasonText: '知名纯素皮革手袋和配饰品牌。' },
    { id: 'comp-fb-3', url: 'www.angelaroi.com', reasonText: '高端设计师纯素手袋品牌。' },
];

export const fallbackCompetitorAnalysisReport = (competitors: Competitor[]): CompetitorAnalysisReport => ({
    ragArticles: ragKnowledgeBase.slice(0, 2),
    competitiveLandscape: {
        overallTrend: "竞争对手正大力投入视频内容和YouTube教程，以展示产品用例。",
        yourDisadvantage: "您的网站缺乏强大的教育内容中心来吸引渠道顶层的用户。",
        strategicOpportunity: "可以创建一个“创作者聚焦”系列，展示用户生成的内容，以建立社区并有机地展示产品。"
    },
    competitors: competitors.map(c => ({
        ...c,
        contentSeoScore: 75 + Math.floor(Math.random() * 10),
        topArticle: {
            title: "Our Guide to Vegan Leather",
            url: `https://${c.url}/blog/guide-to-vegan-leather`,
            reason: "This article serves as a comprehensive educational resource, building trust and authority."
        }
    }))
});

export const fallbackSolutionBoard: SolutionBoard = [
    {
        id: "sol-fb-1",
        strategyName: "建立主题权威：打造“终极环保材料指南”",
        seoGoal: "围绕核心环保材料建立主题权威，捕获高意向的教育性搜索流量。",
        coreConcept: "创建一个内容丰富的“支柱页面”，深入介绍各种环保材料（软木、纯素皮革、再生塑料等），然后链接到针对每种材料的详细“辐条文章”。",
        contentExamples: [
            "终极指南：为您的下一个产品选择最佳的环保材料",
            "软木皮革：您需要知道的一切",
            "深度评测：我们的再生海洋塑料面料"
        ],
        strategicReason: "此策略直接解决了您在主题权威性方面的弱点，并通过建立一个全面的知识中心将您定位为行业专家。"
    },
    {
        id: "sol-fb-2",
        strategyName: "解决用户痛点：发布“问题-解决方案”系列内容",
        seoGoal: "通过解决特定用户问题来吸引处于考虑阶段的受众，并巧妙地将您的产品定位为解决方案。",
        coreConcept: "创建一系列针对常见问题的博客文章或视频，例如“如何找到一款既时尚又耐用的纯素钱包？”或“旅行时如何让您的配饰井井有条？”。",
        contentExamples: [
            "告别混乱：5个技巧让您的日常手袋井井有条",
            "寻找完美的礼物？我们的可持续礼品指南",
            "旅行必备：为什么我们的多功能背包是您的最佳选择"
        ],
        strategicReason: "此策略旨在填补您在用户意图覆盖方面的空白，通过提供实用价值来建立品牌偏好，从而推动转化。"
    },
];

export const fallbackContentBrief = (solution: SolutionOption): ContentBrief => ({
    titleSuggestion: `终极指南：${solution.contentExamples[0]}`,
    topicSummary: "一篇全面的指南文章，旨在教育读者了解不同类型的环保材料，并帮助他们为自己的需求做出最佳选择。",
    targetRegion: "United States",
    targetLanguage: "English",
    mainKeyword: "eco-friendly materials",
    secondaryKeywords: ["sustainable fabrics", "vegan leather alternatives", "recycled materials"],
    suggestedOutline: [
        "Introduction: Why Choosing Eco-Friendly Materials Matters",
        "## Plant-Based Materials: Cork, Hemp, and Organic Cotton",
        "### The Benefits of Cork Leather",
        "## Recycled Materials: From Plastic Bottles to Fashion",
        "## Innovative Vegan Leathers: Apple, Pineapple, and Mushroom",
        "## How to Care for Your Eco-Friendly Accessories",
        "Conclusion: Making a Sustainable Choice"
    ],
    estimatedWordcount: 1500,
    aiRecommendations: [
        "保持信息丰富且易于理解的语气。",
        "使用项目符号列表和粗体文本来分解复杂信息。",
        "在适当的时候，巧妙地引用我们自己使用这些材料的产品。"
    ]
});

export const fallbackArticle = (brief: ContentBrief): string => `# ${brief.titleSuggestion}\n\nThis is a fallback article generated because the AI writer failed. Please review the content brief and try again.\n\n${brief.suggestedOutline.join('\n\n')}`;

export const fallbackPreflightReport: PreflightReport = {
    score: 85,
    issues: [
        {
            type: 'Readability',
            description: "The paragraph under 'Innovative Vegan Leathers' is a bit long and dense.",
            suggestion: "Break the long paragraph into 2-3 shorter ones and use a bulleted list to highlight the different types of vegan leather."
        }
    ]
};

export const brandProfileService = {
    // ... (kept for compatibility if needed, though unused here)
};
