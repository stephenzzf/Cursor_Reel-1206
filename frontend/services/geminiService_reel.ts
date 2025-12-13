
// ... (existing imports)
import { GoogleGenAI, Type, GenerateContentResponse, FunctionDeclaration } from "@google/genai";
import { generateImage, getCreativeDirectorAction, enhancePrompt as enhanceImagePrompt, getDesignPlan as getImageDesignPlan } from './geminiService';
// 注意：视频相关功能已迁移到 videoService.ts，但为了向后兼容，这里保留接口
// 如果 geminiService_reel.ts 仍在使用，需要更新为使用 videoService
import { generateVideo, getVideoCreativeDirectorAction, enhancePrompt as enhanceVideoPrompt, getDesignPlan as getVideoDesignPlan } from './videoService';
// persistVideoToStorage 已由后端处理，不再需要前端实现
// Note: Gallery saving is now handled in hooks (useReelGeneration.ts)
// import { uploadImageToStorage, saveGalleryItem } from './galleryService';
// import { deductUserCredits } from './userService';
// import { auth } from '../firebaseConfig';
import { ReelMessage, ReelAsset } from '../types';

// Helper: Determine if the selected model is for video
const isVideoModel = (model: string) => model.includes('veo');

// Helper: Check intent mismatch using lightweight model
const checkModalityMismatch = async (prompt: string, selectedModel: string): Promise<{ mismatch: boolean; suggestedModel?: string; reasoning?: string }> => {
    try {
        const apiKey = process.env.API_KEY || '';
        const ai = new GoogleGenAI({ apiKey });
        const currentModality = isVideoModel(selectedModel) ? 'VIDEO' : 'IMAGE';
        
        const systemInstruction = `
            You are a specialized Intent Classifier for a creative AI tool.
            Your ONLY job is to detect if the User's Prompt CONTRADICTS the Current Selected Model Modality.
            
            Current Model Modality: ${currentModality}
            
            Rules:
            1. If User Prompt clearly asks for VIDEO (e.g. "drone shot", "moving", "animation", "pan", "zoom", "video", "clip") AND Current Modality is IMAGE -> Mismatch = TRUE.
            2. If User Prompt clearly asks for IMAGE (e.g. "logo", "icon", "poster", "picture", "photo", "static") AND Current Modality is VIDEO -> Mismatch = TRUE.
            3. Otherwise (ambiguous or matching) -> Mismatch = FALSE.
            
            Return JSON: { "mismatch": boolean, "suggestedModel": "veo_fast" | "banana", "reasoning": "string (in Chinese)" }
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json"
            }
        });

        const result = JSON.parse(response.text || '{}');
        return {
            mismatch: result.mismatch || false,
            suggestedModel: result.suggestedModel,
            reasoning: result.reasoning
        };
    } catch (e) {
        console.warn("Modality check failed, proceeding without check.", e);
        return { mismatch: false };
    }
};

// --- UNIFIED CREATIVE DIRECTOR ---
export const getReelCreativeDirectorAction = async (
    prompt: string,
    selectedModel: string,
    assets: Record<string, ReelAsset>,
    selectedAssetId: string | null,
    lastGeneratedAssetId: string | null,
    messages: ReelMessage[],
    hasUploadedFiles: boolean
) => {
    try {
        // 0. PRE-FLIGHT: Check for Intent Mismatch (Only if uploads don't force a type)
        if (!hasUploadedFiles) {
            const check = await checkModalityMismatch(prompt, selectedModel);
            if (check.mismatch && check.suggestedModel) {
                return {
                    action: 'MODEL_MISMATCH',
                    prompt: prompt,
                    reasoning: check.reasoning || "检测到您的需求与当前模型不匹配。",
                    targetAssetId: undefined,
                    suggestedModel: check.suggestedModel
                };
            }
        }

        // 1. If Video Model Selected -> Use Video Logic
        if (isVideoModel(selectedModel)) {
            // Context Logic: Ensure we only pass VIDEO assets to the Video Director
            const safeSelectedId = (selectedAssetId && assets[selectedAssetId]?.type === 'video') ? selectedAssetId : null;
            const safeLastId = (lastGeneratedAssetId && assets[lastGeneratedAssetId]?.type === 'video') ? lastGeneratedAssetId : null;

            const videoMessages = messages.map(m => ({ ...m, type: m.type === 'generated-asset' ? 'generated-video' : m.type } as any));
            
            const result = await getVideoCreativeDirectorAction(
                prompt,
                videoMessages,
                safeSelectedId,
                safeLastId,
                hasUploadedFiles
            );

            // Normalize output
            return {
                action: result.action === 'NEW_VIDEO' ? 'NEW_ASSET' : (result.action === 'EDIT_VIDEO' ? 'EDIT_ASSET' : 'ANSWER_QUESTION'),
                prompt: result.prompt,
                reasoning: result.reasoning || "好的，正在为您处理视频请求。",
                targetAssetId: result.targetVideoId
            };
        } 
        // 2. If Image Model Selected -> Use Image Logic
        else {
            // Context Logic: Ensure we only pass IMAGE assets to the Image Director
            const safeSelectedId = (selectedAssetId && assets[selectedAssetId]?.type === 'image') ? selectedAssetId : null;
            const safeLastId = (lastGeneratedAssetId && assets[lastGeneratedAssetId]?.type === 'image') ? lastGeneratedAssetId : null;

            // Adapt context
            const activeAsset = safeSelectedId ? assets[safeSelectedId] : undefined;
            const prevAsset = safeLastId ? assets[safeLastId] : undefined;
            
            // Only pass descriptions if they are images
            const activeDesc = activeAsset?.prompt;
            const prevDesc = prevAsset?.prompt;

            // Map messages
            const imageMessages = messages.map(m => ({ ...m, type: m.type === 'generated-asset' ? 'generated-image' : m.type } as any));

            const result = await getCreativeDirectorAction(
                prompt,
                safeSelectedId,
                safeLastId,
                imageMessages,
                activeDesc,
                prevDesc,
                hasUploadedFiles
            );

            // Standardize output
            return {
                action: result.action === 'NEW_CREATION' ? 'NEW_ASSET' : (result.action === 'EDIT_IMAGE' ? 'EDIT_ASSET' : 'ANSWER_QUESTION'),
                prompt: result.prompt,
                reasoning: result.reasoning || "好的，正在为您处理图片请求。",
                targetAssetId: result.targetImageId
            };
        }
    } catch (error) {
        console.error("Reel Creative Director failed (Fallback Triggered):", error);
        return {
            action: 'NEW_ASSET',
            prompt: prompt,
            reasoning: "AI指令官暂时繁忙，正在直接为您生成新的创作。",
            targetAssetId: undefined
        };
    }
};

// ... (Rest of file remains unchanged: generateReelAsset, helpers)
export const generateReelAsset = async (
    prompt: string,
    model: string,
    uploadedFiles: File[], // Raw files
    sourceAsset?: ReelAsset // Optional existing asset on canvas as source
): Promise<ReelAsset> => {
    
    const isVideo = isVideoModel(model);
    const cost = isVideo ? (model === 'veo_gen' ? 50 : 35) : (model === 'banana_pro' ? 20 : 10);
    const aspectRatio = '9:16'; // Locked for Reels

    // Helper to process files
    const processFiles = async (files: File[]) => {
        return Promise.all(files.map(async file => {
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return {
                data: btoa(binary),
                mimeType: file.type
            };
        }));
    };

    // Helper to get image data from URL
    const getUrlData = async (url: string) => {
        const res = await fetch(url);
        const blob = await res.blob();
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return {
            data: btoa(binary),
            mimeType: blob.type
        };
    };

    // Prepare inputs
    let inputImages: { data: string; mimeType: string }[] = [];
    
    // 1. Add uploaded files first
    if (uploadedFiles.length > 0) {
        inputImages = await processFiles(uploadedFiles);
    } 
    // 2. If no uploads but source asset exists and is an IMAGE, use it
    else if (sourceAsset && sourceAsset.type === 'image') {
        try {
            const data = await getUrlData(sourceAsset.src);
            inputImages.push(data);
        } catch (e) {
            console.warn("Failed to load source asset data", e);
        }
    }

    // --- GENERATE VIDEO ---
    if (isVideo) {
        const { videoUri, rawRemoteUri } = await generateVideo(
            prompt, 
            inputImages, 
            aspectRatio, 
            model as 'veo_fast' | 'veo_gen'
        );

        // 注意：后端已处理视频持久化，videoUri 已经是永久 URL
        const persistentUrl = videoUri;
        
        // Note: Saving to gallery is now handled in the hook (useReelGeneration.ts)
        // to avoid duplicate saves and ensure consistent error handling

        return {
            id: `reel-vid-${Date.now()}`,
            type: 'video',
            src: persistentUrl,
            prompt,
            width: 512, // Updated to match image dimensions
            height: 896, // Updated to match image dimensions
            x: 0, y: 0, // Position set by hook
            status: 'done',
            generationModel: model,
            generationParams: { sourceImages: inputImages },
            sourceAssetId: sourceAsset?.id // CRITICAL: Propagate source ID for connection lines
        };
    } 
    // --- GENERATE IMAGE ---
    else {
        const result = await generateImage(
            prompt,
            inputImages,
            aspectRatio,
            model as 'banana' | 'banana_pro'
        );

        // Note: Saving to gallery is now handled in the hook (useReelGeneration.ts)
        // to avoid duplicate saves and ensure consistent error handling
        // Return base64 data URI for hook to process
        return {
            id: `reel-img-${Date.now()}`,
            type: 'image',
            src: `data:image/jpeg;base64,${result.base64Image}`,
            prompt,
            width: 512,
            height: 896,
            x: 0, y: 0,
            status: 'done',
            generationModel: model,
            sourceAssetId: sourceAsset?.id // CRITICAL: Propagate source ID for connection lines
        };
    }
};

// --- ENHANCEMENT TOOLS ---
export const getReelEnhancement = async (prompt: string, model: string) => {
    if (isVideoModel(model)) {
        return await enhanceVideoPrompt(prompt, model as 'veo_fast' | 'veo_gen');
    } else {
        return await enhanceImagePrompt(prompt);
    }
};

export const getReelDesignPlan = async (prompt: string, model: string) => {
    if (isVideoModel(model)) {
        return await getVideoDesignPlan(prompt, model as 'veo_fast' | 'veo_gen');
    } else {
        return await getImageDesignPlan(prompt);
    }
};
