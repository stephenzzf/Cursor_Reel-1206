/**
 * Image Generation Assets - 图片生成相关图标和组件
 */

import React from 'react';

// --- ICONS ---
export const AIAvatarIcon: React.FC<{ className?: string, isThinking?: boolean }> = ({ className, isThinking }) => {
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
                <g transform="translate(50,50)"><g><path d="M0,-45 a45,45 0 1,0 0,90 a45,45 0 1,0 0,-90" stroke="url(#grad-ring)" strokeWidth="4" strokeLinecap="round" className="animate-spin origin-center" style={{ animationDuration: '8s' }} opacity="0.8" strokeDasharray="15 30"/><path d="M-35,0 a35,35 0 1,0 70,0 a35,35 0 1,0 -70,0" stroke="url(#grad-ring)" strokeWidth="3" strokeLinecap="round" className="animate-spin origin-center" style={{ animationDuration: '10s', animationDirection: 'reverse' }} opacity="0.5" strokeDasharray="10 20"/></g><g className={'animate-pulse'}><text x="0" y="4" textAnchor="middle" dominantBaseline="central" fontFamily="system-ui, sans-serif" fontSize="50" fontWeight="bold" fill="url(#grad-bars)">M</text></g></g>
                <defs><linearGradient id="grad-bars" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stopColor="#818CF8" /><stop offset="100%" stopColor="#6366F1" /></linearGradient><linearGradient id="grad-ring" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="rgba(99, 102, 241, 0.7)"/><stop offset="100%" stopColor="rgba(129, 140, 248, 0.1)"/></linearGradient></defs>
            </svg>
        </div>
    );
};

export const ToolIcon: React.FC<{ className?: string }> = (p) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h12A2.25 2.25 0 0 0 20.25 14.25V3M3.75 3v-1.5A2.25 2.25 0 0 1 6 0h12A2.25 2.25 0 0 1 20.25 1.5v1.5M3.75 3h16.5M16.5 6.75h.008v.008H16.5V6.75Zm-2.25 0h.008v.008H14.25V6.75Zm-2.25 0h.008v.008H12V6.75Zm-2.25 0h.008v.008H9.75V6.75Zm-2.25 0h.008v.008H7.5V6.75Zm-2.25 0h.008v.008H5.25V6.75Z" />
    </svg>
);

export const LightbulbIcon: React.FC<{ className?: string }> = (p) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...p}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0114 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
);

export const ArchiveBoxIcon: React.FC<{ className?: string }> = (p) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
);

export const PaperClipIcon: React.FC<{ className?: string }> = (p) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.122 2.122l7.81-7.81" />
    </svg>
);

export const ArrowDownTrayIcon: React.FC<{ className?: string }> = (p) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

export const SparklesIcon: React.FC<{ className?: string }> = (p) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
    </svg>
);

export const SelectIcon: React.FC<{ className?: string }> = (p) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 15l.364-1.364a1 1 0 011.263-.732l1.364.364M12.75 15l-1.364.364a1 1 0 00-.732 1.263l.364 1.364M12.75 15L12 12.75m.75 2.25L15 12.75M15 9.75l-3-3m0 0l-3 3m3-3v12" />
    </svg>
);

export const HandRaisedIcon: React.FC<{ className?: string }> = (p) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75h4.5m-4.5 0a2.25 2.25 0 01-2.25-2.25V5.25c0-.996.768-1.845 1.752-1.98.502-.068 1.02.046 1.442.328a2.25 2.25 0 01.978 2.476V9.75Zm4.5 0a2.25 2.25 0 002.25-2.25V5.25c0-1.242-1.008-2.25-2.25-2.25S12 4.008 12 5.25v2.25c0 .996.768 1.845 1.752-1.98.502-.068 1.02.046 1.442.328a2.25 2.25 0 00.978 2.476V9.75Zm-4.5 0h4.5M3 12h18M3 12a9 9 0 009 9m9-9a9 9 0 01-9 9" />
    </svg>
);

export const ChatBubbleIcon: React.FC<{ className?: string }> = (p) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12.75c0 .563-.098 1.11-.275 1.636a8.957 8.957 0 0 1-2.012 3.037c-1.638 1.25-3.69 1.838-5.71 1.838h-1.32a6.71 6.71 0 0 0-1.815.292c-1.077.365-2.095.84-3.047 1.423a.333.333 0 0 1-.49-.236V18.5a7.433 7.433 0 0 0-1.022-3.75c-.33-.623-.585-1.284-.766-1.975A8.96 8.96 0 0 1 3 12.75V9.75c0-4.962 4.038-9 9-9s9 4.038 9 9v3Z" />
    </svg>
);

