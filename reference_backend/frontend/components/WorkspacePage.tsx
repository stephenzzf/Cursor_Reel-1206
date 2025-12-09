import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Step, MessageType, ChatMessage, Competitor, SeoDiagnosisReport, SolutionBoard, SolutionOption, ContentBrief, PreflightReport, BrandProfile, ProjectConfig, CompetitorAnalysisReport, ArticlePreview, RagArticle, ArchivedArticle } from '../types';
import { 
    getSeoDiagnosis, getCompetitors, runCompetitorAnalysis, getSolutionBoard, getPrefilledBrief, 
    runWebResearch, generateStrategicOutline, writeArticleFromOutline, polishArticleReadability, generateSeoMetadata,
    runPreflightCheck, runAutoFix, generateAndEmbedImages, getAgentAction, getNewContentIdea
} from '../services/seoService';
import {
    fallbackSeoReport, fallbackCompetitors, fallbackCompetitorAnalysisReport, fallbackSolutionBoard, fallbackContentBrief, fallbackArticle, fallbackPreflightReport
} from '../services/geminiService';
import { brandProfileService } from '../services/brandProfileService';
import BrandProfileModal from './BrandProfileModal';

interface WorkspacePageProps {
  url: string;
  onReset: () => void;
}

const stepsConfig = [
  { id: Step.SEO_DIAGNOSIS, label: 'SEO Diagnosis', shortLabel: '诊断' },
  { id: Step.COMPETITOR_CONFIRMATION, label: 'Competitor Confirmation', shortLabel: '竞对' },
  { id: Step.COMPETITOR_ANALYSIS, label: 'Competitor Analysis', shortLabel: '分析' },
  { id: Step.ANALYSIS_AND_SOLUTION, label: 'Analysis & Solution', shortLabel: '策略' },
  { id: Step.CONTENT_BRIEF, label: 'Content Brief', shortLabel: '需求' },
  { id: Step.EDIT_AND_PREFLIGHT, label: 'Editing & Pre-flight', shortLabel: '编辑' },
  { id: Step.PUBLISH, label: 'Publish', shortLabel: '发布' },
];

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return String(error);
}

const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- UNIFIED MARKDOWN TO HTML CONVERTER ---
const convertMarkdownToHtml = (text: string): string => {
    if (!text) return '';
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Block elements
    html = html.replace(/^(#+) (.*$)/gim, (match, hashes, content) => {
        const level = hashes.length;
        const id = content.trim().toLowerCase().replace(/\s+/g, '-');
        return `<h${level} id="${id}">${content}</h${level}>`;
    });
    
    // Use inline styles for portability in downloaded file
    html = html.replace(/!\[(.*?)\]\((data:image\/.*?)\)/g, '<img alt="$1" src="$2" style="margin: 1rem auto; border-radius: 0.5rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); max-width: 100%; height: auto; display: block;"/>');

    html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul style="list-style-type: disc; list-style-position: inside; margin: 1rem 0; padding-left: 1rem;">$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // Inline elements
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Paragraphs
    html = html.split(/\n\n+/).map(p => {
        if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<img')) {
            return p;
        }
        return p ? `<p>${p.replace(/\n/g, '<br/>')}</p>` : '';
    }).join('');

    return html;
};


// --- NEW AGENTIC UI ICONS ---
const AIAvatarIcon: React.FC<{ className?: string, isThinking?: boolean }> = ({ className, isThinking }) => {
    // New static avatar style for completed agent messages, as shown in the screenshot.
    if (!isThinking) {
        return (
            <div className={`relative w-8 h-8 rounded-lg bg-white flex items-center justify-center border-2 border-blue-500 ${className}`}>
                <span className="font-bold text-lg text-blue-500 leading-none">M</span>
            </div>
        );
    }
    
    // Animated "thinking" avatar, updated with a clear 'M'.
    return (
        <div className={`relative w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shadow-sm ${className}`}>
            <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(50,50)">
                    <g>
                        <path d="M0,-45 a45,45 0 1,0 0,90 a45,45 0 1,0 0,-90" stroke="url(#grad-ring)" strokeWidth="4" strokeLinecap="round" className="animate-ring-spin origin-center" style={{ animationDuration: '8s' }} opacity="0.8" strokeDasharray="15 30"/>
                        <path d="M-35,0 a35,35 0 1,0 70,0 a35,35 0 1,0 -70,0" stroke="url(#grad-ring)" strokeWidth="3" strokeLinecap="round" className="animate-ring-spin-reverse origin-center" style={{ animationDuration: '10s' }} opacity="0.5" strokeDasharray="10 20"/>
                    </g>
                    <g className={'animate-core-pulse'}>
                        <text
                            x="0"
                            y="4"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontFamily="system-ui, sans-serif"
                            fontSize="50"
                            fontWeight="bold"
                            fill="url(#grad-bars)"
                        >
                            M
                        </text>
                    </g>
                </g>
                <defs>
                     <linearGradient id="grad-bars" x1="50%" y1="0%" x2="50%" y2="100%">
                       <stop offset="0%" stopColor="#818CF8" />
                       <stop offset="100%" stopColor="#6366F1" />
                    </linearGradient>
                     <linearGradient id="grad-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(99, 102, 241, 0.7)"/>
                        <stop offset="100%" stopColor="rgba(129, 140, 248, 0.1)"/>
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
};


const ToolIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h12A2.25 2.25 0 0 0 20.25 14.25V3M3.75 3v-1.5A2.25 2.25 0 0 1 6 0h12A2.25 2.25 0 0 1 20.25 1.5v1.5M3.75 3h16.5M16.5 6.75h.008v.008H16.5V6.75Zm-2.25 0h.008v.008H14.25V6.75Zm-2.25 0h.008v.008H12V6.75Zm-2.25 0h.008v.008H9.75V6.75Zm-2.25 0h.008v.008H7.5V6.75Zm-2.25 0h.008v.008H5.25V6.75Z" />
    </svg>
);


const LightbulbIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-11.25H10.5a6.01 6.01 0 0 0 1.5 11.25v.003zM7.5 18h9a2.25 2.25 0 0 1 2.25 2.25v0a2.25 2.25 0 0 1-2.25 2.25h-9A2.25 2.25 0 0 1 5.25 22.5v0A2.25 2.25 0 0 1 7.5 18z" />
    </svg>
);

const PencilIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
);

const ArchiveBoxIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
);

const TagIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
    </svg>
);


// Basic markdown to HTML renderer for previewing
const MarkdownPreview: React.FC<{ markdown: string }> = ({ markdown }) => {
    return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(markdown) }} />;
};


const Header: React.FC<{ url: string; currentStep: Step; onOpenProfile: () => void; onOpenArchive: () => void; }> = ({ url, currentStep, onOpenProfile, onOpenArchive }) => (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div>
            <h1 className="text-lg font-semibold text-gray-800">SEO创作</h1>
            <p className="text-sm text-gray-500">{url}</p>
        </div>
         <div className="flex-1 flex justify-center">
            <Stepper currentStep={currentStep} />
        </div>
        <div className="flex items-center space-x-2">
            <button onClick={onOpenArchive} className="flex items-center space-x-2 text-sm bg-white text-purple-700 border border-purple-500 font-semibold py-2 px-4 rounded-lg hover:bg-purple-50 transition-colors">
                <ArchiveBoxIcon className="w-4 h-4" />
                <span>创作档案</span>
            </button>
            <button onClick={onOpenProfile} className="flex items-center space-x-2 text-sm bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-purple-600 transition-colors">
                <TagIcon className="w-4 h-4" />
                <span>品牌档案</span>
            </button>
        </div>
    </div>
);

const Stepper: React.FC<{ currentStep: number }> = ({ currentStep }) => (
    <div className="flex items-start">
        {stepsConfig.map((step, index) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            
            const stepClass = isCompleted ? 'bg-blue-500 border-blue-500 text-white' :
                              isCurrent ? 'bg-blue-500 border-blue-500 text-white' :
                              'bg-white border-gray-300 text-gray-400';
            
            const lineClass = isCompleted ? 'bg-blue-500' : 'bg-gray-300';
            const labelClass = isCompleted || isCurrent ? 'text-blue-600' : 'text-gray-400';

            return (
                <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center text-center w-10">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${stepClass}`}>
                            {isCompleted ? '✓' : step.id}
                        </div>
                        <p className={`mt-1 text-xs font-medium transition-colors duration-300 ${labelClass}`}>
                            {step.shortLabel}
                        </p>
                    </div>
                    {index < stepsConfig.length - 1 && (
                        <div className={`w-6 h-0.5 mx-1 mt-4 transition-all duration-300 ${lineClass}`} />
                    )}
                </React.Fragment>
            );
        })}
    </div>
);


