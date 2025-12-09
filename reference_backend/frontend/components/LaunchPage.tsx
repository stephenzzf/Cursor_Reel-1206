
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { analyzeUserIntent } from '../services/seoService';
import { generateInspirationImage } from '../services/imageService';

interface LaunchPageProps {
  onStartSeo: (url: string) => void;
  onStartImage: (prompt: string) => void;
  onStartVideo: (prompt: string) => void;
}

// --- ICONS ---

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
    </svg>
);

const DocumentTextIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
);

const GlobeAltIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0-3.182-5.511m3.182 5.51-3.182-5.511" />
    </svg>
);

const PhotoIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
);

const PlayCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
    </svg>
);

const SubtitlesIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
    </svg>
);

const SwatchIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402a3.75 3.75 0 0 0-5.304-5.304L4.098 14.6c-.432.432-.432 1.132 0 1.564l3.748 3.748a1.125 1.125 0 0 1 0 1.591l-.53.53a1.125 1.125 0 0 1-1.591 0l-2.121-2.121a1.125 1.125 0 0 1 0-1.591l.53-.53a1.125 1.125 0 0 1 1.591 0Zm12.02-9.19a3.75 3.75 0 0 0-5.304-5.304L6.401 9.808a3.75 3.75 0 0 0 5.304 5.304l6.401-6.402Z" />
    </svg>
);

const LightbulbIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-11.25H10.5a6.01 6.01 0 0 0 1.5 11.25v.003zM7.5 18h9a2.25 2.25 0 0 1 2.25 2.25v0a2.25 2.25 0 0 1-2.25 2.25h-9A2.25 2.25 0 0 1 5.25 22.5v0A2.25 2.25 0 0 1 7.5 18z" />
    </svg>
);

const VideoCameraIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75Z" />
    </svg>
);

const UserGroupIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.998-4.998 9.094 9.094 0 0 0-5.275 5.275 3 3 0 0 0 4.998 4.998 9.094 9.094 0 0 0 .478-3.742Zm-9.256 0a9.094 9.094 0 0 1-3.741-.479 3 3 0 0 1 4.998-4.998 9.094 9.094 0 0 1 5.275 5.275 3 3 0 0 1-4.998 4.998 9.094 9.094 0 0 1-.478-3.742Zm-3.74-12.422a3 3 0 0 1 4.998 0 9.094 9.094 0 0 1 3.742.478 3 3 0 0 1-4.998 4.998A9.094 9.094 0 0 1 6.28 7.076a3 3 0 0 1 0-4.998Z" />
    </svg>
);

const ChartBarIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
);

const PresentationChartLineIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.179a4.5 4.5 0 0 1 7.021 2.426l.062.295a2.25 2.25 0 0 0 2.202 1.779h1.786a2.25 2.25 0 0 0 2.25-2.25V3.75a2.25 2.25 0 0 0-2.25-2.25H6a2.25 2.25 0 0 0-2.25 2.25ZM10.5 12a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm6.375.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
    </svg>
);


