
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

export type GoogleAdsCategory = 
    | 'Apparel & Accessories'
    | 'Consumer Electronics'
    | 'Beauty & Personal Care'
    | 'Software & Apps'
    | 'Health & Wellness'
    | 'Travel & Tourism'
    | 'General Marketing & SEO';

export type RagRating = 'High' | 'Medium' | 'Low';

export interface RagArticle {
    id: string;
    googleAdsCategory: GoogleAdsCategory;
    industryKeywords: string[];
    title: string;
    url: string;
    summary: string;
    rating: RagRating;
    publishDate?: string;
    reason?: string;
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

// --- BRAND PROFILE & SITES ---

export interface ArticleHistoryItem {
  title: string;
  mainKeyword: string;
  secondaryKeywords?: string[]; // New field for secondary keywords
  wordCount: number;
  date: string; // ISO string
}

export interface BrandSiteConfig {
    id: string; // Firestore Doc ID
    uid?: string; // User ID (Owner)
    createdAt?: number; // Timestamp
    lastActiveAt?: number; // Timestamp of last usage for sorting
    
    url: string; // Read-only
    
    // Auto-extracted or User-defined Basic Info
    brandName: string;
    industry: string;
    products: string[]; // New: List of key products/services
    
    // Voice & Style
    brandVoice: {
        tone: string;
        style: string;
        values: string[];
    };
    negativeKeywords: string[];

    // Target Config
    targetRegion: string;
    targetLanguage: string;
    targetKeywords: string[];
    preferredSolutionFocus: string[];

    // --- Dynamic Assets (Rolling Updates) ---
    
    // Latest Diagnosis Insight
    seoDiagnosisReport?: SeoDiagnosisReport;
    seoCoreInsight?: string; // New: Extracted core insight from diagnosis

    // Competitors
    competitorList?: Competitor[]; // Current active list

    // Strategy History (Rolling last 3)
    lastUsedSolution?: SolutionOption; // Deprecated in favor of history, kept for compatibility if needed
    strategyHistory: SolutionOption[]; 

    // Content History (Rolling last 3)
    keywordHistory?: string[]; // Deprecated in favor of articleHistory, kept for compatibility
    articleHistory: ArticleHistoryItem[];
}

export interface BrandProfile {
  sites: BrandSiteConfig[];
}

// --- NEW CREATION ARCHIVE ---
export interface ArchivedArticle {
  id: string;
  siteId?: string; // Partition by site
  title: string;
  content?: string; // Optional: loaded lazily from Storage (heavy data)
  fileUrl?: string; // Cloud Storage download URL
  storagePath?: string; // Cloud Storage path reference
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

export interface SnapGuide {
    orientation: 'vertical' | 'horizontal';
    position: number; // coordinate value on canvas
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

// --- NEW: CLOUD GALLERY ITEM ---
export interface GalleryItem {
  id: string;
  uid: string;
  type: 'image' | 'video';
  fileUrl: string;
  prompt: string;
  aspectRatio?: string;
  model?: string; // Added model field
  width?: number;
  height?: number;
  createdAt: any; // Firestore Timestamp
}

// --- BRAND VISUAL PROFILE (BRAND DNA) ---
export interface BrandVisualProfile {
    id: string;
    uid: string;
    name: string;        
    description: string; 
    logoUrl?: string; // Optional URL for the logo if we save it
    
    // Step 2 & 3: AI Extracted Visual Genes
    visualStyle: string; // Composition, lighting, material (e.g., "Matte finish, soft diffused lighting")
    colorPalette: string; // Key colors (e.g., "Pastel pink and mint green, high key")
    mood: string;        // Emotional atmosphere (e.g., "Serene, organic")
    
    // NEW: Negative Constraints for Brand Safety
    negativeConstraint: string; // (e.g., "No neon, no grunge, no chaotic background")
    
    isActive: boolean;   
    createdAt: number;
}

// --- VIDEO GENERATION TYPES ---
export interface CanvasVideo {
    id: string;
    src: string; // URL to the MP4 file
    prompt: string;
    width: number;
    height: number;
    x: number;
    y: number;
    sourceVideoId?: string; // ID of the source video (if extended or derived)
    status: 'generating' | 'saving' | 'done' | 'error'; // Added 'saving' status
    errorMsg?: string;
    generationParams?: {
        sourceImages: { data: string; mimeType: string }[];
        model: 'veo_fast' | 'veo_gen';
        aspectRatio: string;
    };
}

export type VideoMessage = {
    id: string;
    role: 'user' | 'assistant';
    type: 'text' | 'prompt-options' | 'design-plans' | 'generated-video' | 'tool-usage';
    content: any;
    timestamp: number;
};

export interface VideoSeries {
    id: string;
    creationDate: number;
    initialPrompt: string;
    videos: CanvasVideo[];
}

// --- REEL (HYBRID) GENERATION TYPES ---
export interface ReelAsset {
    id: string;
    type: 'image' | 'video';
    src: string;
    prompt: string;
    width: number;
    height: number;
    x: number;
    y: number;
    status?: 'generating' | 'saving' | 'done' | 'error';
    errorMsg?: string;
    sourceAssetId?: string;
    // Specifics for re-generation
    generationModel?: string; 
    generationParams?: any;
}

export type ReelMessage = {
    id: string;
    role: 'user' | 'assistant';
    type: 'text' | 'prompt-options' | 'design-plans' | 'generated-asset' | 'tool-usage' | 'model-suggestion';
    content: any;
    timestamp: number;
};

export interface ReelSeries {
    id: string;
    creationDate: number;
    initialPrompt: string;
    assets: ReelAsset[];
}

export interface EnhancedPrompt {
  title: string;
  description: string;
  tags: string[];
  fullPrompt: string;
}

// --- USER PROFILE TYPES ---
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  tier: 'free' | 'pro';
  credits: number;
  createdAt?: any;
}
