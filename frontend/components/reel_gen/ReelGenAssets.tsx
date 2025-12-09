
import React, { useState, useEffect, useRef } from 'react';
import { 
    CubeIcon, SparklesIcon, LayersIcon, ArrowPathIcon, ArrowDownTrayIcon, ClipboardDocumentIcon
} from '../image_gen/ImageGenAssets';

// Export common icons from other assets to avoid duplication or re-export
export { 
    AIAvatarIcon, ToolIcon, LightbulbIcon, ArchiveBoxIcon, ArrowDownTrayIcon, PaperClipIcon, 
    SparklesIcon, SelectIcon, HandRaisedIcon, ChatBubbleIcon, FitToScreenIcon,
    AIToggleButton, ZoomControls, BottomToolbar
} from '../image_gen/ImageGenAssets';

export const PhotoIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
);

export const VideoCameraIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75Z" />
    </svg>
);

// --- HEADER ---
export const Header: React.FC<{ onReset: () => void; onOpenArchive: () => void; }> = ({ onReset, onOpenArchive }) => (
    <div className="flex items-center px-6 py-3 bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)] z-20 relative flex-shrink-0">
        <div className="flex items-center gap-5">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-pink-500 to-orange-400 flex items-center justify-center text-white font-bold shadow-sm">
                    R
                </div>
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">AI短视频Reel</h1>
            </div>
            
            <div className="h-6 w-px bg-slate-200"></div>

            <div className="flex items-center space-x-3">
                <button 
                    onClick={onOpenArchive} 
                    className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 py-2 px-3 rounded-lg transition-all shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>
                    <span>创作档案</span>
                </button>
                <button 
                    onClick={onReset} 
                    className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 py-2 px-3 rounded-lg transition-all shadow-sm ml-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                    </svg>
                    <span>返回首页</span>
                </button>
            </div>
        </div>
        
        <div className="flex-1"></div>
    </div>
);

// --- TOOLBAR (HYBRID) ---
interface ReelEditorToolbarProps {
    assetType: 'image' | 'video';
    onDownload: () => void;
    onRegenerate: () => void;
    isProcessing: boolean; // Global loading state
    processingAction?: 'regenerate' | 'remove-bg' | null;
    // Image specifics
    onUpscale?: (factor: 2 | 4) => void;
    onRemoveBackground?: () => void;
    isUpscaling?: boolean;
    // Video specifics
    onCopyFrame?: () => void;
}

