/**
 * Gallery Service - 图库服务
 * 处理图片/视频的上传、存储和检索
 */

import { storage, db } from '../firebaseConfig';
import firebase from 'firebase/compat/app';
import 'firebase/compat/storage';
import 'firebase/compat/firestore';
import { GalleryItem } from '../types';

/**
 * 上传图片到 Firebase Storage
 */
export const uploadImageToStorage = async (
    userId: string,
    base64Image: string
): Promise<string> => {
    if (!storage) throw new Error('Firebase Storage not initialized');
    
    try {
        // 将 base64 转换为 Blob
        const response = await fetch(`data:image/jpeg;base64,${base64Image}`);
        const blob = await response.blob();
        
        // 创建存储路径
        const timestamp = Date.now();
        const fileName = `reel-images/${userId}/${timestamp}.jpg`;
        const storageRef = storage.ref(fileName);
        
        // 上传文件
        await storageRef.put(blob);
        
        // 获取下载 URL
        const downloadURL = await storageRef.getDownloadURL();
        return downloadURL;
    } catch (error) {
        console.error('Failed to upload image to storage:', error);
        throw error;
    }
};

/**
 * 保存图库项到 Firestore
 */
export const saveGalleryItem = async (
    userId: string,
    item: Omit<GalleryItem, 'id' | 'uid' | 'createdAt'>
): Promise<void> => {
    if (!db) throw new Error('Firebase Firestore not initialized');
    
    try {
        const galleryRef = db.collection('gallery');
        await galleryRef.add({
            ...item,
            uid: userId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Failed to save gallery item:', error);
        throw error;
    }
};

/**
 * 订阅用户图库
 */
export const subscribeToGallery = (
    userId: string,
    callback: (items: GalleryItem[]) => void
): (() => void) => {
    if (!db) {
        console.error('Firebase Firestore not initialized');
        return () => {};
    }
    
    try {
        // 先尝试使用复合查询（需要 Firestore 索引）
        // 如果失败，回退到简单查询
        let galleryRef = db.collection('gallery')
            .where('uid', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(50);
        
        const unsubscribe = galleryRef.onSnapshot(
            (snapshot) => {
                const items: GalleryItem[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    items.push({
                        id: doc.id,
                        ...data
                    } as GalleryItem);
                });
                // 如果使用复合查询失败，按创建时间排序
                items.sort((a, b) => {
                    const aTime = a.createdAt?.toMillis?.() || 0;
                    const bTime = b.createdAt?.toMillis?.() || 0;
                    return bTime - aTime;
                });
                callback(items);
            },
            (error) => {
                console.error('Gallery subscription error (trying fallback):', error);
                // 回退到简单查询（不需要索引）
                try {
                    const fallbackRef = db.collection('gallery')
                        .where('uid', '==', userId)
                        .limit(50);
                    
                    fallbackRef.onSnapshot(
                        (snapshot) => {
                            const items: GalleryItem[] = [];
                            snapshot.forEach((doc) => {
                                const data = doc.data();
                                items.push({
                                    id: doc.id,
                                    ...data
                                } as GalleryItem);
                            });
                            // 客户端排序
                            items.sort((a, b) => {
                                const aTime = a.createdAt?.toMillis?.() || 0;
                                const bTime = b.createdAt?.toMillis?.() || 0;
                                return bTime - aTime;
                            });
                            callback(items);
                        },
                        (fallbackError) => {
                            console.error('Gallery fallback subscription error:', fallbackError);
                            callback([]);
                        }
                    );
                } catch (fallbackErr) {
                    console.error('Failed to set up fallback gallery subscription:', fallbackErr);
                    callback([]);
                }
            }
        );
        
        return unsubscribe;
    } catch (error) {
        console.error('Failed to subscribe to gallery:', error);
        // 如果完全失败，返回空数组
        callback([]);
        return () => {};
    }
};

/**
 * 上传文件到 Firebase Storage
 */
export const uploadFileToStorage = async (userId: string, file: File, folder: string = "uploads"): Promise<string> => {
    if (!storage) throw new Error('Firebase Storage not initialized');
    
    try {
        const timestamp = Date.now();
        // Sanitize file name
        const safeName = file.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `users/${userId}/${folder}/${timestamp}_${safeName}`;
        const storageRef = storage.ref(fileName);
        
        // 上传文件
        await storageRef.put(file);
        
        // 获取下载 URL
        const downloadURL = await storageRef.getDownloadURL();
        return downloadURL;
    } catch (error) {
        console.error('Failed to upload file to storage:', error);
        throw error;
    }
};

