
import { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import firebase from 'firebase/compat/app';
import { UserProfile } from '../types';

export const useUserProfile = () => {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }

        const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            if (user && db) {
                const userRef = db.collection('users').doc(user.uid);
                
                // 1. Initial Check & Creation (Idempotent)
                try {
                    const doc = await userRef.get();
                    if (!doc.exists) {
                        const newProfile: UserProfile = {
                            uid: user.uid,
                            email: user.email || '',
                            displayName: user.displayName || 'User',
                            tier: 'free',
                            credits: 100, // Default credits
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        await userRef.set(newProfile);
                        console.log("User profile initialized.");
                    }
                } catch (e) {
                    console.error("Error creating user profile:", e);
                }

                // 2. Real-time Listener (Reactive UI)
                const unsubscribeSnapshot = userRef.onSnapshot((snapshot) => {
                    if (snapshot.exists) {
                        setUserProfile(snapshot.data() as UserProfile);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Snapshot listener error:", error);
                    setLoading(false);
                });

                return () => unsubscribeSnapshot();
            } else {
                setUserProfile(null);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    const logout = () => auth?.signOut();

    return { userProfile, loading, logout };
};
