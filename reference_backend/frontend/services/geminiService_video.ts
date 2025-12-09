
import { GoogleGenAI, Type, Modality, GenerateContentResponse, FunctionDeclaration, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { VideoMessage, EnhancedPrompt } from '../types';

// Helper to get error message safely
const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null) return JSON.stringify(error);
    return String(error);
}

// Helper to parse JSON safely
function safeJsonParse(jsonString: string, fallback: any) {
    try {
        let textToParse = jsonString;
        const jsonStartIndex = textToParse.indexOf('{');
        const arrayStartIndex = textToParse.indexOf('[');

        let startIndex = -1;

        if (jsonStartIndex > -1 && arrayStartIndex > -1) {
            startIndex = Math.min(jsonStartIndex, arrayStartIndex);
        } else if (jsonStartIndex > -1) {
            startIndex = jsonStartIndex;
        } else {
            startIndex = arrayStartIndex;
        }

        if (startIndex === -1) {
            throw new Error("No JSON object or array found in the string.");
        }
        
        textToParse = textToParse.substring(startIndex);
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

// Helper to retry API calls
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
                console.error(`API call failed after ${attempt} attempts.`, errorMessage);
                throw e;
            }
            
            let delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// --- 1. PROMPT ENHANCEMENT (VEO 3.1 SPECIALIST) ---

export const enhancePrompt = async (prompt: string): Promise<EnhancedPrompt[]> => {
    return callApiWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const model = 'gemini-2.5-flash';

        const systemInstruction = `You are a Senior VEO 3.1 Prompt Specialist & Cinematic Director. Your task is to transform a user's basic idea into three distinct, professional creative directions for high-end video generation.

The Veo model requires specific prompt engineering to achieve the best results. You must strictly follow these VEO Golden Rules in your \`fullPrompt\`:
1.  **Subject & Action**: Describe fluid motion, physics, and specific activities clearly (not just who, but *what* they are doing dynamically).
2.  **Environment & Lighting**: Include atmospheric details (e.g., volumetric fog, golden hour, cinematic lighting, HDR, neon noir).
3.  **Camera Language**: MANDATORY. Use specific cinematic terms (e.g., Drone FPV, Low angle, Dolly zoom, Slow pan, Handheld shake, Bokeh, Rack focus).
4.  **Style & Aesthetics**: Specify film stock, render engine, or artistic style (e.g., 35mm film grain, Photorealistic, 8k, Unreal Engine 5 style).

Based on the user's idea ("${prompt}"), generate three distinct "Video Concept Cards" that tell a story:
- **Option A (Realistic/Cinematic)**: Focus on photorealism, movie-like quality, high-end production value (ARRI/IMAX aesthetics).
- **Option B (Creative/Stylized)**: Focus on unique art styles, animation (e.g., claymation, cyber-anime), or surreal visuals.
- **Option C (Dynamic/Action)**: Focus on speed, intense motion, fast cuts, and visual impact.

For each card, provide:
1.  \`title\`: A short, catchy title (e.g., "Neon Drift: Cyberpunk").
2.  \`description\`: A one-sentence summary of the narrative and visual mood.
3.  \`tags\`: An array of 3-4 relevant keyword tags.
4.  \`fullPrompt\`: A comprehensive, detailed prompt using the VEO Golden Rules above.

IMPORTANT: Detect the language of the user's idea (it will be either Chinese or English). You MUST generate all content for the cards (titles, descriptions, tags, and full prompts) in that SAME language (or Chinese mixed with English technical terms if the input is Chinese).
`;

        const userContent = `The user's idea is: "${prompt}"`;

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

// --- 2. INSPIRATION ENGINE (VEO 3.1 STANDARDS) ---

export const getDesignPlan = async (topic: string): Promise<any[]> => {
    return callApiWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        // Phase 1: Deep Visual Intelligence Search
        const researchPrompt = `
            Act as an AI Cinematography & Motion Trend Researcher.
            Conduct a deep dive search on Google for the topic: "${topic}".
            
            Do NOT just search for general definitions. You must find:
            1.  **Cinematic Lighting Trends** relevant to this topic (e.g., Volumetric lighting, Rembrandt, Neon noir).
            2.  **Camera Movement Trends** (e.g., FPV Drone, Dolly Zoom, Orbit shot, Handheld).
            3.  **Motion Aesthetics** (e.g., Slow motion fluid, Hyper-lapse, Morphing).
            4.  **Render/Visual Styles** (e.g., Unreal Engine 5, Analog film grain, Claymation).

            Detect the language of the topic (Chinese or English). Provide a concise but technical summary in that same language, focusing on "How to shoot it" rather than just "What it is".
        `;

        const researchResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: researchPrompt,
            config: { tools: [{ googleSearch: {} }] }
        });
        const researchSummary = researchResponse.text ?? '';

        // Phase 2: VEO Director Level Scheme Construction
        const structuringPrompt = `
            Act as a VEO 3.1 Creative Director.
            Based on the following Visual Research Summary about "${topic}", create three distinct video production schemes.

            Research Summary:
            ${researchSummary}

            Create these 3 schemes:
            - **Scheme A: Cinematic Masterpiece** (Realistic, Physical Light, High-end Camera).
            - **Scheme B: Avant-Garde / Stylized** (Unique Art Style, Animation, Mixed Media).
            - **Scheme C: Commercial / Dynamic** (High Impact, Fast Paced, Product Showcase).

            For each scheme, provide a JSON object with:
            1.  \`title\`: Creative title.
            2.  \`description\`: Brief visual summary.
            3.  \`referenceImagePrompt\`: **CRITICAL**: This must describe a single **KEYFRAME** (First Frame) composition. Use terms like "A still shot of...", "Hyper-realistic photography of...", "Golden ratio composition". Do not describe motion here, only the static visual start point.
            4.  \`prompt\`: The video generation prompt. Must follow the **[Subject + Action + Environment + Lighting + Camera + Style]** formula. Include specific camera moves (e.g., "Slow dolly in") and temporal details.

            Output: A valid JSON array of 3 objects. Use the same language as the input topic.
        `;

        const structuringResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: structuringPrompt,
            config: { responseMimeType: "application/json" }
        });
        
        return safeJsonParse(structuringResponse.text ?? '[]', []);
    });
};

