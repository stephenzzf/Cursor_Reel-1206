
import React from 'react';
import { CanvasVideo } from '../../types';

interface ConnectionLinesLayerProps {
    videos: Record<string, CanvasVideo>;
}

export const ConnectionLinesLayer: React.FC<ConnectionLinesLayerProps> = ({ videos }) => {
    return (
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible z-0">
            <defs>
                <marker id="arrowhead-video" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                    <path d="M2,2 L10,6 L2,10 L2,2" fill="#94a3b8" />
                </marker>
            </defs>
            {(Object.values(videos) as CanvasVideo[]).map(video => {
                if (!video.sourceVideoId || !videos[video.sourceVideoId]) return null;
                const source = videos[video.sourceVideoId];
                
                // Calculate centers
                const sx = source.x + source.width / 2;
                const sy = source.y + source.height / 2;
                const tx = video.x + video.width / 2;
                const ty = video.y + video.height / 2;

                const dx = tx - sx;
                const dy = ty - sy;
                
                let path = '';
                
                // Adaptive Bezier Curve - similar to ImageCanvas
                if (Math.abs(dy) > Math.abs(dx)) {
                    const cp1y = sy + dy * 0.5;
                    const cp2y = ty - dy * 0.5;
                    path = `M ${sx} ${sy} C ${sx} ${cp1y}, ${tx} ${cp2y}, ${tx} ${ty}`;
                } else {
                    const cp1x = sx + dx * 0.5;
                    const cp2x = tx - dx * 0.5;
                    path = `M ${sx} ${sy} C ${cp1x} ${sy}, ${cp2x} ${ty}, ${tx} ${ty}`;
                }

                return (
                    <path
                        key={`${source.id}-${video.id}`}
                        d={path}
                        stroke="#cbd5e1" // Slate-300
                        strokeWidth="2"
                        fill="none"
                        markerEnd="url(#arrowhead-video)"
                        className="transition-all duration-300 ease-in-out"
                    />
                );
            })}
        </svg>
    );
};
