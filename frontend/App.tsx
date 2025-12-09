
import React, { useState, useCallback, useEffect } from 'react';
import LaunchPage from './components/LaunchPage';
import WorkspacePage from './components/WorkspacePage';
import ImageGenerationPage from './components/ImageGenerationPage';
import VideoGenerationPage from './components/VideoGenerationPage';
import ReelGenerationPage from './components/ReelGenerationPage'; 
import LoginPage from './components/LoginPage';
import { auth, firebaseError } from './firebaseConfig';

type Page = 'launch' | 'workspace' | 'image_generation' | 'video_generation' | 'reel_generation';

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Navigation State
  const [page, setPage] = useState<Page>('launch');
  const [url, setUrl] = useState<string>('');
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [videoPrompt, setVideoPrompt] = useState<string>('');
  const [reelPrompt, setReelPrompt] = useState<string>('');

  // Monitor Auth State
  useEffect(() => {
    if (auth) {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
            // 登录成功后直接跳转到 Reel 页面（仅在首次登录时）
            if (currentUser) {
                setPage((prevPage) => {
                    if (prevPage === 'launch') {
                        setReelPrompt(''); // 空提示词，让用户直接进入创作界面
                        return 'reel_generation';
                    }
                    return prevPage;
                });
            }
        });
        return () => unsubscribe();
    } else {
        setAuthLoading(false);
    }
  }, []);

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

  const handleStartReelCreation = useCallback((prompt: string) => {
    setReelPrompt(prompt);
    setPage('reel_generation');
  }, []);

  const handleReset = useCallback(() => {
    setUrl('');
    setImagePrompt('');
    setVideoPrompt('');
    setReelPrompt('');
    setPage('launch');
  }, []);

  if (authLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center animate-pulse">
                <div className="w-12 h-12 bg-purple-200 rounded-full mb-4"></div>
                <div className="h-4 w-32 bg-gray-200 rounded"></div>
            </div>
        </div>
      );
  }

  if (!user) {
      return <LoginPage authError={firebaseError || undefined} />;
  }

  return (
    <div className="min-h-screen font-sans bg-gradient-to-br from-white via-purple-50 to-blue-50">
      {page === 'launch' && (
        <LaunchPage 
          onStartSeo={handleStartSeoCreation} 
          onStartImage={handleStartImageCreation} 
          onStartVideo={handleStartVideoCreation}
          onStartReel={handleStartReelCreation}
        />
      )}
      {page === 'workspace' && <WorkspacePage url={url} onReset={handleReset} />}
      {page === 'image_generation' && <ImageGenerationPage initialPrompt={imagePrompt} onReset={handleReset} />}
      {page === 'video_generation' && <VideoGenerationPage initialPrompt={videoPrompt} onReset={handleReset} />}
      {page === 'reel_generation' && <ReelGenerationPage initialPrompt={reelPrompt} onReset={handleReset} />}
    </div>
  );
};

export default App;
