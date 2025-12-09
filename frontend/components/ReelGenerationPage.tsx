
import React from 'react';
import { useReelGeneration } from '../hooks/useReelGeneration';
import { Header } from './reel_gen/ReelGenAssets';
import ReelChatSidebar from './reel_gen/ReelChatSidebar';
import ReelCanvas from './reel_gen/ReelCanvas';
import { useUserProfile } from '../hooks/useUserProfile';
import UserStatusChip from './common/UserStatusChip';

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
        isUpscaling, processingAction, handleSwitchModel, handleUseSuggestion, handleUseDesignPlan
    } = useReelGeneration(initialPrompt, userProfile, isProfileLoading);

    return (
        <div className="h-screen w-screen flex flex-col font-sans bg-[#F8F9FC] text-slate-600 relative">
            <UserStatusChip profile={userProfile} onLogout={logout} />
            <Header onReset={onReset} onOpenArchive={() => setIsArchiveOpen(true)} />
            
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
                />
                
                <ReelCanvas
                    assets={assets}
                    selectedAssetId={selectedAssetId}
                    transform={transform}
                    toolMode={toolMode}
                    chattingAssetId={chattingAssetId}
                    isLoading={isLoading}
                    
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
                />
            </div>
        </div>
    );
};

export default ReelGenerationPage;
