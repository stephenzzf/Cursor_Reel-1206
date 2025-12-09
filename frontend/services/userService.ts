
import { db } from "../firebaseConfig";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

/**
 * Atomically deduct credits from a user's profile.
 * Uses FieldValue.increment(-amount) to ensure concurrency safety.
 */
export const deductUserCredits = async (userId: string, amount: number): Promise<void> => {
    if (!db) throw new Error("Firebase Firestore not initialized");
    
    const userRef = db.collection('users').doc(userId);
    
    try {
        console.log(`[UserService] Deducting ${amount} credits for user ${userId}`);
        await userRef.update({
            credits: firebase.firestore.FieldValue.increment(-amount)
        });
        console.log("[UserService] Credits deducted successfully.");
    } catch (error) {
        console.error("[UserService] Failed to deduct credits:", error);
        throw error;
    }
};
