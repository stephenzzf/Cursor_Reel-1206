
// File: components/reel_gen/ReelChatSidebar.tsx
import React, { useRef } from 'react';
import { ReelMessage, GalleryItem, EnhancedPrompt, ReelAsset } from '../../types';
import { 
    AIAvatarIcon, ToolIcon,
    AIToggleButton, ReelModelSelector, ReelAspectRatioBadge,
    VideoCameraIcon, PhotoIcon, SparklesIcon, LightbulbIcon, PaperClipIcon, ArchiveBoxIcon
} from './ReelGenAssets';

// --- SUB-COMPONENT: Asset Card (Handles Safe Video Playback) ---
const AssetCard: React.FC<{ 
    asset: ReelAsset; 
    onSelect: (id: string) => void;
}> = ({ asset, onSelect }) => {
    // Removed auto-play refs and logic

    const getModelBadge = (model: string) => {
        if (!model) return 'Unknown';
        const m = model.toLowerCase();
        if (m.includes('veo')) return m.includes('fast') ? 'Veo Fast' : 'Veo Gen';
        if (m.includes('banana')) return m.includes('pro') ? 'Pro Image' : 'Flash Image';
        return 'AI Model';
    };

    return (
        <div className="relative group rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer border border-slate-200 bg-white" onClick={() => onSelect(asset.id)}>
            <div className="aspect-[9/16] relative bg-black/5">
                {asset.type === 'video' ? (
                    <div className="w-full h-full relative">
                        {/* Added controls, removed muted/loop to prevent auto-behaviour and require click */}
                        <video 
                            src={asset.src} 
                            className="w-full h-full object-cover" 
                            controls 
                            playsInline
                            onClick={(e) => e.stopPropagation()} // Prevent card selection when clicking controls
                        />
                        <div className="absolute top-1 right-1 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center pointer-events-none">
                            <VideoCameraIcon className="w-2.5 h-2.5 mr-1" />
                            {getModelBadge(asset.generationModel || '')}
                        </div>
                    </div>
                ) : (
                    <>
                        <img src={asset.src} className="w-full h-full object-cover" alt="generated" />
                        <div className="absolute top-1 right-1 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center">
                            <PhotoIcon className="w-2.5 h-2.5 mr-1" />
                            {getModelBadge(asset.generationModel || '')}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

interface ReelChatSidebarProps {
    messages: ReelMessage[];
    assets: Record<string, ReelAsset>;
    isLoading: boolean;
    userInput: string;
    setUserInput: (s: string) => void;
    uploadedFiles: File[];
    handleFileChange: (e: any) => void;
    handleRemoveFile: (i: number) => void;
    handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
    handleSubmit: (e?: React.FormEvent) => void;
    enhancePromptEnabled: boolean;
    setEnhancePromptEnabled: (b: boolean | ((p: boolean) => boolean)) => void;
    designInspirationEnabled: boolean;
    setDesignInspirationEnabled: (b: boolean | ((p: boolean) => boolean)) => void;
    selectedModel: string;
    setSelectedModel: (s: string) => void;
    isArchiveOpen: boolean;
    setIsArchiveOpen: (b: boolean) => void;
    galleryItems: GalleryItem[];
    userInputRef: React.RefObject<HTMLTextAreaElement>;
    messagesEndRef: React.RefObject<HTMLDivElement>;
    onSwitchModel?: (model: string, prompt: string) => void;
    handleUseSuggestion?: (p: string) => void;
    handleUseDesignPlan?: (p: any) => void;
    setSelectedAssetId: (id: string | null) => void;
}

const ReelChatSidebar: React.FC<ReelChatSidebarProps> = ({
    messages, assets, isLoading, userInput, setUserInput, uploadedFiles, handleFileChange, handleRemoveFile, handlePaste, handleSubmit,
    enhancePromptEnabled, setEnhancePromptEnabled, designInspirationEnabled, setDesignInspirationEnabled,
    selectedModel, setSelectedModel, isArchiveOpen, setIsArchiveOpen, galleryItems, userInputRef, messagesEndRef,
    onSwitchModel, handleUseSuggestion, handleUseDesignPlan, setSelectedAssetId
}) => {
    
    // Group consecutive asset messages to create a "collection" feel similar to Image Gen
    const groupConsecutiveMessages = (msgs: ReelMessage[]): (ReelMessage | ReelMessage[])[] => {
        const grouped: (ReelMessage | ReelMessage[])[] = [];
        let i = 0;
        while (i < msgs.length) {
            const currentMsg = msgs[i];
            if (currentMsg.role === 'assistant' && currentMsg.type === 'generated-asset') {
                const group = [currentMsg];
                let j = i + 1;
                while (j < msgs.length && msgs[j].role === 'assistant' && msgs[j].type === 'generated-asset') {
                    group.push(msgs[j]);
                    j++;
                }
                if (group.length > 0) {
                    grouped.push(group);
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

    const groupedMessages = groupConsecutiveMessages(messages);

    return (
        <div className="w-[35%] min-w-[400px] h-full flex flex-col border-r border-slate-100/50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] bg-white z-10 relative">
            <main className="flex-1 overflow-y-auto p-5 space-y-6 flex flex-col min-h-0 scrollbar-thin scrollbar-thumb-slate-100 z-0">
                {groupedMessages.map((msgOrGroup, idx) => {
                    // --- GROUPED ASSETS ---
                    if (Array.isArray(msgOrGroup)) {
                        const key = msgOrGroup.map(m => m.id).join('-');
                        return (
                            <div key={key} className="w-full animate-fade-in-up self-start flex items-start space-x-3">
                                <AIAvatarIcon className="flex-shrink-0 mt-1" />
                                <div className="flex flex-col bg-[#F2F4F7] px-5 py-4 rounded-2xl rounded-tl-sm text-slate-700 text-sm shadow-sm max-w-lg w-full">
                                    <p className="text-slate-500 mb-3 text-xs font-medium uppercase tracking-wider flex items-center">
                                        <SparklesIcon className="w-3 h-3 mr-1 text-pink-500" />
                                        Generated Collection
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {msgOrGroup.map(msg => {
                                            const asset = assets[msg.content.assetId];
                                            return asset ? <AssetCard key={msg.id} asset={asset} onSelect={setSelectedAssetId} /> : null;
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    } 
                    
                    // --- SINGLE MESSAGES ---
                    const msg = msgOrGroup as ReelMessage;

                    if (msg.role === 'user') {
                        // User Bubble Logic
                        let text = '';
                        let attachments: { url: string; type: string }[] = [];

                        if (typeof msg.content === 'string') {
                            text = msg.content;
                        } else if (typeof msg.content === 'object' && msg.content !== null) {
                            text = msg.content.text || '';
                            if (Array.isArray(msg.content.attachments)) {
                                attachments = msg.content.attachments;
                            } else if (Array.isArray(msg.content.imageUrls)) { 
                                attachments = msg.content.imageUrls.map((url: string) => ({ url, type: 'image' }));
                            }
                        }

                        return (
                            <div key={msg.id} className="w-full animate-fade-in-up flex flex-col items-end space-y-2">
                                {attachments.length > 0 && (
                                    <div className="flex flex-wrap justify-end gap-2 mb-1">
                                        {attachments.map((att, idx) => (
                                            <div key={idx} className="w-24 h-24 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative bg-slate-100 group">
                                                {att.type === 'video' ? (
                                                    <div className="w-full h-full relative">
                                                        <video src={att.url} className="w-full h-full object-cover" />
                                                        <div className="absolute top-1 right-1 bg-black/50 text-white text-[8px] px-1 rounded backdrop-blur-sm">VIDEO</div>
                                                    </div>
                                                ) : (
                                                    <img src={att.url} alt="upload" className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {text && (
                                    <div className="bg-gradient-to-r from-pink-500 to-orange-400 text-white px-5 py-3.5 rounded-2xl rounded-tr-sm max-w-[90%] shadow-sm text-sm leading-relaxed">
                                        {text}
                                    </div>
                                )}
                            </div>
                        );
                    } else {
                        // Assistant Messages
                        
                        // Special Handling for Tool Usage - Compact Style
                        if (msg.type === 'tool-usage') {
                            return (
                                <div key={msg.id} className="w-full animate-fade-in-up self-start pl-11 my-1">
                                    <div className="inline-flex items-center gap-1.5 bg-teal-50/80 border border-teal-200/60 px-3 py-1.5 rounded-lg text-xs text-teal-800 font-medium">
                                        <ToolIcon className="w-3.5 h-3.5 text-teal-600" />
                                        <span>{msg.content.text}</span>
                                    </div>
                                </div>
                            );
                        }

                        // Standard Assistant Wrapper
                        return (
                            <div key={msg.id} className="w-full animate-fade-in-up flex justify-start">
                                <AIAvatarIcon className="flex-shrink-0 mt-1 mr-3" />
                                <div className="max-w-[85%] w-full">
                                    
                                    {/* Text Message - Render line breaks for status messages */}
                                    {msg.type === 'text' && (
                                        <div className="bg-[#F2F4F7] px-5 py-4 rounded-2xl rounded-tl-sm text-slate-700 text-sm leading-relaxed shadow-sm whitespace-pre-wrap">
                                            {typeof msg.content === 'string' ? msg.content : msg.content.text}
                                        </div>
                                    )}
                                    
                                    {/* Generated Asset (Single fallback if grouping fails) */}
                                    {msg.type === 'generated-asset' && (
                                        (() => {
                                            const asset = assets[msg.content.assetId];
                                            if (!asset) return null;
                                            return (
                                                <div className="bg-[#F2F4F7] px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm w-full max-w-sm">
                                                    <AssetCard asset={asset} onSelect={setSelectedAssetId} />
                                                </div>
                                            );
                                        })()
                                    )}

                                    {/* Prompt Options */}
                                    {msg.type === 'prompt-options' && Array.isArray(msg.content) && msg.content.length > 0 && (
                                        <div className="flex flex-col space-y-3 w-full bg-[#F2F4F7] p-4 rounded-2xl rounded-tl-sm">
                                            <p className="mb-3 font-medium text-sm text-slate-700">为您构思了以下创意方向：</p>
                                            <div className="space-y-2">
                                                {(msg.content as EnhancedPrompt[]).map((opt, idx) => (
                                                    <button key={idx} onClick={() => handleUseSuggestion && handleUseSuggestion(opt.fullPrompt)} className="w-full text-left p-3.5 bg-white rounded-xl border border-slate-200 hover:border-pink-400 hover:shadow-md transition-all group relative overflow-hidden">
                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-pink-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                        <div className="flex justify-between items-start mb-1">
                                                            <h4 className="font-bold text-slate-800 text-sm group-hover:text-pink-600 transition-colors">{opt.title}</h4>
                                                            <span className="text-[10px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full font-bold">PROMPT</span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{opt.description}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Design Plans */}
                                    {msg.type === 'design-plans' && Array.isArray(msg.content) && msg.content.length > 0 && (
                                        <div className="flex flex-col space-y-3 w-full bg-[#F2F4F7] p-4 rounded-2xl rounded-tl-sm">
                                            <p className="mb-3 font-medium text-sm text-slate-700">为您找到以下设计灵感与风格：</p>
                                            <div className="grid grid-cols-1 gap-3">
                                                {(msg.content as any[]).map((plan, idx) => (
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
                                                            <button onClick={() => handleUseDesignPlan && handleUseDesignPlan(plan)} className="w-full py-2 bg-pink-50 text-pink-600 text-xs font-bold rounded-lg hover:bg-pink-100 hover:text-pink-700 transition-colors">
                                                                采用此风格
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Model Suggestion */}
                                    {msg.type === 'model-suggestion' && (
                                        <div className="flex flex-col space-y-3 bg-white p-4 rounded-2xl rounded-tl-sm shadow-sm border border-amber-100">
                                            <p className="font-medium text-amber-700 flex items-center">
                                                <span className="text-lg mr-2">🤔</span>
                                                {msg.content.text}
                                            </p>
                                            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200/50">
                                                <p className="text-xs text-slate-500 mb-3">AI 建议您切换模型以获得最佳效果。</p>
                                                <button 
                                                    onClick={() => onSwitchModel && onSwitchModel(msg.content.suggestedModel, msg.content.originalPrompt)}
                                                    className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-lg hover:shadow-md transition-all active:scale-95 flex items-center justify-center"
                                                >
                                                    切换至 {msg.content.suggestedModel.includes('veo') ? 'Veo 视频' : 'Flash 图片'} 并生成
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    }
                })}
                
                {isLoading && (
                    <div className="w-full animate-fade-in-up flex justify-start">
                        <AIAvatarIcon isThinking={true} className="mr-3" />
                        <div className="bg-[#F2F4F7] px-4 py-3 rounded-2xl rounded-tl-sm text-xs text-slate-500 flex items-center shadow-sm">
                            AI 正在思考...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </main>

            <div className="p-6 bg-white border-t border-slate-50 z-20 relative">
                {/* ... (Footer controls remain same) ... */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                        <AIToggleButton icon={<SparklesIcon className="w-3.5 h-3.5" />} label="优化" checked={enhancePromptEnabled} onChange={() => setEnhancePromptEnabled(p => !p)} />
                        <AIToggleButton icon={<LightbulbIcon className="w-3.5 h-3.5" />} label="灵感" checked={designInspirationEnabled} onChange={() => setDesignInspirationEnabled(p => !p)} />
                    </div>
                    <div className="flex items-center space-x-2">
                        <ReelModelSelector value={selectedModel} onChange={setSelectedModel} disabled={isLoading} />
                        <ReelAspectRatioBadge />
                    </div>
                </div>

                {/* Uploaded Files Preview */}
                {uploadedFiles.length > 0 && (
                    <div className="absolute bottom-full left-6 mb-3 flex gap-2">
                        {uploadedFiles.map((file, i) => (
                            <div key={i} className="relative w-12 h-12 rounded-lg border border-slate-200 shadow-sm bg-white overflow-hidden group animate-fade-in-up">
                                {file.type.startsWith('video/') ? (
                                    <video src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                                ) : (
                                    <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt={`upload preview ${i}`} />
                                )}
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
                    <div className="flex items-center gap-2 bg-white rounded-[26px] border border-slate-200 shadow-sm p-1.5 focus-within:ring-2 focus-within:ring-pink-100 focus-within:border-pink-300 transition-all">
                        <textarea
                            ref={userInputRef}
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                            onPaste={handlePaste}
                            placeholder="输入提示词... (支持混排创作)"
                            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-700 px-4 py-3 max-h-32 resize-none ml-1"
                            rows={1}
                            style={{ minHeight: '44px' }}
                            disabled={isLoading}
                        />
                        <div className="flex-shrink-0">
                            <label htmlFor="reel-upload" className="cursor-pointer text-slate-400 hover:text-pink-600 transition-colors flex items-center justify-center w-9 h-9 rounded-full hover:bg-slate-100">
                                <PaperClipIcon className="w-5 h-5" />
                                <input id="reel-upload" type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" disabled={isLoading || uploadedFiles.length >= 3} />
                            </label>
                        </div>
                        <button type="submit" disabled={isLoading || (!userInput.trim() && uploadedFiles.length === 0)} className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 text-white hover:shadow-md flex items-center justify-center transition-all disabled:bg-none disabled:bg-slate-200 disabled:cursor-not-allowed">
                            {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '↑'}
                        </button>
                    </div>
                </form>
            </div>

            {isArchiveOpen && (
                <div className="absolute inset-0 bg-white z-50 flex flex-col animate-fade-in-up">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="font-bold text-lg text-slate-800 flex items-center">
                            <ArchiveBoxIcon className="w-5 h-5 mr-2 text-indigo-600" />
                            创作档案
                        </h2>
                        <button 
                            onClick={() => setIsArchiveOpen(false)} 
                            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                            aria-label="关闭档案"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                        {galleryItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                                </svg>
                                <p className="text-slate-500 text-sm mb-2">暂无创作记录</p>
                                <p className="text-slate-400 text-xs">开始创作您的第一个 Reel 吧！</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {galleryItems.map(item => (
                                    <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group cursor-pointer" onClick={() => {
                                        setSelectedAssetId(item.id);
                                        setIsArchiveOpen(false);
                                    }}>
                                        <div className="aspect-[9/16] bg-slate-100 relative">
                                            {item.type === 'video' ? (
                                                <video src={item.fileUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={item.fileUrl} className="w-full h-full object-cover" alt="archive" />
                                            )}
                                            <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">{item.type}</div>
                                        </div>
                                        <div className="p-2">
                                            <p className="text-[10px] text-slate-500 line-clamp-2">{item.prompt}</p>
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

export default ReelChatSidebar;