const CompetitorConfirmationCard: React.FC<{
    messageId: string;
    competitors: Competitor[];
    onConfirm: (selected: string[], messageId: string) => void;
    onAdd: (newCompetitor: {url: string, name?: string}) => void;
    isDeactivated: boolean;
}> = ({ messageId, competitors, onConfirm, onAdd, isDeactivated }) => {
    const [selected, setSelected] = useState<string[]>([]);
    const [newCompUrl, setNewCompUrl] = useState('');
    const [newCompName, setNewCompName] = useState('');
    const [isUrlValid, setIsUrlValid] = useState(true);

    const toggleSelection = (id: string) => {
        setSelected(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    };
    
    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const url = e.target.value;
        setNewCompUrl(url);
        // Basic URL validation regex
        const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
        setIsUrlValid(url === '' || urlRegex.test(url));
    };

    const handleAddCompetitor = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (newCompUrl && isUrlValid) {
            onAdd({ url: newCompUrl, name: newCompName || undefined });
            setNewCompUrl('');
            setNewCompName('');
        }
    };

    const isSelectionDisabled = selected.length >= 3;
    const isConfirmDisabled = selected.length < 1 || selected.length > 3;

    return (
        <div className={`bg-white border border-gray-200 rounded-lg p-4 transition-opacity ${isDeactivated ? 'opacity-60' : ''}`}>
            <h3 className="font-semibold text-gray-800">第1步：确认竞对</h3>
            <p className="text-sm text-gray-500 mb-4">AI已为您推荐以下竞对，请勾选 1-3 个最相关的竞对进行下一步分析。</p>
            <div className="space-y-3">
                {competitors.map(comp => (
                    <div key={comp.id} className="border border-gray-200 rounded-lg p-3 flex items-center">
                        <input 
                            type="checkbox" 
                            checked={selected.includes(comp.id)} 
                            onChange={() => toggleSelection(comp.id)} 
                            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                            disabled={isDeactivated || (isSelectionDisabled && !selected.includes(comp.id))}
                        />
                        <div className="ml-3 flex-1 min-w-0">
                            <p className="font-medium text-gray-900 flex items-center truncate">
                                <span className="truncate">{comp.name || comp.url}</span>
                                {comp.isManual && <span className="ml-2 flex-shrink-0 text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full">手动添加</span>}
                            </p>
                            <p className="text-sm text-gray-500 truncate">{comp.reasonText}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Manual Add Section */}
            <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="font-semibold text-gray-700 text-sm mb-2">手动添加竞对</h4>
                <div className="space-y-3 sm:flex sm:space-y-0 sm:space-x-3">
                    <div className="flex-1">
                        <label htmlFor="comp-url" className="sr-only">Competitor URL</label>
                        <input
                            id="comp-url"
                            type="text"
                            value={newCompUrl}
                            onChange={handleUrlChange}
                            placeholder="https://example.com (必填)"
                            className={`w-full p-2 text-sm border rounded-md focus:outline-none focus:ring-2 ${!isUrlValid && newCompUrl ? 'border-red-500 ring-red-200' : 'border-gray-300 focus:ring-blue-400'}`}
                            disabled={isDeactivated}
                        />
                    </div>
                    <div className="flex-1">
                         <label htmlFor="comp-name" className="sr-only">Brand Name</label>
                         <input
                            id="comp-name"
                            type="text"
                            value={newCompName}
                            onChange={(e) => setNewCompName(e.target.value)}
                            placeholder="品牌名 (选填)"
                            className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                            disabled={isDeactivated}
                        />
                    </div>
                    <button 
                        onClick={handleAddCompetitor} 
                        disabled={!newCompUrl || !isUrlValid || isDeactivated}
                        className="px-4 py-2 text-sm bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        添加
                    </button>
                </div>
                {!isUrlValid && newCompUrl && <p className="text-xs text-red-600 mt-1">请输入有效的URL格式。</p>}
            </div>

            <button onClick={() => onConfirm(selected, messageId)} disabled={isConfirmDisabled || isDeactivated} className="w-full mt-4 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
                确认列表，开始分析
            </button>
        </div>
    );
};

const InsightCard: React.FC<{ title: string, content: string, icon: React.ReactNode, color: string }> = ({ title, content, icon, color }) => (
    <div className={`my-3 p-3 bg-${color}-50 border-l-4 border-${color}-400 rounded-r-lg`}>
        <h4 className={`font-semibold text-${color}-800 text-sm flex items-center`}>
            <span className="w-5 h-5 mr-2">{icon}</span>
            {title}
        </h4>
        <p className={`text-sm text-${color}-700 mt-1`}>{content}</p>
    </div>
);


const CompetitorAnalysisCard: React.FC<{
    messageId: string;
    report: CompetitorAnalysisReport;
    onViewArticle: (article: ArticlePreview) => void;
    onProceed: (messageId: string) => void;
    isDeactivated: boolean;
}> = ({ messageId, report, onViewArticle, onProceed, isDeactivated }) => {
    const getScoreColor = (score: number) => {
        if (score >= 85) return 'text-green-600';
        if (score >= 60) return 'text-yellow-500';
        return 'text-red-500';
    };

    return (
        <div className={`bg-white border border-gray-200 rounded-lg p-4 transition-opacity ${isDeactivated ? 'opacity-60' : ''}`}>
            <h3 className="font-semibold text-gray-800">第2步：竞对分析与洞察</h3>

            <InsightCard 
                title="市场内容趋势"
                content={report.competitiveLandscape.overallTrend}
                icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" /></svg>}
                color="blue"
            />
             <InsightCard 
                title="您的内容劣势"
                content={report.competitiveLandscape.yourDisadvantage}
                icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>}
                color="yellow"
            />
             <InsightCard 
                title="策略突破口"
                content={report.competitiveLandscape.strategicOpportunity}
                icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>}
                color="green"
            />

            {report.ragArticles && report.ragArticles.length > 0 && (
                <div className="my-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <h4 className="font-semibold text-indigo-800 text-sm flex items-center mb-2">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>
                        内部知识库精选
                    </h4>
                    <div className="space-y-3">
                        {report.ragArticles.map((article, index) => (
                            <div key={`rag-${index}`} className="pt-2 border-t border-indigo-100 first:border-t-0 first:pt-0">
                                <button onClick={() => onViewArticle({ title: article.title, url: article.url })} disabled={isDeactivated} className="text-left w-full group disabled:pointer-events-none">
                                    <h5 className="font-semibold text-blue-600 group-hover:underline text-sm">{article.title}</h5>
                                </button>
                                <p className="text-xs text-gray-600 mt-1">{article.reason}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-3 mt-4">
                {report.competitors.map(comp => (
                    <div key={comp.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                            <p className="font-medium text-gray-900 flex-1">{comp.url}</p>
                            <div className="text-right ml-2">
                                {typeof comp.contentSeoScore === 'number' ? (
                                    <p className={`font-bold text-lg ${getScoreColor(comp.contentSeoScore)}`}>{comp.contentSeoScore}</p>
                                ) : (
                                    <p className="font-bold text-lg text-gray-400">--</p>
                                )}
                                <p className="text-xs text-gray-500">内容评分</p>
                            </div>
                        </div>
                         {comp.topArticle ? (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                                <p className="text-xs text-gray-500 mb-1">优质文章推荐</p>
                                <button onClick={() => onViewArticle(comp.topArticle!)} disabled={isDeactivated} className="text-left w-full group disabled:pointer-events-none">
                                    <h5 className="font-semibold text-blue-600 group-hover:underline text-sm">{comp.topArticle.title}</h5>
                                </button>
                                <p className="text-xs text-gray-600 mt-1">{comp.topArticle.reason}</p>
                            </div>
                        ) : (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                                <p className="text-xs text-gray-500">优质文章未发现</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <button onClick={() => onProceed(messageId)} disabled={isDeactivated} className="w-full mt-4 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
                继续生成策略方案
            </button>
        </div>
    );
};

const SolutionBoardCard: React.FC<{ 
    messageId: string;
    board: SolutionBoard; 
    onSelect: (solution: SolutionOption, messageId: string) => void;
    isDeactivated: boolean;
}> = ({ messageId, board, onSelect, isDeactivated }) => {
    return (
        <div className={`bg-white border border-gray-200 rounded-lg p-4 transition-opacity ${isDeactivated ? 'opacity-60' : ''}`}>
            <h3 className="font-semibold text-gray-800">第3步：方案板</h3>
            <p className="text-sm text-gray-500 mb-4">AI已为您生成以下策略方向，请选择一个：</p>
            <div className="space-y-4">
                {board.map(option => (
                    <div key={option.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all duration-200">
                        <h4 className="font-bold text-gray-900 text-md">{option.strategyName}</h4>
                        <p className="text-xs text-gray-500 mt-1"><span className="font-semibold">SEO 目标:</span> {option.seoGoal}</p>
                        
                        <div className="mt-3 text-sm space-y-3">
                            <div>
                                <h5 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">核心理念</h5>
                                <p className="text-gray-600 text-sm mt-1">{option.coreConcept}</p>
                            </div>
                            <div>
                                <h5 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">内容示例</h5>
                                <ul className="list-disc list-inside text-gray-600 mt-1 pl-2 space-y-1">
                                    {option.contentExamples.map((ex, i) => <li key={i}>{ex}</li>)}
                                </ul>
                            </div>
                             <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-lg">
                                <h5 className="font-semibold text-yellow-800 text-xs uppercase tracking-wider flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                    策略理由
                                </h5>
                                <p className="text-yellow-700 text-sm mt-1">{option.strategicReason}</p>
                            </div>
                        </div>

                        <button onClick={() => onSelect(option, messageId)} disabled={isDeactivated} className="w-full mt-4 bg-blue-100 text-blue-700 font-semibold py-2 rounded-lg hover:bg-blue-200 transition-colors text-sm disabled:bg-gray-200 disabled:cursor-not-allowed">
                            选择此策略
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ContentBriefCard: React.FC<{ 
    messageId: string;
    brief: ContentBrief; 
    onConfirm: (brief: ContentBrief, messageId: string) => void;
    isDeactivated: boolean;
}> = ({ messageId, brief, onConfirm, isDeactivated }) => {
    const [localBrief, setLocalBrief] = useState(brief);
    
    const handleSubmit = () => {
        onConfirm(localBrief, messageId);
    };

    return (
        <div className={`bg-white border border-gray-200 rounded-lg p-4 transition-opacity ${isDeactivated ? 'opacity-60' : ''}`}>
            <h3 className="font-semibold text-gray-800">第4步：SEO创作内容需求</h3>
            <p className="text-sm text-gray-500 mb-4">AI已为您生成以下草案，请审核、修改并确认。</p>
             <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto p-1">
                <div>
                    <label className="font-medium text-gray-700">建议标题</label>
                    <input
                        type="text"
                        value={localBrief.titleSuggestion}
                        onChange={(e) => setLocalBrief({...localBrief, titleSuggestion: e.target.value})}
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
                        disabled={isDeactivated}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="font-medium text-gray-700">Target Region</label>
                        <select 
                            value={localBrief.targetRegion} 
                            onChange={e => setLocalBrief({...localBrief, targetRegion: e.target.value})}
                            className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
                            disabled={isDeactivated}
                        >
                            <option value="United States">United States</option>
                            <option value="United Kingdom">United Kingdom</option>
                            <option value="Canada">Canada</option>
                            <option value="Australia">Australia</option>
                            <option value="Global">Global</option>
                        </select>
                    </div>
                    <div>
                        <label className="font-medium text-gray-700">Target Language</label>
                         <select 
                            value={localBrief.targetLanguage} 
                            onChange={e => setLocalBrief({...localBrief, targetLanguage: e.target.value})}
                            className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
                            disabled={isDeactivated}
                        >
                            <option value="English">English</option>
                            <option value="Spanish">Spanish</option>
                            <option value="German">German</option>
                            <option value="French">French</option>
                        </select>
                    </div>
                </div>
                 <div>
                    <label className="font-medium text-gray-700">核心关键词</label>
                    <input 
                        type="text" 
                        placeholder="请填写核心关键词"
                        value={localBrief.mainKeyword}
                        onChange={(e) => setLocalBrief({...localBrief, mainKeyword: e.target.value})}
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
                        disabled={isDeactivated}
                    />
                </div>
                <div>
                    <label className="font-medium text-gray-700">次要关键词 (用逗号分隔)</label>
                    <input 
                        type="text" 
                        placeholder="请填写次要关键词"
                        value={localBrief.secondaryKeywords.join(', ')}
                        onChange={(e) => setLocalBrief({...localBrief, secondaryKeywords: e.target.value.split(',').map(k => k.trim())})}
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
                        disabled={isDeactivated}
                    />
                </div>
                 <div>
                    <label className="font-medium text-gray-700">主题摘要</label>
                    <textarea
                        value={localBrief.topicSummary}
                        onChange={(e) => setLocalBrief({...localBrief, topicSummary: e.target.value})}
                        rows={3}
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
                        disabled={isDeactivated}
                    />
                </div>
                 <div>
                    <label className="font-medium text-gray-700">建议大纲 (每行一个要点)</label>
                    <textarea
                        value={localBrief.suggestedOutline.join('\n')}
                        onChange={(e) => setLocalBrief({...localBrief, suggestedOutline: e.target.value.split('\n')})}
                        rows={5}
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
                        disabled={isDeactivated}
                    />
                </div>
                 <div>
                    <label className="font-medium text-gray-700">预估字数</label>
                    <input
                        type="number"
                        value={localBrief.estimatedWordcount}
                        onChange={(e) => setLocalBrief({...localBrief, estimatedWordcount: parseInt(e.target.value, 10) || 0})}
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
                        disabled={isDeactivated}
                    />
                </div>
                 <div>
                    <label className="font-medium text-gray-700">AI 写作建议</label>
                    <ul className="list-disc list-inside text-gray-600 mt-1 space-y-1 bg-gray-50 p-2 rounded-md">
                        {localBrief.aiRecommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                    </ul>
                </div>
            </div>
            <button onClick={handleSubmit} disabled={!localBrief.mainKeyword || isDeactivated} className="w-full mt-4 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
                确认创作要求
            </button>
        </div>
    );
};

const PreflightReportCard: React.FC<{ 
    messageId: string;
    report: PreflightReport; 
    onAutoFix: (messageId: string) => void;
    onApprove: (messageId: string) => void;
    isDeactivated: boolean;
}> = ({ messageId, report, onAutoFix, onApprove, isDeactivated }) => {
    return (
        <div className={`bg-white border border-gray-200 rounded-lg p-4 transition-opacity ${isDeactivated ? 'opacity-60' : ''}`}>
            <h3 className="font-semibold text-gray-800">第5步：预检报告</h3>
            <div className="text-sm text-gray-500 mb-4">
                {report.issues.length > 0 ? 
                    <span>发现 <span className="font-bold text-yellow-600">{report.issues.length}</span> 个可优化项</span> :
                    <span className="font-bold text-green-600">✓ 稿件质量达标，未发现问题</span>
                }
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
                {report.issues.map((issue, i) => (
                    <div key={i} className="border-l-4 border-yellow-400 bg-yellow-50 p-3 rounded-r-lg">
                        <p className="font-semibold text-yellow-800 text-sm">{issue.type}: {issue.description}</p>
                        <p className="text-xs text-yellow-700 mt-1">{issue.suggestion}</p>
                    </div>
                ))}
            </div>
             <div className="mt-4 flex space-x-3">
                <button onClick={() => onAutoFix(messageId)} disabled={report.issues.length === 0 || isDeactivated} className="flex-1 bg-yellow-500 text-white font-semibold py-2 rounded-lg hover:bg-yellow-600 disabled:bg-gray-400 transition-colors">
                    一键修复
                </button>
                <button onClick={() => onApprove(messageId)} disabled={isDeactivated} className="flex-1 bg-green-600 text-white font-semibold py-2 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400">
                    批准并继续
                </button>
            </div>
        </div>
    );
};

const PublishCard: React.FC<{ article: string; seoTitle: string; seoDescription: string; }> = ({ article, seoTitle, seoDescription }) => {
    
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            // Optional: show a notification
        });
    };
    
    const handleDownloadMD = () => {
        downloadFile(article, 'article.md', 'text/markdown;charset=utf-8');
    };
    const handleDownloadHTML = () => {
        const html = convertMarkdownToHtml(article);
        downloadFile(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${seoTitle || 'Article'}</title></head><body>${html}</body></html>`, 'article.html', 'text/html;charset=utf-8');
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800">第6步：发布与导出</h3>
            <p className="text-sm text-gray-500 mb-4">文章已通过审核！请选择您的发布或导出选项。</p>

            <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700">SEO Meta</h4>
                    <div>
                        <label className="text-xs font-medium text-gray-600">Meta Title</label>
                        <div className="relative">
                            <input type="text" readOnly value={seoTitle} className="w-full p-1.5 text-sm bg-white border border-gray-300 rounded-md mt-1 pr-10"/>
                             <button onClick={() => handleCopy(seoTitle)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-md">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m9.75 11.625-3.75-3.75" /></svg>
                            </button>
                        </div>
                    </div>
                     <div>
                        <label className="text-xs font-medium text-gray-600">Meta Description</label>
                         <div className="relative">
                            <textarea readOnly value={seoDescription} rows={2} className="w-full p-1.5 text-sm bg-white border border-gray-300 rounded-md mt-1 pr-10 resize-none"/>
                            <button onClick={() => handleCopy(seoDescription)} className="absolute right-1 top-2 p-1.5 text-gray-400 hover:text-gray-600 rounded-md">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m9.75 11.625-3.75-3.75" /></svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <button onClick={handleDownloadMD} className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition-colors">
                        下载 Markdown
                    </button>
                    <button onClick={handleDownloadHTML} className="w-full bg-gray-700 text-white font-semibold py-2.5 rounded-lg hover:bg-gray-800 transition-colors">
                        下载 HTML
                    </button>
                    <button disabled className="w-full bg-gray-300 text-gray-500 font-semibold py-2.5 rounded-lg cursor-not-allowed">
                        发布到 Shopify (即将推出)
                    </button>
                    <button disabled className="w-full bg-gray-300 text-gray-500 font-semibold py-2.5 rounded-lg cursor-not-allowed">
                        连接Google GSC监控（即将推出）
                    </button>
                </div>
            </div>
        </div>
    );
};

const SeoScoreGauge: React.FC<{ score: number }> = ({ score }) => {
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    const getScoreColor = () => {
        if (score >= 85) return 'text-green-500';
        if (score >= 60) return 'text-yellow-500';
        return 'text-red-500';
    };
    
    return (
        <div className="relative w-32 h-32">
            <svg className="w-full h-full" viewBox="0 0 120 120">
                <circle
                    className="text-gray-200"
                    strokeWidth="10"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="60"
                    cy="60"
                />
                <circle
                    className={`${getScoreColor()} transition-all duration-1000 ease-out`}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="60"
                    cy="60"
                    transform="rotate(-90 60 60)"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${getScoreColor()}`}>{score}</span>
                <span className="text-xs text-gray-500">/ 100</span>
            </div>
        </div>
    );
};


const RightPanel: React.FC<{ 
    currentStep: Step; 
    diagnosis: SeoDiagnosisReport | null; 
    articleInPreview: ArticlePreview | null;
    articleDraft: string;
    isGenerating: boolean;
    onArticleChange: (content: string) => void;
    onRunPreflight: () => void;
    onCloseArticlePreview: () => void;
    archivedArticles: ArchivedArticle[];
    rightPanelMode: 'workflow' | 'archiveList' | 'archiveArticle';
    viewingArchivedArticle: ArchivedArticle | null;
    onViewArchivedArticle: (article: ArchivedArticle) => void;
    onBackToArchiveList: () => void;
    onCloseArchive: () => void;
}> = ({ 
    currentStep, diagnosis, articleInPreview, 
    articleDraft, isGenerating, onArticleChange, onRunPreflight, 
    onCloseArticlePreview,
    archivedArticles, rightPanelMode, viewingArchivedArticle,
    onViewArchivedArticle, onBackToArchiveList, onCloseArchive
}) => {
    
    const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
    
    // Priority 1: If a competitor article is being previewed, show it.
    if (articleInPreview) {
        return (
            <div className="h-full flex flex-col">
                 <div className="p-4 flex-shrink-0 flex items-center justify-between border-b border-gray-200 bg-white">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-gray-800 truncate" title={articleInPreview.title}>竞对文章预览</h2>
                        <a href={articleInPreview.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline block truncate">{articleInPreview.title}</a>
                    </div>
                    <a href={articleInPreview.url} target="_blank" rel="noopener noreferrer" className="ml-4 flex-shrink-0 text-sm bg-gray-100 text-gray-700 font-semibold py-1.5 px-3 rounded-lg hover:bg-gray-200 transition-colors">
                        在新标签页中打开 ↗
                    </a>
                    <button onClick={onCloseArticlePreview} className="ml-2 text-gray-500 hover:text-gray-700 p-1 rounded-full" aria-label="Close preview">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                 <div className="p-4 bg-yellow-50 border-b border-yellow-200 text-center">
                    <p className="text-xs text-yellow-800">该网站限制了内部预览，请点击上方链接在新标签页中查看。</p>
                </div>
                <div className="flex-1 bg-white">
                     <iframe 
                        src={articleInPreview.url} 
                        className="w-full h-full border-0"
                        title={articleInPreview.title}
                        sandbox="allow-scripts allow-same-origin"
                    ></iframe>
                </div>
            </div>
        );
    }

    // Priority 2: Archive views
    if (rightPanelMode === 'archiveList') {
        return (
            <div className="h-full flex flex-col bg-gray-50">
                <div className="p-6 pb-4 flex-shrink-0 flex items-center justify-between bg-white border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800">创作档案</h2>
                    <button onClick={onCloseArchive} className="text-gray-500 hover:text-gray-700 p-1 rounded-full" aria-label="Close archive">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 px-6 pb-6 pt-4">
                    {archivedArticles.length > 0 ? (
                        <div className="space-y-3">
                            {archivedArticles.map(article => (
                                <div key={article.id} onClick={() => onViewArchivedArticle(article)} className="bg-white p-4 rounded-lg border border-gray-200 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all">
                                    <h3 className="font-semibold text-gray-800 truncate">{article.title}</h3>
                                    <p className="text-xs text-gray-500 mt-1">发布于: {new Date(article.approvedDate).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 pt-10">
                            <ArchiveBoxIcon className="w-12 h-12 mx-auto text-gray-300" />
                            <h3 className="mt-2 text-sm font-medium">暂无已归档的文章</h3>
                            <p className="mt-1 text-sm">完成并批准一篇稿件后，它将显示在这里。</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (rightPanelMode === 'archiveArticle' && viewingArchivedArticle) {
        return (
            <div className="h-full flex flex-col bg-white">
                <div className="p-6 pb-4 flex-shrink-0 flex items-center justify-between border-b border-gray-200">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-gray-800 truncate" title={viewingArchivedArticle.title}>{viewingArchivedArticle.title}</h2>
                        <p className="text-xs text-gray-500">发布于: {new Date(viewingArchivedArticle.approvedDate).toLocaleDateString()}</p>
                    </div>
                    <button onClick={onBackToArchiveList} className="text-sm bg-gray-100 text-gray-700 font-semibold py-1.5 px-3 rounded-lg hover:bg-gray-200 transition-colors">
                        &larr; 返回列表
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <MarkdownPreview markdown={viewingArchivedArticle.content} />
                </div>
            </div>
        );
    }

    // Priority 3: Render content based on the current step (workflow).
    if (currentStep <= Step.ANALYSIS_AND_SOLUTION) {
        if (!diagnosis) return <div className="p-6 flex items-center justify-center h-full"><p className="text-gray-500">正在进行SEO诊断...</p></div>;
        
        const DiagnosisCard: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode }> = ({ title, children, icon }) => (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-700 text-sm mb-2 flex items-center">
                    <span className="w-5 h-5 mr-2 text-gray-500">{icon}</span>
                    {title}
                </h4>
                {children}
            </div>
        );

        return (
            <div className="h-full flex flex-col bg-gray-50">
                <div className="p-6 pb-4 flex-shrink-0 flex items-center justify-between bg-white border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800">SEO工作台</h2>
                     <button onClick={onCloseArticlePreview} className="text-gray-500 hover:text-gray-700 p-1 rounded-full" aria-label="Close details">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50">
                    <div className="p-6 space-y-4">
                        <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col justify-center items-center">
                            <h3 className="font-semibold text-gray-700 mb-2">内容SEO健康度</h3>
                            <SeoScoreGauge score={diagnosis.contentSeoHealthScore} />
                        </div>
                        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg">
                            <h5 className="font-semibold text-blue-800 text-xs uppercase tracking-wider flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                核心洞察
                            </h5>
                            <p className="text-blue-700 text-sm mt-1">{diagnosis.coreInsight}</p>
                        </div>

                        <DiagnosisCard title="关键词与主题匹配度" icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-1.007 1.11-1.007h2.59c.55 0 1.02.465 1.11 1.007l.073.438c.08.474.49.826.98.826h1.94c.49 0 .9-.352.98-.826l.072-.438c.09-.542.56-1.007 1.11-1.007h2.59c.55 0 1.02.465 1.11 1.007l.073.438c.08.474.49.826.98.826h.94c.55 0 1 .45 1 1v1.5c0 .55-.45 1-1 1h-.94c-.49 0-.9.352-.98.826l-.072.438c-.09.542-.56 1.007-1.11-1.007h-2.59c-.55 0-1.02-.465-1.11-1.007l-.073-.438c-.08-.474-.49-.826-.98-.826h-1.94c.49 0 .9-.352.98-.826l.072-.438c-.09-.542-.56-1.007-1.11-1.007h-2.59c-.55 0-1.02.465-1.11-1.007l-.073.438c-.08-.474-.49-.826-.98-.826h-.94c-.55 0-1-.45-1-1v-1.5c0 .55.45-1 1-1h.94c.49 0 .9-.352.98-.826l.072-.438Z" /></svg>}>
                            <p className="text-sm text-gray-600 mb-2">{diagnosis.keywordTopicFit.analysis}</p>
                             <div className="mb-3">
                                <p className="text-xs font-semibold text-gray-500 mb-1">关键发现</p>
                                <div className="flex flex-wrap gap-2">
                                    {diagnosis.keywordTopicFit.topicalKeywords.map(keyword => (
                                        <span key={keyword} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">{keyword}</span>
                                    ))}
                                </div>
                            </div>
                            <p className="text-sm font-semibold text-green-700 bg-green-50 p-2 rounded-md">💡 {diagnosis.keywordTopicFit.recommendation}</p>
                        </DiagnosisCard>
                        
                        <DiagnosisCard title="主题权威性" icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>}>
                            <p className="text-sm text-gray-600 mb-2">{diagnosis.topicalAuthority.analysis}</p>
                            <p className="text-sm font-semibold text-green-700 bg-green-50 p-2 rounded-md">💡 {diagnosis.topicalAuthority.recommendation}</p>
                        </DiagnosisCard>

                        <DiagnosisCard title="用户意图覆盖度" icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.998-4.998 9.094 9.094 0 0 0-5.275 5.275 3 3 0 0 0 4.998 4.998 9.094 9.094 0 0 0 .478-3.742Zm-9.256 0a9.094 9.094 0 0 1-3.741-.479 3 3 0 0 1 4.998-4.998 9.094 9.094 0 0 1 5.275 5.275 3 3 0 0 1-4.998 4.998 9.094 9.094 0 0 1-.478-3.742Zm-3.74-12.422a3 3 0 0 1 4.998 0 9.094 9.094 0 0 1 3.742.478 3 3 0 0 1-4.998 4.998A9.094 9.094 0 0 1 6.28 7.076a3 3 0 0 1 0-4.998Z" /></svg>}>
                            <p className="text-sm text-gray-600 mb-2">{diagnosis.userIntentCoverage.analysis}</p>
                            <p className="text-sm font-semibold text-green-700 bg-green-50 p-2 rounded-md">💡 {diagnosis.userIntentCoverage.recommendation}</p>
                        </DiagnosisCard>
                        
                        <DiagnosisCard title="内容可发现性" icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0h9.75" /></svg>}>
                            <p className="text-sm text-gray-600 mb-2">{diagnosis.contentDiscoverability.analysis}</p>
                            <p className="text-sm font-semibold text-green-700 bg-green-50 p-2 rounded-md">💡 {diagnosis.contentDiscoverability.recommendation}</p>
                        </DiagnosisCard>
                    </div>
                </div>
            </div>
        );
    }
    
    if (currentStep === Step.ANALYSIS_AND_SOLUTION || currentStep === Step.CONTENT_BRIEF) {
        return (
            <div className="p-6 h-full flex flex-col bg-gray-50">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex-shrink-0">SEO工作台</h2>
                <div className="flex-1 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                    <div className="text-center text-gray-400 p-8">
                         <svg className="mx-auto h-16 w-16 text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                           <path strokeLinecap="round" strokeLinejoin="round" d="M12 1.5v2.25m6.75 6.75v2.25m-13.5-2.25v2.25m13.5 0-3.418 3.418m-10.082-3.418L12 15m0 0v4.5m-3.418-10.082L12 9.75l3.418-3.418"/>
                         </svg>
                        <h3 className="mt-4 text-sm font-semibold text-gray-600">稿件即将生成</h3>
                        <p className="mt-1 text-sm text-gray-500">在左侧对话中完成创作需求确认后，<br/>您的稿件将在此处呈现。</p>
                    </div>
                </div>
            </div>
        )
    }

    if (currentStep >= Step.EDIT_AND_PREFLIGHT) {
        const isFinalStep = currentStep === Step.PUBLISH;
        const currentViewMode = isFinalStep ? 'preview' : viewMode;

        // FIX: Use the 'isGenerating' prop instead of the undefined 'isGeneratingArticle' variable.
        if (isGenerating) {
             return (
                <div className="p-6 h-full flex items-center justify-center text-center bg-gray-50">
                    <div>
                        <svg className="mx-auto h-12 w-12 text-gray-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">AI 正在生成稿件...</h3>
                        <p className="mt-1 text-sm text-gray-500">正在撰写内容并生成配图，请稍候。</p>
                    </div>
                </div>
            )
        }

        return (
             <div className="p-6 h-full flex flex-col bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800">{isFinalStep ? 'SEO工作台' : '编辑器 & 辅助工具'}</h2>
                    {!isFinalStep && (
                        <div className="flex rounded-lg border border-gray-300 p-0.5">
                            <button onClick={() => setViewMode('preview')} className={`px-3 py-1 text-sm rounded-md ${currentViewMode === 'preview' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>预览</button>
                            <button onClick={() => setViewMode('edit')} className={`px-3 py-1 text-sm rounded-md ${currentViewMode === 'edit' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>编辑</button>
                        </div>
                    )}
                </div>

                <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {currentViewMode === 'preview' ? (
                        <div className="flex-1 overflow-y-auto p-6">
                            <MarkdownPreview markdown={articleDraft} />
                        </div>
                    ) : (
                        <textarea 
                            value={articleDraft}
                            onChange={(e) => onArticleChange(e.target.value)}
                            placeholder="AI 正在生成内容..."
                            readOnly={isFinalStep}
                            className="flex-1 w-full p-4 resize-none border-0 rounded-t-lg focus:outline-none focus:ring-0"
                        />
                    )}

                     {currentStep === Step.EDIT_AND_PREFLIGHT && (
                        <div className="p-2 border-t border-gray-200">
                            <button onClick={onRunPreflight} className="w-full bg-green-600 text-white font-semibold py-2.5 rounded-lg hover:bg-green-700 transition-colors">
                                完成编辑，开始校验
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 flex items-center justify-center h-full bg-gray-50">
            <p className="text-gray-500">工作台准备就绪</p>
        </div>
    );
};

const NotificationBanner: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => (
    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mx-4 mt-4 rounded-r-lg shadow-md" role="alert">
        <div className="flex items-center">
            <div className="py-1">
                <svg className="fill-current h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zM9 5v6h2V5H9zm0 8v2h2v-2H9z"/></svg>
            </div>
            <div className="flex-grow">
                <p className="font-bold text-sm">操作提醒</p>
                <p className="text-xs">{message}</p>
            </div>
            <button onClick={onDismiss} className="ml-auto p-1">
                <svg className="fill-current h-5 w-5 text-red-400 hover:text-red-600" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
            </button>
        </div>
    </div>
);


const WorkspacePage: React.FC<WorkspacePageProps> = ({ url, onReset }) => {
  const [currentStep, setCurrentStep] = useState<Step>(Step.SEO_DIAGNOSIS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);

  // State for each step's data
  const [diagnosisReport, setDiagnosisReport] = useState<SeoDiagnosisReport | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [confirmedCompetitors, setConfirmedCompetitors] = useState<Competitor[]>([]);
  const [competitorAnalysisReport, setCompetitorAnalysisReport] = useState<CompetitorAnalysisReport | null>(null);
  const [solutionBoard, setSolutionBoard] = useState<SolutionBoard | null>(null);
  const [selectedSolution, setSelectedSolution] = useState<SolutionOption | null>(null);
  const [contentBrief, setContentBrief] = useState<ContentBrief | null>(null);
  const [articleDraft, setArticleDraft] = useState('');
  const [preflightReport, setPreflightReport] = useState<PreflightReport | null>(null);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  
  // New Brand Profile state
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // Right Panel UI State
  const [articleInPreview, setArticleInPreview] = useState<ArticlePreview | null>(null);
  const [archivedArticles, setArchivedArticles] = useState<ArchivedArticle[]>([]);
  const [rightPanelMode, setRightPanelMode] = useState<'workflow' | 'archiveList' | 'archiveArticle'>('workflow');
  const [viewingArchivedArticle, setViewingArchivedArticle] = useState<ArchivedArticle | null>(null);


  // New state for immutable history
  const [deactivatedCardIds, setDeactivatedCardIds] = useState<Set<string>>(new Set());
  
  // Agent state
  const [isAgentThinking, setIsAgentThinking] = useState(true); // Start as true
  const [userInput, setUserInput] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  const addMessage = useCallback((type: MessageType, payload?: any) => {
    const newId = `msg-${nextId.current++}`;
    setMessages(prev => [...prev, { id: newId, type, payload }]);
    return newId;
  }, []);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateAndSaveProfile = useCallback(async (profileToSave: BrandProfile) => {
      await brandProfileService.saveBrandProfile(url, profileToSave);
  }, [url]);

  const updateProjectInProfile = useCallback(async (updateFn: (project: ProjectConfig) => ProjectConfig): Promise<BrandProfile | undefined> => {
    if (!brandProfile) return undefined;

    const currentProjectIndex = brandProfile.projects.findIndex(p => p.project_url === url);
    if (currentProjectIndex === -1) {
        console.error("Could not find current project in profile to update.");
        return undefined;
    }
    
    const updatedProject = updateFn({ ...brandProfile.projects[currentProjectIndex] });
    
    const updatedProjects = [...brandProfile.projects];
    updatedProjects[currentProjectIndex] = updatedProject;
    
    const newProfile: BrandProfile = { ...brandProfile, projects: updatedProjects };
    
    setBrandProfile(newProfile);
    await updateAndSaveProfile(newProfile);
    
    return newProfile;
  }, [brandProfile, url, updateAndSaveProfile]);

  const runSolutionGeneration = useCallback(async (analysisReport: CompetitorAnalysisReport, profileForRun: BrandProfile, userInstructions?: string) => {
    setArticleInPreview(null);
    setIsAgentThinking(true);
    let board: SolutionBoard;
    try {
        board = await getSolutionBoard(url, analysisReport.competitors, analysisReport, profileForRun, userInstructions);
    } catch (error) {
        console.error("Solution generation failed:", getErrorMessage(error));
        setErrorNotification("AI 方案生成失败，正在使用示例数据。");
        board = fallbackSolutionBoard;
    }
    setSolutionBoard(board);
    addMessage(MessageType.SOLUTION_BOARD_CARD, { board });
    setCurrentStep(Step.ANALYSIS_AND_SOLUTION);
    setIsAgentThinking(false);
  }, [url, addMessage]);

    const runCompetitorAnalysisWorkflow = useCallback(async (selectedCompetitors: Competitor[]) => {
        if (!diagnosisReport || !brandProfile) return;
        setIsAgentThinking(true);
        addMessage(MessageType.TOOL_USAGE, { text: 'RAG知识库检索' });
        addMessage(MessageType.TOOL_USAGE, { text: '竞对文章分析' });
        let report: CompetitorAnalysisReport;
        try {
            report = await runCompetitorAnalysis(selectedCompetitors, diagnosisReport, brandProfile);
        } catch (error) {
            console.error("Competitor analysis failed:", getErrorMessage(error));
            setErrorNotification("AI竞对分析失败，正在使用示例数据。");
            report = fallbackCompetitorAnalysisReport(selectedCompetitors);
        }
        setCompetitorAnalysisReport(report);
        addMessage(MessageType.COMPETITOR_ANALYSIS_CARD, { report });
        setCurrentStep(Step.COMPETITOR_ANALYSIS);
        setIsAgentThinking(false);
    }, [addMessage, diagnosisReport, brandProfile]);


  const runCompetitorSearchWorkflow = useCallback(async (profile: BrandProfile, userInstructions?: string) => {
      setIsAgentThinking(true);
      addMessage(MessageType.TOOL_USAGE, { text: '核心业务分析' });
      addMessage(MessageType.TOOL_USAGE, { text: '竞对搜索' });
      let competitorList: Competitor[];
      try {
        competitorList = await getCompetitors(url, profile, userInstructions);
      } catch (error) {
        console.error("Competitor search failed:", getErrorMessage(error));
        setErrorNotification("AI 竞对分析失败，正在使用示例数据。");
        competitorList = fallbackCompetitors;
      }
      setCompetitors(competitorList);
      addMessage(MessageType.COMPETITOR_CARD, { competitors: competitorList });
      setCurrentStep(Step.COMPETITOR_CONFIRMATION);
      setIsAgentThinking(false);
  }, [url, addMessage]);

  const runSeoDiagnosis = useCallback(async (profile: BrandProfile) => {
    setIsAgentThinking(true);
    addMessage(MessageType.AGENT, { text: `你好，我是你的专属SEO Agent。正在为你诊断网站 ${url} ...` });
    addMessage(MessageType.TOOL_USAGE, { text: '网站内容SEO分析' });
    let report: SeoDiagnosisReport;
    try {
      report = await getSeoDiagnosis(url);
    } catch(error) {
        console.error("SEO Diagnosis failed:", getErrorMessage(error));
        setErrorNotification("AI 诊断失败，正在使用示例数据。请检查您的 API Key 额度或网络连接。");
        report = fallbackSeoReport(url);
    }
    setDiagnosisReport(report);
    addMessage(MessageType.AGENT, { 
        text: `诊断已完成。您的网站内容SEO健康度评分为 ${report.contentSeoHealthScore}/100。核心洞察: "${report.coreInsight}". 接下来，我将为您识别主要的竞争对手。`,
    });
    await runCompetitorSearchWorkflow(profile);
  }, [url, addMessage, runCompetitorSearchWorkflow]);


  const runBriefPrefill = useCallback(async (solution: SolutionOption, userInstructions?: string) => {
      if (!brandProfile) return;
      setIsAgentThinking(true);
      addMessage(MessageType.TOOL_USAGE, { text: '智能Brief预填充' });
      if (!diagnosisReport) {
          console.error("Diagnosis report is not available for brief prefill.");
          setIsAgentThinking(false);
          return;
      }
      let brief: ContentBrief;
      try {
        brief = await getPrefilledBrief(solution, url, diagnosisReport, competitorAnalysisReport?.competitors || [], brandProfile, userInstructions);
      } catch (error) {
        console.error("Brief prefill failed:", getErrorMessage(error));
        setErrorNotification("AI 内容需求生成失败，正在使用示例数据。");
        brief = fallbackContentBrief(solution);
      }
      setContentBrief(brief);
      addMessage(MessageType.CONTENT_BRIEF_CARD, { brief });
      setCurrentStep(Step.CONTENT_BRIEF);
      setIsAgentThinking(false);
  }, [addMessage, url, diagnosisReport, competitorAnalysisReport, brandProfile]);

  const runPreflight = useCallback(async (articleForCheck?: string) => {
      if (!brandProfile) return;
      const articleToRun = articleForCheck ?? articleDraft;
      addMessage(MessageType.TOOL_USAGE, { text: 'AI主编 (内容审核)' });
      if(!contentBrief) return;
      let report: PreflightReport;
      try {
        report = await runPreflightCheck(articleToRun, contentBrief, brandProfile);
      } catch (error) {
        console.error("Preflight check failed:", getErrorMessage(error));
        setErrorNotification("AI 预检失败，请手动检查或重试。");
        report = fallbackPreflightReport;
      }
      setPreflightReport(report);
      const cardId = addMessage(MessageType.PREFLIGHT_CARD, { report });

      if (report.issues.length > 0) {
        addMessage(MessageType.AGENT, { text: `预检完成，发现 ${report.issues.length} 个可优化项。请查看报告并选择“一键修复”或在编辑器中手动修改。` });
      } else {
        addMessage(MessageType.AGENT, { text: `预检完成，稿件质量达标！您可以直接批准文章进入发布阶段。` });
      }
      return cardId;
  }, [articleDraft, contentBrief, addMessage, brandProfile]);
  
  const runArticleGenerationWorkflow = useCallback(async (finalBrief: ContentBrief, userInstructions?: string) => {
      if (!brandProfile) return;
      setArticleDraft('');
      setPreflightReport(null);
      setIsGeneratingArticle(true);
      setIsAgentThinking(true);
      try {
        addMessage(MessageType.TOOL_USAGE, { text: 'AI 作家-网络研究' });
        const researchSummary = await runWebResearch(finalBrief);
        
        addMessage(MessageType.TOOL_USAGE, { text: 'AI 作家-撰写大纲' });
        const outline = await generateStrategicOutline(researchSummary, finalBrief, brandProfile);
        
        addMessage(MessageType.TOOL_USAGE, { text: 'AI 作家-撰写初稿' });
        const initialDraft = await writeArticleFromOutline(outline, finalBrief, brandProfile, userInstructions);
        
        addMessage(MessageType.TOOL_USAGE, { text: 'AI 作家-可读性润色' });
        const polishedDraft = await polishArticleReadability(initialDraft);
        
        addMessage(MessageType.TOOL_USAGE, { text: 'AI 插画师 (生成图片)' });
        const articleWithImages = await generateAndEmbedImages(polishedDraft);
        
        setArticleDraft(articleWithImages);
        addMessage(MessageType.AGENT, { text: `稿件及图片已初步生成。正在进行自动预检...` });
        await runPreflight(articleWithImages); 
        
      } catch (error) {
        console.error("Article generation workflow failed:", getErrorMessage(error));
        setErrorNotification("AI 文章生成失败，正在使用示例内容，请稍后重试。");
        setArticleDraft(fallbackArticle(finalBrief));
        addMessage(MessageType.AGENT, { text: `文章生成失败。请检查右侧编辑器中的内容，然后手动进行预检。`});
      } finally {
        setIsGeneratingArticle(false);
        setIsAgentThinking(false);
      }
  }, [addMessage, runPreflight, brandProfile]);

  const initializeProject = useCallback(async (): Promise<BrandProfile | null> => {
    let profile = await brandProfileService.fetchBrandProfile(url);
    if (!profile) {
      addMessage(MessageType.AGENT, { text: '未找到品牌档案，正在为您自动创建...' });
      addMessage(MessageType.TOOL_USAGE, { text: 'AI 自动分析品牌' });
      try {
        profile = await brandProfileService.createInitialProfile(url);
        addMessage(MessageType.AGENT, { text: '品牌档案已初步建立，您可随时点击右上角“品牌档案”按钮进行修改。' });
      } catch(e) {
        console.error("Failed to auto-create profile, using fallback:", getErrorMessage(e));
        setErrorNotification("无法自动创建品牌档案，已加载默认档案。");
        profile = brandProfileService.getEmptyProfile(url);
      }
      await brandProfileService.saveBrandProfile(url, profile);
    }
    
    // For this version, we always start a new session from diagnosis.
    // Logic for resuming from a saved state is disabled to showcase the full flow.
    /*
    const projectConfig = profile?.projects.find(p => p.project_url === url);
    if (projectConfig?.seo_diagnosis_report && projectConfig?.competitor_list && projectConfig.competitor_list.length > 0) {
        addMessage(MessageType.AGENT, { text: '已找到您的项目分析记录，正在为您加载...' });
        
        const report = projectConfig.seo_diagnosis_report;
        const competitors = projectConfig.competitor_list;

        setDiagnosisReport(report);
        setConfirmedCompetitors(competitors);
        setBrandProfile(profile);

        addMessage(MessageType.AGENT, { text: `诊断记录加载完毕。网站SEO评分为 ${report.overallScore}/100。已确认 ${competitors.length} 个竞争对手。正在直接为您生成新的创作方案...` });
        setCurrentStep(Step.ANALYSIS_AND_SOLUTION);
        await runSolutionGeneration(competitors, profile);
        return null; // Signal to useEffect that the main flow is short-circuited
    }
    */

    setBrandProfile(profile);
    return profile;
  }, [url, addMessage]);

  useEffect(() => {
    const startWorkflow = async () => {
      const profile = await initializeProject();
      if (profile) {
        await runSeoDiagnosis(profile);
      }
    };
    if (messages.length === 0) {
      startWorkflow();
    }
    // This effect should only run once on component mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddManualCompetitor = (newComp: { url: string, name?: string }) => {
    const newCompetitor: Competitor = {
        ...newComp,
        id: `manual-${Date.now()}`,
        isManual: true,
        reasonText: '手动添加'
    };
    setCompetitors(prev => [...prev, newCompetitor]);
  };

  const handleConfirmCompetitors = async (selectedIds: string[], messageId: string) => {
      setDeactivatedCardIds(prev => new Set(prev).add(messageId));
      const selected = competitors.filter(c => selectedIds.includes(c.id));
      setConfirmedCompetitors(selected);

      if (!brandProfile || !diagnosisReport) {
          setErrorNotification("无法开始分析，缺少品牌或诊断信息。");
          return;
      }
      
      addMessage(MessageType.AGENT, { text: `已确认 ${selected.length} 个竞争对手。正在进行深度内容分析...` });
      
      const newProfile = await updateProjectInProfile(project => ({
          ...project,
          seo_diagnosis_report: diagnosisReport,
          competitor_list: selected
      }));
      
      runCompetitorAnalysisWorkflow(selected);
  };

  const handleProceedToSolutions = async (messageId: string) => {
      if (!brandProfile || !competitorAnalysisReport) return;
      setDeactivatedCardIds(prev => new Set(prev).add(messageId));
      addMessage(MessageType.AGENT, { text: `分析完成。正在基于洞察生成内容策略方案...` });
      runSolutionGeneration(competitorAnalysisReport, brandProfile);
  };

  const handleSelectSolution = async (solution: SolutionOption, messageId: string) => {
      setDeactivatedCardIds(prev => new Set(prev).add(messageId));
      setSelectedSolution(solution);
      
      await updateProjectInProfile(project => ({
          ...project,
          last_used_solution: solution
      }));

      addMessage(MessageType.AGENT, { text: `策略已选定: "${solution.strategyName}"。正在生成内容需求...` });
      runBriefPrefill(solution);
  };

  const handleConfirmBrief = async (finalBrief: ContentBrief, messageId: string) => {
      setDeactivatedCardIds(prev => new Set(prev).add(messageId));
      setContentBrief(finalBrief);
      
      await updateProjectInProfile(project => {
        const existingKeywords = project.project_keyword_history || [];
        const newKeywords = [finalBrief.mainKeyword, ...finalBrief.secondaryKeywords].filter(Boolean);
        const updatedKeywords = Array.from(new Set([...existingKeywords, ...newKeywords]));

        return {
          ...project,
          project_keyword_history: updatedKeywords,
        };
      });

      addMessage(MessageType.AGENT, { text: `内容需求已确认，AI 正在生成稿件初稿...` });
      setCurrentStep(Step.EDIT_AND_PREFLIGHT);
      runArticleGenerationWorkflow(finalBrief);
  };

  const handleRunPreflight = () => {
      setPreflightReport(null);
      setIsAgentThinking(true);
      addMessage(MessageType.AGENT, { text: `稿件已确认，正在进行预检...`});
      runPreflight().finally(() => setIsAgentThinking(false));
  };

    const handleViewArticle = useCallback(async (article: ArticlePreview) => {
        setRightPanelMode('workflow'); // Ensure we are in workflow mode to see competitor articles
        setArticleInPreview(article);
    }, []);

  const handleAutoFix = useCallback(async (messageId: string) => {
      if (!preflightReport || preflightReport.issues.length === 0) return;
      
      setDeactivatedCardIds(prev => new Set(prev).add(messageId));
      setIsAgentThinking(true);
      
      try {
        addMessage(MessageType.AGENT, { text: `收到修复请求，正在调用 AI 精确编辑...` });
        addMessage(MessageType.TOOL_USAGE, { text: 'AI精确编辑 (preflight.autofix)' });
        
        // 验证输入数据
        if (!articleDraft || typeof articleDraft !== 'string') {
          throw new Error('Invalid article draft');
        }
        if (!preflightReport.issues || !Array.isArray(preflightReport.issues)) {
          throw new Error('Invalid preflight issues');
        }
        
        // 调用自动修复
        let fixedArticle: string;
        try {
          fixedArticle = await runAutoFix(articleDraft, preflightReport.issues);
          
          // 验证修复后的文章
          if (!fixedArticle || typeof fixedArticle !== 'string') {
            console.warn('Auto-fix returned invalid article, using original');
            fixedArticle = articleDraft;
          }
        } catch (fixError) {
          console.error("Auto fix failed:", getErrorMessage(fixError));
          setErrorNotification("自动修复或重新校验失败。请手动检查。");
          fixedArticle = articleDraft; // 使用原文章
        }
        
        // 更新文章（确保数据有效）
        if (fixedArticle && typeof fixedArticle === 'string') {
          setArticleDraft(fixedArticle);
          setPreflightReport(null);
          
          // 重新校验
          try {
            addMessage(MessageType.AGENT, { text: `修复已应用。正在自动重新运行校验...` });
            await runPreflight(fixedArticle);
          } catch (preflightError) {
            console.error("Preflight after auto-fix failed:", getErrorMessage(preflightError));
            // 不显示错误，因为文章已经修复
            addMessage(MessageType.AGENT, { 
              text: `文章已修复，但重新校验时出现问题。请手动检查文章内容。` 
            });
          }
        } else {
          throw new Error('Invalid fixed article');
        }
      } catch (error) {
        console.error("Auto fix workflow failed:", getErrorMessage(error));
        setErrorNotification("自动修复或重新校验失败。请手动检查。");
      } finally {
        setIsAgentThinking(false);
      }
  }, [articleDraft, preflightReport, addMessage, runPreflight]);
  
  const handleApproveArticle = useCallback(async (messageId: string) => {
      if (!contentBrief) return;
      setDeactivatedCardIds(prev => new Set(prev).add(messageId));
      addMessage(MessageType.AGENT, { text: `文章已批准！正在生成SEO Meta信息并准备发布...`});
      
      setIsAgentThinking(true);
      try {
        const { seoTitle, seoDescription } = await generateSeoMetadata(articleDraft, contentBrief);
        setIsAgentThinking(false);
        
        setCurrentStep(Step.PUBLISH);
        addMessage(MessageType.PUBLISH_CARD, { article: articleDraft, seoTitle, seoDescription });
        addMessage(MessageType.AGENT, { text: `恭喜！您的SEO文章创作流程已全部完成。您可以下载文件，或开始新一轮创作。`});

        const newArchivedArticle: ArchivedArticle = {
            id: `archive-${Date.now()}`,
            title: contentBrief.titleSuggestion,
            content: articleDraft,
            approvedDate: new Date().toISOString(),
            seoTitle,
            seoDescription,
        };
        setArchivedArticles(prev => [newArchivedArticle, ...prev]);

      } catch (error) {
          console.error("Failed to generate SEO metadata:", getErrorMessage(error));
          setErrorNotification("生成SEO元数据失败。请手动填写。");
          setIsAgentThinking(false);
          // Still proceed to publish card but with empty meta
          setCurrentStep(Step.PUBLISH);
          addMessage(MessageType.PUBLISH_CARD, { article: articleDraft, seoTitle: "Generation Failed", seoDescription: "Generation Failed" });
      }

  }, [addMessage, articleDraft, contentBrief]);

  const handleStrategyIdeas = useCallback(() => {
    if (!brandProfile) {
        setErrorNotification("品牌档案尚未加载。");
        return;
    }
    if (!competitorAnalysisReport) {
        setErrorNotification("请先完成竞对分析，才能生成更多创意。");
        return;
    }
    
    setArticleInPreview(null);

    const solutionCardIds = messages.filter(m => m.type === MessageType.SOLUTION_BOARD_CARD).map(m => m.id);
    if (solutionCardIds.length > 0) {
        setDeactivatedCardIds(prev => {
            const newSet = new Set(prev);
            solutionCardIds.forEach(id => newSet.add(id));
            return newSet;
        });
    }

    addMessage(MessageType.AGENT, { text: `好的，正在为您生成更多创意方案...` });
    setCurrentStep(Step.ANALYSIS_AND_SOLUTION);
    runSolutionGeneration(competitorAnalysisReport, brandProfile);
  }, [competitorAnalysisReport, addMessage, runSolutionGeneration, messages, brandProfile]);

  const handleContentIdeas = useCallback(async () => {
    if (!brandProfile) {
        setErrorNotification("品牌档案尚未加载。");
        return;
    }
    if (!contentBrief) { 
        setErrorNotification("请先完成一次创作，AI才能根据历史为您推荐内容创意。");
        return;
    }

    addMessage(MessageType.AGENT, { text: `好的，正在分析您的品牌档案和历史创作偏好，为您构思一个全新的内容点子...` });
    setIsAgentThinking(true);
    
    const briefCardIds = messages.filter(m => m.type === MessageType.CONTENT_BRIEF_CARD).map(m => m.id);
    if (briefCardIds.length > 0) {
        setDeactivatedCardIds(prev => {
            const newSet = new Set(prev);
            briefCardIds.forEach(id => newSet.add(id));
            return newSet;
        });
    }

    try {
        const newBrief = await getNewContentIdea(brandProfile, contentBrief);
        setContentBrief(newBrief);
        addMessage(MessageType.CONTENT_BRIEF_CARD, { brief: newBrief });
        setCurrentStep(Step.CONTENT_BRIEF);
    } catch (error) {
        console.error("Content idea generation failed:", getErrorMessage(error));
        setErrorNotification("AI 内容创意生成失败，请稍后重试。");
        addMessage(MessageType.AGENT, { text: `抱歉，我在构思内容点子时遇到了问题。` });
    } finally {
        setIsAgentThinking(false);
    }
  }, [brandProfile, contentBrief, addMessage, messages]);

  const handleGoToStep = useCallback((targetStep: Step) => {
    addMessage(MessageType.AGENT, { text: `好的，我们回到第 ${targetStep} 步: ${stepsConfig.find(s=>s.id === targetStep)?.label || ''}.` });
    
    setArticleInPreview(null);

    const cardTypesByStep: { [key in Step]?: MessageType } = {
        [Step.COMPETITOR_CONFIRMATION]: MessageType.COMPETITOR_CARD,
        [Step.COMPETITOR_ANALYSIS]: MessageType.COMPETITOR_ANALYSIS_CARD,
        [Step.ANALYSIS_AND_SOLUTION]: MessageType.SOLUTION_BOARD_CARD,
        [Step.CONTENT_BRIEF]: MessageType.CONTENT_BRIEF_CARD,
        [Step.EDIT_AND_PREFLIGHT]: MessageType.PREFLIGHT_CARD,
        [Step.PUBLISH]: MessageType.PUBLISH_CARD,
    };

    const idsToDeactivate = new Set<string>();
    messages.forEach(msg => {
        const stepOfMessage = (Object.keys(cardTypesByStep) as unknown as Step[]).find(step => cardTypesByStep[step] === msg.type);
        if (stepOfMessage && stepOfMessage >= targetStep) {
            idsToDeactivate.add(msg.id);
        }
    });

    if (idsToDeactivate.size > 0) {
        setDeactivatedCardIds(prev => {
            const newSet = new Set(prev);
            idsToDeactivate.forEach(id => newSet.add(id));
            return newSet;
        });
    }

    // Reset application state for steps AFTER the target step
    if (targetStep < Step.PUBLISH) { /* no publish state */ }
    if (targetStep < Step.EDIT_AND_PREFLIGHT) { setPreflightReport(null); setArticleDraft(''); }
    if (targetStep < Step.CONTENT_BRIEF) { setContentBrief(null); }
    if (targetStep < Step.ANALYSIS_AND_SOLUTION) { setSelectedSolution(null); setSolutionBoard(null); }
    if (targetStep < Step.COMPETITOR_ANALYSIS) { setCompetitorAnalysisReport(null); }
    if (targetStep < Step.COMPETITOR_CONFIRMATION) { setConfirmedCompetitors([]); setCompetitors([]); }
    
    setCurrentStep(targetStep);
  }, [addMessage, messages]);

  const processUserRequest = useCallback(async (userText: string) => {
    if (!brandProfile) {
        addMessage(MessageType.AGENT, { text: "抱歉，品牌档案尚未加载，我暂时无法处理您的请求。" });
        return;
    }
    try {
        const chatHistoryForAgent = messages
            .filter(msg => msg.type === MessageType.USER || msg.type === MessageType.AGENT)
            .slice(-5);
        const action = await getAgentAction(userText, currentStep, chatHistoryForAgent);
        
        if (action.text) {
            addMessage(MessageType.AGENT, { text: action.text });
        } else if (action.name === 'go_to_step') {
            const targetStep = action.args.step as Step;
            if (targetStep >= 1 && targetStep < currentStep) {
                handleGoToStep(targetStep);
            } else {
                addMessage(MessageType.AGENT, { text: `抱歉，我无法跳转到第 ${targetStep} 步。` });
            }
        } else if (action.name === 'rerun_step') {
             const cardTypeMap: {[key in Step]?: MessageType} = {
                [Step.COMPETITOR_CONFIRMATION]: MessageType.COMPETITOR_CARD,
                [Step.COMPETITOR_ANALYSIS]: MessageType.COMPETITOR_ANALYSIS_CARD,
                [Step.ANALYSIS_AND_SOLUTION]: MessageType.SOLUTION_BOARD_CARD,
                [Step.CONTENT_BRIEF]: MessageType.CONTENT_BRIEF_CARD,
                [Step.EDIT_AND_PREFLIGHT]: MessageType.PREFLIGHT_CARD,
             };
             const cardToDeactivate = cardTypeMap[currentStep];
             if(cardToDeactivate){
                 const cardIds = messages.filter(m => m.type === cardToDeactivate).map(m => m.id);
                 if(cardIds.length > 0){
                     setDeactivatedCardIds(prev => {
                         const newSet = new Set(prev);
                         cardIds.forEach(id => newSet.add(id));
                         return newSet;
                     });
                 }
             }
             
             switch(currentStep) {
                case Step.COMPETITOR_CONFIRMATION:
                    addMessage(MessageType.AGENT, { text: `好的，收到您的反馈。正在根据您的要求重新搜索竞争对手...`});
                    await runCompetitorSearchWorkflow(brandProfile, action.args.instructions);
                    break;
                case Step.COMPETITOR_ANALYSIS:
                    addMessage(MessageType.AGENT, { text: `好的，收到您的反馈。正在根据您的要求重新进行分析...`});
                    await runCompetitorAnalysisWorkflow(confirmedCompetitors); // Note: Instructions aren't used here yet.
                    break;
                case Step.ANALYSIS_AND_SOLUTION:
                    if (competitorAnalysisReport) {
                        addMessage(MessageType.AGENT, { text: `好的，收到您的反馈。正在根据您的要求重新生成方案...`});
                        await runSolutionGeneration(competitorAnalysisReport, brandProfile, action.args.instructions);
                    } else {
                         addMessage(MessageType.AGENT, { text: `抱歉，请先完成竞对分析才能重新生成方案。`});
                    }
                    break;
                case Step.CONTENT_BRIEF:
                    if (selectedSolution) {
                        addMessage(MessageType.AGENT, { text: `好的，收到您的反馈。正在根据您的要求重新生成内容需求...`});
                        await runBriefPrefill(selectedSolution, action.args.instructions);
                    } else {
                        addMessage(MessageType.AGENT, { text: `抱歉，请先选择一个方案才能重新生成内容需求。`});
                    }
                    break;
                 case Step.EDIT_AND_PREFLIGHT:
                    if (contentBrief) {
                        addMessage(MessageType.AGENT, { text: `好的，收到您的反馈。正在根据您的要求重新生成文章...`});
                        await runArticleGenerationWorkflow(contentBrief, action.args.instructions);
                    } else {
                         addMessage(MessageType.AGENT, { text: `抱歉，请先确认内容需求才能重新生成文章。`});
                    }
                    break;
                default:
                    addMessage(MessageType.AGENT, { text: `抱歉，我无法在当前步骤 (${stepsConfig[currentStep-1].label}) 执行“重新运行”操作。` });
             }
        }

    } catch (error) {
        console.error("Agent action processing failed:", getErrorMessage(error));
        setErrorNotification("AI Agent 操作失败，请重试。");
        addMessage(MessageType.AGENT, { text: "抱歉，我处理您的请求时遇到了问题。" });
    }
  }, [currentStep, messages, addMessage, handleGoToStep, runSolutionGeneration, confirmedCompetitors, runBriefPrefill, selectedSolution, runArticleGenerationWorkflow, contentBrief, runCompetitorSearchWorkflow, brandProfile, competitorAnalysisReport, runCompetitorAnalysisWorkflow]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isAgentThinking) return;

    const text = userInput.trim();
    setUserInput('');
    addMessage(MessageType.USER, { text });
    setIsAgentThinking(true);
    await processUserRequest(text);
    setIsAgentThinking(false);
  };
  
  const handleSaveProfile = async (updatedProfile: BrandProfile) => {
      await brandProfileService.saveBrandProfile(url, updatedProfile);
      setBrandProfile(updatedProfile);
      setIsProfileModalOpen(false);
      addMessage(MessageType.AGENT, {text: "品牌档案已更新。"});
  }

  const handleOpenArchive = () => {
    setArticleInPreview(null);
    setViewingArchivedArticle(null);
    setRightPanelMode('archiveList');
  };

  const handleViewArchivedArticle = (article: ArchivedArticle) => {
      setViewingArchivedArticle(article);
      setRightPanelMode('archiveArticle');
  };

  const handleCloseArchive = () => {
      setViewingArchivedArticle(null);
      setRightPanelMode('workflow');
  };

  const handleCloseArticlePreview = () => {
    setArticleInPreview(null);
    // If user was in archive and clicked a competitor article somehow, return to workflow.
    if (rightPanelMode !== 'workflow') {
        setRightPanelMode('workflow');
    }
  };


  const renderMessage = (msg: ChatMessage) => {
    const isDeactivated = deactivatedCardIds.has(msg.id);
    const wrapperClass = "w-full animate-fade-in-up";
    
    switch (msg.type) {
      case MessageType.USER:
        return <div key={msg.id} className={`${wrapperClass} self-end flex justify-end`}><p className="bg-blue-500 text-white p-3 rounded-lg max-w-lg shadow-sm">{msg.payload.text}</p></div>;
      case MessageType.AGENT:
        return (
            <div key={msg.id} className={`${wrapperClass} self-start flex items-start space-x-3`}>
                <AIAvatarIcon className="flex-shrink-0 mt-1" />
                <div className="flex flex-col">
                    <p className="bg-gradient-to-br from-gray-100 to-gray-200 p-3 rounded-lg text-gray-800 max-w-lg shadow-sm">{msg.payload.text}</p>
                    {msg.payload.actions && (
                        <div className="mt-2">
                            {msg.payload.actions.map((action: any, index: number) => (
                                <button key={index} onClick={action.onClick} className="text-sm bg-blue-100 text-blue-700 font-semibold py-1 px-3 rounded-full hover:bg-blue-200 transition-colors">
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
      case MessageType.TOOL_USAGE:
        return <div key={msg.id} className={`${wrapperClass} self-start`}>
            <div className="ml-11 bg-purple-50 border-l-4 border-purple-400 p-2 rounded-r-lg max-w-lg">
                <div className="flex items-center text-sm text-purple-700">
                    <ToolIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                    <div>
                       <span>使用工具 | </span>
                       <span className="font-semibold">{msg.payload.text}</span>
                    </div>
                </div>
            </div>
        </div>;
      case MessageType.COMPETITOR_CARD:
        return <div key={msg.id} className={wrapperClass}><CompetitorConfirmationCard messageId={msg.id} competitors={competitors} onConfirm={handleConfirmCompetitors} onAdd={handleAddManualCompetitor} isDeactivated={isDeactivated} /></div>;
      case MessageType.COMPETITOR_ANALYSIS_CARD:
        return <div key={msg.id} className={wrapperClass}><CompetitorAnalysisCard messageId={msg.id} report={msg.payload.report} onViewArticle={handleViewArticle} onProceed={handleProceedToSolutions} isDeactivated={isDeactivated} /></div>;
      case MessageType.SOLUTION_BOARD_CARD:
        return <div key={msg.id} className={wrapperClass}><SolutionBoardCard messageId={msg.id} board={msg.payload.board} onSelect={handleSelectSolution} isDeactivated={isDeactivated} /></div>;
      case MessageType.CONTENT_BRIEF_CARD:
          return <div key={msg.id} className={wrapperClass}><ContentBriefCard messageId={msg.id} brief={msg.payload.brief} onConfirm={handleConfirmBrief} isDeactivated={isDeactivated} /></div>;
      case MessageType.PREFLIGHT_CARD:
          return <div key={msg.id} className={wrapperClass}><PreflightReportCard messageId={msg.id} report={msg.payload.report} onAutoFix={handleAutoFix} onApprove={handleApproveArticle} isDeactivated={isDeactivated} /></div>;
      case MessageType.PUBLISH_CARD:
          return <div key={msg.id} className={wrapperClass}><PublishCard article={msg.payload.article} seoTitle={msg.payload.seoTitle} seoDescription={msg.payload.seoDescription} /></div>;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col">
      <Header url={url} currentStep={currentStep} onOpenProfile={() => setIsProfileModalOpen(true)} onOpenArchive={handleOpenArchive} />
      {errorNotification && <NotificationBanner message={errorNotification} onDismiss={() => setErrorNotification(null)} />}
       {brandProfile && (
          <BrandProfileModal
              isOpen={isProfileModalOpen}
              onClose={() => setIsProfileModalOpen(false)}
              profile={brandProfile}
              onSave={handleSaveProfile}
          />
      )}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className="w-2/5 flex flex-col border-r border-gray-200 bg-white">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col min-h-0">
            {messages.map(renderMessage)}
             {isAgentThinking && messages.length > 0 && (
                <div className="self-start flex items-center space-x-3 animate-fade-in-up">
                    <AIAvatarIcon isThinking={true} />
                    <span className="text-sm text-gray-500 flex items-baseline">
                        AI 正在工作中
                        <span className="animate-dot-bounce" style={{ animationDelay: '0s' }}>.</span>
                        <span className="animate-dot-bounce" style={{ animationDelay: '0.15s' }}>.</span>
                        <span className="animate-dot-bounce" style={{ animationDelay: '0.3s' }}>.</span>
                    </span>
                </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-2 mb-3">
                <button 
                   onClick={handleStrategyIdeas} 
                   disabled={!competitorAnalysisReport || isAgentThinking}
                   className="flex items-center space-x-1.5 text-sm font-semibold px-3 py-1.5 rounded-full transition-all bg-purple-100 text-purple-800 border border-purple-200 hover:bg-purple-200 hover:border-purple-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed transform hover:scale-105"
                >
                   <LightbulbIcon className="w-4 h-4" />
                   <span>策略创意</span>
                </button>
                <button 
                   onClick={handleContentIdeas} 
                   disabled={!contentBrief || isAgentThinking}
                   className="flex items-center space-x-1.5 text-sm font-semibold px-3 py-1.5 rounded-full transition-all bg-purple-100 text-purple-800 border border-purple-200 hover:bg-purple-200 hover:border-purple-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed transform hover:scale-105"
                >
                   <PencilIcon className="w-4 h-4" />
                   <span>内容创意</span>
                </button>
            </div>
            <form onSubmit={handleSendMessage} className="relative">
              <input 
                type="text" 
                placeholder={isAgentThinking ? "AI正在工作中..." : "与AI Agent对话..."}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={isAgentThinking} 
                className="w-full py-2 pl-4 pr-12 border rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100 disabled:cursor-not-allowed" 
              />
              <button 
                type="submit"
                disabled={isAgentThinking || !userInput.trim()} 
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors bg-gray-700 hover:bg-gray-900 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
              </button>
            </form>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-3/5 bg-gray-50 flex flex-col">
          <div className="flex-1 min-h-0">
            <RightPanel 
              diagnosis={diagnosisReport} 
              currentStep={currentStep} 
              articleInPreview={articleInPreview}
              articleDraft={articleDraft}
              isGenerating={isGeneratingArticle}
              onArticleChange={setArticleDraft}
              onRunPreflight={handleRunPreflight}
              onCloseArticlePreview={handleCloseArticlePreview}
              archivedArticles={archivedArticles}
              rightPanelMode={rightPanelMode}
              viewingArchivedArticle={viewingArchivedArticle}
              onViewArchivedArticle={handleViewArchivedArticle}
              onBackToArchiveList={() => setRightPanelMode('archiveList')}
              onCloseArchive={handleCloseArchive}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspacePage;