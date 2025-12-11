
import { db, auth } from '../firebaseConfig';
import { BrandSiteConfig, BrandVisualProfile } from '../types';
import firebase from 'firebase/compat/app';
import { extractBrandDNA } from '../hooks/useReelApi';  // 从后端 API 调用

// --- UTILS ---

export const getCleanHostname = (url: string): string => {
    try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`);
        return u.hostname;
    } catch {
        return url;
    }
};

const getNewSiteConfig = (url: string, uid: string): Omit<BrandSiteConfig, 'id'> => ({
    uid,
    createdAt: Date.now(),
    lastActiveAt: Date.now(), // Initialize active timestamp
    url: url,
    brandName: getCleanHostname(url),
    industry: "General",
    products: [],
    brandVoice: {
        tone: "Friendly, Informative, Passionate",
        style: "Short paragraphs, use bullet points",
        values: ["Quality", "Innovation"],
    },
    negativeKeywords: ["cheap", "spam"],
    targetRegion: "United States",
    targetLanguage: "English",
    targetKeywords: [],
    preferredSolutionFocus: ["SEO", "Content Marketing"],
    strategyHistory: [],
    articleHistory: []
});

// Remove undefined fields before sending to Firestore
export const sanitize = (obj: any): any => {
    const clean: any = {};
    Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined) {
            clean[key] = obj[key];
        }
    });
    return clean;
};

// --- SITE PROFILE METHODS (Existing) ---

/**
 * Subscribe to the current user's brand profiles.
 * OPTIMIZATION: Uses single-field query (uid) and sorts in memory.
 */
export const subscribeToProfiles = (
    userId: string, 
    callback: (profiles: BrandSiteConfig[]) => void,
    onError?: (error: Error) => void
): (() => void) => {
    if (!db) {
        console.error("Firestore not initialized");
        return () => {};
    }

    // Query only by UID
    return db.collection('profiles')
        .where('uid', '==', userId)
        .onSnapshot(
            (snapshot) => {
                const profiles = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as BrandSiteConfig[];
                
                // Client-side sort: Most recently active first, then newest created
                profiles.sort((a, b) => {
                    const activeA = a.lastActiveAt || 0;
                    const activeB = b.lastActiveAt || 0;
                    if (activeA !== activeB) return activeB - activeA;
                    
                    const createdA = a.createdAt || 0;
                    const createdB = b.createdAt || 0;
                    return createdB - createdA;
                });

                callback(profiles);
            },
            (error) => {
                console.error("Error subscribing to profiles:", error);
                if (onError) onError(error);
            }
        );
};

/**
 * Create a new profile document. Enforces limit of 3 profiles per user.
 */
export const createProfile = async (url: string): Promise<string> => {
    const uid = auth.currentUser?.uid;
    if (!uid || !db) throw new Error("Authentication required or DB unavailable");

    // 1. Check Limits
    const snapshot = await db.collection('profiles').where('uid', '==', uid).get();
    if (snapshot.size >= 3) {
        throw new Error("LIMIT_REACHED");
    }

    // 2. Check if already exists (by exact URL)
    const existing = snapshot.docs.find(doc => doc.data().url === url);
    if (existing) {
        return existing.id;
    }

    // 3. Create
    const newConfig = getNewSiteConfig(url, uid);
    const docRef = await db.collection('profiles').add(sanitize(newConfig));
    return docRef.id;
};

/**
 * Update a profile document.
 */
export const updateProfile = async (docId: string, updates: Partial<BrandSiteConfig>) => {
    if (!db) throw new Error("DB unavailable");
    const { id, uid, ...safeUpdates } = updates;
    await db.collection('profiles').doc(docId).update(sanitize(safeUpdates));
};

/**
 * Delete a profile document.
 */
export const deleteProfile = async (docId: string) => {
    if (!db) throw new Error("DB unavailable");
    await db.collection('profiles').doc(docId).delete();
};

/**
 * Async helper to get or create a site configuration.
 */
export const getOrCreateSite = async (url: string): Promise<{ site: BrandSiteConfig | null, error?: string }> => {
    const uid = auth.currentUser?.uid;
    if (!uid || !db) return { site: null, error: "AUTH_REQUIRED" };

    try {
        // Fetch all profiles for user (max 3, very cheap)
        const snapshot = await db.collection('profiles')
            .where('uid', '==', uid)
            .get();

        // In-memory find to avoid composite index (uid + url)
        const existingDoc = snapshot.docs.find(doc => doc.data().url === url);

        if (existingDoc) {
            return { site: { id: existingDoc.id, ...existingDoc.data() } as BrandSiteConfig };
        }

        // Create new
        const id = await createProfile(url);
        // Fetch back to be sure
        const newDoc = await db.collection('profiles').doc(id).get();
        return { site: { id: newDoc.id, ...newDoc.data() } as BrandSiteConfig };

    } catch (e: any) {
        console.error("getOrCreateSite failed:", e);
        if (e.message === 'LIMIT_REACHED') {
            return { site: null, error: 'LIMIT_REACHED' };
        }
        // Propagate permission errors clearly
        if (e.code === 'permission-denied' || e.message.includes('permission')) {
            return { site: null, error: 'PERMISSION_DENIED' };
        }
        return { site: null, error: e.message };
    }
};

// --- BRAND VISUAL PROFILE (BRAND DNA) METHODS ---

export const subscribeToVisualProfiles = (
    userId: string,
    callback: (profiles: BrandVisualProfile[]) => void,
    onError?: (error: Error) => void
): (() => void) => {
    if (!db) {
        return () => {};
    }

    return db.collection('visual_profiles')
        .where('uid', '==', userId)
        .onSnapshot(
            (snapshot) => {
                const profiles = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as BrandVisualProfile[];
                
                // Sort by createdAt descending
                profiles.sort((a, b) => b.createdAt - a.createdAt);
                
                callback(profiles);
            },
            (error) => {
                console.error("Error subscribing to visual profiles:", error);
                if (onError) onError(error);
            }
        );
};

export const createVisualProfile = async (profileData: Omit<BrandVisualProfile, 'id' | 'uid' | 'createdAt'>): Promise<string> => {
    const uid = auth.currentUser?.uid;
    if (!uid || !db) throw new Error("Auth required");

    console.log("[BrandProfileService] Creating visual profile for user:", uid);

    // Check limit: max 2 profiles per user
    const snapshot = await db.collection('visual_profiles').where('uid', '==', uid).get();
    if (snapshot.size >= 2) {
        throw new Error("LIMIT_REACHED: Brand DNA 数量已达上限 (2个)。请先删除一个旧的 DNA，才能创建新的。");
    }

    const newProfile = {
        ...profileData,
        uid,
        createdAt: Date.now()
    };

    try {
        // Sanitize handles undefined removal before write
        const docRef = await db.collection('visual_profiles').add(sanitize(newProfile));
        console.log("[BrandProfileService] Profile created with ID:", docRef.id);
        
        // If set to active, deactivate others
        if (newProfile.isActive) {
            await setVisualProfileActive(docRef.id, uid);
        }
        
        return docRef.id;
    } catch (error) {
        console.error("[BrandProfileService] Failed to create profile:", error);
        throw error;
    }
};

export const updateVisualProfile = async (id: string, updates: Partial<BrandVisualProfile>) => {
    if (!db) throw new Error("DB unavailable");
    const { id: _, uid: __, ...safeUpdates } = updates;
    await db.collection('visual_profiles').doc(id).update(sanitize(safeUpdates));
};

export const deleteVisualProfile = async (id: string) => {
    if (!db) throw new Error("DB unavailable");
    await db.collection('visual_profiles').doc(id).delete();
};

export const setVisualProfileActive = async (profileId: string | null, userId: string) => {
    if (!db) throw new Error("DB unavailable");
    
    const batch = db.batch();
    
    // 1. Get all profiles for user
    const snapshot = await db.collection('visual_profiles').where('uid', '==', userId).get();
    
    snapshot.docs.forEach(doc => {
        if (doc.id === profileId) {
            batch.update(doc.ref, { isActive: true });
        } else {
            // Only update if it was active to save writes, but for simplicity batch update all is fine for small N
            if (doc.data().isActive) {
                batch.update(doc.ref, { isActive: false });
            }
        }
    });
    
    await batch.commit();
};

// Re-export extractBrandDNA from useReelApi (calls backend API)
export { extractBrandDNA };

export const brandProfileService = {
    subscribeToProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    getOrCreateSite,
    getCleanHostname,
    // Visual Profiles
    subscribeToVisualProfiles,
    createVisualProfile,
    updateVisualProfile,
    deleteVisualProfile,
    setVisualProfileActive,
    extractBrandDNA  // 调用后端 API
};
