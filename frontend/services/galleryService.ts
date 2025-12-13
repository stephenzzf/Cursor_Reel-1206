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
    
    // 检查用户认证状态
    const { auth } = await import('../firebaseConfig');
    if (!auth || !auth.currentUser) {
        throw new Error('User not authenticated. Please log in first.');
    }
    
    try {
        // 将 base64 转换为 Blob
        const response = await fetch(`data:image/jpeg;base64,${base64Image}`);
        const blob = await response.blob();
        
        // 创建存储路径
        const timestamp = Date.now();
        const fileName = `reel-images/${userId}/${timestamp}.jpg`;
        const storageRef = storage.ref(fileName);
        
        console.log('[Gallery] Uploading to Storage:', {
            fileName,
            userId,
            blobSize: blob.size,
            currentUserId: auth.currentUser?.uid
        });
        
        // 上传文件，设置 metadata 确保权限正确
        const metadata = {
            contentType: 'image/jpeg',
            customMetadata: {
                userId: userId,
                uploadedAt: new Date().toISOString()
            }
        };
        
        await storageRef.put(blob, metadata);
        console.log('[Gallery] ✅ File uploaded successfully');
        
        // 获取下载 URL
        const downloadURL = await storageRef.getDownloadURL();
        console.log('[Gallery] ✅ Download URL obtained');
        return downloadURL;
    } catch (error: any) {
        console.error('[Gallery] ❌ Failed to upload image to storage:', error);
        console.error('[Gallery] Error details:', {
            code: error.code,
            message: error.message,
            serverResponse: error.serverResponse
        });
        
        // 如果是权限错误，提供更友好的错误信息
        if (error.code === 'storage/unauthorized') {
            throw new Error(
                '存储权限错误：请确认 Firebase Storage 安全规则已正确配置。\n' +
                '规则应允许认证用户写入 reel-images/{userId}/ 路径。\n' +
                '详细错误: ' + error.message
            );
        }
        
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
    
    const galleryItemData = {
        ...item,
        uid: userId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    console.log('[Gallery] Saving to Firestore:', {
        userId,
        itemType: item.type,
        aspectRatio: item.aspectRatio,
        hasFileUrl: !!item.fileUrl,
        fileUrlPreview: item.fileUrl?.substring(0, 50) + '...'
    });
    
    try {
        const galleryRef = db.collection('gallery');
        const docRef = await galleryRef.add(galleryItemData);
        console.log('[Gallery] ✅ Document created in Firestore:', {
            docId: docRef.id,
            path: docRef.path
        });
        
        // 可选：验证文档是否真的创建成功
        // const doc = await docRef.get();
        // if (!doc.exists) {
        //     throw new Error('Document was not created successfully');
        // }
        // console.log('[Gallery] ✅ Document verified:', doc.data());
        
    } catch (error: any) {
        console.error('[Gallery] ❌ Failed to save gallery item:', error);
        console.error('[Gallery] Error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack,
            serverResponse: error.serverResponse
        });
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
        console.log('[Gallery] 📡 Setting up subscription for userId:', userId);
        
        // 先尝试使用复合查询（需要 Firestore 索引）
        // 如果失败，回退到简单查询
        let galleryRef = db.collection('gallery')
            .where('uid', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(50);
        
        const unsubscribe = galleryRef.onSnapshot(
            (snapshot) => {
                console.log('[Gallery] 📡 Snapshot received:', {
                    hasPendingWrites: snapshot.metadata.hasPendingWrites,
                    isFromCache: snapshot.metadata.fromCache,
                    size: snapshot.size,
                    empty: snapshot.empty
                });
                
                const items: GalleryItem[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const item = {
                        id: doc.id,
                        ...data
                    } as GalleryItem;
                    items.push(item);
                    
                    // 详细日志：显示每个文档的信息
                    console.log('[Gallery] 📄 Document:', {
                        id: doc.id,
                        type: data.type,
                        uid: data.uid,
                        hasFileUrl: !!data.fileUrl,
                        createdAt: data.createdAt ? (typeof data.createdAt.toMillis === 'function' ? new Date(data.createdAt.toMillis()).toISOString() : data.createdAt.toString()) : 'N/A',
                        prompt: data.prompt?.substring(0, 30) + '...'
                    });
                });
                
                // 如果使用复合查询失败，按创建时间排序
                items.sort((a, b) => {
                    const aTime = a.createdAt?.toMillis?.() || 0;
                    const bTime = b.createdAt?.toMillis?.() || 0;
                    return bTime - aTime;
                });
                
                console.log('[Gallery] ✅ Sending items to callback:', {
                    totalItems: items.length,
                    userId: userId,
                    itemIds: items.map(i => i.id)
                });
                
                callback(items);
            },
            (error) => {
                console.error('[Gallery] ❌ Subscription error (trying fallback):', error);
                console.error('[Gallery] Error details:', {
                    code: error.code,
                    message: error.message
                });
                
                // 回退到简单查询（不需要索引）
                // 重要：增加 limit 到 200，然后在客户端排序并取前 50
                // 这确保即使没有 orderBy，我们也能获取到最新的文档
                try {
                    console.log('[Gallery] 🔄 Using fallback query (no orderBy, fetching more docs)');
                    const fallbackRef = db.collection('gallery')
                        .where('uid', '==', userId)
                        .limit(200); // 增加 limit，确保能获取到所有可能的文档
                    
                    fallbackRef.onSnapshot(
                        (snapshot) => {
                            console.log('[Gallery] 📡 Fallback snapshot received:', {
                                size: snapshot.size,
                                empty: snapshot.empty
                            });
                            
                            const items: GalleryItem[] = [];
                            snapshot.forEach((doc) => {
                                const data = doc.data();
                                const item = {
                                    id: doc.id,
                                    ...data
                                } as GalleryItem;
                                items.push(item);
                                
                                // 详细日志：显示每个文档的信息
                                console.log('[Gallery] 📄 Fallback Document:', {
                                    id: doc.id,
                                    type: data.type,
                                    uid: data.uid,
                                    hasFileUrl: !!data.fileUrl,
                                    createdAt: data.createdAt ? (typeof data.createdAt.toMillis === 'function' ? new Date(data.createdAt.toMillis()).toISOString() : data.createdAt.toString()) : 'N/A',
                                    prompt: data.prompt?.substring(0, 30) + '...'
                                });
                            });
                            
                            // 客户端排序（按创建时间降序）
                            items.sort((a, b) => {
                                const aTime = a.createdAt?.toMillis?.() || 0;
                                const bTime = b.createdAt?.toMillis?.() || 0;
                                return bTime - aTime;
                            });
                            
                            // 只取前 50 个（最新的）
                            const topItems = items.slice(0, 50);
                            
                            console.log('[Gallery] ✅ Fallback: Sending items to callback:', {
                                totalFetched: items.length,
                                totalSent: topItems.length,
                                itemIds: topItems.map(i => i.id)
                            });
                            
                            callback(topItems);
                        },
                        (fallbackError) => {
                            console.error('[Gallery] ❌ Fallback subscription error:', fallbackError);
                            callback([]);
                        }
                    );
                } catch (fallbackErr) {
                    console.error('[Gallery] ❌ Failed to set up fallback gallery subscription:', fallbackErr);
                    callback([]);
                }
            }
        );
        
        console.log('[Gallery] ✅ Subscription set up successfully');
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

