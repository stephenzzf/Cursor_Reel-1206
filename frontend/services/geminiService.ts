
// ... (imports remain the same)
import { GoogleGenAI, Type, Modality, GenerateContentResponse, FunctionDeclaration, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ImageMessage, EnhancedPrompt, BrandVisualProfile } from '../types';

// ... (helper functions remain the same: getErrorMessage, safeJsonParse, callApiWithRetry)
const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null) return JSON.stringify(error);
    return String(error);
}

// Enhanced safeJsonParse to handle common LLM output issues
function safeJsonParse(jsonString: string, fallback: any) {
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
        
        // Find the last matching bracket to handle trailing text (e.g. "```" or hallucinations)
        const endChar = isArray ? ']' : '}';
        const lastIndex = textToParse.lastIndexOf(endChar);
        if (lastIndex !== -1) {
            textToParse = textToParse.substring(0, lastIndex + 1);
        }

        textToParse = textToParse.trim();
        // Remove trailing commas which are invalid in JSON but common in LLM output
        textToParse = textToParse.replace(/,(\s*[}\]])/g, '$1');

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

// ... (other exports: getCreativeDirectorAction, generateImage, upscaleImage, extractBrandDNA, enhancePrompt)
export const getCreativeDirectorAction = async (
    userPrompt: string,
    selectedImageId: string | null,
    lastGeneratedImageId: string | null,
    chatHistory: ImageMessage[],
    activeImageDesc?: string,
    prevImageDesc?: string,
    hasUploadedFiles?: boolean
): Promise<{ action: string; prompt: string; reasoning: string; targetImageId?: string; }> => {
    return callApiWithRetry(async () => {
        const apiKey = process.env.API_KEY || '';
        if (!apiKey) throw new Error("API Key is missing for Creative Director.");
        
        const ai = new GoogleGenAI({ apiKey });
        
        const historyForPrompt = chatHistory
            .slice(-10) // Increased context window for better continuity
            .map(msg => `${msg.role}: ${typeof msg.content === 'string' ? msg.content : `[${msg.type} message]`}`)
            .join('\n');

        const activeContext = activeImageDesc ? `Content: "${activeImageDesc}"` : 'None';
        const prevContext = prevImageDesc ? `Content: "${prevImageDesc}"` : 'None';
        const uploadContext = hasUploadedFiles ? 'Yes (User has uploaded images for processing)' : 'No';

        const prompt = `
            You are an expert AI Creative Director for an image generation tool.
            Your goal is to accurately classify the user's intent into one of three actions: **EDIT_IMAGE**, **NEW_CREATION**, or **ANSWER_QUESTION**.

            **Current Visual Context**:
            1.  **Active Selection (Explicitly Selected Image)**: ID=${selectedImageId || 'None'} | ${activeContext}
            2.  **Previous Generation (Last Image Created)**: ID=${lastGeneratedImageId || 'None'} | ${prevContext}
            3.  **Pending Uploads**: ${uploadContext}

            **Conversation History (Last 10 turns)**:
            ${historyForPrompt}

            **User's Latest Input**: "${userPrompt}"

            **Decision Logic (Step-by-Step)**:
            1.  **Analyze Context**: 
                - Is there an active selection? (Prioritize editing this).
                - **Are there Pending Uploads?** (HIGHEST PRIORITY: If yes, this is likely an Image-to-Image request).
                - Is there a previous generation?
            2.  **Analyze Input**:
                -   **Modification** (Verbs/Adjectives): "make it darker", "add a cat", "change style to anime", "remove background", "transform this", "change background to red", "redesign", "refine".
                -   **New Subject** (Nouns/Descriptions): "a cyberpunk city", "cute cat", "logo design".
                -   **Conversational**: "hello", "how are you", "what can you do".
            3.  **Determine Action & Target**:
                -   **RULE 1 (Uploads - CRITICAL)**: If **Pending Uploads** is "Yes", output action **NEW_CREATION**. Reasoning: "Using your uploaded image as reference...". Ignore "Edit" language in text if it conflicts with using the upload as a base.
                -   **RULE 2 (Selection)**: If **EDIT_IMAGE** intent and \`selectedImageId\` exists -> **EDIT_IMAGE**. Target is \`selectedImageId\`.
                -   **RULE 3 (History)**: If **EDIT_IMAGE** intent and NO selection, but \`lastGeneratedImageId\` exists -> **EDIT_IMAGE**. Target is \`lastGeneratedImageId\`.
                -   **RULE 4 (Fallback)**: If **EDIT_IMAGE** intent but NO images exist AND NO uploads -> Fallback to **NEW_CREATION** (start fresh).

            **Prompt Engineering Rules (CRITICAL FOR EDITING)**:
            - If **EDIT_IMAGE**: The \`prompt\` MUST describe the **FULL RESULT SCENE**.
              - **INCORRECT**: "Make it cyberpunk", "Change background to forest", "Add a hat".
              - **CORRECT**: "A portrait of a woman wearing a hat", "A red car driving through a lush forest", "A cyberpunk city street".
              - **RULE**: You MUST Combine the [Subject Description from Context] + [User's Change Request]. **Do NOT lose the main subject** unless explicitly asked to remove it.
            - If **NEW_CREATION**: Write a detailed, descriptive prompt in English.

            **Output Requirement**:
            Call the function \`creative_director_action\` with:
            -   \`action\`: The classification.
            -   \`prompt\`: The refined image generation prompt. **IMPORTANT: This MUST be in ENGLISH**, regardless of the user's input language. Translate and optimize the user's request (including edit instructions) into a detailed English visual description that describes the *result* (e.g. "A red cat" instead of "Make it red").
            -   \`reasoning\`: A short, friendly explanation **in Simplified Chinese** (e.g., "好的，为您修改选中的图片，将其背景改为红色...", "明白，正在基于您的描述生成...").
            -   \`targetImageId\`: The specific image ID to edit (required for EDIT_IMAGE).
        `;

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
                        description: 'The refined prompt in English. For ANSWER_QUESTION, this is the text response.'
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

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                tools: [{ functionDeclarations: [creativeDirectorTool] }]
            }
        });

        if (response.functionCalls && response.functionCalls.length > 0) {
            const args = response.functionCalls[0].args as { action: string; prompt: string; reasoning: string; targetImageId?: string; };
            return args;
        }

        return {
            action: 'NEW_CREATION',
            prompt: userPrompt,
            reasoning: `好的，正在为您创作关于“${userPrompt}”的图片。`,
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
        const apiKey = process.env.API_KEY || '';
        if (!apiKey) throw new Error("API Key is missing for Image Generation.");
        
        const ai = new GoogleGenAI({ apiKey });
        const modelName = modelLevel === 'banana_pro' 
            ? 'gemini-3-pro-image-preview' 
            : 'gemini-2.5-flash-image';

        const parts: any[] = [];
        images.forEach(img => {
            parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
        });
        parts.push({ text: prompt });

        const config: any = {
            responseModalities: [Modality.IMAGE],
            imageConfig: { aspectRatio: aspectRatio },
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ]
        };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName,
            contents: { parts: parts },
            config: config,
        });
        
        const candidate = response.candidates?.[0];
        if (!candidate) {
             throw new Error("No candidates returned from model. The request might have been blocked.");
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
        let errorMsg = `Image generation failed.`;
        if (finishReason) errorMsg += ` Reason: ${finishReason}`;
        if (textOutput) errorMsg += ` Model Message: ${textOutput}`;
        
        // Handling strict refusal
        if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'OTHER') {
            throw new Error(`Generation blocked by safety filters (${finishReason}). Please modify your prompt.`);
        }
        
        if (finishReason === 'STOP' && !textOutput) {
             // This edge case happens when the model returns nothing but valid stop
             throw new Error("Model finished but returned no image data. Please try again.");
        }

        throw new Error(errorMsg);
    });
};

export const upscaleImage = async (base64Data: string, mimeType: string, targetSize: '2K' | '4K', originalPrompt: string): Promise<{ base64Image: string }> => {
    return callApiWithRetry(async () => {
        const apiKey = process.env.API_KEY || '';
        if (!apiKey) throw new Error("API Key is missing for Upscaling.");

        const ai = new GoogleGenAI({ apiKey });
        
        // Use Gemini 3 Pro Vision for Content-Aware Upscaling (Image-to-Image)
        const modelName = 'gemini-3-pro-image-preview';
        
        // "Quality Descriptor" Prompt - No hallucinations, just fidelity.
        // We instruct the model to act as a restoration engine.
        const fidelityPrompt = `
            High-fidelity digital reproduction. Create a pristine, ${targetSize} resolution version of this input image.
            
            Strict Instructions:
            1. Strictly maintain the exact composition, subject identity, colors, and lighting.
            2. Do NOT add or remove any elements. Do NOT change facial features.
            3. Focus solely on enhancing texture sharpness, removing compression artifacts, and upscaling detail.
            4. This is a technical restoration task, not a creative generation task.
            
            Original Context (for semantic understanding only): "${originalPrompt}"
        `;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: base64Data } },
                    { text: fidelityPrompt }
                ]
            },
            config: {
                imageConfig: {
                    imageSize: targetSize // Native support for '2K' or '4K'
                },
                // ZERO temperature is critical for consistency
                temperature: 0.0,
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ]
            }
        });

        const candidate = response.candidates?.[0];
        if (!candidate) throw new Error("Upscaling failed: No candidate returned.");

        for (const part of candidate.content?.parts || []) {
            if (part.inlineData) {
                return { base64Image: part.inlineData.data };
            }
        }
        
        throw new Error("Upscaling failed: No image data in response.");
    });
};

