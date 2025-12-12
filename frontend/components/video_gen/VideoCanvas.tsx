
import React from 'react';
import { CanvasVideo, SnapGuide } from '../../types';
import { ZoomControls, BottomToolbar, EditorToolbar } from './VideoGenAssets';
import { ConnectionLinesLayer } from './ConnectionLinesLayer';

interface VideoCanvasProps {
    videos: Record<string, CanvasVideo>;
    selectedVideoId: string | null;
    setSelectedVideoId: (id: string | null) => void;
    videoPlaybackErrors: Record<string, boolean>;
    setVideoPlaybackErrors: (prev: (p: Record<string, boolean>) => Record<string, boolean>) => void;
    transform: { x: number; y: number; scale: number };
    toolMode: 'select' | 'pan' | 'chat';
    setToolMode: (mode: 'select' | 'pan' | 'chat') => void;
    handleCanvasMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    handleCanvasMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
    handleCanvasMouseUp: () => void;
    handleCanvasWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
    handleVideoMouseDown?: (e: React.MouseEvent, videoId: string) => void;
    canvasRef: React.RefObject<HTMLDivElement>;
    zoom: (direction: 'in' | 'out') => void;
    setZoomLevel: (level: number) => void;
    handleDownloadVideo: () => void;
    handleCopyFrame: () => void;
    handleRegenerate: () => void;
    isLoading: boolean;
    snapGuides?: SnapGuide[];
    // Chat Props
    chattingVideoId?: string | null;
    onCanvasChatInput?: string;
    setOnCanvasChatInput?: (s: string) => void;
    handleOnCanvasChatSubmit?: (e: React.FormEvent) => void;
}

const VideoCanvas: React.FC<VideoCanvasProps> = ({
    videos, selectedVideoId, setSelectedVideoId, videoPlaybackErrors, setVideoPlaybackErrors,
    transform, toolMode, setToolMode, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasWheel, handleVideoMouseDown,
    canvasRef, zoom, setZoomLevel, handleDownloadVideo, handleCopyFrame, handleRegenerate, isLoading, snapGuides = [],
    chattingVideoId, onCanvasChatInput, setOnCanvasChatInput, handleOnCanvasChatSubmit
}) => {
    return (
        <div className="flex-1 relative bg-slate-50 overflow-hidden z-0" onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp} onWheel={handleCanvasWheel}>
            {/* Dot Pattern Background to match ImageGen */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px', transform: `translate(${transform.x % 24}px, ${transform.y % 24}px)` }}></div>
            
            <div ref={canvasRef} className="absolute top-0 left-0 w-full h-full origin-top-left transition-transform duration-75 ease-linear" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}>
                
                {/* Layer 1: Connection Lines */}
                <ConnectionLinesLayer videos={videos} />

                {/* Layer 2: Snap Guides */}
                {snapGuides.map((guide, i) => (
                    <div
                        key={i}
                        className="absolute border-indigo-500 border-dashed pointer-events-none z-40"
                        style={{
                            left: guide.orientation === 'vertical' ? guide.position : -10000,
                            top: guide.orientation === 'horizontal' ? guide.position : -10000,
                            width: guide.orientation === 'vertical' ? '1px' : '20000px', // Extend far
                            height: guide.orientation === 'horizontal' ? '1px' : '20000px',
                            borderLeftWidth: guide.orientation === 'vertical' ? '1px' : '0',
                            borderTopWidth: guide.orientation === 'horizontal' ? '1px' : '0',
                        }}
                    />
                ))}

                {/* Layer 3: Videos */}
                {(Object.values(videos) as CanvasVideo[]).map(v => (
                    <div 
                        key={v.id} 
                        className={`video-on-canvas absolute group transition-shadow duration-200 ${selectedVideoId === v.id || chattingVideoId === v.id ? 'z-30 ring-4 ring-indigo-500 shadow-2xl' : 'z-0 shadow-lg hover:shadow-xl'}
                        `} 
                        style={{ 
                            left: v.x, 
                            top: v.y, 
                            width: v.width, 
                            height: v.height,
                            cursor: toolMode === 'select' ? 'grab' : (toolMode === 'chat' ? 'text' : 'default')
                        }} 
                        onMouseDown={(e) => handleVideoMouseDown ? handleVideoMouseDown(e, v.id) : null}
                    >
                        {v.status === 'generating' ? (
                            <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-white p-4 text-center rounded-sm">
                                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                                <p className="text-xs font-medium animate-pulse">正在生成视频...</p>
                                <p className="text-[10px] text-slate-400 mt-1">可能需要 1-2 分钟</p>
                            </div>
                        ) : v.status === 'saving' ? (
                            <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-white p-4 text-center rounded-sm">
                                <div className="relative mb-3">
                                    <div className="w-10 h-10 border-4 border-indigo-500/30 rounded-full"></div>
                                    <div className="absolute top-0 left-0 w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                    <svg className="w-5 h-5 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                                    </svg>
                                </div>
                                <p className="text-xs font-medium animate-pulse text-indigo-200">正在云端保存...</p>
                                <p className="text-[10px] text-slate-400 mt-1">生成永久链接中</p>
                            </div>
                        ) : v.status === 'error' ? (
                            <div className="w-full h-full bg-red-50 flex flex-col items-center justify-center text-red-600 p-4 text-center border border-red-200 rounded-sm">
                                <span className="text-xl mb-2">⚠️</span>
                                <p className="text-xs font-bold">生成失败</p>
                                <p className="text-[10px] mt-1">{v.errorMsg}</p>
                            </div>
                        ) : (
                            <>
                                {videoPlaybackErrors[v.id] ? (
                                    <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center cursor-pointer group relative overflow-hidden rounded-sm border border-slate-800" onClick={(e) => { e.stopPropagation(); window.open(v.src, '_blank', 'noopener,noreferrer'); }} title="点击在新窗口播放视频">
                                        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-slate-900 to-black z-0"></div>
                                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}></div>
                                        <div className="relative z-10 w-14 h-14 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center mb-3 border border-white/10 shadow-2xl group-hover:scale-110 group-hover:bg-white/10 transition-all duration-300 ease-out">
                                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-inner">
                                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-slate-900 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
                                            </div>
                                        </div>
                                        <div className="relative z-10 text-center px-4">
                                            <p className="text-white font-bold text-sm tracking-wide drop-shadow-lg">视频已就绪</p>
                                            <p className="text-white/50 text-[10px] mt-1.5 font-medium group-hover:text-white/70 transition-colors">点击在新窗口播放</p>
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                                    </div>
                                ) : (
                                    <video src={v.src} key={v.src} className="w-full h-full object-cover rounded-sm" controls playsInline loop preload="auto" crossOrigin={v.src.startsWith('blob:') ? "anonymous" : undefined} onClick={(e) => { e.stopPropagation(); setSelectedVideoId(v.id); }} onError={() => setVideoPlaybackErrors(prev => ({ ...prev, [v.id]: true }))} />
                                )}
                                {selectedVideoId === v.id && !videoPlaybackErrors[v.id] && (
                                    <div className="editor-toolbar-wrapper absolute z-20" style={{ left: '50%', top: 0, transformOrigin: 'bottom center', transform: `translate(-50%, -100%) translateY(-${16 / transform.scale}px) scale(${1 / transform.scale})` }} onMouseDown={(e) => e.stopPropagation()}>
                                        <EditorToolbar onDownload={handleDownloadVideo} onCopyFrame={handleCopyFrame} onRegenerate={handleRegenerate} isGenerating={isLoading} />
                                    </div>
                                )}
                                {chattingVideoId === v.id && onCanvasChatInput !== undefined && setOnCanvasChatInput && handleOnCanvasChatSubmit && (
                                    <div 
                                        className="on-canvas-chat-box-wrapper absolute z-20"
                                        style={{
                                            left: '50%',
                                            top: '100%',
                                            transformOrigin: 'top center',
                                            transform: `translate(-50%, 0) translateY(${16 / transform.scale}px) scale(${1 / transform.scale})`
                                        }}
                                        onClick={e => e.stopPropagation()}
                                        onMouseDown={e => e.stopPropagation()}
                                    >
                                        <div className="w-[300px] bg-white rounded-2xl shadow-xl border border-slate-100 p-4 animate-fade-in-up">
                                            <div className="flex items-center space-x-2 mb-2 px-1">
                                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                                                <span className="text-xs font-bold text-slate-700">编辑视频指令</span>
                                            </div>
                                            <form onSubmit={handleOnCanvasChatSubmit} className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    autoFocus
                                                    value={onCanvasChatInput} 
                                                    onChange={e => setOnCanvasChatInput(e.target.value)} 
                                                    placeholder="例如: 变快一点..." 
                                                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                />
                                                <button type="submit" disabled={!onCanvasChatInput.trim()} className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors">执行</button>
                                            </form>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>
            <ZoomControls scale={transform.scale} onZoomIn={() => zoom('in')} onZoomOut={() => zoom('out')} onSetScale={setZoomLevel} />
            <BottomToolbar toolMode={toolMode} setToolMode={setToolMode} />
        </div>
    );
};

export default VideoCanvas;
