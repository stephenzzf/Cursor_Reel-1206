
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
    getCreativeDirectorAction, 
    generateImage, 
    enhancePrompt, 
    getDesignPlan, 
    generateReferenceImage, 
    upscaleImage, 
    removeBackground 
} from '../services/geminiService';
import { uploadImageToStorage, saveGalleryItem, subscribeToGallery, uploadFileToStorage } from '../services/galleryService';
import { deductUserCredits } from '../services/userService';
import { auth } from '../firebaseConfig';
import { CanvasImage, ImageMessage, ImageSeries, GalleryItem, UserProfile, SnapGuide, BrandVisualProfile } from '../types';
import { getClosestAspectRatio, parseAspectRatioFromPrompt } from '../components/image_gen/ImageGenAssets';
import { useBrandVisualProfiles } from './useBrandVisualProfiles';

// --- UTILS ---
const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve((reader.result as string).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => new Promise((resolve) => { const img = new Image(); img.onload = () => resolve({ width: img.width, height: img.height }); img.onerror = () => resolve({ width: 512, height: 512 }); img.src = base64.startsWith('data:') || base64.startsWith('http') || base64.startsWith('blob:') ? base64 : `data:image/jpeg;base64,${base64}`; });

// Helper to normalize image source (Data URI or URL) to base64 for API
const prepareImageForApi = async (src: string): Promise<{ data: string; mimeType: string }> => {
    try {
        if (src.startsWith('data:')) {
            const [header, data] = src.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
            if (!data) throw new Error("Empty base64 data");
            return { data, mimeType };
        } else if (src.startsWith('http') || src.startsWith('blob:')) {
            // Fetch remote image or blob URL
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

const MODEL_COSTS = {
    'banana': 10,
    'banana_pro': 20
};

const SNAP_THRESHOLD_PX = 10; // Screen pixels threshold for snapping

export const useImageGeneration = (initialPrompt: string, userProfile: UserProfile | null, isProfileLoading: boolean) => {
    // --- BRAND VISUAL PROFILES ---
    const { 
        visualProfiles, activeProfile, loading: profilesLoading, setActive: setActiveProfile, removeProfile: deleteProfile,
        error: dnaError
    } = useBrandVisualProfiles();
    const [isDNAOpen, setIsDNAOpen] = useState(false);
    const [configError, setConfigError] = useState<string | null>(null);

    // Monitor for DNA permission errors
    useEffect(() => {
        if (dnaError && (dnaError.includes("Missing or insufficient permissions") || dnaError.includes("permission-denied"))) {
            setConfigError("PERMISSION_DENIED");
        }
    }, [dnaError]);

    // --- STATE ---
    const [messages, setMessages] = useState<ImageMessage[]>([]);
    const [images, setImages] = useState<Record<string, CanvasImage>>({});
    const [userInput, setUserInput] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUpscaling, setIsUpscaling] = useState(false);
    const [processingAction, setProcessingAction] = useState<'regenerate' | 'remove-bg' | null>(null);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [lastGeneratedImageId, setLastGeneratedImageId] = useState<string | null>(null);
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);
    const [archiveSummaries, setArchiveSummaries] = useState<Record<string, string>>({});
    const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]); 
    
    const [enhancePromptEnabled, setEnhancePromptEnabled] = useState(false);
    const [designInspirationEnabled, setDesignInspirationEnabled] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [selectedModel, setSelectedModel] = useState<'banana' | 'banana_pro'>('banana');
    const [inputHighlight, setInputHighlight] = useState(false);
    
    const [transform, setTransform] = useState({ x: 50, y: 50, scale: 0.2 });
    const [toolMode, setToolMode] = useState<'select' | 'pan' | 'chat'>('select');
    const [chattingImageId, setChattingImageId] = useState<string | null>(null);
    const [onCanvasChatInput, setOnCanvasChatInput] = useState('');
    const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]); 

    // --- DRAG STATE ---
    const isPanning = useRef(false);
    const dragState = useRef<{
        imageId: string | null;
        startX: number;
        startY: number;
        initialImageX: number;
        initialImageY: number;
    }>({ imageId: null, startX: 0, startY: 0, initialImageX: 0, initialImageY: 0 });

    const lastMousePosition = useRef({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const initialPromptHandled = useRef(false);
    const userInputRef = useRef<HTMLTextAreaElement>(null);

    const isEditing = selectedImageId !== null || uploadedFiles.length > 0 || chattingImageId !== null;

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    
    // --- GALLERY SUBSCRIPTION ---
    useEffect(() => {
        let unsubscribeGallery: (() => void) | undefined;

        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (unsubscribeGallery) {
                unsubscribeGallery();
                unsubscribeGallery = undefined;
            }

            if (user) {
                unsubscribeGallery = subscribeToGallery(user.uid, (items) => {
                    setGalleryItems(items);
                });
            } else {
                setGalleryItems([]);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeGallery) unsubscribeGallery();
        };
    }, []);

    useEffect(() => {
        const textarea = userInputRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; 
            const scrollHeight = textarea.scrollHeight;
            const maxHeight = 160; 
            textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
            textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
        }
    }, [userInput]);

    const addMessage = useCallback((role: 'user' | 'assistant', type: ImageMessage['type'], content: any) => {
        setMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random()}`, role, type, content, timestamp: Date.now() }]);
    }, []);

    const calculateNewImagePosition = useCallback((sourceImageId: string, allImages: Record<string, CanvasImage>): { x: number; y: number } => {
        const sourceImage = allImages[sourceImageId];
        if (!sourceImage) return { x: 0, y: 0 };
    
        const columnX = sourceImage.x;
        const imagesInColumn = (Object.values(allImages) as CanvasImage[]).filter(img => Math.abs(img.x - columnX) < 20);
        const bottomMostImage = imagesInColumn.reduce((bottom, current) => {
            if (!bottom) return current;
            return (current.y + current.height) > (bottom.y + bottom.height) ? current : bottom;
        }, null as CanvasImage | null);
        
        if (bottomMostImage) {
            return { x: columnX, y: bottomMostImage.y + bottomMostImage.height + 24 };
        }
        return { x: columnX, y: sourceImage.y + sourceImage.height + 24 };
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) { const files = Array.from(e.target.files).slice(0, 3 - uploadedFiles.length); setUploadedFiles(prev => [...prev, ...files]); } };
    const handleRemoveFile = (index: number) => { setUploadedFiles(prev => prev.filter((_, i) => i !== index)); };
    
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
                return combined.slice(0, 3);
            });
        }
    }, []);

    // --- MAIN GENERATION LOGIC ---
    const executeImageGeneration = useCallback(async (prompt: string, targetImageId: string | null, useImageAsInput: boolean = true) => {
        const cost = MODEL_COSTS[selectedModel] || 10;
        if (!userProfile) {
            alert("请先登录后再进行创作。");
            return;
        }
        if (userProfile.credits < cost) {
            alert(`积分不足！\n\n生成此图片需要 ${cost} 积分，您当前余额为 ${userProfile.credits}。\n请联系管理员或升级套餐。`);
            return;
        }

        setIsLoading(true);
        let sourceImageIdForNewImage: string | undefined = undefined;
        let base64Images: { data: string; mimeType: string; }[] = [];
        let finalRatio = aspectRatio;
    
        try {
            if (targetImageId && images[targetImageId]) {
                sourceImageIdForNewImage = targetImageId;
                const sourceImage = images[targetImageId];

                if (useImageAsInput) {
                    try {
                        const imageData = await prepareImageForApi(sourceImage.src);
                        if (imageData) {
                            base64Images.push(imageData);
                        }
                    } catch (e) {
                        console.error("Failed to prepare source image:", e);
                        addMessage('assistant', 'text', "警告：无法加载原图作为参考，将仅使用提示词生成。");
                    }
                }

                const intentRatio = parseAspectRatioFromPrompt(prompt);
                if (intentRatio) {
                    finalRatio = intentRatio;
                } else {
                    finalRatio = getClosestAspectRatio(sourceImage.width, sourceImage.height);
                }
            }
            
            const uploadedImageData = await Promise.all(uploadedFiles.map(async file => ({ data: await blobToBase64(file), mimeType: file.type })));
            base64Images.push(...uploadedImageData);
            setUploadedFiles([]);
        
            // --- SMART BRAND DNA INJECTION ---
            let finalPrompt = prompt;
            let usingBrandRef = false;

            if (activeProfile) {
                // If there are NO user uploads and NO source image, we can use the Brand Reference Image as a Style Base
                if (base64Images.length === 0 && activeProfile.styleReferenceUrl) {
                    try {
                        const refData = await prepareImageForApi(activeProfile.styleReferenceUrl);
                        base64Images.push(refData);
                        usingBrandRef = true;
                    } catch (e) {
                        console.warn("Failed to load Brand Style Reference:", e);
                    }
                }

                // Construct Prompt
                let brandContext = "";
                if (usingBrandRef) {
                    // Style Transfer Mode
                    brandContext = `
                    [INSTRUCTION: GENERATE NEW IMAGE FROM STYLE REFERENCE]
                    - The provided image is a STYLE REFERENCE ONLY. Do not copy the subject exactly.
                    - Extract lighting, composition, and mood from the reference.
                    - Apply these elements to the NEW SUBJECT described below: "${prompt}"
                    
                    [BRAND VISUAL GUIDELINES]
                    - Style: ${activeProfile.visualStyle}
                    - Palette: ${activeProfile.colorPalette}
                    - Mood: ${activeProfile.mood}
                    - Negative: ${activeProfile.negativeConstraint}
                    `;
                    finalPrompt = brandContext; // Ref replaces prompt structure slightly
                } else {
                    // Constraint Mode (User has their own image or just text)
                    brandContext = `
                    [BRAND DNA ACTIVE: ${activeProfile.name}]
                    Strictly adhere to the following visual constraints:
                    - Visual Style: ${activeProfile.visualStyle}
                    - Color Palette: ${activeProfile.colorPalette}
                    - Mood: ${activeProfile.mood}
                    - Negative Constraints (AVOID): ${activeProfile.negativeConstraint}
                    `;
                    finalPrompt = `${prompt}\n\n${brandContext}`;
                }
            }

            // 1. Generate Image (Base64)
            const result = await generateImage(finalPrompt, base64Images, finalRatio, selectedModel);
            const { width, height } = await getImageDimensions(result.base64Image);
            const imageId = `img-${Date.now()}`;
            
            // 2. Position Calculation
            let newX, newY;
            if (sourceImageIdForNewImage && images[sourceImageIdForNewImage]) {
                const position = calculateNewImagePosition(sourceImageIdForNewImage, images);
                newX = position.x;
                newY = position.y;
            } else {
                const mainAxisImages = (Object.values(images) as CanvasImage[]).filter(img => img.y === 0);
                const rightmostImageOnMainAxis = mainAxisImages.reduce((prev, curr) => {
                    if (!prev) return curr;
                    return (prev.x + prev.width) > (curr.x + curr.width) ? prev : curr;
                }, null as CanvasImage | null);
    
                if (rightmostImageOnMainAxis) {
                    newX = rightmostImageOnMainAxis.x + rightmostImageOnMainAxis.width + 40;
                    newY = 0;
                } else {
                    newX = 0;
                    newY = 0;
                }
            }
            
            const newImage: CanvasImage = {
                id: imageId, src: `data:image/jpeg;base64,${result.base64Image}`, alt: prompt, width, height, x: newX, y: newY, sourceImageId: sourceImageIdForNewImage,
            };
            
            setImages(prev => ({ ...prev, [imageId]: newImage }));
            addMessage('assistant', 'generated-image', { imageId, alt: prompt });
            setLastGeneratedImageId(imageId);

            if (usingBrandRef) {
                addMessage('assistant', 'text', "已应用 Brand DNA 风格参考图进行生成。");
            }

            // 3. Cloud Persistence & CREDIT DEDUCTION
            if (auth.currentUser) {
                const currentUid = auth.currentUser.uid;
                
                uploadImageToStorage(currentUid, result.base64Image)
                    .then(async (downloadUrl) => {
                        await saveGalleryItem(currentUid, {
                            fileUrl: downloadUrl,
                            prompt: prompt,
                            width,
                            height,
                            aspectRatio: finalRatio,
                            model: selectedModel,
                            type: 'image'
                        });
                        await deductUserCredits(currentUid, cost);
                    })
                    .catch(err => console.error(`[ImageGen] Post-generation processing FAILED:`, err));
            }

        } catch (error) { 
            console.error("Image generation failed:", error); 
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            let displayMessage = `抱歉，图片生成失败: ${errorMessage}`;
            if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
                displayMessage = '请求过于频繁，您已超出当前配额。请检查您的计划和账单详情，或稍后再试。';
            }
            addMessage('assistant', 'text', displayMessage);
        } finally {
            setIsLoading(false);
        }
    }, [uploadedFiles, images, addMessage, aspectRatio, calculateNewImagePosition, selectedModel, userProfile, activeProfile]);

    const executeEnhancePrompt = useCallback(async (prompt: string) => { 
        setIsLoading(true); 
        addMessage('assistant', 'tool-usage', { text: 'AI 创意总监 | 提示词优化' }); 
        try { 
            let imageInput = undefined;
            if (uploadedFiles.length > 0) {
                 const file = uploadedFiles[0];
                 const data = await blobToBase64(file);
                 imageInput = { data, mimeType: file.type };
            }

            // Pass active profile to enhancement service
            const suggestions = await enhancePrompt(prompt, imageInput, activeProfile || undefined); 
            addMessage('assistant', 'prompt-options', suggestions); 
        } catch (error) { 
            addMessage('assistant', 'text', '抱歉，无法优化提示词。'); 
        } finally { 
            setIsLoading(false); 
        } 
    }, [addMessage, uploadedFiles, activeProfile]);

    const executeGetDesignPlan = useCallback(async (prompt: string) => { 
        setIsLoading(true); 
        addMessage('assistant', 'tool-usage', { text: 'AI 创意总监 | 设计灵感' }); 
        try { 
            let imageInput = undefined;
            if (uploadedFiles.length > 0) {
                 const file = uploadedFiles[0];
                 const data = await blobToBase64(file);
                 imageInput = { data, mimeType: file.type };
            }

            // Pass activeProfile to getDesignPlan
            const plansWithPrompts = await getDesignPlan(prompt, imageInput, activeProfile || undefined); 
            if (plansWithPrompts.length === 0) { throw new Error("AI 未返回任何设计方案。"); } 
            const imagePromises = plansWithPrompts.map(plan => generateReferenceImage(plan.referenceImagePrompt).catch(() => ({ base64Image: '' }))); 
            const generatedImages = await Promise.all(imagePromises); 
            const plansForDisplay = plansWithPrompts.map((plan, index) => ({ title: plan.title, description: plan.description, prompt: plan.prompt, imageSrc: `data:image/jpeg;base64,${generatedImages[index].base64Image}`, })); 
            addMessage('assistant', 'design-plans', plansForDisplay); 
        } catch (error) { 
            addMessage('assistant', 'text', `抱歉，无法获取设计方案: ${error instanceof Error ? error.message : '未知错误'}`); 
        } finally { 
            setIsLoading(false); 
        } 
    }, [addMessage, uploadedFiles, activeProfile]);

    const handleLoadBrandImageToCanvas = useCallback(async () => {
        if (!activeProfile || !activeProfile.styleReferenceUrl) return;
        setIsLoading(true);
        try {
            const response = await fetch(activeProfile.styleReferenceUrl, { mode: 'cors' });
            if (!response.ok) throw new Error("Fetch failed");
            const blob = await response.blob();
            // Create a File object
            const file = new File([blob], "brand_ref.jpg", { type: blob.type });
            setUploadedFiles(prev => [...prev, file].slice(0, 3));
            addMessage('assistant', 'text', "已将 Brand DNA 参考图载入工作区，您可以基于此图进行修改。");
        } catch (e) {
            console.error("Failed to load brand image:", e);
            addMessage('assistant', 'text', "无法载入参考图，请检查网络或图片链接。");
        } finally {
            setIsLoading(false);
        }
    }, [activeProfile, addMessage]);

    const processUserTurn = useCallback(async (prompt: string) => {
        setIsLoading(true);
        try {
            // Extract description context for the AI Director
            const activeImageDesc = selectedImageId ? images[selectedImageId]?.alt : undefined;
            const prevImageDesc = lastGeneratedImageId ? images[lastGeneratedImageId]?.alt : undefined;
            const hasUploadedFiles = uploadedFiles.length > 0; // Check uploads

            const directorAction = await getCreativeDirectorAction(
                prompt, 
                selectedImageId, 
                lastGeneratedImageId, 
                messages,
                activeImageDesc,
                prevImageDesc,
                hasUploadedFiles
            );
            
            if (hasUploadedFiles) {
                console.log("[Director] Override: Force NEW_CREATION due to pending uploads.");
                directorAction.action = 'NEW_CREATION';
                directorAction.targetImageId = undefined;
                directorAction.reasoning = `检测到您上传了参考图片，正在基于图片为您生成新的创作。`;
            }

            if (directorAction.action === 'ANSWER_QUESTION') {
                addMessage('assistant', 'text', directorAction.prompt);
            } else {
                addMessage('assistant', 'text', directorAction.reasoning);
            }
    
            if (directorAction.action === 'NEW_CREATION') {
                setSelectedImageId(null);
            }
            
            switch (directorAction.action) {
                case 'EDIT_IMAGE':
                    // FALLBACK: If Creative Director says EDIT but returns no targetId (hallucination), use available context
                    // Prioritize explicitly selected image, then last generated
                    const targetId = directorAction.targetImageId || selectedImageId || lastGeneratedImageId;
                    
                    if (targetId) {
                        // Pass true for useImageAsInput to ensure Image-to-Image behavior
                        await executeImageGeneration(directorAction.prompt, targetId, true);
                    } else {
                        // If no target possible, degrade to NEW_CREATION (Text-to-Image)
                        console.warn("[Director] EDIT_IMAGE requested but no target found. Fallback to NEW_CREATION.");
                        await executeImageGeneration(directorAction.prompt, null);
                    }
                    break;
                case 'NEW_CREATION':
                    if (designInspirationEnabled) {
                        await executeGetDesignPlan(directorAction.prompt);
                    } else if (enhancePromptEnabled) {
                        await executeEnhancePrompt(directorAction.prompt);
                    } else {
                        await executeImageGeneration(directorAction.prompt, null);
                    }
                    break;
                case 'ANSWER_QUESTION':
                    break;
                default:
                    addMessage('assistant', 'text', "抱歉，我不太理解。");
                    break;
            }
        } catch (error) { 
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            let displayMessage = `抱歉，处理您的请求时出错: ${errorMessage}`;
            if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
                displayMessage = '请求过于频繁，您已超出当前配额。请检查您的计划和账单详情，或稍后再试。';
            }
            addMessage('assistant', 'text', displayMessage);
        } finally {
            setIsLoading(false);
        }
    }, [selectedImageId, lastGeneratedImageId, messages, images, addMessage, designInspirationEnabled, enhancePromptEnabled, executeImageGeneration, executeGetDesignPlan, executeEnhancePrompt, uploadedFiles]);
    
    const handleSubmit = useCallback(async (e?: React.FormEvent) => { 
        e?.preventDefault(); 
        const currentPrompt = userInput; 
        if (!currentPrompt.trim() && uploadedFiles.length === 0) return; 
        
        const imageUrls: string[] = [];
        if (uploadedFiles.length > 0) {
            for (const file of uploadedFiles) {
                imageUrls.push(URL.createObjectURL(file));
            }
        }

        addMessage('user', 'text', { text: currentPrompt, imageUrls }); 
        
        setUserInput(''); 
        
        processUserTurn(currentPrompt); 
    }, [userInput, uploadedFiles, addMessage, processUserTurn]);

    useEffect(() => { 
        if (isProfileLoading) return; 
        if (initialPrompt && !initialPromptHandled.current) { 
            initialPromptHandled.current = true; 
            addMessage('user', 'text', initialPrompt); 
            processUserTurn(initialPrompt); 
        } 
    }, [initialPrompt, addMessage, processUserTurn, isProfileLoading]);
    
    const handleUseSuggestion = (prompt: string) => { addMessage('user', 'text', `使用优化后的提示词：“${prompt}”`); executeImageGeneration(prompt, null); };
    const handleUseDesignPlan = (plan: {title: string, prompt: string}) => { addMessage('user', 'text', `选择设计灵感：“${plan.title}”`); if (enhancePromptEnabled) { addMessage('assistant', 'text', '好的，已选定设计方向。现在，我将基于这个方向为您优化提示词。'); executeEnhancePrompt(plan.prompt); } else { executeImageGeneration(plan.prompt, null); } };

    // --- CANVAS HANDLERS ---

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => { 
        if ((e.target as HTMLElement).closest('.editor-toolbar-wrapper') || (e.target as HTMLElement).closest('.on-canvas-chat-box-wrapper')) return; 
        
        if (toolMode === 'pan' || e.button === 1) { 
            isPanning.current = true; 
            lastMousePosition.current = { x: e.clientX, y: e.clientY };
            return;
        }
        
        if (!(e.target as HTMLElement).closest('.image-on-canvas')) {
            setSelectedImageId(null); 
            setChattingImageId(null); 
        }
    };

    const handleImageMouseDown = (e: React.MouseEvent, imageId: string) => {
        if (toolMode === 'select') {
            e.stopPropagation();
            e.preventDefault(); 
            
            setSelectedImageId(imageId);
            setChattingImageId(null);

            const img = images[imageId];
            if (img) {
                dragState.current = {
                    imageId: imageId,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialImageX: img.x,
                    initialImageY: img.y
                };
            }
        } else if (toolMode === 'chat') {
            e.stopPropagation();
            setChattingImageId(imageId);
            setSelectedImageId(null);
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => { 
        if (isPanning.current) { 
            const dx = e.clientX - lastMousePosition.current.x; 
            const dy = e.clientY - lastMousePosition.current.y; 
            setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy })); 
            lastMousePosition.current = { x: e.clientX, y: e.clientY }; 
            return;
        }

        if (dragState.current.imageId) {
            const { startX, startY, initialImageX, initialImageY, imageId } = dragState.current;
            const targetImg = images[imageId];
            if (!targetImg) return;

            const deltaX = (e.clientX - startX) / transform.scale;
            const deltaY = (e.clientY - startY) / transform.scale;
            const rawX = initialImageX + deltaX;
            const rawY = initialImageY + deltaY;

            let finalX = rawX;
            let finalY = rawY;
            const newGuides: SnapGuide[] = [];

            if (!(e.ctrlKey || e.metaKey)) {
                const threshold = SNAP_THRESHOLD_PX / transform.scale;
                const otherImages = (Object.values(images) as CanvasImage[]).filter(img => img.id !== imageId);

                const targetXPoints = [0, targetImg.width / 2, targetImg.width]; 
                let bestDeltaX = Infinity;
                let bestGuideX: number | null = null;

                otherImages.forEach(ref => {
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

                const targetYPoints = [0, targetImg.height / 2, targetImg.height];
                let bestDeltaY = Infinity;
                let bestGuideY: number | null = null;

                otherImages.forEach(ref => {
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
            setImages(prev => ({
                ...prev,
                [imageId]: { ...prev[imageId], x: finalX, y: finalY }
            }));
        }
    };

    const handleCanvasMouseUp = () => { 
        isPanning.current = false; 
        dragState.current = { imageId: null, startX: 0, startY: 0, initialImageX: 0, initialImageY: 0 };
        setSnapGuides([]);
    };

    const handleCanvasWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const sensitivity = 0.001; 
        const delta = -e.deltaY * sensitivity;

        setTransform(prev => {
            const targetScale = prev.scale + delta;
            const newScale = Math.min(Math.max(0.1, 5.0), targetScale);
            const scaleRatio = newScale / prev.scale;
            const newX = mouseX - (mouseX - prev.x) * scaleRatio;
            const newY = mouseY - (mouseY - prev.y) * scaleRatio;
            return { scale: newScale, x: newX, y: newY };
        });
    }, []);

    const zoom = (direction: 'in' | 'out') => { 
        if (!canvasRef.current) return; 
        const rect = canvasRef.current.getBoundingClientRect(); 
        const centerX = rect.width / 2; 
        const centerY = rect.height / 2; 
        const scaleAmount = direction === 'in' ? 0.1 : -0.1; 
        
        setTransform(prev => {
            const newScale = Math.min(Math.max(0.1, 5), prev.scale + scaleAmount);
            return { 
                scale: newScale, 
                x: centerX - (centerX - prev.x) * (newScale / prev.scale), 
                y: centerY - (centerY - prev.y) * (newScale / prev.scale) 
            };
        });
    };

    const setZoomLevel = (newScale: number) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect(); 
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const safeScale = Math.min(Math.max(0.1, 5), newScale);
        setTransform(prev => ({ 
            scale: safeScale, 
            x: centerX - (centerX - prev.x) * (safeScale / prev.scale), 
            y: centerY - (centerY - prev.y) * (safeScale / prev.scale) 
        }));
    };

    const fitToScreen = useCallback(() => {
        if (!canvasRef.current || !canvasRef.current.parentElement) return;
        const container = canvasRef.current.parentElement;
        const { clientWidth: viewportW, clientHeight: viewportH } = container;

        if (selectedImageId && images[selectedImageId]) {
            const img = images[selectedImageId];
            const padding = 100;
            const availableW = viewportW - padding;
            const availableH = viewportH - padding;

            const scaleX = availableW / img.width;
            const scaleY = availableH / img.height;
            let fitScale = Math.min(scaleX, scaleY);
            
            fitScale = Math.min(Math.max(fitScale, 0.1), 2.0); 

            const imgCenterX = img.x + img.width / 2;
            const imgCenterY = img.y + img.height / 2;
            
            const viewportCenterX = viewportW / 2;
            const viewportCenterY = viewportH / 2;

            const newX = viewportCenterX - (imgCenterX * fitScale);
            const newY = viewportCenterY - (imgCenterY * fitScale);

            setTransform({ x: newX, y: newY, scale: fitScale });
            return;
        }

        const imageList = Object.values(images) as CanvasImage[];
        if (imageList.length === 0) {
            setTransform({ x: 50, y: 50, scale: 1 });
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        imageList.forEach(img => {
            minX = Math.min(minX, img.x);
            minY = Math.min(minY, img.y);
            maxX = Math.max(maxX, img.x + img.width);
            maxY = Math.max(maxY, img.y + img.height);
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
        fitScale = Math.min(Math.max(fitScale, 0.1), 1.2); 

        const contentCenterX = minX + contentWidth / 2;
        const contentCenterY = minY + contentHeight / 2;
        const viewportCenterX = viewportW / 2;
        const viewportCenterY = viewportH / 2;

        const newX = viewportCenterX - (contentCenterX * fitScale);
        const newY = viewportCenterY - (contentCenterY * fitScale);

        setTransform({ x: newX, y: newY, scale: fitScale });
    }, [images, selectedImageId]);

    const handleSetToolMode = (mode: 'select' | 'pan' | 'chat') => {
        if (mode !== 'chat') setChattingImageId(null);
        if (mode !== 'select') setSelectedImageId(null);
        setToolMode(mode);
    };

    useEffect(() => { const handleKeyDown = (e: KeyboardEvent) => { if ((e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA/)) return; if (e.key.toLowerCase() === 'v') handleSetToolMode('select'); if (e.key.toLowerCase() === 'h') handleSetToolMode('pan'); if (e.key.toLowerCase() === 'c') handleSetToolMode('chat'); }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, []);
    useEffect(() => { if (!canvasRef.current) return; if (isPanning.current) { canvasRef.current.style.cursor = 'grabbing'; } else if (toolMode === 'pan') { canvasRef.current.style.cursor = 'grab'; } else { canvasRef.current.style.cursor = 'default'; } }, [toolMode, isPanning.current]);

    const handleImageClick = (e: React.MouseEvent, imageId: string) => {};
    
    const handleDownloadImage = () => { if (!selectedImageId || !images[selectedImageId]) return; const { src, alt } = images[selectedImageId]; const link = document.createElement('a'); link.href = src; link.download = `${alt.replace(/ /g, '_').slice(0, 30)}.jpg`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };
    
    const handleDownloadArchiveImage = (e: React.MouseEvent, fileUrl: string, prompt: string) => {
        e.stopPropagation();
        const link = document.createElement('a');
        link.href = fileUrl;
        link.target = '_blank';
        link.download = `aidea-gallery-${prompt.substring(0, 20)}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSelectGalleryItem = (item: GalleryItem) => {
        setIsArchiveOpen(false);
        if (images[item.id]) {
            setSelectedImageId(item.id);
            setTransform(prev => ({ ...prev, x: -images[item.id].x + 100, y: -images[item.id].y + 100 }));
            return;
        }
        const newImage: CanvasImage = {
            id: item.id,
            src: item.fileUrl,
            alt: item.prompt,
            width: item.width || 512,
            height: item.height || 512,
            x: 50,
            y: 50
        };
        setImages(prev => ({ ...prev, [item.id]: newImage }));
        setSelectedImageId(item.id);
    };

    const handleUpscale = async (factor: 2 | 4) => { 
        if (!selectedImageId || !images[selectedImageId]) return; 
        
        const sourceImage = images[selectedImageId]; 
        const { width: realWidth, height: realHeight } = await getImageDimensions(sourceImage.src);
        const maxDim = Math.max(realWidth, realHeight);

        if (maxDim > 3000) {
            alert("原图已是高清画质 (3000px+)，无需再次放大。");
            return;
        }

        setIsUpscaling(true); 
        addMessage('assistant', 'tool-usage', { text: `HD 超清重绘 & 放大 ${factor}倍 (Gemini 3 Pro Vision)` }); 
        
        let targetSize: '2K' | '4K' = '4K';
        if (factor === 2 && maxDim < 1280) {
            targetSize = '2K';
        } 

        try { 
            const { data, mimeType } = await prepareImageForApi(sourceImage.src);
            const result = await upscaleImage(data, mimeType, targetSize, sourceImage.alt); 
            
            const imageId = `img-hd-${Date.now()}`; 
            const { x, y } = calculateNewImagePosition(sourceImage.id, images); 
            
            const newImage: CanvasImage = { 
                id: imageId, 
                src: `data:image/jpeg;base64,${result.base64Image}`, 
                alt: `HD Upscale ${targetSize} of ${sourceImage.alt}`, 
                width: sourceImage.width,
                height: sourceImage.height, 
                x, 
                y, 
                sourceImageId: sourceImage.id, 
            }; 
            
            setImages(prev => ({ ...prev, [imageId]: newImage })); 
            addMessage('assistant', 'generated-image', { imageId, alt: newImage.alt }); 
            setLastGeneratedImageId(imageId); 
            setSelectedImageId(imageId); 
        } catch (error) { 
            console.error("Image upscale failed:", error); 
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            addMessage('assistant', 'text', `抱歉，图片高清化失败: ${errorMessage}`);
        } finally { setIsUpscaling(false); } 
    };

    const handleRegenerate = async () => {
        if (!selectedImageId || !images[selectedImageId]) return;
        setProcessingAction('regenerate');
        const prompt = images[selectedImageId].alt;
        addMessage('assistant', 'text', `正在基于原提示词再次生成：“${prompt}”`);
        try {
            await executeImageGeneration(prompt, selectedImageId, false);
        } finally {
            setProcessingAction(null);
        }
    };

    const handleRemoveBackground = async () => {
        if (!selectedImageId || !images[selectedImageId]) return;
        setProcessingAction('remove-bg');
        const sourceImage = images[selectedImageId];
        setIsLoading(true);
        addMessage('assistant', 'tool-usage', { text: 'AI 视觉引擎 | 去除背景' });
        addMessage('assistant', 'text', '正在分析前景对象并去除背景...');
        try {
            const { data, mimeType } = await prepareImageForApi(sourceImage.src);
            const result = await removeBackground(data, mimeType);
            const { width, height } = await getImageDimensions(result.base64Image);
            const imageId = `img-rmbg-${Date.now()}`;
            const { x, y } = calculateNewImagePosition(sourceImage.id, images);
            const newImage: CanvasImage = { id: imageId, src: `data:image/png;base64,${result.base64Image}`, alt: `Background removed version of ${sourceImage.alt}`, width, height, x, y, sourceImageId: sourceImage.id, };
            setImages(prev => ({ ...prev, [imageId]: newImage }));
            addMessage('assistant', 'generated-image', { imageId, alt: newImage.alt });
            setLastGeneratedImageId(imageId);
            setSelectedImageId(imageId);
        } catch (error) {
            console.error("Remove background failed:", error);
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            addMessage('assistant', 'text', `抱歉，背景去除失败: ${errorMessage}`);
        } finally {
            setIsLoading(false);
            setProcessingAction(null);
        }
    };

    const handleOnCanvasChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const prompt = onCanvasChatInput;
        const sourceImageId = chattingImageId;
        if (!prompt.trim() || !sourceImageId || !images[sourceImageId]) return;
        
        // --- ADDED: Log User Intent to Chat Stream ---
        const sourceImage = images[sourceImageId];
        addMessage('user', 'text', { 
            text: prompt, 
            imageUrls: [sourceImage.src] 
        });
        // ---------------------------------------------

        setIsLoading(true);
        setOnCanvasChatInput('');
        setChattingImageId(null);
        
        let finalRatio = getClosestAspectRatio(sourceImage.width, sourceImage.height);
        const intentRatio = parseAspectRatioFromPrompt(prompt);
        if (intentRatio) { finalRatio = intentRatio; }
        try {
            const imageData = await prepareImageForApi(sourceImage.src);
            if (!imageData) throw new Error("Could not process source image data.");
            const { data, mimeType } = imageData;
            const result = await generateImage(prompt, [{ data, mimeType }], finalRatio, selectedModel);
            const { width, height } = await getImageDimensions(result.base64Image);
            const newImageId = `img-${Date.now()}`;
            const { x, y } = calculateNewImagePosition(sourceImage.id, images);
            const newImage: CanvasImage = { id: newImageId, src: `data:image/jpeg;base64,${result.base64Image}`, alt: prompt, width, height, x, y, sourceImageId: sourceImage.id, };
            setImages(prev => ({ ...prev, [newImageId]: newImage }));
            setLastGeneratedImageId(newImageId);
            setChattingImageId(newImageId);
            // Result message is added inside generateImage flow or manually here? 
            // In executeImageGeneration it's added. Here we do it manually:
            addMessage('assistant', 'generated-image', { imageId: newImageId, alt: prompt });

        } catch (error) {
            console.error("On-canvas image generation failed:", error);
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            addMessage('assistant', 'text', `图片编辑失败: ${errorMessage}`);
            setChattingImageId(sourceImageId); 
        } finally {
            setIsLoading(false);
        }
    };

    const imageSeries = useMemo(() => {
        const allImages = Object.values(images) as CanvasImage[];
        if (allImages.length === 0) return [];
        const imageTimestamps = messages.reduce((acc, msg) => {
            if (msg.type === 'generated-image' && msg.content.imageId) {
                acc[msg.content.imageId] = msg.timestamp;
            }
            return acc;
        }, {} as Record<string, number>);
        const rootImages = allImages.filter(img => !img.sourceImageId);
        const series: ImageSeries[] = rootImages.map(root => {
            const seriesImages: CanvasImage[] = [root];
            const queue = [root.id];
            while (queue.length > 0) {
                const currentId = queue.shift()!;
                const children = allImages.filter(img => img.sourceImageId === currentId);
                seriesImages.push(...children);
                queue.push(...children.map(c => c.id));
            }
            return { id: root.id, creationDate: imageTimestamps[root.id] || Date.now(), initialPrompt: root.alt, images: seriesImages, };
        });
        return series.sort((a, b) => b.creationDate - a.creationDate);
    }, [images, messages]);

    return {
        messages, images, userInput, setUserInput, uploadedFiles, isLoading, isUpscaling, processingAction, selectedImageId,
        lastGeneratedImageId, isArchiveOpen, setIsArchiveOpen, archiveSummaries, enhancePromptEnabled, setEnhancePromptEnabled,
        designInspirationEnabled, setDesignInspirationEnabled, aspectRatio, setAspectRatio, selectedModel, setSelectedModel,
        transform, toolMode, chattingImageId, onCanvasChatInput, setOnCanvasChatInput, isEditing, inputHighlight,
        galleryItems, 
        handleSelectGalleryItem, 
        handleFileChange, handleRemoveFile, handlePaste, handleSubmit, handleUseSuggestion, handleUseDesignPlan,
        handleCanvasMouseDown, handleImageMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasWheel, zoom, setZoomLevel,
        fitToScreen,
        handleSetToolMode, handleImageClick, handleDownloadImage, handleDownloadArchiveImage,
        handleUpscale, handleRegenerate, handleRemoveBackground, handleOnCanvasChatSubmit,
        imageSeries, canvasRef, messagesEndRef, userInputRef, setSelectedImageId, setChattingImageId, setTransform,
        snapGuides,
        // Brand DNA Exports
        visualProfiles, activeProfile, profilesLoading, setActiveProfile, deleteProfile, isDNAOpen, setIsDNAOpen,
        configError, setConfigError, // Export config error state
        handleLoadBrandImageToCanvas // Export load brand image function
    };
};
