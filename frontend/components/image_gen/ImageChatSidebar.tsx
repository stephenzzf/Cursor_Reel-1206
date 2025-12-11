
import React, { useRef, useEffect } from 'react';
import { ImageMessage, CanvasImage, ImageSeries, EnhancedPrompt, GalleryItem } from '../../types';
import { 
    AIAvatarIcon, ToolIcon, SparklesIcon, LightbulbIcon, ArchiveBoxIcon, ArrowDownTrayIcon, PaperClipIcon,
    AIToggleButton, ModelSelector, AspectRatioSelector, FingerPrintIcon, ArrowDownOnSquareIcon
} from './ImageGenAssets';

interface ImageChatSidebarProps {
    messages: ImageMessage[];
    images: Record<string, CanvasImage>;
    isLoading: boolean;
    userInput: string;
    setUserInput: (s: string) => void;
    uploadedFiles: File[];
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleRemoveFile: (i: number) => void;
    handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
    handleSubmit: (e?: React.FormEvent) => void;
    enhancePromptEnabled: boolean;
    setEnhancePromptEnabled: (b: boolean | ((p: boolean) => boolean)) => void;
    designInspirationEnabled: boolean;
    setDesignInspirationEnabled: (b: boolean | ((p: boolean) => boolean)) => void;
    aspectRatio: string;
    setAspectRatio: (s: string) => void;
    selectedModel: 'banana' | 'banana_pro';
    setSelectedModel: (s: 'banana' | 'banana_pro') => void;
    isArchiveOpen: boolean;
    setIsArchiveOpen: (b: boolean) => void;
    imageSeries: ImageSeries[];
    archiveSummaries: Record<string, string>;
    galleryItems?: GalleryItem[];
    handleSelectGalleryItem?: (item: GalleryItem) => void;
    handleDownloadArchiveImage: (e: React.MouseEvent, fileUrl: string, prompt: string) => void;
    setSelectedImageId: (id: string | null) => void;
    handleUseSuggestion: (p: string) => void;
    handleUseDesignPlan: (p: any) => void;
    userInputRef: React.RefObject<HTMLTextAreaElement>;
    messagesEndRef: React.RefObject<HTMLDivElement>;
    isEditing: boolean;
    inputHighlight: boolean;
    onReset: () => void;
    // New prop
    activeDNAName?: string | null;
    onDeactivateDNA?: () => void;
    onLoadBrandImage?: () => void; // New prop for loading brand image
    setTransform?: (transform: { x: number; y: number; scale: number } | ((prev: { x: number; y: number; scale: number }) => { x: number; y: number; scale: number })) => void;
    fitToScreen?: () => void;
}

const ImageChatSidebar: React.FC<ImageChatSidebarProps> = ({
    messages, images, isLoading, userInput, setUserInput, uploadedFiles, handleFileChange, handleRemoveFile, handlePaste, handleSubmit,
    enhancePromptEnabled, setEnhancePromptEnabled, designInspirationEnabled, setDesignInspirationEnabled, aspectRatio, setAspectRatio,
    selectedModel, setSelectedModel, isArchiveOpen, setIsArchiveOpen, imageSeries, archiveSummaries, galleryItems = [], handleSelectGalleryItem,
    handleDownloadArchiveImage, setSelectedImageId, handleUseSuggestion, handleUseDesignPlan, userInputRef, messagesEndRef, isEditing, inputHighlight, onReset,
    activeDNAName, onDeactivateDNA, onLoadBrandImage, setTransform, fitToScreen
}) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // 清理 timeout 当组件卸载时
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);
    
    const groupConsecutiveImages = (msgs: ImageMessage[]): (ImageMessage | ImageMessage[])[] => {
        const grouped: (ImageMessage | ImageMessage[])[] = [];
        let i = 0;
        while (i < msgs.length) {
            const currentMsg = msgs[i];
            if (currentMsg.role === 'assistant' && currentMsg.type === 'generated-image') {
                const imageGroup = [currentMsg];
                let j = i + 1;
                while (j < msgs.length && msgs[j].role === 'assistant' && msgs[j].type === 'generated-image') {
                    imageGroup.push(msgs[j]);
                    j++;
                }
                if (imageGroup.length > 1) {
                    grouped.push(imageGroup);
                    i = j;
                } else {
                    grouped.push(currentMsg);
                    i++;
                }
            } else {
                grouped.push(currentMsg);
                i++;
            }
        }
        return grouped;
    };

    return (
        <div className="w-[35%] min-w-[400px] h-full flex flex-col border-r border-slate-100/50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] bg-white z-10 relative">
            
            <main className="flex-1 overflow-y-auto p-5 space-y-6 flex flex-col min-h-0 scrollbar-thin scrollbar-thumb-slate-100 z-0">
                {groupConsecutiveImages(messages).map(msgOrGroup => {
                    if (Array.isArray(msgOrGroup)) {
                        const key = msgOrGroup.map(m => m.id).join('-');
                        return (
                            <div key={key} className="w-full animate-fade-in-up self-start flex items-start space-x-3">
                                <AIAvatarIcon className="flex-shrink-0 mt-1" />
                                <div className="flex flex-col bg-[#F2F4F7] px-5 py-4 rounded-2xl rounded-tl-sm text-slate-700 text-sm shadow-sm max-w-lg">
                                    <p className="text-slate-500 mb-3 text-xs font-medium uppercase tracking-wider">Generated Collection</p>
                                    <div className="flex flex-wrap gap-2">
                                        {msgOrGroup.map(msg => {
                                            const image = images[msg.content.imageId];
                                            return image ? (
                                                <div key={msg.id} className="relative group rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer border border-slate-200" onClick={() => {
                                                    setSelectedImageId(image.id);
                                                    if (setTransform && fitToScreen) {
                                                        // 清理之前的 timeout
                                                        if (timeoutRef.current) {
                                                            clearTimeout(timeoutRef.current);
                                                        }
                                                        // 延迟执行以确保图片已选中
                                                        timeoutRef.current = setTimeout(() => {
                                                            fitToScreen();
                                                            timeoutRef.current = null;
                                                        }, 50);
                                                    }
                                                }}>
                                                    <img src={image.src} alt={image.alt} className="w-28 h-28 object-cover group-hover:scale-105 transition-transform duration-500" />
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    } else {
                        const msg = msgOrGroup;
                        if (msg.role === 'user') {
                            const content = msg.content;
                            let text = '';
                            let imgs: string[] = [];

                            if (typeof content === 'string') {
                                text = content;
                            } else if (typeof content === 'object') {
                                text = content.text || '';
                                imgs = content.imageUrls || [];
                            }

                            return (
                                <div key={msg.id} className="w-full animate-fade-in-up self-end flex flex-col items-end space-y-2">
                                    {/* Render uploaded images grid if present */}
                                    {imgs.length > 0 && (
                                        <div className="flex flex-wrap justify-end gap-2 mb-1">
                                            {imgs.map((url, index) => (
                                                <div key={index} className="w-32 h-32 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative bg-slate-50">
                                                    <img src={url} alt="Uploaded" className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* Render text bubble */}
                                    {text && (
                                        <p className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white px-5 py-3.5 rounded-2xl rounded-tr-sm max-w-lg shadow-md text-sm leading-relaxed tracking-wide">
                                            {text}
                                        </p>
                                    )}
                                </div>
                            );
                        } else {
                            if (msg.type === 'generated-image') {
                                const image = images[msg.content.imageId];
                                return image ? (
                                    <div key={msg.id} className="w-full animate-fade-in-up self-start flex items-start space-x-3">
                                        <AIAvatarIcon className="flex-shrink-0 mt-1" />
                                        <div className="flex flex-col">
                                            <div className="relative group rounded-2xl overflow-hidden shadow-lg border border-slate-100 bg-white">
                                                <img src={image.src} alt={image.alt} className="max-w-sm max-h-96 object-contain cursor-pointer" onClick={() => {
                                                    setSelectedImageId(image.id);
                                                    if (setTransform && fitToScreen) {
                                                        // 清理之前的 timeout
                                                        if (timeoutRef.current) {
                                                            clearTimeout(timeoutRef.current);
                                                        }
                                                        // 延迟执行以确保图片已选中
                                                        timeoutRef.current = setTimeout(() => {
                                                            fitToScreen();
                                                            timeoutRef.current = null;
                                                        }, 50);
                                                    }
                                                }}/>
                                                <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent text-white p-3 pt-8 text-xs truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {image.alt}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : null;
                            }
                            if (msg.type === 'text') {
                                return (
                                    <div key={msg.id} className="w-full animate-fade-in-up self-start flex items-start space-x-3">
                                        <AIAvatarIcon className="flex-shrink-0 mt-1" />
                                        <div className="bg-[#F2F4F7] px-5 py-4 rounded-2xl rounded-tl-sm text-slate-700 text-sm leading-relaxed shadow-sm max-w-lg">
                                            <p className="whitespace-pre-wrap">{typeof msg.content === 'string' ? msg.content : ''}</p>
                                        </div>
                                    </div>
                                );
                            }
                            if (msg.type === 'tool-usage') {
                                return (
                                    <div key={msg.id} className="w-full animate-fade-in-up self-start pl-11">
                                        <div className="bg-teal-50 border-l-4 border-teal-400 pl-3 pr-4 py-2.5 rounded-r-lg max-w-md inline-flex items-center my-1">
                                            <div className="flex items-center text-xs font-medium text-teal-800">
                                                <ToolIcon className="w-3.5 h-3.5 mr-2 flex-shrink-0 text-teal-600" />
                                                <div>
                                                    <span>使用工具 | </span>
                                                    <span className="font-semibold text-teal-700">{msg.content.text}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            if (msg.type === 'prompt-options') {
                                const options = msg.content as EnhancedPrompt[];
                                return (
                                    <div key={msg.id} className="w-full animate-fade-in-up self-start flex items-start space-x-3">
                                        <AIAvatarIcon className="flex-shrink-0 mt-1" />
                                        <div className="flex flex-col space-y-3 w-full max-w-lg">
                                            <div className="bg-[#F2F4F7] p-4 rounded-2xl rounded-tl-sm text-slate-700 shadow-sm border border-slate-50">
                                                <p className="mb-3 font-medium text-sm">为您构思了以下创意方向：</p>
                                                <div className="space-y-2">
                                                    {options.map((opt, idx) => (
                                                        <button key={idx} onClick={() => handleUseSuggestion(opt.fullPrompt)} className="w-full text-left p-3.5 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all group relative overflow-hidden">
                                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                            <div className="flex justify-between items-start mb-1">
                                                                <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{opt.title}</h4>
                                                                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">PROMPT</span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{opt.description}</p>
                                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                                {opt.tags.map(tag => <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">{tag}</span>)}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            if (msg.type === 'design-plans') {
                                const plans = msg.content as {title: string, description: string, prompt: string, imageSrc: string}[];
                                return (
                                    <div key={msg.id} className="w-full animate-fade-in-up self-start flex items-start space-x-3">
                                        <AIAvatarIcon className="flex-shrink-0 mt-1" />
                                        <div className="flex flex-col space-y-3 w-full max-w-lg">
                                            <div className="bg-[#F2F4F7] p-4 rounded-2xl rounded-tl-sm text-slate-700 shadow-sm border border-slate-50">
                                                <p className="mb-3 font-medium text-sm">为您找到以下设计灵感与风格：</p>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {plans.map((plan, idx) => (
                                                        <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                                                            <div className="h-32 w-full relative overflow-hidden">
                                                                {plan.imageSrc ? (
                                                                    <img src={plan.imageSrc} alt={plan.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                                                ) : (
                                                                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs animate-pulse">预览生成中...</div>
                                                                )}
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                                                <h4 className="absolute bottom-2 left-3 text-white font-bold text-sm shadow-sm">{plan.title}</h4>
                                                            </div>
                                                            <div className="p-3">
                                                                <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">{plan.description}</p>
                                                                <button onClick={() => handleUseDesignPlan(plan)} className="w-full py-2 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-colors">
                                                                    采用此风格
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }
                    }
                })}
                {isLoading && (
                        <div className="w-full animate-fade-in-up self-start flex items-start space-x-3">
                        <AIAvatarIcon isThinking={true} />
                        <div className="bg-[#F2F4F7] px-4 py-3 rounded-2xl rounded-tl-sm text-xs text-slate-500 flex items-center shadow-sm">
                            AI 正在思考
                            <div className="flex space-x-1 ml-2">
                                <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                                <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </main>
            
            {/* Input Area */}
            <div className="p-6 bg-white border-t border-slate-50 z-20 relative">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                        <AIToggleButton icon={<SparklesIcon className="w-3.5 h-3.5" />} label="优化" checked={enhancePromptEnabled} onChange={() => setEnhancePromptEnabled(p => !p)} />
                        <AIToggleButton icon={<LightbulbIcon className="w-3.5 h-3.5" />} label="灵感" checked={designInspirationEnabled} onChange={() => setDesignInspirationEnabled(p => !p)} />
                    </div>
                    <div className="flex items-center space-x-2">
                        <ModelSelector value={selectedModel} onChange={setSelectedModel} disabled={isEditing} />
                        <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} disabled={isEditing} />
                    </div>
                </div>
                
                {/* Active Brand DNA Indicator */}
                {activeDNAName && (
                    <div className="absolute bottom-full left-6 mb-3 animate-fade-in">
                        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full pl-3 pr-2 py-1 shadow-sm">
                            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Active Brand DNA</span>
                            <div className="flex items-center gap-1.5">
                                <FingerPrintIcon className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="text-xs font-bold text-indigo-700">{activeDNAName}</span>
                            </div>
                            
                            {onLoadBrandImage && (
                                <button 
                                    onClick={onLoadBrandImage}
                                    className="ml-1 hover:bg-indigo-100 rounded-full p-1 text-indigo-500 hover:text-indigo-700 transition-colors"
                                    title="载入参考图到画布"
                                >
                                    <ArrowDownOnSquareIcon className="w-3.5 h-3.5" />
                                </button>
                            )}

                            <div className="w-px h-3 bg-indigo-200 mx-0.5"></div>

                            <button 
                                onClick={onDeactivateDNA}
                                className="hover:bg-indigo-100 rounded-full p-0.5 text-indigo-400 hover:text-indigo-600 transition-colors"
                                title="关闭 Brand DNA"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* Uploaded Files Preview */}
                {uploadedFiles.length > 0 && (
                    <div className="absolute bottom-full left-6 mb-3 flex gap-2">
                        {uploadedFiles.map((file, i) => (
                            <div key={i} className="relative w-12 h-12 rounded-lg border border-slate-200 shadow-sm bg-white overflow-hidden group animate-fade-in-up">
                                <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt={`upload preview ${i}`} />
                                <button 
                                    type="button"
                                    onClick={() => handleRemoveFile(i)} 
                                    className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    &times;
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="relative w-full">
                    <div className={`flex items-center gap-2 bg-white rounded-[26px] border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-1.5 transition-all duration-300 ease-out ${
                        inputHighlight 
                        ? 'border-indigo-400 shadow-[0_0_0_4px_rgba(99,102,241,0.1)]' 
                        : 'focus-within:border-indigo-400 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.1)]'
                    }`}>
                        {/* Text Input */}
                        <textarea
                            ref={userInputRef}
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                            onPaste={handlePaste}
                            placeholder={isLoading ? "AI正在工作中..." : (isEditing ? "描述修改意图..." : "输入提示词...")}
                            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-sm text-slate-700 placeholder-slate-400 px-4 py-3 max-h-32 resize-none ml-1"
                            rows={1}
                            disabled={isLoading}
                            style={{ minHeight: '44px' }}
                        />

                        {/* Attachment Button */}
                        <div className="flex-shrink-0">
                             <label htmlFor="file-upload" className={`cursor-pointer text-slate-400 hover:text-indigo-600 transition-colors flex items-center justify-center w-9 h-9 rounded-full hover:bg-slate-100 ${uploadedFiles.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''}`} title="上传参考图">
                                <PaperClipIcon className="w-5 h-5" />
                                <input id="file-upload" type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" disabled={uploadedFiles.length >= 3 || isLoading} />
                            </label>
                        </div>

                        {/* Send Button */}
                        <button
                            type="submit"
                            disabled={isLoading || (!userInput.trim() && uploadedFiles.length === 0)}
                            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                                (!userInput.trim() && uploadedFiles.length === 0) || isLoading
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
                            }`}
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 pl-0.5">
                                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                                </svg>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {isArchiveOpen && (
                <div className="absolute inset-0 bg-white z-50 flex flex-col animate-fade-in-up duration-300">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white flex-shrink-0 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <h2 className="font-bold text-lg text-slate-800 flex items-center"><ArchiveBoxIcon className="w-5 h-5 mr-2 text-indigo-600" />创作档案</h2>
                        <button onClick={() => setIsArchiveOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-full transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                        {galleryItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <ArchiveBoxIcon className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-medium">暂无云端创作记录</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {galleryItems.map(item => (
                                    <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-300 transition-all group relative cursor-pointer" onClick={() => handleSelectGalleryItem?.(item)}>
                                        <div className="aspect-square bg-slate-100 relative overflow-hidden">
                                            <img src={item.fileUrl} alt={item.prompt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <button onClick={(e) => handleDownloadArchiveImage(e, item.fileUrl, item.prompt)} className="p-2 bg-white/90 rounded-full text-slate-700 hover:text-indigo-600 shadow-md transform scale-90 hover:scale-100 transition-all" title="下载"><ArrowDownTrayIcon className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                        <div className="p-3 border-t border-slate-100">
                                            <p className="text-xs text-slate-700 line-clamp-2 font-medium mb-2 leading-relaxed">{item.prompt}</p>
                                            <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold tracking-wide">
                                                <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{item.aspectRatio || '1:1'}</span>
                                                <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Just now'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageChatSidebar;
