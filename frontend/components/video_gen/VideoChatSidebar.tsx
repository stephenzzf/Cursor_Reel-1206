
import React from 'react';
import { VideoMessage, CanvasVideo, VideoSeries, EnhancedPrompt, GalleryItem } from '../../types';
import { 
    AIAvatarIcon, ToolIcon, SparklesIcon, LightbulbIcon, ArchiveBoxIcon, ArrowDownTrayIcon, PaperClipIcon, VideoCameraIcon,
    AIToggleButton, ModeIndicator, ModelSelector, AspectRatioSelector 
} from './VideoGenAssets';

interface VideoChatSidebarProps {
    messages: VideoMessage[];
    videos: Record<string, CanvasVideo>;
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
    selectedModel: 'veo_fast' | 'veo_gen';
    setSelectedModel: (s: 'veo_fast' | 'veo_gen') => void;
    isArchiveOpen: boolean;
    setIsArchiveOpen: (b: boolean) => void;
    videoSeries: VideoSeries[];
    archiveSummaries: Record<string, string>;
    galleryItems?: GalleryItem[]; 
    handleDownloadArchiveVideo: (e: React.MouseEvent, fileUrl: string, prompt: string) => void;
    handleSelectArchiveVideo?: (item: GalleryItem) => void;
    setSelectedVideoId: (id: string | null) => void;
    handleUseSuggestion: (p: string) => void;
    handleUseDesignPlan: (p: any) => void;
    videoPlaybackErrors: Record<string, boolean>;
    setVideoPlaybackErrors: (prev: (p: Record<string, boolean>) => Record<string, boolean>) => void;
    userInputRef: React.RefObject<HTMLTextAreaElement>;
    messagesEndRef: React.RefObject<HTMLDivElement>;
}

