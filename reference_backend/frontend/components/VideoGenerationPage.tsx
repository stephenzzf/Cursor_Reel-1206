

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
    enhancePrompt, 
    getDesignPlan, 
    generateReferenceImage, 
    summarizePrompt,
    getVideoCreativeDirectorAction, 
    generateVideo
} from '../services/videoService';
import { CanvasVideo, VideoMessage, VideoSeries, EnhancedPrompt } from '../types';

// --- ICONS ---
const AIAvatarIcon: React.FC<{ className?: string, isThinking?: boolean }> = ({ className, isThinking }) => {
    if (!isThinking) {
        return (
            <div className={`relative w-8 h-8 rounded-lg bg-white flex items-center justify-center border-2 border-purple-500 ${className}`}>
                <span className="font-bold text-lg text-purple-500 leading-none">M</span>
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
const PaperClipIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.122 2.122l7.81-7.81" /></svg>;
const ArrowDownTrayIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>;
const SparklesIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>;
const CubeIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>;
const SelectIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M12.75 15l.364-1.364a1 1 0 011.263-.732l1.364.364M12.75 15l-1.364.364a1 1 0 00-.732 1.263l.364 1.364M12.75 15L12 12.75m.75 2.25L15 12.75M15 9.75l-3-3m0 0l-3 3m3-3v12" /></svg>;
const HandRaisedIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75h4.5m-4.5 0a2.25 2.25 0 01-2.25-2.25V5.25c0-.996.768-1.845 1.752-1.98.502-.068 1.02.046 1.442.328a2.25 2.25 0 01.978 2.476V9.75Zm4.5 0a2.25 2.25 0 002.25-2.25V5.25c0-1.242-1.008-2.25-2.25-2.25S12 4.008 12 5.25v2.25c0 .996.768 1.845 1.752-1.98.502-.068 1.02.046 1.442.328a2.25 2.25 0 00.978 2.476V9.75Zm-4.5 0h4.5M3 12h18M3 12a9 9 0 009 9m9-9a9 9 0 01-9 9" /></svg>;
const AspectRatioIcon169 = (p: any) => <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}><rect x="2" y="6.5" width="20" height="11" rx="2" stroke="currentColor" strokeWidth="2"/></svg>;
const AspectRatioIcon916 = (p: any) => <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}><rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" strokeWidth="2"/></svg>;
const VideoCameraIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75Z" /></svg>;
const ClipboardDocumentIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m9.75 11.625-3.75-3.75" /></svg>;
const DocumentTextIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>;
const ArrowPathIcon = (p: any) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>;

// --- UTILS ---
const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve((reader.result as string).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });

// --- SUB-COMPONENTS ---
const Header: React.FC<{ onReset: () => void; onOpenArchive: () => void; }> = ({ onReset, onOpenArchive }) => ( <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white flex-shrink-0"> <div><h1 className="text-lg font-semibold text-gray-800">AI 视频创作</h1></div> <div className="flex items-center space-x-2"> <button onClick={onOpenArchive} className="flex items-center space-x-2 text-sm bg-white text-purple-700 border border-purple-500 font-semibold py-2 px-4 rounded-lg hover:bg-purple-50 transition-colors"><ArchiveBoxIcon className="w-4 h-4" /><span>创作档案</span></button> <button onClick={onReset} className="flex items-center space-x-2 text-sm bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-purple-600 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg><span>返回首页</span></button> </div> </div>);