// --- 3. CREATIVE DIRECTOR (CONTEXT AWARE) ---

export const getVideoCreativeDirectorAction = async (
    userPrompt: string,
    chatHistory: VideoMessage[],
    selectedVideoId: string | null,
    lastGeneratedVideoId: string | null
): Promise<{ action: string; prompt: string; reasoning: string; targetVideoId?: string; }> => {
    return callApiWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const historyForPrompt = chatHistory
            .slice(-4)
            .map(msg => `${msg.role}: ${typeof msg.content === 'string' ? msg.content : `[${msg.type} message]`}`)
            .join('\n');

        const prompt = `
            You are an AI Video Director. Analyze the user's request in the context of a video creation session.

            **Context**:
            - Explicitly Selected Video ID: ${selectedVideoId || 'None'}
            - Last Generated Video ID: ${lastGeneratedVideoId || 'None'}
            - Recent Chat:
            ${historyForPrompt}
            - User Request: "${userPrompt}"

            **Logic**:
            1.  **EDIT_VIDEO**: If the user wants to change, modify, extend, or iterate on a video (e.g., "make it faster", "change style to claymation", "redo this"), the action is EDIT_VIDEO.
                - **Infer Target**: If a video is selected, use \`selectedVideoId\`. If not, but the user implies the previous one (e.g. "change it"), use \`lastGeneratedVideoId\`.
            2.  **NEW_VIDEO**: If the user wants a completely new subject or scene (e.g., "show me a cat instead", "create a video of space").
            3.  **ANSWER_QUESTION**: If it's a general question or conversational remark.

            **Output**: Call 'video_creative_director_action'.
            - \`action\`: "EDIT_VIDEO" | "NEW_VIDEO" | "ANSWER_QUESTION"
            - \`prompt\`: The refined video generation prompt (or text answer).
            - \`reasoning\`: Brief explanation in Chinese (e.g., "好的，基于上一条视频为您调整风格...").
            - \`targetVideoId\`: The ID of the video to edit/reference (if action is EDIT_VIDEO).
        `;

        const tool: FunctionDeclaration = {
            name: 'video_creative_director_action',
            description: 'Determines the next action for video creation.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    action: { type: Type.STRING, description: '"EDIT_VIDEO", "NEW_VIDEO", or "ANSWER_QUESTION"' },
                    prompt: { type: Type.STRING, description: 'Refined prompt or text answer' },
                    reasoning: { type: Type.STRING, description: 'Explanation in Chinese' },
                    targetVideoId: { type: Type.STRING, description: 'ID of the video to act upon' }
                },
                required: ['action', 'prompt', 'reasoning']
            }
        };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: { tools: [{ functionDeclarations: [tool] }] }
        });

        if (response.functionCalls && response.functionCalls.length > 0) {
            return response.functionCalls[0].args as any;
        }

        return {
            action: 'NEW_VIDEO',
            prompt: userPrompt,
            reasoning: `好的，正在为您生成关于“${userPrompt}”的视频。`,
        };
    });
};

