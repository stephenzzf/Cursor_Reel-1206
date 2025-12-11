
import React, { useState, useRef } from 'react';
import { extractBrandDNA } from '../../services/geminiService';
import { createVisualProfile, updateVisualProfile } from '../../services/brandProfileService';
import { BrandVisualProfile } from '../../types';
import { SparklesIcon, PhotoIcon, PencilIcon, VideoCameraIcon } from './ImageGenAssets';

interface BrandProfileManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    profiles: BrandVisualProfile[];
    activeProfileId: string | null;
    onSetActive: (id: string | null) => void;
    onDelete: (id: string) => void;
    mode?: 'image' | 'video' | 'reel'; // New prop to control visibility
}

const BrandProfileManagerModal: React.FC<BrandProfileManagerModalProps> = ({ 
    isOpen, onClose, profiles, activeProfileId, onSetActive, onDelete, mode = 'image' 
}) => {
    const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'edit'>('manage');
    
    // Create State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    
    // Edit State
    const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<BrandVisualProfile>>({});

    // UI State
    const [deletingId, setDeletingId] = useState<string | null>(null); // For two-step delete

    // Image State
    const [logoImage, setLogoImage] = useState<File | null>(null);
    const [referenceImages, setReferenceImages] = useState<File[]>([]);
    
    // Video State
    const [videoUrls, setVideoUrls] = useState<string[]>(['']);

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<Partial<BrandVisualProfile> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Refs for hidden inputs
    const logoInputRef = useRef<HTMLInputElement>(null);
    const refInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    // --- FILE HANDLERS ---

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setLogoImage(e.target.files[0]);
        }
        e.target.value = '';
    };

    const handleReferencesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setReferenceImages(prev => [...prev, ...newFiles].slice(0, 5)); // Cap at 5 total
        }
        e.target.value = '';
    };

    const removeReference = (index: number) => {
        setReferenceImages(prev => prev.filter((_, i) => i !== index));
    };

    const removeLogo = () => {
        setLogoImage(null);
    };

    // --- VIDEO URL HANDLERS ---
    const handleVideoUrlChange = (index: number, value: string) => {
        const newUrls = [...videoUrls];
        newUrls[index] = value;
        setVideoUrls(newUrls);
    };

    const addVideoUrl = () => {
        if (videoUrls.length < 3) {
            setVideoUrls([...videoUrls, '']);
        }
    };

    const removeVideoUrl = (index: number) => {
        const newUrls = videoUrls.filter((_, i) => i !== index);
        setVideoUrls(newUrls.length > 0 ? newUrls : ['']);
    };

    // --- ANALYSIS LOGIC ---

    const handleAnalyze = async () => {
        if ((!logoImage && referenceImages.length === 0) || !name.trim()) {
            alert("请至少填写品牌名称并上传一张参考图片或Logo。");
            return;
        }
        
        setIsAnalyzing(true);
        try {
            const processFile = async (file: File) => {
                const buffer = await file.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                return {
                    data: btoa(binary),
                    mimeType: file.type
                };
            };

            const logoData = logoImage ? await processFile(logoImage) : null;
            const refData = await Promise.all(referenceImages.map(processFile));
            
            // Only include video URLs if not in image mode
            const validVideoUrls = mode !== 'image' ? videoUrls.filter(u => u.trim() !== '') : [];

            const result = await extractBrandDNA(logoData, refData, description, validVideoUrls);
            setAnalysisResult(result);
        } catch (error) {
            console.error("Analysis failed", error);
            alert("AI 分析失败，请检查网络连接或稍后重试。");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // --- SAVE LOGIC (CREATE) ---

    const handleSave = async () => {
        if (!analysisResult) return;
        setIsSaving(true);
        try {
            await createVisualProfile({
                name,
                description,
                visualStyle: analysisResult.visualStyle || '',
                colorPalette: analysisResult.colorPalette || '',
                mood: analysisResult.mood || '',
                negativeConstraint: analysisResult.negativeConstraint || '',
                motionStyle: analysisResult.motionStyle || '',
                videoRefs: videoUrls.filter(u => u.trim() !== ''),
                isActive: true 
            });
            
            // Reset and go to list
            setName('');
            setDescription('');
            setLogoImage(null);
            setReferenceImages([]);
            setVideoUrls(['']);
            setAnalysisResult(null);
            setActiveTab('manage');
        } catch (error) {
            console.error("Save failed", error);
            alert("保存失败：可能是网络问题或权限不足。请刷新页面后重试。");
        } finally {
            setIsSaving(false);
        }
    };

    // --- EDIT LOGIC ---

    const startEdit = (profile: BrandVisualProfile) => {
        setEditingProfileId(profile.id);
        setEditFormData({
            name: profile.name,
            description: profile.description,
            visualStyle: profile.visualStyle,
            colorPalette: profile.colorPalette,
            mood: profile.mood,
            negativeConstraint: profile.negativeConstraint,
            motionStyle: profile.motionStyle
        });
        setActiveTab('edit');
    };

    const handleUpdate = async () => {
        if (!editingProfileId) return;
        setIsSaving(true);
        try {
            await updateVisualProfile(editingProfileId, editFormData);
            setEditingProfileId(null);
            setActiveTab('manage');
        } catch (error) {
            console.error("Update failed", error);
            alert("更新失败，请重试。");
        } finally {
            setIsSaving(false);
        }
    };

    // --- DELETE LOGIC (Two-Step) ---
    const handleConfirmDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeletingId(null); 
        onDelete(id);
    };

    const handleCreateTabClick = () => {
        if (profiles.length >= 2) {
            alert("Brand DNA 数量已达上限 (2个)。\n请先删除一个旧的 DNA，才能提取新的。");
            return;
        }
        setActiveTab('create');
    };

    // Helper to get display fields based on mode
    const getDisplayFields = () => {
        const fields = [
            { label: '视觉风格 (Style)', key: 'visualStyle', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
            { label: '核心配色 (Palette)', key: 'colorPalette', color: 'bg-pink-50 text-pink-700 border-pink-100' },
            { label: '情感氛围 (Mood)', key: 'mood', color: 'bg-amber-50 text-amber-700 border-amber-100' },
            { label: '动态运镜 (Motion)', key: 'motionStyle', color: 'bg-purple-50 text-purple-700 border-purple-100' },
            { label: '避讳元素 (Negative)', key: 'negativeConstraint', color: 'bg-slate-100 text-slate-600 border-slate-200' },
        ];
        
        // If mode is 'image', hide Motion Style
        if (mode === 'image') {
            return fields.filter(f => f.key !== 'motionStyle');
        }
        return fields;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <span className="text-2xl">🧬</span> Brand DNA 管理
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">建立专属视觉规范，让 AI 生成符合品牌调性的图片与视频</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 bg-slate-50/50">
                    <button 
                        onClick={() => setActiveTab('manage')}
                        className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === 'manage' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        管理 DNA ({profiles.length})
                    </button>
                    {activeTab === 'edit' ? (
                        <button 
                            className={`flex-1 py-4 text-sm font-bold transition-colors text-indigo-600 border-b-2 border-indigo-600 bg-white`}
                        >
                            编辑 DNA
                        </button>
                    ) : (
                        <button 
                            onClick={handleCreateTabClick}
                            className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === 'create' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-slate-500 hover:text-slate-700'} ${profiles.length >= 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={profiles.length >= 2 ? "数量已达上限 (2/2)" : ""}
                        >
                            提取新 DNA {profiles.length >= 2 && <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded ml-1">FULL</span>}
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                    
                    {/* --- MANAGE TAB --- */}
                    {activeTab === 'manage' && (
                        <div className="space-y-4">
                            {profiles.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🧬</div>
                                    <p>暂无品牌 DNA</p>
                                    <button onClick={handleCreateTabClick} className="mt-4 text-indigo-600 font-bold hover:underline">立即提取</button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {profiles.map(profile => (
                                        <div key={profile.id} className={`bg-white p-5 rounded-xl border transition-all ${activeProfileId === profile.id ? 'border-indigo-500 ring-2 ring-indigo-100 shadow-md' : 'border-slate-200 hover:border-indigo-300'}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="font-bold text-slate-800">{profile.name}</h3>
                                                    <p className="text-xs text-slate-500 line-clamp-1">{profile.description}</p>
                                                </div>
                                                {activeProfileId === profile.id && (
                                                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Active</span>
                                                )}
                                            </div>
                                            
                                            <div className="space-y-2 mb-4">
                                                <div className="flex gap-2 text-xs">
                                                    <span className="text-slate-400 font-medium shrink-0">风格:</span>
                                                    <span className="text-slate-700 truncate flex-1" title={profile.visualStyle}>{profile.visualStyle}</span>
                                                </div>
                                                <div className="flex gap-2 text-xs">
                                                    <span className="text-slate-400 font-medium shrink-0">配色:</span>
                                                    <span className="text-slate-700 truncate flex-1" title={profile.colorPalette}>{profile.colorPalette}</span>
                                                </div>
                                                {/* Only show Motion Style if NOT in image mode or if user is on Reel page */}
                                                {mode !== 'image' && profile.motionStyle && (
                                                    <div className="flex gap-2 text-xs">
                                                        <span className="text-slate-400 font-medium shrink-0">动态:</span>
                                                        <span className="text-slate-700 truncate flex-1" title={profile.motionStyle}>{profile.motionStyle}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex justify-between pt-3 border-t border-slate-50 items-center">
                                                <div className="flex gap-2 items-center">
                                                    {deletingId === profile.id ? (
                                                        <div className="flex gap-2 animate-fade-in">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleConfirmDelete(e, profile.id)}
                                                                className="bg-red-500 text-white hover:bg-red-600 text-[10px] font-bold px-2 py-1 rounded transition-colors shadow-sm"
                                                            >
                                                                确认删除?
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                                                                className="text-slate-500 hover:text-slate-700 text-[10px] px-2 py-1 hover:bg-slate-100 rounded transition-colors"
                                                            >
                                                                取消
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); setDeletingId(profile.id); }}
                                                            className="text-red-400 hover:text-red-600 text-xs font-medium px-2 py-1 hover:bg-red-50 rounded transition-colors"
                                                        >
                                                            删除
                                                        </button>
                                                    )}
                                                    
                                                    {deletingId !== profile.id && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); startEdit(profile); }}
                                                            className="text-slate-400 hover:text-slate-600 text-xs font-medium px-2 py-1 hover:bg-slate-100 rounded flex items-center transition-colors"
                                                        >
                                                            <PencilIcon className="w-3 h-3 mr-1" /> 编辑
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                {activeProfileId !== profile.id ? (
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); onSetActive(profile.id); }}
                                                        className="bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                                                    >
                                                        启用此 DNA
                                                    </button>
                                                ) : (
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); onSetActive(null); }}
                                                        className="bg-indigo-50 text-indigo-400 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors hover:bg-indigo-100 hover:text-indigo-600"
                                                    >
                                                        停用
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- CREATE TAB --- */}
                    {activeTab === 'create' && (
                        <div className="space-y-6 max-w-2xl mx-auto">
                            {!analysisResult ? (
                                // Step 1: Input Form
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 animate-fade-in-up">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-bold text-slate-700 mb-1">品牌名称 <span className="text-red-500">*</span></label>
                                            <input 
                                                type="text" 
                                                value={name} 
                                                onChange={e => setName(e.target.value)} 
                                                placeholder="例如: Tesla, Nike..." 
                                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-bold text-slate-700 mb-1">品牌描述 (可选)</label>
                                            <textarea 
                                                value={description} 
                                                onChange={e => setDescription(e.target.value)} 
                                                placeholder="简要描述品牌调性，例如：极简主义、科技感、环保..." 
                                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none h-20 resize-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Upload Sections */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                        
                                        {/* Logo Upload */}
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">品牌 Logo (单张)</label>
                                            <p className="text-xs text-slate-400 mb-2">提取核心识别色和图形元素</p>
                                            <div 
                                                onClick={() => logoInputRef.current?.click()}
                                                className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all h-32 relative group overflow-hidden ${logoImage ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
                                            >
                                                <input type="file" ref={logoInputRef} accept="image/*" onChange={handleLogoChange} className="hidden" />
                                                
                                                {logoImage ? (
                                                    <>
                                                        <img src={URL.createObjectURL(logoImage)} alt="logo preview" className="h-full object-contain z-10 relative" />
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); removeLogo(); }} 
                                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs z-20 hover:bg-red-600"
                                                        >
                                                            &times;
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1 group-hover:text-indigo-500 transition-colors">
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" /></svg>
                                                        </div>
                                                        <span className="text-xs text-slate-500 font-medium">点击上传 Logo</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Reference Images Upload */}
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">风格参考图 (多张)</label>
                                            <p className="text-xs text-slate-400 mb-2">提取光影、构图和整体氛围</p>
                                            
                                            <div className="space-y-3">
                                                <div 
                                                    onClick={() => refInputRef.current?.click()}
                                                    className="border-2 border-dashed border-slate-300 rounded-xl p-3 flex items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-slate-50 transition-all h-12"
                                                >
                                                    <input type="file" ref={refInputRef} multiple accept="image/*" onChange={handleReferencesChange} className="hidden" />
                                                    <PhotoIcon className="w-4 h-4 text-slate-400 mr-2" />
                                                    <span className="text-xs text-slate-600 font-medium">添加图片 ({referenceImages.length}/5)</span>
                                                </div>

                                                {referenceImages.length > 0 && (
                                                    <div className="flex gap-2 overflow-x-auto pb-2 min-h-[60px]">
                                                        {referenceImages.map((file, i) => (
                                                            <div key={i} className="w-14 h-14 rounded-lg border border-slate-200 overflow-hidden relative flex-shrink-0 group bg-slate-50">
                                                                <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="ref" />
                                                                <button 
                                                                    onClick={() => removeReference(i)} 
                                                                    className="absolute top-0 right-0 bg-black/50 hover:bg-red-500 text-white w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                                                                >
                                                                    <span className="text-xs">删除</span>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Video URLs Section - Conditionally Rendered */}
                                    {mode !== 'image' && (
                                        <div className="pt-2 border-t border-slate-100/50">
                                            <label className="block text-sm font-bold text-slate-700 mb-2">动态参考 (YouTube URL)</label>
                                            <p className="text-xs text-slate-400 mb-2">通过搜索分析视频风格，提取运镜和节奏 (Max 3)</p>
                                            
                                            <div className="space-y-2">
                                                {videoUrls.map((url, idx) => (
                                                    <div key={idx} className="flex gap-2">
                                                        <div className="flex-1 relative">
                                                            <VideoCameraIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                            <input 
                                                                type="text" 
                                                                value={url}
                                                                onChange={(e) => handleVideoUrlChange(idx, e.target.value)}
                                                                placeholder="https://youtube.com/watch?v=..."
                                                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                                                            />
                                                        </div>
                                                        {videoUrls.length > 1 && (
                                                            <button 
                                                                onClick={() => removeVideoUrl(idx)} 
                                                                className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                &times;
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {videoUrls.length < 3 && (
                                                    <button onClick={addVideoUrl} className="text-xs text-indigo-600 font-bold hover:underline flex items-center mt-1">
                                                        + 添加更多链接
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-4 border-t border-slate-100">
                                        <button 
                                            onClick={handleAnalyze} 
                                            disabled={isAnalyzing || !name || (!logoImage && referenceImages.length === 0)}
                                            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center text-sm"
                                        >
                                            {isAnalyzing ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                    AI 正在分析 Logo 与参考素材...
                                                </>
                                            ) : (
                                                <>
                                                    <SparklesIcon className="w-5 h-5 mr-2" />
                                                    开始提取 DNA
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // Step 2: Review Result
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5 animate-fade-in-up">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-lg text-slate-800">提取结果确认</h3>
                                        <button onClick={() => setAnalysisResult(null)} className="text-xs text-slate-400 hover:text-slate-600 underline">重新分析</button>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        {getDisplayFields().map((field) => (
                                            <div key={field.key} className="space-y-1">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{field.label}</label>
                                                <textarea 
                                                    value={(analysisResult as any)[field.key]} 
                                                    onChange={e => setAnalysisResult({...analysisResult, [field.key]: e.target.value})}
                                                    className={`w-full p-3 rounded-lg text-sm border focus:ring-2 focus:ring-indigo-100 outline-none resize-none transition-shadow ${field.color}`}
                                                    rows={2}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-2">
                                        <button 
                                            onClick={handleSave} 
                                            disabled={isSaving}
                                            className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                    正在保存到云端...
                                                </>
                                            ) : (
                                                '确认并保存 DNA'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- EDIT TAB --- */}
                    {activeTab === 'edit' && editingProfileId && (
                        <div className="space-y-6 max-w-2xl mx-auto">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5 animate-fade-in-up">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <h3 className="font-bold text-lg text-slate-800">编辑 Brand DNA</h3>
                                    <button onClick={() => setActiveTab('manage')} className="text-xs text-slate-400 hover:text-slate-600 underline">取消编辑</button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">品牌名称</label>
                                        <input 
                                            type="text" 
                                            value={editFormData.name || ''} 
                                            onChange={e => setEditFormData({...editFormData, name: e.target.value})} 
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">描述</label>
                                        <textarea 
                                            value={editFormData.description || ''} 
                                            onChange={e => setEditFormData({...editFormData, description: e.target.value})} 
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none h-16 resize-none transition-all"
                                        />
                                    </div>
                                </div>
                                
                                <div className="space-y-4 pt-2">
                                    {getDisplayFields().map((field) => (
                                        <div key={field.key} className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{field.label}</label>
                                            <textarea 
                                                value={(editFormData as any)[field.key] || ''} 
                                                onChange={e => setEditFormData({...editFormData, [field.key]: e.target.value})}
                                                className={`w-full p-3 rounded-lg text-sm border focus:ring-2 focus:ring-indigo-100 outline-none resize-none transition-shadow ${field.color}`}
                                                rows={2}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-2">
                                    <button 
                                        onClick={handleUpdate} 
                                        disabled={isSaving}
                                        className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                                    >
                                        {isSaving ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                正在更新...
                                            </>
                                        ) : (
                                            '保存修改'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BrandProfileManagerModal;
