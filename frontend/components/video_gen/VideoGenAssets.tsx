
import React, { useState, useEffect, useRef } from 'react';

// --- ICONS ---
export const AIAvatarIcon: React.FC<{ className?: string, isThinking?: boolean }> = ({ className, isThinking }) => {
    if (!isThinking) {
        return (
            <div className={`relative w-8 h-8 rounded-lg bg-white flex items-center justify-center border-2 border-indigo-500 ${className}`}>
                <span className="font-bold text-lg text-indigo-500 leading-none">M</span>
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
export const ToolIcon: React.FC<{ className?: string }> = (p) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h12A2.25 2.25 0 0 0 20.25 14.25V3M3.75 3v-1.5A2.25 2.25 0 0 1 6 0h12A2.25 2.25 0 0 1 20.25 1.5v1.5M3.75 3h16.5M16.5 6.75h.008v.008H16.5V6.75Zm-2.25 0h.008v.008H14.25V6.75Zm-2.25 0h.008v.008H12V6.75Zm-2.25 0h.008v.008H9.75V6.75Zm-2.25 0h.008v.008H7.5V6.75Zm-2.25 0h.008v.008H5.25V6.75Z" /></svg>);
export const LightbulbIcon: React.FC<{ className?: string }> = (p) => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0114 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>);
export const ArchiveBoxIcon: React.FC<{ className?: string }> = (p) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>);
export const PaperClipIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.122 2.122l7.81-7.81" /></svg>;
export const ArrowDownTrayIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>;
export const SparklesIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>;
export const CubeIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>;
export const SelectIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M12.75 15l.364-1.364a1 1 0 011.263-.732l1.364.364M12.75 15l-1.364.364a1 1 0 00-.732 1.263l.364 1.364M12.75 15L12 12.75m.75 2.25L15 12.75M15 9.75l-3-3m0 0l-3 3m3-3v12" /></svg>;
export const HandRaisedIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75h4.5m-4.5 0a2.25 2.25 0 01-2.25-2.25V5.25c0-.996.768-1.845 1.752-1.98.502-.068 1.02.046 1.442.328a2.25 2.25 0 01.978 2.476V9.75Zm4.5 0a2.25 2.25 0 002.25-2.25V5.25c0-1.242-1.008-2.25-2.25-2.25S12 4.008 12 5.25v2.25c0 .996.768 1.845 1.752-1.98.502-.068 1.02.046 1.442.328a2.25 2.25 0 00.978 2.476V9.75Zm-4.5 0h4.5M3 12h18M3 12a9 9 0 009 9m9-9a9 9 0 01-9 9" /></svg>;
export const ChatBubbleIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12.75c0 .563-.098 1.11-.275 1.636a8.957 8.957 0 0 1-2.012 3.037c-1.638 1.25-3.69 1.838-5.71 1.838h-1.32a6.71 6.71 0 0 0-1.815.292c-1.077.365-2.095.84-3.047 1.423a.333.333 0 0 1-.49-.236V18.5a7.433 7.433 0 0 0-1.022-3.75c-.33-.623-.585-1.284-.766-1.975A8.96 8.96 0 0 1 3 12.75V9.75c0-4.962 4.038-9 9-9s9 4.038 9 9v3Z" /></svg>;
export const AspectRatioIcon169 = (p: any) => <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}><rect x="2" y="6.5" width="20" height="11" rx="2" stroke="currentColor" strokeWidth="2"/></svg>;
export const AspectRatioIcon916 = (p: any) => <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}><rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" strokeWidth="2"/></svg>;
export const VideoCameraIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75Z" /></svg>;
export const ClipboardDocumentIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m9.75 11.625-3.75-3.75" /></svg>;
export const DocumentTextIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>;
export const ArrowPathIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>;
export const FitToScreenIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>;