const VideoChatSidebar: React.FC<VideoChatSidebarProps> = ({
    messages, videos, isLoading, userInput, setUserInput, uploadedFiles, handleFileChange, handleRemoveFile, handlePaste, handleSubmit,
    enhancePromptEnabled, setEnhancePromptEnabled, designInspirationEnabled, setDesignInspirationEnabled, aspectRatio, setAspectRatio,
    selectedModel, setSelectedModel, isArchiveOpen, setIsArchiveOpen, videoSeries, archiveSummaries, galleryItems = [], handleDownloadArchiveVideo, handleSelectArchiveVideo, setSelectedVideoId,
    handleUseSuggestion, handleUseDesignPlan, videoPlaybackErrors, setVideoPlaybackErrors, userInputRef, messagesEndRef
}) => {
    return (
        <div className="w-[35%] min-w-[400px] h-full flex flex-col border-r border-slate-100/50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] bg-white z-10 relative">
            <main className="flex-1 overflow-y-auto p-5 space-y-6 flex flex-col min-h-0 scrollbar-thin scrollbar-thumb-slate-100 z-0">
                {messages.map(msg => {
                    if (msg.role === 'user') {
                        return (
                            <div key={msg.id} className="w-full animate-fade-in-up self-end flex justify-end">
                                <p className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white px-5 py-3.5 rounded-2xl rounded-tr-sm max-w-lg shadow-md text-sm leading-relaxed tracking-wide">
                                    {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                                </p>
                            </div>
                        );
                    } else {
                        if (msg.type === 'generated-video') {
                            const v = videos[msg.content.videoId];
                            return v ? (
                                <div key={msg.id} className="w-full animate-fade-in-up self-start flex items-start space-x-3">
                                    <AIAvatarIcon className="flex-shrink-0 mt-1" />
                                    <div className="bg-[#F2F4F7] px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm w-full max-w-sm cursor-pointer hover:ring-2 hover:ring-indigo-300 transition-all border border-transparent" onClick={() => setSelectedVideoId(v.id)}>
                                        <div className="flex items-center space-x-2 mb-2">
                                            <VideoCameraIcon className="w-5 h-5 text-indigo-500" />
                                            <span className="text-sm font-semibold text-slate-700">Video Generated</span>
                                        </div>
                                        <p className="text-xs text-slate-600 mb-3 leading-relaxed line-clamp-2">{v.prompt}</p>
                                        
                                        <div className="rounded-xl overflow-hidden bg-black w-full shadow-inner ring-1 ring-black/10">
                                            {v.status === 'done' ? (
                                                videoPlaybackErrors[v.id] ? (
                                                    <div className="flex flex-col items-center justify-center h-[200px] bg-slate-900 relative group overflow-hidden" onClick={(e) => { e.stopPropagation(); window.open(v.src, '_blank', 'noopener,noreferrer'); }}>
                                                        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-slate-900 to-black z-0"></div>
                                                        <div className="relative z-10 w-12 h-12 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center mb-2 border border-white/10 shadow-xl group-hover:scale-110 group-hover:bg-white/10 transition-all duration-300 ease-out">
                                                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-inner">
                                                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-900 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
                                                            </div>
                                                        </div>
                                                        <p className="relative z-10 text-white/50 text-[10px] font-medium">点击在新窗口播放</p>
                                                    </div>
                                                ) : (
                                                    <video 
                                                        src={v.src} key={v.src} className="w-full h-auto object-contain max-h-[300px]" controls playsInline preload="auto"
                                                        crossOrigin={v.src.startsWith('blob:') ? "anonymous" : undefined}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedVideoId(v.id); }}
                                                        onError={() => setVideoPlaybackErrors(prev => ({ ...prev, [v.id]: true }))}
                                                    />
                                                )
                                            ) : v.status === 'error' ? (
                                                <div className="flex items-center justify-center h-32 text-red-500 text-xs p-2 text-center bg-red-50">生成失败: {v.errorMsg}</div>
                                            ) : (
                                                <div className="flex items-center justify-center h-32 bg-slate-100 text-slate-400 text-xs"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2"></div>生成中...</div>
                                            )}
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
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
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
                                                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors mb-1">{opt.title}</h4>
                                                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{opt.description}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                        if (msg.type === 'design-plans') {
                            const plans = msg.content;
                            return (
                                <div key={msg.id} className="w-full animate-fade-in-up self-start flex items-start space-x-3">
                                    <AIAvatarIcon className="flex-shrink-0 mt-1" />
                                    <div className="flex flex-col space-y-3 w-full max-w-lg">
                                        <div className="bg-[#F2F4F7] p-4 rounded-2xl rounded-tl-sm text-slate-700 shadow-sm border border-slate-50">
                                            <div className="grid grid-cols-1 gap-3">
                                                {plans.map((plan: any, i: number) => (
                                                    <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                                                        <div className="h-32 w-full relative overflow-hidden">
                                                            <img src={plan.imageSrc} alt={plan.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                                            <h4 className="absolute bottom-2 left-3 text-white font-bold text-sm shadow-sm">{plan.title}</h4>
                                                        </div>
                                                        <div className="p-3">
                                                            <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">{plan.description}</p>
                                                            <button onClick={() => handleUseDesignPlan(plan)} className="w-full py-2 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-colors">采用此风格</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                    }
                    return null;
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
            
            <footer className="p-6 bg-white border-t border-slate-50 z-20 relative">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                        <AIToggleButton icon={<SparklesIcon className="w-3.5 h-3.5"/>} label="提示词" checked={enhancePromptEnabled} onChange={() => setEnhancePromptEnabled(p => !p)} />
                        <AIToggleButton icon={<LightbulbIcon className="w-3.5 h-3.5"/>} label="灵感" checked={designInspirationEnabled} onChange={() => setDesignInspirationEnabled(p => !p)} />
                    </div>
                    <div className="flex items-center space-x-2">
                        <ModeIndicator fileCount={uploadedFiles.length} />
                        <ModelSelector value={selectedModel} onChange={setSelectedModel} disabled={isLoading} />
                        <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} disabled={isLoading} />
                    </div>
                </div>

                {uploadedFiles.length > 0 && (
                    <div className="absolute bottom-full left-6 mb-3 flex gap-2">
                        {uploadedFiles.map((file, i) => (
                            <div key={i} className="relative group w-16 h-16 flex-shrink-0 rounded-lg border border-slate-200 overflow-hidden shadow-sm bg-white animate-fade-in-up">
                                <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt={`upload preview ${i}`} />
                                <button onClick={() => handleRemoveFile(i)} className="absolute top-0.5 right-0.5 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5 w-4 h-4 flex items-center justify-center transition-colors backdrop-blur-sm">&times;</button>
                                <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[9px] px-1 py-0.5 truncate backdrop-blur-sm text-center">{i === 0 ? (uploadedFiles.length === 2 ? '首帧' : '参考') : '尾帧'}</div>
                            </div>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="relative w-full">
                    <div className="flex items-center gap-2 bg-white rounded-[26px] border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-1.5 transition-all duration-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300">
                        <textarea 
                            ref={userInputRef} 
                            value={userInput} 
                            onChange={e => setUserInput(e.target.value)} 
                            onPaste={handlePaste} 
                            onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey){e.preventDefault(); handleSubmit(e)}}} 
                            placeholder={isLoading ? "AI正在工作中..." : (uploadedFiles.length > 0 ? "描述视频内容..." : "输入网址 URL 或创作指令...")} 
                            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-700 placeholder-slate-400 px-4 py-3 max-h-32 resize-none ml-1" 
                            rows={1} 
                            disabled={isLoading}
                            style={{ minHeight: '44px' }}
                        />
                        
                        <div className="flex-shrink-0">
                            <label htmlFor="vid-file-upload" className={`cursor-pointer text-slate-400 hover:text-indigo-600 transition-colors flex items-center justify-center w-9 h-9 rounded-full hover:bg-slate-100 ${uploadedFiles.length >= 2 ? 'opacity-50 cursor-not-allowed' : ''}`} title="上传参考图/首尾帧">
                                <PaperClipIcon className="w-5 h-5" />
                                <input id="vid-file-upload" type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" disabled={uploadedFiles.length >= 2 || isLoading} />
                            </label>
                        </div>

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
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 pl-0.5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                            )}
                        </button>
                    </div>
                </form>
            </footer>

            {isArchiveOpen && (
                <div className="absolute inset-0 bg-white z-50 flex flex-col animate-fade-in-up duration-300">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white flex-shrink-0 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                        <h2 className="font-bold text-lg text-slate-800 flex items-center"><ArchiveBoxIcon className="w-5 h-5 mr-2 text-indigo-600" />创作档案</h2>
                        <button onClick={() => setIsArchiveOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-full transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                        {galleryItems.length === 0 ? <p className="text-center text-slate-400 mt-10 text-sm">暂无视频记录</p> : (
                            <div className="grid grid-cols-2 gap-4">
                                {galleryItems.map(item => (
                                    <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all group relative cursor-pointer" onClick={() => handleSelectArchiveVideo?.(item)}>
                                        <div className="aspect-video bg-gray-900 relative overflow-hidden flex items-center justify-center">
                                            <video src={item.fileUrl} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <button onClick={(e) => handleDownloadArchiveVideo(e, item.fileUrl, item.prompt)} className="p-2 bg-white/90 rounded-full text-slate-700 hover:text-indigo-600 shadow-md transform scale-90 hover:scale-100 transition-all" title="下载视频"><ArrowDownTrayIcon className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                        <div className="p-3 border-t border-slate-100">
                                            <p className="text-xs text-slate-700 line-clamp-2 font-medium mb-2 leading-relaxed">{item.prompt}</p>
                                            <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold tracking-wide">
                                                <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{item.aspectRatio}</span>
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

export default VideoChatSidebar;
