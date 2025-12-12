
import React from 'react';
import { useVideoGeneration } from '../hooks/useVideoGeneration';
import { Header } from './video_gen/VideoGenAssets';
import VideoChatSidebar from './video_gen/VideoChatSidebar';
import VideoCanvas from './video_gen/VideoCanvas';
import { useUserProfile } from '../hooks/useUserProfile';
import UserStatusChip from './common/UserStatusChip';

interface VideoGenerationPageProps {
    initialPrompt: string;
    onReset: () => void;
}

const VideoGenerationPage: React.FC<VideoGenerationPageProps> = ({ initialPrompt, onReset }) => {
    const { userProfile, loading: isProfileLoading, logout } = useUserProfile();
    const {
        messages, videos, isLoading, userInput, setUserInput, uploadedFiles,
        selectedVideoId, setSelectedVideoId, isArchiveOpen, setIsArchiveOpen,
        videoSeries, archiveSummaries, enhancePromptEnabled, setEnhancePromptEnabled,
        designInspirationEnabled, setDesignInspirationEnabled, aspectRatio, setAspectRatio,
        selectedModel, setSelectedModel, videoPlaybackErrors, setVideoPlaybackErrors,
        transform, toolMode, setToolMode,
        handleFileChange, handleRemoveFile, handlePaste, handleSubmit,
        handleUseSuggestion, handleUseDesignPlan, handleRegenerate,
        handleDownloadVideo, handleCopyFrame, handleDownloadArchiveVideo, handleSelectArchiveVideo,
        handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasWheel, zoom, setZoomLevel,
        handleVideoMouseDown, snapGuides,
        canvasRef, messagesEndRef, userInputRef,
        chattingVideoId, onCanvasChatInput, setOnCanvasChatInput, handleOnCanvasChatSubmit,
        galleryItems
    } = useVideoGeneration(initialPrompt, userProfile, isProfileLoading);

    return (
        <div className="h-screen w-screen flex flex-col font-sans bg-[#F8F9FC] text-slate-600 relative">
            <UserStatusChip profile={userProfile} onLogout={logout} />
            <Header onReset={onReset} onOpenArchive={() => setIsArchiveOpen(true)} />
            <div className="flex-1 flex overflow-hidden">
                <VideoChatSidebar
                    messages={messages}
                    videos={videos}
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
                    videoSeries={videoSeries}
                    archiveSummaries={archiveSummaries}
                    galleryItems={galleryItems}
                    handleDownloadArchiveVideo={handleDownloadArchiveVideo}
                    handleSelectArchiveVideo={handleSelectArchiveVideo}
                    setSelectedVideoId={setSelectedVideoId}
                    handleUseSuggestion={handleUseSuggestion}
                    handleUseDesignPlan={handleUseDesignPlan}
                    videoPlaybackErrors={videoPlaybackErrors}
                    setVideoPlaybackErrors={setVideoPlaybackErrors}
                    userInputRef={userInputRef}
                    messagesEndRef={messagesEndRef}
                />
                <VideoCanvas
                    videos={videos}
                    selectedVideoId={selectedVideoId}
                    setSelectedVideoId={setSelectedVideoId}
                    videoPlaybackErrors={videoPlaybackErrors}
                    setVideoPlaybackErrors={setVideoPlaybackErrors}
                    transform={transform}
                    toolMode={toolMode}
                    setToolMode={setToolMode}
                    handleCanvasMouseDown={handleCanvasMouseDown}
                    handleCanvasMouseMove={handleCanvasMouseMove}
                    handleCanvasMouseUp={handleCanvasMouseUp}
                    handleCanvasWheel={handleCanvasWheel}
                    handleVideoMouseDown={handleVideoMouseDown}
                    canvasRef={canvasRef}
                    zoom={zoom}
                    setZoomLevel={setZoomLevel}
                    handleDownloadVideo={handleDownloadVideo}
                    handleCopyFrame={handleCopyFrame}
                    handleRegenerate={handleRegenerate}
                    isLoading={isLoading}
                    snapGuides={snapGuides}
                    chattingVideoId={chattingVideoId}
                    onCanvasChatInput={onCanvasChatInput}
                    setOnCanvasChatInput={setOnCanvasChatInput}
                    handleOnCanvasChatSubmit={handleOnCanvasChatSubmit}
                />
            </div>
        </div>
    );
};

export default VideoGenerationPage;
