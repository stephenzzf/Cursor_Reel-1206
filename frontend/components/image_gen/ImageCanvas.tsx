
import React from 'react';
import { CanvasImage, SnapGuide } from '../../types';
import { ZoomControls, BottomToolbar, EditorToolbar } from './ImageGenAssets';
import { ConnectionLinesLayer } from './ConnectionLinesLayer';

interface ImageCanvasProps {
    images: Record<string, CanvasImage>;
    selectedImageId: string | null;
    chattingImageId: string | null;
    transform: { x: number; y: number; scale: number };
    toolMode: 'select' | 'pan' | 'chat';
    setToolMode: (mode: 'select' | 'pan' | 'chat') => void;
    handleCanvasMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    handleImageMouseDown: (e: React.MouseEvent, imageId: string) => void;
    handleCanvasMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
    handleCanvasMouseUp: () => void;
    handleCanvasWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
    canvasRef: React.RefObject<HTMLDivElement>;
    zoom: (direction: 'in' | 'out') => void;
    setZoomLevel: (level: number) => void;
    fitToScreen: () => void;
    handleImageClick: (e: React.MouseEvent, imageId: string) => void; 
    handleDownloadImage: () => void;
    handleUpscale: (factor: 2 | 4) => void;
    isUpscaling: boolean;
    handleRegenerate: () => void;
    handleRemoveBackground: () => void;
    isLoading: boolean;
    processingAction: 'regenerate' | 'remove-bg' | null;
    handleOnCanvasChatSubmit: (e: React.FormEvent) => void;
    onCanvasChatInput: string;
    setOnCanvasChatInput: (s: string) => void;
    setSelectedImageId: (id: string | null) => void;
    setChattingImageId: (id: string | null) => void;
    snapGuides?: SnapGuide[]; // New prop
}

const ImageCanvas: React.FC<ImageCanvasProps> = ({
    images, selectedImageId, chattingImageId, transform, toolMode, setToolMode,
    handleCanvasMouseDown, handleImageMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasWheel, canvasRef, zoom, setZoomLevel, fitToScreen,
    handleImageClick, handleDownloadImage, handleUpscale, isUpscaling, handleRegenerate, handleRemoveBackground,
    isLoading, processingAction, handleOnCanvasChatSubmit, onCanvasChatInput, setOnCanvasChatInput,
    snapGuides = []
}) => {
    // Get currently selected image details for toolbar logic
    const selectedImage = selectedImageId ? images[selectedImageId] : undefined;

    return (
        <div className="flex-1 relative bg-slate-50 overflow-hidden z-0"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleCanvasWheel}
        >
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px', transform: `translate(${transform.x % 24}px, ${transform.y % 24}px)` }}></div>
            <div ref={canvasRef} className="absolute top-0 left-0 w-full h-full origin-top-left transition-transform duration-75 ease-linear" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}>
                
                {/* Node Connection Lines Layer (Z-Index 0) */}
                <ConnectionLinesLayer images={images} />

                {/* Snap Guides Layer (Z-Index 40) */}
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

                {(Object.values(images) as CanvasImage[]).map((img) => (
                    <div 
                        key={img.id} 
                        className={`image-on-canvas absolute group transition-shadow duration-200 ${(selectedImageId === img.id || chattingImageId === img.id) ? 'z-30' : 'z-10'} ${selectedImageId === img.id ? 'ring-4 ring-indigo-500 shadow-2xl' : 'shadow-lg hover:shadow-xl'}`} 
                        style={{ 
                            left: img.x, 
                            top: img.y, 
                            width: img.width, 
                            height: img.height,
                            cursor: toolMode === 'select' ? 'grab' : (toolMode === 'chat' ? 'text' : 'default')
                        }}
                        onMouseDown={(e) => handleImageMouseDown(e, img.id)}
                    >
                        <img src={img.src} alt={img.alt} className="w-full h-full object-cover rounded-sm select-none" draggable={false} />
                        {selectedImageId === img.id && (
                            <div 
                                className="editor-toolbar-wrapper absolute z-20" 
                                style={{ 
                                    left: '50%', 
                                    top: 0, 
                                    transformOrigin: 'bottom center', 
                                    transform: `translate(-50%, -100%) translateY(-${16 / transform.scale}px) scale(${1 / transform.scale})` 
                                }}
                                onMouseDown={e => e.stopPropagation()} // Prevent dragging from toolbar
                            >
                                <EditorToolbar 
                                    onDownload={handleDownloadImage} 
                                    onUpscale={handleUpscale} 
                                    isUpscaling={isUpscaling} 
                                    onRegenerate={handleRegenerate}
                                    onRemoveBackground={handleRemoveBackground}
                                    isGenerating={isLoading}
                                    processingAction={processingAction}
                                    currentImageSize={selectedImage ? { width: selectedImage.width, height: selectedImage.height } : undefined}
                                />
                            </div>
                        )}
                            {chattingImageId === img.id && (
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
                                    <div className="flex items-center space-x-2 mb-2">
                                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                                        <span className="text-xs font-bold text-slate-700">编辑指令</span>
                                    </div>
                                    <form onSubmit={handleOnCanvasChatSubmit} className="flex gap-2">
                                        <input 
                                            type="text" 
                                            autoFocus
                                            value={onCanvasChatInput} 
                                            onChange={e => setOnCanvasChatInput(e.target.value)} 
                                            placeholder="例如: 换成蓝色背景..." 
                                            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        />
                                        <button type="submit" disabled={!onCanvasChatInput.trim()} className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors">执行</button>
                                    </form>
                                </div>
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

export default ImageCanvas;
