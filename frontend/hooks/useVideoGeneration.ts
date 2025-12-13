
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
    enhancePrompt, 
    getDesignPlan, 
    generateReferenceImage, 
    summarizePrompt,
    getVideoCreativeDirectorAction, 
    generateVideo
} from '../services/videoService';
import { saveGalleryItem, subscribeToGallery } from '../services/galleryService';
import { deductUserCredits } from '../services/userService';
import { auth } from '../firebaseConfig';
import { CanvasVideo, VideoMessage, VideoSeries, GalleryItem, UserProfile, SnapGuide } from '../types';

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve((reader.result as string).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });

const SNAP_THRESHOLD_PX = 10; // Screen pixels threshold for snapping

export const useVideoGeneration = (initialPrompt: string, userProfile: UserProfile | null, isProfileLoading: boolean) => {
    const [messages, setMessages] = useState<VideoMessage[]>([]);
    const [videos, setVideos] = useState<Record<string, CanvasVideo>>({});
    const [userInput, setUserInput] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
    const [lastGeneratedVideoId, setLastGeneratedVideoId] = useState<string | null>(null);
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);
    const [archiveSummaries, setArchiveSummaries] = useState<Record<string, string>>({});
    const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]); 

    const [enhancePromptEnabled, setEnhancePromptEnabled] = useState(false);
    const [designInspirationEnabled, setDesignInspirationEnabled] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [selectedModel, setSelectedModel] = useState<'veo_fast' | 'veo_gen'>('veo_fast');
    const [videoPlaybackErrors, setVideoPlaybackErrors] = useState<Record<string, boolean>>({});

    const [transform, setTransform] = useState({ x: 50, y: 50, scale: 0.5 });
    const [toolMode, setToolMode] = useState<'select' | 'pan' | 'chat'>('select');
    const [chattingVideoId, setChattingVideoId] = useState<string | null>(null);
    const [onCanvasChatInput, setOnCanvasChatInput] = useState('');
    const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

    // --- DRAG STATE ---
    const isPanning = useRef(false);
    const dragState = useRef<{
        videoId: string | null;
        startX: number;
        startY: number;
        initialVideoX: number;
        initialVideoY: number;
    }>({ videoId: null, startX: 0, startY: 0, initialVideoX: 0, initialVideoY: 0 });

    const lastMousePosition = useRef({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const initialPromptHandled = useRef(false);
    const userInputRef = useRef<HTMLTextAreaElement>(null);

    // Scroll to bottom of chat
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // Auto-resize textarea
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

    // Subscribe to Gallery (移除 API Key 检查，因为后端已处理)
    useEffect(() => {
        let unsubscribeGallery: (() => void) | undefined;
        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (unsubscribeGallery) {
                unsubscribeGallery();
                unsubscribeGallery = undefined;
            }
            if (user) {
                unsubscribeGallery = subscribeToGallery(user.uid, (items) => {
                    const videos = items.filter(i => i.type === 'video');
                    setGalleryItems(videos);
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

    const addMessage = useCallback((role: 'user' | 'assistant', type: VideoMessage['type'], content: any) => {
        setMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random()}`, role, type, content, timestamp: Date.now() }]);
    }, []);

    const calculateNewVideoPosition = useCallback((sourceVideoId: string | null | undefined, allVideos: Record<string, CanvasVideo>): { x: number; y: number } => {
         if (sourceVideoId && allVideos[sourceVideoId]) {
             const sourceVideo = allVideos[sourceVideoId];
             const columnX = sourceVideo.x;
             const videosInColumn = Object.values(allVideos).filter(v => Math.abs(v.x - columnX) < 20);
             const maxY = videosInColumn.reduce((max, v) => Math.max(max, v.y + v.height), 0);
             return { x: columnX, y: maxY + 24 };
         }
         const mainAxisVideos = (Object.values(allVideos) as CanvasVideo[]).filter(v => v.y === 0);
         const rightmost = mainAxisVideos.reduce((prev, curr) => {
             if (!prev) return curr;
             return (prev.x + prev.width) > (curr.x + curr.width) ? prev : curr;
         }, null as CanvasVideo | null);

         if (rightmost) {
             return { x: rightmost.x + rightmost.width + 40, y: 0 };
         }
         return { x: 50, y: 50 };
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) { const files = Array.from(e.target.files).slice(0, 2 - uploadedFiles.length); setUploadedFiles(prev => [...prev, ...files]); } };
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
                return combined.slice(0, 2);
            });
        }
    }, []);

    const executeVideoGeneration = useCallback(async (
        prompt: string, 
        sourceVideoId?: string | null,
        overrideParams?: {
            images: { data: string; mimeType: string }[];
            model: 'veo_fast' | 'veo_gen';
            aspectRatio: string;
        }
    ) => {
        let imagesToUse: { data: string; mimeType: string }[] = [];
        let modelToUse = selectedModel;
        let ratioToUse = aspectRatio;

        if (overrideParams) {
            imagesToUse = overrideParams.images;
            modelToUse = overrideParams.model;
            ratioToUse = overrideParams.aspectRatio;
        } else {
            imagesToUse = await Promise.all(uploadedFiles.map(async file => ({ 
                data: await blobToBase64(file), 
                mimeType: file.type 
            })));
            setUploadedFiles([]);
        }

        // --- CREDIT CHECK ---
        const cost = modelToUse === 'veo_gen' ? 50 : 35;
        if (!userProfile) {
            alert("请先登录后再进行创作。");
            return;
        }
        if (userProfile.credits < cost) {
            alert(`积分不足！\n\n生成此视频需要 ${cost} 积分，您当前余额为 ${userProfile.credits}。\n请联系管理员或升级套餐。`);
            return;
        }

        setIsLoading(true);
        const videoId = `vid-${Date.now()}`;
        
        const width = ratioToUse === '16:9' ? 640 : 360;
        const height = ratioToUse === '16:9' ? 360 : 640;
        const { x, y } = calculateNewVideoPosition(sourceVideoId, videos);

        const newVideo: CanvasVideo = {
            id: videoId, src: '', prompt, width, height, x, y, status: 'generating',
            sourceVideoId: sourceVideoId || undefined, // Store source ID for connection lines
            generationParams: { sourceImages: imagesToUse, model: modelToUse, aspectRatio: ratioToUse }
        };
        setVideos(prev => ({ ...prev, [videoId]: newVideo }));
        
        let modeLabel = "文本生成视频";
        if (imagesToUse.length === 1) modeLabel = "图生视频 (参考图)";
        if (imagesToUse.length === 2) modeLabel = "首尾帧生成视频";
        const modelDisplayName = modelToUse === 'veo_gen' ? 'Veo (Gen)' : 'Veo Fast (Preview)';
        
        let timeEstimate = "30-60 秒";
        if (modelToUse === 'veo_gen') timeEstimate = "2-5 分钟";

        addMessage('assistant', 'text', `AI 视频生成引擎已启动 (Veo) 🚀\n\n📋 任务参数:\n• 模式: ${modeLabel}\n• 模型: ${modelDisplayName}\n• 预估时间: ${timeEstimate}\n• 消耗: ${cost} 积分\n• 尺寸: ${ratioToUse}\n• 提示词: ${prompt}\n\n正在为您生成视频，请稍候...`);

        try {
            // Step 1: Generate Video (后端已处理持久化，直接返回可用 URL)
            const { videoUri } = await generateVideo(prompt, imagesToUse, ratioToUse as any, modelToUse);
            
            // Step 2: Update status to saving
            setVideos(prev => ({ ...prev, [videoId]: { ...prev[videoId], src: videoUri, status: 'saving' } }));
            
            // Step 3: Save Metadata to Firestore Gallery & Deduct Credits
            // 注意：后端已处理视频持久化，videoUri 已经是永久 URL
            if (userProfile && userProfile.uid) {
                try {
                    await saveGalleryItem(userProfile.uid, {
                        fileUrl: videoUri,
                        prompt: prompt,
                        width,
                        height,
                        aspectRatio: ratioToUse,
                        model: modelToUse,
                        type: 'video' 
                    });
                    await deductUserCredits(userProfile.uid, cost);
                } catch (e) {
                    console.error("Failed to save video metadata or deduct credits:", e);
                }
            }

            // Step 4: Finalize UI
            setVideos(prev => ({ ...prev, [videoId]: { ...prev[videoId], src: videoUri, status: 'done' } }));
            addMessage('assistant', 'generated-video', { videoId, prompt });
            setLastGeneratedVideoId(videoId);
        } catch (error) {
            console.error("Video generation failed:", error);
            const msg = error instanceof Error ? error.message : 'Unknown error';
            let displayMsg = `视频生成失败: ${msg}`;
            if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
                displayMsg = '请求过于频繁，您已超出当前配额。请检查您的计划和账单详情，或稍后再试。';
            }
            setVideos(prev => ({ ...prev, [videoId]: { ...prev[videoId], status: 'error', errorMsg: displayMsg } }));
            addMessage('assistant', 'text', displayMsg);
        } finally {
            setIsLoading(false);
        }
    }, [uploadedFiles, videos, addMessage, aspectRatio, selectedModel, calculateNewVideoPosition, userProfile]);

    const executeEnhancePrompt = useCallback(async (prompt: string) => { 
        setIsLoading(true); 
        addMessage('assistant', 'tool-usage', { text: 'AI 创意总监 | 提示词优化' }); 
        try { 
            const suggestions = await enhancePrompt(prompt, selectedModel); 
            addMessage('assistant', 'prompt-options', suggestions); 
        } catch (error) { 
            addMessage('assistant', 'text', '抱歉，无法优化提示词。'); 
        } finally { 
            setIsLoading(false); 
        } 
    }, [addMessage, selectedModel]);
    
    const executeGetDesignPlan = useCallback(async (prompt: string) => { 
        setIsLoading(true); 
        addMessage('assistant', 'tool-usage', { text: 'AI 创意总监 | 设计灵感' }); 
        try { 
            const plans = await getDesignPlan(prompt, selectedModel); 
            const imagePromises = plans.map(plan => generateReferenceImage(plan.referenceImagePrompt).catch(() => ({ base64Image: '' }))); 
            const generatedImages = await Promise.all(imagePromises); 
            const plansForDisplay = plans.map((plan, index) => ({ 
                ...plan, 
                imageSrc: `data:image/jpeg;base64,${generatedImages[index].base64Image}`, 
            })); 
            addMessage('assistant', 'design-plans', plansForDisplay); 
        } catch (error) { 
            addMessage('assistant', 'text', '抱歉，无法获取设计方案。'); 
        } finally { 
            setIsLoading(false); 
        } 
    }, [addMessage, selectedModel]);

    const processUserTurn = useCallback(async (prompt: string) => {
        setIsLoading(true);
        try {
            const hasUploadedFiles = uploadedFiles.length > 0;
            const directorAction = await getVideoCreativeDirectorAction(
                prompt, 
                messages, 
                selectedVideoId, 
                lastGeneratedVideoId,
                hasUploadedFiles,
                selectedModel
            );

            // Force NEW_VIDEO if uploads exist, overriding AI decision if needed
            if (hasUploadedFiles) {
                console.log("[VideoDirector] Override: Force NEW_VIDEO due to pending uploads.");
                directorAction.action = 'NEW_VIDEO';
                directorAction.targetVideoId = undefined; 
                directorAction.reasoning = `检测到您上传了参考素材，正在为您生成新的视频。`;
            }

            if (directorAction.action === 'ANSWER_QUESTION') {
                addMessage('assistant', 'text', directorAction.prompt);
            } else {
                addMessage('assistant', 'text', directorAction.reasoning);
            }
            if (directorAction.action === 'NEW_VIDEO' || directorAction.action === 'EDIT_VIDEO') {
                // If the AI suggests editing a specific video, select it (unless overridden by upload)
                if (directorAction.targetVideoId && videos[directorAction.targetVideoId] && !hasUploadedFiles) {
                    setSelectedVideoId(directorAction.targetVideoId);
                }
                
                if (designInspirationEnabled) await executeGetDesignPlan(directorAction.prompt);
                else if (enhancePromptEnabled) await executeEnhancePrompt(directorAction.prompt);
                else await executeVideoGeneration(directorAction.prompt, directorAction.targetVideoId);
            }
        } catch (error) {
             const errorMessage = error instanceof Error ? error.message : '未知错误';
             addMessage('assistant', 'text', `处理请求出错: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    }, [messages, selectedVideoId, lastGeneratedVideoId, videos, addMessage, designInspirationEnabled, enhancePromptEnabled, executeVideoGeneration, executeGetDesignPlan, executeEnhancePrompt, uploadedFiles, selectedModel]);

    const handleSubmit = useCallback((e?: React.FormEvent) => { e?.preventDefault(); const currentPrompt = userInput; if (!currentPrompt.trim() && uploadedFiles.length === 0) return; addMessage('user', 'text', currentPrompt); setUserInput(''); processUserTurn(currentPrompt); }, [userInput, uploadedFiles, addMessage, processUserTurn]);
    
    const handleOnCanvasChatSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const prompt = onCanvasChatInput;
        const targetId = chattingVideoId;
        
        if (!prompt.trim() || !targetId) return;
        
        setOnCanvasChatInput('');
        setChattingVideoId(null);
        setSelectedVideoId(targetId); // Ensure context is selected for the director
        
        addMessage('user', 'text', prompt);
        processUserTurn(prompt);
    }, [onCanvasChatInput, chattingVideoId, addMessage, processUserTurn]);

    useEffect(() => { 
        if (isProfileLoading) return; 
        if (initialPrompt && !initialPromptHandled.current) { 
            initialPromptHandled.current = true; 
            addMessage('user', 'text', initialPrompt); 
            processUserTurn(initialPrompt); 
        } 
    }, [initialPrompt, addMessage, processUserTurn, isProfileLoading]);
    
    const handleUseSuggestion = (prompt: string) => { addMessage('user', 'text', `使用优化后的提示词："${prompt}"`); executeVideoGeneration(prompt, selectedVideoId); };
    const handleUseDesignPlan = (plan: {title: string, prompt: string}) => { addMessage('user', 'text', `选择设计灵感："${plan.title}"`); if (enhancePromptEnabled) executeEnhancePrompt(plan.prompt); else executeVideoGeneration(plan.prompt, selectedVideoId); };

    const handleRegenerate = useCallback(() => {
        if (!selectedVideoId || !videos[selectedVideoId]) return;
        const video = videos[selectedVideoId];
        if (video.generationParams) {
            executeVideoGeneration(video.prompt, video.id, {
                images: video.generationParams.sourceImages,
                model: video.generationParams.model,
                aspectRatio: video.generationParams.aspectRatio
            });
        } else {
             alert("此视频缺少生成参数记录，无法直接再次生成。请尝试手动重新配置参数。");
        }
    }, [selectedVideoId, videos, executeVideoGeneration]);

    const handleDownloadVideo = () => { 
        if (!selectedVideoId || !videos[selectedVideoId]) return; 
        const vid = videos[selectedVideoId]; 
        if(vid.status !== 'done') return; 
        const link = document.createElement('a'); link.href = vid.src; link.download = `veo-video-${vid.id}.mp4`; link.referrerPolicy = "no-referrer"; document.body.appendChild(link); link.click(); document.body.removeChild(link); 
    };

    const handleCopyFrame = async () => {
        if (!selectedVideoId || !videos[selectedVideoId]) return;
        const vid = videos[selectedVideoId];
        if (vid.status !== 'done') return;

        try {
            const btn = document.activeElement as HTMLButtonElement;
            const originalText = btn ? btn.innerText : '';
            if(btn) btn.innerText = "提取中...";

            // 1. Fetch data into a fresh local Blob (bypassing remote URL taint issues if fetch succeeds)
            const response = await fetch(vid.src);
            if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
            const blob = await response.blob();
            const tempUrl = URL.createObjectURL(blob);

            // 2. Create temp video element
            const tempVideo = document.createElement('video');
            tempVideo.src = tempUrl;
            tempVideo.muted = true;
            tempVideo.playsInline = true;
            // CRITICAL: Do NOT set crossOrigin for local Blob URLs generated from memory.
            
            // 3. Wait for data load
            await new Promise((resolve, reject) => {
                tempVideo.onloadeddata = () => resolve(true);
                tempVideo.onerror = (e) => reject(e);
                tempVideo.load();
            });

            // 4. Sync time with on-screen video
            const onScreenVideo = document.querySelector(`.video-on-canvas video[src="${vid.src}"]`) as HTMLVideoElement;
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

    const handleDownloadArchiveVideo = (e: React.MouseEvent, fileUrl: string, prompt: string) => {
        e.stopPropagation();
        const link = document.createElement('a'); link.href = fileUrl; const safePrompt = prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50); link.download = `aidea-video-${safePrompt}.mp4`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const handleSelectArchiveVideo = (item: GalleryItem) => {
        setIsArchiveOpen(false);
        if (videos[item.id]) {
            setSelectedVideoId(item.id);
            setTransform(prev => ({ ...prev, x: -videos[item.id].x + 100, y: -videos[item.id].y + 100 }));
            return;
        }
        const newVideo: CanvasVideo = {
            id: item.id,
            src: item.fileUrl,
            prompt: item.prompt,
            width: item.width || 640,
            height: item.height || 360,
            x: 50,
            y: 50,
            status: 'done'
        };
        setVideos(prev => ({ ...prev, [item.id]: newVideo }));
        setSelectedVideoId(item.id);
    };

    // --- CANVAS HANDLERS (Improved with Snapping & Dragging) ---
    
    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => { 
        if ((e.target as HTMLElement).closest('.video-on-canvas') || (e.target as HTMLElement).closest('.editor-toolbar-wrapper') || (e.target as HTMLElement).closest('.on-canvas-chat-box-wrapper')) return; 
        
        if (toolMode === 'pan' || e.button === 1) { 
            isPanning.current = true; 
            lastMousePosition.current = { x: e.clientX, y: e.clientY }; 
        } else { 
            setSelectedVideoId(null); 
            setChattingVideoId(null);
        } 
    };

    const handleVideoMouseDown = (e: React.MouseEvent, videoId: string) => {
        if (toolMode === 'select') {
            e.stopPropagation();
            e.preventDefault();
            
            setSelectedVideoId(videoId);
            setChattingVideoId(null);
            
            const vid = videos[videoId];
            if (vid) {
                dragState.current = {
                    videoId: videoId,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialVideoX: vid.x,
                    initialVideoY: vid.y
                };
            }
        } else if (toolMode === 'chat') {
            e.stopPropagation();
            setChattingVideoId(videoId);
            setSelectedVideoId(null);
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => { 
        // 1. Pan Logic
        if (isPanning.current) { 
            const dx = e.clientX - lastMousePosition.current.x; 
            const dy = e.clientY - lastMousePosition.current.y; 
            setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy })); 
            lastMousePosition.current = { x: e.clientX, y: e.clientY }; 
            return;
        }

        // 2. Drag & Snap Logic
        if (dragState.current.videoId) {
            const { startX, startY, initialVideoX, initialVideoY, videoId } = dragState.current;
            const targetVid = videos[videoId];
            if (!targetVid) return;

            const deltaX = (e.clientX - startX) / transform.scale;
            const deltaY = (e.clientY - startY) / transform.scale;
            const rawX = initialVideoX + deltaX;
            const rawY = initialVideoY + deltaY;

            let finalX = rawX;
            let finalY = rawY;
            const newGuides: SnapGuide[] = [];

            // Skip snapping if Ctrl/Meta key is pressed
            if (!(e.ctrlKey || e.metaKey)) {
                const threshold = SNAP_THRESHOLD_PX / transform.scale;
                const otherVideos = (Object.values(videos) as CanvasVideo[]).filter(v => v.id !== videoId);

                // --- X-AXIS SNAPPING ---
                const targetXPoints = [0, targetVid.width / 2, targetVid.width]; 
                let bestDeltaX = Infinity;
                let bestGuideX: number | null = null;

                otherVideos.forEach(ref => {
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
                const targetYPoints = [0, targetVid.height / 2, targetVid.height];
                let bestDeltaY = Infinity;
                let bestGuideY: number | null = null;

                otherVideos.forEach(ref => {
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
            setVideos(prev => ({
                ...prev,
                [videoId]: { ...prev[videoId], x: finalX, y: finalY }
            }));
        }
    };

    const handleCanvasMouseUp = () => { 
        isPanning.current = false; 
        dragState.current = { videoId: null, startX: 0, startY: 0, initialVideoX: 0, initialVideoY: 0 };
        setSnapGuides([]);
    };

    const handleCanvasWheel = (e: React.WheelEvent<HTMLDivElement>) => { if (!canvasRef.current) return; const rect = canvasRef.current.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const scaleAmount = -e.deltaY * 0.001; const newScale = Math.min(Math.max(0.1, 5), transform.scale + scaleAmount); setTransform(prev => ({ scale: newScale, x: mouseX - (mouseX - prev.x) * (newScale / prev.scale), y: mouseY - (mouseY - prev.y) * (newScale / prev.scale) })); };
    
    const zoom = (direction: 'in' | 'out') => { if (!canvasRef.current) return; const rect = canvasRef.current.getBoundingClientRect(); const centerX = rect.width / 2; const centerY = rect.height / 2; const scaleAmount = direction === 'in' ? 0.1 : -0.1; const newScale = Math.min(Math.max(0.1, 5), transform.scale + scaleAmount); setTransform(prev => ({ scale: newScale, x: centerX - (centerX - prev.x) * (newScale / prev.scale), y: centerY - (centerY - prev.y) * (newScale / prev.scale) })); }
    
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

    const handleSetToolMode = (mode: 'select' | 'pan' | 'chat') => {
        if (mode !== 'chat') setChattingVideoId(null);
        if (mode !== 'select') setSelectedVideoId(null);
        setToolMode(mode);
    };

    const videoSeries = useMemo(() => {
        const allVideos = Object.values(videos) as CanvasVideo[];
        if (allVideos.length === 0) return [];
        return allVideos.map(v => ({
            id: v.id, creationDate: parseInt(v.id.split('-')[1]) || Date.now(), initialPrompt: v.prompt, videos: [v]
        })).sort((a, b) => b.creationDate - a.creationDate);
    }, [videos]);

    return {
        messages, videos, userInput, setUserInput, uploadedFiles, isLoading, selectedVideoId, setSelectedVideoId,
        isArchiveOpen, setIsArchiveOpen, archiveSummaries, videoSeries, galleryItems, enhancePromptEnabled, setEnhancePromptEnabled,
        designInspirationEnabled, setDesignInspirationEnabled, aspectRatio, setAspectRatio, selectedModel, setSelectedModel,
        videoPlaybackErrors, setVideoPlaybackErrors, transform, toolMode, setToolMode: handleSetToolMode, snapGuides,
        chattingVideoId, onCanvasChatInput, setOnCanvasChatInput, handleOnCanvasChatSubmit,
        handleFileChange, handleRemoveFile, handlePaste, handleSubmit, handleUseSuggestion, handleUseDesignPlan,
        handleRegenerate, handleDownloadVideo, handleCopyFrame, handleDownloadArchiveVideo, handleSelectArchiveVideo,
        handleCanvasMouseDown, handleVideoMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasWheel, zoom, setZoomLevel,
        canvasRef, messagesEndRef, userInputRef
    };
};
