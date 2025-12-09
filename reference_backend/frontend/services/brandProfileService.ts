import { BrandProfile } from '../types';

const getEmptyProfile = (url: string): BrandProfile => ({
    globalInfo: {
        brand_name: "",
        brand_industry: "",
        brand_voice: {
            tone: "Friendly, Informative, Passionate",
            style: "Short paragraphs, use bullet points",
            values: ["Sustainability", "Ethical Production"],
        },
        negative_keywords_global: ["cheap", "discount"],
    },
    projects: [
        {
            project_id: new URL(url).hostname,
            project_url: url,
            target_region: "United States",
            target_language: "English",
            target_keywords: ["eco-friendly wallet", "vegan leather bag"],
            preferred_solution_focus: ["SEO", "Content Marketing"],
        },
    ],
});

// Extract brand name and industry from markdown text profile
const extractBrandInfo = (textProfile: string): { brand_name: string; brand_industry: string } => {
    // Try to extract from markdown headings
    const brandNameMatch = textProfile.match(/#+\s*Brand\s+Overview[^#]*(?:Company\s+name|Brand\s+name)[:：]\s*([^\n]+)/i);
    const industryMatch = textProfile.match(/#+\s*Brand\s+Overview[^#]*(?:Industry|industry)[:：]\s*([^\n]+)/i);
    
    let brand_name = "";
    let brand_industry = "";
    
    if (brandNameMatch) {
        brand_name = brandNameMatch[1].trim();
    }
    if (industryMatch) {
        brand_industry = industryMatch[1].trim();
    }
    
    // Fallback: try to extract from first few lines
    if (!brand_name) {
        const lines = textProfile.split('\n').slice(0, 10);
        for (const line of lines) {
            if (line.toLowerCase().includes('brand') && line.toLowerCase().includes('name')) {
                const match = line.match(/name[:：]\s*([^\n]+)/i);
                if (match) {
                    brand_name = match[1].trim();
                    break;
                }
            }
        }
    }
    
    // Default fallbacks
    if (!brand_name) {
        brand_name = "Unknown Brand";
    }
    if (!brand_industry) {
        brand_industry = "General E-commerce";
    }
    
    return { brand_name, brand_industry };
};

const fetchBrandProfile = async (url: string): Promise<BrandProfile | null> => {
    console.log(`[API] Fetching profile for ${url}...`);
    const key = `brand_profile_${new URL(url).hostname}`;
    const storedProfile = localStorage.getItem(key);
    if (storedProfile) {
        console.log("[API] Profile found in cache.");
        return JSON.parse(storedProfile);
    }
    console.log("[API] No profile found in cache.");
    return null;
};

const saveBrandProfile = async (url: string, profile: BrandProfile): Promise<void> => {
    console.log(`[API] Saving profile for ${url}...`);
    const key = `brand_profile_${new URL(url).hostname}`;
    localStorage.setItem(key, JSON.stringify(profile, null, 2));
    console.log("[API] Profile saved to cache.");
};

const createInitialProfile = async (url: string): Promise<BrandProfile> => {
    console.log(`[API] Creating initial profile for ${url}...`);
    
    try {
        // Call backend API
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
        });
        
        if (!response.ok) {
            throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Extract brand info from text_profile
        const { brand_name, brand_industry } = extractBrandInfo(data.text_profile || '');
        
        // Create profile with backend data
        const profile = getEmptyProfile(url);
        profile.globalInfo.brand_name = brand_name;
        profile.globalInfo.brand_industry = brand_industry;
        profile.globalInfo.text_profile = data.text_profile;
        profile.globalInfo.assets = data.assets;
        
        console.log("[API] Initial profile created from backend.", profile);
        return profile;
    } catch (error) {
        console.error("[API] Failed to create profile from backend:", error);
        // Fallback to empty profile
        const emptyProfile = getEmptyProfile(url);
        emptyProfile.globalInfo.brand_name = "Unknown Brand";
        emptyProfile.globalInfo.brand_industry = "General E-commerce";
        return emptyProfile;
    }
}

export const brandProfileService = {
    fetchBrandProfile,
    saveBrandProfile,
    createInitialProfile,
    getEmptyProfile,
};