const EditorToolbar: React.FC<{ 
    onDownload: () => void; 
    onCopyFrame: () => void; 
    onRegenerate: () => void;
    isGenerating: boolean; 
}> = ({ onDownload, onCopyFrame, onRegenerate, isGenerating }) => {
    return (
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 z-20 flex items-center p-1 space-x-1 px-2 h-8">
             <button onClick={onCopyFrame} className="flex items-center space-x-1 text-xs font-medium text-gray-700 rounded-md px-2 h-6 hover:bg-gray-100" title="复制当前画面到剪贴板"><ClipboardDocumentIcon className="w-3.5 h-3.5" /><span>复制画面</span></button>
             
             <div className="w-px h-5 bg-gray-200" />
             
             <button onClick={onRegenerate} disabled={isGenerating} className="flex items-center space-x-1 text-xs font-medium text-gray-700 rounded-md px-2 h-6 hover:bg-gray-100 disabled:text-gray-400 disabled:bg-transparent disabled:cursor-not-allowed transition-colors" title="再次生成">
                {isGenerating ? (
                    <svg className="animate-spin h-3.5 w-3.5 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                )}
                <span>再次生成</span>
            </button>

             <div className="w-px h-5 bg-gray-200" />
             
             <button onClick={onDownload} className="flex items-center space-x-1 text-xs font-medium text-gray-700 rounded-md px-2 h-6 hover:bg-gray-100"><ArrowDownTrayIcon className="w-3.5 h-3.5" /><span>下载视频</span></button>
        </div>
    );
};

const ZoomControls: React.FC<{ scale: number; onZoomIn: () => void; onZoomOut: () => void; }> = ({ scale, onZoomIn, onZoomOut }) => ( <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 z-20 flex items-center text-sm font-medium"> <button onClick={onZoomOut} className="p-2 h-9 w-9 flex items-center justify-center hover:bg-gray-100 rounded-l-md">-</button> <div className="px-3 h-9 flex items-center border-x border-gray-200 tabular-nums w-16 justify-center">{Math.round(scale * 100)}%</div> <button onClick={onZoomIn} className="p-2 h-9 w-9 flex items-center justify-center hover:bg-gray-100 rounded-r-md">+</button> </div>);
const BottomToolbar: React.FC<{ toolMode: 'select' | 'pan'; setToolMode: (mode: 'select' | 'pan') => void; }> = ({ toolMode, setToolMode }) => ( <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 flex items-center p-1 space-x-1"> <button onClick={() => setToolMode('select')} className={`flex items-center space-x-2 p-2 px-3 rounded-md text-sm ${toolMode === 'select' ? 'bg-blue-500 text-white shadow' : 'hover:bg-gray-100 text-gray-600'}`}> <SelectIcon className="w-5 h-5" /> <span>选择</span> <span className="text-gray-400 text-xs">(V)</span> </button> <button onClick={() => setToolMode('pan')} className={`flex items-center space-x-2 p-2 px-3 rounded-md text-sm ${toolMode === 'pan' ? 'bg-blue-500 text-white shadow' : 'hover:bg-gray-100 text-gray-600'}`}> <HandRaisedIcon className="w-5 h-5" /> <span>平移画布</span> <span className="text-gray-400 text-xs">(H)</span> </button> </div>);

const videoAspectRatios = [
    { value: '16:9', label: '横向 (16:9)', Icon: AspectRatioIcon169 },
    { value: '9:16', label: '纵向 (9:16)', Icon: AspectRatioIcon916 },
];

const AspectRatioSelector: React.FC<{ value: string; onChange: (value: string) => void; disabled: boolean; }> = ({ value, onChange, disabled }) => {
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
            <button onClick={() => setIsOpen(p => !p)} disabled={disabled} className="flex items-center space-x-2 text-sm font-medium px-3 py-1.5 rounded-full transition-all bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200 hover:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed transform hover:scale-105">
                <selected.Icon className="w-4 h-4" /> <span>尺寸</span>
            </button>
            {isOpen && !disabled && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-20 animate-fade-in-up">
                    {videoAspectRatios.map(ratio => (
                        <button key={ratio.value} onClick={() => handleSelect(ratio.value)} className={`w-full text-left px-3 py-1.5 text-sm flex items-center space-x-3 transition-colors ${value === ratio.value ? 'font-semibold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}>
                            <ratio.Icon className="w-5 h-5" /> <span>{ratio.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const ModelSelector: React.FC<{ value: 'veo_fast' | 'veo_gen'; onChange: (value: 'veo_fast' | 'veo_gen') => void; disabled: boolean; }> = ({ value, onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) { setIsOpen(false); } };
        document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (newValue: 'veo_fast' | 'veo_gen') => { onChange(newValue); setIsOpen(false); };

    return (
        <div ref={wrapperRef} className="relative">
            <button onClick={() => setIsOpen(p => !p)} disabled={disabled} className="flex items-center space-x-2 text-sm font-medium px-3 py-1.5 rounded-full transition-all bg-white text-purple-600 border border-purple-200 hover:bg-purple-50 hover:border-purple-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed transform hover:scale-105 shadow-sm">
                <CubeIcon className="w-4 h-4" /> <span>{value === 'veo_gen' ? 'Veo' : 'Veo Fast'}</span>
            </button>
            {isOpen && !disabled && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-20 animate-fade-in-up">
                    <button onClick={() => handleSelect('veo_fast')} className={`w-full text-left px-3 py-2 text-sm flex flex-col transition-colors ${value === 'veo_fast' ? 'bg-purple-50' : 'hover:bg-gray-100'}`}>
                        <span className={`font-semibold ${value === 'veo_fast' ? 'text-purple-600' : 'text-gray-800'}`}>Veo Fast</span>
                        <span className="text-xs text-gray-500">快速预览 (Preview)</span>
                    </button>
                    <button onClick={() => handleSelect('veo_gen')} className={`w-full text-left px-3 py-2 text-sm flex flex-col transition-colors ${value === 'veo_gen' ? 'bg-purple-50' : 'hover:bg-gray-100'}`}>
                        <span className={`font-semibold ${value === 'veo_gen' ? 'text-purple-600' : 'text-gray-800'}`}>Veo</span>
                        <span className="text-xs text-gray-500">高质量生成 (Gen)</span>
                    </button>
                </div>
            )}
        </div>
    );
};

const AIToggleButton: React.FC<{ icon: React.ReactNode; label: string; checked: boolean; onChange: () => void; }> = ({ icon, label, checked, onChange }) => (
    <label className={`relative inline-flex items-center cursor-pointer transition-all duration-200 ease-in-out rounded-full py-1.5 pl-3 pr-4 border ${checked ? 'bg-purple-50 border-purple-400 text-purple-700 shadow-sm' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200 hover:border-gray-300'}`}>
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
        <span className={`mr-2 transition-colors ${checked ? 'text-purple-500' : 'text-gray-400'}`}>{icon}</span>
        <span className="text-sm font-medium">{label}</span>
    </label>
);

const ModeIndicator: React.FC<{ fileCount: number }> = ({ fileCount }) => {
    let label = "文本生成视频";
    let icon = <DocumentTextIcon className="w-4 h-4" />;
    let bgClass = "bg-gray-100 text-gray-600 border-gray-200";

    if (fileCount === 1) {
        label = "图生视频 (参考图)";
        icon = null;
        bgClass = "bg-blue-50 text-blue-700 border-blue-200";
    } else if (fileCount === 2) {
        label = "首尾帧生成视频";
        icon = null;
        bgClass = "bg-purple-50 text-purple-700 border-purple-200";
    }

    return (
        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border ${bgClass} text-xs font-medium transition-all animate-fade-in select-none`}>
            {icon}
            <span className="flex-shrink-0">{label}</span>
        </div>
    );
};

// --- MAIN COMPONENT ---
interface VideoGenerationPageProps { initialPrompt: string; onReset: () => void; }

const VideoGenerationPage: React.FC<VideoGenerationPageProps> = ({ initialPrompt, onReset }) => {
    const [messages, setMessages] = useState<VideoMessage[]>([]);
    const [videos, setVideos] = useState<Record<string, CanvasVideo>>({});
    const [userInput, setUserInput] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
    const [lastGeneratedVideoId, setLastGeneratedVideoId] = useState<string | null>(null);
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);
    const [archiveSummaries, setArchiveSummaries] = useState<Record<string, string>>({});
    const [enhancePromptEnabled, setEnhancePromptEnabled] = useState(false);
    const [designInspirationEnabled, setDesignInspirationEnabled] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [selectedModel, setSelectedModel] = useState<'veo_fast' | 'veo_gen'>('veo_fast');
    const [videoPlaybackErrors, setVideoPlaybackErrors] = useState<Record<string, boolean>>({});

    const [transform, setTransform] = useState({ x: 50, y: 50, scale: 0.5 });
    const [toolMode, setToolMode] = useState<'select' | 'pan'>('select');
    const [apiKeyChecked, setApiKeyChecked] = useState(false);

    const isPanning = useRef(false);
    const lastMousePosition = useRef({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const initialPromptHandled = useRef(false);
    const userInputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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

    // API Key is now managed by backend, no need to check on frontend
    useEffect(() => {
        setApiKeyChecked(true);
    }, []);
    
    const addMessage = useCallback((role: 'user' | 'assistant', type: VideoMessage['type'], content: any) => {
        setMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random()}`, role, type, content, timestamp: Date.now() }]);
    }, []);

    const calculateNewVideoPosition = useCallback((sourceVideoId: string | null | undefined, allVideos: Record<string, CanvasVideo>): { x: number; y: number } => {
         // If source video exists, we stack vertically below the bottom-most video in that column
         if (sourceVideoId && allVideos[sourceVideoId]) {
             const sourceVideo = allVideos[sourceVideoId];
             const columnX = sourceVideo.x;
             // Find all videos in this column (approximate X match to handle float precision)
             const videosInColumn = Object.values(allVideos).filter(v => Math.abs(v.x - columnX) < 20);
             
             // Find the absolute bottom of the column
             const maxY = videosInColumn.reduce((max, v) => Math.max(max, v.y + v.height), 0);
             
             return { x: columnX, y: maxY + 24 }; // 24px gap
         }

         // Default behavior: New column to the right of the main axis
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
                if (file) {
                    filesToUpload.push(file);
                }
            }
        }

        if (filesToUpload.length > 0) {
            e.preventDefault(); // Prevent text paste if we found images
            setUploadedFiles(prev => {
                const combined = [...prev, ...filesToUpload];
                return combined.slice(0, 2); // Limit to 2 files max for video
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
        setIsLoading(true);
        const videoId = `vid-${Date.now()}`;
        
        let imagesToUse: { data: string; mimeType: string }[] = [];
        let modelToUse = selectedModel;
        let ratioToUse = aspectRatio;

        if (overrideParams) {
            imagesToUse = overrideParams.images;
            modelToUse = overrideParams.model;
            ratioToUse = overrideParams.aspectRatio;
        } else {
             // Process uploaded files
            imagesToUse = await Promise.all(uploadedFiles.map(async file => ({ 
                data: await blobToBase64(file), 
                mimeType: file.type 
            })));
            setUploadedFiles([]); // Clear only if we used them from state
        }

        const width = ratioToUse === '16:9' ? 640 : 360;
        const height = ratioToUse === '16:9' ? 360 : 640;
        
        // Use the positioning logic passing the inferred sourceVideoId
        const { x, y } = calculateNewVideoPosition(sourceVideoId, videos);

        const newVideo: CanvasVideo = {
            id: videoId,
            src: '',
            prompt,
            width, height, x, y,
            status: 'generating',
            generationParams: {
                sourceImages: imagesToUse,
                model: modelToUse,
                aspectRatio: ratioToUse
            }
        };
        setVideos(prev => ({ ...prev, [videoId]: newVideo }));
        
        // Determine Mode for display message
        let modeLabel = "文本生成视频";
        if (imagesToUse.length === 1) modeLabel = "图生视频 (参考图)";
        if (imagesToUse.length === 2) modeLabel = "首尾帧生成视频";

        // Determine Model Name for display
        const modelDisplayName = modelToUse === 'veo_gen' ? 'Veo (Gen)' : 'Veo Fast (Preview)';

        // Construct Startup Message
        const startupMessage = `AI 视频生成引擎已启动 (Veo) 🚀

📋 任务参数:
• 模式: ${modeLabel}
• 模型: ${modelDisplayName}
• 尺寸: ${ratioToUse}
• 提示词: ${prompt}

正在为您生成视频，请稍候...`;

        addMessage('assistant', 'text', startupMessage);

        try {
            const { videoUri } = await generateVideo(prompt, imagesToUse, ratioToUse as any, modelToUse);
            
            setVideos(prev => ({ 
                ...prev, 
                [videoId]: { ...prev[videoId], src: videoUri, status: 'done' } 
            }));
            addMessage('assistant', 'generated-video', { videoId, prompt });
            setLastGeneratedVideoId(videoId);
        } catch (error) {
            console.error("Video generation failed:", error);
            const msg = error instanceof Error ? error.message : 'Unknown error';
            setVideos(prev => ({ 
                ...prev, 
                [videoId]: { ...prev[videoId], status: 'error', errorMsg: msg } 
            }));
            addMessage('assistant', 'text', `视频生成失败: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    }, [uploadedFiles, videos, addMessage, aspectRatio, selectedModel, calculateNewVideoPosition]);

    const executeEnhancePrompt = useCallback(async (prompt: string) => { setIsLoading(true); addMessage('assistant', 'tool-usage', { text: 'AI 创意总监 | 提示词优化' }); try { const suggestions = await enhancePrompt(prompt); addMessage('assistant', 'prompt-options', suggestions); } catch (error) { addMessage('assistant', 'text', '抱歉，无法优化提示词。'); } finally { setIsLoading(false); } }, [addMessage]);
    const executeGetDesignPlan = useCallback(async (prompt: string) => { setIsLoading(true); addMessage('assistant', 'tool-usage', { text: 'AI 创意总监 | 设计灵感' }); try { const plans = await getDesignPlan(prompt); const imagePromises = plans.map(plan => generateReferenceImage(plan.referenceImagePrompt).catch(() => ({ base64Image: '' }))); const generatedImages = await Promise.all(imagePromises); const plansForDisplay = plans.map((plan, index) => ({ ...plan, imageSrc: `data:image/jpeg;base64,${generatedImages[index].base64Image}`, })); addMessage('assistant', 'design-plans', plansForDisplay); } catch (error) { addMessage('assistant', 'text', '抱歉，无法获取设计方案。'); } finally { setIsLoading(false); } }, [addMessage]);

    const processUserTurn = useCallback(async (prompt: string) => {
        setIsLoading(true);
        try {
            // Updated call with context
            const directorAction = await getVideoCreativeDirectorAction(prompt, messages, selectedVideoId, lastGeneratedVideoId);
            
            if (directorAction.action === 'ANSWER_QUESTION') {
                addMessage('assistant', 'text', directorAction.prompt);
                // 如果是地理位置限制错误（通过 message 字段判断），不继续执行后续操作
                if ((directorAction as any).error === 'API location restriction' || 
                    (directorAction as any).message?.includes('location') || 
                    directorAction.prompt?.includes('地理位置限制')) {
                    return; // 提前返回，不执行视频生成
                }
            } else {
                addMessage('assistant', 'text', directorAction.reasoning);
            }

            if (directorAction.action === 'NEW_VIDEO' || directorAction.action === 'EDIT_VIDEO') {
                // If AI detects this as an edit and provides a target, auto-select it for visual feedback
                if (directorAction.targetVideoId && videos[directorAction.targetVideoId]) {
                    setSelectedVideoId(directorAction.targetVideoId);
                }

                if (designInspirationEnabled) {
                    await executeGetDesignPlan(directorAction.prompt);
                } else if (enhancePromptEnabled) {
                    await executeEnhancePrompt(directorAction.prompt);
                } else {
                    // Pass the AI inferred targetVideoId (might be implicit editing) to execution logic
                    await executeVideoGeneration(directorAction.prompt, directorAction.targetVideoId);
                }
            }
        } catch (error) {
             const errorMessage = error instanceof Error ? error.message : '未知错误';
             addMessage('assistant', 'text', `处理请求出错: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    }, [messages, selectedVideoId, lastGeneratedVideoId, videos, addMessage, designInspirationEnabled, enhancePromptEnabled, executeVideoGeneration, executeGetDesignPlan, executeEnhancePrompt]);

    const handleSubmit = useCallback((e?: React.FormEvent) => { e?.preventDefault(); const currentPrompt = userInput; if (!currentPrompt.trim() && uploadedFiles.length === 0) return; addMessage('user', 'text', currentPrompt); setUserInput(''); processUserTurn(currentPrompt); }, [userInput, uploadedFiles, addMessage, processUserTurn]);
    
    useEffect(() => { if (initialPrompt && !initialPromptHandled.current) { initialPromptHandled.current = true; addMessage('user', 'text', initialPrompt); processUserTurn(initialPrompt); } }, [initialPrompt, addMessage, processUserTurn]);
    
    const handleUseSuggestion = (prompt: string) => { 
        addMessage('user', 'text', `使用优化后的提示词：“${prompt}”`); 
        // Pass currently selected video ID (potentially updated by AI inference in processUserTurn)
        executeVideoGeneration(prompt, selectedVideoId); 
    };
    
    const handleUseDesignPlan = (plan: {title: string, prompt: string}) => { 
        addMessage('user', 'text', `选择设计灵感：“${plan.title}”`); 
        if (enhancePromptEnabled) { 
            executeEnhancePrompt(plan.prompt); 
        } else { 
            executeVideoGeneration(plan.prompt, selectedVideoId); 
        } 
    };

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
             // Fallback or warning if params are missing (e.g. legacy videos)
             // We could fallback to current UI state, but that might be confusing.
             // For now, let's just log or maybe try with empty override which uses current UI state?
             // Actually, the user expects "same parameters". If we can't guarantee that, maybe safer not to guess.
             // However, to be helpful, let's assume if it's a legacy video, we try to use current state but warn.
             // BUT, the safer bet is to rely on new videos having this param.
             console.warn("Cannot regenerate video: missing generation parameters.");
             alert("此视频缺少生成参数记录，无法直接再次生成。请尝试手动重新配置参数。");
        }
    }, [selectedVideoId, videos, executeVideoGeneration]);

    // Canvas handlers
    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => { if ((e.target as HTMLElement).closest('.video-on-canvas') || (e.target as HTMLElement).closest('.editor-toolbar-wrapper')) return; if (toolMode === 'pan' || e.button === 1) { isPanning.current = true; lastMousePosition.current = { x: e.clientX, y: e.clientY }; } else { setSelectedVideoId(null); } };
    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => { if (!isPanning.current) return; const dx = e.clientX - lastMousePosition.current.x; const dy = e.clientY - lastMousePosition.current.y; setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy })); lastMousePosition.current = { x: e.clientX, y: e.clientY }; };
    const handleCanvasMouseUp = () => { isPanning.current = false; };
    const handleCanvasWheel = (e: React.WheelEvent<HTMLDivElement>) => { if (!canvasRef.current) return; const rect = canvasRef.current.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const scaleAmount = -e.deltaY * 0.001; const newScale = Math.min(Math.max(0.1, 5), transform.scale + scaleAmount); setTransform(prev => ({ scale: newScale, x: mouseX - (mouseX - prev.x) * (newScale / prev.scale), y: mouseY - (mouseY - prev.y) * (newScale / prev.scale) })); };
    const zoom = (direction: 'in' | 'out') => { if (!canvasRef.current) return; const rect = canvasRef.current.getBoundingClientRect(); const centerX = rect.width / 2; const centerY = rect.height / 2; const scaleAmount = direction === 'in' ? 0.1 : -0.1; const newScale = Math.min(Math.max(0.1, 5), transform.scale + scaleAmount); setTransform(prev => ({ scale: newScale, x: centerX - (centerX - prev.x) * (newScale / prev.scale), y: centerY - (centerY - prev.y) * (newScale / prev.scale) })); }

    const handleDownloadVideo = () => { 
        if (!selectedVideoId || !videos[selectedVideoId]) return; 
        const vid = videos[selectedVideoId]; 
        if(vid.status !== 'done') return; 
        const link = document.createElement('a'); 
        link.href = vid.src; 
        link.download = `veo-video-${vid.id}.mp4`;
        link.referrerPolicy = "no-referrer";
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link); 
    };

    const handleCopyFrame = async () => {
        if (!selectedVideoId || !videos[selectedVideoId]) return;
        const vid = videos[selectedVideoId];
        if (vid.status !== 'done') return;
        
        if (videoPlaybackErrors[selectedVideoId]) {
             alert("当前视频预览受限，无法直接复制画面。\n\n请使用“下载视频”功能保存到本地后截图。");
             return;
        }

        const videoEl = document.querySelector(`.video-on-canvas video[src="${vid.src}"]`) as HTMLVideoElement;
        if (!videoEl) {
            console.warn("Video element not found for copy");
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoEl.videoWidth;
            canvas.height = videoEl.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Ensure video data is loaded before drawing
                ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(async (blob) => {
                    if (blob) {
                        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                    }
                }, 'image/png');
            }
        } catch (e) {
            console.error("Failed to copy video frame:", e);
            alert("由于浏览器安全策略 (CORS)，无法直接从跨域视频中复制画面。\n\n建议您先下载视频到本地，然后使用截图工具。");
        }
    };

    const handleDownloadArchiveVideo = (e: React.MouseEvent, video: CanvasVideo, seriesPrompt: string) => {
        e.stopPropagation();
        if (video.status !== 'done') return;
        const link = document.createElement('a');
        link.href = video.src;
        const safePrompt = seriesPrompt.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50);
        const videoIdSuffix = video.id.split('-').pop();
        link.download = `aidea-video-${safePrompt}-${videoIdSuffix}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Archive logic (simplified for videos)
    const videoSeries = useMemo(() => {
        const allVideos = Object.values(videos) as CanvasVideo[];
        if (allVideos.length === 0) return [];
        return allVideos.map(v => ({
            id: v.id,
            creationDate: parseInt(v.id.split('-')[1]) || Date.now(),
            initialPrompt: v.prompt,
            videos: [v]
        })).sort((a, b) => b.creationDate - a.creationDate);
    }, [videos]);

    useEffect(() => {
        if (isArchiveOpen) {
            const summarize = async () => {
                const missing = videoSeries.filter(s => !archiveSummaries[s.id]);
                if (missing.length > 0) {
                     const newSums: Record<string, string> = {};
                     await Promise.all(missing.map(async (s) => {
                         try { newSums[s.id] = await summarizePrompt(s.initialPrompt); } catch (e) { newSums[s.id] = s.initialPrompt.slice(0, 30); }
                     }));
                     setArchiveSummaries(prev => ({ ...prev, ...newSums }));
                }
            };
            summarize();
        }
    }, [isArchiveOpen, videoSeries, archiveSummaries]);


    return (
        <div className="h-screen w-screen flex font-sans bg-white text-gray-900">
             <div className="w-[35%] min-w-[400px] h-full flex flex-col border-r border-gray-200 bg-white z-10 relative">
                <Header onReset={onReset} onOpenArchive={() => setIsArchiveOpen(true)} />
                <main className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col min-h-0">
                     {messages.map(msg => {
                         if (msg.role === 'user') {
                             return <div key={msg.id} className="w-full animate-fade-in-up self-end flex justify-end"><p className="bg-purple-500 text-white p-3 rounded-lg max-w-lg shadow-sm">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}</p></div>;
                         } else {
                             if (msg.type === 'generated-video') {
                                 const v = videos[msg.content.videoId];
                                 return v ? (
                                    <div key={msg.id} className="w-full animate-fade-in-up self-start flex items-start space-x-3">
                                        <AIAvatarIcon className="flex-shrink-0 mt-1" />
                                        <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm w-full max-w-sm cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all" onClick={() => setSelectedVideoId(v.id)}>
                                            <div className="flex items-center space-x-2 mb-2">
                                                <VideoCameraIcon className="w-5 h-5 text-gray-500" />
                                                <span className="text-sm font-semibold text-gray-700">Video Generated</span>
                                            </div>
                                            <p className="text-xs text-gray-600 mb-3 leading-relaxed">{v.prompt}</p>
                                            
                                            <div className="rounded-md overflow-hidden bg-black w-full shadow-sm">
                                                {v.status === 'done' ? (
                                                     videoPlaybackErrors[v.id] ? (
                                                         <div className="flex flex-col items-center justify-center h-[200px] bg-slate-900 relative group overflow-hidden" onClick={() => window.open(v.src, '_blank', 'noopener,noreferrer')}>
                                                             {/* Smart Mock Player UI */}
                                                             <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-slate-900 to-black z-0"></div>
                                                             <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}></div>
                                                             
                                                             <div className="relative z-10 w-12 h-12 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center mb-2 border border-white/10 shadow-xl group-hover:scale-110 group-hover:bg-white/10 transition-all duration-300 ease-out">
                                                                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-inner">
                                                                     <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-900 ml-0.5">
                                                                         <path d="M8 5v14l11-7z" />
                                                                     </svg>
                                                                  </div>
                                                             </div>
                                                             
                                                             <div className="relative z-10 text-center px-4">
                                                                 <p className="text-white font-bold text-xs tracking-wide drop-shadow-lg">视频已就绪</p>
                                                                 <p className="text-white/50 text-[10px] mt-1 font-medium group-hover:text-white/70 transition-colors">
                                                                     点击在新窗口播放
                                                                 </p>
                                                             </div>
                                                         </div>
                                                     ) : (
                                                     <video 
                                                        src={v.src} 
                                                        key={v.src} 
                                                        className="w-full h-auto object-contain max-h-[300px]" 
                                                        controls 
                                                        playsInline
                                                        preload="auto"
                                                        crossOrigin={v.src.startsWith('blob:') ? "anonymous" : undefined}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedVideoId(v.id);
                                                        }}
                                                        onError={() => setVideoPlaybackErrors(prev => ({ ...prev, [v.id]: true }))}
                                                     />
                                                     )
                                                ) : v.status === 'error' ? (
                                                    <div className="flex items-center justify-center h-32 text-red-500 text-xs p-2 text-center bg-red-50">
                                                        生成失败: {v.errorMsg}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center h-32 bg-gray-100 text-gray-400 text-xs">
                                                        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                                                        生成中...
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                 ) : null;
                             }
                             if (msg.type === 'text') {
                                 return <div key={msg.id} className="w-full animate-fade-in-up self-start flex items-start space-x-3"><AIAvatarIcon className="flex-shrink-0 mt-1" /><div className="bg-gradient-to-br from-gray-100 to-gray-200 p-3 rounded-lg text-gray-800 max-w-lg shadow-sm"><p className="whitespace-pre-wrap">{msg.content}</p></div></div>;
                             }
                             if (msg.type === 'tool-usage') {
                                 return <div key={msg.id} className="w-full animate-fade-in-up self-start"><div className="ml-11 bg-purple-50 border-l-4 border-purple-400 p-2 rounded-r-lg max-w-lg text-sm text-purple-700 flex items-center"><ToolIcon className="w-4 h-4 mr-2" /><span>使用工具 | <b>{msg.content.text}</b></span></div></div>;
                             }
                             if (msg.type === 'prompt-options') {
                                 const options = msg.content as EnhancedPrompt[];
                                 return (
                                     <div key={msg.id} className="w-full animate-fade-in-up self-start flex items-start space-x-3">
                                        <AIAvatarIcon className="flex-shrink-0 mt-1" />
                                        <div className="w-full max-w-lg space-y-2">
                                            {options.map((opt, i) => (
                                                <button key={i} onClick={() => handleUseSuggestion(opt.fullPrompt)} className="w-full text-left p-3 bg-white rounded-md border border-gray-200 hover:border-purple-400 hover:shadow-sm">
                                                    <h4 className="font-bold text-purple-600 text-sm">{opt.title}</h4>
                                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{opt.description}</p>
                                                </button>
                                            ))}
                                        </div>
                                     </div>
                                 );
                             }
                             if (msg.type === 'design-plans') {
                                 const plans = msg.content;
                                 return (
                                     <div key={msg.id} className="w-full animate-fade-in-up self-start flex items-start space-x-3">
                                         <AIAvatarIcon className="flex-shrink-0 mt-1" />
                                         <div className="grid grid-cols-1 gap-3 max-w-lg w-full">
                                             {plans.map((plan: any, i: number) => (
                                                 <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                                                     <img src={plan.imageSrc} alt={plan.title} className="h-32 w-full object-cover" />
                                                     <div className="p-3">
                                                         <h4 className="text-sm font-bold text-gray-800">{plan.title}</h4>
                                                         <p className="text-xs text-gray-600 mb-2 line-clamp-2">{plan.description}</p>
                                                         <button onClick={() => handleUseDesignPlan(plan)} className="w-full py-1 bg-purple-50 text-purple-600 text-xs font-bold rounded hover:bg-purple-100">选择此风格</button>
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                     </div>
                                 );
                             }
                         }
                         return null;
                     })}
                     {isLoading && <div className="w-full animate-fade-in-up self-start flex items-start space-x-3"><AIAvatarIcon isThinking={true} /><div className="bg-gray-100 p-3 rounded-lg text-sm text-gray-600">AI 正在思考中...</div></div>}
                     <div ref={messagesEndRef} />
                </main>
                <footer className="p-4 border-t border-gray-200 flex-shrink-0 bg-white">
                    <div className="flex items-center space-x-2 mb-3">
                        <AIToggleButton icon={<SparklesIcon className="w-4 h-4"/>} label="提示词" checked={enhancePromptEnabled} onChange={() => setEnhancePromptEnabled(p => !p)} />
                        <AIToggleButton icon={<LightbulbIcon className="w-4 h-4"/>} label="灵感" checked={designInspirationEnabled} onChange={() => setDesignInspirationEnabled(p => !p)} />
                        
                        <div className="w-px h-5 bg-gray-200 mx-2" />
                        <ModeIndicator fileCount={uploadedFiles.length} />

                        <div className="flex-grow" />
                        <ModelSelector value={selectedModel} onChange={setSelectedModel} disabled={isLoading} />
                        <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} disabled={isLoading} />
                    </div>

                    {/* New Preview Section */}
                    {uploadedFiles.length > 0 && (
                        <div className="flex gap-3 mb-3 overflow-x-auto pb-1">
                            {uploadedFiles.map((file, i) => (
                                <div key={i} className="relative group w-20 h-20 flex-shrink-0 rounded-lg border border-gray-200 overflow-hidden shadow-sm bg-gray-50 animate-fade-in-up">
                                    <img 
                                        src={URL.createObjectURL(file)} 
                                        className="w-full h-full object-cover" 
                                        alt={`upload preview ${i}`} 
                                    />
                                    <button 
                                        onClick={() => handleRemoveFile(i)} 
                                        className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center transition-colors backdrop-blur-sm"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                        </svg>
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[9px] px-1.5 py-0.5 truncate backdrop-blur-sm">
                                        {i === 0 ? (uploadedFiles.length === 2 ? '首帧' : '参考图') : '尾帧'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                     <form onSubmit={handleSubmit} className="flex items-end gap-2">
                        <textarea ref={userInputRef} value={userInput} onChange={e => setUserInput(e.target.value)} onPaste={handlePaste} onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey){e.preventDefault(); handleSubmit(e)}}} placeholder={isLoading ? "AI正在工作中..." : (uploadedFiles.length > 0 ? "描述视频内容..." : "输入网址 URL 或创作指令")} className="flex-1 p-3 border rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:bg-gray-100 resize-none overflow-hidden" rows={1} disabled={isLoading} />
                        <div className="flex items-center">
                            <label htmlFor="vid-file-upload" className={`p-2 rounded-full hover:bg-gray-200 cursor-pointer ${uploadedFiles.length >= 2 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <PaperClipIcon className="w-5 h-5 text-gray-500" />
                                <input id="vid-file-upload" type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" disabled={uploadedFiles.length >= 2 || isLoading} />
                            </label>
                            <button type="submit" disabled={isLoading || (!userInput.trim() && uploadedFiles.length === 0)} className="ml-2 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg></button>
                        </div>
                    </form>
                </footer>

                {isArchiveOpen && (
                    <div className="absolute inset-0 bg-white z-50 flex flex-col animate-fade-in-up duration-300">
                         <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-shrink-0"><h2 className="font-bold text-lg text-gray-800 flex items-center"><ArchiveBoxIcon className="w-5 h-5 mr-2 text-purple-600" />创作档案</h2><button onClick={() => setIsArchiveOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button></div>
                         <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50">
                             {videoSeries.length === 0 ? <p className="text-center text-gray-500 mt-10">暂无视频记录</p> : videoSeries.map(s => (
                                 <div key={s.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                     <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center"><h3 className="font-semibold text-sm text-gray-800 truncate flex-1 mr-2">{archiveSummaries[s.id] || '...'}</h3><span className="text-[10px] text-gray-400 flex-shrink-0">{new Date(s.creationDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>
                                     <div className="p-3 grid grid-cols-2 gap-2">
                                         {s.videos.map(v => (
                                             <div key={v.id} className="relative group aspect-video rounded-lg overflow-hidden bg-gray-900 cursor-pointer border border-gray-200" onClick={() => { setSelectedVideoId(v.id); setIsArchiveOpen(false); }}>
                                                 {v.status === 'done' ? (
                                                    <>
                                                        <video src={v.src} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                             <button onClick={(e) => handleDownloadArchiveVideo(e, v, s.initialPrompt)} className="p-1.5 bg-white/90 rounded-full text-gray-700 hover:text-purple-600 shadow-sm transform scale-90 hover:scale-100 transition-all" title="下载视频">
                                                                <ArrowDownTrayIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </>
                                                 ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-white text-xs">{v.status === 'error' ? 'Error' : '...'}</div>
                                                 )}
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             ))}
                         </div>
                    </div>
                )}
             </div>

             <div className="flex-1 relative bg-slate-50 overflow-hidden z-0" onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp} onWheel={handleCanvasWheel}>
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px', transform: `translate(${transform.x % 20}px, ${transform.y % 20}px)` }}></div>
                <div ref={canvasRef} className="absolute top-0 left-0 w-full h-full origin-top-left transition-transform duration-75 ease-linear" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}>
                    {(Object.values(videos) as CanvasVideo[]).map(v => (
                        <div key={v.id} className={`video-on-canvas absolute group transition-shadow duration-200 ${selectedVideoId === v.id ? 'z-30 ring-4 ring-purple-500 shadow-2xl' : 'z-0 shadow-lg hover:shadow-xl'}`} style={{ left: v.x, top: v.y, width: v.width, height: v.height }} onClick={(e) => { e.stopPropagation(); setSelectedVideoId(v.id); }}>
                             {v.status === 'generating' ? (
                                 <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-white p-4 text-center rounded-sm">
                                     <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                                     <p className="text-xs font-medium animate-pulse">正在生成视频...</p>
                                     <p className="text-[10px] text-gray-400 mt-1">可能需要 1-2 分钟</p>
                                 </div>
                             ) : v.status === 'error' ? (
                                 <div className="w-full h-full bg-red-50 flex flex-col items-center justify-center text-red-600 p-4 text-center border border-red-200 rounded-sm">
                                     <span className="text-xl mb-2">⚠️</span>
                                     <p className="text-xs font-bold">生成失败</p>
                                     <p className="text-[10px] mt-1">{v.errorMsg}</p>
                                 </div>
                             ) : (
                                 <>
                                     {videoPlaybackErrors[v.id] ? (
                                        <div 
                                            className="w-full h-full bg-slate-900 flex flex-col items-center justify-center cursor-pointer group relative overflow-hidden rounded-sm border border-slate-800"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(v.src, '_blank', 'noopener,noreferrer');
                                            }}
                                            title="点击在新窗口播放视频"
                                        >
                                            {/* Abstract Background with Noise */}
                                            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-slate-900 to-black z-0"></div>
                                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}></div>
                                            
                                            {/* Play Button Container */}
                                            <div className="relative z-10 w-14 h-14 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center mb-3 border border-white/10 shadow-2xl group-hover:scale-110 group-hover:bg-white/10 transition-all duration-300 ease-out">
                                                 <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-inner">
                                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-slate-900 ml-0.5">
                                                        <path d="M8 5v14l11-7z" />
                                                    </svg>
                                                 </div>
                                            </div>
                                            
                                            <div className="relative z-10 text-center px-4">
                                                <p className="text-white font-bold text-sm tracking-wide drop-shadow-lg">视频已就绪</p>
                                                <p className="text-white/50 text-[10px] mt-1.5 font-medium group-hover:text-white/70 transition-colors">
                                                    点击在新窗口播放
                                                </p>
                                            </div>
                                            
                                            {/* Hover Glow */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                                        </div>
                                     ) : (
                                         <video 
                                            src={v.src} 
                                            key={v.src} 
                                            className="w-full h-full object-cover rounded-sm" 
                                            controls 
                                            playsInline 
                                            loop
                                            preload="auto"
                                            crossOrigin={v.src.startsWith('blob:') ? "anonymous" : undefined}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedVideoId(v.id);
                                            }}
                                            onError={() => setVideoPlaybackErrors(prev => ({ ...prev, [v.id]: true }))}
                                         />
                                     )}
                                     {selectedVideoId === v.id && !videoPlaybackErrors[v.id] && (
                                         <div className="editor-toolbar-wrapper absolute z-20" style={{ left: '50%', top: 0, transformOrigin: 'bottom center', transform: `translate(-50%, -100%) translateY(-${12 / transform.scale}px) scale(${1 / transform.scale})` }}>
                                             <EditorToolbar onDownload={handleDownloadVideo} onCopyFrame={handleCopyFrame} onRegenerate={handleRegenerate} isGenerating={isLoading} />
                                         </div>
                                     )}
                                 </>
                             )}
                        </div>
                    ))}
                </div>
                <ZoomControls scale={transform.scale} onZoomIn={() => zoom('in')} onZoomOut={() => zoom('out')} />
                <BottomToolbar toolMode={toolMode} setToolMode={setToolMode} />
            </div>
        </div>
    );
};

export default VideoGenerationPage;