
import React from 'react';
import { useImageGeneration } from '../hooks/useImageGeneration';
import { Header } from './image_gen/ImageGenAssets';
import ImageChatSidebar from './image_gen/ImageChatSidebar';
import ImageCanvas from './image_gen/ImageCanvas';
import BrandProfileManagerModal from './image_gen/BrandProfileManagerModal';
import { useUserProfile } from '../hooks/useUserProfile';
import UserStatusChip from './common/UserStatusChip';
import { ConfigErrorBanner } from './workspace/WorkspaceUI';

interface ImageGenerationPageProps { initialPrompt: string; onReset: () => void; }

const ImageGenerationPage: React.FC<ImageGenerationPageProps> = ({ initialPrompt, onReset }) => {
    const { userProfile, loading: isProfileLoading, logout } = useUserProfile();
    // Pass userProfile AND isProfileLoading to the hook to enable correct credit checks and avoid race conditions
    const {
        messages, images, userInput, setUserInput, uploadedFiles, isLoading, isUpscaling, processingAction, selectedImageId,
        isArchiveOpen, setIsArchiveOpen, archiveSummaries, enhancePromptEnabled, setEnhancePromptEnabled,
        designInspirationEnabled, setDesignInspirationEnabled, aspectRatio, setAspectRatio, selectedModel, setSelectedModel,
        transform, toolMode, chattingImageId, onCanvasChatInput, setOnCanvasChatInput, isEditing, inputHighlight,
        handleFileChange, handleRemoveFile, handlePaste, handleSubmit, handleUseSuggestion, handleUseDesignPlan,
        handleCanvasMouseDown, handleImageMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasWheel, zoom, setZoomLevel, fitToScreen,
        handleSetToolMode, handleImageClick, handleDownloadImage, handleDownloadArchiveImage,
        handleUpscale, handleRegenerate, handleRemoveBackground, handleOnCanvasChatSubmit,
        imageSeries, canvasRef, messagesEndRef, userInputRef, setSelectedImageId, setChattingImageId, setTransform,
        galleryItems, handleSelectGalleryItem, snapGuides,
        // Brand DNA
        visualProfiles, activeProfile, setActiveProfile, deleteProfile, isDNAOpen, setIsDNAOpen,
        configError, setConfigError, // Receive error state
        handleLoadBrandImageToCanvas // Receive the handler
    } = useImageGeneration(initialPrompt, userProfile, isProfileLoading);

    return (
        <div className="h-screen w-screen flex flex-col font-sans bg-[#F8F9FC] text-slate-600 relative">
             <UserStatusChip profile={userProfile} onLogout={logout} />
             <Header onReset={onReset} onOpenArchive={() => setIsArchiveOpen(true)} onOpenBrandDNA={() => setIsDNAOpen(true)} activeDNA={activeProfile?.name} />
             
             {/* DNA Manager Modal */}
             <BrandProfileManagerModal 
                isOpen={isDNAOpen} 
                onClose={() => setIsDNAOpen(false)}
                profiles={visualProfiles}
                activeProfileId={activeProfile?.id || null}
                onSetActive={setActiveProfile}
                onDelete={deleteProfile}
                mode="image" // Explicitly set mode to image
             />

             {/* Config Error Banner */}
             {configError && <ConfigErrorBanner errorType={configError} onDismiss={() => setConfigError(null)} />}

            <div className="flex-1 flex overflow-hidden">
                <ImageChatSidebar
                    messages={messages}
                    images={images}
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
                    aspectRatio={aspectRatio}
                    setAspectRatio={setAspectRatio}
                    selectedModel={selectedModel}
                    setSelectedModel={setSelectedModel}
                    isArchiveOpen={isArchiveOpen}
                    setIsArchiveOpen={setIsArchiveOpen}
                    imageSeries={imageSeries}
                    archiveSummaries={archiveSummaries}
                    handleDownloadArchiveImage={handleDownloadArchiveImage}
                    setSelectedImageId={setSelectedImageId}
                    handleUseSuggestion={handleUseSuggestion}
                    handleUseDesignPlan={handleUseDesignPlan}
                    userInputRef={userInputRef}
                    messagesEndRef={messagesEndRef}
                    isEditing={isEditing}
                    inputHighlight={inputHighlight || false}
                    galleryItems={galleryItems}
                    handleSelectGalleryItem={handleSelectGalleryItem}
                    onReset={onReset}
                    // DNA Props
                    activeDNAName={activeProfile?.name}
                    onDeactivateDNA={() => setActiveProfile(null)}
                    onLoadBrandImage={handleLoadBrandImageToCanvas} // Pass the handler here
                    setTransform={setTransform}
                    fitToScreen={fitToScreen}
                />

                <ImageCanvas
                    images={images}
                    selectedImageId={selectedImageId}
                    chattingImageId={chattingImageId}
                    transform={transform}
                    toolMode={toolMode}
                    setToolMode={handleSetToolMode}
                    handleCanvasMouseDown={handleCanvasMouseDown}
                    handleImageMouseDown={handleImageMouseDown}
                    handleCanvasMouseMove={handleCanvasMouseMove}
                    handleCanvasMouseUp={handleCanvasMouseUp}
                    handleCanvasWheel={handleCanvasWheel}
                    canvasRef={canvasRef}
                    zoom={zoom}
                    setZoomLevel={setZoomLevel}
                    fitToScreen={fitToScreen}
                    handleImageClick={handleImageClick}
                    handleDownloadImage={handleDownloadImage}
                    handleUpscale={handleUpscale}
                    isUpscaling={isUpscaling}
                    handleRegenerate={handleRegenerate}
                    handleRemoveBackground={handleRemoveBackground}
                    isLoading={isLoading}
                    processingAction={processingAction}
                    handleOnCanvasChatSubmit={handleOnCanvasChatSubmit}
                    onCanvasChatInput={onCanvasChatInput}
                    setOnCanvasChatInput={setOnCanvasChatInput}
                    setSelectedImageId={setSelectedImageId}
                    setChattingImageId={setChattingImageId}
                    snapGuides={snapGuides}
                />
            </div>
        </div>
    );
};

export default ImageGenerationPage;

