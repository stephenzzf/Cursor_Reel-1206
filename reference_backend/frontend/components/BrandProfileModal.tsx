import React, { useState, useEffect, useCallback } from 'react';
import { BrandProfile } from '../types';

interface BrandProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: BrandProfile;
    onSave: (profile: BrandProfile) => void;
}

const TagInput: React.FC<{
    label: string;
    tags: string[];
    setTags: (tags: string[]) => void;
}> = ({ label, tags, setTags }) => {
    const [inputValue, setInputValue] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const newTag = inputValue.trim();
            if (newTag && !tags.includes(newTag)) {
                setTags([...tags, newTag]);
            }
            setInputValue('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <div className="mt-1 flex flex-wrap items-center gap-2 p-2 border border-gray-300 rounded-md">
                {tags.map(tag => (
                    <span key={tag} className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="ml-1.5 text-blue-500 hover:text-blue-700">
                            &times;
                        </button>
                    </span>
                ))}
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a tag and press Enter"
                    className="flex-grow p-0 border-0 focus:ring-0 text-sm"
                />
            </div>
        </div>
    );
};

const BrandProfileModal: React.FC<BrandProfileModalProps> = ({ isOpen, onClose, profile, onSave }) => {
    const [localProfile, setLocalProfile] = useState<BrandProfile>(profile);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLocalProfile(profile);
    }, [profile]);

    const handleSave = () => {
        onSave(localProfile);
    };
    
    const handleExport = () => {
        const jsonString = JSON.stringify(localProfile, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'brand_profile.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result;
                    if (typeof text === 'string') {
                        const importedProfile = JSON.parse(text);
                        // Basic validation could be added here
                        setLocalProfile(importedProfile);
                    }
                } catch (error) {
                    console.error("Error parsing imported JSON:", error);
                    alert("Import failed: Invalid JSON file.");
                }
            };
            reader.readAsText(file);
        }
    };

    if (!isOpen) return null;

    // Guard clause to prevent rendering with invalid data (e.g., from a bad import)
    if (!localProfile || !localProfile.projects || localProfile.projects.length === 0) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
                <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-4 border-b">
                        <h2 className="text-xl font-semibold text-gray-800">Invalid Profile</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
                    </div>
                    <div className="p-6">
                        <p className="text-red-600">The loaded brand profile is invalid because it contains no projects. Please import a valid profile or restart the process.</p>
                    </div>
                     <div className="flex justify-end items-center p-4 border-t bg-gray-50">
                         <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                            Close
                        </button>
                     </div>
                </div>
            </div>
        );
    }
    
    // Assuming we are always editing the first project for this UI
    const currentProject = localProfile.projects[0];

    const handleGlobalChange = (field: string, value: any) => {
        setLocalProfile(prev => ({ ...prev, globalInfo: { ...prev.globalInfo, [field]: value } }));
    };
    
    const handleVoiceChange = (field: string, value: any) => {
        setLocalProfile(prev => ({ 
            ...prev, 
            globalInfo: { 
                ...prev.globalInfo, 
                brand_voice: { ...prev.globalInfo.brand_voice, [field]: value } 
            } 
        }));
    };
    
    const handleProjectChange = (field: string, value: any) => {
        const updatedProject = { ...currentProject, [field]: value };
        setLocalProfile(prev => ({
            ...prev,
            projects: [updatedProject, ...prev.projects.slice(1)]
        }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-semibold text-gray-800">Edit Brand Profile</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* --- Global Info --- */}
                    <div className="border p-4 rounded-md">
                        <h3 className="font-semibold text-lg mb-3 text-gray-700">Global Brand Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Brand Name</label>
                                <input type="text" value={localProfile.globalInfo.brand_name} onChange={e => handleGlobalChange('brand_name', e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Brand Industry</label>
                                <input type="text" value={localProfile.globalInfo.brand_industry} onChange={e => handleGlobalChange('brand_industry', e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Brand Voice (Tone)</label>
                                <input type="text" value={localProfile.globalInfo.brand_voice.tone} onChange={e => handleVoiceChange('tone', e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Brand Voice (Style)</label>
                                <input type="text" value={localProfile.globalInfo.brand_voice.style} onChange={e => handleVoiceChange('style', e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
                            </div>
                            <div className="md:col-span-2">
                               <TagInput label="Brand Values" tags={localProfile.globalInfo.brand_voice.values} setTags={tags => handleVoiceChange('values', tags)} />
                            </div>
                            <div className="md:col-span-2">
                               <TagInput label="Global Negative Keywords" tags={localProfile.globalInfo.negative_keywords_global} setTags={tags => handleGlobalChange('negative_keywords_global', tags)} />
                            </div>
                        </div>
                    </div>

                    {/* --- Brand Profile Text (from Backend) --- */}
                    {localProfile.globalInfo.text_profile && (
                        <div className="border p-4 rounded-md">
                            <h3 className="font-semibold text-lg mb-3 text-gray-700">Brand Profile Analysis</h3>
                            <div className="bg-gray-50 p-4 rounded-md max-h-96 overflow-y-auto">
                                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                                    {localProfile.globalInfo.text_profile}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* --- Brand Assets (from Backend) --- */}
                    {localProfile.globalInfo.assets && (
                        <div className="border p-4 rounded-md">
                            <h3 className="font-semibold text-lg mb-3 text-gray-700">Brand Assets</h3>
                            
                            {/* Logos Section */}
                            {localProfile.globalInfo.assets.logos && localProfile.globalInfo.assets.logos.length > 0 && (
                                <div className="mb-6">
                                    <h4 className="font-medium text-md mb-3 text-gray-600">Logos</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                        {localProfile.globalInfo.assets.logos.map((logo, index) => (
                                            <div key={index} className="relative aspect-square border border-gray-200 rounded-md overflow-hidden bg-gray-100">
                                                <img 
                                                    src={logo.stored_url_public} 
                                                    alt={`Logo ${index + 1}`}
                                                    className="w-full h-full object-contain"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Images Section */}
                            {localProfile.globalInfo.assets.images && localProfile.globalInfo.assets.images.length > 0 && (
                                <div>
                                    <h4 className="font-medium text-md mb-3 text-gray-600">Images</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {localProfile.globalInfo.assets.images.map((image, index) => (
                                            <div key={index} className="relative aspect-square border border-gray-200 rounded-md overflow-hidden bg-gray-100">
                                                <img 
                                                    src={image.stored_url_public} 
                                                    alt={`Image ${index + 1}`}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {(!localProfile.globalInfo.assets.logos || localProfile.globalInfo.assets.logos.length === 0) && 
                             (!localProfile.globalInfo.assets.images || localProfile.globalInfo.assets.images.length === 0) && (
                                <p className="text-sm text-gray-500">No assets available.</p>
                            )}
                        </div>
                    )}

                    {/* --- Project Info --- */}
                    <div className="border p-4 rounded-md">
                        <h3 className="font-semibold text-lg mb-3 text-gray-700">Current Project Config</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Project URL</label>
                                <input type="text" value={currentProject.project_url} disabled className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-100 sm:text-sm"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Target Region</label>
                                <select 
                                    value={currentProject.target_region} 
                                    onChange={e => handleProjectChange('target_region', e.target.value)} 
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                >
                                    <option value="United States">United States</option>
                                    <option value="United Kingdom">United Kingdom</option>
                                    <option value="Canada">Canada</option>
                                    <option value="Australia">Australia</option>
                                    <option value="Global">Global</option>
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Target Language</label>
                                <select 
                                    value={currentProject.target_language} 
                                    onChange={e => handleProjectChange('target_language', e.target.value)} 
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                >
                                    <option value="English">English</option>
                                    <option value="Spanish">Spanish</option>
                                    <option value="German">German</option>
                                    <option value="French">French</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                               <TagInput label="Project Specific Keywords" tags={currentProject.target_keywords} setTags={tags => handleProjectChange('target_keywords', tags)} />
                            </div>
                            <div className="md:col-span-2">
                                <TagInput label="Preferred Solution Focus" tags={currentProject.preferred_solution_focus} setTags={tags => handleProjectChange('preferred_solution_focus', tags)} />
                            </div>
                         </div>
                         
                         {/* --- Analysis Snapshot --- */}
                         {currentProject.seo_diagnosis_report && (
                            <div className="mt-4 border-t pt-4">
                                <h4 className="font-semibold text-md mb-3 text-gray-600">Last Analysis Snapshot</h4>
                                <div className="space-y-3 text-sm bg-gray-50 p-3 rounded-md">
                                    <div>
                                        <span className="font-medium text-gray-700">SEO Health Score:</span>
                                        <span className="ml-2 font-bold text-blue-600 text-base">{currentProject.seo_diagnosis_report.contentSeoHealthScore}/100</span>
                                    </div>
                                    {currentProject.competitor_list && currentProject.competitor_list.length > 0 && (
                                        <div>
                                            <p className="font-medium text-gray-700 mb-1">Confirmed Competitors:</p>
                                            <ul className="list-disc list-inside pl-2 space-y-1">
                                                {currentProject.competitor_list.map((competitor, index) => (
                                                <li key={index} className="text-gray-600">{competitor.url}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {/* --- Last Creation Summary --- */}
                        {currentProject.last_used_solution && (
                            <div className="mt-4 border-t pt-4">
                                <h4 className="font-semibold text-md mb-3 text-gray-600">Last Creation Summary</h4>
                                <div className="space-y-3 text-sm bg-gray-50 p-3 rounded-md">
                                    {currentProject.last_used_solution && (
                                        <div>
                                            <p className="font-medium text-gray-700 mb-1">Selected Solution: <span className="font-normal">{currentProject.last_used_solution.strategyName}</span></p>
                                            <p className="text-gray-600 pl-2 border-l-2 border-gray-200">{currentProject.last_used_solution.coreConcept}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                         {/* --- Project Keyword History --- */}
                        {currentProject.project_keyword_history && currentProject.project_keyword_history.length > 0 && (
                            <div className="mt-4 border-t pt-4">
                                <h4 className="font-semibold text-md mb-3 text-gray-600">Project Keyword History</h4>
                                <div className="space-y-3 text-sm bg-gray-50 p-3 rounded-md">
                                     <div className="flex flex-wrap gap-2">
                                        {currentProject.project_keyword_history.map(keyword => (
                                            <span key={keyword} className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                                {keyword}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center p-4 border-t bg-gray-50">
                    <div>
                        <button onClick={handleImportClick} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                            Import .json
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                        <button onClick={handleExport} className="ml-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                            Export .json
                        </button>
                    </div>
                    <div>
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                            Cancel
                        </button>
                        <button onClick={handleSave} className="ml-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrandProfileModal;