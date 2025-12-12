
import React, { useState, useEffect } from 'react';
import { generateInspirationImage } from '../../services/launchService';
import { ExclamationTriangleIcon, LightbulbIcon } from './LaunchIcons';

// --- DATA ---
export const inspirationCategories = ['全部', 'SEO优化', 'GEO增长', 'AI图片', 'AI视频'];

export const inspirationData = [
    // --- SEO优化 (2 items) ---
    { 
        category: 'SEO优化', 
        imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800', 
        title: '全站技术诊断 (Nike)', 
        prompt: "对网站 www.nike.com 进行SEO内容诊断" 
    },
    { 
        category: 'SEO优化', 
        imageUrl: 'https://images.unsplash.com/photo-1542744095-291d1f67b221?q=80&w=800', 
        title: '主题权威性规划 (Apple)', 
        prompt: "为网站 www.apple.com 规划主题权威内容" 
    },
    
    // --- GEO增长 (2 items) ---
    { 
        category: 'GEO增长', 
        imageUrl: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=800', 
        title: '全球受众画像 (DJI)', 
        prompt: "分析网站 www.dji.com 的全球用户画像" 
    },
    { 
        category: 'GEO增长', 
        imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800', 
        title: 'AIO 品牌声量分析 (HubSpot)', 
        prompt: "分析 www.hubspot.com 在AI搜索引擎(SearchGPT)中的品牌声量" 
    },

    // --- AI 图片 (4 items) ---
    { 
        category: 'AI图片', 
        imageUrl: 'https://images.unsplash.com/photo-1583337130417-234604081636?q=80&w=800', 
        title: 'Human & Pets Portrait', 
        prompt: "创建AI图片 A cute samoyed dog sitting in a lush green garden, looking up with a happy expression, soft natural light, detailed fur texture." 
    },
    { 
        category: 'AI图片', 
        imageUrl: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?q=80&w=800', 
        title: 'E-commerce Product Shot', 
        prompt: "创建AI图片 A professional e-commerce product shot of a stylish black chronograph watch on a textured dark marble surface, dramatic studio lighting, macro details." 
    },
    { 
        category: 'AI图片', 
        imageUrl: 'https://images.unsplash.com/photo-1543132220-3ec99c60942c?q=80&w=800', 
        title: '美式证件照 (Nano Banana)', 
        prompt: "创建AI图片 An American-style ID photo of a woman, blue background, professional lighting, looking directly at the camera." 
    },
    { 
        category: 'AI图片', 
        imageUrl: 'https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=800', 
        title: 'Future Eco City Concept', 
        prompt: "创建AI图片 Future eco-city with floating gardens and solar glass towers, soft warm light, concept art style, cinematic view." 
    },

    // --- AI 视频 (4 items) ---
    { 
        category: 'AI视频', 
        imageUrl: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?q=80&w=800', 
        title: 'Drone Shot of Coastline', 
        prompt: "创建AI视频 A breathtaking 5-second drone video shot of a tropical coastline at sunset, waves crashing gently on the shore." 
    },
    { 
        category: 'AI视频', 
        imageUrl: 'https://images.unsplash.com/photo-1626544827763-d516dce335ca?q=80&w=800', 
        title: 'Animated Logo Reveal', 
        prompt: "创建AI视频 A futuristic animated logo reveal of a metallic letter 'M' glowing with blue neon lights, spinning and settling into place on a dark background." 
    },
    { 
        category: 'AI视频', 
        imageUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?q=80&w=800', 
        title: 'Time-lapse of Blooming Flower', 
        prompt: "创建AI视频 A beautiful time-lapse video of a rose blooming, from a tight bud to a full flower, against a clean white background." 
    },
    { 
        category: 'AI视频', 
        imageUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=800', 
        title: 'Pixar Style Robot', 
        prompt: "创建AI视频 Pixar style 3D robot watering plants, happy expression, smooth animation, bright colors." 
    },
];

export const examplePrompts = [
    "分析 www.tesla.com 的SEO内容策略缺口",
    "为 www.notion.so 撰写一篇关于效率工具的SEO博客",
    "一瓶香水放置在波光粼粼的水面上，阳光透过，高奢广告摄影",
    "赛博朋克风格的未来东京街道，霓虹灯雨夜，动漫厚涂风格",
    "无人机航拍，穿越迷雾缭绕的瑞士阿尔卑斯山脉，4K电影质感视频",
    "炫酷的运动鞋悬浮旋转展示，粒子特效爆炸，快节奏剪辑"
];

// Simple session cache for generated images
export const imageCache = new Map<string, string>();

// --- COMPONENTS ---

export interface InspirationItem {
  category: string;
  imageUrl: string;
  title: string;
  prompt: string;
}

export interface InspirationCardProps {
  item: InspirationItem;
  index: number;
  onClick: (prompt: string) => void;
}

