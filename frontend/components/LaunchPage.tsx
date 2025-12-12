
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { analyzeUserIntent } from '../services/launchService';
import { useUserProfile } from '../hooks/useUserProfile';
import { UserProfile } from '../types';
import UserStatusChip from './common/UserStatusChip';
import { 
    SparklesIcon, DocumentTextIcon, GlobeAltIcon, PhotoIcon, PlayCircleIcon, 
    SubtitlesIcon, SwatchIcon, LightbulbIcon, VideoCameraIcon, UserGroupIcon, 
    ChartBarIcon, PresentationChartLineIcon, FilmIcon, AnimatedLogoIcon 
} from './launch/LaunchIcons';
import { 
    InspirationCard, AlertModal, BusinessPillar, 
    inspirationCategories, inspirationData, examplePrompts 
} from './launch/LaunchComponents';

interface LaunchPageProps {
  onStartSeo: (url: string) => void;
  onStartImage: (prompt: string) => void;
  onStartVideo: (prompt: string) => void;
  onStartReel: (prompt: string) => void; // Added handler
}

const LaunchPage: React.FC<LaunchPageProps> = ({ onStartSeo, onStartImage, onStartVideo, onStartReel }) => {
  const { userProfile, logout } = useUserProfile();
  const [userInput, setUserInput] = useState('');
  const [isValidInput, setIsValidInput] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('全部');
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });
  const userInputRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    const textarea = userInputRef.current;
    if (textarea) {
      textarea.style.height = 'auto'; 
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 120; 
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [userInput]);

  const filteredInspirationData = useMemo(() => {
    if (activeTab === '全部') {
      return inspirationData;
    }
    return inspirationData.filter(item => item.category === activeTab);
  }, [activeTab]);

  const normalizeUrl = (url: string): string => {
    let urlStr = url.trim();
    if (!urlStr) return '';
    if (!/^(https?:\/\/)/.test(urlStr)) {
        urlStr = `https://${urlStr}`;
    }
    try {
        const urlObj = new URL(urlStr);
        const hostnameParts = urlObj.hostname.split('.');
        if (hostnameParts.length === 2) {
            urlObj.hostname = `www.${urlObj.hostname}`;
            return urlObj.toString();
        }
        return urlStr;
    } catch (e) {
        return urlStr;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
    setIsValidInput(true);
  };

  const handleSubmit = async (e: React.FormEvent, forcedInput?: string) => {
    e.preventDefault();
    const input = forcedInput ?? userInput;
    if (!input && !forcedInput) {
        onStartSeo('');
        return;
    }
    
    setIsLoading(true);

    try {
      const result = await analyzeUserIntent(input);
      
      switch (result.intent) {
        case 'SEO':
          if (!result.url) {
            setAlertState({ isOpen: true, message: "无法识别您的意图，请尝试输入网址或具体的创作指令" });
            setIsValidInput(false);
            return;
          }
          const normalized = normalizeUrl(result.url);
          if (/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(normalized)) {
            onStartSeo(normalized);
          } else {
            setAlertState({ isOpen: true, message: "无法识别您的意图，请尝试输入网址或具体的创作指令" });
            setIsValidInput(false);
          }
          break;
        case 'VIDEO_GENERATION':
            onStartVideo(result.query || input);
            break;
        case 'IMAGE_GENERATION':
             onStartImage(result.query || 'A beautiful landscape');
          break;
        case 'OTHER':
        default:
          setAlertState({ isOpen: true, message: "无法识别您的意图，请尝试输入网址或具体的创作指令" });
          break;
      }
    } catch (error) {
      console.error("AI intent analysis failed:", error);
      setAlertState({ isOpen: true, message: "AI分析失败，请重试或检查您的输入。" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleInspirationClick = (prompt: string) => {
    setUserInput(prompt);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    userInputRef.current?.focus();
  };
  
  const handleExampleClick = (text: string) => { setUserInput(text); };
  
  const handleFeatureComingSoon = () => {
      setShowComingSoonModal(true);
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-[#FAF9FF] font-sans pb-20 text-slate-800">
      
      <UserStatusChip profile={userProfile} onLogout={logout} />

      {/* --- HERO SECTION --- */}
      <div className="w-full max-w-5xl text-center mt-20 md:mt-24 px-4 animate-fade-in flex flex-col items-center">
        <div className="mb-8 transform hover:scale-105 transition-transform duration-700">
            <AnimatedLogoIcon className="w-24 h-24" />
        </div>
        <h1 className="text-4xl md:text-[3.5rem] font-black text-slate-900 tracking-tight leading-tight mb-5 drop-shadow-sm">
            Aideaon - Agentic AI全球增长平台
        </h1>
        <p className="text-lg text-slate-500 font-medium tracking-wide max-w-2xl leading-relaxed">
            连接 <span className="text-slate-700 font-bold">洞察</span>、<span className="text-slate-700 font-bold">增长</span> 与 <span className="text-slate-700 font-bold">生产</span> 的全链路AI工作流
        </p>
      </div>

      {/* --- SEARCH & COMMAND CENTER --- */}
      <div className="w-full max-w-5xl px-4 mt-12 animate-fade-in z-20" style={{animationDelay: '0.1s'}}>
        <form onSubmit={handleSubmit} className="relative group">
            <div className={`w-full flex items-center bg-white rounded-3xl p-2.5 shadow-[0_8px_40px_-10px_rgba(0,0,0,0.08)] hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] focus-within:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.12)] transition-all duration-300 border border-transparent focus-within:border-purple-100`}>
                 <textarea
                    ref={userInputRef}
                    value={userInput}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="输入网址 URL 或创作指令 (Shift + Enter 换行)"
                    className="w-full bg-transparent border-none focus:ring-0 text-lg text-slate-800 placeholder-slate-400 px-6 py-3 resize-none !outline-none font-medium"
                    rows={1}
                    style={{ minHeight: '60px' }}
                />
                <button 
                    type="submit" 
                    disabled={isLoading} 
                    className="flex-shrink-0 bg-[#E0E7FF] hover:bg-[#D1DBFF] text-[#6366F1] rounded-2xl w-14 h-14 flex items-center justify-center transition-all duration-200 disabled:bg-gray-50 disabled:text-gray-300 transform active:scale-95"
                >
                    {isLoading ? (
                        <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" /></svg>
                    )}
                </button>
            </div>
        </form>

        {/* --- QUICK ACTIONS (CENTERED) --- */}
        <div className="mt-10 flex flex-col items-center animate-fade-in" style={{animationDelay: '0.2s'}}>
           <div className="text-center mb-4">
               <span className="text-sm font-medium text-slate-400">💡 快速开始示例</span>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-5xl px-2">
               {examplePrompts.map((prompt, index) => (
                   <button 
                      key={index} 
                      onClick={() => handleExampleClick(prompt)} 
                      className="px-4 py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-white text-slate-600 hover:text-indigo-600 text-xs font-medium transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:shadow-md border border-slate-100 hover:border-indigo-100 transform hover:-translate-y-0.5 text-left truncate"
                      title={prompt}
                   >
                       "{prompt}"
                   </button>
               ))}
           </div>
        </div>
      </div>

      {/* --- AGENT PILLARS --- */}
      <div className="mt-24 w-full max-w-5xl px-6 animate-fade-in" style={{animationDelay: '0.3s'}}>
        <div className="mb-12 px-2 text-center">
             <h2 className="text-3xl font-bold text-slate-900 mb-3">出海专业领域Agent</h2>
             <p className="text-base text-slate-500">从洞察到生产，全流程赋能您的出海业务</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Pillar 1: Insight */}
            <BusinessPillar 
                title="市场洞察 Insight" 
                description="数据决策大脑：分析受众、市场、竞品"
                themeColor="production" 
                agents={[
                    { title: "受众分析", icon: UserGroupIcon, status: "active", onClick: handleFeatureComingSoon },
                    { title: "市场分析", icon: ChartBarIcon, status: "active", onClick: handleFeatureComingSoon },
                    { title: "SEO诊断", icon: LightbulbIcon, status: "active", onClick: () => onStartSeo(userInput) },
                    { title: "性能分析", icon: PresentationChartLineIcon, status: "active", onClick: handleFeatureComingSoon },
                ]}
            />
            
            {/* Pillar 2: Growth */}
            <BusinessPillar 
                title="流量增长 Growth" 
                description="高效获客引擎：多渠道内容策略与广告分发"
                themeColor="production" 
                agents={[
                    { title: "创意SEO内容", icon: DocumentTextIcon, status: "active", onClick: () => onStartSeo(userInput) },
                    { title: "创意GEO内容", icon: GlobeAltIcon, status: "active", onClick: handleFeatureComingSoon },
                    { title: "创意广告图片", icon: SwatchIcon, status: "comingSoon", onClick: handleFeatureComingSoon },
                    { title: "创意广告视频", icon: VideoCameraIcon, status: "comingSoon", onClick: handleFeatureComingSoon },
                ]}
            />

            {/* Pillar 3: Production */}
             <BusinessPillar 
                title="内容生产 Production" 
                description="无限创意工厂：自动化生成高质量素材"
                themeColor="production" 
                agents={[
                    { title: "AI图片", icon: PhotoIcon, status: "active", onClick: () => onStartImage(userInput) },
                    { title: "AI视频Video", icon: PlayCircleIcon, status: "active", onClick: () => onStartVideo(userInput) },
                    { title: "AI短视频Reel", icon: FilmIcon, status: "active", onClick: () => onStartReel(userInput) },
                    { title: "AI短剧字幕", icon: SubtitlesIcon, status: "comingSoon", onClick: handleFeatureComingSoon },
                ]}
            />
        </div>
      </div>
      
      {/* --- INSPIRATION --- */}
      <div className="mt-32 w-full max-w-[1150px] px-6 animate-fade-in pb-24" style={{ animationDelay: '0.5s' }}>
        <div className="flex flex-col items-center mb-10 px-2">
            <h2 className="text-3xl font-bold text-slate-900 mb-6 text-center">灵感发现</h2>
            <div className="flex gap-6 border-b border-gray-200 w-full pb-1 justify-center">
                {inspirationCategories.map(tab => (
                    <button 
                        key={tab} 
                        onClick={() => setActiveTab(tab)} 
                        className={`pb-3 text-sm font-bold transition-all duration-200 relative ${activeTab === tab ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {tab}
                        {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-900 rounded-full"></div>}
                    </button>
                ))}
            </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {filteredInspirationData.map((item, index) => (
                <InspirationCard 
                  key={item.title + index}
                  item={item} 
                  index={index}
                  onClick={handleInspirationClick} 
                />
            ))}
        </div>
      </div>

      {/* Alert Modal */}
      <AlertModal isOpen={alertState.isOpen} message={alertState.message} onClose={() => setAlertState({ ...alertState, isOpen: false })} />

      {/* Coming Soon Modal */}
      {showComingSoonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm animate-fade-in" onClick={() => setShowComingSoonModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-[90%] max-w-sm relative animate-fade-in-up flex flex-col items-center" onClick={e => e.stopPropagation()}>
                <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-5 text-3xl">🚧</div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">即将推出</h3>
                <p className="text-slate-500 text-center text-sm mb-8 leading-relaxed">
                    该功能正在紧张开发中，敬请期待 Aideaon 的下一次更新。
                </p>
                <button 
                    onClick={() => setShowComingSoonModal(false)}
                    className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                >
                    我知道了
                </button>
            </div>
        </div>
      )}

    </div>
  );
};

export default LaunchPage;
