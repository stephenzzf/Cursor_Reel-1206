
import React, { useState, useCallback } from 'react';
import LaunchPage from './components/LaunchPage';
import WorkspacePage from './components/WorkspacePage';
import ImageGenerationPage from './components/ImageGenerationPage';
import VideoGenerationPage from './components/VideoGenerationPage';

type Page = 'launch' | 'workspace' | 'image_generation' | 'video_generation';

const App: React.FC = () => {
  const [page, setPage] = useState<Page>('launch');
  const [url, setUrl] = useState<string>('');
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [videoPrompt, setVideoPrompt] = useState<string>('');

  const handleStartSeoCreation = useCallback((newUrl: string) => {
    setUrl(newUrl);
    setPage('workspace');
  }, []);
  
  const handleStartImageCreation = useCallback((prompt: string) => {
    setImagePrompt(prompt);
    setPage('image_generation');
  }, []);

  const handleStartVideoCreation = useCallback((prompt: string) => {
    setVideoPrompt(prompt);
    setPage('video_generation');
  }, []);

  const handleReset = useCallback(() => {
    setUrl('');
    setImagePrompt('');
    setVideoPrompt('');
    setPage('launch');
  }, []);

  return (
    <div className="min-h-screen font-sans bg-gradient-to-br from-white via-purple-50 to-blue-50">
      {page === 'launch' && <LaunchPage onStartSeo={handleStartSeoCreation} onStartImage={handleStartImageCreation} onStartVideo={handleStartVideoCreation} />}
      {page === 'workspace' && <WorkspacePage url={url} onReset={handleReset} />}
      {page === 'image_generation' && <ImageGenerationPage initialPrompt={imagePrompt} onReset={handleReset} />}
      {page === 'video_generation' && <VideoGenerationPage initialPrompt={videoPrompt} onReset={handleReset} />}
    </div>
  );
};

export default App;