// --- 4. VIDEO GENERATION (WITH CORS FALLBACK) ---

export const generateVideo = async (
    prompt: string, 
    images: {data: string, mimeType: string}[], 
    aspectRatio: '16:9' | '9:16', 
    modelName: 'veo_fast' | 'veo_gen' = 'veo_fast'
): Promise<{ videoUri: string }> => {
    return callApiWithRetry(async () => {
        // 1. Get dynamic API key inside the function
        const apiKey = process.env.API_KEY ? process.env.API_KEY.trim() : "";
        if (!apiKey) {
             throw new Error("API Key is missing. Please select a valid key.");
        }
        
        const ai = new GoogleGenAI({ apiKey });

        const actualModel = modelName === 'veo_gen' ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview';
        const resolution = '720p'; // Default for preview

        const config: any = {
            numberOfVideos: 1,
            resolution: resolution,
            aspectRatio: aspectRatio
        };

        let operation: any;

        // Image-to-Video
        if (images.length > 0) {
            const imagePart = {
                imageBytes: images[0].data,
                mimeType: images[0].mimeType
            };
            
            // Check for last frame (2 images)
            if (images.length >= 2) {
                 config.lastFrame = {
                    imageBytes: images[1].data,
                    mimeType: images[1].mimeType
                };
            }
            
            operation = await ai.models.generateVideos({
                model: actualModel,
                prompt: prompt, // Prompt is optional but recommended for Veo
                image: imagePart,
                config: config
            });
        } 
        // Text-to-Video
        else {
            operation = await ai.models.generateVideos({
                model: actualModel,
                prompt: prompt,
                config: config
            });
        }

        // Poll for completion
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
            operation = await ai.operations.getVideosOperation({operation: operation});
        }

        const rawVideoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!rawVideoUri) {
            throw new Error("Video generation completed but no URI returned.");
        }

        // 2. Securely construct URL with API key using URL object
        let finalVideoUri = rawVideoUri;
        try {
            const url = new URL(rawVideoUri);
            // If the raw URL already happens to have a key (unlikely), remove it to avoid dupes
            url.searchParams.delete('key');
            url.searchParams.set('key', apiKey);
            finalVideoUri = url.toString();
        } catch (e) {
             console.warn("Failed to parse video URI, falling back to manual concatenation", e);
             // Fallback for edge cases
             const separator = rawVideoUri.includes('?') ? '&' : '?';
             finalVideoUri = `${rawVideoUri}${separator}key=${apiKey}`;
        }

        // 3. Try to fetch as blob to avoid CORS issues in some browsers if possible, 
        // otherwise return the signed link.
        try {
            const videoRes = await fetch(finalVideoUri, {
                referrerPolicy: 'no-referrer'
            });
            if (videoRes.ok) {
                const blob = await videoRes.blob();
                // Convert to object URL which is CORS-safe for video tags
                return { videoUri: URL.createObjectURL(blob) };
            }
        } catch (error) {
            console.warn("CORS/Fetch failed for video, falling back to raw URI.", error);
        }

        // Fallback: Return the signed URI directly
        return { videoUri: finalVideoUri };
    });
};

// --- HELPERS (Keep existing) ---

export const summarizePrompt = async (prompt: string): Promise<string> => {
    return callApiWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        const apiPrompt = `Summarize: "${prompt}" into max 5 words.`;
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: apiPrompt });
        return response.text?.trim() || prompt.substring(0, 20);
    });
};

export const generateReferenceImage = async (prompt: string): Promise<{ base64Image: string }> => {
    return callApiWithRetry(async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
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
