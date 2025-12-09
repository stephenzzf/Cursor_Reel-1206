
import React from 'react';
import { ReelAsset } from '../../types';

interface ConnectionLinesLayerProps {
    assets: Record<string, ReelAsset>;
}

export const ConnectionLinesLayer: React.FC<ConnectionLinesLayerProps> = ({ assets }) => {
    return (
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible z-0">
            <defs>
                <marker id="arrowhead-reel" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                    <path d="M2,2 L10,6 L2,10 L2,2" fill="#94a3b8" />
                </marker>
            </defs>
            {(Object.values(assets) as ReelAsset[]).map(asset => {
                // If this asset was derived from another asset (sourceAssetId)
                if (!asset.sourceAssetId || !assets[asset.sourceAssetId]) return null;
                const source = assets[asset.sourceAssetId];
                
                // Calculate centers
                const sx = source.x + source.width / 2;
                const sy = source.y + source.height / 2;
                const tx = asset.x + asset.width / 2;
                const ty = asset.y + asset.height / 2;

                const dx = tx - sx;
                const dy = ty - sy;
                
                let path = '';
                
                // Simple horizontal S-curve preference for flow
                const cp1x = sx + dx * 0.5;
                const cp2x = tx - dx * 0.5;
                path = `M ${sx} ${sy} C ${cp1x} ${sy}, ${cp2x} ${ty}, ${tx} ${ty}`;

                return (
                    <path
                        key={`${source.id}-${asset.id}`}
                        d={path}
                        stroke="#cbd5e1" // Slate-300
                        strokeWidth="2"
                        fill="none"
                        markerEnd="url(#arrowhead-reel)"
                        className="transition-all duration-300 ease-in-out"
                    />
                );
            })}
        </svg>
    );
};