export const InspirationCard: React.FC<InspirationCardProps> = ({ item, index, onClick }) => {
  const [imageSrc, setImageSrc] = useState(item.imageUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImageSrc(item.imageUrl);
    setHasError(false);
    setIsLoading(false);
  }, [item.imageUrl]);

  const handleError = async () => {
    if (hasError) return;
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

  // Map category to tag
  let tag = 'AI';
  if (item.category.includes('SEO')) tag = 'Analysis';
  else if (item.category.includes('GEO')) tag = 'Growth';
  else if (item.category.includes('图片')) tag = 'Image';
  else if (item.category.includes('视频')) tag = 'Video';

  return (
    <div 
      onClick={() => onClick(item.prompt)} 
      className="relative group overflow-hidden rounded-2xl cursor-pointer aspect-[3/4] animate-fade-in-up bg-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {isLoading ? (
        <div className="w-full h-full animate-shimmer"></div>
      ) : (
        <img 
          src={imageSrc} 
          alt={item.title} 
          className="w-full h-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-110"
          onError={handleError} 
        />
      )}
      
      {/* Overlay - Gradient for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80 transition-opacity group-hover:opacity-90"></div>
      
      {/* Top Left Tag */}
      <div className="absolute top-4 left-4">
         <span className="bg-black/30 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-white rounded-full tracking-wide uppercase border border-white/10">
            {tag}
         </span>
      </div>

      {/* Bottom Content */}
      <div className="absolute bottom-0 left-0 p-5 w-full">
        <h3 className="text-white text-base font-bold leading-tight drop-shadow-md mb-1 transform translate-y-0 group-hover:-translate-y-1 transition-transform duration-300">
            {item.title}
        </h3>
        <div className="h-0.5 w-0 bg-white group-hover:w-12 transition-all duration-500 rounded-full opacity-80"></div>
      </div>
    </div>
  );
};

export interface AlertModalProps {
    isOpen: boolean;
    message: string;
    onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({ isOpen, message, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-[90%] max-w-sm relative animate-fade-in-up flex flex-col items-center text-center" onClick={e => e.stopPropagation()}>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">提示</h3>
                <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                    {message}
                </p>
                <button 
                    onClick={onClose}
                    className="w-full bg-slate-900 text-white py-2.5 rounded-full font-medium hover:bg-slate-800 transition-colors"
                >
                    确定
                </button>
            </div>
        </div>
    );
};

export interface AgentProps { 
    title: string; 
    icon: React.ElementType; 
    status: 'active' | 'comingSoon'; 
    onClick: () => void; 
    themeColor?: string; // Kept for interface compatibility but ignored for now
}

export const AgentListItem: React.FC<AgentProps> = ({ title, icon: Icon, status, onClick }) => {
    const isComingSoon = status === 'comingSoon';

    return (
        <div 
            onClick={onClick}
            className={`group flex items-center p-2.5 rounded-lg transition-all duration-300 cursor-pointer border border-transparent mb-1.5 last:mb-0 ${
                isComingSoon 
                    ? 'opacity-60 cursor-not-allowed bg-white/60' 
                    : 'bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5'
            }`}
        >
            {/* Icon - Smaller container and icon size */}
            <div className={`mr-3 w-7 h-7 rounded-md flex items-center justify-center transition-all duration-300 shrink-0 ${
                isComingSoon ? 'bg-slate-100 text-slate-300' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'
            }`}>
                <Icon className="w-3.5 h-3.5" />
            </div>
            
            <div className="flex-1 flex justify-between items-center min-w-0">
                {/* Smaller text size */}
                <h4 className={`font-bold text-[11px] truncate ${isComingSoon ? 'text-slate-400' : 'text-slate-700 group-hover:text-slate-900'}`}>
                    {title}
                </h4>
                
                {isComingSoon ? (
                    <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-medium tracking-wide whitespace-nowrap">待上线</span>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-slate-300 group-hover:text-indigo-400 transition-colors">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                )}
            </div>
        </div>
    );
};

export interface BusinessPillarProps {
    title: string;
    description: string;
    themeColor?: string; // Kept for compatibility
    agents: AgentProps[];
}

export const BusinessPillar: React.FC<BusinessPillarProps> = ({ title, description, themeColor, agents }) => {
    
    // Unified style for all pillars
    const style = {
        bg: 'bg-[#F5F3FF]', // Light Indigo/Violet background for all
        title: 'text-slate-800',
        desc: 'text-slate-500',
        border: 'border-violet-100'
    };

    return (
        <div className={`h-full flex flex-col rounded-[1.5rem] p-5 ${style.bg} border ${style.border} transition-all duration-300 hover:shadow-lg`}>
            <div className="mb-4 px-1">
                <h3 className={`text-lg font-bold ${style.title} mb-1 tracking-tight`}>{title}</h3>
                <p className={`text-[10px] font-medium ${style.desc} leading-relaxed opacity-80`}>{description}</p>
            </div>
            
            <div className="flex-1 flex flex-col">
                {agents.map((agent, idx) => (
                    <AgentListItem key={idx} {...agent} />
                ))}
            </div>
        </div>
    );
};
