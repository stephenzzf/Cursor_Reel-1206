
import React from 'react';
import { CanvasImage } from '../../types';

interface ConnectionLinesLayerProps {
    images: Record<string, CanvasImage>;
}

export const ConnectionLinesLayer: React.FC<ConnectionLinesLayerProps> = ({ images }) => {
    return (
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible z-0">
            <defs>
                <marker id="arrowhead" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                    <path d="M2,2 L10,6 L2,10 L2,2" fill="#64748b" />
                </marker>
            </defs>
            {(Object.values(images) as CanvasImage[]).map(img => {
                if (!img.sourceImageId || !images[img.sourceImageId]) return null;
                const source = images[img.sourceImageId];
                
                // Calculate centers
                const sx = source.x + source.width / 2;
                const sy = source.y + source.height / 2;
                const tx = img.x + img.width / 2;
                const ty = img.y + img.height / 2;

                const dx = tx - sx;
                const dy = ty - sy;
                
                let path = '';
                
                // Adaptive Bezier Curve
                // If vertical distance is significant, use vertical control points (S-shape top-to-bottom)
                // Otherwise use horizontal control points (S-shape left-to-right)
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
                        key={`${source.id}-${img.id}`}
                        d={path}
                        stroke="#64748b" // Slate-500 for better visibility
                        strokeWidth="3"  // Thicker line
                        fill="none"
                        markerEnd="url(#arrowhead)"
                        className="transition-all duration-300 ease-in-out"
                    />
                );
            })}
        </svg>
    );
};