export const ReelEditorToolbar: React.FC<ReelEditorToolbarProps> = ({ 
    assetType, onDownload, onRegenerate, isProcessing, processingAction,
    onUpscale, onRemoveBackground, isUpscaling, onCopyFrame
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleUpscaleClick = (factor: 2 | 4) => {
        if (onUpscale) onUpscale(factor);
        setIsMenuOpen(false);
    };

    return (
        <div className="bg-white/90 backdrop-blur-sm rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-slate-200 z-20 flex items-center p-1.5 space-x-1.5 h-10">
            
            {/* --- IMAGE TOOLS --- */}
            {assetType === 'image' && (
                <>
                    <div ref={wrapperRef} className="relative">
                        <button 
                            onClick={() => setIsMenuOpen(prev => !prev)} 
                            disabled={isUpscaling} 
                            className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 rounded-full px-3 h-7 hover:bg-slate-100 disabled:text-slate-400 disabled:bg-transparent disabled:cursor-not-allowed transition-colors"
                            title="高清放大"
                        >
                            {isUpscaling ? (
                                <svg className="animate-spin h-3.5 w-3.5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <SparklesIcon className="w-3.5 h-3.5" />
                            )}
                            <span>HD</span>
                        </button>
                        {isMenuOpen && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-28 bg-white rounded-xl shadow-lg border border-slate-100 py-1 flex flex-col overflow-hidden animate-fade-in-up">
                                <button onClick={() => handleUpscaleClick(2)} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">放大 2倍</button>
                                <button onClick={() => handleUpscaleClick(4)} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">放大 4倍</button>
                            </div>
                        )}
                    </div>
                    
                    <div className="w-px h-4 bg-slate-200" />

                    <button 
                        onClick={onRemoveBackground}
                        disabled={isProcessing}
                        className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 rounded-full px-3 h-7 hover:bg-slate-100 disabled:text-slate-400 disabled:bg-transparent disabled:cursor-not-allowed transition-colors"
                        title="智能抠图"
                    >
                        {processingAction === 'remove-bg' ? (
                            <svg className="animate-spin h-3.5 w-3.5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <LayersIcon className="w-3.5 h-3.5" />
                        )}
                        <span>抠图</span>
                    </button>
                    
                    <div className="w-px h-4 bg-slate-200" />
                </>
            )}

            {/* --- VIDEO TOOLS --- */}
            {assetType === 'video' && (
                <>
                    <button 
                        onClick={onCopyFrame} 
                        className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 rounded-full px-3 h-7 hover:bg-slate-100" 
                        title="复制当前画面"
                    >
                        <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                        <span>截图</span>
                    </button>
                    <div className="w-px h-4 bg-slate-200" />
                </>
            )}

            {/* --- COMMON TOOLS --- */}
            <button 
                onClick={onRegenerate}
                disabled={isProcessing}
                className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 rounded-full px-3 h-7 hover:bg-slate-100 disabled:text-slate-400 disabled:bg-transparent disabled:cursor-not-allowed transition-colors"
                title="重绘"
            >
                 {processingAction === 'regenerate' ? (
                    <svg className="animate-spin h-3.5 w-3.5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                )}
                <span>重绘</span>
            </button>

            <div className="w-px h-4 bg-slate-200" />
            
            <button onClick={onDownload} className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 rounded-full px-3 h-7 hover:bg-slate-100" title="下载资源">
                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                <span>下载</span>
            </button>
        </div>
    );
};

// --- UNIFIED MODEL SELECTOR ---
interface ReelModelSelectorProps {
    value: string;
    onChange: (val: string) => void;
    disabled: boolean;
}

export const ReelModelSelector: React.FC<ReelModelSelectorProps> = ({ value, onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
    };

    const getLabel = () => {
        switch(value) {
            case 'banana': return 'Flash Image';
            case 'banana_pro': return 'Pro Image';
            case 'veo_fast': return 'Veo Fast';
            case 'veo_gen': return 'Veo Gen';
            default: return 'Select Model';
        }
    };

    return (
        <div ref={wrapperRef} className="relative">
            <button
                onClick={() => setIsOpen(p => !p)}
                disabled={disabled}
                className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm min-w-[110px] justify-between"
                title="选择生成模型 (图片/视频)"
            >
                <div className="flex items-center space-x-1.5">
                    <CubeIcon className="w-4 h-4" />
                    <span>{getLabel()}</span>
                </div>
            </button>
            {isOpen && !disabled && (
                <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 animate-fade-in-up overflow-hidden">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                        AI 图片模型
                    </div>
                    <button onClick={() => handleSelect('banana')} className={`w-full text-left px-4 py-2 text-xs flex justify-between items-center transition-colors ${value === 'banana' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                        <span>Flash Image (快速)</span>
                        {value === 'banana' && <span className="text-indigo-500">●</span>}
                    </button>
                    <button onClick={() => handleSelect('banana_pro')} className={`w-full text-left px-4 py-2 text-xs flex justify-between items-center transition-colors ${value === 'banana_pro' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                        <span>Pro Image (高质量)</span>
                        {value === 'banana_pro' && <span className="text-indigo-500">●</span>}
                    </button>
                    
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-y border-slate-100 mt-1">
                        AI 视频模型
                    </div>
                    <button onClick={() => handleSelect('veo_fast')} className={`w-full text-left px-4 py-2 text-xs flex justify-between items-center transition-colors ${value === 'veo_fast' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                        <span>Veo Fast (预览)</span>
                        {value === 'veo_fast' && <span className="text-indigo-500">●</span>}
                    </button>
                    <button onClick={() => handleSelect('veo_gen')} className={`w-full text-left px-4 py-2 text-xs flex justify-between items-center transition-colors ${value === 'veo_gen' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                        <span>Veo Gen (生成)</span>
                        {value === 'veo_gen' && <span className="text-indigo-500">●</span>}
                    </button>
                </div>
            )}
        </div>
    );
};

// --- ASPECT RATIO (LOCKED) ---
export const ReelAspectRatioBadge: React.FC = () => (
    <div className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed opacity-80" title="Short Reel 模式固定为 9:16">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4"><rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" strokeWidth="2"/></svg>
        <span>9:16</span>
    </div>
);
