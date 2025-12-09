/**
 * Image Generation Page - 图片生成页面（占位符）
 */

import React from 'react';

interface ImageGenerationPageProps {
  initialPrompt: string;
  onReset: () => void;
}

const ImageGenerationPage: React.FC<ImageGenerationPageProps> = ({ onReset }) => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Image Generation</h1>
        <button
          onClick={onReset}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          返回
        </button>
      </div>
    </div>
  );
};

export default ImageGenerationPage;

