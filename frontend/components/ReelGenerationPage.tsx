
import React from 'react';
import { useReelGeneration } from '../hooks/useReelGeneration';
import { Header } from './reel_gen/ReelGenAssets';
import ReelChatSidebar from './reel_gen/ReelChatSidebar';
import ReelCanvas from './reel_gen/ReelCanvas';
import BrandProfileManagerModal from './reel_gen/BrandProfileManagerModal';  // 从 reel_gen 目录导入
import { useUserProfile } from '../hooks/useUserProfile';
import UserStatusChip from './common/UserStatusChip';
// ConfigErrorBanner 暂时注释，如果不存在则移除
// import { ConfigErrorBanner } from './workspace/WorkspaceUI';

interface ReelGenerationPageProps {
    initialPrompt: string;
    onReset: () => void;
}

const ReelGenerationPage: React.FC<ReelGenerationPageProps> = ({ initialPrompt, onReset }) => {
    const { userProfile, loading: isProfileLoading, logout } = useUserProfile();
    
    const {
        messages, assets, userInput, setUserInput, uploadedFiles, isLoading,
        selectedAssetId, setSelectedAssetId, isArchiveOpen, setIsArchiveOpen,
        enhancePromptEnabled, setEnhancePromptEnabled, designInspirationEnabled, setDesignInspirationEnabled,
        selectedModel, setSelectedModel,
        transform, toolMode, setToolMode, chattingAssetId, onCanvasChatInput, setOnCanvasChatInput,
        handleFileChange, handleRemoveFile, handlePaste, handleSubmit, handleOnCanvasChatSubmit,
        handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasWheel, handleAssetMouseDown,
        zoom, setZoomLevel, fitToScreen, galleryItems, canvasRef, messagesEndRef, userInputRef,
        // New Handlers
        handleDownload, handleCopyFrame, handleUpscale, handleRemoveBackground, handleRegenerate,
        isUpscaling, processingAction, handleSwitchModel, handleUseSuggestion, handleUseDesignPlan,
        snapGuides,
        // Brand DNA
        visualProfiles, activeProfile, setActiveProfile, deleteProfile, isDNAOpen, setIsDNAOpen,
        configError, setConfigError
    } = useReelGeneration(initialPrompt, userProfile, isProfileLoading);

    return (
        <div className="h-screen w-screen flex flex-col font-sans bg-[#F8F9FC] text-slate-600 relative">
            <UserStatusChip profile={userProfile} onLogout={logout} />
            <Header 
                onReset={onReset} 
                onOpenArchive={() => setIsArchiveOpen(true)}
                onOpenBrandDNA={() => setIsDNAOpen(true)} 
                activeDNA={activeProfile?.name}
            />
            
            {/* Brand DNA Manager Modal */}
            <BrandProfileManagerModal 
                isOpen={isDNAOpen} 
                onClose={() => setIsDNAOpen(false)}
                profiles={visualProfiles}
                activeProfileId={activeProfile?.id || null}
                onSetActive={setActiveProfile}
                onDelete={deleteProfile}
                mode="reel"  // Explicitly set mode to reel/video
            />

            {/* Config Error Banner */}
            {configError && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mx-6 mt-2 rounded">
                    <div className="flex">
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                                配置错误: {configError === 'PERMISSION_DENIED' ? 'Firestore 权限不足，请检查安全规则配置' : configError}
                            </p>
                        </div>
                        <button onClick={() => setConfigError(null)} className="ml-auto text-yellow-700 hover:text-yellow-900">
                            ×
                        </button>
                    </div>
                </div>
            )}
            
            <div className="flex-1 flex overflow-hidden">
                <ReelChatSidebar 
                    messages={messages}
                    assets={assets}
                    isLoading={isLoading}
                    userInput={userInput}
                    setUserInput={setUserInput}
                    uploadedFiles={uploadedFiles}
                    handleFileChange={handleFileChange}
                    handleRemoveFile={handleRemoveFile}
                    handlePaste={handlePaste}
                    handleSubmit={handleSubmit}
                    enhancePromptEnabled={enhancePromptEnabled}
                    setEnhancePromptEnabled={setEnhancePromptEnabled}
                    designInspirationEnabled={designInspirationEnabled}
                    setDesignInspirationEnabled={setDesignInspirationEnabled}
                    selectedModel={selectedModel}
                    setSelectedModel={setSelectedModel}
                    isArchiveOpen={isArchiveOpen}
                    setIsArchiveOpen={setIsArchiveOpen}
                    galleryItems={galleryItems}
                    userInputRef={userInputRef}
                    messagesEndRef={messagesEndRef}
                    onSwitchModel={handleSwitchModel}
                    handleUseSuggestion={handleUseSuggestion}
                    handleUseDesignPlan={handleUseDesignPlan}
                    setSelectedAssetId={setSelectedAssetId}
                    // Brand DNA Props
                    activeDNAName={activeProfile?.name}
                    onDeactivateDNA={() => setActiveProfile(null)}
                />
                
                <ReelCanvas
                    assets={assets}
                    selectedAssetId={selectedAssetId}
                    transform={transform}
                    toolMode={toolMode}
                    chattingAssetId={chattingAssetId}
                    isLoading={isLoading}
                    
                    canvasRef={canvasRef}
                    
                    setToolMode={setToolMode}
                    handleCanvasMouseDown={handleCanvasMouseDown}
                    handleCanvasMouseMove={handleCanvasMouseMove}
                    handleCanvasMouseUp={handleCanvasMouseUp}
                    handleCanvasWheel={handleCanvasWheel}
                    handleAssetMouseDown={handleAssetMouseDown}
                    zoom={zoom}
                    setZoomLevel={setZoomLevel}
                    fitToScreen={fitToScreen}
                    
                    onCanvasChatInput={onCanvasChatInput}
                    setOnCanvasChatInput={setOnCanvasChatInput}
                    handleOnCanvasChatSubmit={handleOnCanvasChatSubmit}
                    
                    // Toolbar Actions
                    handleDownload={handleDownload}
                    handleCopyFrame={handleCopyFrame}
                    handleUpscale={handleUpscale}
                    handleRemoveBackground={handleRemoveBackground}
                    handleRegenerate={handleRegenerate}
                    isUpscaling={isUpscaling}
                    processingAction={processingAction}
                    snapGuides={snapGuides}
                />
            </div>
        </div>
    );
};

export default ReelGenerationPage;
