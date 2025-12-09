

export enum Step {
  SEO_DIAGNOSIS = 1,
  COMPETITOR_CONFIRMATION = 2,
  COMPETITOR_ANALYSIS = 3,
  ANALYSIS_AND_SOLUTION = 4,
  CONTENT_BRIEF = 5,
  EDIT_AND_PREFLIGHT = 6,
  PUBLISH = 7,
}

export enum MessageType {
  USER,
  AGENT,
  TOOL_USAGE,
  DIAGNOSIS_CARD,
  COMPETITOR_CARD,
  COMPETITOR_ANALYSIS_CARD,
  SOLUTION_BOARD_CARD,
  CONTENT_BRIEF_CARD,
  PREFLIGHT_CARD,
  PUBLISH_CARD,
}

export interface ChatMessage {
  id: string;
  type: MessageType;
  payload?: any;
}

export interface Competitor {
  id:string;
  url: string;
  name?: string;
  isManual?: boolean;
  reasonText?: string;
  contentSeoScore?: number;
  topArticle?: {
      title: string;
      url: string;
      reason: string;
  };
}

export interface RagArticle {
    industryKeywords: string[];
    title: string;
    url: string;
    reason: string;
}

export interface CompetitorAnalysisReport {
    ragArticles?: RagArticle[];
    competitiveLandscape: {
        overallTrend: string;
        yourDisadvantage: string;
        strategicOpportunity: string;
    };
    competitors: Competitor[];
}

export interface ArticlePreview {
    title: string;
    url: string;
}

// --- NEW CONTENT-FOCUSED SEO Diagnosis Report Structure ---

export interface ReportItem {
  analysis: string;
  recommendation: string;
}

export interface KeywordTopicFit extends ReportItem {
    topicalKeywords: string[];
}

export interface SeoDiagnosisReport {
    siteUrl: string;
    contentSeoHealthScore: number;
    coreInsight: string;
    keywordTopicFit: KeywordTopicFit;
    topicalAuthority: ReportItem;
    userIntentCoverage: ReportItem;
    contentDiscoverability: ReportItem;
}


// For Step 3: Analysis & Solution - Dynamic Strategy Engine Structure
export interface SolutionOption {
    id: string;
    strategyName: string; // e.g., "Traffic Magnet: Build Topical Authority"
    seoGoal: string; // e.g., "Establish topical authority, capture top-of-funnel traffic"
    coreConcept: string; // e.g., "Create a 'Pillar-Spoke' content model..."
    contentExamples: string[]; // e.g., ["Ultimate Guide to...", "What is an Aperture?"]
    strategicReason: string; // AI's explanation for why this is a good strategy for the user
}

export type SolutionBoard = SolutionOption[];


// For Step 4: Content Brief
export interface ContentBrief {
    titleSuggestion: string;
    topicSummary: string;
    targetRegion: string; // User-editable
    targetLanguage: string; // User-editable
    mainKeyword: string; // User-editable
    secondaryKeywords: string[]; // User-editable
    suggestedOutline: string[];
    estimatedWordcount: number;
    aiRecommendations: string[];
}

// For Step 5: Pre-flight
export interface PreflightIssue {
    type: 'Keyword' | 'SEO' | 'BrandVoice' | 'Readability';
    description: string;
    suggestion: string;
}

export interface PreflightReport {
    score: number;
    issues: PreflightIssue[];
};

// --- BRAND PROFILE ---
export interface BrandAsset {
  stored_url_public: string;
}

export interface BrandAssets {
  logos: BrandAsset[];
  images: BrandAsset[];
}

export interface GlobalBrandInfo {
  brand_name: string;
  brand_industry: string;
  brand_voice: {
    tone: string;
    style: string;
    values: string[];
  };
  negative_keywords_global: string[];
  text_profile?: string; // Markdown string from backend analysis
  assets?: BrandAssets; // Logos and images from backend
}

export interface ProjectConfig {
  project_id: string;
  project_url: string;
  target_region: string;
  target_language: string;
  target_keywords: string[];
  preferred_solution_focus: string[];
  seo_diagnosis_report?: SeoDiagnosisReport;
  competitor_list?: Competitor[];
  last_used_solution?: SolutionOption;
  project_keyword_history?: string[];
}

export interface BrandProfile {
  globalInfo: GlobalBrandInfo;
  projects: ProjectConfig[];
}

// --- NEW CREATION ARCHIVE ---
export interface ArchivedArticle {
  id: string;
  title: string;
  content: string; // The full markdown content
  approvedDate: string; // ISO date string
  seoTitle: string;
  seoDescription: string;
}

// --- IMAGE GENERATION TYPES ---
export interface CanvasImage {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  x: number;
  y: number;
  sourceImageId?: string; // ID of the image it was modified from
}

export type ImageMessage = {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'prompt-options' | 'design-plans' | 'generated-image' | 'tool-usage';
  content: any; // string for text, EnhancedPrompt[] for options, object[] for plans, object for image, { text: string } for tool-usage
  timestamp: number;
};

export interface ImageSeries {
  id: string;
  creationDate: number;
  initialPrompt: string;
  images: CanvasImage[];
}

export interface EnhancedPrompt {
  title: string;
  description: string;
  tags: string[];
  fullPrompt: string;
}

// --- VIDEO GENERATION TYPES ---
export interface CanvasVideo {
  id: string;
  src: string;
  prompt: string;
  width: number;
  height: number;
  x: number;
  y: number;
  status: 'generating' | 'done' | 'error';
  errorMsg?: string;
  generationParams?: {
    sourceImages: { data: string; mimeType: string }[];
    model: 'veo_fast' | 'veo_gen';
    aspectRatio: '16:9' | '9:16';
  };
}

export type VideoMessage = {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'prompt-options' | 'design-plans' | 'generated-video' | 'tool-usage';
  content: any; // string for text, EnhancedPrompt[] for options, object[] for plans, object for video, { text: string } for tool-usage
  timestamp: number;
};

export interface VideoSeries {
  id: string;
  creationDate: number;
  initialPrompt: string;
  videos: CanvasVideo[];
}