
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getCreativeDirectorAction, generateImage, enhancePrompt, getDesignPlan, generateReferenceImage, upscaleImage, summarizePrompt, removeBackground } from '../services/imageService';
import { CanvasImage, ImageMessage, ImageSeries, EnhancedPrompt } from '../types';

// --- ICONS ---
const AIAvatarIcon: React.FC<{ className?: string, isThinking?: boolean }> = ({ className, isThinking }) => {
    if (!isThinking) {
        return (
            <div className={`relative w-8 h-8 rounded-lg bg-white flex items-center justify-center border-2 border-blue-500 ${className}`}>
                <span className="font-bold text-lg text-blue-500 leading-none">M</span>
            </div>
        );
    }
    return (
        <div className={`relative w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shadow-sm ${className}`}>
            <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(50,50)"><g><path d="M0,-45 a45,45 0 1,0 0,90 a45,45 0 1,0 0,-90" stroke="url(#grad-ring)" strokeWidth="4" strokeLinecap="round" className="animate-ring-spin origin-center" style={{ animationDuration: '8s' }} opacity="0.8" strokeDasharray="15 30"/><path d="M-35,0 a35,35 0 1,0 70,0 a35,35 0 1,0 -70,0" stroke="url(#grad-ring)" strokeWidth="3" strokeLinecap="round" className="animate-ring-spin-reverse origin-center" style={{ animationDuration: '10s' }} opacity="0.5" strokeDasharray="10 20"/></g><g className={'animate-core-pulse'}><text x="0" y="4" textAnchor="middle" dominantBaseline="central" fontFamily="system-ui, sans-serif" fontSize="50" fontWeight="bold" fill="url(#grad-bars)">M</text></g></g>
                <defs><linearGradient id="grad-bars" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stopColor="#818CF8" /><stop offset="100%" stopColor="#6366F1" /></linearGradient><linearGradient id="grad-ring" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="rgba(99, 102, 241, 0.7)"/><stop offset="100%" stopColor="rgba(129, 140, 248, 0.1)"/></linearGradient></defs>
            </svg>
        </div>
    );
};
const ToolIcon: React.FC<{ className?: string }> = (p) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h12A2.25 2.25 0 0 0 20.25 14.25V3M3.75 3v-1.5A2.25 2.25 0 0 1 6 0h12A2.25 2.25 0 0 1 20.25 1.5v1.5M3.75 3h16.5M16.5 6.75h.008v.008H16.5V6.75Zm-2.25 0h.008v.008H14.25V6.75Zm-2.25 0h.008v.008H12V6.75Zm-2.25 0h.008v.008H9.75V6.75Zm-2.25 0h.008v.008H7.5V6.75Zm-2.25 0h.008v.008H5.25V6.75Z" /></svg>);
const LightbulbIcon: React.FC<{ className?: string }> = (p) => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0114 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>);
const ArchiveBoxIcon: React.FC<{ className?: string }> = (p) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>);
const TagIcon: React.FC<{ className?: string }> = (p) => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" /></svg>);
const PaperClipIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.122 2.122l7.81-7.81" /></svg>;
const ArrowDownTrayIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>;
const SparklesIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>;
const SelectIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M12.75 15l.364-1.364a1 1 0 011.263-.732l1.364.364M12.75 15l-1.364.364a1 1 0 00-.732 1.263l.364 1.364M12.75 15L12 12.75m.75 2.25L15 12.75M15 9.75l-3-3m0 0l-3 3m3-3v12" /></svg>;
const HandRaisedIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75h4.5m-4.5 0a2.25 2.25 0 01-2.25-2.25V5.25c0-.996.768-1.845 1.752-1.98.502-.068 1.02.046 1.442.328a2.25 2.25 0 01.978 2.476V9.75Zm4.5 0a2.25 2.25 0 002.25-2.25V5.25c0-1.242-1.008-2.25-2.25-2.25S12 4.008 12 5.25v2.25c0 .996.768 1.845 1.752-1.98.502-.068 1.02.046 1.442.328a2.25 2.25 0 00.978 2.476V9.75Zm-4.5 0h4.5M3 12h18M3 12a9 9 0 009 9m9-9a9 9 0 01-9 9" /></svg>;
const ChatBubbleIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12.75c0 .563-.098 1.11-.275 1.636a8.957 8.957 0 0 1-2.012 3.037c-1.638 1.25-3.69 1.838-5.71 1.838h-1.32a6.71 6.71 0 0 0-1.815.292c-1.077.365-2.095.84-3.047 1.423a.333.333 0 0 1-.49-.236V18.5a7.433 7.433 0 0 0-1.022-3.75c-.33-.623-.585-1.284-.766-1.975A8.96 8.96 0 0 1 3 12.75V9.75c0-4.962 4.038-9 9-9s9 4.038 9 9v3Z" /></svg>;
const CubeIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>;
const ArrowPathIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>;
const LayersIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" /></svg>;

// New Aspect Ratio Icons
const AspectRatioIcon11 = (p: any) => <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2"/></svg>;
const AspectRatioIcon169 = (p: any) => <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}><rect x="2" y="6.5" width="20" height="11" rx="2" stroke="currentColor" strokeWidth="2"/></svg>;
const AspectRatioIcon916 = (p: any) => <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}><rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" strokeWidth="2"/></svg>;
const AspectRatioIcon43 = (p: any) => <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}><rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2"/></svg>;
const AspectRatioIcon34 = (p: any) => <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}><rect x="6" y="4" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="2"/></svg>;
const AspectRatioIcon45 = (p: any) => <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="2"/></svg>;


