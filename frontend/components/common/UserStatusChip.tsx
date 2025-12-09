import React from 'react';
import { UserProfile } from '../../types';

interface UserStatusChipProps {
    profile: UserProfile | null;
    onLogout: () => void;
}

const UserStatusChip: React.FC<UserStatusChipProps> = ({ profile, onLogout }) => {
    if (!profile) return null;

    const isPro = profile.tier === 'pro';

    return (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 animate-fade-in">
            <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md border border-gray-200/60 rounded-full pl-4 pr-2 py-1.5 shadow-sm hover:shadow-md transition-all duration-300">
                {/* Credits */}
                <div className="flex items-center gap-1.5 border-r border-gray-200 pr-3">
                    <span className="text-lg">💎</span>
                    <span className="text-sm font-bold text-gray-700 tabular-nums">{profile.credits}</span>
                </div>

                {/* Tier Badge */}
                <div className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isPro 
                    ? 'bg-gradient-to-r from-amber-100 to-yellow-200 text-yellow-800 border border-yellow-300 shadow-[0_0_8px_rgba(253,224,71,0.4)]' 
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}>
                    {profile.tier}
                </div>

                {/* User Avatar / Name */}
                <div className="flex items-center gap-2 pl-1">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold text-gray-800 leading-none truncate max-w-[100px]">{profile.displayName}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-inner ring-2 ring-white select-none">
                        {(profile.displayName || 'U').charAt(0).toUpperCase()}
                    </div>
                </div>

                {/* Logout Button */}
                <button 
                    onClick={onLogout}
                    className="ml-1 w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    title="Logout"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default UserStatusChip;