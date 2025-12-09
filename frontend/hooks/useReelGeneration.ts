
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
    getReelCreativeDirectorAction, 
    generateReelAsset, 
    getReelEnhancement, 
    getReelDesignPlan,
    upscaleImage,
    removeBackground,
    generateReferenceImage
} from './useReelApi';
import { subscribeToGallery, uploadImageToStorage, saveGalleryItem } from '../services/galleryService';
import { deductUserCredits } from '../services/userService';
import { auth } from '../firebaseConfig';
import { ReelMessage, ReelAsset, GalleryItem, UserProfile, SnapGuide } from '../types';

const SNAP_THRESHOLD_PX = 10;

// --- UTILS ---
const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve((reader.result as string).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });

// Helper to normalize image source (Data URI or URL) to base64 for API
const prepareImageForApi = async (src: string): Promise<{ data: string; mimeType: string }> => {
    try {
        if (src.startsWith('data:')) {
            const [header, data] = src.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
            if (!data) throw new Error("Empty base64 data");
            return { data, mimeType };
        } else if (src.startsWith('http') || src.startsWith('blob:')) {
            const response = await fetch(src, { mode: 'cors' });
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
            const blob = await response.blob();
            if (blob.size === 0) throw new Error("Fetched image is empty");
            const data = await blobToBase64(blob);
            const mimeType = (blob.type && blob.type !== "") ? blob.type : 'image/jpeg';
            return { data, mimeType };
        }
    } catch (e) {
        console.error("Image preparation failed:", e);
        throw new Error(`Could not process image: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
    throw new Error("Unsupported image source format");
};

export const useReelGeneration = (initialPrompt: string, userProfile: UserProfile | null, isProfileLoading: boolean) => {
    // --- STATE ---
    const [messages, setMessages] = useState<ReelMessage[]>([]);
    const [assets, setAssets] = useState<Record<string, ReelAsset>>({});
    const [userInput, setUserInput] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Processing States
    const [isUpscaling, setIsUpscaling] = useState(false);
    const [processingAction, setProcessingAction] = useState<'regenerate' | 'remove-bg' | null>(null);

    // Selection
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
    const [lastGeneratedAssetId, setLastGeneratedAssetId] = useState<string | null>(null);
    
    // UI Toggles
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);
    const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
    const [enhancePromptEnabled, setEnhancePromptEnabled] = useState(false);
    const [designInspirationEnabled, setDesignInspirationEnabled] = useState(false);
    
    // Canvas State
    const [transform, setTransform] = useState({ x: 50, y: 50, scale: 0.3 }); // Start zoomed out for tall content
    const [toolMode, setToolMode] = useState<'select' | 'pan' | 'chat'>('select');
    const [chattingAssetId, setChattingAssetId] = useState<string | null>(null);
    const [onCanvasChatInput, setOnCanvasChatInput] = useState('');
    const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

    // Configuration
    const [selectedModel, setSelectedModel] = useState<string>('banana'); // Default to Flash Image

    // Refs
    const canvasRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const userInputRef = useRef<HTMLTextAreaElement>(null);
    const initialPromptHandled = useRef(false);
    const isPanning = useRef(false);
    const lastMousePosition = useRef({ x: 0, y: 0 });
    const dragState = useRef<{ assetId: string | null; startX: number; startY: number; initialX: number; initialY: number }>({ assetId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 });

    // --- EFFECTS ---
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio && window.aistudio.hasSelectedApiKey) {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                if (!hasKey && window.aistudio.openSelectKey) await window.aistudio.openSelectKey();
            }
        };
        checkKey();

        let unsubscribe: (() => void) | undefined;
        const subAuth = auth.onAuthStateChanged((user) => {
            if (unsubscribe) unsubscribe();
            if (user) {
                unsubscribe = subscribeToGallery(user.uid, (items) => {
                    // Filter for 9:16 content if possible, or just show everything but prioritize vertical
                    setGalleryItems(items.filter(i => i.aspectRatio === '9:16' || !i.aspectRatio)); 
                });
            } else {
                setGalleryItems([]);
            }
        });
        return () => { subAuth(); if (unsubscribe) unsubscribe(); };
    }, []);

    // --- HELPERS ---
    const addMessage = useCallback((role: 'user' | 'assistant', type: ReelMessage['type'], content: any) => {
        setMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random()}`, role, type, content, timestamp: Date.now() }]);
    }, []);

    const calculateNewPosition = useCallback((sourceId: string | null | undefined, allAssets: Record<string, ReelAsset>): { x: number; y: number } => {
        if (sourceId && allAssets[sourceId]) {
            const source = allAssets[sourceId];
            return { x: source.x + source.width + 40, y: source.y }; // Place to the right for vertical reel flow
        }
        // Find right-most
        const items = Object.values(allAssets) as ReelAsset[];
        if (items.length === 0) return { x: 50, y: 50 };
        const rightmost = items.reduce((prev, curr) => (prev.x + prev.width > curr.x + curr.width ? prev : curr));
        return { x: rightmost.x + rightmost.width + 40, y: 0 };
    }, []);

    // --- CORE ACTIONS ---
    
    const executeGeneration = useCallback(async (prompt: string, targetId: string | null, modelOverride?: string) => {
        if (!userProfile) { alert("请先登录。"); return; }
        
        // Use override model if provided (e.g., from regeneration), otherwise use current sidebar selection
        const modelToUse = modelOverride || selectedModel;
        const assetTypeLabel = modelToUse.includes('veo') ? '视频' : '图片';

        setIsLoading(true);
        try {
            // Determine source asset
            const sourceAsset = targetId ? assets[targetId] : undefined;
            
            // Generate detailed status message
            let timeEstimate = "5-10 秒";
            let modelDisplay = "Flash Image";
            
            if (modelToUse.includes('banana_pro')) { 
                timeEstimate = "10-20 秒"; 
                modelDisplay = "Pro Image"; 
            } else if (modelToUse.includes('veo_fast')) { 
                timeEstimate = "30-60 秒"; 
                modelDisplay = "Veo Fast"; 
            } else if (modelToUse.includes('veo_gen')) { 
                timeEstimate = "2-5 分钟"; 
                modelDisplay = "Veo Gen"; 
            }

            const actionText = targetId ? `基于参考${assetTypeLabel}生成` : `生成全新${assetTypeLabel}`;
            
            addMessage('assistant', 'text', `好的，这就为您${actionText}。\n\n🚀 模型: ${modelDisplay}\n⏱️ 预估时间: ${timeEstimate}\n✨ 状态: 正在制作中...`);
            
            // Prepare images for API
            const imageInputs: { data: string; mimeType: string }[] = [];
            if (uploadedFiles.length > 0) {
                for (const file of uploadedFiles) {
                    const buffer = await file.arrayBuffer();
                    const bytes = new Uint8Array(buffer);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    imageInputs.push({
                        data: btoa(binary),
                        mimeType: file.type
                    });
                }
            } else if (sourceAsset && sourceAsset.type === 'image') {
                // Use source asset as input
                try {
                    const imageData = await prepareImageForApi(sourceAsset.src);
                    imageInputs.push(imageData);
                } catch (e) {
                    console.warn("Failed to prepare source asset image", e);
                }
            }
            
            // Generate
            const newAsset = await generateReelAsset(
                prompt,
                modelToUse as 'banana' | 'banana_pro' | 'veo_fast' | 'veo_gen',
                imageInputs,
                '9:16',
                sourceAsset?.id
            );
            
            // Calculate Position
            const { x, y } = calculateNewPosition(targetId, assets);
            newAsset.x = x;
            newAsset.y = y;

            // Update State
            setAssets(prev => ({ ...prev, [newAsset.id]: newAsset }));
            addMessage('assistant', 'generated-asset', { assetId: newAsset.id });
            setLastGeneratedAssetId(newAsset.id);
            setUploadedFiles([]);

        } catch (e: any) {
            console.error("Reel generation error:", e);
            addMessage('assistant', 'text', `生成失败: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [userProfile, selectedModel, uploadedFiles, assets, addMessage, calculateNewPosition]);

    const executeEnhancePrompt = useCallback(async (prompt: string) => { 
        setIsLoading(true); 
        addMessage('assistant', 'tool-usage', { text: 'AI 创意总监 | 提示词优化' }); 
        try { 
            const suggestions = await getReelEnhancement(prompt, selectedModel); 
            addMessage('assistant', 'prompt-options', suggestions); 
        } catch (error) { 
            console.error("Enhance prompt failed", error);
            addMessage('assistant', 'text', '抱歉，无法优化提示词。'); 
        } finally { 
            setIsLoading(false); 
        } 
    }, [addMessage, selectedModel]);

    const executeGetDesignPlan = useCallback(async (prompt: string) => { 
        setIsLoading(true); 
        addMessage('assistant', 'tool-usage', { text: 'AI 创意总监 | 设计灵感' }); 
        try { 
            const plansWithPrompts = await getReelDesignPlan(prompt, selectedModel); 
            if (!plansWithPrompts || plansWithPrompts.length === 0) { throw new Error("AI 未返回任何设计方案。"); } 
            
            // Generate visual previews for plans
            const imagePromises = plansWithPrompts.map((plan: any) => 
                generateReferenceImage(plan.referenceImagePrompt || plan.prompt).catch(() => ({ base64Image: '' }))
            ); 
            const generatedImages = await Promise.all(imagePromises); 
            
            const plansForDisplay = plansWithPrompts.map((plan: any, index: number) => ({ 
                title: plan.title, 
                description: plan.description, 
                prompt: plan.prompt, 
                imageSrc: `data:image/jpeg;base64,${generatedImages[index].base64Image}`, 
            })); 
            
            addMessage('assistant', 'design-plans', plansForDisplay); 
        } catch (error) { 
            console.error("Get design plan failed", error);
            addMessage('assistant', 'text', `抱歉，无法获取设计方案: ${error instanceof Error ? error.message : '未知错误'}`); 
        } finally { 
            setIsLoading(false); 
        } 
    }, [addMessage, selectedModel]);

    const processUserTurn = useCallback(async (prompt: string) => {
        setIsLoading(true);
        try {
            const actionResult = await getReelCreativeDirectorAction(
                prompt,
                selectedModel,
                assets,
                selectedAssetId,
                lastGeneratedAssetId,
                messages,
                uploadedFiles.length > 0
            );

            // Force new creation if uploads exist
            if (uploadedFiles.length > 0) {
                actionResult.action = 'NEW_ASSET';
                actionResult.reasoning = "基于您上传的素材进行创作。";
            }

            if (actionResult.action === 'MODEL_MISMATCH') {
                addMessage('assistant', 'model-suggestion', {
                    text: actionResult.reasoning,
                    suggestedModel: (actionResult as any).suggestedModel,
                    originalPrompt: prompt
                });
            } else if (actionResult.action === 'ANSWER_QUESTION') {
                addMessage('assistant', 'text', actionResult.prompt);
            } else {
                if (actionResult.reasoning) {
                    addMessage('assistant', 'text', actionResult.reasoning);
                }
                
                // --- INTELLIGENT ROUTING ---
                // If the user has "Design Inspiration" ON, we fetch plans and STOP (waiting for user selection)
                if (designInspirationEnabled) {
                    await executeGetDesignPlan(actionResult.prompt);
                } 
                // If "Optimize" is ON, we fetch options and STOP (waiting for user selection)
                else if (enhancePromptEnabled) {
                    await executeEnhancePrompt(actionResult.prompt);
                } 
                // Otherwise, execute generation immediately
                else {
                    await executeGeneration(actionResult.prompt, actionResult.targetAssetId || selectedAssetId);
                }
            }

        } catch (e: any) {
            console.error("[Reel] Director error:", e);
            const errorMessage = e.message || '未知错误';
            // 提供更友好的错误信息
            let userMessage = `处理请求出错: ${errorMessage}`;
            if (errorMessage.includes('无法连接到服务器')) {
                userMessage = `无法连接到服务器\n\n请检查：\n1. 后端服务是否运行\n2. 网络连接是否正常\n3. 查看浏览器控制台获取详细信息`;
            } else if (errorMessage.includes('请求超时')) {
                userMessage = `请求超时，请稍后重试或检查网络连接`;
            } else if (errorMessage.includes('用户未登录')) {
                userMessage = `请先登录后再使用此功能`;
            }
            addMessage('assistant', 'text', userMessage);
        } finally {
            setIsLoading(false);
        }
    }, [selectedModel, assets, selectedAssetId, lastGeneratedAssetId, messages, uploadedFiles, enhancePromptEnabled, designInspirationEnabled, addMessage, executeGeneration, executeEnhancePrompt, executeGetDesignPlan]);

    const handleSubmit = useCallback((e?: React.FormEvent) => {
        e?.preventDefault();
        const text = userInput.trim();
        if (!text && uploadedFiles.length === 0) return;
        
        // Prepare attachment objects for display
        const attachments = uploadedFiles.map(file => ({
            url: URL.createObjectURL(file),
            type: file.type.startsWith('video/') ? 'video' : 'image'
        }));

        // Send user message with structured content
        addMessage('user', 'text', { text, attachments });
        setUserInput('');
        
        // Process logic with string prompt
        const promptToProcess = text || (uploadedFiles.length > 0 ? '基于素材生成' : '');
        processUserTurn(promptToProcess);
    }, [userInput, uploadedFiles, addMessage, processUserTurn]);

    // Handle user confirming model switch
    const handleSwitchModel = useCallback(async (newModel: string, originalPrompt: string) => {
        setSelectedModel(newModel);
        
        let timeEstimate = "5-10 秒";
        let modelDisplay = "Flash Image";
        if (newModel.includes('banana_pro')) { timeEstimate = "10-20 秒"; modelDisplay = "Pro Image"; }
        else if (newModel.includes('veo_fast')) { timeEstimate = "30-60 秒"; modelDisplay = "Veo Fast"; }
        else if (newModel.includes('veo_gen')) { timeEstimate = "2-5 分钟"; modelDisplay = "Veo Gen"; }

        addMessage('assistant', 'text', `好的，已切换至 ${newModel.includes('veo') ? 'Veo 视频' : 'Flash 图片'} 模型。\n\n🚀 模型: ${modelDisplay}\n⏱️ 预估时间: ${timeEstimate}\n✨ 状态: 重新生成中...`);
        
        setIsLoading(true);
        try {
            // Prepare images for API
            const imageInputs: { data: string; mimeType: string }[] = [];
            if (uploadedFiles.length > 0) {
                for (const file of uploadedFiles) {
                    const buffer = await file.arrayBuffer();
                    const bytes = new Uint8Array(buffer);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    imageInputs.push({
                        data: btoa(binary),
                        mimeType: file.type
                    });
                }
            }
            
            const newAsset = await generateReelAsset(
                originalPrompt,
                newModel as 'banana' | 'banana_pro' | 'veo_fast' | 'veo_gen',
                imageInputs,
                '9:16'
            );
            const { x, y } = calculateNewPosition(null, assets);
            newAsset.x = x;
            newAsset.y = y;
            setAssets(prev => ({ ...prev, [newAsset.id]: newAsset }));
            addMessage('assistant', 'generated-asset', { assetId: newAsset.id });
            setLastGeneratedAssetId(newAsset.id);
            setUploadedFiles([]);
            setIsLoading(false);

        } catch (e: any) {
            setIsLoading(false);
            addMessage('assistant', 'text', `生成失败: ${e.message}`);
        }

    }, [assets, calculateNewPosition, uploadedFiles, addMessage]);

    // --- TOOLBAR ACTIONS ---

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData.items;
        const filesToUpload: File[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) filesToUpload.push(file);
            }
        }
        if (filesToUpload.length > 0) {
            e.preventDefault();
            setUploadedFiles(prev => {
                const combined = [...prev, ...filesToUpload];
                return combined.slice(0, 3); // Limit to 3 max
            });
        }
    }, []);

    const handleDownload = () => {
        if (!selectedAssetId || !assets[selectedAssetId]) return;
        const asset = assets[selectedAssetId];
        const link = document.createElement('a');
        link.href = asset.src;
        const ext = asset.type === 'video' ? 'mp4' : 'jpg';
        link.download = `reel-${asset.type}-${asset.id}.${ext}`;
        link.referrerPolicy = "no-referrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleCopyFrame = async () => {
        if (!selectedAssetId || !assets[selectedAssetId]) return;
        const asset = assets[selectedAssetId];
        if (asset.type !== 'video') return;

        try {
            const btn = document.activeElement as HTMLButtonElement;
            const originalText = btn ? btn.innerText : '';
            if(btn) btn.innerText = "提取中...";

            // 1. Fetch data into a fresh local Blob (bypassing remote URL taint issues if fetch succeeds)
            const response = await fetch(asset.src);
            if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
            const blob = await response.blob();
            const tempUrl = URL.createObjectURL(blob);

            // 2. Create temp video element
            const tempVideo = document.createElement('video');
            tempVideo.src = tempUrl;
            tempVideo.muted = true;
            tempVideo.playsInline = true;
            // CRITICAL: Do NOT set crossOrigin for local Blob URLs to avoid taint
            // tempVideo.crossOrigin = "anonymous"; 
            
            // 3. Wait for data load
            await new Promise((resolve, reject) => {
                tempVideo.onloadeddata = () => resolve(true);
                tempVideo.onerror = (e) => reject(e);
                tempVideo.load();
            });

            // 4. Sync time with on-screen video
            const onScreenVideo = document.getElementById(`reel-video-${asset.id}`) as HTMLVideoElement;
            if (onScreenVideo) {
                tempVideo.currentTime = onScreenVideo.currentTime || 0.1;
            } else {
                tempVideo.currentTime = 0.1;
            }
            
            // Seek and wait
            await new Promise(r => { tempVideo.onseeked = r; });

            // 5. Draw to Canvas
            const canvas = document.createElement('canvas');
            canvas.width = tempVideo.videoWidth;
            canvas.height = tempVideo.videoHeight;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                ctx.drawImage(tempVideo, 0, 0);
                
                canvas.toBlob(async (b) => {
                    if (b) {
                        try {
                            const item = new ClipboardItem({ [b.type]: b });
                            await navigator.clipboard.write([item]);
                            alert("画面已成功复制到剪贴板！");
                        } catch (writeErr) {
                            console.error("Clipboard write failed", writeErr);
                            alert("复制失败：浏览器不支持或拒绝写入剪贴板。");
                        }
                    } else {
                        console.error("toBlob returned null");
                    }
                    
                    // Cleanup
                    URL.revokeObjectURL(tempUrl);
                    if(btn) btn.innerText = originalText;
                }, 'image/png');
            }
        } catch (e) {
            console.error("Copy frame error:", e);
            const btn = document.activeElement as HTMLButtonElement;
            if(btn) btn.innerText = "截图";
            alert("无法复制画面：视频源可能受限或网络请求失败。\n建议下载视频后截图。");
        }
    };

    const handleUpscale = async (factor: 2 | 4) => {
        if (!selectedAssetId || !assets[selectedAssetId]) return;
        const asset = assets[selectedAssetId];
        if (asset.type !== 'image') return; // Only images

        setIsUpscaling(true);
        addMessage('assistant', 'tool-usage', { text: `HD 超清放大 (${factor}x)` });

        try {
            const { data, mimeType } = await prepareImageForApi(asset.src);
            
            const result = await upscaleImage(data, mimeType, factor, asset.prompt);
            
            // Create new asset
            const newAssetId = `reel-img-hd-${Date.now()}`;
            const { x, y } = calculateNewPosition(asset.id, assets);
            
            // Upload to storage for persistence
            let downloadUrl = `data:image/jpeg;base64,${result.base64Image}`;
            if (auth.currentUser) {
                downloadUrl = await uploadImageToStorage(auth.currentUser.uid, result.base64Image);
                await saveGalleryItem(auth.currentUser.uid, {
                    fileUrl: downloadUrl,
                    prompt: asset.prompt,
                    width: asset.width,
                    height: asset.height,
                    aspectRatio: '9:16',
                    type: 'image',
                    model: 'gemini-3-pro-image-preview'
                });
                await deductUserCredits(auth.currentUser.uid, 20); // Upscale cost
            }

            const newAsset: ReelAsset = {
                id: newAssetId,
                type: 'image',
                src: downloadUrl,
                prompt: asset.prompt,
                width: asset.width, // Keep same layout size
                height: asset.height,
                x,
                y,
                sourceAssetId: asset.id,
                status: 'done',
                generationModel: 'gemini-3-pro-image-preview' // Correct model for upscaled image
            };

            setAssets(prev => ({ ...prev, [newAssetId]: newAsset }));
            addMessage('assistant', 'generated-asset', { assetId: newAssetId });
            setSelectedAssetId(newAssetId);

        } catch (e: any) {
            console.error("Upscale failed:", e);
            addMessage('assistant', 'text', `放大失败: ${e.message}`);
        } finally {
            setIsUpscaling(false);
        }
    };

    const handleRemoveBackground = async () => {
        if (!selectedAssetId || !assets[selectedAssetId]) return;
        const asset = assets[selectedAssetId];
        if (asset.type !== 'image') return;

        setProcessingAction('remove-bg');
        addMessage('assistant', 'tool-usage', { text: '去除背景' });

        try {
            const { data, mimeType } = await prepareImageForApi(asset.src);
            const result = await removeBackground(data, mimeType);
            
            const newAssetId = `reel-img-rmbg-${Date.now()}`;
            const { x, y } = calculateNewPosition(asset.id, assets);

            const newAsset: ReelAsset = {
                id: newAssetId,
                type: 'image',
                src: `data:image/png;base64,${result.base64Image}`,
                prompt: asset.prompt,
                width: asset.width,
                height: asset.height,
                x,
                y,
                sourceAssetId: asset.id,
                status: 'done',
                generationModel: asset.generationModel // Inherit model
            };

            setAssets(prev => ({ ...prev, [newAssetId]: newAsset }));
            addMessage('assistant', 'generated-asset', { assetId: newAssetId });
            setSelectedAssetId(newAssetId);

        } catch (e: any) {
            console.error("Remove BG failed:", e);
            addMessage('assistant', 'text', `抠图失败: ${e.message}`);
        } finally {
            setProcessingAction(null);
        }
    };

    const handleRegenerate = async () => {
        if (!selectedAssetId || !assets[selectedAssetId]) return;
        const asset = assets[selectedAssetId];
        
        setProcessingAction('regenerate');
        addMessage('assistant', 'text', `正在重绘...`);

        try {
            // Re-use logic with strict model override from the original asset
            // This ensures "Regenerate Image" stays an image, even if user switched to Veo in sidebar
            await executeGeneration(asset.prompt, asset.sourceAssetId || null, asset.generationModel);
        } catch (e: any) {
            addMessage('assistant', 'text', `重绘失败: ${e.message}`);
        } finally {
            setProcessingAction(null);
        }
    };

    // Initial Prompt
    useEffect(() => {
        if (!isProfileLoading && initialPrompt && !initialPromptHandled.current) {
            initialPromptHandled.current = true;
            addMessage('user', 'text', initialPrompt);
            processUserTurn(initialPrompt);
        }
    }, [initialPrompt, isProfileLoading, addMessage, processUserTurn]);

    // --- CANVAS HANDLERS ---
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.asset-on-canvas') || (e.target as HTMLElement).closest('.toolbar') || (e.target as HTMLElement).closest('.editor-toolbar-wrapper')) return;
        if (toolMode === 'pan' || e.button === 1) {
            isPanning.current = true;
            lastMousePosition.current = { x: e.clientX, y: e.clientY };
        } else {
            setSelectedAssetId(null);
            setChattingAssetId(null);
        }
    };

    const handleAssetMouseDown = (e: React.MouseEvent, id: string) => {
        if (toolMode === 'select') {
            e.stopPropagation();
            setSelectedAssetId(id);
            setChattingAssetId(null);
            const asset = assets[id];
            if (asset) {
                dragState.current = { assetId: id, startX: e.clientX, startY: e.clientY, initialX: asset.x, initialY: asset.y };
            }
        } else if (toolMode === 'chat') {
            e.stopPropagation();
            setChattingAssetId(id);
            setSelectedAssetId(null);
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isPanning.current) {
            const dx = e.clientX - lastMousePosition.current.x;
            const dy = e.clientY - lastMousePosition.current.y;
            setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
            lastMousePosition.current = { x: e.clientX, y: e.clientY };
            return;
        }
        if (dragState.current.assetId) {
            const { assetId, startX, startY, initialX, initialY } = dragState.current;
            const targetAsset = assets[assetId];
            if (!targetAsset) return;

            const deltaX = (e.clientX - startX) / transform.scale;
            const deltaY = (e.clientY - startY) / transform.scale;
            
            const rawX = initialX + deltaX;
            const rawY = initialY + deltaY;

            let finalX = rawX;
            let finalY = rawY;
            const newGuides: SnapGuide[] = [];

            if (!(e.ctrlKey || e.metaKey)) {
                const threshold = SNAP_THRESHOLD_PX / transform.scale;
                const otherAssets = (Object.values(assets) as ReelAsset[]).filter(a => a.id !== assetId);

                // --- X-AXIS SNAPPING ---
                const targetXPoints = [0, targetAsset.width / 2, targetAsset.width];
                let bestDeltaX = Infinity;
                let bestGuideX: number | null = null;

                otherAssets.forEach(ref => {
                    const refXPoints = [ref.x, ref.x + ref.width / 2, ref.x + ref.width];
                    targetXPoints.forEach(tOffset => {
                        refXPoints.forEach(rVal => {
                            const delta = rVal - (rawX + tOffset);
                            if (Math.abs(delta) < threshold && Math.abs(delta) < Math.abs(bestDeltaX)) {
                                bestDeltaX = delta;
                                bestGuideX = rVal;
                            }
                        });
                    });
                });

                if (Math.abs(bestDeltaX) < threshold && bestGuideX !== null) {
                    finalX = rawX + bestDeltaX;
                    newGuides.push({ orientation: 'vertical', position: bestGuideX });
                }

                // --- Y-AXIS SNAPPING ---
                const targetYPoints = [0, targetAsset.height / 2, targetAsset.height];
                let bestDeltaY = Infinity;
                let bestGuideY: number | null = null;

                otherAssets.forEach(ref => {
                    const refYPoints = [ref.y, ref.y + ref.height / 2, ref.y + ref.height];
                    targetYPoints.forEach(tOffset => {
                        refYPoints.forEach(rVal => {
                            const delta = rVal - (rawY + tOffset);
                            if (Math.abs(delta) < threshold && Math.abs(delta) < Math.abs(bestDeltaY)) {
                                bestDeltaY = delta;
                                bestGuideY = rVal;
                            }
                        });
                    });
                });

                if (Math.abs(bestDeltaY) < threshold && bestGuideY !== null) {
                    finalY = rawY + bestDeltaY;
                    newGuides.push({ orientation: 'horizontal', position: bestGuideY });
                }
            }

            setSnapGuides(newGuides);
            setAssets(prev => ({
                ...prev,
                [assetId]: { ...prev[assetId!], x: finalX, y: finalY }
            }));
        }
    };

    const handleCanvasMouseUp = () => {
        isPanning.current = false;
        dragState.current = { assetId: null, startX: 0, startY: 0, initialX: 0, initialY: 0 };
        setSnapGuides([]);
    };

    const handleCanvasWheel = (e: React.WheelEvent) => {
        const delta = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(0.1, 5), transform.scale + delta);
        setTransform(t => ({ ...t, scale: newScale }));
    };

    const zoom = (dir: 'in' | 'out') => {
        const delta = dir === 'in' ? 0.1 : -0.1;
        setTransform(t => ({ ...t, scale: Math.min(Math.max(0.1, 5), t.scale + delta) }));
    };

    const setZoomLevel = (newScale: number) => {
        if (!canvasRef.current) return;
        const safeScale = Math.min(Math.max(0.1, 5), newScale);
        const rect = canvasRef.current.getBoundingClientRect(); 
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        setTransform(prev => ({ 
            scale: safeScale, 
            x: centerX - (centerX - prev.x) * (safeScale / prev.scale), 
            y: centerY - (centerY - prev.y) * (safeScale / prev.scale) 
        }));
    };

    const handleOnCanvasChatSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!onCanvasChatInput.trim() || !chattingAssetId) return;
        // Set chatting asset as selected for context
        setSelectedAssetId(chattingAssetId);
        setChattingAssetId(null);
        addMessage('user', 'text', onCanvasChatInput);
        processUserTurn(onCanvasChatInput);
        setOnCanvasChatInput('');
    };

    const fitToScreen = useCallback(() => {
        if (!canvasRef.current || !canvasRef.current.parentElement) return;
        const container = canvasRef.current.parentElement;
        const { clientWidth: viewportW, clientHeight: viewportH } = container;

        const assetList = Object.values(assets) as ReelAsset[];
        if (assetList.length === 0) {
            setTransform({ x: 50, y: 50, scale: 0.3 });
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        assetList.forEach(asset => {
            minX = Math.min(minX, asset.x);
            minY = Math.min(minY, asset.y);
            maxX = Math.max(maxX, asset.x + asset.width);
            maxY = Math.max(maxY, asset.y + asset.height);
        });

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        if (contentWidth <= 0 || contentHeight <= 0) return;

        const padding = 100;
        const availableW = viewportW - padding;
        const availableH = viewportH - padding;

        const scaleX = availableW / contentWidth;
        const scaleY = availableH / contentHeight;
        let fitScale = Math.min(scaleX, scaleY);
        fitScale = Math.min(Math.max(fitScale, 0.1), 1.0); 

        const contentCenterX = minX + contentWidth / 2;
        const contentCenterY = minY + contentHeight / 2;
        const viewportCenterX = viewportW / 2;
        const viewportCenterY = viewportH / 2;

        const newX = viewportCenterX - (contentCenterX * fitScale);
        const newY = viewportCenterY - (contentCenterY * fitScale);

        setTransform({ x: newX, y: newY, scale: fitScale });
    }, [assets]);

    const handleUseSuggestion = (prompt: string) => { 
        addMessage('user', 'text', `使用优化后的提示词：“${prompt}”`); 
        executeGeneration(prompt, selectedAssetId); 
    };
    
    const handleUseDesignPlan = (plan: {title: string, prompt: string}) => { 
        addMessage('user', 'text', `选择设计灵感：“${plan.title}”`); 
        if (enhancePromptEnabled) { 
            addMessage('assistant', 'text', '好的，已选定设计方向。现在，我将基于这个方向为您优化提示词。'); 
            executeEnhancePrompt(plan.prompt); 
        } else { 
            executeGeneration(plan.prompt, selectedAssetId); 
        } 
    };

    return {
        messages, assets, userInput, setUserInput, uploadedFiles, isLoading,
        selectedAssetId, setSelectedAssetId, isArchiveOpen, setIsArchiveOpen,
        enhancePromptEnabled, setEnhancePromptEnabled, designInspirationEnabled, setDesignInspirationEnabled,
        selectedModel, setSelectedModel,
        transform, toolMode, setToolMode, chattingAssetId, onCanvasChatInput, setOnCanvasChatInput,
        handleFileChange: (e: any) => setUploadedFiles(Array.from(e.target.files || [])),
        handleRemoveFile: (i: number) => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i)),
        handlePaste, 
        handleSubmit, handleOnCanvasChatSubmit,
        handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasWheel, handleAssetMouseDown,
        zoom, setZoomLevel, fitToScreen,
        galleryItems,
        canvasRef, messagesEndRef, userInputRef,
        // Action Handlers
        handleDownload,
        handleCopyFrame,
        handleUpscale,
        handleRemoveBackground,
        handleRegenerate,
        handleSwitchModel, // New Export
        isUpscaling,
        processingAction,
        handleUseSuggestion, // Added
        handleUseDesignPlan, // Added
        snapGuides
    };
};
