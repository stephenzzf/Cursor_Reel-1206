/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly GEMINI_API_KEY?: string;
  // 添加其他环境变量
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// 扩展 Window 接口以支持 aistudio
interface Window {
  aistudio?: {
    hasSelectedApiKey?: () => Promise<boolean>;
    openSelectKey?: () => Promise<void>;
  };
}
