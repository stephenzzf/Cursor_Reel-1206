
import React from 'react';

const LogoIcon: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`relative ${className}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
                <radialGradient id="logo-grad-bg" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                    <stop offset="0%" stopColor="#A5B4FC" />
                    <stop offset="100%" stopColor="#6366F1" />
                </radialGradient>
                <linearGradient id="logo-grad-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(129, 140, 248, 0.7)"/>
                    <stop offset="100%" stopColor="rgba(165, 180, 252, 0.2)"/>
                </linearGradient>
            </defs>
            
            <g className="origin-center">
                 <circle cx="50" cy="50" r="48" stroke="url(#logo-grad-ring)" strokeWidth="1.5" className="animate-ring-spin" style={{animationDuration: '10s'}} />
                 <circle cx="50" cy="50" r="40" stroke="url(#logo-grad-ring)" strokeWidth="1" className="animate-ring-spin-reverse" style={{animationDuration: '15s'}} opacity="0.7"/>
            </g>

            <g className="animate-logo-pulse origin-center">
                <circle cx="50" cy="50" r="35" fill="url(#logo-grad-bg)" />
                <text
                    x="50"
                    y="52" 
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'"
                    fontSize="50"
                    fontWeight="bold"
                    fill="#FFFFFF"
                    stroke="#4F46E5"
                    strokeWidth="0.5"
                    strokeLinejoin="round"
                    paintOrder="stroke"
                >
                    M
                </text>
            </g>
        </svg>
    </div>
);

export default LogoIcon;