export const extractBrandDNA = async (
    logoImage: { data: string, mimeType: string } | null,
    referenceImages: { data: string, mimeType: string }[],
    description: string,
    videoUrls?: string[] // NEW: YouTube Video URLs for analysis
): Promise<Partial<BrandVisualProfile>> => {
    return callApiWithRetry(async () => {
        const apiKey = process.env.API_KEY || '';
        const ai = new GoogleGenAI({ apiKey });
        
        const systemInstruction = `
            You are a Senior Art Director and Brand Specialist. 
            Your task is to analyze brand visual assets (Logo, Reference Images, and potentially Video URLs) along with a description to extract precise, structured visual guidelines (Brand DNA).
            
            ROLE:
            - Analyze the **Logo** (if provided) for Brand Color Palette.
            - Analyze the **Reference Images** for Visual Style, Photography Direction, Lighting, and Mood.
            - If **Video URLs** are provided, use Google Search to find information about their visual style (cinematography, camera movement, pace) to extract "Motion Style".
            - Synthesize these into a cohesive "Visual System".
        `;

        const parts: any[] = [];
        
        // Add Logo first (if exists)
        if (logoImage) {
            parts.push({ inlineData: { mimeType: logoImage.mimeType, data: logoImage.data } });
        }
        
        // Add References
        referenceImages.forEach(img => {
            parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
        });

        // Add Text Prompt
        let analysisPrompt = `
            Analyze the provided assets and brand description: "${description}".
            
            ${logoImage ? "Asset 1 is the BRAND LOGO. Use it to determine the primary brand colors." : "No Logo provided."}
            ${referenceImages.length > 0 ? `The remaining ${referenceImages.length} images are STYLE REFERENCES. Use them to determine lighting, composition, and mood.` : ""}
            
            ${videoUrls && videoUrls.length > 0 ? `
            **VIDEO ANALYSIS TASK:**
            The user provided these video references: ${videoUrls.join(', ')}.
            Since you cannot watch them directly, use your **Google Search tool** to find descriptions, reviews, or technical breakdowns of these videos or the channel's general style.
            Look for keywords related to: Camera Movement (e.g., handheld, drone, stable), Pacing (e.g., fast cut, slow motion), and Atmosphere.
            Summarize this into a "Motion Style" string suitable for video generation prompts.
            ` : "No video references provided."}

            Extract the following "Brand DNA" components:
            
            1. **Visual Style**: Describe composition, lighting, texture, and rendering style. (e.g., "Matte finish, soft diffused lighting, centered composition, minimalist").
            2. **Color Palette**: Describe key colors and tonal balance. (e.g., "Primary Purple #6366F1, Dark Background, high key").
            3. **Mood**: Describe the emotional atmosphere. (e.g., "Serene, organic, trustworthy, futuristic").
            4. **Negative Constraints**: What visual elements MUST be avoided? (e.g., "No neon, no grunge, no dark shadows").
            5. **Motion Style**: (If videos provided) Describe the movement/pace. If no videos, infer a safe default based on Visual Style (e.g. if 'Serene' -> 'Slow smooth pan').

            Return result as JSON:
            {
                "visualStyle": "string",
                "colorPalette": "string",
                "mood": "string",
                "negativeConstraint": "string",
                "motionStyle": "string"
            }
        `;
        
        parts.push({ text: analysisPrompt });

        const config: any = {
            systemInstruction,
        };

        // API Limitation Fix:
        // 'tools' and 'responseMimeType: "application/json"' cannot be used together.
        if (videoUrls && videoUrls.length > 0) {
            // Using tools -> Remove strict JSON mime type, rely on prompt & safe parsing
            config.tools = [{ googleSearch: {} }];
        } else {
            // No tools -> Safely enforce JSON mode
            config.responseMimeType = "application/json";
        }

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Multimodal + Tools
            contents: { parts },
            config: config
        });

        return safeJsonParse(response.text ?? '{}', {
            visualStyle: "Clean and professional",
            colorPalette: "Neutral tones",
            mood: "Trustworthy",
            negativeConstraint: "Distorted visuals",
            motionStyle: "Smooth and steady"
        });
    });
};

