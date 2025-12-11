
import { useState, useEffect } from 'react';
import { BrandVisualProfile } from '../types';
import { subscribeToVisualProfiles, setVisualProfileActive, deleteVisualProfile } from '../services/brandProfileService';
import { auth } from '../firebaseConfig';

export const useBrandVisualProfiles = () => {
    const [visualProfiles, setVisualProfiles] = useState<BrandVisualProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeProfile, setActiveProfile] = useState<BrandVisualProfile | null>(null);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (user) {
                setLoading(true);
                unsubscribe = subscribeToVisualProfiles(
                    user.uid,
                    (newProfiles) => {
                        setVisualProfiles(newProfiles);
                        const active = newProfiles.find(p => p.isActive);
                        setActiveProfile(active || null);
                        setLoading(false);
                    },
                    (err) => {
                        console.error("Brand profile subscription error", err);
                        setError(err.message);
                        setLoading(false);
                    }
                );
            } else {
                setVisualProfiles([]);
                setActiveProfile(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const setActive = async (id: string | null) => {
        if (!auth.currentUser) return;
        try {
            // Optimistic update
            if (id === null) {
                setActiveProfile(null);
            } else {
                const target = visualProfiles.find(p => p.id === id);
                if (target) setActiveProfile({ ...target, isActive: true });
            }
            
            await setVisualProfileActive(id, auth.currentUser.uid);
        } catch (e: any) {
            console.error("Failed to set active profile:", e);
            setError(e.message);
        }
    };

    const removeProfile = async (id: string) => {
        // UI confirmation is now handled in the component
        try {
            await deleteVisualProfile(id);
        } catch (e: any) {
            console.error("Failed to delete profile:", e);
            setError(e.message);
        }
    };

    return { 
        visualProfiles, 
        activeProfile, 
        loading, 
        error, 
        setActive, 
        removeProfile 
    };
};