const AnimatedLogoIcon: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`relative ${className}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
                <radialGradient id="logo-grad-bg" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                    <stop offset="0%" stopColor="#A5B4FC" />
                    <stop offset="100%" stopColor="#6366F1" />
                </radialGradient>
                <linearGradient id="logo-grad-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(129, 140, 248, 0.7)"/>
                    <stop offset="100%" stopColor="rgba(165, 180, 252, 0.2)"/>
                </linearGradient>
            </defs>
            
            <g className="origin-center">
                 <circle cx="50" cy="50" r="48" stroke="url(#logo-grad-ring)" strokeWidth="1.5" className="animate-ring-spin" style={{animationDuration: '10s'}} />
                 <circle cx="50" cy="50" r="40" stroke="url(#logo-grad-ring)" strokeWidth="1" className="animate-ring-spin-reverse" style={{animationDuration: '15s'}} opacity="0.7"/>
            </g>

            <g className="animate-logo-pulse origin-center">
                <circle cx="50" cy="50" r="35" fill="url(#logo-grad-bg)" />
                <text
                    x="50"
                    y="52" 
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'"
                    fontSize="50"
                    fontWeight="bold"
                    fill="#FFFFFF"
                    stroke="#4F46E5"
                    strokeWidth="0.5"
                    strokeLinejoin="round"
                    paintOrder="stroke"
                >
                    M
                </text>
            </g>
        </svg>
    </div>
);

// --- DATA ---

const inspirationCategories = ['全部', 'SEO/GEO 内容', 'AI 图片', 'AI 视频'];
const inspirationData = [
    { category: 'SEO/GEO 内容', imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800', title: 'Full SEO Tactic Analysis', prompt: "对网站www.nike.com进行SEO内容诊断" },
    { category: 'SEO/GEO 内容', imageUrl: 'https://images.unsplash.com/photo-1542744095-291d1f67b221?q=80&w=800', title: 'Topical Authority Content Plan', prompt: "为网站www.apple.com规划主题权威内容" },
    { category: 'SEO/GEO 内容', imageUrl: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=800', title: 'Global Audience Persona', prompt: "分析网站www.dji.com的全球用户画像" },
    { category: 'AI 图片', imageUrl: 'https://images.unsplash.com/photo-1583337130417-234604081636?q=80&w=800', title: 'Human & Pets Portrait', prompt: "创建AI图片 A cute samoyed dog sitting in a lush green garden, looking up with a happy expression, soft natural light, detailed fur texture." },
    { category: 'AI 图片', imageUrl: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?q=80&w=800', title: 'E-commerce Product Shot', prompt: "创建AI图片 A professional e-commerce product shot of a stylish black chronograph watch on a textured dark marble surface, dramatic studio lighting, macro details." },
    { category: 'AI 图片', imageUrl: 'https://images.unsplash.com/photo-1543132220-3ec99c60942c?q=80&w=800', title: '美式证件照 (Nano Banana)', prompt: "创建AI图片 An American-style ID photo of a woman, blue background, professional lighting, looking directly at the camera." },
    { category: 'AI 视频', imageUrl: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?q=80&w=800', title: 'Drone Shot of Coastline', prompt: "创建AI视频 A breathtaking 5-second drone video shot of a tropical coastline at sunset, waves crashing gently on the shore." },
    { category: 'AI 视频', imageUrl: 'https://images.unsplash.com/photo-1626544827763-d516dce335ca?q=80&w=800', title: 'Animated Logo Reveal', prompt: "创建AI视频 A futuristic animated logo reveal of a metallic letter 'M' glowing with blue neon lights, spinning and settling into place on a dark background." },
    { category: 'AI 视频', imageUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?q=80&w=800', title: 'Time-lapse of Blooming Flower', prompt: "创建AI视频 A beautiful time-lapse video of a rose blooming, from a tight bud to a full flower, against a clean white background." },
];

// Simple session cache for generated images
const imageCache = new Map<string, string>();

interface InspirationItem {
  category: string;
  imageUrl: string;
  title: string;
  prompt: string;
}

interface InspirationCardProps {
  item: InspirationItem;
  index: number;
  onClick: (prompt: string) => void;
}

const InspirationCard: React.FC<InspirationCardProps> = ({ item, index, onClick }) => {
  const [imageSrc, setImageSrc] = useState(item.imageUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImageSrc(item.imageUrl);
    setHasError(false);
    setIsLoading(false);
  }, [item.imageUrl]);

  const handleError = async () => {
    if (hasError) return; // Prevent infinite loops
    setHasError(true);

    if (imageCache.has(item.prompt)) {
      setImageSrc(imageCache.get(item.prompt)!);
      return;
    }
    
    setIsLoading(true);
    try {
      const base64Image = await generateInspirationImage(item.prompt);
      const newSrc = `data:image/jpeg;base64,${base64Image}`;
      imageCache.set(item.prompt, newSrc);
      setImageSrc(newSrc);
    } catch (error) {
      console.error(`Failed to generate fallback image for "${item.title}":`, error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      onClick={() => onClick(item.prompt)} 
      className="relative group overflow-hidden rounded-lg shadow-md cursor-pointer aspect-[4/3] animate-fade-in-up bg-slate-200"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {isLoading ? (
        <div className="w-full h-full animate-shimmer"></div>
      ) : (
        <img 
          src={imageSrc} 
          alt={item.title} 
          className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
          onError={handleError} 
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
      <div className="absolute bottom-0 left-0 p-4 w-full">
        <h3 className="text-white text-lg font-bold drop-shadow-md">{item.title}</h3>
      </div>
    </div>
  );
};


const LaunchPage: React.FC<LaunchPageProps> = ({ onStartSeo, onStartImage, onStartVideo }) => {
  const [userInput, setUserInput] = useState('');
  const [isValidInput, setIsValidInput] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInputHighlighted, setIsInputHighlighted] = useState(false);
  const [activeTab, setActiveTab] = useState('全部');
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const userInputRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    const textarea = userInputRef.current;
    if (textarea) {
      textarea.style.height = 'auto'; // Reset height to shrink if needed
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 300; // Cap height to prevent extreme growth
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

  /**
   * 从可能包含额外文字的字符串中提取干净的 URL
   * 
   * 示例：
   * extractCleanUrl("www.nike.com进行SEO内容创作") -> "www.nike.com"
   * extractCleanUrl("https://www.apple.com 网站") -> "https://www.apple.com"
   * extractCleanUrl(null) -> null
   */
  const extractCleanUrl = (urlString: string | null): string | null => {
    if (!urlString) return null;
    
    // 移除首尾空白
    let cleaned = urlString.trim();
    if (!cleaned) return null;
    
    // 尝试匹配完整 URL（带协议）
    // 匹配 https:// 或 http:// 后跟非空白、非中文字符
    const urlWithProtocolMatch = cleaned.match(/^(https?:\/\/[^\s\u4e00-\u9fa5]+)/i);
    if (urlWithProtocolMatch) {
      // 移除末尾的标点符号
      return urlWithProtocolMatch[1].replace(/[.,;!?]+$/, '');
    }
    
    // 匹配域名（不带协议）
    // 匹配格式：可选www. + 域名主体 + .TLD，在遇到空白或中文字符前停止
    // 支持：www.nike.com, nike.com, adidas.com.cn
    const domainMatch = cleaned.match(/((?:www\.)?[a-z0-9][a-z0-9-]*[a-z0-9]?\.[a-z]{2,6}(?:\.[a-z]{2,6})?)(?=[\s\u4e00-\u9fa5]|$)/i);
    if (domainMatch) {
      return domainMatch[1];
    }
    
    return null;
  };

  /**
   * 规范化 URL：提取纯 URL 并添加协议和 www（如需要）
   * 
   * 示例：
   * normalizeUrl("www.nike.com进行SEO内容创作") -> "https://www.nike.com"
   * normalizeUrl("nike.com") -> "https://www.nike.com"
   * normalizeUrl("https://www.apple.com") -> "https://www.apple.com"
   */
  const normalizeUrl = (url: string): string => {
    // 先提取干净的 URL
    const cleanUrl = extractCleanUrl(url);
    if (!cleanUrl) return '';
    
    let urlStr = cleanUrl;
    
    // 如果已经有协议，直接处理并返回
    if (/^https?:\/\//i.test(urlStr)) {
      try {
        const urlObj = new URL(urlStr);
        // 如果只有两级域名，添加 www
        const hostnameParts = urlObj.hostname.split('.');
        if (hostnameParts.length === 2) {
          urlObj.hostname = `www.${urlObj.hostname}`;
        }
        return urlObj.toString();
      } catch (e) {
        // 如果解析失败，尝试提取域名部分
        const domainMatch = urlStr.match(/https?:\/\/([^\s\/\u4e00-\u9fa5]+)/i);
        if (domainMatch) {
          return `https://${domainMatch[1]}`;
        }
        return urlStr;
      }
    }
    
    // 没有协议，添加 https://
    // 如果只有两级域名，添加 www
    const parts = urlStr.split('.');
    if (parts.length === 2 && !urlStr.startsWith('www.')) {
      urlStr = `www.${urlStr}`;
    }
    
    return `https://${urlStr}`;
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
    setIsValidInput(true);
  };

  const handleSubmit = async (e: React.FormEvent, forcedInput?: string) => {
    e.preventDefault();
    const input = forcedInput ?? userInput;
    if (!input && !forcedInput) {
        onStartSeo('https://www.nike.com');
        return;
    }
    
    setIsLoading(true);

    try {
      // 快速检测：如果输入包含视频生成关键词，直接路由到视频页面（避免等待 API）
      const videoKeywords = /(创建AI视频|创建视频|生成.*?视频|create.*?video|generate.*?video)/i;
      if (videoKeywords.test(input)) {
        const cleanedPrompt = input.replace(/(创建AI视频|创建视频)/i, '').trim();
        onStartVideo(cleanedPrompt || input);
        setIsLoading(false);
        return;
      }

      // 调用后端 API 进行意图识别（带超时保护）
      const result = await Promise.race([
        analyzeUserIntent(input),
        new Promise<{ intent: string; url: string | null; query: string | null }>((_, reject) => 
          setTimeout(() => reject(new Error('Intent analysis timeout')), 8000)
        )
      ]).catch(() => {
        // API 超时或失败，使用前端快速检测
        const videoKeywords = /(生成|创建|制作|create|generate|make).*?(视频|video)/i;
        const imageKeywords = /(生成|创建|制作|draw|create|generate|make).*?(图片|照片|图像|image|picture|photo)/i;
        const urlPattern = /((https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?)/i;
        
        if (videoKeywords.test(input)) {
          const cleanedPrompt = input.replace(/(创建AI视频|创建视频)/i, '').trim();
          return { intent: 'VIDEO_GENERATION', url: null, query: cleanedPrompt || input };
        }
        if (imageKeywords.test(input)) {
          return { intent: 'IMAGE_GENERATION', url: null, query: input };
        }
        const urlMatch = input.match(urlPattern);
        if (urlMatch) {
          return { intent: 'SEO', url: urlMatch[0], query: input };
        }
        return { intent: 'OTHER', url: null, query: input };
      });
      
      switch (result.intent) {
        case 'SEO':
          // 策略：多层提取和验证
          let finalUrl: string | null = null;
          
          // 第一优先级：从 API 返回的 URL 中提取
          if (result.url) {
            const extractedFromApi = extractCleanUrl(result.url);
            if (extractedFromApi) {
              finalUrl = normalizeUrl(extractedFromApi);
            }
          }
          
          // 第二优先级：从原始输入中提取
          if (!finalUrl) {
            const extractedFromInput = extractCleanUrl(input);
            if (extractedFromInput) {
              finalUrl = normalizeUrl(extractedFromInput);
            }
          }
          
          // 验证最终的 URL
          if (finalUrl && /^https?:\/\/(www\.)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i.test(finalUrl)) {
            onStartSeo(finalUrl);
          } else {
            alert("需输入完整输入网站URL");
            setIsValidInput(false);
          }
          break;
        case 'IMAGE_GENERATION':
          onStartImage(result.query || 'A beautiful landscape');
          break;
        case 'VIDEO_GENERATION':
          // 清理提示词：移除"创建AI视频"等前缀
          const cleanedVideoPrompt = (result.query || input).replace(/(创建AI视频|创建视频)/i, '').trim();
          onStartVideo(cleanedVideoPrompt || input);
          break;
        case 'OTHER':
        default:
          // 智能回退：检查是否是视频生成意图
          const videoKeywords = /(生成|创建|制作|create|generate|make).*?(视频|video)/i;
          if (videoKeywords.test(input)) {
            const cleanedPrompt = input.replace(/(创建AI视频|创建视频)/i, '').trim();
            onStartVideo(cleanedPrompt || input);
            return;
          }
          // 智能回退：检查是否是图片生成意图
          const imageKeywords = /(生成|创建|制作|draw|create|generate|make).*?(图片|照片|图像|image|picture|photo)/i;
          if (imageKeywords.test(input)) {
            onStartImage(result.query || input);
            return;
          }
          // 检查是否是 URL
          const urlPattern = /((https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?)/i;
          const urlMatch = input.match(urlPattern);
          if (urlMatch) {
            const normalized = normalizeUrl(urlMatch[0]);
            if (/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(normalized)) {
              onStartSeo(normalized);
              return;
            }
          }
          alert("请输入有效的网站URL进行SEO分析，或描述您想生成的图片或视频。");
          break;
      }
    } catch (error) {
      console.error("AI intent analysis failed:", error);
      alert("AI分析失败，请重试或检查您的输入。");
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

  // --- AGENT PILLAR & CARD COMPONENTS ---

  interface AgentProps { 
      title: string; 
      icon: React.ElementType; 
      status: 'active' | 'comingSoon'; 
      onClick: () => void; 
  }

  const AgentListItem: React.FC<AgentProps> = ({ title, icon: Icon, status, onClick }) => {
    const isComingSoon = status === 'comingSoon';

    return (
        <div 
            onClick={onClick}
            className={`group flex items-center p-3 rounded-lg transition-all duration-200 border border-transparent ${isComingSoon ? 'hover:bg-gray-50 hover:shadow-sm hover:border-gray-100 cursor-pointer' : 'hover:bg-white hover:shadow-sm hover:border-gray-100 cursor-pointer'}`}
        >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 transition-colors ${isComingSoon ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100 group-hover:text-blue-700'}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
                <h4 className={`font-medium text-sm ${isComingSoon ? 'text-gray-500' : 'text-gray-800 group-hover:text-blue-700'}`}>
                    {title}
                </h4>
                {isComingSoon && <span className="text-[10px] font-bold text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded-full inline-block mt-0.5">即将上线</span>}
            </div>
            {!isComingSoon && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                     <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
            )}
        </div>
    );
  };

  interface BusinessPillarProps {
      title: string;
      description: string;
      themeColor: 'blue' | 'emerald' | 'violet';
      agents: AgentProps[];
  }

  const BusinessPillar: React.FC<BusinessPillarProps> = ({ title, description, themeColor, agents }) => {
      const colorMap = {
          blue: { border: 'border-blue-200', bg: 'bg-blue-50/30', title: 'text-blue-700', icon: 'text-blue-500' },
          emerald: { border: 'border-emerald-200', bg: 'bg-emerald-50/30', title: 'text-emerald-700', icon: 'text-emerald-500' },
          violet: { border: 'border-violet-200', bg: 'bg-violet-50/30', title: 'text-violet-700', icon: 'text-violet-500' },
      };
      const theme = colorMap[themeColor];

      return (
          <div className={`rounded-2xl border ${theme.border} ${theme.bg} p-4 flex flex-col h-full`}>
              <div className="mb-4 pb-3 border-b border-gray-200/50">
                  <h3 className={`text-lg font-bold ${theme.title} flex items-center`}>
                      {title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">{description}</p>
              </div>
              <div className="flex-1 flex flex-col gap-1">
                  {agents.map((agent, idx) => (
                      <AgentListItem key={idx} {...agent} />
                  ))}
              </div>
          </div>
      );
  };

  const handleInspirationClick = (prompt: string) => {
    setUserInput(prompt);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    userInputRef.current?.focus();
    setIsInputHighlighted(true);
    setTimeout(() => setIsInputHighlighted(false), 1000);
  };
  
  const handleExampleClick = (text: string) => { setUserInput(text); };
  
  const handleFeatureComingSoon = () => {
      setShowComingSoonModal(true);
  };

  const examplePrompts = [ "为我网站www.nike.com进行SEO内容创作", "生成一张小狗在沙滩上玩的照片", "分析我网站www.nike.com在youtube上的人群受众" ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 pb-20">
      
      {/* Top: Unified Command Center */}
      <div className="w-full max-w-5xl text-center animate-fade-in" style={{animationDelay: '0.1s'}}>
         <AnimatedLogoIcon className="w-24 h-24 mx-auto mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800">Aideaon - Agentic AI全球增长平台</h1>
        <p className="text-md text-gray-500 mt-4">连接 洞察、增长 与 生产 的全链路AI工作流</p>
      </div>

      <div className="w-full max-w-5xl bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl shadow-purple-500/10 p-12 mt-10 border border-gray-200/30 animate-fade-in" style={{animationDelay: '0.2s'}}>
        <div className="flex items-center text-3xl font-bold justify-center mb-6 text-gray-800"><SparklesIcon className="w-9 h-9 text-purple-500 mr-3"/>全球DTC运营AI助理<SparklesIcon className="w-9 h-9 text-purple-500 ml-3"/></div>
        <p className="text-center text-gray-500 mb-8">Ask anything, create anything</p>
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={userInputRef}
            value={userInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="输入网址 URL 或创作指令 (Shift + Enter 换行)"
            className={`w-full py-4 pl-6 pr-20 text-xl bg-white border rounded-2xl transition-all duration-300 focus:outline-none focus:ring-4 resize-none overflow-hidden ${isValidInput ? 'border-gray-200 focus:ring-purple-400/50 focus:border-purple-400' : 'border-red-400 ring-2 ring-red-200'} ${isInputHighlighted ? 'animate-input-highlight' : ''}`}
            rows={1}
          />
          <button type="submit" disabled={isLoading} className="absolute right-3.5 top-1/2 -translate-y-1/2 bg-gray-800 text-white rounded-full p-4 hover:bg-gray-900 transition-colors disabled:bg-gray-400">
            {isLoading ? (<svg className="animate-spin h-7 w-7 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>)}
          </button>
        </form>
        <div className="mt-8 text-center">
             <p className="text-sm text-gray-400 mb-3">💡 快速开始示例:</p>
             <div className="flex flex-wrap justify-center gap-3">{examplePrompts.map((prompt, index) => (<button key={index} onClick={() => handleExampleClick(prompt)} className="bg-white text-blue-600 text-sm py-1 px-3 rounded-full border border-gray-200 hover:bg-blue-50 transition-colors">"{prompt}"</button>))}</div>
        </div>
      </div>

      {/* Middle: Three Pillars */}
      <div className="mt-10 w-full max-w-5xl animate-fade-in" style={{animationDelay: '0.3s'}}>
        <div className="text-center mb-8">
             <h2 className="text-2xl font-bold text-gray-800">出海专业领域Agent</h2>
             <p className="text-sm text-gray-500 mt-2">从洞察到生产，全流程赋能您的出海业务</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pillar 1: Insight */}
            <BusinessPillar 
                title="市场洞察 Insight" 
                description="数据驱动的决策大脑：分析受众、市场与竞争对手"
                themeColor="blue"
                agents={[
                    { title: "受众分析", icon: UserGroupIcon, status: "active", onClick: handleFeatureComingSoon },
                    { title: "市场分析", icon: ChartBarIcon, status: "active", onClick: handleFeatureComingSoon },
                    { title: "SEO分析", icon: LightbulbIcon, status: "active", onClick: handleFeatureComingSoon },
                    { title: "性能分析", icon: PresentationChartLineIcon, status: "active", onClick: handleFeatureComingSoon },
                ]}
            />
            
            {/* Pillar 2: Growth */}
            <BusinessPillar 
                title="流量增长 Growth" 
                description="高效获客引擎：多渠道内容策略与广告分发"
                themeColor="emerald"
                agents={[
                    { title: "创意SEO内容", icon: DocumentTextIcon, status: "active", onClick: () => onStartSeo(userInput) },
                    { title: "创意GEO内容", icon: GlobeAltIcon, status: "comingSoon", onClick: handleFeatureComingSoon },
                    { title: "创意广告图片", icon: SwatchIcon, status: "comingSoon", onClick: handleFeatureComingSoon },
                    { title: "创意广告视频", icon: VideoCameraIcon, status: "comingSoon", onClick: handleFeatureComingSoon },
                ]}
            />

            {/* Pillar 3: Production */}
             <BusinessPillar 
                title="内容生产 Production" 
                description="无限创意工厂：自动化生成高质量素材"
                themeColor="violet"
                agents={[
                    { title: "AI图片", icon: PhotoIcon, status: "active", onClick: () => onStartImage(userInput) },
                    { title: "AI视频", icon: PlayCircleIcon, status: "active", onClick: () => onStartVideo(userInput) },
                    { title: "AI短剧字幕", icon: SubtitlesIcon, status: "active", onClick: handleFeatureComingSoon },
                ]}
            />
        </div>
      </div>
      
      {/* Bottom: Inspiration */}
      <div className="mt-16 w-full max-w-6xl animate-fade-in" style={{ animationDelay: '0.5s' }}>
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800">灵感发现</h2>
        </div>
        <div className="flex justify-center flex-wrap gap-x-6 gap-y-2 mb-8 text-sm font-medium text-gray-500 border-b border-gray-200">
            {inspirationCategories.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-2 transition-colors duration-200 ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'hover:text-gray-700'}`}>{tab}</button>
            ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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

      {/* Coming Soon Modal */}
      {showComingSoonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowComingSoonModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-[90%] max-w-sm relative animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="mb-8">
                    <p className="text-lg text-gray-800 font-medium">此功能即将推出！</p>
                </div>
                <div className="flex justify-end">
                    <button 
                        onClick={() => setShowComingSoonModal(false)}
                        className="bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                    >
                        确定
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default LaunchPage;