export const enhancePrompt = async (
    prompt: string, 
    image?: { data: string, mimeType: string },
    brandProfile?: BrandVisualProfile
): Promise<EnhancedPrompt[]> => {
    return callApiWithRetry(async () => {
        const apiKey = process.env.API_KEY || '';
        const ai = new GoogleGenAI({ apiKey });
        const model = 'gemini-2.5-flash'; 
        const systemInstruction = `You are an expert AI Art Director. Your task is to transform a user's basic idea into three distinct, professional creative directions. You must return a valid JSON array of objects.`;
        
        let brandContext = "";
        if (brandProfile && brandProfile.isActive) {
            brandContext = `
            **MANDATORY BRAND GUIDELINES (Brand DNA)**:
            - **Visual Style**: ${brandProfile.visualStyle}
            - **Color Palette**: ${brandProfile.colorPalette}
            - **Mood**: ${brandProfile.mood}
            - **Negative Constraints (AVOID)**: ${brandProfile.negativeConstraint}
            
            IMPORTANT: All generated prompt options MUST strictly adhere to these brand guidelines. Integrate them naturally into the visual description.
            `;
        }

        const textPart = `
        The user's idea is: "${prompt}"
        ${image ? "REFER TO THE UPLOADED IMAGE for visual style, composition, or subject reference." : ""}
        ${brandContext}

        Based on this idea${image ? " and the reference image" : ""}${brandContext ? " and the Brand DNA" : ""}, generate three distinct "Prompt Optimization Cards". For each card, provide:
        1.  \`title\`: A short, catchy title for the creative direction **in Simplified Chinese**.
        2.  \`description\`: A one-sentence summary of the style and mood **in Simplified Chinese**.
        3.  \`tags\`: An array of 3-4 relevant keyword tags **in Simplified Chinese**.
        4.  \`fullPrompt\`: A complete, detailed, and enhanced prompt for the 'gemini-2.5-flash-image' model. **MUST BE IN ENGLISH**.

        IMPORTANT: The UI fields (title, description, tags) MUST be in Chinese. The generation field (fullPrompt) MUST be in English.
        `;

        let contents: any;
        if (image) {
            contents = {
                parts: [
                    { inlineData: { mimeType: image.mimeType, data: image.data } },
                    { text: textPart }
                ]
            };
        } else {
            contents = textPart;
        }

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: {
                systemInstruction,
                responseMimeType: "application/json"
            }
        });
        
        const fallbackResult: EnhancedPrompt[] = [{
            title: "优化提示词",
            description: "Detailed description of the user's idea.",
            tags: ["optimized", "visual"],
            fullPrompt: prompt 
        }];

        return safeJsonParse(response.text ?? '[]', fallbackResult);
    });
};

export const getDesignPlan = async (
    topic: string, 
    image?: { data: string, mimeType: string },
    brandProfile?: BrandVisualProfile
): Promise<any[]> => {
    // 1. Research Phase with Automatic Retry
    const apiKey = process.env.API_KEY || '';
    const ai = new GoogleGenAI({ apiKey });
    
    let researchSummary = "";
    let searchAttempt = 0;
    const MAX_SEARCH_ATTEMPTS = 2;

    const researchText = `
        As an AI Art Director and visual trend researcher, use Google Search to research current visual trends, popular aesthetics, color palettes, and best practices related to the topic: "${topic}".
        ${image ? "Also analyze the provided reference image to understand the user's desired aesthetic or subject matter." : ""}
        Provide your findings as a detailed text summary.
    `;

    while (searchAttempt < MAX_SEARCH_ATTEMPTS && !researchSummary) {
        try {
            searchAttempt++;
            console.log(`[DesignPlan] Search attempt ${searchAttempt}...`);
            
            let researchContents: any = researchText;
            if (image) {
                researchContents = {
                    parts: [
                        { inlineData: { mimeType: image.mimeType, data: image.data } },
                        { text: researchText }
                    ]
                };
            }

            const researchResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: researchContents,
                config: { tools: [{ googleSearch: {} }] }
            });
            
            const text = researchResponse.text ?? '';
            if (text.length > 50) {
                researchSummary = text;
            } else {
                console.warn(`[DesignPlan] Search returned minimal content on attempt ${searchAttempt}`);
            }
        } catch (e) {
            console.warn(`[DesignPlan] Search attempt ${searchAttempt} failed:`, e);
            if (searchAttempt < MAX_SEARCH_ATTEMPTS) {
                await new Promise(resolve => setTimeout(resolve, 1500)); // Wait before retry
            }
        }
    }

    // 2. Generation Phase (Normal or Fallback)
    const isFallbackMode = !researchSummary;
    const isBrandActive = brandProfile && brandProfile.isActive;

    let structuringPrompt = "";

    if (isFallbackMode) {
        console.log(`[DesignPlan] Entering Fallback Mode (Brand Active: ${isBrandActive})`);
        
        if (isBrandActive) {
            // FALLBACK A: Internal Brand DNA
            structuringPrompt = `
                Generate 3 distinct creative visual strategies for the topic "${topic}" exclusively based on the following Brand DNA. Do not use external search results.
                
                **Brand DNA**:
                - Visual Style: ${brandProfile.visualStyle}
                - Color Palette: ${brandProfile.colorPalette}
                - Mood: ${brandProfile.mood}
                - Negative Constraints: ${brandProfile.negativeConstraint}
                
                Create 3 variations:
                1. "Brand Classic" (Strict adherence to DNA)
                2. "Modern Evolution" (DNA + Modern twist)
                3. "Bold Interpretation" (High impact, maximizing the Mood)
            `;
        } else {
            // FALLBACK B: Global Ad Trends (Generic)
            structuringPrompt = `
                Search is unavailable. Generate 3 distinct, high-quality global advertising visual styles for the topic "${topic}".
                
                Styles to generate:
                1. "Minimalist Editorial" (Clean, high-end, focus on product/subject quality)
                2. "Authentic Lifestyle" (Warm lighting, relatable context, emotional connection)
                3. "Creative Conceptual" (Bold colors, surreal composition, high attention grabbing)
            `;
        }
    } else {
        // NORMAL MODE
        let brandContext = "";
        if (isBrandActive) {
            brandContext = `
            **MANDATORY BRAND GUIDELINES (Brand DNA)**:
            - **Visual Style**: ${brandProfile!.visualStyle}
            - **Color Palette**: ${brandProfile!.colorPalette}
            - **Mood**: ${brandProfile!.mood}
            - **Negative Constraints**: ${brandProfile!.negativeConstraint}
            
            IMPORTANT: All suggested design strategies MUST align with these brand guidelines while incorporating trends from the research.
            `;
        }

        structuringPrompt = `
            Based on the following research summary about the topic "${topic}"${brandContext ? " and the Brand DNA" : ""}, create three distinct creative strategies.
            Research Summary: ${researchSummary}
        `;
    }

    // Common Output Requirements
    structuringPrompt += `
        Return a valid JSON array of three objects with:
        - 'title': **in Simplified Chinese**
        - 'description': **in Simplified Chinese**
        - 'prompt': **in English** (Detailed visual prompt, strictly adhering to Brand DNA if present)
        - 'referenceImagePrompt': **in English** (For generating a reference image, strictly adhering to Brand DNA if present)
    `;

    return callApiWithRetry(async () => {
        const structuringResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: structuringPrompt,
            config: { responseMimeType: "application/json" }
        });
        
        return safeJsonParse(structuringResponse.text ?? '[]', []);
    });
};

