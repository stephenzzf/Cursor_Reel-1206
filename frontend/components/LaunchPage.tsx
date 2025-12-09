/**
 * Launch Page - 启动页面
 * 注意：由于登录后直接跳转到 Reel 页面，此页面可能不会被使用
 * 但保留此组件以确保应用能正常启动
 */

import React from 'react';

interface LaunchPageProps {
  onStartSeo: (url: string) => void;
  onStartImage: (prompt: string) => void;
  onStartVideo: (prompt: string) => void;
  onStartReel: (prompt: string) => void;
}

const LaunchPage: React.FC<LaunchPageProps> = ({ onStartReel }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-purple-50 to-blue-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Aideaon</h1>
        <p className="text-lg text-gray-600 mb-8">出海DTC Agentic AI</p>
        <button
          onClick={() => onStartReel('')}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          开始创作 Reel
        </button>
      </div>
    </div>
  );
};

export default LaunchPage;