export const CubeIcon: React.FC<{ className?: string }> = (p) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
);

export const ArrowPathIcon: React.FC<{ className?: string }> = (p) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
);

export const LayersIcon: React.FC<{ className?: string }> = (p) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
    </svg>
);

export const ClipboardDocumentIcon: React.FC<{ className?: string }> = (p) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5h12M8.25 11.25h12m-12 3.75h12M3.75 7.5h.008v.008H3.75V7.5Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 3.75h.008v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 3.75h.008v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
);

export const FitToScreenIcon: React.FC<{ className?: string }> = (p) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
);

// --- COMPONENTS ---
export const AIToggleButton: React.FC<{ 
    enabled?: boolean;
    checked?: boolean;  // 支持 checked 作为 enabled 的别名
    onToggle?: () => void;
    onChange?: () => void;  // 支持 onChange 作为 onToggle 的别名
    icon?: React.ReactNode;  // 支持图标
    label?: string;  // 支持自定义标签
    className?: string;
}> = ({ enabled, checked, onToggle, onChange, icon, label, className }) => {
    const isEnabled = enabled !== undefined ? enabled : (checked !== undefined ? checked : false);
    const handleToggle = onToggle || onChange || (() => {});
    
    return (
        <button
            onClick={handleToggle}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isEnabled 
                    ? 'bg-indigo-500 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            } ${className || ''}`}
        >
            {icon && <span className="flex-shrink-0">{icon}</span>}
            <span>{label || (isEnabled ? 'AI 开启' : 'AI 关闭')}</span>
        </button>
    );
};

export const ZoomControls: React.FC<{ 
    scale: number; 
    onZoomIn: () => void; 
    onZoomOut: () => void;
}> = ({ scale, onZoomIn, onZoomOut }) => (
    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 z-20 flex items-center text-sm font-medium">
        <button onClick={onZoomOut} className="p-2 h-9 w-9 flex items-center justify-center hover:bg-gray-100 rounded-l-md">-</button>
        <div className="px-3 h-9 flex items-center border-x border-gray-200 tabular-nums w-16 justify-center">{Math.round(scale * 100)}%</div>
        <button onClick={onZoomIn} className="p-2 h-9 w-9 flex items-center justify-center hover:bg-gray-100 rounded-r-md">+</button>
    </div>
);

export const BottomToolbar: React.FC<{ 
    toolMode: 'select' | 'pan' | 'chat'; 
    setToolMode: (mode: 'select' | 'pan' | 'chat') => void;
}> = ({ toolMode, setToolMode }) => (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 flex items-center p-1 space-x-1">
        <button 
            onClick={() => setToolMode('select')} 
            className={`flex items-center space-x-2 p-2 px-3 rounded-md text-sm ${
                toolMode === 'select' 
                    ? 'bg-blue-500 text-white shadow' 
                    : 'hover:bg-gray-100 text-gray-600'
            }`}
        >
            <SelectIcon className="w-5 h-5" />
            <span>选择</span>
            <span className="text-gray-400 text-xs">(V)</span>
        </button>
        <button 
            onClick={() => setToolMode('pan')} 
            className={`flex items-center space-x-2 p-2 px-3 rounded-md text-sm ${
                toolMode === 'pan' 
                    ? 'bg-blue-500 text-white shadow' 
                    : 'hover:bg-gray-100 text-gray-600'
            }`}
        >
            <HandRaisedIcon className="w-5 h-5" />
            <span>平移画布</span>
            <span className="text-gray-400 text-xs">(H)</span>
        </button>
        <button 
            onClick={() => setToolMode('chat')} 
            className={`flex items-center space-x-2 p-2 px-3 rounded-md text-sm ${
                toolMode === 'chat' 
                    ? 'bg-blue-500 text-white shadow' 
                    : 'hover:bg-gray-100 text-gray-600'
            }`}
        >
            <ChatBubbleIcon className="w-5 h-5" />
            <span>图片聊天</span>
            <span className="text-gray-400 text-xs">(C)</span>
        </button>
    </div>
);