// --- UTILS ---
const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve((reader.result as string).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => new Promise((resolve) => { const img = new Image(); img.onload = () => resolve({ width: img.width, height: img.height }); img.onerror = () => resolve({ width: 512, height: 512 }); img.src = `data:image/jpeg;base64,${base64}`; });

// Helper function to calculate the closest standard aspect ratio from dimensions
const getClosestAspectRatio = (width: number, height: number): string => {
    const ratio = width / height;
    const supportedRatios = [
        { str: '1:1', val: 1 },
        { str: '16:9', val: 16 / 9 },
        { str: '9:16', val: 9 / 16 },
        { str: '4:3', val: 4 / 3 },
        { str: '3:4', val: 3 / 4 },
        { str: '4:5', val: 0.8 },
    ];
    const closest = supportedRatios.reduce((prev, curr) => {
        return (Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev);
    });
    return closest.str;
};

// Helper function to extract aspect ratio intent from prompt
const parseAspectRatioFromPrompt = (prompt: string): string | null => {
    const p = prompt.toLowerCase();
    
    // Explicit ratios
    if (p.includes('16:9')) return '16:9';
    if (p.includes('9:16')) return '9:16';
    if (p.includes('4:3')) return '4:3';
    if (p.includes('3:4')) return '3:4';
    if (p.includes('1:1')) return '1:1';
    if (p.includes('4:5')) return '4:5';

    // Semantic keywords (Chinese/English)
    if (p.includes('横屏') || p.includes('横向') || p.includes('landscape') || p.includes('wide')) return '16:9';
    if (p.includes('竖屏') || p.includes('竖向') || p.includes('portrait') || p.includes('vertical')) return '9:16';
    if (p.includes('正方形') || p.includes('square')) return '1:1';
    
    return null;
};

// --- SUB-COMPONENTS ---
const Header: React.FC<{ onReset: () => void; onOpenArchive: () => void; }> = ({ onReset, onOpenArchive }) => ( <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white flex-shrink-0"> <div><h1 className="text-lg font-semibold text-gray-800">AI 图片创作</h1></div> <div className="flex items-center space-x-2"> <button onClick={onOpenArchive} className="flex items-center space-x-2 text-sm bg-white text-purple-700 border border-purple-500 font-semibold py-2 px-4 rounded-lg hover:bg-purple-50 transition-colors"><ArchiveBoxIcon className="w-4 h-4" /><span>创作档案</span></button> <button onClick={onReset} className="flex items-center space-x-2 text-sm bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-purple-600 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg><span>返回首页</span></button> </div> </div>);
const EditorToolbar: React.FC<{ 
    onDownload: () => void; 
    onUpscale: (factor: 2 | 3 | 4) => void; 
    isUpscaling: boolean;
    onRegenerate: () => void;
    onRemoveBackground: () => void;
    isGenerating: boolean;
    processingAction?: 'regenerate' | 'remove-bg' | null;
}> = ({ onDownload, onUpscale, isUpscaling, onRegenerate, onRemoveBackground, isGenerating, processingAction }) => {
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

    const handleUpscaleClick = (factor: 2 | 3 | 4) => {
        onUpscale(factor);
        setIsMenuOpen(false);
    };

    return (
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 z-20 flex items-center p-1 space-x-1 px-2 h-8">
            <div ref={wrapperRef} className="relative">
                <button 
                    onClick={() => setIsMenuOpen(prev => !prev)} 
                    disabled={isUpscaling} 
                    className="flex items-center space-x-1 text-xs font-medium text-gray-700 rounded-md px-2 h-6 hover:bg-gray-100 disabled:text-gray-400 disabled:bg-transparent disabled:cursor-not-allowed transition-colors"
                >
                    {isUpscaling ? (
                        <svg className="animate-spin h-3.5 w-3.5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <SparklesIcon className="w-3.5 h-3.5" />
                    )}
                    <span>HD 放大</span>
                </button>
                {isMenuOpen && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-28 bg-white rounded-md shadow-lg border border-gray-200 py-1">
                        <button onClick={() => handleUpscaleClick(2)} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100">放大 2倍</button>
                        <button onClick={() => handleUpscaleClick(3)} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100">放大 3倍</button>
                        <button onClick={() => handleUpscaleClick(4)} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100">放大 4倍</button>
                    </div>
                )}
            </div>
            
            <div className="w-px h-5 bg-gray-200" />

            <button 
                onClick={onRegenerate}
                disabled={isGenerating}
                className="flex items-center space-x-1 text-xs font-medium text-gray-700 rounded-md px-2 h-6 hover:bg-gray-100 disabled:text-gray-400 disabled:bg-transparent disabled:cursor-not-allowed transition-colors"
                title="使用当前设置再次生成"
            >
                 {processingAction === 'regenerate' ? (
                    <svg className="animate-spin h-3.5 w-3.5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                )}
                <span>再次生成</span>
            </button>

            <div className="w-px h-5 bg-gray-200" />

            <button 
                onClick={onRemoveBackground}
                disabled={isGenerating}
                className="flex items-center space-x-1 text-xs font-medium text-gray-700 rounded-md px-2 h-6 hover:bg-gray-100 disabled:text-gray-400 disabled:bg-transparent disabled:cursor-not-allowed transition-colors"
                title="智能去除背景"
            >
                {processingAction === 'remove-bg' ? (
                     <svg className="animate-spin h-3.5 w-3.5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                    <LayersIcon className="w-3.5 h-3.5" />
                )}
                <span>去除背景</span>
            </button>

            <div className="w-px h-5 bg-gray-200" />
            <button onClick={onDownload} className="flex items-center space-x-1 text-xs font-medium text-gray-700 rounded-md px-2 h-6 hover:bg-gray-100"><ArrowDownTrayIcon className="w-3.5 h-3.5" /><span>下载</span></button>
        </div>
    );
};
const ZoomControls: React.FC<{ scale: number; onZoomIn: () => void; onZoomOut: () => void; }> = ({ scale, onZoomIn, onZoomOut }) => ( <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 z-20 flex items-center text-sm font-medium"> <button onClick={onZoomOut} className="p-2 h-9 w-9 flex items-center justify-center hover:bg-gray-100 rounded-l-md">-</button> <div className="px-3 h-9 flex items-center border-x border-gray-200 tabular-nums w-16 justify-center">{Math.round(scale * 100)}%</div> <button onClick={onZoomIn} className="p-2 h-9 w-9 flex items-center justify-center hover:bg-gray-100 rounded-r-md">+</button> </div>);
const BottomToolbar: React.FC<{ toolMode: 'select' | 'pan' | 'chat'; setToolMode: (mode: 'select' | 'pan' | 'chat') => void; }> = ({ toolMode, setToolMode }) => ( <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 flex items-center p-1 space-x-1"> <button onClick={() => setToolMode('select')} className={`flex items-center space-x-2 p-2 px-3 rounded-md text-sm ${toolMode === 'select' ? 'bg-blue-500 text-white shadow' : 'hover:bg-gray-100 text-gray-600'}`}> <SelectIcon className="w-5 h-5" /> <span>选择</span> <span className="text-gray-400 text-xs">(V)</span> </button> <button onClick={() => setToolMode('pan')} className={`flex items-center space-x-2 p-2 px-3 rounded-md text-sm ${toolMode === 'pan' ? 'bg-blue-500 text-white shadow' : 'hover:bg-gray-100 text-gray-600'}`}> <HandRaisedIcon className="w-5 h-5" /> <span>平移画布</span> <span className="text-gray-400 text-xs">(H)</span> </button> <button onClick={() => setToolMode('chat')} className={`flex items-center space-x-2 p-2 px-3 rounded-md text-sm ${toolMode === 'chat' ? 'bg-blue-500 text-white shadow' : 'hover:bg-gray-100 text-gray-600'}`}> <ChatBubbleIcon className="w-5 h-5" /> <span>图片聊天</span> <span className="text-gray-400 text-xs">(C)</span> </button> </div>);

const aspectRatios = [
    { value: '1:1', label: '方形', Icon: AspectRatioIcon11 },
    { value: '16:9', label: '横向', Icon: AspectRatioIcon169 },
    { value: '9:16', label: '纵向', Icon: AspectRatioIcon916 },
    { value: '4:3', label: '标准', Icon: AspectRatioIcon43 },
    { value: '3:4', label: '竖版', Icon: AspectRatioIcon34 },
    { value: '4:5', label: '垂直', Icon: AspectRatioIcon45 },
];

const AspectRatioSelector: React.FC<{
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
}> = ({ value, onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const selected = aspectRatios.find(r => r.value === value) || aspectRatios[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (newValue: string) => {
        onChange(newValue);
        setIsOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative">
            <button
                onClick={() => setIsOpen(p => !p)}
                disabled={disabled}
                className="flex items-center space-x-2 text-sm font-medium px-3 py-1.5 rounded-full transition-all bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200 hover:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed transform hover:scale-105"
                title={disabled ? "编辑图片或使用参考图时，无法更改宽高比。" : "选择图片尺寸"}
            >
                <selected.Icon className="w-4 h-4" />
                <span>尺寸</span>
            </button>
            {isOpen && !disabled && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-20 animate-fade-in-up">
                    {aspectRatios.map(ratio => (
                        <button
                            key={ratio.value}
                            onClick={() => handleSelect(ratio.value)}
                            className={`w-full text-left px-3 py-1.5 text-sm flex items-center space-x-3 transition-colors ${value === ratio.value ? 'font-semibold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            <ratio.Icon className="w-5 h-5" />
                            <span>{ratio.label} ({ratio.value})</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const ModelSelector: React.FC<{
    value: 'banana' | 'banana_pro';
    onChange: (value: 'banana' | 'banana_pro') => void;
    disabled: boolean;
}> = ({ value, onChange, disabled }) => {
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

    const handleSelect = (newValue: 'banana' | 'banana_pro') => {
        onChange(newValue);
        setIsOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative">
            <button
                onClick={() => setIsOpen(p => !p)}
                disabled={disabled}
                className="flex items-center space-x-2 text-sm font-medium px-3 py-1.5 rounded-full transition-all bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 hover:border-blue-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed transform hover:scale-105 shadow-sm"
                title="选择生成模型"
            >
                <CubeIcon className="w-4 h-4" />
                <span>{value === 'banana_pro' ? 'Pro' : 'Flash'}</span>
            </button>
            {isOpen && !disabled && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-20 animate-fade-in-up">
                    <button
                        onClick={() => handleSelect('banana')}
                        className={`w-full text-left px-3 py-2 text-sm flex flex-col transition-colors ${value === 'banana' ? 'bg-blue-50' : 'hover:bg-gray-100'}`}
                    >
                        <span className={`font-semibold ${value === 'banana' ? 'text-blue-600' : 'text-gray-800'}`}>Nano Banana</span>
                        <span className="text-xs text-gray-500">快速生成 (Flash)</span>
                    </button>
                    <button
                        onClick={() => handleSelect('banana_pro')}
                        className={`w-full text-left px-3 py-2 text-sm flex flex-col transition-colors ${value === 'banana_pro' ? 'bg-blue-50' : 'hover:bg-gray-100'}`}
                    >
                        <span className={`font-semibold ${value === 'banana_pro' ? 'text-blue-600' : 'text-gray-800'}`}>Banana Pro</span>
                        <span className="text-xs text-gray-500">高质量 (Pro)</span>
                    </button>
                </div>
            )}
        </div>
    );
};

const AIToggleButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    checked: boolean;
    onChange: () => void;
}> = ({ icon, label, checked, onChange }) => {
    return (
        <label className={`relative inline-flex items-center cursor-pointer transition-all duration-200 ease-in-out rounded-full py-1.5 pl-3 pr-4 border ${
            checked 
                ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm' 
                : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200 hover:border-gray-300'
        }`}>
            <input 
                type="checkbox" 
                checked={checked} 
                onChange={onChange} 
                className="sr-only" 
            />
            <span className={`mr-2 transition-colors ${checked ? 'text-blue-500' : 'text-gray-400'}`}>
                {icon}
            </span>
            <span className="text-sm font-medium">{label}</span>
        </label>
    );
};


// --- MAIN COMPONENT ---
interface ImageGenerationPageProps { initialPrompt: string; onReset: () => void; }
const ImageGenerationPage: React.FC<ImageGenerationPageProps> = ({ initialPrompt, onReset }) => {
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
    const [enhancePromptEnabled, setEnhancePromptEnabled] = useState(false);
    const [designInspirationEnabled, setDesignInspirationEnabled] = useState(false);
    const [inputHighlight, setInputHighlight] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [selectedModel, setSelectedModel] = useState<'banana' | 'banana_pro'>('banana');
    
    const [transform, setTransform] = useState({ x: 50, y: 50, scale: 0.2 });
    const [toolMode, setToolMode] = useState<'select' | 'pan' | 'chat'>('select');
    const [chattingImageId, setChattingImageId] = useState<string | null>(null);
    const [onCanvasChatInput, setOnCanvasChatInput] = useState('');

    const isPanning = useRef(false);
    const lastMousePosition = useRef({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const initialPromptHandled = useRef(false);
    const userInputRef = useRef<HTMLTextAreaElement>(null);

    const isEditing = selectedImageId !== null || uploadedFiles.length > 0 || chattingImageId !== null;

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    
    useEffect(() => {
        const textarea = userInputRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; // Reset height to allow shrinking
            const scrollHeight = textarea.scrollHeight;
            const maxHeight = 160; // Cap height at 160px
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
        // Find images in the same column (approximate X match to handle potential float drift)
        const imagesInColumn = (Object.values(allImages) as CanvasImage[]).filter(img => Math.abs(img.x - columnX) < 20);
    
        // Find the absolute bottom of the column
        const bottomMostImage = imagesInColumn.reduce((bottom, current) => {
            if (!bottom) return current;
            return (current.y + current.height) > (bottom.y + bottom.height) ? current : bottom;
        }, null as CanvasImage | null);
        
        // Place below the bottom-most image
        if (bottomMostImage) {
            return {
                x: columnX,
                y: bottomMostImage.y + bottomMostImage.height + 24
            };
        }
        
        // Fallback (shouldn't happen if sourceImage is in list)
        return {
            x: columnX,
            y: sourceImage.y + sourceImage.height + 24
        };
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
                if (file) {
                    filesToUpload.push(file);
                }
            }
        }

        if (filesToUpload.length > 0) {
            e.preventDefault(); // Prevent text paste if we found images
            setUploadedFiles(prev => {
                const combined = [...prev, ...filesToUpload];
                return combined.slice(0, 3);
            });
        }
    }, []);

    const executeImageGeneration = useCallback(async (prompt: string, targetImageId: string | null, useImageAsInput: boolean = true) => {
        setIsLoading(true);
        let sourceImageIdForNewImage: string | undefined = undefined;
        let base64Images: { data: string; mimeType: string; }[] = [];
        
        // Default to UI selected ratio
        let finalRatio = aspectRatio;
    
        if (targetImageId && images[targetImageId]) {
            sourceImageIdForNewImage = targetImageId;
            const sourceImage = images[targetImageId];

            if (useImageAsInput) {
                const sourceImageSrc = sourceImage.src;
                if (sourceImageSrc.startsWith('data:')) {
                    const [header, data] = sourceImageSrc.split(',');
                    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                    base64Images.push({ data, mimeType });
                }
            }

            // --- Intelligent Aspect Ratio Logic ---
            // 1. Priority: User Intent in Prompt
            const intentRatio = parseAspectRatioFromPrompt(prompt);
            if (intentRatio) {
                finalRatio = intentRatio;
            } else {
                // 2. Fallback: Match Source Image Ratio
                finalRatio = getClosestAspectRatio(sourceImage.width, sourceImage.height);
            }
        }
        
        const uploadedImageData = await Promise.all(uploadedFiles.map(async file => ({ data: await blobToBase64(file), mimeType: file.type })));
        base64Images.push(...uploadedImageData);
    
        setUploadedFiles([]);
    
        try {
            // Use finalRatio instead of ternary logic to ensure correct ratio is always passed
            const result = await generateImage(prompt, base64Images, finalRatio, selectedModel);
            const { width, height } = await getImageDimensions(result.base64Image);
            const imageId = `img-${Date.now()}`;
            
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
                id: imageId,
                src: `data:image/jpeg;base64,${result.base64Image}`,
                alt: prompt,
                width,
                height,
                x: newX,
                y: newY,
                sourceImageId: sourceImageIdForNewImage,
            };
            
            setImages(prev => ({ ...prev, [imageId]: newImage }));
            addMessage('assistant', 'generated-image', { imageId, alt: prompt });
            setLastGeneratedImageId(imageId);
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
    }, [uploadedFiles, images, addMessage, aspectRatio, calculateNewImagePosition, selectedModel]);

    const executeEnhancePrompt = useCallback(async (prompt: string) => { setIsLoading(true); addMessage('assistant', 'tool-usage', { text: 'AI 创意总监 | 提示词优化' }); try { const suggestions = await enhancePrompt(prompt); addMessage('assistant', 'prompt-options', suggestions); } catch (error) { addMessage('assistant', 'text', '抱歉，无法优化提示词。'); } finally { setIsLoading(false); } }, [addMessage]);
    const executeGetDesignPlan = useCallback(async (prompt: string) => { setIsLoading(true); addMessage('assistant', 'tool-usage', { text: 'AI 创意总监 | 设计灵感' }); try { const plansWithPrompts = await getDesignPlan(prompt); if (plansWithPrompts.length === 0) { throw new Error("AI 未返回任何设计方案。"); } const imagePromises = plansWithPrompts.map(plan => generateReferenceImage(plan.referenceImagePrompt).catch(() => ({ base64Image: '' }))); const generatedImages = await Promise.all(imagePromises); const plansForDisplay = plansWithPrompts.map((plan, index) => ({ title: plan.title, description: plan.description, prompt: plan.prompt, imageSrc: `data:image/jpeg;base64,${generatedImages[index].base64Image}`, })); addMessage('assistant', 'design-plans', plansForDisplay); } catch (error) { addMessage('assistant', 'text', `抱歉，无法获取设计方案: ${error instanceof Error ? error.message : '未知错误'}`); } finally { setIsLoading(false); } }, [addMessage]);

    const processUserTurn = useCallback(async (prompt: string) => {
        setIsLoading(true);
        try {
            const directorAction = await getCreativeDirectorAction(prompt, selectedImageId, lastGeneratedImageId, messages);
            
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
                    await executeImageGeneration(directorAction.prompt, directorAction.targetImageId || null);
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
    }, [selectedImageId, lastGeneratedImageId, messages, addMessage, designInspirationEnabled, enhancePromptEnabled, executeImageGeneration, executeGetDesignPlan, executeEnhancePrompt]);
    
    const handleSubmit = useCallback((e?: React.FormEvent) => { e?.preventDefault(); const currentPrompt = userInput; if (!currentPrompt.trim() && uploadedFiles.length === 0) return; addMessage('user', 'text', currentPrompt); setUserInput(''); processUserTurn(currentPrompt); }, [userInput, uploadedFiles, addMessage, processUserTurn]);

    useEffect(() => { if (initialPrompt && !initialPromptHandled.current) { initialPromptHandled.current = true; addMessage('user', 'text', initialPrompt); processUserTurn(initialPrompt); } }, [initialPrompt, addMessage, processUserTurn]);
    const handleUseSuggestion = (prompt: string) => { addMessage('user', 'text', `使用优化后的提示词：“${prompt}”`); executeImageGeneration(prompt, null); };
    const handleUseDesignPlan = (plan: {title: string, prompt: string}) => { addMessage('user', 'text', `选择设计灵感：“${plan.title}”`); if (enhancePromptEnabled) { addMessage('assistant', 'text', '好的，已选定设计方向。现在，我将基于这个方向为您优化提示词。'); executeEnhancePrompt(plan.prompt); } else { executeImageGeneration(plan.prompt, null); } };

    // Canvas handlers
    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => { if ((e.target as HTMLElement).closest('.image-on-canvas') || (e.target as HTMLElement).closest('.editor-toolbar-wrapper') || (e.target as HTMLElement).closest('.on-canvas-chat-box-wrapper')) return; if (toolMode === 'pan' || e.button === 1) { isPanning.current = true; lastMousePosition.current = { x: e.clientX, y: e.clientY }; } else { setSelectedImageId(null); setChattingImageId(null); } };
    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => { if (!isPanning.current) return; const dx = e.clientX - lastMousePosition.current.x; const dy = e.clientY - lastMousePosition.current.y; setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy })); lastMousePosition.current = { x: e.clientX, y: e.clientY }; };
    const handleCanvasMouseUp = () => { isPanning.current = false; };
    const handleCanvasWheel = (e: React.WheelEvent<HTMLDivElement>) => { if (!canvasRef.current) return; const rect = canvasRef.current.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const scaleAmount = -e.deltaY * 0.001; const newScale = Math.min(Math.max(0.1, 5), transform.scale + scaleAmount); setTransform(prev => ({ scale: newScale, x: mouseX - (mouseX - prev.x) * (newScale / prev.scale), y: mouseY - (mouseY - prev.y) * (newScale / prev.scale) })); };
    const zoom = (direction: 'in' | 'out') => { if (!canvasRef.current) return; const rect = canvasRef.current.getBoundingClientRect(); const centerX = rect.width / 2; const centerY = rect.height / 2; const scaleAmount = direction === 'in' ? 0.1 : -0.1; const newScale = Math.min(Math.max(0.1, 5), transform.scale + scaleAmount); setTransform(prev => ({ scale: newScale, x: centerX - (centerX - prev.x) * (newScale / prev.scale), y: centerY - (centerY - prev.y) * (newScale / prev.scale) })); }

    const handleSetToolMode = (mode: 'select' | 'pan' | 'chat') => {
        if (mode !== 'chat') {
            setChattingImageId(null);
        }
        if (mode !== 'select') {
            setSelectedImageId(null);
        }
        setToolMode(mode);
    };

    useEffect(() => { const handleKeyDown = (e: KeyboardEvent) => { if ((e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA/)) return; if (e.key.toLowerCase() === 'v') handleSetToolMode('select'); if (e.key.toLowerCase() === 'h') handleSetToolMode('pan'); if (e.key.toLowerCase() === 'c') handleSetToolMode('chat'); }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, []);
    useEffect(() => { if (!canvasRef.current) return; if (isPanning.current) { canvasRef.current.style.cursor = 'grabbing'; } else if (toolMode === 'pan') { canvasRef.current.style.cursor = 'grab'; } else { canvasRef.current.style.cursor = 'default'; } }, [toolMode, isPanning.current]);

    const handleImageClick = (e: React.MouseEvent, imageId: string) => {
      if (toolMode === 'select') {
        e.stopPropagation();
        setSelectedImageId(imageId);
        setChattingImageId(null);
      } else if (toolMode === 'chat') {
        e.stopPropagation();
        setChattingImageId(imageId);
        setSelectedImageId(null);
      }
    };
    
    // Image Actions
    const handleDownloadImage = () => { if (!selectedImageId || !images[selectedImageId]) return; const { src, alt } = images[selectedImageId]; const link = document.createElement('a'); link.href = src; link.download = `${alt.replace(/ /g, '_').slice(0, 30)}.jpg`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };
    
    const handleDownloadArchiveImage = (e: React.MouseEvent, image: CanvasImage, seriesPrompt: string) => {
        e.stopPropagation();
        const link = document.createElement('a');
        link.href = image.src;
        const safePrompt = seriesPrompt.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50);
        const imageIdSuffix = image.id.split('-').pop();
        link.download = `aidea-creation-${safePrompt}-${imageIdSuffix}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleUpscale = async (factor: 2 | 3 | 4) => { 
        if (!selectedImageId || !images[selectedImageId]) return; 
        setIsUpscaling(true); 
        const sourceImage = images[selectedImageId]; 
        addMessage('assistant', 'tool-usage', { text: `HD 放大 ${factor}倍` }); 
        try { 
            const [header, data] = sourceImage.src.split(','); 
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg'; 
            // Pass the alt text as prompt to upscaleImage
            const result = await upscaleImage(data, mimeType, factor, sourceImage.alt); 
            const { width, height } = await getImageDimensions(result.base64Image); 
            const imageId = `img-hd-${Date.now()}`; 
            const { x, y } = calculateNewImagePosition(sourceImage.id, images); 
            const newImage: CanvasImage = { id: imageId, src: `data:image/jpeg;base64,${result.base64Image}`, alt: `HD ${factor}x version of ${sourceImage.alt}`, width, height, x, y, sourceImageId: sourceImage.id, }; 
            setImages(prev => ({ ...prev, [imageId]: newImage })); 
            addMessage('assistant', 'generated-image', { imageId, alt: newImage.alt }); 
            setLastGeneratedImageId(imageId); 
            setSelectedImageId(imageId); 
        } catch (error) { 
            console.error("Image upscale failed:", error); 
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            let displayMessage = `抱歉，图片高清化失败: ${errorMessage}`;
            if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
                displayMessage = '请求过于频繁，您已超出当前配额。请检查您的计划和账单详情，或稍后再试。';
            }
            addMessage('assistant', 'text', displayMessage);
        } finally { setIsUpscaling(false); } 
    };

    const handleRegenerate = async () => {
        if (!selectedImageId || !images[selectedImageId]) return;
        setProcessingAction('regenerate');
        const prompt = images[selectedImageId].alt;
        addMessage('assistant', 'text', `正在基于原提示词再次生成：“${prompt}”`);
        try {
            // Changed: Pass selectedImageId for positioning, but false for input
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
            const [header, data] = sourceImage.src.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
            
            const result = await removeBackground(data, mimeType);
            const { width, height } = await getImageDimensions(result.base64Image);
            
            const imageId = `img-rmbg-${Date.now()}`;
            const { x, y } = calculateNewImagePosition(sourceImage.id, images);
            
            const newImage: CanvasImage = {
                id: imageId,
                src: `data:image/png;base64,${result.base64Image}`, // Result is typically PNG for transparency
                alt: `Background removed version of ${sourceImage.alt}`,
                width,
                height,
                x,
                y,
                sourceImageId: sourceImage.id,
            };
            
            setImages(prev => ({ ...prev, [imageId]: newImage }));
            addMessage('assistant', 'generated-image', { imageId, alt: newImage.alt });
            setLastGeneratedImageId(imageId);
            setSelectedImageId(imageId); // Select the new image
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

        setIsLoading(true);
        setOnCanvasChatInput('');
        setChattingImageId(null);

        const sourceImage = images[sourceImageId];

        // --- Intelligent Aspect Ratio Logic ---
        let finalRatio = getClosestAspectRatio(sourceImage.width, sourceImage.height);
        const intentRatio = parseAspectRatioFromPrompt(prompt);
        if (intentRatio) {
            finalRatio = intentRatio;
        }

        try {
            const [header, data] = sourceImage.src.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
            
            // Pass finalRatio to generateImage
            const result = await generateImage(prompt, [{ data, mimeType }], finalRatio, selectedModel);
            const { width, height } = await getImageDimensions(result.base64Image);
            const newImageId = `img-${Date.now()}`;
            
            const { x, y } = calculateNewImagePosition(sourceImage.id, images);
            const newImage: CanvasImage = {
                id: newImageId,
                src: `data:image/jpeg;base64,${result.base64Image}`,
                alt: prompt,
                width,
                height,
                x,
                y,
                sourceImageId: sourceImage.id,
            };
            
            setImages(prev => ({ ...prev, [newImageId]: newImage }));
            setLastGeneratedImageId(newImageId);
            setChattingImageId(newImageId);
        } catch (error) {
            console.error("On-canvas image generation failed:", error);
            setChattingImageId(sourceImageId); 
        } finally {
            setIsLoading(false);
        }
    };

    const selectedImage = selectedImageId ? images[selectedImageId] : null;

    const groupConsecutiveImages = (messages: ImageMessage[]): (ImageMessage | ImageMessage[])[] => {
        const grouped: (ImageMessage | ImageMessage[])[] = [];
        let i = 0;
        while (i < messages.length) {
            const currentMsg = messages[i];
            if (currentMsg.role === 'assistant' && currentMsg.type === 'generated-image') {
                const imageGroup = [currentMsg];
                let j = i + 1;
                while (j < messages.length && messages[j].role === 'assistant' && messages[j].type === 'generated-image') {
                    imageGroup.push(messages[j]);
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

            return {
                id: root.id,
                creationDate: imageTimestamps[root.id] || Date.now(),
                initialPrompt: root.alt,
                images: seriesImages,
            };
        });
        
        return series.sort((a, b) => b.creationDate - a.creationDate);
    }, [images, messages]);

    useEffect(() => {
        if (isArchiveOpen) {
            const summarizeMissingPrompts = async () => {
                const seriesWithoutSummaries = imageSeries.filter(s => !archiveSummaries[s.id]);
                if (seriesWithoutSummaries.length > 0) {
                    const newSummaries: Record<string, string> = {};
                    await Promise.all(seriesWithoutSummaries.map(async (series) => {
                        try {
                            const summary = await summarizePrompt(series.initialPrompt);
                            newSummaries[series.id] = summary;
                        } catch (e) {
                            newSummaries[series.id] = series.initialPrompt.substring(0, 40) + '...';
                        }
                    }));
                    setArchiveSummaries(prev => ({ ...prev, ...newSummaries }));
                }
            };
            summarizeMissingPrompts();
        }
    }, [isArchiveOpen, imageSeries, archiveSummaries]);


    return (
        <div className="h-screen w-screen flex font-sans bg-white text-gray-900">
            <div className="w-[35%] min-w-[400px] h-full flex flex-col border-r border-gray-200 bg-white z-10">
                <Header onReset={onReset} onOpenArchive={() => setIsArchiveOpen(true)} />
                <main className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col min-h-0">
                    {groupConsecutiveImages(messages).map(msgOrGroup => {
                        if (Array.isArray(msgOrGroup)) {
                            const key = msgOrGroup.map(m => m.id).join('-');
                            return (
                                <div key={key} className="w-full animate-fade-in-up self-start flex items-start space-x-3">
                                    <AIAvatarIcon className="flex-shrink-0 mt-1" />
                                    <div className="flex flex-col bg-gradient-to-br from-gray-100 to-gray-200 p-3 rounded-lg text-gray-800 max-w-lg shadow-sm">
                                        <p className="text-sm text-gray-600 mb-2">为您生成了一系列图片：</p>
                                        <div className="flex overflow-x-auto space-x-2 p-1 -m-1">
                                            {msgOrGroup.map(msg => {
                                                const image = images[msg.content.imageId];
                                                return image ? (
                                                    <img key={msg.id} src={image.src} alt={image.alt} className="rounded-md w-32 h-32 object-cover flex-shrink-0" />
                                                ) : null;
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        } else {
                            const msg = msgOrGroup;
                            if (msg.role === 'user') {
                                return (
                                    <div key={msg.id} className="w-full animate-fade-in-up self-end flex justify-end">
                                        <p className="bg-blue-500 text-white p-3 rounded-lg max-w-lg shadow-sm">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}</p>
                                    </div>
                                );
                            } else {
                                // Assistant messages
                                if (msg.type === 'generated-image') {
                                    const image = images[msg.content.imageId];
                                    return image ? (
                                        <div key={msg.id} className="w-full animate-fade-in-up self-start flex items-start space-x-3">
                                            <AIAvatarIcon className="flex-shrink-0 mt-1" />
                                            <div className="flex flex-col">
                                                <div className="relative group rounded-lg overflow-hidden shadow-md bg-gray-100">
                                                    <img src={image.src} alt={image.alt} className="max-w-sm max-h-96 object-contain" onClick={() => setSelectedImageId(image.id)}/>
                                                    <div className="absolute bottom-0 left-0 w-full bg-black/50 text-white p-2 text-xs truncate opacity-0 group-hover:opacity-100 transition-opacity">
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
                                            <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-3 rounded-lg text-gray-800 max-w-lg shadow-sm">
                                                <p className="whitespace-pre-wrap">{typeof msg.content === 'string' ? msg.content : ''}</p>
                                            </div>
                                        </div>
                                    );
                                }
                                if (msg.type === 'tool-usage') {
                                    return (
                                        <div key={msg.id} className="w-full animate-fade-in-up self-start">
                                            <div className="ml-11 bg-purple-50 border-l-4 border-purple-400 p-2 rounded-r-lg max-w-lg">
                                                <div className="flex items-center text-sm text-purple-700">
                                                    <ToolIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                                                    <div>
                                                        <span>使用工具 | </span>
                                                        <span className="font-semibold">{msg.content.text}</span>
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
                                                <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-3 rounded-lg text-gray-800 shadow-sm">
                                                    <p className="mb-2 font-medium">为您构思了以下3个创意方向，请选择一个：</p>
                                                    <div className="space-y-2">
                                                        {options.map((opt, idx) => (
                                                            <button key={idx} onClick={() => handleUseSuggestion(opt.fullPrompt)} className="w-full text-left p-3 bg-white rounded-md border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all group">
                                                                <div className="flex justify-between items-start">
                                                                    <h4 className="font-bold text-blue-600 text-sm group-hover:underline">{opt.title}</h4>
                                                                    <span className="text-xs bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full">Prompt优化</span>
                                                                </div>
                                                                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{opt.description}</p>
                                                                <div className="flex flex-wrap gap-1 mt-2">
                                                                    {opt.tags.map(tag => <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>)}
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
                                                <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-3 rounded-lg text-gray-800 shadow-sm">
                                                    <p className="mb-2 font-medium">为您找到以下设计灵感与风格：</p>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {plans.map((plan, idx) => (
                                                            <div key={idx} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                                                                <div className="h-32 w-full relative">
                                                                    {plan.imageSrc ? (
                                                                        <img src={plan.imageSrc} alt={plan.title} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">预览生成中...</div>
                                                                    )}
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                                                    <h4 className="absolute bottom-2 left-3 text-white font-bold text-sm shadow-sm">{plan.title}</h4>
                                                                </div>
                                                                <div className="p-3">
                                                                    <p className="text-xs text-gray-600 mb-3 line-clamp-2">{plan.description}</p>
                                                                    <button onClick={() => handleUseDesignPlan(plan)} className="w-full py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded hover:bg-blue-100 transition-colors">
                                                                        选择此风格
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
                            <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-3 rounded-lg text-gray-800 shadow-sm flex items-center space-x-2">
                                <span className="text-sm">AI 正在思考中</span>
                                <div className="flex space-x-1">
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </main>
                <footer className="p-4 border-t border-gray-200 flex-shrink-0">
                    <div className="flex items-center space-x-2 mb-3">
                        <AIToggleButton
                            icon={<SparklesIcon className="w-4 h-4" />}
                            label="提示词优化"
                            checked={enhancePromptEnabled}
                            onChange={() => setEnhancePromptEnabled(p => !p)}
                        />
                        <AIToggleButton
                            icon={<LightbulbIcon className="w-4 h-4" />}
                            label="设计灵感"
                            checked={designInspirationEnabled}
                            onChange={() => setDesignInspirationEnabled(p => !p)}
                        />
                        <div className="flex-grow" />
                        <ModelSelector value={selectedModel} onChange={setSelectedModel} disabled={isEditing} />
                        <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} disabled={isEditing} />
                    </div>
                    {uploadedFiles.length > 0 && (<div className="mb-2 flex items-center gap-2 flex-wrap">{uploadedFiles.map((file, i) => (<div key={i} className="relative"><img src={URL.createObjectURL(file)} className="w-12 h-12 rounded-md object-cover" alt={`upload preview ${i}`} /><button onClick={() => handleRemoveFile(i)} className="absolute -top-1 -right-1 bg-gray-700 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">&times;</button></div>))}</div>)}
                    <form onSubmit={handleSubmit} className="flex items-end gap-2">
                        <textarea 
                            ref={userInputRef} 
                            value={userInput} 
                            onChange={(e) => setUserInput(e.target.value)} 
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }} 
                            onPaste={handlePaste} 
                            placeholder={isLoading ? "AI正在工作中..." : (selectedImageId ? "请描述您想如何修改这张图片..." : "输入网址 URL 或创作指令")} 
                            className={`flex-1 p-3 border rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none overflow-hidden ${inputHighlight ? 'animate-input-highlight' : ''}`} 
                            rows={1} 
                            disabled={isLoading}
                        />
                        <div className="flex items-center">
                            <label htmlFor="file-upload" className={`p-2 rounded-full hover:bg-gray-200 cursor-pointer ${uploadedFiles.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <PaperClipIcon className="w-5 h-5 text-gray-500" />
                                <input id="file-upload" type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" disabled={uploadedFiles.length >= 3 || isLoading} />
                            </label>
                            <button type="submit" disabled={isLoading || (!userInput.trim() && uploadedFiles.length === 0)} className="ml-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                                </svg>
                            </button>
                        </div>
                    </form>
                </footer>
            </div>

            <div className="flex-1 relative bg-slate-50 overflow-hidden z-0"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onWheel={handleCanvasWheel}
            >
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px', transform: `translate(${transform.x % 20}px, ${transform.y % 20}px)` }}></div>
                <div ref={canvasRef} className="absolute top-0 left-0 w-full h-full origin-top-left transition-transform duration-75 ease-linear" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}>
                    {Object.values(images).map((img) => (
                        <div 
                            key={img.id} 
                            className={`image-on-canvas absolute group transition-shadow duration-200 ${(selectedImageId === img.id || chattingImageId === img.id) ? 'z-30' : 'z-0'} ${selectedImageId === img.id ? 'ring-4 ring-blue-500 shadow-2xl' : 'shadow-lg hover:shadow-xl'}`} 
                            style={{ left: img.x, top: img.y, width: img.width, height: img.height }}
                            onClick={(e) => handleImageClick(e, img.id)}
                        >
                            <img src={img.src} alt={img.alt} className="w-full h-full object-cover rounded-sm" draggable={false} />
                            {selectedImageId === img.id && (
                                <div 
                                    className="editor-toolbar-wrapper absolute z-20" 
                                    style={{ 
                                        left: '50%', 
                                        top: 0, 
                                        transformOrigin: 'bottom center', 
                                        transform: `translate(-50%, -100%) translateY(-${12 / transform.scale}px) scale(${1 / transform.scale})` 
                                    }}
                                >
                                    <EditorToolbar 
                                        onDownload={handleDownloadImage} 
                                        onUpscale={handleUpscale} 
                                        isUpscaling={isUpscaling} 
                                        onRegenerate={handleRegenerate}
                                        onRemoveBackground={handleRemoveBackground}
                                        isGenerating={isLoading}
                                        processingAction={processingAction}
                                    />
                                </div>
                            )}
                             {chattingImageId === img.id && (
                                <div 
                                    className="on-canvas-chat-box-wrapper absolute z-20"
                                    style={{
                                        left: '50%',
                                        top: '100%',
                                        transformOrigin: 'top center',
                                        transform: `translate(-50%, 0) translateY(${12 / transform.scale}px) scale(${1 / transform.scale})`
                                    }}
                                    onClick={e => e.stopPropagation()}
                                >
                                    <div className="w-[300px] bg-white rounded-lg shadow-xl border border-gray-200 p-2 animate-fade-in-up">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                            <span className="text-xs font-semibold text-gray-600">对这张图片进行编辑...</span>
                                        </div>
                                        <form onSubmit={handleOnCanvasChatSubmit} className="flex gap-2">
                                            <input 
                                                type="text" 
                                                autoFocus
                                                value={onCanvasChatInput} 
                                                onChange={e => setOnCanvasChatInput(e.target.value)} 
                                                placeholder="例如: 换成蓝色背景" 
                                                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                                            />
                                            <button type="submit" disabled={!onCanvasChatInput.trim()} className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700 disabled:bg-gray-300">发送</button>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <ZoomControls scale={transform.scale} onZoomIn={() => zoom('in')} onZoomOut={() => zoom('out')} />
                <BottomToolbar toolMode={toolMode} setToolMode={handleSetToolMode} />
                
                {/* Archive Drawer */}
                 {isArchiveOpen && (
                    <div className="absolute inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-200 z-30 flex flex-col animate-fade-in-up duration-300">
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h2 className="font-bold text-lg text-gray-800 flex items-center">
                                <ArchiveBoxIcon className="w-5 h-5 mr-2 text-purple-600" />
                                创作档案
                            </h2>
                            <button onClick={() => setIsArchiveOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50">
                            {imageSeries.length === 0 ? (
                                <div className="text-center text-gray-500 mt-10">
                                    <p>暂无创作记录</p>
                                </div>
                            ) : (
                                imageSeries.map(series => (
                                    <div key={series.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                        <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                             <h3 className="font-semibold text-sm text-gray-800 truncate flex-1 mr-2" title={series.initialPrompt}>
                                                {archiveSummaries[series.id] || '...'}
                                            </h3>
                                            <span className="text-[10px] text-gray-400 flex-shrink-0">{new Date(series.creationDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                        <div className="p-3 grid grid-cols-3 gap-2">
                                            {series.images.map(img => (
                                                <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer border border-gray-100" onClick={() => { setSelectedImageId(img.id); setIsArchiveOpen(false); }}>
                                                    <img src={img.src} alt={img.alt} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                         <button onClick={(e) => handleDownloadArchiveImage(e, img, series.initialPrompt)} className="p-1.5 bg-white/90 rounded-full text-gray-700 hover:text-blue-600 shadow-sm transform scale-90 hover:scale-100 transition-all" title="下载">
                                                            <ArrowDownTrayIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageGenerationPage;