export const summarizePrompt = async (prompt: string): Promise<string> => {
    return callApiWithRetry(async () => {
        const apiKey = process.env.API_KEY || '';
        const ai = new GoogleGenAI({ apiKey });
        const apiPrompt = `
            Summarize the following prompt into a concise title (max 7 words). No quotes.
            Prompt: "${prompt}"
            Summary:
        `;
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: apiPrompt });
        return response.text?.trim() || prompt.substring(0, 40) + '...';
    });
};

export const removeBackground = async (base64Data: string, mimeType: string): Promise<{ base64Image: string }> => {
    return callApiWithRetry(async () => {
        const apiKey = process.env.API_KEY || '';
        if (!apiKey) throw new Error("API Key is missing for background removal.");
        
        const ai = new GoogleGenAI({ apiKey });
        
        // Upgrade to Pro for better instruction following on Image-to-Image tasks
        const modelName = 'gemini-3-pro-image-preview';
        
        // Strategy: Instead of asking for transparent PNG (which models struggle to generate directly as RGBA),
        // we ask for a "Product on Pure White Background" generation. This is much more reliable for generative models.
        const prompt = `Strictly isolate the main subject from the reference image and place it on a pure white background. Maintain exact subject details and lighting. High fidelity product photography.`;
        
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
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ]
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return { base64Image: part.inlineData.data };
            }
        }
        throw new Error("Background removal failed: No image returned from model.");
    });
};

export const generateReferenceImage = async (prompt: string): Promise<{ base64Image: string }> => {
    return callApiWithRetry(async () => {
        const apiKey = process.env.API_KEY || '';
        const ai = new GoogleGenAI({ apiKey });
        const imgResponse = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: '16:9',
                outputMimeType: 'image/jpeg',
            }
        });
        
        if (!imgResponse.generatedImages || imgResponse.generatedImages.length === 0) {
            throw new Error("Reference image generation failed: No images returned (Likely safety block).");
        }
        
        const image = imgResponse.generatedImages[0].image;
        if (!image || !image.imageBytes) {
             throw new Error("Reference image generation failed: Image data is missing.");
        }

        const base64Image = image.imageBytes;
        return { base64Image };
    });
};

export const createInitialBrandProfile = async (url: string) => { return { brand_name: "Mock Brand", brand_industry: "Mock Industry" }; };

export const brandProfileService = {
    // ... (kept for compatibility)
};
