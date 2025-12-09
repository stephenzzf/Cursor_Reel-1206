
import React from 'react';
import { ReelAsset, SnapGuide } from '../../types';
import { ZoomControls, BottomToolbar, ReelEditorToolbar } from './ReelGenAssets';
import { ConnectionLinesLayer } from './ConnectionLinesLayer';

interface ReelCanvasProps {
    assets: Record<string, ReelAsset>;
    selectedAssetId: string | null;
    transform: { x: number; y: number; scale: number };
    toolMode: 'select' | 'pan' | 'chat';
    chattingAssetId: string | null;
    isLoading: boolean;
    
    // Handlers
    setToolMode: (m: 'select' | 'pan' | 'chat') => void;
    handleCanvasMouseDown: (e: React.MouseEvent) => void;
    handleCanvasMouseMove: (e: React.MouseEvent) => void;
    handleCanvasMouseUp: () => void;
    handleCanvasWheel: (e: React.WheelEvent) => void;
    handleAssetMouseDown: (e: React.MouseEvent, id: string) => void;
    zoom: (d: 'in' | 'out') => void;
    setZoomLevel: (s: number) => void;
    fitToScreen: () => void;
    
    // Actions
    handleDownload: () => void;
    handleCopyFrame: () => void;
    handleUpscale: (factor: 2 | 4) => void;
    handleRemoveBackground: () => void;
    handleRegenerate: () => void;
    isUpscaling: boolean;
    processingAction: 'regenerate' | 'remove-bg' | null;
    
    // Chat Bubble
    onCanvasChatInput: string;
    setOnCanvasChatInput: (s: string) => void;
    handleOnCanvasChatSubmit: (e: React.FormEvent) => void;
    
    snapGuides?: SnapGuide[]; // Add missing prop definition for type safety
}

const ReelCanvas: React.FC<ReelCanvasProps> = ({
    assets, selectedAssetId, transform, toolMode, chattingAssetId, isLoading,
    setToolMode, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasWheel, handleAssetMouseDown,
    zoom, setZoomLevel, fitToScreen, onCanvasChatInput, setOnCanvasChatInput, handleOnCanvasChatSubmit,
    handleDownload, handleCopyFrame, handleUpscale, handleRemoveBackground, handleRegenerate, isUpscaling, processingAction,
    snapGuides = []
}) => {
    
    const renderAssetContent = (asset: ReelAsset) => {
        if (asset.status === 'generating' || asset.status === 'saving') {
            return (
                <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-white p-4 text-center">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                    <p className="text-xs font-medium animate-pulse">{asset.status === 'saving' ? 'Saving...' : 'Generating...'}</p>
                </div>
            );
        }
        if (asset.status === 'error') {
            return (
                <div className="w-full h-full bg-red-50 flex flex-col items-center justify-center text-red-600 p-4 text-center border border-red-200">
                    <span className="text-xl mb-2">⚠️</span>
                    <p className="text-xs font-bold">Error</p>
                </div>
            );
        }

        if (asset.type === 'video') {
            // Logic to determine if CORS is safe
            const isLocalBlob = asset.src.startsWith('blob:');
            
            return (
                <video 
                    id={`reel-video-${asset.id}`}
                    src={asset.src} 
                    className="w-full h-full object-cover" 
                    controls 
                    playsInline 
                    loop
                    preload="metadata"
                    // IMPORTANT: Only set crossOrigin if it's a blob (local) or we are sure the remote supports it.
                    // Setting it to 'anonymous' on a restricted remote video will block playback.
                    crossOrigin={isLocalBlob ? "anonymous" : undefined}
                />
            );
        } else {
            return (
                <img 
                    src={asset.src} 
                    alt={asset.prompt} 
                    className="w-full h-full object-cover"
                    draggable={false}
                />
            );
        }
    };

    return (
        <div 
            className="flex-1 relative bg-slate-50 overflow-hidden z-0"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleCanvasWheel}
        >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px', transform: `translate(${transform.x % 24}px, ${transform.y % 24}px)` }}></div>
            
            <div className="absolute top-0 left-0 w-full h-full origin-top-left transition-transform duration-75 ease-linear" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}>
                
                <ConnectionLinesLayer assets={assets} />

                {/* Snap Guides */}
                {snapGuides.map((guide, i) => (
                    <div
                        key={i}
                        className="absolute border-indigo-500 border-dashed pointer-events-none z-40"
                        style={{
                            left: guide.orientation === 'vertical' ? guide.position : -10000,
                            top: guide.orientation === 'horizontal' ? guide.position : -10000,
                            width: guide.orientation === 'vertical' ? '1px' : '20000px', 
                            height: guide.orientation === 'horizontal' ? '1px' : '20000px',
                            borderLeftWidth: guide.orientation === 'vertical' ? '1px' : '0',
                            borderTopWidth: guide.orientation === 'horizontal' ? '1px' : '0',
                        }}
                    />
                ))}

                {(Object.values(assets) as ReelAsset[]).map(asset => (
                    <div 
                        key={asset.id}
                        // Removed overflow-hidden from here to allow Toolbar to pop out
                        className={`asset-on-canvas absolute group transition-shadow duration-200
                            ${selectedAssetId === asset.id || chattingAssetId === asset.id ? 'z-30 ring-4 ring-indigo-500 shadow-2xl' : 'z-10 shadow-lg hover:shadow-xl'}
                        `}
                        style={{
                            left: asset.x,
                            top: asset.y,
                            width: asset.width,
                            height: asset.height,
                            cursor: toolMode === 'select' ? 'grab' : (toolMode === 'chat' ? 'text' : 'default')
                        }}
                        onMouseDown={(e) => handleAssetMouseDown(e, asset.id)}
                    >
                        {/* Visual Content Wrapper - Keeps content rounded and clipped */}
                        <div className="w-full h-full overflow-hidden rounded-lg bg-white relative">
                            {renderAssetContent(asset)}
                            
                            {/* Type Badge (Inside to clip correctly) */}
                            <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold rounded uppercase pointer-events-none">
                                {asset.type}
                            </div>
                        </div>

                        {/* Editor Toolbar (Outside Content Wrapper so it's visible) */}
                        {selectedAssetId === asset.id && asset.status === 'done' && (
                            <div 
                                className="editor-toolbar-wrapper absolute z-20" 
                                style={{ 
                                    left: '50%', 
                                    top: 0, 
                                    transformOrigin: 'bottom center', 
                                    // Shift up by 100% of its own height + padding, scaled inversely to maintain size
                                    transform: `translate(-50%, -100%) translateY(-${16 / transform.scale}px) scale(${1 / transform.scale})` 
                                }}
                                onMouseDown={e => e.stopPropagation()} 
                            >
                                <ReelEditorToolbar 
                                    assetType={asset.type}
                                    onDownload={handleDownload}
                                    onRegenerate={handleRegenerate}
                                    isProcessing={isLoading}
                                    processingAction={processingAction}
                                    onUpscale={handleUpscale}
                                    onRemoveBackground={handleRemoveBackground}
                                    isUpscaling={isUpscaling}
                                    onCopyFrame={handleCopyFrame}
                                />
                            </div>
                        )}

                        {/* On-Canvas Chat Input */}
                        {chattingAssetId === asset.id && (
                            <div 
                                className="absolute z-50 left-1/2 top-full -translate-x-1/2 mt-4 w-64 bg-white rounded-xl shadow-xl border border-slate-100 p-2 animate-fade-in-up"
                                onMouseDown={(e) => e.stopPropagation()}
                                style={{ transform: `scale(${1/transform.scale})`, transformOrigin: 'top center' }}
                            >
                                <div className="flex items-center space-x-2 mb-2 px-1">
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Edit {asset.type}</span>
                                </div>
                                <form onSubmit={handleOnCanvasChatSubmit} className="flex gap-2">
                                    <input 
                                        type="text" 
                                        autoFocus
                                        value={onCanvasChatInput} 
                                        onChange={e => setOnCanvasChatInput(e.target.value)} 
                                        placeholder={`例如: ${asset.type === 'image' ? '换成红色背景...' : '变快一点...'}`} 
                                        className="flex-1 text-sm border border-slate-200 rounded px-2 py-1 outline-none focus:border-indigo-500"
                                    />
                                    <button type="submit" disabled={!onCanvasChatInput.trim()} className="bg-indigo-600 text-white text-xs px-2 rounded hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400">→</button>
                                </form>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <ZoomControls scale={transform.scale} onZoomIn={() => zoom('in')} onZoomOut={() => zoom('out')} onSetScale={setZoomLevel} />
            <BottomToolbar toolMode={toolMode} setToolMode={setToolMode} onFitToScreen={fitToScreen} />
        </div>
    );
};

export default ReelCanvas;