// --- SUB-COMPONENTS ---
export const Header: React.FC<{ onReset: () => void; onOpenArchive: () => void; }> = ({ onReset, onOpenArchive }) => (
    <div className="flex items-center px-6 py-3 bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)] z-20 relative flex-shrink-0">
        <div className="flex items-center gap-5">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold shadow-sm">
                    V
                </div>
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">AI 视频创作</h1>
            </div>
            
            <div className="h-6 w-px bg-slate-200"></div>

            <div className="flex items-center space-x-3">
                <button 
                    onClick={onOpenArchive} 
                    className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 py-2 px-3 rounded-lg transition-all shadow-sm"
                >
                    <ArchiveBoxIcon className="w-4 h-4 text-slate-500" />
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

export const EditorToolbar: React.FC<{ 
    onDownload: () => void; 
    onCopyFrame: () => void; 
    onRegenerate: () => void;
    isGenerating: boolean; 
}> = ({ onDownload, onCopyFrame, onRegenerate, isGenerating }) => {
    return (
        <div className="bg-white/90 backdrop-blur-sm rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-slate-200 z-20 flex items-center p-1.5 space-x-1.5 h-10">
             <button onClick={onCopyFrame} className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 rounded-full px-3 h-7 hover:bg-slate-100 whitespace-nowrap" title="复制当前画面到剪贴板"><ClipboardDocumentIcon className="w-3.5 h-3.5" /><span>复制画面</span></button>
             <div className="w-px h-4 bg-slate-200" />
             <button onClick={onRegenerate} disabled={isGenerating} className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 rounded-full px-3 h-7 hover:bg-slate-100 disabled:text-slate-400 disabled:bg-transparent disabled:cursor-not-allowed transition-colors whitespace-nowrap" title="再次生成">
                {isGenerating ? (
                    <svg className="animate-spin h-3.5 w-3.5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                )}
                <span>重绘</span>
            </button>
             <div className="w-px h-4 bg-slate-200" />
             <button onClick={onDownload} className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 rounded-full px-3 h-7 hover:bg-slate-100 whitespace-nowrap"><ArrowDownTrayIcon className="w-3.5 h-3.5" /><span>下载</span></button>
        </div>
    );
};

export const ZoomControls: React.FC<{ 
    scale: number; 
    onZoomIn: () => void; 
    onZoomOut: () => void; 
    onSetScale?: (scale: number) => void;
}> = ({ scale, onZoomIn, onZoomOut, onSetScale }) => {
    const [inputValue, setInputValue] = useState(Math.round(scale * 100).toString());

    useEffect(() => {
        setInputValue(Math.round(scale * 100).toString());
    }, [scale]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const cleanValue = e.target.value.replace(/[^0-9]/g, '');
        setInputValue(cleanValue);
    };

    const handleInputCommit = () => {
        let val = parseInt(inputValue, 10);
        if (isNaN(val)) {
            val = Math.round(scale * 100);
        } else {
            val = Math.min(Math.max(10, val), 500);
        }
        if (onSetScale) {
            onSetScale(val / 100);
        }
        setInputValue(val.toString());
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleInputCommit();
            (e.target as HTMLInputElement).blur();
        }
    };

    return ( 
        <div 
            className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-slate-200 z-20 flex items-center text-sm font-medium overflow-hidden h-10"
            onMouseDown={(e) => e.stopPropagation()} 
        > 
            <button onClick={onZoomOut} className="p-2 h-full w-10 flex items-center justify-center hover:bg-slate-50 active:bg-slate-100 text-slate-600" title="缩小">
                -
            </button> 
            <div className="h-6 flex items-center border-x border-slate-200 w-14 justify-center relative">
                <input 
                    type="text" 
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputCommit}
                    onKeyDown={handleKeyDown}
                    readOnly={!onSetScale} // Make readable only if no setter
                    className="w-full h-full text-center bg-transparent focus:outline-none text-slate-700 font-tabular-nums text-xs font-bold"
                />
                <span className="absolute right-0.5 text-slate-400 text-[10px] pointer-events-none">%</span>
            </div> 
            <button onClick={onZoomIn} className="p-2 h-full w-10 flex items-center justify-center hover:bg-slate-50 active:bg-slate-100 text-slate-600" title="放大">
                +
            </button> 
        </div>
    );
};

export const BottomToolbar: React.FC<{ 
    toolMode: 'select' | 'pan' | 'chat'; 
    setToolMode: (mode: 'select' | 'pan' | 'chat') => void; 
    onFitToScreen?: () => void;
}> = ({ toolMode, setToolMode, onFitToScreen }) => ( 
    <div 
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur-sm rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-slate-200 flex items-center p-1.5 space-x-1"
        onMouseDown={(e) => e.stopPropagation()}
    > 
        <button onClick={() => setToolMode('select')} className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${toolMode === 'select' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`}> <SelectIcon className="w-4 h-4" /> <span>选择</span> <span className="opacity-70 font-normal ml-1">V</span> </button> 
        <button onClick={() => setToolMode('pan')} className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${toolMode === 'pan' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`}> <HandRaisedIcon className="w-4 h-4" /> <span>平移</span> <span className="opacity-70 font-normal ml-1">H</span> </button> 
        <button onClick={() => setToolMode('chat')} className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${toolMode === 'chat' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'}`}> <ChatBubbleIcon className="w-4 h-4" /> <span>对话</span> <span className="opacity-70 font-normal ml-1">C</span> </button>
        {onFitToScreen && (
            <>
                <div className="w-px h-5 bg-slate-200 mx-1" />
                <button onClick={onFitToScreen} className="flex items-center space-x-2 px-3 py-2 rounded-full text-xs font-semibold hover:bg-slate-100 text-slate-600 transition-colors" title="适配屏幕"> <FitToScreenIcon className="w-4 h-4" /> <span>适配</span> </button> 
            </>
        )}
    </div>
);

export const videoAspectRatios = [
    { value: '16:9', label: '横向', Icon: AspectRatioIcon169 },
    { value: '9:16', label: '纵向', Icon: AspectRatioIcon916 },
];

export const AspectRatioSelector: React.FC<{ value: string; onChange: (value: string) => void; disabled: boolean; }> = ({ value, onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const selected = videoAspectRatios.find(r => r.value === value) || videoAspectRatios[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) { setIsOpen(false); } };
        document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (newValue: string) => { onChange(newValue); setIsOpen(false); };

    return (
        <div ref={wrapperRef} className="relative">
            <button
                onClick={() => setIsOpen(p => !p)}
                disabled={disabled}
                className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
                <selected.Icon className="w-4 h-4" />
                <span>{selected.label}</span>
            </button>
            {isOpen && !disabled && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 animate-fade-in-up overflow-hidden">
                    {videoAspectRatios.map(ratio => (
                        <button
                            key={ratio.value}
                            onClick={() => handleSelect(ratio.value)}
                            className={`w-full text-left px-4 py-2.5 text-xs flex items-center space-x-3 transition-colors ${value === ratio.value ? 'font-bold text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <ratio.Icon className="w-4 h-4" />
                            <span>{ratio.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export const ModelSelector: React.FC<{ value: 'veo_fast' | 'veo_gen'; onChange: (value: 'veo_fast' | 'veo_gen') => void; disabled: boolean; }> = ({ value, onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) { setIsOpen(false); } };
        document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (newValue: 'veo_fast' | 'veo_gen') => { onChange(newValue); setIsOpen(false); };

    return (
        <div ref={wrapperRef} className="relative">
            <button
                onClick={() => setIsOpen(p => !p)}
                disabled={disabled}
                className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
                <CubeIcon className="w-4 h-4" />
                <span>{value === 'veo_gen' ? 'Veo' : 'Veo Fast'}</span>
            </button>
            {isOpen && !disabled && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 animate-fade-in-up overflow-hidden">
                    <button
                        onClick={() => handleSelect('veo_fast')}
                        className={`w-full text-left px-4 py-3 text-xs flex flex-col transition-colors ${value === 'veo_fast' ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                    >
                        <span className={`font-bold ${value === 'veo_fast' ? 'text-indigo-600' : 'text-slate-800'}`}>Veo Fast</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">快速预览 (Preview)</span>
                    </button>
                    <button
                        onClick={() => handleSelect('veo_gen')}
                        className={`w-full text-left px-4 py-3 text-xs flex flex-col transition-colors ${value === 'veo_gen' ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                    >
                        <span className={`font-bold ${value === 'veo_gen' ? 'text-indigo-600' : 'text-slate-800'}`}>Veo</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">高质量生成 (Gen)</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export const AIToggleButton: React.FC<{ icon: React.ReactNode; label: string; checked: boolean; onChange: () => void; }> = ({ icon, label, checked, onChange }) => (
    <button 
        onClick={onChange}
        className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all border shadow-sm ${
            checked 
            ? 'bg-indigo-600 text-white border-indigo-600 ring-1 ring-indigo-600' 
            : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200'
        }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

export const ModeIndicator: React.FC<{ fileCount: number }> = ({ fileCount }) => {
    let label = "文本生成视频";
    let icon = <DocumentTextIcon className="w-4 h-4" />;
    let bgClass = "bg-slate-100 text-slate-600 border-slate-200";

    if (fileCount === 1) {
        label = "图生视频";
        icon = null;
        bgClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
    } else if (fileCount === 2) {
        label = "首尾帧生成";
        icon = null;
        bgClass = "bg-violet-50 text-violet-700 border-violet-200";
    }

    return (
        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border ${bgClass} text-xs font-medium transition-all animate-fade-in select-none`}>
            {icon}
            <span className="flex-shrink-0">{label}</span>
        </div>
    );
};
