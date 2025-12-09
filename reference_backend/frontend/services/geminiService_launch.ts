import { GoogleGenAI, Type, GenerateContentResponse, FunctionDeclaration, HarmCategory, HarmBlockThreshold, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
const model = 'gemini-2.5-flash';

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null) return JSON.stringify(error);
    return String(error);
}

async function callApiWithRetry<T>(apiCall: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
    let attempt = 0;
    while (true) {
        try {
            return await apiCall();
        } catch (e: any) {
            attempt++;
            const status = e?.status || e?.response?.status || e?.httpStatus;
            const isRetriable = status === 429 || (status && status >= 500 && status < 600) || e?.message?.includes('fetch failed');

            if (!isRetriable || attempt >= maxRetries) {
                const errorMessage = getErrorMessage(e);
                if (typeof status === 'undefined') {
                    console.error(`API call failed after ${attempt} attempts with a non-retriable error.`, errorMessage);
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

// --- INTENT ANALYSIS ---
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

export const analyzeUserIntent = async (prompt: string): Promise<{ intent: string; url: string | null; query: string | null }> => {
    return callApiWithRetry(async () => {
        const genAIPrompt = `
            Analyze the user's request and determine their intent.

            User Request: "${prompt}"

            **Routing Logic**:
            1.  If the request is about SEO analysis, blog writing, content strategy, or clearly contains a website URL for analysis, the intent is "SEO". Extract the URL.
            2.  If the request is about creating, generating, or drawing an image or picture, the intent is "IMAGE_GENERATION".
            3.  If the request is about creating, generating, or making a video, the intent is "IMAGE_GENERATION" but include "video" in the query to trigger correct downstream routing.
            4.  For anything else, the intent is "OTHER".

            Call the 'route_user_request' function with the determined intent and extracted information.
        `;

        try {
            const response: GenerateContentResponse = await ai.models.generateContent({
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

export const generateInspirationImage = async (fullPrompt: string): Promise<string> => {
    return callApiWithRetry(async () => {
        const promptForImage = fullPrompt.replace(/^创建AI图片\s*/, '').replace(/^创建AI视频\s*/, '');
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: promptForImage }] },
                config: {
                    responseModalities: [Modality.IMAGE],
                    safetySettings: [
                        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    ]
                },
            });

            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    return part.inlineData.data;
                }
            }
            throw new Error("No image generated");
        } catch (error) {
            console.warn("Flash Image failed for inspiration, falling back to Imagen.", error);
            try {
                 const response = await ai.models.generateContent({
                    model: 'gemini-3-pro-image-preview',
                    contents: { parts: [{ text: promptForImage }] },
                    config: { 
                        responseModalities: [Modality.IMAGE],
                        safetySettings: [
                            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        ]
                    },
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