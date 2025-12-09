/**
 * Workspace Page - 工作空间页面（占位符）
 */

import React from 'react';

interface WorkspacePageProps {
  url: string;
  onReset: () => void;
}

const WorkspacePage: React.FC<WorkspacePageProps> = ({ onReset }) => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Workspace</h1>
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

export default WorkspacePage;

